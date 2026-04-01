@echo off
setlocal enabledelayedexpansion
title Covenant Acres Farmstand - Update Tool
color 1F

echo.
echo  ============================================================
echo.
echo     COVENANT ACRES FARMSTAND - UPDATE TOOL v1.1.0
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
echo    2. Type: %%APPDATA%%
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

:: Step 2: Close the app
echo  STEP 2: CLOSE THE APP
echo  ------------------------------------------------------------
echo.
echo  Please close Covenant Acres Farmstand if it's running.
echo.
echo  (Look for it in your taskbar and close it, or press
echo   Ctrl + Shift + Esc, find it, and click "End task")
echo.
echo  ------------------------------------------------------------
echo.
pause
echo.
echo.

:: Step 3: Get the installation path
echo  STEP 3: FIND YOUR APP FOLDER
echo  ------------------------------------------------------------
echo.
echo  We need to know where your app is installed.
echo.
echo  HOW TO FIND IT:
echo.
echo    1. Right-click the shortcut you use to open the app
echo    2. Click "Open file location"
echo    3. Click in the address bar at the top
echo    4. Press Ctrl+C to copy the path
echo.
echo  Common locations:
echo    - C:\Users\YourName\covenant-acres-farmstand\desktop-app\dist-electron\win-unpacked
echo    - C:\covenant-acres\win-unpacked
echo.
echo  ------------------------------------------------------------
echo.
echo  Paste the path to your app folder:
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
    echo.
    pause
    exit /b 1
)

:: Check if it has the exe
if not exist "!INSTALL_PATH!\Covenant Acres Farmstand.exe" (
    echo.
    echo  [ERROR] This doesn't look like the right folder.
    echo.
    echo  The folder should contain "Covenant Acres Farmstand.exe"
    echo.
    pause
    exit /b 1
)

echo.
echo  [OK] Found your app at: !INSTALL_PATH!
echo.
echo.

:: Step 4: Download and extract
echo  STEP 4: DOWNLOADING UPDATE
echo  ------------------------------------------------------------
echo.
echo  Downloading... this may take a few minutes.
echo.
echo  ------------------------------------------------------------
echo.

set TEMP_DIR=%TEMP%\covenant-acres-update
set ZIP_FILE=%TEMP%\covenant-acres-update.zip

:: Clean up any previous attempts
if exist "!TEMP_DIR!" rmdir /s /q "!TEMP_DIR!"
if exist "!ZIP_FILE!" del "!ZIP_FILE!"

:: Download the pre-built update
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/sjForge/covenant-acres-farmstand/releases/download/v1.1.0-update-tool-v3/Covenant-Acres-v1.1.0-Update.zip' -OutFile '!ZIP_FILE!'}"
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to download update.
    echo  Please make sure you have internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo  [OK] Download complete!
echo.
echo  Extracting files...
echo.

:: Extract
powershell -Command "& {Expand-Archive -Path '!ZIP_FILE!' -DestinationPath '!TEMP_DIR!' -Force}"
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to extract update.
    echo.
    pause
    exit /b 1
)

echo  [OK] Extraction complete!
echo.

:: Step 5: Copy files
echo  STEP 5: INSTALLING UPDATE
echo  ------------------------------------------------------------
echo.
echo  Copying updated files...
echo.

:: Copy all files from the extracted folder
xcopy "!TEMP_DIR!\temp-update-folder\*" "!INSTALL_PATH!\" /E /Y /Q
if errorlevel 1 (
    echo.
    echo  [ERROR] Failed to copy update files.
    echo  Make sure the app is closed and try again.
    echo.
    pause
    exit /b 1
)

:: Clean up
del "!ZIP_FILE!" 2>nul
rmdir /s /q "!TEMP_DIR!" 2>nul

echo.
echo  [OK] Update installed successfully!
echo.
echo.

:: Done!
echo  ============================================================
echo.
echo     UPDATE COMPLETE!
echo.
echo     Your app is now updated to version 1.1.0
echo.
echo     You can start the app using your usual shortcut.
echo.
echo  ============================================================
echo.
echo.
echo  Press any key to close this window...
pause >nul
