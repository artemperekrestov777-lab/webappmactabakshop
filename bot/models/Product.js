const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        enum: ['штука', 'вес'],
        required: true
    },
    weight: {
        type: Number,
        default: null
    },
    description: String,
    image: String,
    imageUrl: String,
    isAvailable: {
        type: Boolean,
        default: true
    },
    stock: {
        type: Number,
        default: 100
    },
    sold: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Индексы
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;