import didkit
import json
from flask import Blueprint, request, jsonify

verifier = Blueprint('verifier', __name__)
    
@verifier.route('/verify', methods=['POST'])
async def verify_any():
    """
    Verifies either a Verifiable Credential (VC) or a Verifiable Presentation (VP).
    It inspects the 'type' field of the JSON payload to decide the verification method.
    This endpoint does not require authentication.
    """
    try:
        payload = request.get_json()
        if not payload or not isinstance(payload, dict):
            return jsonify({"error": "Invalid JSON payload provided"}), 400

        # Check the 'type' field to determine if it's a VP or VC
        doc_type = payload.get("type", [])
        payload_str = json.dumps(payload)
        result_str = None

        if "VerifiablePresentation" in doc_type:
            # It's a Verifiable Presentation
            proof_options = json.dumps({"proofPurpose": "authentication"})
            result_str = await didkit.verify_presentation(payload_str, proof_options)
        elif "VerifiableCredential" in doc_type:
            # It's a Verifiable Credential
            proof_options = json.dumps({"proofPurpose": "assertionMethod"})
            result_str = await didkit.verify_credential(payload_str, proof_options)
        else:
            return jsonify({"error": "Payload is not a valid VC or VP. 'type' field is missing or invalid."}), 400
        
        result_obj = json.loads(result_str)
        is_verified = "errors" not in result_obj or len(result_obj["errors"]) == 0

        return jsonify({"verified": is_verified, "errors": result_obj.get("errors", [])}), 200

    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format"}), 400
    except Exception as e:
        print(f"Unexpected verification error: {str(e)}")
        return jsonify({"error": "An internal error occurred during verification."}), 500