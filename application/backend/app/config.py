import os
from dotenv import load_dotenv

"""Base configuration settings."""
class Config:

    load_dotenv()

    # All these lines are indented once, inside the class
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")
    MARIADB_HOST = os.environ.get("MARIADB_HOST")
    MARIADB_USER = os.environ.get("MARIADB_USER")
    MARIADB_PASSWORD = os.environ.get("MARIADB_PASSWORD")
    MARIADB_DATABASE = os.environ.get("MARIADB_DATABASE")
    MARIADB_PORT = os.environ.get("MARIADB_PORT")
    
    # This check is also part of the class definition logic
    if not all([SECRET_KEY, MARIADB_HOST, MARIADB_USER, MARIADB_PASSWORD, MARIADB_DATABASE]):
        raise ValueError("One or more required environment variables are not set.")