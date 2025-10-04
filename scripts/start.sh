#!/bin/bash

echo "🚀 Запуск МакТабак магазина..."

# Проверка зависимостей
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js и попробуйте снова."
    exit 1
fi

if ! command -v mongod &> /dev/null; then
    echo "⚠️ MongoDB не установлен. Установите MongoDB для полной функциональности."
fi

# Переход в директорию проекта
cd "$(dirname "$0")/.."

# Установка зависимостей если нужно
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
fi

# Создание необходимых директорий
mkdir -p logs data/qr webapp/images

# Проверка и остановка предыдущего процесса
if [ -f "bot.lock" ]; then
    OLD_PID=$(cat bot.lock)
    if ps -p $OLD_PID > /dev/null; then
        echo "⏹️ Остановка предыдущего процесса (PID: $OLD_PID)..."
        kill $OLD_PID
        sleep 2
    fi
    rm -f bot.lock
fi

# Запуск MongoDB (если установлен)
if command -v mongod &> /dev/null; then
    echo "🗄️ Проверка MongoDB..."
    if ! pgrep -x "mongod" > /dev/null; then
        echo "Запуск MongoDB..."
        mongod --dbpath ./data --logpath ./logs/mongodb.log --fork
    fi
fi

# Запуск бота
echo "🤖 Запуск Telegram бота..."
npm start

echo "✅ Магазин успешно запущен!"