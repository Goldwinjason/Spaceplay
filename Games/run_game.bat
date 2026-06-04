@echo off
echo Starting Solar Explorer Local Server...

:: Check if port 8000 is in use
netstat -ano | findstr :8000 > nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 appears to be in use. 
    echo If the server fails to start, you may need to close other instances of the game.
)

echo Opening game in your default browser...
start http://localhost:8000

:: Try py first, then python
py -m http.server 8000 || python -m http.server 8000

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start server. Please ensure Python is installed and in your PATH.
    pause
)
