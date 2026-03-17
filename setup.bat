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

echo [1/5] Подтягиваю последние обновления с GitHub...
git pull origin claude/review-fork-hh-integration-6Gsjh
if %errorlevel% neq 0 (
    echo [ОШИБКА] git pull не удался
    pause
    exit /b 1
)

echo [2/5] Устанавливаю зависимости...
call npm install
if %errorlevel% neq 0 (
    echo [ОШИБКА] npm install не удался!
    pause
    exit /b 1
)

:: Создаём .env если его нет
if not exist .env (
    echo [3/5] Создаю файл .env...
    (
        echo DATABASE_URL="file:./dev.db"
        echo TZ=America/Edmonton
        echo NEXTAUTH_URL=http://localhost:3737
        echo AUTH_SECRET=jobsync-secret-key-change-me-1234567890
        echo OPENAI_API_KEY=your-openai-api-key-here
        echo DEEPSEEK_API_KEY=your-deepseek-api-key-here
        echo OLLAMA_BASE_URL=http://host.docker.internal:11434
        echo RAPIDAPI_KEY=your-rapidapi-key-here
    ) > .env
    echo     Файл .env создан. При необходимости отредактируйте его.
) else (
    echo [3/5] Файл .env уже существует, пропускаю.
)

echo [4/5] Создаю базу данных...
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
