@echo off
setlocal enabledelayedexpansion
title Covenant Acres Farmstand - Update Tool
color 1F

echo.
echo  ============================================================
echo.
echo     COVENANT ACRES FARMSTAND - UPDATE TOOL
echo.
echo     This will update your app to version 1.1.0
echo.
echo  ============================================================
echo.
echo.

:: Step 1: Backup reminder
echo  STEP 1: BACKUP (Important!)
echo  ------------------------------------------------------------
echo.
echo  Before we continue, please backup your database:
echo.
echo    1. Press Win + R on your keyboard
echo    2. Type: %APPDATA%
echo    3. Press Enter
echo    4. Find the folder named "covenant acres"
echo    5. Right-click it and select "Copy"
echo    6. Go to your Desktop, right-click, and select "Paste"
echo.
echo  This creates a safety copy of all your data.
echo.
echo  ------------------------------------------------------------
echo.
pause
echo.
echo.

:: Step 2: Get the installation path
echo  STEP 2: FIND YOUR APP FOLDER
echo  ------------------------------------------------------------
echo.
echo  We need to know where you installed the app.
echo.
echo  HOW TO FIND IT:
echo.
echo    1. Open File Explorer (the folder icon on your taskbar)
echo.
echo    2. Look for a folder called "covenant-acres-farmstand"
echo       Common locations:
echo         - C:\Users\YourName\covenant-acres-farmstand
echo         - C:\covenant-acres-farmstand
echo         - Your Documents or Desktop folder
echo.
echo    3. Once you find it, click in the address bar at the top
echo       (where it shows the folder path)
echo.
echo    4. The full path will highlight - press Ctrl+C to copy it
echo.
echo  ------------------------------------------------------------
echo.
echo  Now paste the path below and press Enter:
echo  (Right-click to paste, or press Ctrl+V)
echo.

set /p INSTALL_PATH="  Your app folder path: "

:: Remove quotes if they added them
set INSTALL_PATH=!INSTALL_PATH:"=!

:: Check if path exists
if not exist "!INSTALL_PATH!" (
    echo.
    echo  [ERROR] That folder doesn't exist: !INSTALL_PATH!
    echo.
    echo  Please double-check the path and try again.
    echo  Make sure you copied the complete path from File Explorer.
    echo.
    pause
    exit /b 1
)

:: Check if it's the right folder (has desktop-app subfolder)
if not exist "!INSTALL_PATH!\desktop-app" (
    echo.
    echo  [ERROR] This doesn't look like the right folder.
    echo.
    echo  The folder should contain a "desktop-app" subfolder.
    echo  Please make sure you selected "covenant-acres-farmstand"
    echo  and not a folder inside it.
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Found your app at: !INSTALL_PATH!
echo.
echo.

:: Step 3: Run the update
echo  STEP 3: UPDATING YOUR APP
echo  ------------------------------------------------------------
echo.
echo  Please wait while we update. This may take a few minutes.
echo  You'll see some text scrolling - that's normal!
echo.
echo  ------------------------------------------------------------
echo.

cd /d "!INSTALL_PATH!"

echo  Downloading update...
echo.

:: Set up temp directory
set TEMP_DIR=%TEMP%\covenant-acres-update
set ZIP_FILE=%TEMP%\covenant-acres-update.zip

:: Clean up any previous failed attempts
if exist "!TEMP_DIR!" rmdir /s /q "!TEMP_DIR!"
if exist "!ZIP_FILE!" del "!ZIP_FILE!"

:: Download the latest release zip from GitHub using PowerShell
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/sjForge/covenant-acres-farmstand/archive/refs/tags/v1.1.0.zip' -OutFile '!ZIP_FILE!'}"
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to download update.
    echo  Please make sure you have internet connection and try again.
    echo  If this keeps happening, contact Sam with a screenshot.
    echo.
    pause
    exit /b 1
)

echo  Extracting files...
echo.

:: Extract the zip file using PowerShell
powershell -Command "& {Expand-Archive -Path '!ZIP_FILE!' -DestinationPath '!TEMP_DIR!' -Force}"
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to extract update files.
    echo  Please contact Sam with a screenshot of this error.
    echo.
    pause
    exit /b 1
)

:: Copy the desktop-app files to the installation
:: The extracted folder will be named covenant-acres-farmstand-1.1.0 (tag name without v)
echo  Copying updated files...
echo.

:: Copy desktop-app folder contents (preserving structure)
xcopy "!TEMP_DIR!\covenant-acres-farmstand-1.1.0\desktop-app\*" "!INSTALL_PATH!\desktop-app\" /E /Y /Q
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to copy update files.
    echo  Please contact Sam with a screenshot of this error.
    echo.
    pause
    exit /b 1
)

:: Clean up temp files
del "!ZIP_FILE!" 2>nul
rmdir /s /q "!TEMP_DIR!" 2>nul

echo.
echo  [OK] Update downloaded!

cd /d "!INSTALL_PATH!\desktop-app"
echo.

echo  Installing dependencies (this may take a minute)...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to install dependencies.
    echo  Please contact Sam with a screenshot of this error.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed!
echo.

echo  Building app (this may take 1-2 minutes)...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to build app.
    echo  Please contact Sam with a screenshot of this error.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] App built successfully!
echo.
echo.

:: Done!
echo  ============================================================
echo.
echo     UPDATE COMPLETE!
echo.
echo     Your app is now updated to version 1.1.0
echo.
echo  ============================================================
echo.
echo.
echo  Would you like to start the app now? (Y/N)
echo.

set /p START_APP="  Start app? (Y/N): "

if /i "!START_APP!"=="Y" (
    echo.
    echo  Starting Covenant Acres Farmstand...
    echo.
    start "" npm start
    echo  The app should open in a moment.
    echo.
)

echo.
echo  You can close this window now.
echo.
echo  If you have any issues, contact Sam!
echo.
pause
