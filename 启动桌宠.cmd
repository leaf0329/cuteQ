@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo 请先安装依赖和 Electron 运行环境，详见使用说明。
  pause
  exit /b 1
)
start "" node_modules\electron\dist\electron.exe . --panel
