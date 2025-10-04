#!/bin/bash

echo "🚀 Развертывание на сервере..."

# Конфигурация сервера
SERVER_USER="root"
SERVER_HOST="85.198.83.41"
SERVER_PATH="/var/www/mactabak-shop"

# Проверка SSH доступа
echo "🔑 Проверка SSH соединения..."
ssh -o ConnectTimeout=5 $SERVER_USER@$SERVER_HOST "echo 'SSH подключение успешно'" || {
    echo "❌ Не удалось подключиться к серверу"
    exit 1
}

# Создание резервной копии
echo "💾 Создание резервной копии..."
./scripts/backup.sh

# Подготовка файлов для развертывания
echo "📦 Подготовка файлов..."
tar -czf deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='logs/*' \
    --exclude='data/qr/*' \
    --exclude='Бэкап/*' \
    --exclude='bot.lock' \
    --exclude='.git' \
    .

# Копирование на сервер
echo "📤 Загрузка на сервер..."
scp deploy.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/

# Развертывание на сервере
echo "🛠️ Развертывание..."
ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
    # Создание директории
    mkdir -p /var/www/mactabak-shop
    cd /var/www/mactabak-shop

    # Остановка старого процесса
    if [ -f "bot.lock" ]; then
        OLD_PID=$(cat bot.lock)
        kill $OLD_PID 2>/dev/null
        rm bot.lock
    fi

    # Распаковка
    tar -xzf /tmp/deploy.tar.gz
    rm /tmp/deploy.tar.gz

    # Установка зависимостей
    npm install --production

    # Создание необходимых директорий
    mkdir -p logs data/qr webapp/images

    # Настройка прав
    chmod +x scripts/*.sh

    # Установка PM2 если нет
    npm list -g pm2 || npm install -g pm2

    # Запуск через PM2
    pm2 delete mactabak-bot 2>/dev/null
    pm2 start bot/index.js --name mactabak-bot
    pm2 save
    pm2 startup

    # Настройка Nginx
    cat > /etc/nginx/sites-available/mactabak-shop << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        root /var/www/mactabak-shop/webapp;
        index index.html;
        try_files $uri $uri/ =404;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

    # Активация конфигурации
    ln -sf /etc/nginx/sites-available/mactabak-shop /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx

    echo "✅ Развертывание завершено!"
ENDSSH

# Очистка
rm deploy.tar.gz

echo "🎉 Развертывание успешно завершено!"
echo "📱 Бот доступен в Telegram"
echo "🌐 WebApp доступен по адресу: http://$SERVER_HOST"