// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Глобальные переменные
let cart = [];
let currentCategory = 'all';
let currentSort = 'default';
let allProducts = [];
let currentProduct = null;
let savedUserData = null;
const API_URL = 'http://localhost:3000/api';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    loadCategories();
    loadCart();
    loadSavedUserData();

    // Обработчик отправки формы
    document.getElementById('checkoutForm').addEventListener('submit', handleCheckoutSubmit);
});

// Загрузка продуктов
async function loadProducts() {
    try {
        // Загрузка с GitHub Pages с кеш-бастингом
        const timestamp = Date.now();
        const productsUrl = `https://artemperekrestov777-lab.github.io/webappmactabakshop/webapp/products.json?v=${timestamp}`;

        const response = await fetch(productsUrl, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (response.ok) {
            allProducts = await response.json();
            console.log(`Загружено ${allProducts.length} товаров с GitHub Pages`);
        } else {
            console.warn('Не удалось загрузить с GitHub Pages, используем локальные данные');
            allProducts = window.productsData || [];
        }
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        // Загрузка локальных данных как резерв
        allProducts = window.productsData || [];
    }

    displayProducts();
}

// Загрузка категорий
function loadCategories() {
    const categoriesContainer = document.getElementById('categoriesContainer');
    const categories = [
        { id: 'all', name: 'Все' },
        { id: 'new', name: 'Новинки от МАК ТАБАК' },
        { id: 'standard', name: 'Стандартные бленды' },
        { id: 'aromatic', name: 'Ароматизированные бленды' },
        { id: 'pipe', name: 'Трубочные бленды' },
        { id: 'gilzy', name: 'Сигаретные гильзы' },
        { id: 'custom', name: 'Собрать свой набор' },
        { id: 'mactabak', name: 'Продукция от МАКТАБАК' },
        { id: 'pipes', name: 'Курительные трубки' },
        { id: 'machines', name: 'Машинки для набивки' },
        { id: 'tea', name: 'Китайский чай' },
        { id: 'tamper', name: 'Тампер' }
    ];

    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = cat.name;
        btn.onclick = () => selectCategory(cat.id);
        if (cat.id === currentCategory) {
            btn.classList.add('active');
        }
        categoriesContainer.appendChild(btn);
    });
}

// Выбор категории
function selectCategory(categoryId) {
    currentCategory = categoryId;

    // Обновление активной кнопки
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    displayProducts();
}

// Отображение товаров
function displayProducts() {
    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    // Фильтрация по категории
    let filteredProducts = currentCategory === 'all'
        ? allProducts
        : allProducts.filter(p => p.category === currentCategory);

    // Сортировка
    switch (currentSort) {
        case 'price_asc':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price_desc':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'new':
            filteredProducts = filteredProducts.filter(p => p.category === 'new');
            break;
    }

    // Создание карточек товаров
    filteredProducts.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

// Создание карточки товара
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => showProductModal(product);

    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-image';

    // Создаем красивую заглушку с эмодзи в зависимости от категории
    const categoryEmojis = {
        'new': '✨',
        'standard': '🚬',
        'aromatic': '🌸',
        'pipe': '🎯',
        'gilzy': '📜',
        'custom': '⚙️',
        'mactabak': '👑',
        'pipes': '🎭',
        'machines': '🔧',
        'tea': '🍃',
        'tamper': '🔨'
    };

    const emoji = categoryEmojis[product.category] || '📦';

    if (product.image || product.imageUrl) {
        const img = document.createElement('img');
        const fullImageUrl = (product.imageUrl || product.image || '').startsWith('http')
            ? product.imageUrl || product.image
            : `https://artemperekrestov777-lab.github.io/webappmactabakshop/webapp${product.imageUrl || product.image}`;

        img.src = fullImageUrl;
        img.alt = product.name;
        img.onerror = () => {
            img.style.display = 'none';
            imageDiv.innerHTML = `<div class="emoji-placeholder">${emoji}</div>`;
        };
        imageDiv.appendChild(img);
    } else {
        imageDiv.innerHTML = `<div class="emoji-placeholder">${emoji}</div>`;
    }

    const info = document.createElement('div');
    info.className = 'product-info';

    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = product.name;

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = `${product.price}₽`;

    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-cart';
    addBtn.textContent = 'Добавить в корзину';
    addBtn.onclick = (e) => {
        e.stopPropagation();
        addToCart(product);
    };

    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(addBtn);

    card.appendChild(imageDiv);
    card.appendChild(info);

    return card;
}

// Показать модальное окно товара
function showProductModal(product) {
    currentProduct = product;

    const modalImage = document.getElementById('modalImage');
    const imageUrl = product.imageUrl || product.image;

    if (imageUrl && imageUrl !== '' && !imageUrl.includes('tempImageGowoGG')) {
        modalImage.src = imageUrl;
        modalImage.style.display = 'block';
        modalImage.className = '';
        modalImage.onerror = function() {
            // Если изображение не загрузилось, показываем emoji
            showModalEmojiPlaceholder(product);
        };
    } else {
        // Сразу показываем emoji если нет изображения
        showModalEmojiPlaceholder(product);
    }

    document.getElementById('modalTitle').textContent = product.name;
    document.getElementById('modalDescription').textContent = product.description || 'Описание товара';
    document.getElementById('modalPrice').textContent = `${product.price}₽`;
    document.getElementById('productModal').style.display = 'flex';
}

// Показать emoji заглушку в модальном окне
function showModalEmojiPlaceholder(product) {
    const modalImage = document.getElementById('modalImage');
    const categoryEmojis = {
        'new': '✨',
        'standard': '🚬',
        'aromatic': '🌸',
        'pipe': '🎯',
        'gilzy': '📜',
        'custom': '⚙️',
        'mactabak': '👑',
        'pipes': '🎭',
        'machines': '🔧',
        'tea': '🍃',
        'tamper': '🔨'
    };

    const emoji = categoryEmojis[product.category] || '🚬';

    // Скрываем img элемент и создаем emoji div
    modalImage.style.display = 'none';

    // Удаляем существующий emoji placeholder если есть
    const existingPlaceholder = modalImage.parentNode.querySelector('.modal-emoji-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }

    // Создаем новый emoji placeholder
    const emojiDiv = document.createElement('div');
    emojiDiv.className = 'modal-emoji-placeholder';
    emojiDiv.textContent = emoji;
    emojiDiv.style.cssText = `
        width: 100%;
        height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 80px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        margin-bottom: 15px;
    `;

    // Вставляем emoji div после img элемента
    modalImage.parentNode.insertBefore(emojiDiv, modalImage.nextSibling);
}

// Закрыть модальное окно
function closeProductModal() {
    // Очищаем emoji placeholder если он есть
    const existingPlaceholder = document.querySelector('.modal-emoji-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }

    document.getElementById('productModal').style.display = 'none';
    currentProduct = null;
}

// Добавить в корзину из модального окна
function addToCartFromModal() {
    if (currentProduct) {
        addToCart(currentProduct);
        closeProductModal();
    }
}

// Добавление в корзину
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();

    // Визуальная обратная связь
    tg.HapticFeedback.impactOccurred('light');
    showNotification('Товар добавлен в корзину');
}

// Сохранение корзины
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Загрузка корзины
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartUI();
    }
}

// Обновление интерфейса корзины
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? 'flex' : 'none';

    // Обновление корзины если она открыта
    if (document.getElementById('cartScreen').style.display !== 'none') {
        displayCart();
    }
}

// Показать корзину
function showCart() {
    document.getElementById('cartScreen').style.display = 'block';
    displayCart();
}

// Закрыть корзину
function closeCart() {
    document.getElementById('cartScreen').style.display = 'none';
    // Очистка корзины при закрытии (согласно требованию)
    setTimeout(() => {
        cart = [];
        saveCart();
        updateCartUI();
    }, 300);
}

// Отображение корзины
function displayCart() {
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartSummary = document.getElementById('cartSummary');

    if (cart.length === 0) {
        cartItems.style.display = 'none';
        emptyCart.style.display = 'block';
        cartSummary.style.display = 'none';
    } else {
        cartItems.style.display = 'block';
        emptyCart.style.display = 'none';
        cartSummary.style.display = 'block';

        cartItems.innerHTML = '';
        let total = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';

            cartItem.innerHTML = `
                <div class="cart-item-image">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}">` : '📦'}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${item.price}₽</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        <button onclick="removeFromCart('${item.id}')">🗑️</button>
                    </div>
                </div>
            `;

            cartItems.appendChild(cartItem);
        });

        document.getElementById('cartTotal').textContent = `${total}₽`;
        document.getElementById('checkoutTotal').textContent = `${total}₽`;
    }
}

// Обновление количества товара
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            displayCart();
            updateCartUI();
        }
    }
}

// Удаление из корзины
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    displayCart();
    updateCartUI();
}

// Очистить корзину
function clearCart() {
    if (confirm('Вы уверены, что хотите очистить корзину?')) {
        cart = [];
        saveCart();
        displayCart();
        updateCartUI();
    }
}

// Показать оформление заказа
function showCheckout() {
    // Проверка минимального веса
    const weightItems = cart.filter(item => item.unit === 'вес');
    const totalWeight = weightItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

    if (weightItems.length > 0 && totalWeight < 1000) {
        alert('Минимальный объём заказа по весовым товарам от 1 кг');
        return;
    }

    document.getElementById('checkoutScreen').style.display = 'block';

    // Автозаполнение сохраненных данных
    if (savedUserData) {
        document.getElementById('fullName').value = savedUserData.fullName || '';
        document.getElementById('phone').value = savedUserData.phone || '';
        document.getElementById('email').value = savedUserData.email || '';
        document.getElementById('city').value = savedUserData.city || '';
        document.getElementById('region').value = savedUserData.region || '';
        document.getElementById('address').value = savedUserData.address || '';
        document.getElementById('deliveryMethod').value = savedUserData.preferredDelivery || '';
    }

    updateCheckoutSummary();
}

// Закрыть оформление заказа
function closeCheckout() {
    document.getElementById('checkoutScreen').style.display = 'none';
}

// Обновление цены доставки
function updateDeliveryPrice() {
    updateCheckoutSummary();
}

// Обновление итогов заказа
function updateCheckoutSummary() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    let deliveryPrice = 0;

    if (deliveryMethod === 'pochta') {
        deliveryPrice = 500;
    } else if (deliveryMethod === 'sdek') {
        deliveryPrice = 600;
    }

    const total = subtotal + deliveryPrice;

    document.getElementById('checkoutSubtotal').textContent = `${subtotal}₽`;
    document.getElementById('checkoutDelivery').textContent = `${deliveryPrice}₽`;
    document.getElementById('checkoutFinalTotal').textContent = `${total}₽`;
    document.getElementById('submitTotal').textContent = `${total}₽`;
}

// Обработка отправки заказа
async function handleCheckoutSubmit(event) {
    event.preventDefault();

    // Валидация формы
    if (!validateCheckoutForm()) {
        return;
    }

    // Сбор данных формы
    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        city: document.getElementById('city').value.trim(),
        region: document.getElementById('region').value.trim(),
        address: document.getElementById('address').value.trim(),
        deliveryMethod: document.getElementById('deliveryMethod').value,
        comment: document.getElementById('comment').value.trim()
    };

    // Определение цены доставки
    formData.deliveryPrice = formData.deliveryMethod === 'pochta' ? 500 : 600;

    // Сохранение данных для автозаполнения
    savedUserData = formData;
    localStorage.setItem('userData', JSON.stringify(savedUserData));

    // Подготовка заказа
    const orderData = {
        userId: tg.initDataUnsafe?.user?.id || 0,
        items: cart,
        customer: formData
    };

    // Отправка заказа
    showLoader();

    try {
        const response = await fetch(`${API_URL}/order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (result.success) {
            // Очистка корзины
            cart = [];
            saveCart();
            updateCartUI();

            // Закрытие экранов
            closeCheckout();
            closeCart();

            // Показ сообщения и возврат в каталог
            if (result.order.isFromMoscow) {
                alert('Ваш заказ принят! С вами свяжется менеджер для выставления счета.');
            } else {
                // QR-код будет показан через бота
            }

            // Возврат в каталог
            showCatalog();
        } else {
            alert(result.error || 'Ошибка при создании заказа');
        }
    } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        alert('Ошибка соединения с сервером. Попробуйте позже.');
    } finally {
        hideLoader();
    }
}

// Валидация формы оформления
function validateCheckoutForm() {
    const fields = [
        { id: 'fullName', pattern: /^[А-Яа-яЁё\s]{10,}$/, error: 'Введите полное ФИО (минимум 10 символов)' },
        { id: 'phone', pattern: /^[+]?[0-9]{11,}$/, error: 'Введите корректный номер телефона' },
        { id: 'email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, error: 'Введите корректный email' },
        { id: 'city', min: 2, error: 'Введите название города' },
        { id: 'region', min: 2, error: 'Введите регион или область' },
        { id: 'address', min: 10, error: 'Введите полный адрес доставки' },
        { id: 'deliveryMethod', required: true, error: 'Выберите способ доставки' }
    ];

    let isValid = true;

    fields.forEach(field => {
        const element = document.getElementById(field.id);
        const value = element.value.trim();
        const formGroup = element.closest('.form-group');
        const errorMessage = formGroup.querySelector('.error-message');

        formGroup.classList.remove('error');

        if (field.required && !value) {
            formGroup.classList.add('error');
            errorMessage.textContent = field.error;
            isValid = false;
        } else if (field.pattern && !field.pattern.test(value)) {
            formGroup.classList.add('error');
            errorMessage.textContent = field.error;
            isValid = false;
        } else if (field.min && value.length < field.min) {
            formGroup.classList.add('error');
            errorMessage.textContent = field.error;
            isValid = false;
        }
    });

    return isValid;
}

// Загрузка сохраненных данных пользователя
function loadSavedUserData() {
    const saved = localStorage.getItem('userData');
    if (saved) {
        savedUserData = JSON.parse(saved);
    }
}

// Функции навигации
function showCatalog() {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
}

function goBack() {
    if (document.getElementById('cartScreen').style.display !== 'none') {
        closeCart();
    } else if (document.getElementById('checkoutScreen').style.display !== 'none') {
        closeCheckout();
    } else {
        window.history.back();
    }
}

// Поиск
function toggleSearch() {
    const searchBar = document.getElementById('searchBar');
    searchBar.style.display = searchBar.style.display === 'none' ? 'flex' : 'none';
    if (searchBar.style.display !== 'none') {
        document.getElementById('searchInput').focus();
    }
}

function searchProducts() {
    const query = document.getElementById('searchInput').value.toLowerCase();

    if (query.length < 2) {
        displayProducts();
        return;
    }

    const filtered = allProducts.filter(product =>
        product.name.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query))
    );

    const container = document.getElementById('productsContainer');
    container.innerHTML = '';

    filtered.forEach(product => {
        const card = createProductCard(product);
        container.appendChild(card);
    });
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    displayProducts();
    toggleSearch();
}

// Сортировка
function showSortMenu() {
    const menu = document.getElementById('sortMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function sortProducts(sortType) {
    currentSort = sortType;
    displayProducts();
    document.getElementById('sortMenu').style.display = 'none';
}

// Показать загрузчик
function showLoader() {
    document.getElementById('loader').style.display = 'flex';
}

// Скрыть загрузчик
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Показать уведомление
function showNotification(message) {
    // Можно добавить визуальное уведомление
    console.log(message);
}