import hashlib
import json
import didkit
from flask import Blueprint, request, jsonify, g
import mysql.connector
import uuid
from datetime import datetime, date 
from app.database import get_db
from .auth_routes import async_token_required, token_required

issuer = Blueprint('issuer', __name__)

@issuer.route('/issue_vc', methods=['POST'])
@async_token_required # Protect this route
async def issue_vc():
    """
    Issues a new Verifiable Credential to a holder, with validation and duplicate prevention.
    """
    # 1. Authorization & Initial Data Validation
    issuer_user = g.current_user
    if issuer_user['role'] != 'issuer':
        return jsonify({"error": "Only issuers can issue credentials"}), 403
    
    data = request.get_json()
    required_fields = ["holder_email", "name", "course", "grade", "completionDate"]
    if not all(field in data and data[field] for field in required_fields):
        return jsonify({"error": f"Missing required fields. Required: {', '.join(required_fields)}"}), 400

    # 2. Server-side Date Validation
    try:
        completion_date = date.fromisoformat(data["completionDate"])
        if completion_date > date.today():
            return jsonify({"error": "Completion date cannot be in the future."}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid date format for completionDate. Use YYYY-MM-DD."}), 400

    db = None
    cursor = None
    try:
        # 3. Establish Database Connection
        db = get_db()
        cursor = db.cursor(dictionary=True)

        # 4. Get Holder's Info
        cursor.execute("SELECT user_id FROM Users WHERE email = %s AND role = 'holder'", (data['holder_email'],))
        holder = cursor.fetchone()
        if not holder:
            return jsonify({"error": f"Holder with email '{data['holder_email']}' not found."}), 404
        holder_id = holder['user_id']
        
        # 5. PREVENT DUPLICATES: Create and check a unique content hash
        fingerprint_str = f"{issuer_user['user_id']}:{holder_id}:{data['course']}:{data['grade']}:{data['completionDate']}"
        credential_hash = hashlib.sha256(fingerprint_str.encode('utf-8')).hexdigest()
        
        cursor.execute("SELECT cred_id FROM Credentials WHERE holder_id = %s AND credential_hash = %s", (holder_id, credential_hash))
        if cursor.fetchone():
            return jsonify({"error": "This exact credential has already been issued to this holder."}), 409

        # 6. Get Issuer's Key (must be done before closing cursor if not making new ones)
        cursor.execute("SELECT private_key FROM Users WHERE user_id = %s", (issuer_user['user_id'],))
        issuer_data = cursor.fetchone()
        if not issuer_data or not issuer_data['private_key']:
            return jsonify({"error": "Issuer's cryptographic key not found."}), 500
        issuer_jwk_str = issuer_data['private_key']

        # --- DB operations are done, we can now use await ---
        
        # 7. Perform DIDKit Operations
        issuer_did = didkit.key_to_did("key", issuer_jwk_str)
        verification_method = await didkit.key_to_verification_method("key", issuer_jwk_str)

        # 8. Construct the VC Payload
        vc_payload = {
            "@context": ["https://www.w3.org/2018/credentials/v1", {"name": "https://schema.org/name", "university": "https://schema.org/CollegeOrUniversity", "course": "https://schema.org/Course", "grade": "https://schema.org/grade", "completionDate": "https://schema.org/endDate"}],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential", data.get("course", "AcademicCredential").replace(" ", "")],
            "issuer": issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "credentialSubject": {
                "id": f"did:example:holder:{holder_id}",
                "name": data.get("name"),
                "university": data.get("university", "Universidade de Aveiro"),
                "course": data.get("course"),
                "grade": data.get("grade"),
                "completionDate": data.get("completionDate")
            }
        }
        proof_options = {"proofPurpose": "assertionMethod", "verificationMethod": verification_method}

        # 9. Sign the Credential with DIDKit
        signed_vc_str = await didkit.issue_credential(json.dumps(vc_payload), json.dumps(proof_options), issuer_jwk_str)
        
        # 10. Store in Database using the pre-calculated hash
        vc_type = vc_payload["type"][-1]
        insert_query = "INSERT INTO Credentials (issuer_id, holder_id, credential_hash, title, status, credential_data) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(insert_query, (issuer_user['user_id'], holder_id, credential_hash, vc_type, "active", signed_vc_str))
        db.commit()

        return jsonify(json.loads(signed_vc_str)), 201

    except mysql.connector.Error as err:
        if db: db.rollback()
        if err.errno == 1062:
            return jsonify({"error": "This credential has already been issued (database constraint)."}), 409
        print(f"Database error in issue_vc: {err}")
        return jsonify({"error": "A database error occurred."}), 500
    except Exception as e:
        if db: db.rollback()
        print(f"Generic error in issue_vc: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
    finally:
        # This 'finally' block ensures the cursor is always closed.
        if cursor:
            cursor.close()


@issuer.route('/dashboard_data', methods=['GET'])
@token_required # Use the synchronous decorator, as this is a DB-only operation
def get_issuer_dashboard_data():
    """
    Provides a consolidated set of statistics and recent activity
    for the logged-in issuer's dashboard.
    """
    # 1. Authorization: Ensure the user has the 'issuer' role
    issuer_user = g.current_user
    if issuer_user['role'] != 'issuer':
        return jsonify({"error": "Access denied. Issuer role required."}), 403

    issuer_id = issuer_user['user_id']
    dashboard_data = {
        "stats": {},
        "recent_activity": []
    }

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # 2. Query for "Credentials Issued" stat
        cursor.execute("SELECT COUNT(*) as total_issued FROM Credentials WHERE issuer_id = %s", (issuer_id,))
        total_issued = cursor.fetchone()['total_issued']
        dashboard_data['stats']['credentials_issued'] = total_issued

        # 3. Query for "Active Students" stat (unique holders)
        cursor.execute("SELECT COUNT(DISTINCT holder_id) as unique_holders FROM Credentials WHERE issuer_id = %s", (issuer_id,))
        unique_holders = cursor.fetchone()['unique_holders']
        dashboard_data['stats']['active_students'] = unique_holders

        # 4. --- REPLACEMENT --- Query for "Revoked Credentials" stat
        # This is a real, valuable metric derived from your schema.
        query_revoked = """
            SELECT COUNT(r.revoc_id) as total_revoked
            FROM Revocations r
            JOIN Credentials c ON r.cred_id = c.cred_id
            WHERE c.issuer_id = %s
        """
        cursor.execute(query_revoked, (issuer_id,))
        total_revoked = cursor.fetchone()['total_revoked']
        dashboard_data['stats']['revoked_credentials'] = total_revoked

        # 5. Query for "Recent Activity"
        query_activity = """
            SELECT c.title, c.issued_at, u.email as holder_email
            FROM Credentials c
            JOIN Users u ON c.holder_id = u.user_id
            WHERE c.issuer_id = %s
            ORDER BY c.issued_at DESC
            LIMIT 5
        """
        cursor.execute(query_activity, (issuer_id,))
        recent_activity_raw = cursor.fetchall()
        
        dashboard_data['recent_activity'] = [
            f"Issued \"{act['title']}\" to {act['holder_email']}" for act in recent_activity_raw
        ]

        return jsonify(dashboard_data), 200

    except mysql.connector.Error as err:
        return jsonify({"error": f"Database error: {str(err)}"}), 500
    finally:
        cursor.close()
