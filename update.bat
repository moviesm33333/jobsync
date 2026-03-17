@echo off
chcp 65001 >nul
echo ============================================
echo   JobSync - Обновление
echo ============================================
echo.

echo [1/3] Подтягиваю последние обновления с GitHub...
git pull origin claude/review-fork-hh-integration-6Gsjh
if %errorlevel% neq 0 (
    echo [ОШИБКА] git pull не удался!
    pause
    exit /b 1
)

echo [2/3] Обновляю зависимости...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm install не удался!
    pause
    exit /b 1
)

:: Проверяем что в .env есть DATABASE_URL
findstr /C:"DATABASE_URL" .env >nul 2>nul
if %errorlevel% neq 0 (
    echo DATABASE_URL="file:./dev.db">> .env
    echo     Добавлена недостающая переменная DATABASE_URL в .env
)

echo [3/3] Обновляю базу данных...
call npx prisma generate
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось обновить базу данных!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Обновление завершено!
echo   Запустите run.bat для старта приложения.
echo ============================================
pause
