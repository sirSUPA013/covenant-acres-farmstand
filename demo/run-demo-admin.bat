@echo off
echo ============================================
echo  Hillshire Sourdough - Demo Admin Portal
echo ============================================
echo.

:: Navigate to project root
cd /d "%~dp0.."

:: Ensure data directory exists
if not exist "desktop-app\data" mkdir "desktop-app\data"

:: Copy demo database
echo Copying demo database...
copy /Y "demo\demo-database.db" "desktop-app\data\covenant-acres.db" >nul

:: Run the app
echo Starting demo admin portal...
echo.
echo Demo Users:
echo   PIN 1111 - SJY (developer)
echo   PIN 2222 - Demo Owner
echo   PIN 3333 - Demo Admin
echo   PIN 4444 - Demo Staff
echo.
cd desktop-app
npm run dev
