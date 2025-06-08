# /run.py
import uvicorn
from app import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("run:app.asgi_app", host="0.0.0.0", port=5001, reload=True)