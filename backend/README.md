# Backend - Resume Builder API

## Setup

1. Create a virtual environment with Python 3.11:
```bash
py -3.11 -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Linux/Mac: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the server:
```bash
uvicorn main:app --reload
```

Or on a specific host/port:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at http://localhost:8000

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

The `--reload` flag enables auto-reload on code changes (useful for development).
For production, remove the `--reload` flag.
