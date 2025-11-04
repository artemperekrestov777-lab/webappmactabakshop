const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
require('dotenv').config();

const execPromise = util.promisify(exec);

// Инициализация
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();

// Защита от множественного запуска
const lockFile = path.join(__dirname, 'bot.lock');
if (fs.existsSync(lockFile)) {
    console.log('Бот уже запущен в другом процессе');
    process.exit(0);
}
fs.writeFileSync(lockFile, process.pid.toString());

process.on('exit', () => {
    if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
    }
});

process.on('SIGINT', () => {
    if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
    }
    process.exit(0);
});

// Middleware для Express
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Статические файлы для WebApp
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'webapp/images');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Можно загружать только изображения!'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB максимум
    }
});

// Пути к файлам
const productsPath = path.join(__dirname, 'webapp/products.json');

// Загрузка товаров из JSON файла
function loadProducts() {
    try {
        const data = fs.readFileSync(productsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Ошибка загрузки products.json:', error);
        return [];
    }
}

// Сохранение товаров в JSON файл
async function saveProducts(products) {
    try {
        fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
        console.log('Товары сохранены в products.json');
        await syncWithGitHub();
        return true;
    } catch (error) {
        console.error('Ошибка сохранения products.json:', error);
        return false;
    }
}

// Синхронизация с GitHub
async function syncWithGitHub() {
    try {
        const repoPath = __dirname;

        try {
            await execPromise('git add webapp/products.json webapp/images/', { cwd: repoPath });
            console.log('Файлы добавлены в staging area');
        } catch (error) {
            console.log('Ошибка добавления файлов:', error.message);
        }

        try {
            const { stdout } = await execPromise('git status --porcelain', { cwd: repoPath });
            if (stdout.trim() === '') {
                console.log('Нет изменений для commit');
                return true;
            }
        } catch (error) {
            console.log('Ошибка проверки статуса:', error.message);
        }

        try {
            await execPromise(`git commit -m "Обновление каталога товаров ${new Date().toLocaleString()}"`, { cwd: repoPath });
            console.log('Commit выполнен успешно');
        } catch (error) {
            console.log('Ошибка commit (возможно нет изменений):', error.message);
        }

        try {
            await execPromise('git push origin main', { cwd: repoPath });
            console.log('Push выполнен успешно');
        } catch (error) {
            console.log('Ошибка push:', error.message);
        }

        console.log('Синхронизация с GitHub завершена');
        return true;
    } catch (error) {
        console.error('Ошибка синхронизации с GitHub:', error);
        return false;
    }
}

// API для получения товаров
app.get('/api/admin/products', (req, res) => {
    try {
        const products = loadProducts();
        res.json({
            success: true,
            products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для добавления товара
app.post('/api/admin/product', upload.single('photo'), async (req, res) => {
    try {
        const productData = JSON.parse(req.body.productData || '{}');
        const products = loadProducts();

        let imageUrl = productData.imageUrl || '';
        if (req.file) {
            imageUrl = '/images/' + req.file.filename;
        }

        const newProduct = {
            _id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            ...productData,
            imageUrl: imageUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        products.push(newProduct);

        const success = await saveProducts(products);

        if (success) {
            res.json({
                success: true,
                product: newProduct
            });
        } else {
            throw new Error('Ошибка сохранения товара');
        }
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для обновления товара
app.put('/api/admin/product/:id', upload.single('photo'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body.productData ? JSON.parse(req.body.productData) : req.body;
        const products = loadProducts();

        const productIndex = products.findIndex(p => (p.id || p._id) === id);

        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        if (req.file) {
            updateData.imageUrl = '/images/' + req.file.filename;
        }

        products[productIndex] = {
            ...products[productIndex],
            ...updateData,
            updatedAt: new Date()
        };

        const success = await saveProducts(products);

        if (success) {
            res.json({
                success: true,
                product: products[productIndex]
            });
        } else {
            throw new Error('Ошибка обновления товара');
        }
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для удаления товара
app.delete('/api/admin/product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const products = loadProducts();

        const productIndex = products.findIndex(p => (p.id || p._id) === id);

        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        products.splice(productIndex, 1);

        const success = await saveProducts(products);

        if (success) {
            res.json({
                success: true,
                message: 'Товар успешно удален'
            });
        } else {
            throw new Error('Ошибка удаления товара');
        }
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для синхронизации с GitHub
app.post('/api/admin/sync', async (req, res) => {
    try {
        const success = await syncWithGitHub();
        res.json({ success });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Функция генерации токена для админа
function generateAdminToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { userId, role: 'admin', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
        process.env.JWT_SECRET
    );
}

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const welcomeMessage = `
🛍️ *ДОБРО ПОЖАЛОВАТЬ!*

*МАКТАБАК*
*Лучший Табачный Магазин*

Рады приветствовать вас в нашем магазине!
У нас вы найдете широкий ассортимент табачной продукции высшего качества.

Нажмите кнопку "Каталог" чтобы начать покупки.
`;

        const keyboard = {
            inline_keyboard: [[
                {
                    text: '🛒 Каталог',
                    web_app: { url: 'https://artemperekrestov777-lab.github.io/webappmactabakshop/webapp/index.html?v=' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) }
                }
            ]]
        };

        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

    } catch (error) {
        console.error('Ошибка при обработке /start:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте позже.');
    }
});

// Обработчик команды /admin
bot.onText(/\/admin(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const fullCommand = match[1].trim();

    console.log(`Admin command received from user ${userId}, full command: "${fullCommand}"`);

    // Проверка прав администратора
    if (userId !== parseInt(process.env.ADMIN_ID)) {
        await bot.sendMessage(chatId, 'У вас нет прав администратора.');
        return;
    }

    // Проверка пароля
    if (!fullCommand) {
        await bot.sendMessage(chatId, 'Введите пароль: /admin <пароль>');
        return;
    }

    if (fullCommand !== process.env.ADMIN_PASSWORD) {
        await bot.sendMessage(chatId, 'Неверный пароль.');
        return;
    }

    // Отправка ссылки на админ-панель
    const adminUrl = `https://artemperekrestov777-lab.github.io/webappmactabakshop/admin-telegram-webapp.html?token=${generateAdminToken(userId)}`;

    await bot.sendMessage(chatId,
        '🔐 *Админ-панель*\n\n' +
        'Нажмите кнопку ниже для доступа к панели управления товарами.',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '⚙️ Открыть админ-панель',
                        web_app: { url: adminUrl }
                    }
                ]]
            }
        }
    );
});

// Обработка остальных сообщений
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Игнорируем команды, которые уже обработаны
    if (text && text.startsWith('/')) {
        console.log(`Command detected: ${text}, skipping general handler`);
        return;
    }

    // Для всех остальных сообщений показываем каталог
    const keyboard = {
        inline_keyboard: [[
            {
                text: '🛒 Каталог',
                web_app: { url: 'https://artemperekrestov777-lab.github.io/webappmactabakshop/webapp/index.html?v=' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) }
            }
        ]]
    };

    await bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: keyboard
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Интегрированный сервер запущен на порту ${PORT}`);
    console.log('API endpoints:');
    console.log('- GET /api/admin/products');
    console.log('- POST /api/admin/product (с поддержкой файлов)');
    console.log('- PUT /api/admin/product/:id (с поддержкой файлов)');
    console.log('- DELETE /api/admin/product/:id');
    console.log('- POST /api/admin/sync');
    console.log('- Static files: /webapp/images/*');
});

console.log('Интегрированный бот и API сервер успешно запущен!');