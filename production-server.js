/**
 * Production Server для МакТабак
 * Профессиональная система управления товарами с обработкой изображений
 * Версия: 1.0.0
 * Дата: 04.11.2024
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// ============================
// КОНФИГУРАЦИЯ
// ============================
const CONFIG = {
    PORT: process.env.PORT || 3001,
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH || '$2b$10$IFPXUg9rooL2hDMIu5PTYu7BdUDHbT1lRzT.zfzY3Qer/94IIgmg6', // Пароль: admin123
    STORAGE_PATH: process.env.STORAGE_PATH || './storage',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES_PER_UPLOAD: 10,
    IMAGE_SIZES: [
        { name: 'thumb', width: 150, height: 150, quality: 85 },
        { name: 'small', width: 300, height: 300, quality: 85 },
        { name: 'medium', width: 600, height: 600, quality: 90 },
        { name: 'large', width: 1200, height: 1200, quality: 90 }
    ],
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    BACKUP_INTERVAL: 6 * 60 * 60 * 1000, // 6 часов
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 минут
    RATE_LIMIT_MAX: 100 // максимум запросов
};

// ============================
// ИНИЦИАЛИЗАЦИЯ
// ============================
const app = express();

// Создание необходимых папок
async function createStorageDirectories() {
    const dirs = [
        CONFIG.STORAGE_PATH,
        `${CONFIG.STORAGE_PATH}/products`,
        `${CONFIG.STORAGE_PATH}/products/original`,
        `${CONFIG.STORAGE_PATH}/products/thumb`,
        `${CONFIG.STORAGE_PATH}/products/small`,
        `${CONFIG.STORAGE_PATH}/products/medium`,
        `${CONFIG.STORAGE_PATH}/products/large`,
        `${CONFIG.STORAGE_PATH}/temp`,
        `${CONFIG.STORAGE_PATH}/backups`,
        `${CONFIG.STORAGE_PATH}/logs`
    ];

    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
    console.log('✅ Структура папок создана');
}

// ============================
// MIDDLEWARE
// ============================

// Безопасность
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "*"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", "*"]
        }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: function(origin, callback) {
        // Разрешаем запросы с Telegram WebApp и localhost
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://85.198.83.41:3001',
            'https://web.telegram.org'
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true); // В production ограничить!
        }
    },
    credentials: true
}));

// Сжатие
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW,
    max: CONFIG.RATE_LIMIT_MAX,
    message: 'Слишком много запросов, попробуйте позже'
});
app.use('/api/', limiter);

// Парсинг JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use('/storage', express.static(CONFIG.STORAGE_PATH));
app.use('/webapp', express.static(path.join(__dirname, 'webapp')));

// Логирование
app.use((req, res, next) => {
    const log = `[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`;
    console.log(log);
    fs.appendFile(`${CONFIG.STORAGE_PATH}/logs/access.log`, log + '\n').catch(() => {});
    next();
});

// ============================
// MULTER КОНФИГУРАЦИЯ
// ============================
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: CONFIG.MAX_FILE_SIZE,
        files: CONFIG.MAX_FILES_PER_UPLOAD
    },
    fileFilter: (req, file, cb) => {
        if (CONFIG.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Недопустимый тип файла. Разрешены только JPEG, PNG, WebP'));
        }
    }
});

// ============================
// КЛАСС ДЛЯ ОБРАБОТКИ ИЗОБРАЖЕНИЙ
// ============================
class ImageProcessor {
    /**
     * Обработка и оптимизация изображения
     */
    static async processImage(buffer, productId, filename) {
        const results = {
            original: null,
            thumbnails: {}
        };

        try {
            // Генерируем уникальное имя файла
            const uniqueName = `${productId}_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '')}`;
            const ext = path.extname(filename).toLowerCase() || '.jpg';

            // Сохраняем оригинал с оптимизацией
            const originalPath = path.join(CONFIG.STORAGE_PATH, 'products', 'original', uniqueName);
            await sharp(buffer)
                .jpeg({ quality: 95, progressive: true })
                .toFile(originalPath);
            results.original = `/storage/products/original/${uniqueName}`;

            // Создаем миниатюры разных размеров
            for (const size of CONFIG.IMAGE_SIZES) {
                const thumbPath = path.join(CONFIG.STORAGE_PATH, 'products', size.name, uniqueName);

                await sharp(buffer)
                    .resize(size.width, size.height, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality: size.quality,
                        progressive: true
                    })
                    .toFile(thumbPath);

                results.thumbnails[size.name] = `/storage/products/${size.name}/${uniqueName}`;
            }

            // Получаем метаданные
            const metadata = await sharp(buffer).metadata();
            results.metadata = {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: metadata.size
            };

            return results;
        } catch (error) {
            console.error('Ошибка обработки изображения:', error);
            throw error;
        }
    }

    /**
     * Удаление всех версий изображения
     */
    static async deleteImage(imagePath) {
        try {
            const filename = path.basename(imagePath);
            const sizes = ['original', ...CONFIG.IMAGE_SIZES.map(s => s.name)];

            for (const size of sizes) {
                const filePath = path.join(CONFIG.STORAGE_PATH, 'products', size, filename);
                await fs.unlink(filePath).catch(() => {});
            }

            return true;
        } catch (error) {
            console.error('Ошибка удаления изображения:', error);
            return false;
        }
    }

    /**
     * Оптимизация существующих изображений
     */
    static async optimizeExisting(imagePath) {
        try {
            const fullPath = path.join(CONFIG.STORAGE_PATH, imagePath.replace('/storage/', ''));
            const buffer = await fs.readFile(fullPath);
            const optimizedBuffer = await sharp(buffer)
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();

            await fs.writeFile(fullPath, optimizedBuffer);

            const stats = await fs.stat(fullPath);
            const originalSize = buffer.length;
            const newSize = stats.size;
            const savedPercent = Math.round((1 - newSize / originalSize) * 100);

            return {
                originalSize,
                newSize,
                savedPercent,
                path: imagePath
            };
        } catch (error) {
            console.error('Ошибка оптимизации:', error);
            throw error;
        }
    }
}

// ============================
// БАЗА ДАННЫХ (JSON)
// ============================
class Database {
    constructor() {
        this.dbPath = path.join(CONFIG.STORAGE_PATH, 'database.json');
        this.data = {
            products: [],
            users: [
                {
                    id: '1',
                    username: CONFIG.ADMIN_USERNAME,
                    password: CONFIG.ADMIN_PASSWORD_HASH,
                    role: 'admin'
                }
            ],
            settings: {},
            logs: []
        };
    }

    async init() {
        try {
            const fileContent = await fs.readFile(this.dbPath, 'utf-8');
            this.data = JSON.parse(fileContent);
        } catch (error) {
            await this.save();
        }
    }

    async save() {
        await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
    }

    // Методы для работы с товарами
    async getProducts() {
        return this.data.products;
    }

    async getProduct(id) {
        return this.data.products.find(p => p._id === id);
    }

    async addProduct(product) {
        const newProduct = {
            _id: uuidv4(),
            ...product,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.data.products.push(newProduct);
        await this.save();
        return newProduct;
    }

    async updateProduct(id, updates) {
        const index = this.data.products.findIndex(p => p._id === id);
        if (index === -1) return null;

        this.data.products[index] = {
            ...this.data.products[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        await this.save();
        return this.data.products[index];
    }

    async deleteProduct(id) {
        const index = this.data.products.findIndex(p => p._id === id);
        if (index === -1) return false;

        const product = this.data.products[index];

        // Удаляем изображения
        if (product.images && product.images.length > 0) {
            for (const image of product.images) {
                await ImageProcessor.deleteImage(image.original);
            }
        }

        this.data.products.splice(index, 1);
        await this.save();
        return true;
    }

    // Логирование
    async addLog(action, userId, details) {
        this.data.logs.push({
            id: uuidv4(),
            action,
            userId,
            details,
            timestamp: new Date().toISOString()
        });

        // Ограничиваем количество логов
        if (this.data.logs.length > 1000) {
            this.data.logs = this.data.logs.slice(-1000);
        }

        await this.save();
    }

    // Резервное копирование
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupPath = path.join(CONFIG.STORAGE_PATH, 'backups', `backup-${timestamp}.json`);
        await fs.writeFile(backupPath, JSON.stringify(this.data, null, 2));

        // Удаляем старые бэкапы (оставляем последние 10)
        const backupDir = path.join(CONFIG.STORAGE_PATH, 'backups');
        const files = await fs.readdir(backupDir);
        const backups = files.filter(f => f.startsWith('backup-')).sort().reverse();

        for (let i = 10; i < backups.length; i++) {
            await fs.unlink(path.join(backupDir, backups[i]));
        }

        return backupPath;
    }
}

// Инициализация базы данных
const db = new Database();

// ============================
// JWT АВТОРИЗАЦИЯ
// ============================
function generateToken(userId, username) {
    return jwt.sign(
        { id: userId, username },
        CONFIG.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Токен не предоставлен' });
    }

    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Недействительный токен' });
    }
}

// ============================
// API ENDPOINTS
// ============================

// Авторизация
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Требуется имя пользователя и пароль'
            });
        }

        const user = db.data.users.find(u => u.username === username);

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        const token = generateToken(user.id, user.username);
        await db.addLog('LOGIN', user.id, { username });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получение списка товаров
app.get('/api/admin/products', async (req, res) => {
    try {
        const products = await db.getProducts();
        res.json({
            success: true,
            products,
            total: products.length
        });
    } catch (error) {
        console.error('Ошибка получения товаров:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получение одного товара
app.get('/api/admin/product/:id', async (req, res) => {
    try {
        const product = await db.getProduct(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        res.json({ success: true, product });
    } catch (error) {
        console.error('Ошибка получения товара:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Загрузка изображений (множественная)
app.post('/api/admin/upload/multiple',
    verifyToken,
    upload.array('photos', CONFIG.MAX_FILES_PER_UPLOAD),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Файлы не загружены'
                });
            }

            const productId = req.body.productId || uuidv4();
            const uploadedImages = [];

            for (const file of req.files) {
                try {
                    const processed = await ImageProcessor.processImage(
                        file.buffer,
                        productId,
                        file.originalname
                    );

                    uploadedImages.push({
                        id: uuidv4(),
                        originalName: file.originalname,
                        ...processed
                    });
                } catch (error) {
                    console.error(`Ошибка обработки файла ${file.originalname}:`, error);
                }
            }

            await db.addLog('UPLOAD_IMAGES', req.user.id, {
                count: uploadedImages.length,
                productId
            });

            res.json({
                success: true,
                images: uploadedImages,
                productId,
                message: `Загружено ${uploadedImages.length} из ${req.files.length} файлов`
            });
        } catch (error) {
            console.error('Ошибка загрузки файлов:', error);
            res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
    }
);

// Загрузка одного изображения
app.post('/api/admin/upload',
    verifyToken,
    upload.single('photo'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Файл не загружен'
                });
            }

            const productId = req.body.productId || uuidv4();
            const processed = await ImageProcessor.processImage(
                req.file.buffer,
                productId,
                req.file.originalname
            );

            await db.addLog('UPLOAD_IMAGE', req.user.id, {
                filename: req.file.originalname,
                productId
            });

            res.json({
                success: true,
                image: {
                    id: uuidv4(),
                    originalName: req.file.originalname,
                    ...processed
                },
                productId
            });
        } catch (error) {
            console.error('Ошибка загрузки файла:', error);
            res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
    }
);

// Добавление товара
app.post('/api/admin/product',
    verifyToken,
    upload.array('photos', CONFIG.MAX_FILES_PER_UPLOAD),
    async (req, res) => {
        try {
            const productData = JSON.parse(req.body.productData || '{}');

            // Обработка изображений если есть
            const images = [];
            if (req.files && req.files.length > 0) {
                const productId = uuidv4();

                for (const file of req.files) {
                    try {
                        const processed = await ImageProcessor.processImage(
                            file.buffer,
                            productId,
                            file.originalname
                        );
                        images.push({
                            id: uuidv4(),
                            ...processed
                        });
                    } catch (error) {
                        console.error(`Ошибка обработки изображения:`, error);
                    }
                }
            }

            const newProduct = await db.addProduct({
                ...productData,
                images
            });

            await db.addLog('CREATE_PRODUCT', req.user.id, {
                productId: newProduct._id,
                name: newProduct.name
            });

            res.json({
                success: true,
                product: newProduct,
                message: 'Товар успешно добавлен'
            });
        } catch (error) {
            console.error('Ошибка добавления товара:', error);
            res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
    }
);

// Обновление товара
app.put('/api/admin/product/:id',
    verifyToken,
    upload.array('photos', CONFIG.MAX_FILES_PER_UPLOAD),
    async (req, res) => {
        try {
            const productId = req.params.id;
            const updates = req.body.productData ?
                JSON.parse(req.body.productData) : req.body;

            // Получаем текущий товар
            const currentProduct = await db.getProduct(productId);
            if (!currentProduct) {
                return res.status(404).json({
                    success: false,
                    error: 'Товар не найден'
                });
            }

            // Обработка новых изображений
            const newImages = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        const processed = await ImageProcessor.processImage(
                            file.buffer,
                            productId,
                            file.originalname
                        );
                        newImages.push({
                            id: uuidv4(),
                            ...processed
                        });
                    } catch (error) {
                        console.error(`Ошибка обработки изображения:`, error);
                    }
                }
            }

            // Объединяем изображения
            const allImages = [
                ...(currentProduct.images || []),
                ...newImages
            ];

            const updatedProduct = await db.updateProduct(productId, {
                ...updates,
                images: allImages
            });

            await db.addLog('UPDATE_PRODUCT', req.user.id, {
                productId,
                name: updatedProduct.name
            });

            res.json({
                success: true,
                product: updatedProduct,
                message: 'Товар успешно обновлен'
            });
        } catch (error) {
            console.error('Ошибка обновления товара:', error);
            res.status(500).json({ success: false, error: 'Ошибка сервера' });
        }
    }
);

// Удаление товара
app.delete('/api/admin/product/:id', verifyToken, async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await db.getProduct(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        const deleted = await db.deleteProduct(productId);

        if (!deleted) {
            return res.status(500).json({
                success: false,
                error: 'Не удалось удалить товар'
            });
        }

        await db.addLog('DELETE_PRODUCT', req.user.id, {
            productId,
            name: product.name
        });

        res.json({
            success: true,
            message: 'Товар успешно удален'
        });
    } catch (error) {
        console.error('Ошибка удаления товара:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Удаление изображения
app.delete('/api/admin/image/:productId/:imageId', verifyToken, async (req, res) => {
    try {
        const { productId, imageId } = req.params;
        const product = await db.getProduct(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Товар не найден'
            });
        }

        // Находим и удаляем изображение
        const imageIndex = product.images?.findIndex(img => img.id === imageId);

        if (imageIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Изображение не найдено'
            });
        }

        const image = product.images[imageIndex];
        await ImageProcessor.deleteImage(image.original);

        // Обновляем товар
        product.images.splice(imageIndex, 1);
        await db.updateProduct(productId, { images: product.images });

        await db.addLog('DELETE_IMAGE', req.user.id, {
            productId,
            imageId
        });

        res.json({
            success: true,
            message: 'Изображение успешно удалено'
        });
    } catch (error) {
        console.error('Ошибка удаления изображения:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Оптимизация изображений
app.post('/api/admin/image/optimize', verifyToken, async (req, res) => {
    try {
        const { imagePath } = req.body;

        if (!imagePath) {
            return res.status(400).json({
                success: false,
                error: 'Путь к изображению не указан'
            });
        }

        const result = await ImageProcessor.optimizeExisting(imagePath);

        await db.addLog('OPTIMIZE_IMAGE', req.user.id, {
            imagePath,
            savedPercent: result.savedPercent
        });

        res.json({
            success: true,
            result,
            message: `Сэкономлено ${result.savedPercent}% размера`
        });
    } catch (error) {
        console.error('Ошибка оптимизации:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Создание резервной копии
app.post('/api/admin/backup', verifyToken, async (req, res) => {
    try {
        const backupPath = await db.createBackup();

        await db.addLog('CREATE_BACKUP', req.user.id, { backupPath });

        res.json({
            success: true,
            backupPath,
            message: 'Резервная копия успешно создана'
        });
    } catch (error) {
        console.error('Ошибка создания бэкапа:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Получение логов
app.get('/api/admin/logs', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = db.data.logs.slice(-limit).reverse();

        res.json({
            success: true,
            logs,
            total: db.data.logs.length
        });
    } catch (error) {
        console.error('Ошибка получения логов:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Статистика
app.get('/api/admin/stats', verifyToken, async (req, res) => {
    try {
        const products = await db.getProducts();
        const totalImages = products.reduce((sum, p) => sum + (p.images?.length || 0), 0);

        // Подсчет размера хранилища
        const getDirSize = async (dirPath) => {
            let size = 0;
            const files = await fs.readdir(dirPath, { withFileTypes: true });

            for (const file of files) {
                const filePath = path.join(dirPath, file.name);
                if (file.isDirectory()) {
                    size += await getDirSize(filePath);
                } else {
                    const stats = await fs.stat(filePath);
                    size += stats.size;
                }
            }
            return size;
        };

        const storageSize = await getDirSize(CONFIG.STORAGE_PATH).catch(() => 0);

        res.json({
            success: true,
            stats: {
                totalProducts: products.length,
                totalImages,
                storageSize: `${(storageSize / 1024 / 1024).toFixed(2)} MB`,
                categories: [...new Set(products.map(p => p.category))],
                lastBackup: db.data.logs
                    .filter(l => l.action === 'CREATE_BACKUP')
                    .pop()?.timestamp || 'Никогда'
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================
// АВТОМАТИЧЕСКИЕ ЗАДАЧИ
// ============================

// Автоматическое резервное копирование
setInterval(async () => {
    try {
        await db.createBackup();
        console.log('✅ Автоматическое резервное копирование выполнено');
    } catch (error) {
        console.error('❌ Ошибка автоматического бэкапа:', error);
    }
}, CONFIG.BACKUP_INTERVAL);

// ============================
// ЗАПУСК СЕРВЕРА
// ============================
async function startServer() {
    try {
        // Создаем необходимые директории
        await createStorageDirectories();

        // Инициализируем базу данных
        await db.init();

        // Запускаем сервер
        app.listen(CONFIG.PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════════╗
║     МакТабак Production Server v1.0.0      ║
╠════════════════════════════════════════════╣
║  🚀 Сервер запущен на порту ${CONFIG.PORT}          ║
║  📁 Хранилище: ${CONFIG.STORAGE_PATH}              ║
║  🔐 JWT авторизация: активна               ║
║  📸 Sharp обработка: активна               ║
║  💾 Автобэкап: каждые 6 часов             ║
║  📊 API endpoints:                         ║
║     • POST   /api/auth/login               ║
║     • GET    /api/admin/products           ║
║     • GET    /api/admin/product/:id        ║
║     • POST   /api/admin/product            ║
║     • PUT    /api/admin/product/:id        ║
║     • DELETE /api/admin/product/:id        ║
║     • POST   /api/admin/upload             ║
║     • POST   /api/admin/upload/multiple    ║
║     • DELETE /api/admin/image/:pid/:iid    ║
║     • POST   /api/admin/image/optimize     ║
║     • POST   /api/admin/backup             ║
║     • GET    /api/admin/logs               ║
║     • GET    /api/admin/stats              ║
║     • GET    /api/health                   ║
╚════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('Необработанная ошибка:', error);
    fs.appendFile(
        `${CONFIG.STORAGE_PATH}/logs/error.log`,
        `[${new Date().toISOString()}] ${error.stack}\n`
    ).catch(() => {});
});

process.on('unhandledRejection', (error) => {
    console.error('Необработанное отклонение промиса:', error);
    fs.appendFile(
        `${CONFIG.STORAGE_PATH}/logs/error.log`,
        `[${new Date().toISOString()}] ${error}\n`
    ).catch(() => {});
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📥 Получен сигнал SIGTERM, сохраняем данные...');
    await db.save();
    await db.createBackup();
    process.exit(0);
});

// Запуск
startServer();