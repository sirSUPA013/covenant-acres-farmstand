@echo off
echo ====================================
echo Covenant Acres Farmstand Setup
echo ====================================
echo.

set APP_DATA=%APPDATA%\Covenant Acres Farmstand

echo Checking for app data folder...
if not exist "%APP_DATA%" (
    echo.
    echo App data folder not found.
    echo Please run the app once first to create it, then run this script again.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo Found app data folder at: %APP_DATA%
echo.

if exist "%APP_DATA%\covenant-acres.db" (
    echo A database already exists.
    echo.
    set /p CONFIRM="Do you want to replace it? (Y/N): "
    if /i not "%CONFIRM%"=="Y" (
        echo Setup cancelled.
        pause
        exit /b 0
    )
    echo.
    echo Backing up existing database...
    copy "%APP_DATA%\covenant-acres.db" "%APP_DATA%\covenant-acres-backup.db" >nul
    echo Backup created: covenant-acres-backup.db
)

echo.
echo Copying your database...
copy "covenant-acres.db" "%APP_DATA%\covenant-acres.db" >nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====================================
    echo Setup Complete!
    echo ====================================
    echo.
    echo Your database has been installed.
    echo.
    echo Your accounts are ready:
    echo   PIN 2222 - Stephanie (Owner)
    echo   PIN 3333 - Shane (Admin)
    echo   PIN 4444 - Helper Staff
    echo.
    echo Includes:
    echo   - 3 pickup locations
    echo   - 8 bread flavors with recipes
    echo   - 18 ingredients in the library
    echo   - Business settings configured
    echo.
    echo Open the app and log in with your PIN!
    echo.
) else (
    echo.
    echo ERROR: Failed to copy database.
    echo Please try running this script as Administrator.
)

echo Press any key to exit...
pause >nul
