# Tinh trang trien khai (Auth + Watchlist + Theme)

Tai lieu nay tong hop cac phan da hoan thanh va cac buoc con lai de dua he thong vao trang thai san xang production.

## 1) Backend FastAPI Auth (hoan thanh)

Thu muc: `backend/fastapi_auth`

Da co:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /api/user/me`
- `PUT /api/user/me` (cap nhat `theme_pref`)
- `POST /api/watchlist/add`
- `DELETE /api/watchlist/remove`
- `GET /api/watchlist`
- `GET /api/notifications`
- `POST /api/notifications/mark-read`
- `DELETE /api/notifications/{notification_id}`
- `GET /api/company/{ticker}` doc du lieu tu `Database/master_db/analytics(final).db`

Da test smoke:
- register/login/refresh/me
- watchlist add/list
- company endpoint co `description`

## 2) Frontend (dang chay tot sau build)

Da co:
- `AuthContext` + `ProtectedRoute`
- `Login`, `Register`, `Settings`
- `WatchlistContext` de dong bo watchlist toan app
- Nut star theo doi trong `Screener` va `CompanyAnalysisSimple`
- Sidebar watchlist trong `Layout` (desktop)
- Theme dark/light luu local + dong bo len backend
- Navigation duoc Viet hoa:
  - Bang dieu khien
  - Bo loc co phieu
  - So sanh
  - Bao cao tai chinh

## 3) Bien moi truong khuyen nghi

Frontend (`frontend-react/.env`):
- `VITE_AUTH_API_URL=http://localhost:8001`

Neu chay dong thoi backend cu (8000) va auth backend moi (8001), frontend se:
- Goi API du lieu phan tich den `8000/api`
- Goi API user/auth den `8001`

## 4) Chay local

### Auth backend
```powershell
Set-Location D:\X1G8\GR2\FinancialApp
.\.venv\Scripts\python.exe -m uvicorn backend.fastapi_auth.app.main:app --port 8001
```

### Frontend
```powershell
Set-Location D:\X1G8\GR2\FinancialApp\frontend-react
npm run dev
```

## 5) Viec can lam tiep (de chot production)

- Viet hoa nhet toan bo text con lai (cac label tieng Anh trong pages chua dong bo 100%).
- Them websocket hoac polling cho notifications realtime.
- Them co che revoke refresh token (logout server-side).
- Bo sung test tu dong cho auth/watchlist/notifications.
- Tach secret JWT ra bien moi truong.
