@echo off
title Sync TrendWatcher from Cowork
color 0B
chcp 65001 > nul

set "ROOT=C:\Users\rober\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions"
set "DST=C:\trendwatcher"
set "TMPFILE=%TEMP%\trendwatcher_src.txt"

cls
echo.
echo  ============================================
echo    SYNC  ::  COWORK  -^>  C:\trendwatcher
echo  ============================================
echo.

if not exist "%DST%\" (
    color 0C
    echo   ERROR: %DST% does not exist.
    pause
    exit /b 1
)

if not exist "%ROOT%\" (
    color 0C
    echo   ERROR: Cowork sessions folder not found at:
    echo   %ROOT%
    pause
    exit /b 1
)

echo   Looking for latest trendwatcher folder in Cowork sessions...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:ROOT; $c = Get-ChildItem -Path $root -Recurse -Depth 8 -Filter 'trendwatcher' -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'index.html') } | Sort-Object { (Get-Item (Join-Path $_.FullName 'index.html')).LastWriteTime } -Descending; if ($c) { $c[0].FullName | Out-File -Encoding ASCII -NoNewline $env:TMPFILE }"

set "SRC="
if exist "%TMPFILE%" (
    set /p SRC=<"%TMPFILE%"
    del "%TMPFILE%" >nul 2>&1
)

if "%SRC%"=="" (
    color 0C
    echo   ERROR: No trendwatcher folder with index.html found in Cowork sessions.
    echo.
    pause
    exit /b 1
)

echo   Source: %SRC%
echo   Target: %DST%
echo.
echo   Copying changed files ^(skipping .git, deploy scripts^)...
echo.

robocopy "%SRC%" "%DST%" /E /XO /XD .git /XF push.bat sync.bat deploy.bat setup-shortcut.bat PUSH.md /NFL /NDL /NJH /NJS /nc /ns /np
set "RC=%errorlevel%"

if %RC% LSS 8 (
    color 0A
    echo.
    echo  ============================================
    echo    SYNC COMPLETE
    echo  ============================================
    if %RC% equ 0 (
        echo   No changes - target already up to date.
    ) else (
        echo   Files copied. Run push.bat or deploy.bat to publish.
    )
    echo.
    timeout /t 4
    exit /b 0
) else (
    color 0C
    echo.
    echo   Sync FAILED ^(robocopy errorlevel %RC%^)
    echo.
    pause
    exit /b 1
)
