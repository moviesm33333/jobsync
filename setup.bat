@echo off
chcp 65001 >nul
echo ============================================
echo   JobSync - Установка
echo ============================================
echo.

:: Проверяем, что Node.js установлен
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачайте и установите с https://nodejs.org/
    echo После установки перезапустите этот скрипт.
    pause
    exit /b 1
)

echo [1/4] Устанавливаю зависимости...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm install не удался
    pause
    exit /b 1
)

:: Создаём .env если его нет
if not exist .env (
    echo [2/4] Создаю файл .env...
    if exist .env.example (
        copy .env.example .env >nul
    ) else (
        (
            echo DATABASE_URL="file:./dev.db"
            echo AUTH_SECRET="jobsync-secret-key-change-me-1234567890"
            echo NEXTAUTH_URL="http://localhost:3000"
        ) > .env
    )
    echo     Файл .env создан. При необходимости отредактируйте его.
) else (
    echo [2/4] Файл .env уже существует, пропускаю.
)

echo [3/4] Создаю базу данных...
call npx prisma generate
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось создать базу данных
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Установка завершена!
echo   Запустите run.bat для старта приложения.
echo ============================================
pause
