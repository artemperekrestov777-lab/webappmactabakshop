// Локальная база данных товаров для WebApp
window.productsData = [
    // Новинки от МАК ТАБАК
    {
        id: 'lighter-spunk',
        name: 'Зажигалка для трубки Spunk-Baofa (3)',
        category: 'new',
        price: 800,
        unit: 'штука',
        description: 'Качественная зажигалка для трубки с надежным механизмом',
        image: null
    },
    {
        id: 'lighter-honest',
        name: 'Зажигалка для трубки Honest (3) (копия 4281)',
        category: 'new',
        price: 900,
        unit: 'штука',
        description: 'Премиальная зажигалка для настоящих ценителей',
        image: null
    },
    {
        id: 'gilzy-ocb-premium',
        name: 'Премиум гильзы OCB 500 Black (1)',
        category: 'new',
        price: 600,
        unit: 'штука',
        description: 'Премиальные гильзы OCB 500 штук в упаковке',
        image: null
    },
    {
        id: 'machine-led1',
        name: 'Машинка набивочная LED 1 (3)',
        category: 'new',
        price: 3000,
        unit: 'штука',
        description: 'Электрическая машинка для набивки с LED подсветкой',
        image: null
    },
    {
        id: 'bag-leather',
        name: 'Сумка кожаная Muxiang № 013 (1099) (1)',
        category: 'new',
        price: 4800,
        unit: 'штука',
        description: 'Элегантная кожаная сумка для хранения табачных принадлежностей',
        image: null
    },

    // Стандартные бленды
    {
        id: 'storm',
        name: 'Шторм Storm',
        category: 'standard',
        price: 1700,
        unit: 'вес',
        weight: 200,
        description: 'Мощный и насыщенный табачный бленд',
        image: null
    },
    {
        id: 'legend',
        name: 'Легенда Legend',
        category: 'standard',
        price: 1700,
        unit: 'вес',
        weight: 200,
        description: 'Классический табак с богатым вкусом',
        image: null
    },
    {
        id: 'red-dragon',
        name: 'Красный дракон Red Dragon',
        category: 'standard',
        price: 1700,
        unit: 'вес',
        weight: 200,
        description: 'Крепкий табак с восточными нотками',
        image: null
    },
    {
        id: 'marshal',
        name: 'Маршал Marshal',
        category: 'standard',
        price: 1700,
        unit: 'вес',
        weight: 200,
        description: 'Благородный табак средней крепости',
        image: null
    },
    {
        id: 'winston',
        name: 'Mac - Винстон Winston',
        category: 'standard',
        price: 1950,
        unit: 'вес',
        weight: 200,
        description: 'Премиальный табачный бленд',
        image: null
    },

    // Ароматизированные бленды
    {
        id: 'mac-mix',
        name: 'Мак Микс',
        category: 'aromatic',
        price: 2200,
        unit: 'вес',
        weight: 200,
        description: 'Уникальный микс с фруктовыми нотками',
        image: null
    },
    {
        id: 'blend-jubilee',
        name: 'Бленд - Юбилейный',
        category: 'aromatic',
        price: 2200,
        unit: 'вес',
        weight: 200,
        description: 'Праздничный бленд с особым ароматом',
        image: null
    },
    {
        id: 'x-blend',
        name: 'Х - Бленд',
        category: 'aromatic',
        price: 2200,
        unit: 'вес',
        weight: 200,
        description: 'Экспериментальный бленд с секретной рецептурой',
        image: null
    },
    {
        id: 'coffee',
        name: 'Кофе Coffee',
        category: 'aromatic',
        price: 2200,
        unit: 'вес',
        weight: 200,
        description: 'Табак с насыщенным кофейным ароматом',
        image: null
    },

    // Трубочные бленды
    {
        id: 'captain-black-cream',
        name: 'Captain Black Cream Капитан Черный Крем',
        category: 'pipe',
        price: 1200,
        unit: 'вес',
        weight: 150,
        description: 'Кремовый трубочный табак премиум класса',
        image: null
    },
    {
        id: 'captain-black-platinum',
        name: 'Captain Black Platinum Капитан Черный Платиновый',
        category: 'pipe',
        price: 1200,
        unit: 'вес',
        weight: 150,
        description: 'Платиновая серия трубочного табака',
        image: null
    },
    {
        id: 'monarch',
        name: 'Монарх Monarch',
        category: 'pipe',
        price: 1200,
        unit: 'вес',
        weight: 150,
        description: 'Королевский трубочный табак',
        image: null
    },
    {
        id: 'pipe-mactabak',
        name: 'Трубочный Мак Табак',
        category: 'pipe',
        price: 1000,
        unit: 'вес',
        weight: 150,
        description: 'Классический трубочный табак от МакТабак',
        image: null
    },

    // Сигаретные гильзы
    {
        id: 'gilzy-mascotte-xlong',
        name: 'Гильзы с фильтром Mascotte X-long (200 шт)',
        category: 'gilzy',
        price: 350,
        unit: 'штука',
        description: 'Удлиненные гильзы с фильтром, 200 штук',
        image: null
    },
    {
        id: 'gilzy-mascotte-carbon',
        name: 'Гильзы с фильтром Mascotte Carbon (200 шт)',
        category: 'gilzy',
        price: 400,
        unit: 'штука',
        description: 'Гильзы с угольным фильтром, 200 штук',
        image: null
    },
    {
        id: 'gilzy-mascotte-classic',
        name: 'Гильзы с фильтром Mascotte Classic (200 шт)',
        category: 'gilzy',
        price: 300,
        unit: 'штука',
        description: 'Классические гильзы с фильтром, 200 штук',
        image: null
    },
    {
        id: 'gilzy-aviator',
        name: 'Гильзы American Aviator Slim White 724мм',
        category: 'gilzy',
        price: 200,
        unit: 'штука',
        description: 'Тонкие белые гильзы с серебряной линией',
        image: null
    },

    // Собрать свой набор
    {
        id: 'custom-coffee',
        name: 'Кофе',
        category: 'custom',
        price: 800,
        unit: 'вес',
        weight: 100,
        description: 'Компонент для создания своего бленда',
        image: null
    },
    {
        id: 'custom-zvar',
        name: 'Звар',
        category: 'custom',
        price: 880,
        unit: 'вес',
        weight: 100,
        description: 'Компонент для создания своего бленда',
        image: null
    },
    {
        id: 'custom-halfzvar',
        name: 'Халфзвар',
        category: 'custom',
        price: 880,
        unit: 'вес',
        weight: 100,
        description: 'Компонент для создания своего бленда',
        image: null
    },

    // Продукция от МАКТАБАК
    {
        id: 'mac-luxury3',
        name: 'Mac Luxury №3',
        category: 'mactabak',
        price: 1500,
        unit: 'штука',
        description: 'Эксклюзивный продукт от МАКТАБАК',
        image: null
    },
    {
        id: 'mac-luxury',
        name: 'Mac Luxury',
        category: 'mactabak',
        price: 1500,
        unit: 'штука',
        description: 'Люксовый продукт от МАКТАБАК',
        image: null
    },
    {
        id: 'portsigar-x2',
        name: 'Стильный портсигар X2',
        category: 'mactabak',
        price: 1800,
        unit: 'штука',
        description: 'Элегантный портсигар на 2 отделения',
        image: null
    },
    {
        id: 'portsigar-x3',
        name: 'Стильный портсигар X3',
        category: 'mactabak',
        price: 1800,
        unit: 'штука',
        description: 'Элегантный портсигар на 3 отделения',
        image: null
    },

    // Курительные трубки
    {
        id: 'pipe-burning',
        name: 'Трубка Mr Burning 220',
        category: 'pipes',
        price: 3500,
        unit: 'штука',
        description: 'Классическая курительная трубка',
        image: null
    },
    {
        id: 'pipe-muxang-briar',
        name: 'Muxang Briar № 888',
        category: 'pipes',
        price: 8000,
        unit: 'штука',
        description: 'Премиальная трубка из бриара',
        image: null
    },
    {
        id: 'pipe-mrbrog',
        name: 'Mr.Brog №63 Zurek 9мм груша (фильтр)',
        category: 'pipes',
        price: 2000,
        unit: 'штука',
        description: 'Трубка грушевидной формы с фильтром',
        image: null
    },
    {
        id: 'pipe-bulldog',
        name: 'Трубка Muxiang Bulldog',
        category: 'pipes',
        price: 5000,
        unit: 'штука',
        description: 'Трубка формы Bulldog',
        image: null
    },

    // Машинки для набивки
    {
        id: 'machine-ocb-easy',
        name: 'Машинка набивочная OCB Easy Slide',
        category: 'machines',
        price: 4000,
        unit: 'штука',
        description: 'Профессиональная машинка для набивки',
        image: null
    },
    {
        id: 'machine-injectormatic2',
        name: 'Машинка набивочная Injectormatic 2',
        category: 'machines',
        price: 2500,
        unit: 'штука',
        description: 'Удобная машинка для набивки гильз',
        image: null
    },
    {
        id: 'machine-led',
        name: 'Машинка набивочная LED',
        category: 'machines',
        price: 3000,
        unit: 'штука',
        description: 'Машинка с LED подсветкой',
        image: null
    },
    {
        id: 'machine-injectormatic2-silver',
        name: 'Машинка набивочная Injectormatic 2 серебро',
        category: 'machines',
        price: 2500,
        unit: 'штука',
        description: 'Машинка для набивки в серебряном корпусе',
        image: null
    },

    // Китайский чай
    {
        id: 'tea-puer-2017',
        name: 'Шу Пуэра из Линьцанского сырья урожая 2017',
        category: 'tea',
        price: 1000,
        unit: 'штука',
        description: 'Выдержанный чай Пуэр урожая 2017 года',
        image: null
    },
    {
        id: 'tea-dahongpao',
        name: 'Чай Улун Да Хун Пао 100г (прессованный)',
        category: 'tea',
        price: 1800,
        unit: 'штука',
        description: 'Большой Красный Халат в 100 граммовой плитке',
        image: null
    },
    {
        id: 'tea-fujian',
        name: 'Чай Фуцзянь Хун Ча 500г',
        category: 'tea',
        price: 2300,
        unit: 'штука',
        description: 'Красный чай из Фуцзяня 500 грамм',
        image: null
    },
    {
        id: 'tea-puer-golden',
        name: 'Шу Пуэр Золотой павлин 2012г блин 357г',
        category: 'tea',
        price: 2200,
        unit: 'штука',
        description: 'Коллекционный Пуэр 2012 года',
        image: null
    },

    // Тампер
    {
        id: 'tamper-1',
        name: 'Тампер №1',
        category: 'tamper',
        price: 1500,
        unit: 'штука',
        description: 'Профессиональный тампер для трубки',
        image: null
    }
];