import hashlib
import json
import didkit
from flask import Blueprint, request, jsonify, g
import mysql.connector
import uuid
from datetime import datetime
from app.database import get_db
from .auth_routes import async_token_required, token_required

holder = Blueprint('holder', __name__)

@holder.route('/list_credentials', methods=['GET'])
@token_required
def get_holder_credentials():
    # The decorator puts the user's data in g.current_user
    holder_user = g.current_user
    if holder_user['role'] != 'holder':
        return jsonify({"error": "Unauthorized"}), 403

    holder_id = holder_user['user_id']
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM Credentials WHERE holder_id = %s ORDER BY issued_at DESC", (holder_id,))
        credentials = cursor.fetchall()
        return jsonify(credentials)
    finally:
        cursor.close()

@holder.route('/create_presentation', methods=['POST'])
@async_token_required
async def create_presentation():
    holder_user = g.current_user
    data = request.get_json()
    cred_id = data.get('cred_id')
    disclosure_frame = data.get('disclosure_frame')  # Should be a dict like: {"credentialSubject": ["name", "birthDate"]}

    if not cred_id or not disclosure_frame:
        return jsonify({"error": "cred_id and disclosure_frame are required"}), 400

    db = get_db()
    try:
        cursor = db.cursor(dictionary=True)

        # Fetch credential and private key
        query = """
            SELECT c.credential_data, u.private_key 
            FROM Credentials c
            JOIN Users u ON c.holder_id = u.user_id
            WHERE c.cred_id = %s AND c.holder_id = %s
        """
        cursor.execute(query, (cred_id, holder_user['user_id']))
        record = cursor.fetchone()
        cursor.close()

        if not record:
            return jsonify({"error": "Credential not found or you are not the holder."}), 403
        
        if not record.get('private_key'):
            return jsonify({"error": "Holder's private key not found. Cannot sign presentation."}), 500

        original_vc = json.loads(record['credential_data'])
        holder_jwk_str = record['private_key']

        # --- Manual Disclosure Frame Application ---
        def apply_disclosure(vc, frame):
            disclosed = {
                "@context": vc.get("@context"),
                "type": vc.get("type"),
                "issuer": vc.get("issuer"),
                "issuanceDate": vc.get("issuanceDate"),
                "credentialSubject": {},
                "id": vc.get("id")
            }

            requested_fields = frame.get("credentialSubject", [])
            for field in requested_fields:
                if field in vc.get("credentialSubject", {}):
                    disclosed["credentialSubject"][field] = vc["credentialSubject"][field]

            return disclosed

        framed_vc = apply_disclosure(original_vc, disclosure_frame)

        # Build the presentation
        presentation_payload = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiablePresentation"],
            "verifiableCredential": [framed_vc]
        }

        # Generate verification method and proof options
        verification_method = await didkit.key_to_verification_method("key", holder_jwk_str)
        proof_options = {
            "proofPurpose": "authentication",
            "verificationMethod": verification_method
        }

        # Sign the presentation
        presentation_str = await didkit.issue_presentation(
            json.dumps(presentation_payload),
            json.dumps(proof_options),
            holder_jwk_str
        )

        return jsonify(json.loads(presentation_str)), 200

    except Exception as e:
        print(f"Error creating presentation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Could not create presentation: {str(e)}"}), 500

@holder.route('/upload', methods=['POST'])
@async_token_required
async def upload_document():
    """
    Verifies and uploads either a VC or a VP, storing its category and title.
    Prevents duplicates across all users.
    """
    holder_user = g.current_user
    payload = request.get_json()

    if not payload or not isinstance(payload, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    payload_str = json.dumps(payload)
    doc_type_list = payload.get("type", [])
    category = None
    
    # 1. Identify and Verify the document
    try:
        if "VerifiablePresentation" in doc_type_list:
            category = 'VP'
            result_str = await didkit.verify_presentation(payload_str, "{}")
        elif "VerifiableCredential" in doc_type_list:
            category = 'VC'
            result_str = await didkit.verify_credential(payload_str, "{}")
        else:
            return jsonify({"error": "Document is not a valid VC or VP. The 'type' field is missing or invalid."}), 400

        verification_result = json.loads(result_str)
        if verification_result.get("errors"):
            return jsonify({"error": f"The provided {category} is not valid.", "details": verification_result["errors"]}), 400
            
    except Exception as e:
        return jsonify({"error": f"Error during cryptographic verification: {str(e)}"}), 500

    # 2. If valid, proceed with database operations
    db = get_db()
    cursor = db.cursor()
    try:
        # Generate a hash of the entire document for duplicate checking
        credential_hash = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()

        # Check if this exact document hash already exists anywhere in the system
        cursor.execute("SELECT cred_id FROM Credentials WHERE credential_hash = %s", (credential_hash,))
        if cursor.fetchone():
            return jsonify({"error": "This document has already been imported into the system."}), 409

        # Use a placeholder ID for externally imported documents
        external_issuer_id = 1 # IMPORTANT: Ensure a user with ID=1 exists and is an issuer

        holder_id = holder_user['user_id']
        
        # Determine the title. For VCs, it's the specific type; for VPs, it's generic.
        title = "Presentation"
        if category == 'VC' and len(doc_type_list) > 1:
            title = doc_type_list[-1]

        # 3. Insert the new record with all correct columns
        query = """
            INSERT INTO Credentials 
            (issuer_id, holder_id, category, credential_hash, credential_data, title, status) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            external_issuer_id, 
            holder_id, 
            category, 
            credential_hash, 
            payload_str, 
            title, 
            'active'
        ))
        
        db.commit()

        return jsonify({"message": f"{category} successfully imported."}), 201

    except mysql.connector.Error as err:
        db.rollback()
        # This handles the UNIQUE KEY constraint on (holder_id, credential_hash)
        if err.errno == 1062:
             return jsonify({"error": "This exact document has already been imported by you."}), 409
        return jsonify({"error": f"Database error: {str(err)}"}), 500
    finally:
        cursor.close()
