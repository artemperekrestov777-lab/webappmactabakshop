#!/bin/bash

echo "💾 Создание резервной копии..."

# Переход в директорию проекта
cd "$(dirname "$0")/.."

# Создание директории для бэкапов
mkdir -p Бэкап

# Формирование имени файла с датой
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
BACKUP_PATH="Бэкап/${BACKUP_NAME}"

# Создание временной директории для бэкапа
mkdir -p "$BACKUP_PATH"

# Копирование файлов
echo "📂 Копирование файлов..."
cp -r bot "$BACKUP_PATH/"
cp -r webapp "$BACKUP_PATH/"
cp -r config "$BACKUP_PATH/"
cp -r data "$BACKUP_PATH/"
cp package.json "$BACKUP_PATH/"
cp .env "$BACKUP_PATH/" 2>/dev/null

# Экспорт базы данных MongoDB
if command -v mongodump &> /dev/null; then
    echo "🗄️ Экспорт базы данных..."
    mongodump --db mactabak_shop --out "$BACKUP_PATH/mongodb_dump" 2>/dev/null
fi

# Архивирование
echo "📦 Создание архива..."
tar -czf "${BACKUP_PATH}.tar.gz" -C Бэкап "${BACKUP_NAME}"

# Удаление временной директории
rm -rf "$BACKUP_PATH"

echo "✅ Резервная копия создана: ${BACKUP_PATH}.tar.gz"

# Удаление старых бэкапов (оставляем последние 10)
echo "🧹 Очистка старых бэкапов..."
ls -t Бэкап/*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm

echo "✅ Бэкап завершен!"