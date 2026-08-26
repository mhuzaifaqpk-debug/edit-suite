@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo        Edit Suite Windows Builder
echo ========================================
echo.

echo [1/2] Installing dependencies...
npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Building Edit Suite installer...
npm run dist
if errorlevel 1 (
    echo.
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD COMPLETE!
echo Check the release folder for the installer.
echo ========================================
pause
