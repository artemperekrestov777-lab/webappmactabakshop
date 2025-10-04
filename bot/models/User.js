const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    telegramId: {
        type: Number,
        required: true,
        unique: true
    },
    username: String,
    firstName: String,
    lastName: String,
    phone: String,
    email: String,
    savedData: {
        fullName: String,
        phone: String,
        email: String,
        city: String,
        region: String,
        address: String,
        preferredDelivery: String
    },
    cart: [{
        productId: String,
        quantity: Number,
        addedAt: Date
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }],
    isAdmin: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    lastActivity: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Индексы для оптимизации
UserSchema.index({ telegramId: 1 });
UserSchema.index({ createdAt: -1 });

const User = mongoose.model('User', UserSchema);
module.exports = User;