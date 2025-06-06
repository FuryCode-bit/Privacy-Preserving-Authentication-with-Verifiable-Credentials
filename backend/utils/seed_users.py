import os
# import uuid # No longer needed for user_id generation
import bcrypt # For password hashing
import mysql.connector
import didkit
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Password Hashing (from your Flask app) ---
def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8') # Store as string

# --- Database Configuration (reused) ---
def get_db_config():
    """Gets database configuration from environment variables."""
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
        raise ValueError(
            "MARIADB_HOST, MARIADB_USER, MARIADB_PASSWORD, and MARIADB_DATABASE "
            "environment variables must be set."
        )
    return config

# --- Main setup function ---
def setup_default_users():
    """Creates or updates default users in the database, assuming user_id is AUTO_INCREMENT."""
    default_users_data = [
        {
            "email": "marco.bernardes@ua.pt",
            "password": "issuer123",
            "role": "issuer",
            "username": "UA_Issuer"
        },
        {
            "email": "macobenades5@protonmail.com",
            "password": "teste123",
            "role": "holder",
            "username": "FuryHolder"
        },
        {
            "email": "external@system.local",
            "password": "uma_password_super_estranha",
            "role": "issuer",
            "username": "external_Issuer"
        },
    ]

    conn = None
    cursor = None 
    
    print("Starting default user setup...")
    try:
        conn = mysql.connector.connect(**get_db_config())
        cursor = conn.cursor(dictionary=True) # Using dictionary=True for SELECTs

        for user_info in default_users_data:
            email = user_info["email"]
            plain_password = user_info["password"]
            role = user_info["role"]
            username = user_info["username"]

            print(f"\nProcessing user: {email} (Role: {role})")

            # Check if user already exists by email
            # We still need user_id to update the private_key if they exist
            cursor.execute("SELECT user_id, private_key FROM Users WHERE email = %s", (email,))
            existing_user = cursor.fetchone()

            if existing_user:
                user_id = existing_user['user_id'] # This will be the auto-incremented INT
                print(f"  User '{email}' already exists with ID '{user_id}'.")
                # If it's an issuer and doesn't have a private key, generate and add one
                if role == 'issuer' and not existing_user.get('private_key'):
                    print(f"  Issuer '{email}' (ID: {user_id}) is missing a private key. Generating one...")
                    jwk_str = didkit.generate_ed25519_key()
                    cursor.execute(
                        "UPDATE Users SET private_key = %s WHERE user_id = %s",
                        (jwk_str, user_id)
                    )
                    conn.commit()
                    print(f"    Private key generated and stored for existing issuer '{email}'.")
                elif role == 'issuer' and existing_user.get('private_key'):
                    print(f"  Issuer '{email}' (ID: {user_id}) already has a private key.")
            else:
                # User does not exist, so create them
                print(f"  User '{email}' not found. Creating new user...")
                
                hashed_pwd = hash_password(plain_password)
                private_key_value = None

                if role == 'issuer':
                    private_key_value = didkit.generate_ed25519_key()
                    print(f"    Generated private key for new issuer '{email}'.")

                # Insert the new user
                # user_id is now omitted as it's AUTO_INCREMENT
                # Assuming schema includes: username, email, password, role, private_key
                # public_key can be NULL. created_at, updated_at have defaults.
                insert_sql = """
                    INSERT INTO Users (username, email, password, role, private_key) 
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(
                    insert_sql,
                    (username, email, hashed_pwd, role, private_key_value)
                )
                conn.commit()
                
                # Optionally, get the last inserted ID
                new_user_id = cursor.lastrowid
                print(f"    User '{email}' created successfully with auto-generated ID '{new_user_id}'.")

        print("\nDefault user setup process complete.")

    except mysql.connector.Error as err:
        print(f"DATABASE ERROR: {err}")
        if conn:
            conn.rollback() # Rollback any changes if an error occurred
    except Exception as e:
        print(f"AN UNEXPECTED ERROR OCCURRED: {e}")
        if conn: # Might be good to rollback here too if connection exists
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
        print("Database connection closed.")

# --- Script execution ---
if __name__ == '__main__':
    print("IMPORTANT: Ensure your 'Users' table's 'user_id' is INT AUTO_INCREMENT PRIMARY KEY.")
    print("And ensure all foreign keys referencing 'Users.user_id' are also INT type.")
    setup_default_users()