import os
import mysql.connector
import didkit
from dotenv import load_dotenv
import json # For pretty printing JWK if needed

# Load environment variables from .env file
load_dotenv()

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

def add_keys_to_issuers():
    conn = None
    try:
        conn = mysql.connector.connect(**get_db_config())
        cursor = conn.cursor(dictionary=True) # Use dictionary cursor

        # Fetch all issuers without a private key
        cursor.execute("SELECT user_id, email FROM Users WHERE (private_key IS NULL OR private_key = '')")
        issuers = cursor.fetchall()

        if not issuers:
            print("No issuers found needing a private key.")
            return

        for issuer in issuers:
            user_id = issuer['user_id']
            email = issuer['email']
            print(f"Generating key for issuer: {email} (ID: {user_id})...")
            
            # Generate Ed25519 JWK
            jwk_str = didkit.generate_ed25519_key()
            
            # Update the user's record with the new key
            cursor.execute("UPDATE Users SET private_key = %s WHERE user_id = %s", (jwk_str, user_id))
            conn.commit()
            print(f"  Key stored successfully for issuer {email}.")
            # print(f"  JWK: {jwk_str}") # Optionally print the JWK

        print("\nKey generation process complete.")

    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()

if __name__ == '__main__':
    # This script can be run to ensure all users with role 'issuer' have a private_key.
    # It's idempotent for key generation (only adds if missing).
    add_keys_to_issuers()