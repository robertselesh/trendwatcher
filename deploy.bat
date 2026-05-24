@echo off
title Deploy TrendWatcher
color 0B
chcp 65001 > nul

set "ROOT=C:\Users\rober\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions"
set "DST=C:\trendwatcher"
set "TMPFILE=%TEMP%\trendwatcher_src.txt"

cls
echo.
echo  ============================================
echo    TRENDWATCHER  ::  ONE-CLICK DEPLOY
echo    1. SYNC from Cowork    2. COMMIT    3. PUSH    4. NETLIFY
echo  ============================================
echo.

if not exist "%DST%\" (
    color 0C
    echo   ERROR: %DST% does not exist.
    pause
    exit /b 1
)

REM ===== STAGE 1: SYNC =====
echo   [1/3] SYNC :: finding latest Cowork folder...
echo.

REM Use PowerShell with -Depth 8 (covers session-id / sub-id / local_id / outputs / trendwatcher)
REM Write result to a temp file to avoid for-loop quoting issues
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:ROOT; if (-not (Test-Path $root)) { exit 1 }; $c = Get-ChildItem -Path $root -Recurse -Depth 8 -Filter 'trendwatcher' -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'index.html') } | Sort-Object { (Get-Item (Join-Path $_.FullName 'index.html')).LastWriteTime } -Descending; if ($c) { $c[0].FullName | Out-File -Encoding ASCII -NoNewline $env:TMPFILE }"

set "SRC="
if exist "%TMPFILE%" (
    set /p SRC=<"%TMPFILE%"
    del "%TMPFILE%" >nul 2>&1
)

if "%SRC%"=="" (
    color 0E
    echo   ^(no Cowork trendwatcher folder found - skipping sync, going to push^)
    echo.
    goto :pushOnly
)

echo   SRC: %SRC%
echo   DST: %DST%
echo.

robocopy "%SRC%" "%DST%" /E /XO /XD .git /XF push.bat sync.bat deploy.bat setup-shortcut.bat PUSH.md /NFL /NDL /NJH /NJS /nc /ns /np > nul
set "RC=%errorlevel%"
if %RC% GEQ 8 (
    color 0C
    echo   SYNC failed ^(robocopy errorlevel %RC%^)
    echo.
    echo   Trying to continue with whatever is in %DST% ...
    echo.
)
echo   SYNC done.
echo.

:pushOnly
REM ===== STAGE 2 + 3: COMMIT + PUSH =====
cd /d "%DST%"

echo   [2/3] COMMIT ::
git status --short
echo.

git add .
git diff --cached --quiet
if %errorlevel% equ 0 (
    color 0E
    echo   Nothing to commit - already up to date.
    echo.
    timeout /t 4
    exit /b 0
)

for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set "DT=%%i"
set "MSG=update: %DT%"
echo   "%MSG%"

git commit -m "%MSG%"
if errorlevel 1 (
    color 0C
    echo   COMMIT failed.
    pause
    exit /b 1
)
echo.

echo   [3/3] PUSH ::
git push
if errorlevel 1 (
    color 0C
    echo.
    echo  ============================================
    echo   PUSH FAILED - check credentials/network
    echo  ============================================
    pause
    exit /b 1
)

color 0A
echo.
echo  ============================================
echo    DEPLOYED  -  Live in ~15 seconds at:
echo    https://trendwatcher.netlify.app
echo  ============================================
echo.
timeout /t 8
exit /b 0
