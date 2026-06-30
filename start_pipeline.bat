@echo off
title Lohitha Dharma Backend Pipeline
echo ====================================================
echo Starting Lohitha Dharma Managed Farmland Backend...
echo ====================================================
echo.

:: Start Flask server in a new window
start "Flask Backend Server" uv run --with flask --with flask-cors --with pybreaker --with celery --with sentry-sdk --with pyotp python server.py

echo.
echo Flask backend started on http://127.0.0.1:5000
echo.
echo ====================================================
echo Starting localtunnel on port 5000...
echo Subdomain: lohithadharma-projects
echo Target HTTPS URL: https://lohithadharma-projects.loca.lt
echo ====================================================
echo.
echo IMPORTANT: If this is your first time loading the tunnel page in the browser, 
echo you may need to click 'Click to Continue' or enter your local IP address 
echo to bypass the localtunnel warning screen.
echo.
echo Once the tunnel is active:
echo 1. Open your Vercel dashboard Settings (top right).
echo 2. Set 'Backend API URL' to: https://lohithadharma-projects.loca.lt
echo 3. Click 'Save & Close'
echo.
echo Press Ctrl+C in this window to stop the tunnel.
echo.

npx localtunnel --port 5000 --subdomain lohithadharma-projects
pause
