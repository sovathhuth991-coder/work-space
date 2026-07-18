@echo off
echo Updating service worker cache version...
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMddHHmmss"') do set CACHE_VERSION=%%i
powershell -NoProfile -Command "(Get-Content 'sw.js') -replace 'const CACHE_NAME = .*;', 'const CACHE_NAME = ''workspace-hub-v%CACHE_VERSION%'';' | Set-Content 'sw.js'"
echo New cache version: workspace-hub-v%CACHE_VERSION%
echo.

echo Copying files to public/...
xcopy /Y /S /I "WorkspaceCore" "public\WorkspaceCore"
xcopy /Y /S /I "WorkspaceFeatures" "public\WorkspaceFeatures"
xcopy /Y /S /I "WorkspaceShared" "public\WorkspaceShared"
xcopy /Y "index.html" "public\index.html"
xcopy /Y "sw.js" "public\sw.js"
xcopy /Y "manifest.json" "public\manifest.json"
xcopy /Y "site.webmanifest" "public\site.webmanifest"
xcopy /Y "favicon.ico" "public\favicon.ico"
xcopy /Y "favicon.svg" "public\favicon.svg"
xcopy /Y "favicon-96x96.png" "public\favicon-96x96.png"
xcopy /Y "apple-touch-icon.png" "public\apple-touch-icon.png"
xcopy /Y "web-app-manifest-192x192.png" "public\web-app-manifest-192x192.png"
xcopy /Y "web-app-manifest-512x512.png" "public\web-app-manifest-512x512.png"

echo.
echo Removing executable/forbidden files from public/ (Firebase Spark blocks .bat/.exe/etc)...
del /Q "public\*.bat" 2>nul
del /Q "public\*.exe" 2>nul
del /Q "public\*.cmd" 2>nul
del /Q "public\*.com" 2>nul
del /Q "public\*.msi" 2>nul
del /Q "public\*.ps1" 2>nul
del /Q "public\*.sh" 2>nul
del /Q "public\*.vbs" 2>nul
del /Q "public\*.jar" 2>nul
del /Q "public\*.dll" 2>nul

echo Deploying to Firebase...
firebase deploy --only hosting
echo.
echo Done!
pause
