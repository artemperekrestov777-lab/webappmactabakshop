const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const multer = require('multer');
const execPromise = util.promisify(exec);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, 'webapp/images');
        // Создаем папку если её нет
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Создаем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Проверяем тип файла
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

// Раздача статических файлов из папки webapp
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

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

        // Добавляем файлы в staging
        try {
            await execPromise('git add webapp/products.json webapp/images/', { cwd: repoPath });
            console.log('Файлы добавлены в staging area');
        } catch (error) {
            console.log('Ошибка добавления файлов:', error.message);
        }

        // Проверяем есть ли изменения для commit
        try {
            const { stdout } = await execPromise('git status --porcelain', { cwd: repoPath });
            if (stdout.trim() === '') {
                console.log('Нет изменений для commit');
                return true;
            }
        } catch (error) {
            console.log('Ошибка проверки статуса:', error.message);
        }

        // Делаем commit только если есть изменения
        try {
            await execPromise(`git commit -m "Обновление каталога товаров ${new Date().toLocaleString()}"`, { cwd: repoPath });
            console.log('Commit выполнен успешно');
        } catch (error) {
            console.log('Ошибка commit (возможно нет изменений):', error.message);
        }

        // Пушим изменения
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

// API для загрузки изображения
app.post('/api/admin/upload', upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Файл не был загружен'
            });
        }

        // Возвращаем путь к файлу относительно webapp
        const imagePath = '/images/' + req.file.filename;

        res.json({
            success: true,
            imagePath: imagePath,
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
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

        // Обрабатываем изображение если оно было загружено
        let imageUrl = productData.imageUrl || '';
        if (req.file) {
            imageUrl = '/images/' + req.file.filename;
        }

        // Создаем новый товар с уникальным ID
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

        // Обрабатываем новое изображение если оно было загружено
        if (req.file) {
            updateData.imageUrl = '/images/' + req.file.filename;
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
    console.log('- POST /api/admin/upload (загрузка изображения)');
    console.log('- POST /api/admin/product (с поддержкой файлов)');
    console.log('- PUT /api/admin/product/:id (с поддержкой файлов)');
    console.log('- DELETE /api/admin/product/:id');
    console.log('- POST /api/admin/sync');
    console.log('- Static files: /webapp/images/*');
});