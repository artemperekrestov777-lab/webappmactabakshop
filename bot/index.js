const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Импорт модулей
const connectDB = require('../config/database');
const orderController = require('./controllers/orderController');
const adminController = require('./controllers/adminController');
const Order = require('./models/Order');
const User = require('./models/User');
const Product = require('./models/Product');

// Передача экземпляра бота в контроллеры после создания
setTimeout(() => {
    orderController.setBot(bot);
    adminController.setBot(bot);
}, 100);

// Инициализация
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const app = express();

// Защита от множественного запуска
const lockFile = path.join(__dirname, '../bot.lock');
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

// Подключение к базе данных
connectDB();

// Middleware для Express
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Статические файлы для WebApp
app.use('/webapp', express.static(path.join(__dirname, '../webapp')));

// Логирование
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
    fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
}
app.use(morgan('combined', {
    stream: fs.createWriteStream(path.join(__dirname, '../logs/access.log'), { flags: 'a' })
}));

// Rate limiting
const rateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 1,
});

const antiFloodLimiter = new RateLimiterMemory({
    points: 30,
    duration: 60,
});

// Защита от флуда
const userMessageCounts = new Map();

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await rateLimiter.consume(userId);
        await antiFloodLimiter.consume(userId);
    } catch (rejRes) {
        console.log(`Превышен лимит сообщений для пользователя ${userId}`);
        return;
    }

    // Обработка сообщений
    handleMessage(msg);
});

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        // Сохранение или обновление пользователя
        let user = await User.findOne({ telegramId: userId });
        if (!user) {
            user = new User({
                telegramId: userId,
                username: msg.from.username,
                firstName: msg.from.first_name,
                lastName: msg.from.last_name,
                lastActivity: new Date()
            });
            await user.save();
        } else {
            user.lastActivity = new Date();
            await user.save();
        }

        // Приветственное сообщение с логотипом
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
                    web_app: { url: 'https://artemperekrestov777-lab.github.io/webappmactabakshop/' }
                }
            ]]
        };

        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        // Проверка незавершенной корзины
        const activeOrder = await Order.findOne({
            userId: userId,
            status: 'cart',
            updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (activeOrder && activeOrder.items.length > 0) {
            setTimeout(async () => {
                await bot.sendMessage(chatId,
                    '⏰ У вас есть товары в корзине!\n' +
                    'Доступность товаров ограничена по времени.\n' +
                    'Завершите оформление заказа, чтобы не потерять выбранные товары.',
                    {
                        reply_markup: {
                            inline_keyboard: [[
                                {
                                    text: '🛒 Вернуться в корзину',
                                    web_app: { url: `${process.env.WEBAPP_URL}#cart` }
                                }
                            ]]
                        }
                    }
                );
            }, 3000);
        }

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
    const baseUrl = process.env.NODE_ENV === 'production'
        ? process.env.WEBAPP_URL
        : `http://localhost:${process.env.PORT || 3000}`;
    const adminUrl = `${baseUrl}/admin.html?token=${generateAdminToken(userId)}`;

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

// Отладочный обработчик всех сообщений (только для разработки)
if (process.env.NODE_ENV !== 'production') {
    bot.on('message', (msg) => {
        console.log(`Message received: "${msg.text}" from user ${msg.from.id}`);
    });
}

// Функция генерации токена для админа
function generateAdminToken(userId) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { userId, role: 'admin', exp: Math.floor(Date.now() / 1000) + (60 * 60) },
        process.env.JWT_SECRET
    );
}

// Обработка остальных сообщений
async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Игнорируем команды, которые уже обработаны
    if (text && text.startsWith('/')) {
        return;
    }

    // Для всех остальных сообщений показываем каталог
    const keyboard = {
        inline_keyboard: [[
            {
                text: '🛒 Каталог',
                web_app: { url: process.env.WEBAPP_URL }
            }
        ]]
    };

    await bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: keyboard
    });
}

// API endpoints
app.post('/api/order', orderController.createOrder);
app.get('/api/order/:orderId', orderController.getOrder);
app.post('/api/order/update', orderController.updateOrder);
app.post('/api/notify-manager', orderController.notifyManager);

// Admin API
app.post('/api/admin/product', adminController.addProduct);
app.put('/api/admin/product/:id', adminController.updateProduct);
app.delete('/api/admin/product/:id', adminController.deleteProduct);
app.get('/api/admin/products', adminController.getProducts);
app.post('/api/admin/sync', adminController.syncWithGitHub);

// Webhook для обработки данных от WebApp
app.post('/webhook', async (req, res) => {
    try {
        const { action, data } = req.body;

        switch (action) {
            case 'order_created':
                await handleOrderCreated(data);
                break;
            case 'payment_confirmed':
                await handlePaymentConfirmed(data);
                break;
            default:
                console.log('Unknown action:', action);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обработка создания заказа
async function handleOrderCreated(orderData) {
    const { userId, order, isFromMoscow } = orderData;

    if (isFromMoscow) {
        // Отправка уведомления менеджеру
        const managerMessage = formatManagerMessage(order);
        await bot.sendMessage(process.env.ADMIN_ID, managerMessage, {
            parse_mode: 'Markdown'
        });

        // Уведомление клиенту
        await bot.sendMessage(userId,
            '✅ Ваш заказ принят!\n\n' +
            'С вами свяжется менеджер для выставления счета.\n' +
            'Ожидайте звонка или сообщения.'
        );
    } else {
        // Генерация QR-кода и отправка клиенту
        const qrCodeUrl = await generatePaymentQR(order);
        const paymentMessage = formatPaymentMessage(order, qrCodeUrl);

        await bot.sendPhoto(userId, qrCodeUrl, {
            caption: paymentMessage,
            parse_mode: 'Markdown'
        });
    }
}

// Форматирование сообщения для менеджера
function formatManagerMessage(order) {
    let message = `📦 *НОВЫЙ ЗАКАЗ №${order.orderNumber}*\n\n`;
    message += `👤 *Клиент:*\n`;
    message += `ФИО: ${order.customer.fullName}\n`;
    message += `Телефон: ${order.customer.phone}\n`;
    message += `Email: ${order.customer.email}\n`;
    message += `Адрес: ${order.customer.city}, ${order.customer.address}\n`;
    message += `Доставка: ${order.customer.deliveryMethod}\n\n`;

    message += `📋 *Состав заказа:*\n`;
    order.items.forEach(item => {
        message += `• ${item.name} - ${item.quantity} шт. x ${item.price}₽ = ${item.total}₽\n`;
    });

    message += `\n💰 *Итого: ${order.total}₽*`;

    if (order.customer.comment) {
        message += `\n\n💬 Комментарий: ${order.customer.comment}`;
    }

    return message;
}

// Форматирование сообщения об оплате
function formatPaymentMessage(order, qrCodeUrl) {
    const message = `
📦 *Заказ №${order.orderNumber} подтвержден*

Добрый день! Пожалуйста, прочитайте всю информацию до конца ‼️‼️‼️👇🏻👇🏻👇🏻

Предварительная дата отправки вашего заказа через 1-7 дней!
(Рассылка трек номеров в течении 2х дней после отправки!)

‼️*ВНИМАНИЕ❗️ВАЖНО*‼️
После оплаты заказа *ОТПРАВЬТЕ ЧЕК* на почту: ${process.env.MANAGER_EMAIL}
В письме *УКАЖИТЕ НОМЕР ЗАКАЗА*!!!

🚫*ПИСЬМО С ЧЕКОМ ДОСТАТОЧНО ОТПРАВИТЬ ОДИН РАЗ*‼️‼️
(не нужно присылать один и тот же чек несколько раз, тем самым вы вносите путаницу и ваш заказ вовремя не уедет!!!)

*QR-код нужно отсканировать в приложении банка*

📌*В КОММЕНТАРИЯХ К ПЛАТЕЖУ НИЧЕГО ПИСАТЬ НЕ НУЖНО*‼️‼️‼️

(!ВАЖНО! Убедительная просьба НЕ ДЕЛАТЬ проверочные платежи 1,2,3, 10 рублей!!! Нас за это штрафуют!!!! Вводите в поле полную сумму к оплате!!)

💰 *Сумма к оплате: ${order.total}₽*
`;

    return message;
}

// Генерация QR-кода для оплаты
async function generatePaymentQR(order) {
    const QRCode = require('qrcode');
    const paymentData = {
        Name: process.env.PAYMENT_NAME,
        PersonalAcc: process.env.PAYMENT_ACCOUNT,
        BankName: 'МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"',
        BIC: process.env.PAYMENT_BIK,
        Sum: order.total * 100, // в копейках
        Purpose: `Оплата заказа ${order.orderNumber}`,
        PayeeINN: process.env.PAYMENT_INN
    };

    const paymentString = `ST00012|${paymentData.Name}|${paymentData.PersonalAcc}|${paymentData.BankName}|${paymentData.BIC}|${paymentData.Purpose}|${paymentData.Sum}|${paymentData.PayeeINN}`;

    const qrCodePath = path.join(__dirname, '../data/qr', `${order.orderNumber}.png`);
    await QRCode.toFile(qrCodePath, paymentString, {
        width: 400,
        margin: 2
    });

    return qrCodePath;
}

// Обработка подтверждения оплаты
async function handlePaymentConfirmed(data) {
    const { orderId, userId } = data;

    const order = await Order.findById(orderId);
    if (order) {
        order.status = 'paid';
        order.paidAt = new Date();
        await order.save();

        await bot.sendMessage(userId,
            '✅ Оплата подтверждена!\n\n' +
            'Ваш заказ передан в обработку.\n' +
            'Ожидайте уведомления об отправке.'
        );

        // Уведомление менеджеру
        await bot.sendMessage(process.env.ADMIN_ID,
            `💰 Заказ №${order.orderNumber} оплачен!`
        );
    }
}

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// Экспорт бота для использования в других модулях
module.exports = bot;

console.log('Бот успешно запущен!');