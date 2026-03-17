@echo off
chcp 65001 >nul
echo ============================================
echo   JobSync - Запуск
echo ============================================
echo.

:: Проверяем, что зависимости установлены
if not exist node_modules (
    echo Зависимости не установлены. Сначала запустите setup.bat
    pause
    exit /b 1
)

:: Проверяем, что .env существует
if not exist .env (
    echo Файл .env не найден. Сначала запустите setup.bat
    pause
    exit /b 1
)

echo Запускаю приложение...
echo Откройте в браузере: http://localhost:3000
echo Для остановки нажмите Ctrl+C
echo.
call npm run dev
