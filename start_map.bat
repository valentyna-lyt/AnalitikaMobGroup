@echo off
REM === Запуск карти перевірок ГУНП Харківська область ===
REM Переконайся, що встановлений Python 3

:: Порт, на якому буде працювати сервер
set PORT=8080

echo Запускаю локальний сервер на http://localhost:%PORT%/
echo (Натисни Ctrl+C щоб зупинити)

:: Відкрити браузер автоматично
start "" http://localhost:%PORT%/index.html

:: Запустити вбудований HTTP-сервер Python
python -m http.server %PORT%
