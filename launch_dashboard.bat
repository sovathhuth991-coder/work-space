@echo off
cd /d "%~dp0"
echo 🚀 Starting your Workspace Hub...
start /min python -m http.server 8000
timeout /t 2 /nobreak >nul
echo 🌐 Opening http://localhost:8000
start http://localhost:8000
echo ✅ Dashboard is running! Close this window to stop the server.
pause