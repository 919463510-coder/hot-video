@echo off
rem ===== 一键更新推送脚本 =====
rem 作用：把本文件夹里的最新改动提交并推送到 GitHub，网站会自动重新部署
cd /d "%~dp0"

echo [1/3] Staging changes...
git add .

setlocal
set HASCHANGES=
for /f "delims=" %%i in ('git status --porcelain') do set HASCHANGES=1
if defined HASCHANGES (
  echo [2/3] Committing...
  git commit -m "update: %date% %time%"
) else (
  echo [2/3] No changes to commit, skipping.
)

echo [3/3] Pushing to GitHub...
git push
if errorlevel 1 (
  echo.
  echo [FAILED] Push failed. Please check your GitHub login / token.
) else (
  echo.
  echo [OK] Pushed! Site will auto-redeploy in 1-2 minutes.
)
pause