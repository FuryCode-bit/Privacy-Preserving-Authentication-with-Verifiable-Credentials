import os
import hashlib
import bcrypt # For password hashing and checking
import mysql.connector # MariaDB connector
from flask import Flask, request, jsonify, g, current_app
from flask_cors import CORS
from dotenv import load_dotenv
import click # For Flask CLI commands
from flask.cli import with_appcontext
import uuid
from datetime import datetime, timedelta
import didkit
import json # For handling JSON, especially with didkit
from asgiref.sync import async_to_sync # Import this
from asgiref.wsgi import WsgiToAsgi # Use WsgiToAsgi for modern asgiref versions

import jwt # PyJWT library
from functools import wraps
import asyncio

# --- INITIALIZATION ---
load_dotenv()
app = Flask(__name__)

# --- Configuration ---
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY")
app.config["SESSION_TYPE"] = os.environ.get("SESSION_TYPE")

# To this (for development):
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

# --- Database Configuration ---
def get_db_config():
    config = {
        'host': os.environ.get("MARIADB_HOST"),
        'user': os.environ.get("MARIADB_USER"),
        'password': os.environ.get("MARIADB_PASSWORD"),
        'database': os.environ.get("MARIADB_DATABASE")
    }
    port = os.environ.get("MARIADB_PORT")
    if port:
        config['port'] = int(port)
    
    if not all([config['host'], config['user'], config['password'], config['database']]):
        raise ValueError("MARIADB_HOST, MARIADB_USER, MARIADB_PASSWORD, and MARIADB_DATABASE environment variables must be set.")
    return config

# --- Database Connection ---
def get_db():
    if 'db' not in g:
        try:
            g.db = mysql.connector.connect(**get_db_config())
        except mysql.connector.Error as err:
            # Log this error appropriately in a real application
            print(f"Error connecting to MariaDB: {err}")
            raise # Re-raise the exception to signal connection failure
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None and db.is_connected():
        db.close()

# --- Database Initialization (CLI Command) ---
def init_db_schema():
    """Initializes the database schema from schema.sql."""
    schema_sql_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    if not os.path.exists(schema_sql_path):
        click.echo(click.style(f"Schema file not found: {schema_sql_path}", fg="red"))
        return

    db = get_db()
    cursor = db.cursor()
    try:
        with open(schema_sql_path, 'r') as f:
            sql_script = f.read()
        
        # Split script into individual statements. Basic split, may need improvement for complex SQL.
        statements = [s.strip() for s in sql_script.split(';') if s.strip()]
        
        for stmt in statements:
            try:
                click.echo(f"Executing: {stmt[:100]}...")
                cursor.execute(stmt)
            except mysql.connector.Error as err:
                # Error 1050: Table already exists. Safe to ignore with "IF NOT EXISTS".
                if err.errno == 1050:
                     click.echo(click.style(f"Table in statement '{stmt[:50]}...' already exists. Skipped.", fg="yellow"))
                else:
                    click.echo(click.style(f"SQL Error during schema init: {err} for statement: {stmt}", fg="red"))
                    raise # Stop on other errors
        db.commit()
        click.echo(click.style("Database schema initialized successfully from schema.sql.", fg="green"))
    except Exception as e:
        db.rollback()
        click.echo(click.style(f"An error occurred during schema initialization: {e}", fg="red"))
    finally:
        cursor.close()

@app.cli.command('init-db')
@with_appcontext
def init_db_command():
    """CLI command to initialize the database."""
    init_db_schema()

# --- Stateless JWT Authentication Decorator ---
# --- DECORATOR 1: For Synchronous Routes ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # This is the standard, synchronous validation logic
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            db = get_db()
            cursor = db.cursor(dictionary=True)
            cursor.execute("SELECT user_id, email, role FROM Users WHERE user_id = %s", (data['user_id'],))
            current_user = cursor.fetchone()
            cursor.close()
            if not current_user:
                 return jsonify({'message': 'Token is invalid (user not found)!'}), 401
            g.current_user = current_user
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            return jsonify({'message': str(e)}), 401
        
        # Call the synchronous view function directly
        return f(*args, **kwargs)
            
    return decorated


# --- DECORATOR 2: For Asynchronous Routes ---
def async_token_required(f):
    @wraps(f)
    async def decorated(*args, **kwargs): # <-- The wrapper is async
        # The validation logic is the same
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            db = get_db()
            cursor = db.cursor(dictionary=True)
            cursor.execute("SELECT user_id, email, role FROM Users WHERE user_id = %s", (data['user_id'],))
            current_user = cursor.fetchone()
            cursor.close()
            if not current_user:
                 return jsonify({'message': 'Token is invalid (user not found)!'}), 401
            g.current_user = current_user
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            return jsonify({'message': str(e)}), 401
        
        # Directly await the async view function
        return await f(*args, **kwargs)

    return decorated

# --- API ROUTES ---

# --- Password Hashing (Using bcrypt) ---
def hash_password(password):
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8') # Store as string

# --- Password Verification (Using bcrypt) ---
def check_password(plain_password, hashed_password_from_db):
    """Verifies a plain password against a bcrypt hashed password from the database."""
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if isinstance(hashed_password_from_db, str):
        hashed_password_from_db = hashed_password_from_db.encode('utf-8')
    
    return bcrypt.checkpw(plain_password, hashed_password_from_db)

# --- Routes ---
@app.route('/')
def home():
    return "Flask backend (MariaDB) is running!"

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email, password, role = data.get('email'), data.get('password'), data.get('role', 'holder')
    if not email or not password: return jsonify({"error": "Email and password are required"}), 400
    hashed_pwd, user_id = hash_password(password), str(uuid.uuid4())
    db = get_db()
    cursor = db.cursor()
    try:
        # Insert the base user record
        cursor.execute("INSERT INTO Users (user_id, email, password, role) VALUES (%s, %s, %s, %s)", (user_id, email, hashed_pwd, role))

        # A holder needs a key to sign presentations.
        jwk = didkit.generate_ed25519_key()
        cursor.execute("UPDATE Users SET private_key = %s WHERE user_id = %s", (jwk, user_id))
        
        db.commit()
        return jsonify({"message": "User registered successfully", "user_id": user_id}), 201
    except mysql.connector.Error as err:
        db.rollback()
        if err.errno == 1062: return jsonify({"error": "Email already exists"}), 409
        return jsonify({"error": f"Database error: {err}"}), 500
    finally:
        cursor.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email, password = data.get('email'), data.get('password')
    if not email or not password: return jsonify({"error": "Email and password are required"}), 400
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM Users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if user and check_password(password, user['password']):
            token_payload = {'user_id': user['user_id'], 'role': user['role'], 'exp': datetime.utcnow() + timedelta(days=1)}
            token = jwt.encode(token_payload, current_app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({"message": "Login successful", "token": token, "user": {"user_id": user['user_id'], "email": user['email'], "role": user['role']}})
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    finally:
        cursor.close()

@app.route('/api/me', methods=['GET'])
@token_required # An endpoint to get the current user's profile info
def get_current_user_profile():
    return jsonify(g.current_user)


@app.route('/api/issue_vc', methods=['POST'])
@async_token_required # Protect this route
async def issue_vc(): # Main route is async for ASGI server
    issuer_user = g.current_user
    if issuer_user['role'] != 'issuer':
        return jsonify({"error": "Only users with 'issuer' role can issue credentials"}), 403
    
    data = request.get_json()
    issuer_user_id = issuer_user['user_id']

    # Variables to be populated by the helper and used later
    holder_id_val = None 
    vc_type_val = None

    # Inner synchronous helper function
    async def _perform_didkit_operations_and_prep(current_data_payload, current_issuer_jwk_str):
        nonlocal holder_id_val, vc_type_val # Allow assignment to outer scope variables

        # --- DIDKit Call 1: key_to_did ---
        issuer_did_obj = didkit.key_to_did("key", current_issuer_jwk_str)
        if not isinstance(issuer_did_obj, str):
            # This would be unexpected if the previous error was "str can't be awaited"
            print(f"didkit.key_to_did did not return a string. Got: {type(issuer_did_obj)}")
            raise TypeError(f"didkit.key_to_did expected str, got {type(issuer_did_obj)}")
        issuer_did = issuer_did_obj

        # --- DIDKit Call 2: key_to_verification_method ---
        verification_method_uri_obj = await didkit.key_to_verification_method("key", current_issuer_jwk_str)
        if not isinstance(verification_method_uri_obj, str):
            print(f"didkit.key_to_verification_method did not return a string. Got: {type(verification_method_uri_obj)}")
            raise TypeError(f"didkit.key_to_verification_method expected str, got {type(verification_method_uri_obj)}")
        verification_method_uri = verification_method_uri_obj
        
        holder_email = current_data_payload.get("holder_email")
        if not holder_email:
            print(f"Data received in _perform_didkit_operations_and_prep (for holder_email check): {current_data_payload}")
            raise ValueError("holder_email is required") 

        # Database operation to find holder needs a cursor
        # This cursor should be from the main route's db connection or a new one if necessary
        # For simplicity, assuming it's passed or accessible via a shared 'g' like object if not careful
        # Let's assume we pass the main 'cursor' if this function is called from a context where 'cursor' is valid
        # However, the original call was `_perform_didkit_operations_and_prep(cursor, data, issuer_jwk_str)`
        # So, let's assume `current_cursor` is passed in.
        # **Correction**: Original call did not pass cursor. Let's fix that.
        # This function will now need a cursor.

        # This function will now be: _perform_didkit_operations_and_prep(db_cursor, current_data_payload, current_issuer_jwk_str)
        db_cursor_for_holder = get_db().cursor(dictionary=True) # Get a fresh cursor for this operation
        try:
            db_cursor_for_holder.execute("SELECT user_id FROM Users WHERE email = %s AND role = 'holder'", (holder_email,))
            holder_record = db_cursor_for_holder.fetchone()
        finally:
            db_cursor_for_holder.close() # Ensure this cursor is closed

        if not holder_record:
            raise ValueError(f"Holder with email '{holder_email}' not found or is not a holder")
        
        holder_id_val = holder_record['user_id']
        holder_did_subject_id = f"did:example:{uuid.uuid4().hex[:24]}"

        # Inside _perform_didkit_operations_and_prep, after getting issuer_did and verification_method_uri
        print(f"--- DETAILED VALUES ---")
        print(f"issuer_did: '{issuer_did}' (type: {type(issuer_did)})")
        print(f"verification_method_uri: '{verification_method_uri}' (type: {type(verification_method_uri)})")
        print(f"current_issuer_jwk_str (first 70 chars): '{current_issuer_jwk_str[:70]}...'") # Ensure JWK looks okay
        print(f"--- END DETAILED VALUES ---")

        vc_payload = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                {
                    "name": "https://schema.org/name",
                    "university": "https://schema.org/CollegeOrUniversity",
                    "course": "https://schema.org/Course",
                    "grade": "https://schema.org/grade",
                    "completionDate": "https://schema.org/endDate"
                }
            ],
            "id": f"urn:uuid:{uuid.uuid4()}",
            "type": ["VerifiableCredential"],
            "issuer": issuer_did,
            "issuanceDate": datetime.utcnow().isoformat() + "Z",
            "credentialSubject": {
                "id": holder_did_subject_id,
                "name": data.get("name"),
                "university": data.get("university", "Universidade de Aveiro"),
                "course": data.get("course"),
                "grade": data.get("grade"),
                "completionDate": data.get("completionDate")
            }
        }
        vc_type_val = vc_payload["type"][-1]

        proof_options = {
            "proofPurpose": "assertionMethod",
            "verificationMethod": verification_method_uri, # Value being printed above
        }

        vc_payload_json_str = json.dumps(vc_payload, indent=2)
        proof_options_json_str = json.dumps(proof_options, indent=2)
        print("-" * 40 + "\nVC PAYLOAD JSON TO DIDKIT:\n" + vc_payload_json_str + "\n" + "-" * 40)
        print("PROOF OPTIONS JSON TO DIDKIT:\n" + proof_options_json_str + "\n" + "-" * 40)

        signed_credential_object = await didkit.issue_credential(json.dumps(vc_payload), json.dumps(proof_options), current_issuer_jwk_str)

        print("4")
        print(f"Type of object from didkit.issue_credential: {type(signed_credential_object)}")
        print(f"Value of object (first 200 chars): {str(signed_credential_object)[:200]}")

        # Handle if it's a Future (this is speculative, depends on didkit-python's FFI implementation)
        final_result_str = signed_credential_object
        if not isinstance(final_result_str, str):
            if hasattr(final_result_str, 'result') and callable(final_result_str.result):
                print("Object from issue_credential seems to be a Future. Calling .result()...")
                final_result_str = final_result_str.result() # This is a BLOCKING call
                print(f"Type after .result(): {type(final_result_str)}")
                print(f"Value after .result() (first 200 chars): {str(final_result_str)[:200]}")
            else:
                # If it's not a string and not a known Future type, this is an issue.
                print(f"didkit.issue_credential returned an unexpected non-string, non-Future type: {type(final_result_str)}")
                raise TypeError(f"didkit.issue_credential returned unexpected type: {type(final_result_str)}")
        
        if not isinstance(final_result_str, str):
            # This should not be reached if the above logic is correct
            print(f"CRITICAL: After all checks, result is still not a string: {type(final_result_str)}")
            raise TypeError(f"Failed to resolve DIDKit result to a string. Got: {type(final_result_str)}")
            
        return signed_credential_object

    # Main try block for the route
    db_conn_main = None # To manage connection for multiple cursor uses
    try:
        # Get DB connection for this request context
        # Using 'with app.app_context()' might be cleaner if get_db() isn't perfectly managing g
        db_conn_main = get_db() # Assuming get_db() correctly uses 'g' for connection pooling per request

        # --- Step 1: Fetch issuer's private key ---
        cursor_for_issuer = db_conn_main.cursor(dictionary=True)
        try:
            cursor_for_issuer.execute("SELECT private_key FROM Users WHERE user_id = %s", (issuer_user_id,))
            issuer_data = cursor_for_issuer.fetchone()
        finally:
            cursor_for_issuer.close()

        if not issuer_data or not issuer_data['private_key']:
            print(f"Issuer key not found for user_id: {issuer_user_id}")
            return jsonify({"error": "Issuer key not found or not set"}), 500
        issuer_jwk_str = issuer_data['private_key']
        
        # --- Step 2: Perform DIDKit operations and prepare VC ---
        # The 'data' variable is from request.get_json()
        # The helper function now handles its own cursor for the holder lookup.
        signed_vc_json_str = await _perform_didkit_operations_and_prep(data, issuer_jwk_str)
        
        # --- Step 3: Calculate hash ---
        vc_hash = hashlib.sha256(signed_vc_json_str.encode('utf-8')).hexdigest()

        # --- Step 4: Store credential in DB ---
        cursor_for_insert = db_conn_main.cursor()
        try:
            # holder_id_val and vc_type_val should be populated by _perform_didkit_operations_and_prep
            if holder_id_val is None or vc_type_val is None:
                print("holder_id_val or vc_type_val not set after DIDKit operations.")
                raise ValueError("Internal error: holder_id or vc_type not determined.")

            cursor_for_insert.execute(
                "INSERT INTO Credentials (issuer_id, holder_id, credential_hash, type, status, credential_data) VALUES (%s, %s, %s, %s, %s, %s)",
                (issuer_user_id, holder_id_val, vc_hash, vc_type_val, "active", signed_vc_json_str)
            )
            db_conn_main.commit() # Commit on the main connection
        finally:
            cursor_for_insert.close()

        print(f"VC issued successfully for holder_id: {holder_id_val} by issuer_id: {issuer_user_id}")
        return jsonify(json.loads(signed_vc_json_str)), 201

    except ValueError as ve:
        print(f"ValueError in issue_vc: {str(ve)}")
        return jsonify({"error": str(ve)}), 400
    except mysql.connector.Error as err:
        print(f"Database error in issue_vc: {err}")
        if db_conn_main and db_conn_main.is_connected(): # Check if connection exists for rollback
            db_conn_main.rollback()
        return jsonify({"error": f"Database error: {err.msg if hasattr(err, 'msg') else str(err)}"}), 500
    except TypeError as te: # Catch TypeErrors, possibly from didkit returning unexpected types
        print(f"TypeError in issue_vc (likely from DIDKit): {str(te)}")
        if db_conn_main and db_conn_main.is_connected():
            db_conn_main.rollback()
        return jsonify({"error": f"Type error processing credential: {str(te)}"}), 500
    except Exception as e:
        print(f"Unexpected generic error in issue_vc: {e}")
        if db_conn_main and db_conn_main.is_connected():
            db_conn_main.rollback()
        # This is where the "Object of type Future is not JSON serializable" would be caught
        # if the Future object itself was passed up to jsonify.
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
    # finally:
        # The main db_conn_main connection will be closed by @app.teardown_appcontext
        # Individual cursors created within the try block are closed in their respective finally blocks.
        # print("Exiting issue_vc route.")

@app.route('/api/verify_vc', methods=['POST'])
async def verify_vc():
    try:
        vc_payload = request.get_json()  # <-- get JSON payload, NOT the request object
        print("vc_payload: ", vc_payload)
        if not vc_payload:
            return jsonify({"error": "No credential provided"}), 400

        # Serialize to JSON string for DIDKit
        vc_payload_str = json.dumps(vc_payload)

        proof_options = {
            "proofPurpose": "assertionMethod"
        }

        # Call DIDKit to verify the credential
        result_str = await didkit.verify_credential(
            vc_payload_str,
            json.dumps(proof_options)
        )

        result_obj = json.loads(result_str)

        if result_obj.get("errors"):
            print("Verification errors:", result_obj["errors"])
            return jsonify({"verified": False, "errors": result_obj["errors"]}), 200

        return jsonify({"verified": True}), 200

    except json.JSONDecodeError as je:
        print(f"JSON decode error: {je}")
        return jsonify({"error": "Invalid JSON provided"}), 400
    except Exception as e:
        print(f"Unexpected error during verification: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/verify_presentation', methods=['POST'])
async def verify_presentation():
    try:
        vp_payload = request.get_json()
        print("vp_payload:", vp_payload)

        if not vp_payload:
            return jsonify({"error": "No presentation provided"}), 400

        # Serialize to JSON string for DIDKit
        vp_payload_str = json.dumps(vp_payload)

        proof_options = {
            "proofPurpose": "authentication"
        }

        # Call DIDKit to verify the presentation
        result_str = await didkit.verify_presentation(
            vp_payload_str,
            json.dumps(proof_options)
        )

        result_obj = json.loads(result_str)

        if result_obj.get("errors"):
            print("Verification errors:", result_obj["errors"])
            return jsonify({"verified": False, "errors": result_obj["errors"]}), 200

        return jsonify({"verified": True}), 200

    except json.JSONDecodeError as je:
        print(f"JSON decode error: {je}")
        return jsonify({"error": "Invalid JSON provided"}), 400
    except Exception as e:
        print(f"Unexpected error during VP verification: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/upload_vc', methods=['POST'])
@async_token_required
async def upload_vc():
    """
    Verifies an uploaded VC and, if valid, stores it in the database,
    assigning the current user as the holder.
    """
    holder_user = g.current_user
    vc_payload = request.get_json()

    if not vc_payload:
        return jsonify({"error": "No credential payload provided"}), 400

    # 1. First, verify the credential is cryptographically valid
    try:
        vc_payload_str = json.dumps(vc_payload)
        verification_result_str = await didkit.verify_credential(vc_payload_str, "{}")
        verification_result = json.loads(verification_result_str)
        
        if verification_result.get("errors"):
            print("VC Verification failed:", verification_result["errors"])
            return jsonify({"error": "VC is not valid", "details": verification_result["errors"]}), 400
    except Exception as e:
        return jsonify({"error": f"Error during VC verification: {str(e)}"}), 500

    # 2. If valid, prepare to insert it into the database
    db = get_db()
    cursor = db.cursor()
    try:
        # --- IMPORTANT ASSUMPTION ---
        # We assume a user with user_id = 1 exists and represents a generic "External Issuer".
        # You must create this user in your database manually.
        # e.g., INSERT INTO Users (user_id, email, password, role) VALUES (1, 'external@system.local', '...', 'issuer');
        external_issuer_id = 3 

        holder_id = holder_user['user_id']
        credential_data_str = json.dumps(vc_payload)
        credential_hash = hashlib.sha256(credential_data_str.encode('utf-8')).hexdigest()
        
        # Extract the most specific type for the 'type' column
        vc_type = 'VerifiableCredential'
        if isinstance(vc_payload.get('type'), list) and len(vc_payload['type']) > 1:
            vc_type = vc_payload['type'][-1]

        # 3. Insert the new credential record
        query = """
            INSERT INTO Credentials 
            (issuer_id, holder_id, credential_hash, credential_data, type, status) 
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            external_issuer_id, 
            holder_id, 
            credential_hash, 
            credential_data_str, 
            vc_type, 
            'active'
        ))
        
        new_cred_id = cursor.lastrowid
        db.commit()

        # 4. Return the newly created credential object
        new_credential = {
            'cred_id': new_cred_id,
            'issuer_id': external_issuer_id,
            'holder_id': holder_id,
            'credential_hash': credential_hash,
            'credential_data': credential_data_str,
            'type': vc_type,
            'status': 'active',
            'issued_at': datetime.utcnow().isoformat()
        }

        return jsonify(new_credential), 201

    except mysql.connector.Error as err:
        db.rollback()
        # Check for duplicate hash to prevent storing the same VC twice for the same user
        if err.errno == 1062: # Duplicate entry error
             return jsonify({"error": "This credential has already been imported."}), 409
        return jsonify({"error": f"Database error: {str(err)}"}), 500
    finally:
        cursor.close()

@app.route('/api/list_credentials', methods=['GET'])
@token_required # Protect this route with the JWT decorator
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

# --- NEW ENDPOINT FOR SELECTIVE DISCLOSURE (Manual Framing) ---
@app.route('/api/create_presentation', methods=['POST'])
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

# --- Wrap the Flask app for ASGI ---
# This 'app' is what Uvicorn will serve

# uvicorn app:app --reload --port 5001   

app = WsgiToAsgi(app)