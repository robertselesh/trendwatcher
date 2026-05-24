@echo off
title TrendWatcher Push
color 0B
chcp 65001 > nul

cd /d C:\trendwatcher 2>nul
if errorlevel 1 (
    color 0C
    echo.
    echo  ===========================================
    echo   ERROR: C:\trendwatcher mappa nem letezik.
    echo  ===========================================
    echo.
    pause
    exit /b 1
)

cls
echo.
echo  ============================================
echo    TRENDWATCHER  ::  ONE-CLICK PUSH
echo  ============================================
echo.
echo   Repo:    https://github.com/robertselesh/trendwatcher
echo   Live:    https://trendwatcher.netlify.app
echo.
echo  --------------------------------------------
echo   Detected changes:
echo  --------------------------------------------
git status --short
echo  --------------------------------------------
echo.

REM Stage everything
git add .

REM Bail out if nothing is staged
git diff --cached --quiet
if %errorlevel% equ 0 (
    color 0E
    echo.
    echo   Nothing new to push - repo is up to date.
    echo.
    timeout /t 5
    exit /b 0
)

REM Build commit message from ISO date + time
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "DT=%%i"
set "MSG=update: %DT%"

echo   Committing as: "%MSG%"
echo.

git commit -m "%MSG%"
if errorlevel 1 (
    color 0C
    echo.
    echo   Commit failed.
    echo.
    pause
    exit /b 1
)

echo.
echo   Pushing to GitHub...
echo.
git push
if errorlevel 1 (
    color 0C
    echo.
    echo  ============================================
    echo   PUSH FAILED - check credentials or network
    echo  ============================================
    echo.
    pause
    exit /b 1
)

color 0A
echo.
echo  ============================================
echo    SUCCESS  -  Live in ~15 seconds at:
echo    https://trendwatcher.netlify.app
echo  ============================================
echo.
timeout /t 8
exit /b 0
