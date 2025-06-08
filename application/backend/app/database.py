import os
import mysql.connector
import click
from flask import g, current_app
from flask.cli import with_appcontext

def get_db():
    """Opens a new database connection if there is none yet for the current application context."""
    if 'db' not in g:
        try:
            config = {
                'host': current_app.config["MARIADB_HOST"],
                'user': current_app.config["MARIADB_USER"],
                'password': current_app.config["MARIADB_PASSWORD"],
                'database': current_app.config["MARIADB_DATABASE"]
            }
            port = current_app.config.get("MARIADB_PORT")
            if port:
                config['port'] = int(port)
            
            g.db = mysql.connector.connect(**config)

        except mysql.connector.Error as err:
            print(f"Error connecting to MariaDB: {err}")
            raise
    return g.db

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
        
        statements = [s.strip() for s in sql_script.split(';') if s.strip()]
        
        for stmt in statements:
            try:
                click.echo(f"Executing: {stmt[:100]}...")
                cursor.execute(stmt)
            except mysql.connector.Error as err:
                if err.errno == 1050:
                     click.echo(click.style(f"Table in statement '{stmt[:50]}...' already exists. Skipped.", fg="yellow"))
                else:
                    click.echo(click.style(f"SQL Error during schema init: {err} for statement: {stmt}", fg="red"))
                    raise
        db.commit()
        click.echo(click.style("Database schema initialized successfully from schema.sql.", fg="green"))
    except Exception as e:
        db.rollback()
        click.echo(click.style(f"An error occurred during schema initialization: {e}", fg="red"))
    finally:
        cursor.close()


def close_db(e=None):
    """Closes the database connection."""
    db = g.pop('db', None)
    if db is not None and db.is_connected():
        db.close()

@click.command('init-db')
@with_appcontext
def init_db_command():
    """CLI command to initialize the database."""
    init_db_schema()

def init_app(app):
    """Register database functions with the Flask app."""
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)