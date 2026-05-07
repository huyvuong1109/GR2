FastAPI Auth sample (Python)

Setup & run (recommended inside project venv):

1. Create virtualenv and install dependencies:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/fastapi_auth/requirements.txt
```

2. Run the app:

```powershell
cd backend/fastapi_auth
uvicorn app.main:app --reload --port 8000
```

3. Endpoints:
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- GET /api/user/me
- POST /api/watchlist/add
- DELETE /api/watchlist/remove
- GET /api/notifications
- GET /api/company/{ticker}

Notes:
- Update `app/auth.py` SECRET_KEY to a secure random value in production.
- `user.db` will be created under `backend/fastapi_auth/user.db`.
- `analytics(final).db` is read from project path `Database/master_db/analytics(final).db`.
