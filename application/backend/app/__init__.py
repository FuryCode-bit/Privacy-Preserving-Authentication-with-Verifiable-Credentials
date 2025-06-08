import os
from flask import Flask
from flask_cors import CORS
from asgiref.wsgi import WsgiToAsgi

from .config import Config
from .database import init_app as init_db_app

"""Application factory function."""
def create_app():
    
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize CORS
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

    # Initialize Database
    init_db_app(app)
    
    # Import and register blueprints
    from .routes import verifier_routes, auth_routes, issuer_routes, holder_routes
    
    app.register_blueprint(auth_routes.auth, url_prefix='/api')
    app.register_blueprint(verifier_routes.verifier, url_prefix='/api/verifier')
    app.register_blueprint(issuer_routes.issuer, url_prefix='/api/issuer')
    app.register_blueprint(holder_routes.holder, url_prefix='/api/holder')
    
    @app.route('/')
    def home():
        return "Flask backend (MariaDB) is running!"

    app.asgi_app = WsgiToAsgi(app)

    return app