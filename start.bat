@echo off
cd /d "%~dp0"
echo Starting Dot Grid dev server...
echo Open http://localhost:5173 in your browser
echo.
echo Press Ctrl+C to stop the server.
echo.
npm run dev
pause
