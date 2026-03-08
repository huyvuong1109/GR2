@echo off
echo ======================================
echo   Financial Analysis Platform
echo   Starting Backend + Frontend
echo ======================================
echo.

echo [1/2] Starting Backend API...
start "Backend API" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend...
start "Frontend React" cmd /k "cd /d %~dp0frontend-react && npm run dev"

echo.
echo ======================================
echo   Servers are starting...
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo ======================================
echo.
echo Press any key to stop all servers...
pause >nul

taskkill /FI "WindowTitle eq Backend API*" /T /F
taskkill /FI "WindowTitle eq Frontend React*" /T /F
