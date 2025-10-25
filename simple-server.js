const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Путь к файлу products.json
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

        // Синхронизация с GitHub
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

        // Git команды для синхронизации
        const commands = [
            'git add webapp/products.json',
            `git commit -m "Обновление каталога товаров ${new Date().toLocaleString()}"`,
            'git push origin main'
        ];

        for (const command of commands) {
            try {
                await execPromise(command, { cwd: repoPath });
                console.log(`Выполнена команда: ${command}`);
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
app.post('/api/admin/product', async (req, res) => {
    try {
        const productData = req.body;
        const products = loadProducts();

        // Создаем новый товар с уникальным ID
        const newProduct = {
            _id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            ...productData,
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
app.put('/api/admin/product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const products = loadProducts();

        const productIndex = products.findIndex(p => (p.id || p._id) === id);

        if (productIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        // Обновляем товар
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

        // Удаляем товар
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

// Запуск сервера
const PORT = 3001; // Используем другой порт, чтобы не конфликтовать
app.listen(PORT, () => {
    console.log(`Простой API сервер запущен на порту ${PORT}`);
    console.log('API endpoints:');
    console.log('- GET /api/admin/products');
    console.log('- POST /api/admin/product');
    console.log('- PUT /api/admin/product/:id');
    console.log('- DELETE /api/admin/product/:id');
    console.log('- POST /api/admin/sync');
});