@echo off
set PATH=%~dp0.tools\node-v20.18.0-win-x64;%PATH%
echo Собираем проект...
call npm run build
echo Запускаем production сервер...
call npm run start
pause
