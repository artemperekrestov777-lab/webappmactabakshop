const Product = require('../models/Product');
// Получение ссылки на бота будет через глобальную переменную
let bot;

// Установка ссылки на бота
exports.setBot = (botInstance) => {
    bot = botInstance;
};
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Добавление товара
exports.addProduct = async (req, res) => {
    try {
        const productData = req.body;

        // Создание нового товара
        const product = new Product(productData);
        await product.save();

        // Синхронизация с GitHub
        await syncWithGitHub();

        res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Обновление товара
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const product = await Product.findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        // Синхронизация с GitHub
        await syncWithGitHub();

        res.json({
            success: true,
            product
        });
    } catch (error) {
        console.error('Ошибка обновления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Удаление товара
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        // Удаление изображения товара
        if (product.image) {
            const imagePath = path.join(__dirname, '../../webapp/images', product.image);
            try {
                await fs.unlink(imagePath);
            } catch (err) {
                console.log('Не удалось удалить изображение:', err);
            }
        }

        // Синхронизация с GitHub
        await syncWithGitHub();

        res.json({
            success: true,
            message: 'Товар успешно удален'
        });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Получение списка товаров
exports.getProducts = async (req, res) => {
    try {
        const { category, search, sort } = req.query;
        let query = {};

        // Фильтрация по категории
        if (category && category !== 'all') {
            query.category = category;
        }

        // Поиск
        if (search) {
            query.$text = { $search: search };
        }

        // Сортировка
        let sortOptions = {};
        switch (sort) {
            case 'price_asc':
                sortOptions.price = 1;
                break;
            case 'price_desc':
                sortOptions.price = -1;
                break;
            case 'new':
                sortOptions.createdAt = -1;
                break;
            default:
                sortOptions.createdAt = 1;
        }

        const products = await Product.find(query).sort(sortOptions);

        res.json({
            success: true,
            products
        });
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Синхронизация с GitHub
async function syncWithGitHub() {
    try {
        const repoPath = path.join(__dirname, '../../');

        // Экспорт данных из БД в JSON
        const products = await Product.find({});
        const productsJson = JSON.stringify(products, null, 2);
        const jsonPath = path.join(repoPath, 'webapp/products.json');

        await fs.writeFile(jsonPath, productsJson);

        // Git команды для синхронизации
        const commands = [
            'git add .',
            `git commit -m "Обновление каталога товаров ${new Date().toLocaleString()}"`,
            'git push origin main'
        ];

        for (const command of commands) {
            try {
                await execPromise(command, { cwd: repoPath });
            } catch (error) {
                console.log(`Ошибка выполнения команды ${command}:`, error.message);
            }
        }

        console.log('Синхронизация с GitHub выполнена');
        return true;
    } catch (error) {
        console.error('Ошибка синхронизации с GitHub:', error);
        return false;
    }
}

exports.syncWithGitHub = async (req, res) => {
    try {
        const success = await syncWithGitHub();
        res.json({ success });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Загрузка изображения товара
exports.uploadProductImage = async (req, res) => {
    try {
        const { productId, imageData } = req.body;

        // Декодирование base64 изображения
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Сохранение изображения
        const fileName = `${productId}_${Date.now()}.png`;
        const imagePath = path.join(__dirname, '../../webapp/images', fileName);

        // Создание папки если не существует
        const imagesDir = path.join(__dirname, '../../webapp/images');
        await fs.mkdir(imagesDir, { recursive: true });

        // Сохранение файла
        await fs.writeFile(imagePath, buffer);

        // Обновление товара в БД
        await Product.findByIdAndUpdate(productId, {
            image: fileName,
            imageUrl: `/images/${fileName}`
        });

        // Синхронизация с GitHub
        await syncWithGitHub();

        res.json({
            success: true,
            imageUrl: `/images/${fileName}`
        });
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};