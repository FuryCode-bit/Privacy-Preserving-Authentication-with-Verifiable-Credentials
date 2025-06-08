# /app/auth.py
import jwt
import uuid
from functools import wraps
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g, current_app
import mysql.connector
import didkit
from ..utils.crypto import hash_password, check_password
from app.database import get_db

auth = Blueprint('auth', __name__)

# --- JWT Token Decorators ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Malformed token header.'}), 401
        
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
            return jsonify({'message': f'Token error: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    return decorated

# async version of the decorator
def async_token_required(f):
    @wraps(f)
    async def decorated(*args, **kwargs):
        # Same validation logic as the sync version
        token = None
        if 'Authorization' in request.headers:
            try: token = request.headers['Authorization'].split(" ")[1]
            except IndexError: return jsonify({'message': 'Malformed token header.'}), 401
        if not token: return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            db = get_db()
            cursor = db.cursor(dictionary=True)
            cursor.execute("SELECT user_id, email, role FROM Users WHERE user_id = %s", (data['user_id'],))
            g.current_user = cursor.fetchone()
            cursor.close()
            if not g.current_user: return jsonify({'message': 'Token is invalid (user not found)!'}), 401
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            return jsonify({'message': f'Token error: {str(e)}'}), 401
        
        return await f(*args, **kwargs)
    return decorated

# --- Auth Routes ---
@auth.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'holder')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    # Explicitly check if an admin/issuer is trying to register another admin/issuer
    if g.get('current_user') and g.current_user['role'] != 'issuer' and role == 'issuer':
        return jsonify({"error": "You do not have permission to register an issuer."}), 403

    hashed_pwd = hash_password(password)
    
    try:
        db = get_db()
        cursor = db.cursor()
    except mysql.connector.Error as err:
        print(f"DB CONNECTION ERROR in /register: {err}")
        return jsonify({"error": "Database service is currently unavailable."}), 503

    try:
        cursor.execute("INSERT INTO Users (email, password, role) VALUES (%s, %s, %s)", (email, hashed_pwd, role))
        user_id = cursor.lastrowid

        if role in ['holder', 'issuer']:
            jwk = didkit.generate_ed25519_key()
            cursor.execute("UPDATE Users SET private_key = %s WHERE user_id = %s", (jwk, user_id))
        
        db.commit()
        return jsonify({"message": f"User '{email}' registered successfully as a {role}.", "user_id": user_id}), 201
        
    except mysql.connector.Error as err:
        db.rollback()
        if err.errno == 1062:
            return jsonify({"error": "Email already exists"}), 409
        print(f"DB EXECUTION ERROR in /register: {err}")
        return jsonify({"error": "A database error occurred."}), 500
        
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()


@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        # Split the email at the '@' symbol and take the first part.
        username = email.split('@')[0]
        if not username:
            raise IndexError
    except (TypeError, IndexError):
        return jsonify({"error": "Invalid email format provided."}), 400

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
    except mysql.connector.Error as err:
        # Handle failure to get a database connection
        print(f"DB CONNECTION ERROR in /login: {err}")
        return jsonify({"error": "Database service is currently unavailable."}), 503

    try:
        cursor.execute("SELECT * FROM Users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if user and check_password(password, user['password']):
            token_payload = {
                'user_id': user['user_id'],
                'role': user['role'],
                'exp': datetime.utcnow() + timedelta(days=1)
            }
            token = jwt.encode(token_payload, current_app.config['SECRET_KEY'], algorithm="HS256")
            return jsonify({
                "message": "Login successful", 
                "token": token, 
                "user": {"user_id": user['user_id'], "email": user['email'], "role": user['role']}
            })
        else:
            # For security, use a generic "Invalid credentials" message
            return jsonify({"error": "Invalid credentials"}), 401
            
    except mysql.connector.Error as err:
        # Handle errors during query execution
        print(f"DB EXECUTION ERROR in /login: {err}")
        return jsonify({"error": "A database error occurred while trying to log in."}), 500

    finally:
        # Ensure the cursor is always closed
        if 'cursor' in locals() and cursor:
            cursor.close()

@auth.route('/me', methods=['GET'])
@token_required
def get_current_user_profile():
    return jsonify(g.current_user)