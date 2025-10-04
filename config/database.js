const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mactabak_shop', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB подключен');
    } catch (error) {
        console.error('MongoDB не доступен. Работа без базы данных.');
        console.log('Для полной функциональности установите MongoDB');
        // Не завершаем процесс - работаем без БД
    }
};

module.exports = connectDB;