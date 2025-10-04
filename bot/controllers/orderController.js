const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const { bot } = require('../index');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Определение региона Москвы и области
const moscowRegions = [
    'москва', 'moscow', 'мск',
    'московская область', 'подмосковье', 'мо',
    'балашиха', 'химки', 'подольск', 'королёв', 'мытищи',
    'люберцы', 'красногорск', 'электросталь', 'коломна',
    'одинцово', 'домодедово', 'серпухов', 'щёлково',
    'орехово-зуево', 'раменское', 'долгопрудный', 'реутов',
    'жуковский', 'пушкино', 'ногинск', 'сергиев посад'
];

const isMoscowRegion = (city, region) => {
    const checkString = `${city} ${region}`.toLowerCase();
    return moscowRegions.some(moscowRegion => checkString.includes(moscowRegion));
};

// Создание заказа
exports.createOrder = async (req, res) => {
    try {
        const { userId, items, customer } = req.body;

        // Создание нового заказа
        const order = new Order({
            userId,
            items,
            customer,
            status: 'pending'
        });

        // Проверка минимального веса
        try {
            order.validateWeightMinimum();
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        // Расчет итоговой суммы
        order.calculateTotal();

        // Определение региона
        order.isFromMoscow = isMoscowRegion(customer.city, customer.region);

        // Сохранение заказа
        await order.save();

        // Сохранение данных пользователя для автозаполнения
        await User.findOneAndUpdate(
            { telegramId: userId },
            {
                savedData: {
                    fullName: customer.fullName,
                    phone: customer.phone,
                    email: customer.email,
                    city: customer.city,
                    region: customer.region,
                    address: customer.address,
                    preferredDelivery: customer.deliveryMethod
                }
            }
        );

        // Обработка заказа в зависимости от региона
        if (order.isFromMoscow) {
            // Отправка уведомления менеджеру
            await notifyManager(order);

            // Уведомление клиенту
            await bot.sendMessage(userId,
                `✅ Ваш заказ №${order.orderNumber} принят!\n\n` +
                'С вами свяжется менеджер для выставления счета.\n' +
                'Ожидайте звонка или сообщения.',
                {
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: '🛒 Вернуться в каталог',
                                web_app: { url: process.env.WEBAPP_URL }
                            }
                        ]]
                    }
                }
            );
        } else {
            // Генерация и отправка QR-кода
            const qrCodePath = await generatePaymentQR(order);
            const paymentMessage = formatPaymentMessage(order);

            await bot.sendPhoto(userId, qrCodePath, {
                caption: paymentMessage,
                parse_mode: 'Markdown'
            });

            // Удаление временного файла QR-кода
            setTimeout(() => {
                if (fs.existsSync(qrCodePath)) {
                    fs.unlinkSync(qrCodePath);
                }
            }, 60000);
        }

        res.json({
            success: true,
            order: {
                id: order._id,
                orderNumber: order.orderNumber,
                isFromMoscow: order.isFromMoscow
            }
        });

    } catch (error) {
        console.error('Ошибка создания заказа:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Получение заказа
exports.getOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Заказ не найден'
            });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Обновление заказа
exports.updateOrder = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status, updatedAt: new Date() },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Заказ не найден'
            });
        }

        res.json({ success: true, order });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Уведомление менеджера
async function notifyManager(order) {
    let message = `📦 *НОВЫЙ ЗАКАЗ №${order.orderNumber}*\n\n`;
    message += `👤 *Клиент:*\n`;
    message += `ФИО: ${order.customer.fullName}\n`;
    message += `Телефон: ${order.customer.phone}\n`;
    message += `Email: ${order.customer.email}\n`;
    message += `Город: ${order.customer.city}\n`;
    message += `Адрес: ${order.customer.address}\n`;
    message += `Доставка: ${order.customer.deliveryMethod}\n\n`;

    message += `📋 *Состав заказа:*\n`;
    order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        message += `• ${item.name}\n`;
        message += `  ${item.quantity} ${item.unit === 'вес' ? 'x ' + item.weight + 'г' : 'шт'} x ${item.price}₽ = ${itemTotal}₽\n`;
    });

    message += `\n📦 Стоимость товаров: ${order.subtotal}₽\n`;
    message += `🚚 Доставка: ${order.customer.deliveryPrice}₽\n`;
    message += `💰 *ИТОГО: ${order.total}₽*`;

    if (order.customer.comment) {
        message += `\n\n💬 Комментарий: ${order.customer.comment}`;
    }

    await bot.sendMessage(process.env.ADMIN_ID, message, {
        parse_mode: 'Markdown'
    });
}

exports.notifyManager = async (req, res) => {
    try {
        const { order } = req.body;
        await notifyManager(order);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Генерация QR-кода для оплаты
async function generatePaymentQR(order) {
    const paymentData = `ST00012|Name=${process.env.PAYMENT_NAME}|PersonalAcc=${process.env.PAYMENT_ACCOUNT}|BankName=МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"|BIC=${process.env.PAYMENT_BIK}|Sum=${order.total * 100}|Purpose=Оплата заказа ${order.orderNumber}|PayeeINN=${process.env.PAYMENT_INN}`;

    // Создание папки для QR-кодов
    const qrDir = path.join(__dirname, '../../data/qr');
    if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrCodePath = path.join(qrDir, `${order.orderNumber}.png`);

    await QRCode.toFile(qrCodePath, paymentData, {
        width: 400,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    });

    return qrCodePath;
}

// Форматирование сообщения об оплате
function formatPaymentMessage(order) {
    const message = `
📦 *Заказ №${order.orderNumber} подтвержден*

Добрый день! Пожалуйста, прочитайте всю информацию до конца ‼️‼️‼️👇🏻👇🏻👇🏻

Предварительная дата отправки вашего заказа через 1-7 дней!
(Рассылка трек-номеров в течение 2х дней после отправки!)

‼️*ВНИМАНИЕ❗️ВАЖНО*‼️
После оплаты заказа *ОТПРАВЬТЕ ЧЕК* на почту: ${process.env.MANAGER_EMAIL}
В письме *УКАЖИТЕ НОМЕР ЗАКАЗА*!!!

🚫*ПИСЬМО С ЧЕКОМ ДОСТАТОЧНО ОТПРАВИТЬ ОДИН РАЗ*‼️‼️
(не нужно присылать один и тот же чек несколько раз)

⚠️ *QR-код нужно отсканировать в приложении банка*

📌*В КОММЕНТАРИЯХ К ПЛАТЕЖУ НИЧЕГО ПИСАТЬ НЕ НУЖНО*‼️‼️‼️

(!ВАЖНО! НЕ ДЕЛАТЬ проверочные платежи 1,2,3, 10 рублей!)

💰 *Сумма к оплате: ${order.total}₽*

Благодарим за покупку! 🙏
`;

    return message;
}