// Админ-панель JavaScript
const API_URL = 'http://localhost:3000/api';
const ADMIN_PASSWORD = 'f3-YmUt2AP-JYt';

let currentEditProduct = null;
let allProducts = [];

// Проверка токена при загрузке
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        // Проверка токена
        validateToken(token);
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
    }
});

// Валидация токена
async function validateToken(token) {
    try {
        // Декодирование JWT токена
        const payload = parseJwt(token);

        if (payload && payload.role === 'admin' && payload.exp * 1000 > Date.now()) {
            showAdminPanel();
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
        }
    } catch (error) {
        document.getElementById('loginScreen').style.display = 'flex';
    }
}

// Парсинг JWT токена
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

// Вход администратора
function adminLogin() {
    const password = document.getElementById('adminPassword').value;

    if (password === ADMIN_PASSWORD) {
        showAdminPanel();
    } else {
        document.getElementById('loginError').textContent = 'Неверный пароль';
    }
}

// Показать админ-панель
function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadProducts();
}

// Выход
function logout() {
    window.location.href = '/';
}

// Показать форму добавления товара
function showAddProduct() {
    currentEditProduct = null;
    document.getElementById('formTitle').textContent = 'Добавить товар';
    document.getElementById('productForm').style.display = 'block';
    clearForm();
}

// Переключение поля веса
function toggleWeightField() {
    const unit = document.getElementById('productUnit').value;
    const weightGroup = document.getElementById('weightGroup');

    if (unit === 'вес') {
        weightGroup.style.display = 'block';
        document.getElementById('productWeight').required = true;
    } else {
        weightGroup.style.display = 'none';
        document.getElementById('productWeight').required = false;
    }
}

// Предпросмотр изображения
function previewImage() {
    const file = document.getElementById('productImage').files[0];
    const preview = document.getElementById('imagePreview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
}

// Сохранение товара
async function saveProduct() {
    const productData = {
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value,
        unit: document.getElementById('productUnit').value,
        price: parseInt(document.getElementById('productPrice').value),
        description: document.getElementById('productDescription').value.trim(),
        productId: generateProductId()
    };

    if (productData.unit === 'вес') {
        productData.weight = parseInt(document.getElementById('productWeight').value);
    }

    // Валидация
    if (!productData.name || !productData.category || !productData.unit || !productData.price) {
        alert('Заполните все обязательные поля');
        return;
    }

    showLoader();

    try {
        let response;
        if (currentEditProduct) {
            // Обновление товара
            response = await fetch(`${API_URL}/admin/product/${currentEditProduct._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
        } else {
            // Добавление нового товара
            response = await fetch(`${API_URL}/admin/product`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(productData)
            });
        }

        const result = await response.json();

        if (result.success) {
            // Загрузка изображения если есть
            const imageFile = document.getElementById('productImage').files[0];
            if (imageFile) {
                await uploadImage(result.product._id || result.product.id, imageFile);
            }

            alert(currentEditProduct ? 'Товар обновлен' : 'Товар добавлен');
            cancelForm();
            loadProducts();
            syncWithGitHub();
        } else {
            alert('Ошибка: ' + result.error);
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения товара');
    } finally {
        hideLoader();
    }
}

// Загрузка изображения
async function uploadImage(productId, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const response = await fetch(`${API_URL}/admin/product/image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        productId: productId,
                        imageData: e.target.result
                    })
                });

                const result = await response.json();
                if (result.success) {
                    resolve(result.imageUrl);
                } else {
                    reject(new Error(result.error));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
}

// Генерация ID товара
function generateProductId() {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Отмена формы
function cancelForm() {
    document.getElementById('productForm').style.display = 'none';
    clearForm();
    currentEditProduct = null;
}

// Очистка формы
function clearForm() {
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productUnit').value = '';
    document.getElementById('productWeight').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('weightGroup').style.display = 'none';
}

// Загрузка списка товаров
async function loadProducts() {
    showLoader();

    try {
        const response = await fetch(`${API_URL}/admin/products`);
        const result = await response.json();

        if (result.success) {
            allProducts = result.products || [];
            displayProducts(allProducts);
        } else {
            // Загрузка локальных данных
            allProducts = window.productsData || [];
            displayProducts(allProducts);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        // Загрузка локальных данных
        allProducts = window.productsData || [];
        displayProducts(allProducts);
    } finally {
        hideLoader();
    }
}

// Отображение товаров
function displayProducts(products) {
    const container = document.getElementById('productsTable');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Товары не найдены</p>';
        return;
    }

    products.forEach(product => {
        const item = document.createElement('div');
        item.className = 'product-item';

        const imageHtml = product.imageUrl || product.image
            ? `<img src="${product.imageUrl || product.image}" alt="${product.name}" class="product-item-image">`
            : `<div class="product-item-image">📦</div>`;

        item.innerHTML = `
            ${imageHtml}
            <div class="product-item-info">
                <div class="product-item-name">${product.name}</div>
                <div class="product-item-details">
                    Категория: ${getCategoryName(product.category)} |
                    ${product.unit === 'вес' ? `Вес: ${product.weight}г` : 'Штука'}
                </div>
            </div>
            <div class="product-item-price">${product.price}₽</div>
            <div class="product-item-actions">
                <button class="edit-btn" onclick='editProduct(${JSON.stringify(product).replace(/'/g, "\\'")})'>✏️ Изменить</button>
                <button class="delete-btn" onclick="deleteProduct('${product._id || product.id}')">🗑️ Удалить</button>
            </div>
        `;

        container.appendChild(item);
    });
}

// Получение названия категории
function getCategoryName(categoryId) {
    const categories = {
        'new': 'Новинки',
        'standard': 'Стандартные бленды',
        'aromatic': 'Ароматизированные бленды',
        'pipe': 'Трубочные бленды',
        'gilzy': 'Сигаретные гильзы',
        'custom': 'Собрать свой набор',
        'mactabak': 'Продукция от МАКТАБАК',
        'pipes': 'Курительные трубки',
        'machines': 'Машинки для набивки',
        'tea': 'Китайский чай',
        'tamper': 'Тампер'
    };
    return categories[categoryId] || categoryId;
}

// Редактирование товара
function editProduct(product) {
    currentEditProduct = product;
    document.getElementById('formTitle').textContent = 'Редактировать товар';

    // Заполнение формы
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productUnit').value = product.unit;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDescription').value = product.description || '';

    if (product.unit === 'вес') {
        document.getElementById('weightGroup').style.display = 'block';
        document.getElementById('productWeight').value = product.weight;
    }

    if (product.imageUrl || product.image) {
        document.getElementById('imagePreview').innerHTML =
            `<img src="${product.imageUrl || product.image}" alt="Preview">`;
    }

    document.getElementById('productForm').style.display = 'block';
    window.scrollTo(0, 0);
}

// Удаление товара
async function deleteProduct(productId) {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) {
        return;
    }

    showLoader();

    try {
        const response = await fetch(`${API_URL}/admin/product/${productId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            alert('Товар удален');
            loadProducts();
            syncWithGitHub();
        } else {
            alert('Ошибка удаления: ' + result.error);
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления товара');
    } finally {
        hideLoader();
    }
}

// Фильтрация товаров
function filterProducts() {
    const category = document.getElementById('filterCategory').value;

    if (category === 'all') {
        displayProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.category === category);
        displayProducts(filtered);
    }
}

// Синхронизация с GitHub
async function syncWithGitHub() {
    showLoader();

    try {
        const response = await fetch(`${API_URL}/admin/sync`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            alert('Синхронизация с GitHub выполнена успешно');
        } else {
            alert('Ошибка синхронизации');
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        alert('Ошибка синхронизации с GitHub');
    } finally {
        hideLoader();
    }
}

// Показать загрузчик
function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

// Скрыть загрузчик
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}