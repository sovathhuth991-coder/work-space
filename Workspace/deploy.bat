@echo off
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
echo Deploying to Firebase...
firebase deploy --only hosting
echo.
echo Done!
pause
