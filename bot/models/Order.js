const mongoose = require('mongoose');

// Счетчик для номеров заказов
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', CounterSchema);

const OrderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        unique: true,
        required: true
    },
    userId: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['cart', 'pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled'],
        default: 'cart'
    },
    items: [{
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        weight: Number,
        unit: String,
        total: Number
    }],
    customer: {
        fullName: String,
        phone: String,
        email: String,
        city: String,
        region: String,
        address: String,
        deliveryMethod: String,
        deliveryPrice: Number,
        comment: String
    },
    subtotal: Number,
    deliveryPrice: Number,
    total: Number,
    isFromMoscow: Boolean,
    paidAt: Date,
    shippedAt: Date,
    deliveredAt: Date
}, {
    timestamps: true
});

// Автоматическая генерация номера заказа
OrderSchema.pre('save', async function(next) {
    if (this.isNew && !this.orderNumber) {
        try {
            const counter = await Counter.findByIdAndUpdate(
                { _id: 'orderNumber' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.orderNumber = `Т${counter.seq}`;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Проверка минимального веса для весовых товаров
OrderSchema.methods.validateWeightMinimum = function() {
    const totalWeight = this.items
        .filter(item => item.unit === 'вес')
        .reduce((sum, item) => sum + (item.weight * item.quantity), 0);

    if (totalWeight > 0 && totalWeight < 1000) {
        throw new Error('Минимальный объём заказа по весовым товарам от 1 кг');
    }
    return true;
};

// Расчет итоговой суммы
OrderSchema.methods.calculateTotal = function() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
    this.total = this.subtotal + (this.customer?.deliveryPrice || 0);
    return this.total;
};

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;