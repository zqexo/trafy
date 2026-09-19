/* ================================================================
   ТРАТЫ — app.js
   Stage 2: статический каркас с навигацией, мок-данными, реактивным рендером.
   Хранилище: in-memory объекты (заглушка IndexedDB).
   Навигация: URL hash → #, #list, #stats, #categories, #settings, #add, #edit, #login
   ================================================================ */

'use strict';

// Data-layer integration: если доступен, использовать его вместо моков
const DL = window.DL || null;
const DEBUG = console.debug;

/* ────────────────────────────────────────────────────────────────
   1. INITIAL STATE & MOCK DATA
   ──────────────────────────────────────────────────────────────── */

// Текущая сессия
const appState = {
  currentUser: null,      // { id, email, displayName, color }
  theme: 'auto',          // 'light' | 'dark' | 'auto'
  currency: '₽',
  syncEnabled: true,
  syncStatus: 'offline',  // 'online' | 'offline' | 'error'
};

// Заглушка пользователей (этап 2 — без Firebase)
const MOCK_USERS = [
  { id: 'user-1', email: 'maxim@trafy.app', displayName: 'Максим', color: '#6366f1', password: 'Максим123' },
  { id: 'user-2', email: 'margarita@trafy.app', displayName: 'Маргарита', color: '#ec4899', password: 'Маргарита123' },
];

// Заглушка категорий
const DEFAULT_CATEGORIES = [
  { id: 'cat-1', userId: '*',  name: 'Еда',           color: '#f59e0b', icon: '🍽', sortOrder: 1 },
  { id: 'cat-2', userId: '*',  name: 'Транспорт',     color: '#22c55e', icon: '🚗', sortOrder: 2 },
  { id: 'cat-3', userId: '*',  name: 'Развлечения',    color: '#ec4899', icon: '🎮', sortOrder: 3 },
  { id: 'cat-4', userId: '*',  name: 'Магазин',        color: '#3b82f6', icon: '🛒', sortOrder: 4 },
  { id: 'cat-5', userId: '*',  name: 'Кофе',          color: '#a855f7', icon: '☕', sortOrder: 5 },
  { id: 'cat-6', userId: '*',  name: 'Медицина',      color: '#ef4444', icon: '💊', sortOrder: 6 },
  { id: 'cat-7', userId: '*',  name: 'Дом',            color: '#14b8a6', icon: '🏠', sortOrder: 7 },
  { id: 'cat-8', userId: '*',  name: 'Путешествия',   color: '#06b6d4', icon: '✈️', sortOrder: 8 },
  { id: 'cat-9', userId: '*',  name: 'Работа',         color: '#64748b', icon: '💼', sortOrder: 9 },
  { id: 'cat-10', userId: '*', name: 'Подарки',        color: '#f97316', icon: '🎁', sortOrder: 10 },
];

// Текущие данные (в памяти, как заглушка IndexedDB)
let categories = [];
let expenses  = [];

// Демо-траты для полноты прототипа
const DEMO_EXPENSES = [
  { id: 'exp-1', userId: 'user-1', categoryId: 'cat-1', amount: 350,    description: 'Суши и кофе',        date: todayStr(-0), currency: '₽' },
  { id: 'exp-2', userId: 'user-1', categoryId: 'cat-5', amount: 120,    description: 'Латте в офисе',       date: todayStr(-0), currency: '₽' },
  { id: 'exp-3', userId: 'user-1', categoryId: 'cat-4', amount: 2500,   description: 'Продукты на неделю',   date: todayStr(-1), currency: '₽' },
  { id: 'exp-4', userId: 'user-1', categoryId: 'cat-2', amount: 500,    description: 'Бензин',               date: todayStr(-2), currency: '₽' },
  { id: 'exp-5', userId: 'user-1', categoryId: 'cat-3', amount: 890,    description: 'Netflix + игра',        date: todayStr(-3), currency: '₽' },
  { id: 'exp-6', userId: 'user-1', categoryId: 'cat-1', amount: 1850,   description: 'Ужин в ресторане',     date: todayStr(-4), currency: '₽' },
  { id: 'exp-7', userId: 'user-2', categoryId: 'cat-1', amount: 420,    description: 'Сытный завтрак',       date: todayStr(-0), currency: '₽' },
  { id: 'exp-8', userId: 'user-2', categoryId: 'cat-6', amount: 300,    description: 'Витамины',             date: todayStr(-1), currency: '₽' },
  { id: 'exp-9', userId: 'user-2', categoryId: 'cat-9', amount: 1500,   description: 'Проезд на работу',     date: todayStr(-2), currency: '₽' },
  { id: 'exp-10', userId: 'user-1', categoryId: 'cat-7', amount: 2100,  description: 'Свет и вода',          date: todayStr(-5), currency: '₽' },
];

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function initData() {
  categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
  expenses   = DEMO_EXPENSES.map(e => ({ ...e }));
}

/* ────────────────────────────────────────────────────────────────
   2. UTILITY HELPERS
   ──────────────────────────────────────────────────────────────── */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  children.forEach(c => {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatAmount(amount, currency) {
  const c = currency || appState.currency || '₽';
  const v = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  return `${sign}${abs.toFixed(0)} ${c}`;
}

function getCategoryById(id) {
  return categories.find(c => c.id === id);
}

function getCategoryIcon(cat) {
  return cat && cat.icon ? cat.icon : '📋';
}

function getCategoryColor(cat) {
  return cat && cat.color ? cat.color : '#6a6a80';
}

function getExpenseCategory(exp) {
  return getCategoryById(exp.categoryId);
}

function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function showScreen(screenId) {
  $$('.screen').forEach(s => s.hidden = true);
  const target = document.getElementById(screenId);
  if (target) target.hidden = false;
  // Обновляем заголовок
  const titles = {
    'screen-login':     'Вход',
    'screen-main':      'Траты',
    'screen-list':      'Список трат',
    'screen-form':      currentRoute === 'edit' ? 'Редактировать' : 'Добавить трату',
    'screen-stats':     'Статистика',
    'screen-categories':'Категории',
    'screen-settings':  'Настройки',
  };
  const titleEl = $('#header-title');
  if (titleEl) titleEl.textContent = titles[screenId] || 'Траты';
  // Кнопка назад
  updateBackButton(screenId);
}

function updateBackButton(screenId) {
  const backBtn = $('#btn-back');
  if (!backBtn) return;
  if (screenId === 'screen-login') {
    backBtn.disabled = true;
    backBtn.style.visibility = 'hidden';
  } else {
    backBtn.disabled = false;
    backBtn.style.visibility = 'visible';
  }
}

/* ────────────────────────────────────────────────────────────────
   3. THEME
   ──────────────────────────────────────────────────────────────── */

function applyTheme() {
  const html = document.documentElement;
  const icon  = $('#theme-icon');
  if (!icon) return;
  if (appState.theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
    icon.className  = 'ph ph-sun';
    icon.setAttribute('aria-label', 'Переключить на светлую тему');
  } else if (appState.theme === 'light') {
    html.setAttribute('data-theme', 'light');
    icon.className  = 'ph ph-moon';
    icon.setAttribute('aria-label', 'Переключить на тёмную тему');
  } else { // auto
    html.removeAttribute('data-theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    icon.className  = prefersLight ? 'ph ph-moon' : 'ph ph-sun';
    icon.setAttribute('aria-label',
      prefersLight ? 'Системная тема (светлая)' : 'Системная тема (тёмная)');
  }
  localStorage.setItem('trafy-theme', appState.theme);
}

function renderThemeOptions() {
  const container = $('#theme-options');
  if (!container) return;
  const options = [
    { value: 'light', label: 'Светлая' },
    { value: 'dark',  label: 'Тёмная' },
    { value: 'auto',  label: 'Система' },
  ];
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = el('button', {
      className: `theme-option${appState.theme === opt.value ? ' theme-option-active' : ''}`,
      'data-theme': opt.value,
      onClick: () => { appState.theme = opt.value; applyTheme(); renderThemeOptions(); },
    });
    const dot = el('span', { className: `theme-option-dot theme-${opt.value}` });
    const label = el('span', { className: 'theme-option-label' }, [opt.label]);
    btn.append(dot, label);
    container.appendChild(btn);
  });
}

/* ────────────────────────────────────────────────────────────────
   4. CATEGORIES RENDER
   ──────────────────────────────────────────────────────────────── */

function renderCategoryOptions(selectEl, selectedId = null) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const allOpt = el('option', { value: '' }, ['— Без категории —']);
  selectEl.appendChild(allOpt);
  [...categories].sort((a, b) => a.sortOrder - b.sortOrder).forEach(cat => {
    const opt = el('option', {
      value: cat.id,
      selected: cat.id === selectedId,
    }, [`${cat.icon || '📋'}  ${cat.name}`]);
    selectEl.appendChild(opt);
  });
}

function renderCategorySelects() {
  renderCategoryOptions($('#quick-category'), null);
  renderCategoryOptions($('#form-category'), null);
  renderCategoryOptions($('#filter-category'), 'all');
}

function renderCategoriesGrid() {
  const grid = $('#categories-grid');
  const empty = $('#categories-empty');
  if (!grid) return;
  grid.innerHTML = '';
  if (categories.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  categories.sort((a, b) => a.sortOrder - b.sortOrder).forEach(cat => {
    const card = el('div', {
      className: 'category-card',
      onClick: () => selectCategoryForQuickAdd(cat.id),
    });
    const iconCircle = el('div', {
      className: 'category-card-icon',
      style: { background: `${cat.color}22`, color: cat.color },
    }, [cat.icon || '📋']);
    const nameEl = el('div', { className: 'category-card-name' }, [cat.name]);
    const metaEl = el('div', { className: 'category-card-meta' },
      [`${expenses.filter(e => e.categoryId === cat.id).length} записей`]);
    const actions = el('div', { className: 'category-card-actions' });
    const editBtn = el('button', {
      className: 'btn-icon-sm',
      id: 'cat-edit-btn',
      'aria-label': `Редактировать ${cat.name}`,
      title: 'Редактировать',
      onClick: (e) => { e.stopPropagation(); openCategoryModal(cat.id); },
    }, [el('i', { className: 'ph ph-pencil-simple' })]);
    const delBtn = el('button', {
      className: 'btn-icon-sm',
      id: 'cat-delete-btn',
      'aria-label': `Удалить ${cat.name}`,
      title: 'Удалить',
      onClick: (e) => { e.stopPropagation(); confirmDeleteCategory(cat.id); },
    }, [el('i', { className: 'ph ph-trash' })]);
    actions.append(editBtn, delBtn);
    card.append(iconCircle, nameEl, metaEl, actions);
    grid.appendChild(card);
  });
}

function selectCategoryForQuickAdd(categoryId) {
  const select = $('#quick-category');
  if (select) { select.value = categoryId; select.dispatchEvent(new Event('change')); }
}

/* ────────────────────────────────────────────────────────────────
   5. EXPENSE ITEM RENDER
   ──────────────────────────────────────────────────────────────── */

function renderExpenseItem(exp, options = {}) {
  const cat   = getExpenseCategory(exp);
  const icon  = getCategoryIcon(cat);
  const color = getCategoryColor(cat);
  const date  = formatDate(exp.date);
  const amountStr = formatAmount(exp.amount, exp.currency);

  const item = el('div', {
    className: 'expense-item',
    onClick: () => navigateTo(`#edit/${exp.id}`),
    role: 'button',
    'tabindex': '0',
    'aria-label': `${cat ? cat.name : 'Без категории'} — ${amountStr}`,
    onKeydown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo(`#edit/${exp.id}`);
      }
    },
  });

  const iconWrap = el('div', {
    className: 'expense-item-icon',
    style: { background: `${color}22`, color },
  }, [icon]);

  const info = el('div', { className: 'expense-item-info' });
  const nameEl = el('div', { className: 'expense-item-name' },
    [exp.description || (cat ? cat.name : 'Без категории')]);
  const metaEl = el('div', { className: 'expense-item-meta' },
    [date, cat ? `${cat.icon || ''} ${cat.name}` : 'Без категории']);
  info.append(nameEl, metaEl);

  const amountEl = el('div', {
    className: 'expense-item-amount',
    style: { color: exp.amount < 0 ? 'var(--color-danger)' : 'var(--color-success)' },
  }, [amountStr]);

  const actions = el('div', { className: 'expense-item-actions' });
  const editBtn = el('button', {
    className: 'btn-icon-sm',
    'aria-label': 'Редактировать',
    onClick: (e) => { e.stopPropagation(); navigateTo(`#edit/${exp.id}`); },
  }, [el('i', { className: 'ph ph-pencil-simple' })]);
  const delBtn = el('button', {
    className: 'btn-icon-sm',
    'aria-label': 'Удалить',
    onClick: (e) => { e.stopPropagation(); openDeleteModal(exp.id); },
  }, [el('i', { className: 'ph ph-trash' })]);
  actions.append(editBtn, delBtn);

  item.append(iconWrap, info, amountEl, actions);
  return item;
}

function renderExpenseList(container, list, showActions = true) {
  if (!container) return;
  container.innerHTML = '';
  if (list.length === 0) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  list.forEach(exp => {
    const item = renderExpenseItem(exp);
    container.appendChild(item);
  });
}

/* ────────────────────────────────────────────────────────────────
   6. MAIN SCREEN RENDER
   ──────────────────────────────────────────────────────────────── */

function getFilteredExpenses(userFilter = 'all') {
  if (!appState.currentUser) return [...expenses];
  if (userFilter === 'all') return [...expenses];
  return expenses.filter(e => e.userId === userFilter);
}

function renderMainScreen() {
  if (!appState.currentUser) { navigateTo('#login'); return; }

  const today = todayStr(0);
  const weekAgo = todayStr(-7);
  const monthAgo = todayStr(-30);

  const myExpenses = expenses.filter(e => e.userId === appState.currentUser.id);
  const todayExp  = myExpenses.filter(e => e.date === today);
  const weekExp   = myExpenses.filter(e => e.date >= weekAgo);
  const monthExp  = myExpenses.filter(e => e.date >= monthAgo);

  const sumToday = todayExp.reduce((s, e) => s + e.amount, 0);
  const sumWeek  = weekExp.reduce((s, e) => s + e.amount, 0);
  const sumMonth = monthExp.reduce((s, e) => s + e.amount, 0);

  const setStat = (id, value, subId, subText) => {
    const el_ = $('#' + id);
    if (el_) el_.textContent = Math.abs(value) > 0 ? formatAmount(value, appState.currency) : '—';
    if (subId) {
      const sub = $('#' + subId);
      if (sub) sub.textContent = subText || '';
    }
  };

  setStat('stat-today',  sumToday,  'stat-today-sub', todayExp.length + ' записей');
  setStat('stat-week',   sumWeek,   null, null);
  setStat('stat-month',  sumMonth,  null, null);

  // Поле даты = сегодня
  const dateInput = $('#quick-date');
  if (dateInput) dateInput.value = today;

  // Недавние (10 последних)
  const recentList = myExpenses
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 10);

  const recentEl = $('#recent-list');
  const emptyEl  = $('#recent-empty');

  if (recentList.length === 0) {
    if (recentEl) recentEl.hidden = true;
    if (emptyEl)  emptyEl.hidden  = false;
    const totalEl = $('#recent-total');
    if (totalEl) totalEl.textContent = '—';
  } else {
    if (recentEl) recentEl.hidden = false;
    if (emptyEl)  emptyEl.hidden  = true;
    recentEl.innerHTML = '';
    recentList.forEach(exp => {
      recentEl.appendChild(renderExpenseItem(exp));
    });
    const total = recentList.reduce((s, e) => s + e.amount, 0);
    const totalEl = $('#recent-total');
    if (totalEl) totalEl.textContent = formatAmount(total, appState.currency);
  }
}

/* ────────────────────────────────────────────────────────────────
   7. EXPENSES LIST SCREEN RENDER
   ──────────────────────────────────────────────────────────────── */

let activeFilters = {
  period: 'all',
  user: 'all',
  category: 'all',
};

function renderListScreen() {
  const list = getListExpenses();
  const container = $('#list-full-list');
  const empty = $('#list-empty');
  const emptySub = $('#list-empty-sub');
  const totalEl = $('#list-total');
  const countEl = $('#list-count');

  // Удаляем старые элементы (храним в data attr)
  if (container && container.dataset.rendered) {
    container.querySelectorAll('.expense-item').forEach(el => el.remove());
    container.dataset.rendered = 'false';
  }

  if (!container) { return; }

  container.innerHTML = '';
  if (list.length === 0) {
    container.hidden = true;
    if (empty) empty.hidden = false;
    if (emptySub) emptySub.textContent =
      activeFilters.period !== 'all' || activeFilters.user !== 'all' || activeFilters.category !== 'all'
        ? 'Ничего не найдено по выбранным фильтрам'
        : 'Пока нет трат — добавьте первую!';
    if (totalEl) totalEl.textContent = '—';
    if (countEl) countEl.textContent = '0 записей';
    return;
  }

  container.hidden = false;
  container.dataset.rendered = 'true';
  list.forEach(exp => {
    container.appendChild(renderExpenseItem(exp));
  });

  const total = list.reduce((s, e) => s + e.amount, 0);
  if (totalEl) totalEl.textContent = formatAmount(total, appState.currency);
  if (countEl) countEl.textContent = `${list.length} ${list.length === 1 ? 'запись' : list.length < 5 ? 'записи' : 'записей'}`;
}

function getListExpenses() {
  const myExpenses = appState.currentUser
    ? expenses.filter(e => e.userId === appState.currentUser.id)
    : [...expenses];

  let list = [...myExpenses];

  // Фильтр по периоду
  const today = todayStr(0);
  if (activeFilters.period === 'today') {
    list = list.filter(e => e.date === today);
  } else if (activeFilters.period === 'week') {
    const d7 = todayStr(-7);
    list = list.filter(e => e.date >= d7);
  } else if (activeFilters.period === 'month') {
    const d30 = todayStr(-30);
    list = list.filter(e => e.date >= d30);
  }

  // Фильтр по пользователю
  if (activeFilters.user !== 'all') {
    list = list.filter(e => e.userId === activeFilters.user);
  }

  // Фильтр по категории
  if (activeFilters.category !== 'all') {
    list = list.filter(e => e.categoryId === activeFilters.category);
  }

  return list.sort((a, b) =>
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  );
}

/* ────────────────────────────────────────────────────────────────
   8. FORM SCREEN (ADD / EDIT)
   ──────────────────────────────────────────────────────────────── */

let editingExpenseId = null;

function openFormScreen(expenseId = null) {
  editingExpenseId = expenseId;
  const screen = $('#screen-form');
  if (!screen) return;

  const titleEl  = $('#form-title');
  const badgeEl  = $('#form-type-badge');
  const saveIcon = $('#form-save-icon');
  const saveText = $('#form-save-text');
  const idInput  = $('#form-id');
  const amountEl = $('#form-amount');
  const catEl    = $('#form-category');
  const descEl   = $('#form-description');
  const dateEl   = $('#form-date');
  const errorEl  = $('#form-error');

  errorEl.classList.add('hidden');
  errorEl.textContent = '';

  const today = todayStr(0);

  if (expenseId) {
    // Режим редактирования
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) { navigateTo('#list'); return; }
    titleEl.textContent = 'Редактировать трату';
    badgeEl.textContent = 'Редактирование';
    badgeEl.style.display = 'inline';
    saveIcon.className = 'ph ph-pencil-simple';
    saveText.textContent = 'Сохранить';
    idInput.value = exp.id;
    amountEl.value = exp.amount;
    catEl.value = exp.categoryId || '';
    descEl.value = exp.description || '';
    dateEl.value = exp.date;
  } else {
    // Режим добавления
    titleEl.textContent = 'Добавить трату';
    badgeEl.style.display = 'none';
    saveIcon.className = 'ph ph-plus';
    saveText.textContent = 'Добавить';
    idInput.value = '';
    amountEl.value = '';
    catEl.value = categories.length > 0 ? categories[0].id : '';
    descEl.value = '';
    dateEl.value = today;
  }

  // Счётчик символов
  const countEl = $('#form-char-count');
  if (descEl) {
    descEl.oninput = () => {
      if (countEl) countEl.textContent = `${descEl.value.length}/200`;
    };
    if (countEl) countEl.textContent = `${descEl.value.length}/200`;
  }

  screen.hidden = false;
  focusFirstInput(screen);
}

function focusFirstInput(screen) {
  const firstInput = screen.querySelector('input:not([type=hidden]):not([type=date]), textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function submitExpenseForm(e) {
  e.preventDefault();
  const errorEl = $('#form-error');
  const amountEl = $('#form-amount');
  const catEl    = $('#form-category');
  const descEl   = $('#form-description');
  const dateEl   = $('#form-date');
  const idInput  = $('#form-id');
  const saveBtn  = $('#btn-form-save');
  const amountHint = $('#form-amount-hint');

  // Валидация
  const amountRaw = amountEl.value.trim();
  const amount = parseFloat(amountRaw);
  if (!amount || amount <= 0) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Введите сумму больше нуля';
    amountEl.focus();
    return;
  }
  if (!catEl.value) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Выберите категорию';
    catEl.focus();
    return;
  }
  if (!dateEl.value) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Выберите дату';
    dateEl.focus();
    return;
  }

  errorEl.classList.add('hidden');

  // Показать загрузку
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="ph ph-spinner-gap-filled" aria-hidden="true"></i> Сохранение…';

  const expenseData = {
    id:         idInput.value || generateId(),
    userId:     appState.currentUser ? appState.currentUser.id : 'user-1',
    categoryId: catEl.value,
    amount:     amount,
    description: descEl.value.trim() || '',
    date:       dateEl.value,
    currency:   appState.currency,
    updatedAt:  new Date().toISOString(),
  };

  // Использовать data-layer если доступен
  if (window.__dlHelpers) {
    const dlOp = idInput.value
      ? window.__dlHelpers.updateExpense(idInput.value, expenseData)
      : window.__dlHelpers.addExpense(expenseData);

    dlOp.then(result => {
      // Обновляем локальный массив для рендеринга
      if (idInput.value) {
        const idx = expenses.findIndex(e => e.id === idInput.value);
        if (idx >= 0) expenses[idx] = result;
      } else {
        expenses.push(result);
      }
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ph ph-plus" aria-hidden="true"></i><span id="form-save-text">Добавить</span>';
      showToast(idInput.value ? 'Трата обновлена ✏️' : 'Трата добавлена ✅');
      setTimeout(() => {
        if (editingExpenseId) navigateTo('#list');
        else navigateTo('#main');
        renderAll();
      }, 400);
    }).catch(err => {
      console.warn('[app.js] DL error:', err);
      // Фоллбэк: локальная операция
      if (idInput.value) {
        const idx = expenses.findIndex(e => e.id === idInput.value);
        if (idx >= 0) expenses[idx] = { ...expenses[idx], ...expenseData, createdAt: expenses[idx].createdAt };
        showToast('Трата обновлена ✏️');
      } else {
        expenseData.createdAt = new Date().toISOString();
        expenses.push(expenseData);
        showToast('Трата добавлена ✅');
      }
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ph ph-plus" aria-hidden="true"></i><span id="form-save-text">Добавить</span>';
      setTimeout(() => {
        if (editingExpenseId) navigateTo('#list');
        else navigateTo('#main');
        renderAll();
      }, 400);
    });
    return;
  }

  if (idInput.value) {
    // Редактирование
    const idx = expenses.findIndex(e => e.id === idInput.value);
    if (idx >= 0) {
      expenses[idx] = { ...expenses[idx], ...expenseData, createdAt: expenses[idx].createdAt };
    }
    showToast('Трата обновлена ✏️');
  } else {
    // Добавление
    expenseData.createdAt = new Date().toISOString();
    expenses.push(expenseData);
    showToast('Трата добавлена ✅');
  }

  // Очистка и возврат
  setTimeout(() => {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="ph ph-plus" aria-hidden="true"></i><span id="form-save-text">Добавить</span>';

    if (editingExpenseId) {
      // Редактировали — вернуться в список
      navigateTo('#list');
    } else {
      // Добавляли — обновить главный экран
      navigateTo('#main');
    }
    renderAll();
  }, 400);
}

/* ────────────────────────────────────────────────────────────────
   9. DELETE MODAL
   ──────────────────────────────────────────────────────────────── */

let deleteExpenseId = null;

function openDeleteModal(expenseId) {
  deleteExpenseId = expenseId;
  const overlay = $('#modal-delete');
  const desc    = $('#delete-modal-desc');
  const preview = $('#delete-preview');
  const error   = $('#delete-error');

  if (!overlay) return;
  error.classList.add('hidden');
  error.textContent = '';

  const exp = expenses.find(e => e.id === expenseId);
  if (!exp) { closeModal('modal-delete'); return; }

  const cat = getExpenseCategory(exp);
  preview.innerHTML = '';
  preview.appendChild(renderExpenseItem(exp));
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const titleEl = $('#delete-modal-title');
  if (titleEl) titleEl.textContent = 'Удалить трату?';
}

function confirmDelete() {
  if (!deleteExpenseId) return;
  const exp = expenses.find(e => e.id === deleteExpenseId);
  if (!exp) return;

  // Использовать data-layer если доступен
  if (window.__dlHelpers) {
    window.__dlHelpers.deleteExpense(deleteExpenseId).then(() => {
      const idx = expenses.findIndex(e => e.id === deleteExpenseId);
      if (idx >= 0) expenses.splice(idx, 1);
      showToast(`\"${exp.description || 'Трата'}\" удалена 🗑`);
      deleteExpenseId = null;
      closeModal('modal-delete');
      renderAll();
    }).catch(err => {
      console.warn('[app.js] DL deleteExpense error:', err);
      const idx = expenses.findIndex(e => e.id === deleteExpenseId);
      if (idx >= 0) expenses.splice(idx, 1);
      showToast(`\"${exp.description || 'Трата'}\" удалена 🗑`);
      deleteExpenseId = null;
      closeModal('modal-delete');
      renderAll();
    });
    return;
  }

  const idx = expenses.findIndex(e => e.id === deleteExpenseId);
  if (idx >= 0) {
    const exp = expenses[idx];
    expenses.splice(idx, 1);
    showToast(`"${exp.description || 'Трата'}" удалена 🗑`);
  }
  deleteExpenseId = null;
  closeModal('modal-delete');
  renderAll();
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ────────────────────────────────────────────────────────────────
   10. CATEGORY MODAL (ADD / EDIT)
   ──────────────────────────────────────────────────────────────── */

let editingCategoryId = null;

function openCategoryModal(categoryId = null) {
  editingCategoryId = categoryId;
  const overlay   = $('#modal-category');
  const titleEl   = $('#category-modal-title');
  const nameInput = $('#cat-name-input');
  const colorInput= $('#cat-color-input');
  const iconInput = $('#cat-icon-input');
  const errorEl   = $('#cat-modal-error');
  const saveBtn   = $('#cat-modal-save');
  const closeBtn  = $('#category-modal-close');

  if (!overlay) return;
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
  saveBtn.disabled = false;

  if (categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) { closeModal('modal-category'); return; }
    titleEl.textContent = 'Редактировать категорию';
    nameInput.value = cat.name;
    colorInput.value = cat.color;
    iconInput.value = cat.icon || '';
    // highlight preset
    $$('.color-preset').forEach(p => {
      p.classList.toggle('color-preset-selected', p.dataset.color === cat.color);
    });
  } else {
    titleEl.textContent = 'Новая категория';
    nameInput.value = '';
    colorInput.value = '#3B82F6';
    iconInput.value = '📋';
    $$('.color-preset').forEach(p => p.classList.remove('color-preset-selected'));
  }

  // Сброс выделения пресетов при изменении
  colorInput.oninput = () => {
    $$('.color-preset').forEach(p => {
      p.classList.toggle('color-preset-selected', p.dataset.color === colorInput.value);
    });
  };

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => nameInput.focus(), 100);
}

function renderColorPresets() {
  const presets = [
    '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
    '#22C55E', '#14B8A6', '#06B6D4', '#64748B', '#F97316',
  ];
  const container = $('#color-presets');
  if (!container) return;
  container.innerHTML = '';
  presets.forEach(c => {
    const dot = el('div', {
      className: 'color-preset' + (c === $('#cat-color-input')?.value ? ' color-preset-selected' : ''),
      style: { background: c, 'data-color': c },
      onClick: () => {
        const inp = $('#cat-color-input');
        if (inp) { inp.value = c; inp.dispatchEvent(new Event('input')); }
      },
    });
    container.appendChild(dot);
  });
}

function saveCategoryModal() {
  const nameInput = $('#cat-name-input');
  const colorInput= $('#cat-color-input');
  const iconInput = $('#cat-icon-input');
  const errorEl   = $('#cat-modal-error');

  const name = nameInput.value.trim();
  if (!name) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Введите название категории';
    nameInput.focus();
    return;
  }
  if (name.length > 40) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Название не более 40 символов';
    return;
  }

  errorEl.classList.add('hidden');

  if (editingCategoryId) {
    const cat = categories.find(c => c.id === editingCategoryId);
    if (!cat) return;

    // Использовать data-layer если доступен
    if (window.__dlHelpers) {
      window.__dlHelpers.updateCategory(editingCategoryId, {
        name, color: colorInput.value, icon: iconInput.value || '📋',
      }).then(result => {
        const idx = categories.findIndex(c => c.id === editingCategoryId);
        if (idx >= 0) categories[idx] = result;
        showToast('Категория обновлена ✏️');
        closeModal('modal-category');
        editingCategoryId = null;
        renderAll();
      }).catch(err => {
        console.warn('[app.js] DL updateCategory error:', err);
        cat.name  = name;
        cat.color = colorInput.value;
        cat.icon  = iconInput.value;
        showToast('Категория обновлена ✏️');
        closeModal('modal-category');
        editingCategoryId = null;
        renderAll();
      });
      return;
    }

    cat.name  = name;
    cat.color = colorInput.value;
    cat.icon  = iconInput.value;
    showToast('Категория обновлена ✏️');
  } else {
    // Использовать data-layer если доступен
    if (window.__dlHelpers) {
      window.__dlHelpers.addCategory({
        name,
        color: colorInput.value,
        icon: iconInput.value || '📋',
      }).then(result => {
        categories.push(result);
        showToast('Категория создана 🆕');
        closeModal('modal-category');
        editingCategoryId = null;
        renderAll();
      }).catch(err => {
        console.warn('[app.js] DL addCategory error:', err);
        categories.push({
          id:        generateId(),
          userId:    '*',
          name:      name,
          color:     colorInput.value,
          icon:      iconInput.value || '📋',
          sortOrder: categories.length + 1,
          createdAt: new Date().toISOString(),
        });
        showToast('Категория создана 🆕');
        closeModal('modal-category');
        editingCategoryId = null;
        renderAll();
      });
      return;
    }

    categories.push({
      id:        generateId(),
      userId:    '*',
      name:      name,
      color:     colorInput.value,
      icon:      iconInput.value || '📋',
      sortOrder: categories.length + 1,
      createdAt: new Date().toISOString(),
    });
    showToast('Категория создана 🆕');
  }

  closeModal('modal-category');
  editingCategoryId = null;
  renderAll();
}

function confirmDeleteCategory(categoryId) {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return;
  const overlay = $('#modal-category');
  if (!overlay) return;
  const titleEl = $('#category-modal-title');
  const nameInput = $('#cat-name-input');
  const colorInput= $('#cat-color-input');
  const iconInput = $('#cat-icon-input');
  const errorEl   = $('#cat-modal-error');

  titleEl.textContent = 'Удалить категорию?';
  nameInput.value = cat.name;
  colorInput.value = cat.color;
  iconInput.value = cat.icon || '';
  errorEl.textContent = `Категория "${cat.name}" будет удалена. Траты без категории останутся.`;
  errorEl.classList.remove('hidden');
  errorEl.style.color = 'var(--color-warning)';
  errorEl.style.background = 'var(--color-warning-bg)';

  // Показать модалку (как в openCategoryModal)
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Заменяем кнопку сохранения на кнопку удаления
  const saveBtn = $('#cat-modal-save');
  saveBtn.textContent = 'Удалить';
  saveBtn.className = 'btn btn-danger';
  saveBtn.onclick = () => {
    // Использовать data-layer если доступен
    if (window.__dlHelpers) {
      window.__dlHelpers.deleteCategory(categoryId).then(() => {
        const idx = categories.findIndex(c => c.id === categoryId);
        if (idx >= 0) categories.splice(idx, 1);
        errorEl.classList.add('hidden');
        closeModal('modal-category');
        showToast(`Категория "${cat.name}" удалена 🗑`);
        renderAll();
      }).catch(err => {
        console.warn('[app.js] DL deleteCategory error:', err);
        const idx = categories.findIndex(c => c.id === categoryId);
        if (idx >= 0) categories.splice(idx, 1);
        errorEl.classList.add('hidden');
        closeModal('modal-category');
        showToast(`Категория "${cat.name}" удалена 🗑`);
        renderAll();
      });
      return;
    }

    const idx = categories.findIndex(c => c.id === categoryId);
    if (idx >= 0) categories.splice(idx, 1);
    errorEl.classList.add('hidden');
    closeModal('modal-category');
    showToast(`Категория "${cat.name}" удалена 🗑`);
    renderAll();
  };
  const cancelBtn = $('#cat-modal-cancel');
  cancelBtn.onclick = () => {
    // Возвращаем кнопки в исходное состояние
    errorEl.classList.add('hidden');
    errorEl.style.color = '';
    errorEl.style.background = '';
    closeModal('modal-category');
  };
}

/* ────────────────────────────────────────────────────────────────
   11. STATS SCREEN
   ──────────────────────────────────────────────────────────────── */

function renderStatsScreen() {
  if (!appState.currentUser) { navigateTo('#login'); return; }

  const uid = appState.currentUser.id;
  const myExp = expenses.filter(e => e.userId === uid);

  const today   = todayStr(0);
  const d7      = todayStr(-7);
  const d30     = todayStr(-30);

  const sum = (list) => list.reduce((s, e) => s + e.amount, 0);

  $('#stats-today').textContent  = formatAmount(sum(myExp.filter(e => e.date === today)),   appState.currency);
  $('#stats-week').textContent   = formatAmount(sum(myExp.filter(e => e.date >= d7)),        appState.currency);
  $('#stats-month').textContent  = formatAmount(sum(myExp.filter(e => e.date >= d30)),       appState.currency);
  $('#stats-all').textContent    = formatAmount(sum(myExp), appState.currency);

  // По категориям
  renderCategoryStats(myExp);

  // Тренд
  renderTrendChart(myExp);

  // Топ
  renderTopExpenses(myExp);
}

function renderCategoryStats(myExp) {
  const wrap          = $('#chart-doughnut-wrap');
  const canvas        = $('#chart-categories');
  const breakdown     = $('#category-breakdown');
  const empty         = $('#stats-cat-empty');

  if (!wrap || !canvas) return;

  // Деструктурируем canvas — скрываем Chart.js-контейнер если нет данных
  if (myExp.length === 0) {
    wrap.innerHTML = '';
    wrap.appendChild(empty);
    empty.hidden = false;
    if (breakdown) breakdown.innerHTML = '';
    return;
  }
  empty.hidden = true;

  // Считаем суммы по категориям
  const catSums = {};
  myExp.forEach(e => {
    const cat = getCategoryById(e.categoryId);
    const key = cat ? cat.id : 'uncategorized';
    catSums[key] = (catSums[key] || 0) + Math.abs(e.amount);
  });

  const labels  = [];
  const data    = [];
  const colors  = [];
  const catIds  = Object.keys(catSums).sort((a, b) => catSums[b] - catSums[a]);

  catIds.forEach(catId => {
    const cat = categories.find(c => c.id === catId);
    const label = cat
      ? `${cat.icon || ''} ${cat.name}`
      : 'Без категории';
    labels.push(label);
    data.push(catSums[catId]);
    colors.push(cat ? cat.color : '#6a6a80');
  });

  const total = data.reduce((s, v) => s + v, 0);

  // Удаляем старый инстанс чарта если есть
  if (window.__chartCategories) {
    window.__chartCategories.destroy();
    window.__chartCategories = null;
  }

  // Скрываем пустой state, показываем canvas
  wrap.innerHTML = '';
  wrap.appendChild(canvas);
  empty.hidden = true;

  // Добавляем fallback-текст если Chart.js не загрузился
  if (typeof Chart === 'undefined') {
    const fallback = document.createElement('div');
    fallback.className = 'empty-state small';
    fallback.innerHTML = '<p class="empty-sub">Chart.js не загружен</p>';
    wrap.appendChild(fallback);
    return;
  }

  const ctx = canvas.getContext('2d');
  window.__chartCategories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'var(--color-bg)',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatAmount(ctx.raw, appState.currency)} (${pct}%)`;
            },
          },
          backgroundColor: 'var(--color-surface)',
          titleColor: 'var(--color-text)',
          bodyColor: 'var(--color-text-2)',
          borderColor: 'var(--color-border)',
          borderWidth: 1,
          cornerRadius: 8,
        },
      },
    },
  });

  // Breakdown-список ниже графика
  if (breakdown) {
    breakdown.innerHTML = '';
    catIds.forEach((catId) => {
      const cat   = categories.find(c => c.id === catId);
      const sumVal = catSums[catId];
      const pct   = ((sumVal / total) * 100).toFixed(1);
      const row = el('div', { className: 'cat-breakdown-row' });
      row.appendChild(el('div', {
        className: 'cat-breakdown-dot',
        style: { background: cat ? cat.color : 'var(--color-text-muted)' },
      }));
      row.appendChild(el('div', {
        className: 'cat-breakdown-name',
        style: { color: cat ? cat.color : 'var(--color-text-muted)' },
      }, [cat ? (cat.icon + ' ' + cat.name) : 'Без категории']));
      row.appendChild(el('div', { className: 'cat-breakdown-bar' }, [
        el('div', {
          className: 'cat-breakdown-fill',
          style: { width: pct + '%', background: cat ? cat.color : 'var(--color-text-muted)' },
        })
      ]));
      row.appendChild(el('div', { className: 'cat-breakdown-value' }, [
        formatAmount(sumVal, appState.currency)
      ]));
      breakdown.appendChild(row);
    });
  }
}

function renderTrendChart(myExp) {
  const wrap    = $('#chart-bar-wrap');
  const canvas  = $('#chart-trend');
  const legend  = $('#trend-legend');
  const empty   = $('#stats-trend-empty');

  if (!wrap || !canvas) return;

  const statPeriod = document.querySelector('.pill-active')?.dataset.statPeriod || '7d';
  const days = statPeriod === '7d' ? 7 : statPeriod === '14d' ? 14 : 30;

  // Собираем данные по дням
  const daily = {};
  const dayLabels = [];
  for (let i = days - 1; i >= 0; i--) {
    const dStr = todayStr(-i);
    const label = new Date(dStr + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short' });
    daily[dStr] = 0;
    dayLabels.push(label);
  }

  myExp.forEach(e => {
    if (daily[e.date] != null) {
      daily[e.date] += Math.abs(e.amount);
    }
  });

  const values = Object.values(daily);
  const maxVal = Math.max(...values, 1);

  if (values.every(v => v === 0)) {
    wrap.innerHTML = '';
    wrap.appendChild(empty);
    empty.hidden = false;
    if (legend) legend.innerHTML = '';
    return;
  }
  empty.hidden = true;

  // Уничтожаем предыдущий инстанс
  if (window.__chartTrend) {
    window.__chartTrend.destroy();
    window.__chartTrend = null;
  }

  wrap.innerHTML = '';
  wrap.appendChild(canvas);
  empty.hidden = true;

  // Fallback если Chart.js не загружен
  if (typeof Chart === 'undefined') {
    wrap.appendChild(el('div', { className: 'empty-state small' }, [
      el('p', { className: 'empty-sub' }, ['Chart.js не загружен'])
    ]));
    return;
  }

  const ctx = canvas.getContext('2d');
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4'];

  window.__chartTrend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, values.length).map(c => c + 'CC'),
        borderColor: colors.slice(0, values.length),
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatAmount(ctx.raw, appState.currency),
          },
          backgroundColor: 'var(--color-surface)',
          titleColor: 'var(--color-text)',
          bodyColor: 'var(--color-text-2)',
          borderColor: 'var(--color-border)',
          borderWidth: 1,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'var(--color-text-muted)',
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'var(--color-border)' },
          ticks: {
            color: 'var(--color-text-muted)',
            font: { size: 10 },
            callback: (v) => v > 0 ? formatAmount(v, appState.currency) : '',
          },
        },
      },
    },
  });

  // Легенда — дни недели
  if (legend) {
    legend.innerHTML = '';
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const shownDays = statPeriod === '7d' ? 7 : statPeriod === '14d' ? 14 : 30;
    for (let i = 0; i < Math.min(shownDays, 7); i++) {
      const item = el('div', { className: 'trend-legend-item' });
      item.appendChild(el('div', {
        className: 'trend-legend-dot',
        style: { background: colors[i % colors.length] },
      }));
      item.appendChild(el('span', {}, [daysOfWeek[i]]));
      legend.appendChild(item);
    }
    if (statPeriod !== '7d') {
      legend.appendChild(el('span', {
        style: { color: 'var(--color-text-muted)' },
      }, ['…']));
    }
  }
}

function renderTopExpenses(myExp) {
  const container = $('#top-expenses');
  const empty     = $('#stats-top-empty');

  if (!container) return;

  const todayExp = myExp.filter(e => e.date === todayStr(0));
  const top5 = [...todayExp]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  if (top5.length === 0) {
    container.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  container.innerHTML = '';
  top5.forEach((exp, idx) => {
    const cat = getExpenseCategory(exp);
    const color = getCategoryColor(cat);
    const item = el('div', { className: 'top-exp-item' });
    item.appendChild(el('div', {
      className: 'top-exp-rank',
      style: idx === 0 ? { color: 'var(--color-warning)' } : {},
    }, [String(idx + 1).padStart(2, ' ')]));
    item.appendChild(el('div', { className: 'top-exp-info' }, [
      el('div', { className: 'top-exp-name' }, [`${cat ? cat.icon + ' ' : ''}${exp.description || cat ? cat.name : 'Без категории'}`]),
      el('div', { className: 'top-exp-meta' }, [formatDate(exp.date), cat ? `· ${cat.name}` : '']),
    ]));
    item.appendChild(el('div', {
      className: 'top-exp-amount',
      style: { color: 'var(--color-danger)', fontWeight: '700' },
    }, [formatAmount(exp.amount, appState.currency)]));
    container.appendChild(item);
  });
}

/* ────────────────────────────────────────────────────────────────
   12. SETTINGS SCREEN
   ──────────────────────────────────────────────────────────────── */

function renderSettingsScreen() {
  const user = appState.currentUser;
  if (!user) { navigateTo('#login'); return; }

  const avatar   = $('#settings-avatar');
  const nameEl   = $('#settings-display-name');
  const emailEl  = $('#settings-email');
  const nameInput= $('#settings-name-input');

  if (avatar) {
    avatar.textContent = user.displayName.charAt(0).toUpperCase();
    avatar.style.background = user.color;
  }
  if (nameEl)  nameEl.textContent = user.displayName || user.email;
  if (emailEl) emailEl.textContent = user.email;
  if (nameInput) nameInput.value = user.displayName || '';

  // Валюта
  const currencySel = $('#settings-currency');
  if (currencySel) {
    const curOptions = ['₽', '$', '€', '₸', '₴'];
    currencySel.innerHTML = '';
    curOptions.forEach(c => {
      const opt = el('option', { value: c }, [
        c === '₽' ? '₽ Рубль (RUB)' :
        c === '$' ? '$ Доллар (USD)' :
        c === '€' ? '€ Евро (EUR)' :
        c === '₸' ? '₸ Тенге (KZT)' :
        c === '₴' ? '₴ Гривна (UAH)' : c
      ]);
      if (c === appState.currency) opt.selected = true;
      currencySel.appendChild(opt);
    });
    currencySel.value = appState.currency;
  }

  renderThemeOptions();

  // Синхронизация статус
  updateSyncUI();
}

function updateSyncUI() {
  const dot   = $('#sync-dot');
  const text  = $('#sync-text');
  const last  = $('#sync-last');
  const toggle= $('#btn-sync-toggle');

  if (!dot || !text) return;

  const status = appState.syncStatus;
  dot.className = 'sync-status-dot' +
    (status === 'online' ? ' sync-online' :
     status === 'offline' ? ' sync-offline' : '');
  text.textContent = status === 'online' ? 'В синхронизации' :
                     status === 'offline' ? 'Не в сети' : 'Ошибка синхронизации';
  last.textContent = status === 'online'
    ? new Date().toLocaleTimeString('ru-RU')
    : '—';

  if (toggle) {
    toggle.textContent = appState.syncEnabled ? 'Отключить' : 'Включить';
    toggle.className = 'btn btn-ghost btn-sm' + (appState.syncEnabled ? '' : ' sync-disabled');
    toggle.onclick = () => {
      appState.syncEnabled = !appState.syncEnabled;
      if (appState.syncEnabled) {
        appState.syncStatus = 'online';
        showToast('Синхронизация включена 🔄');
      } else {
        appState.syncStatus = 'offline';
        showToast('Синхронизация отключена ⏸');
      }
      updateSyncUI();
    };
  }
}

/* ────────────────────────────────────────────────────────────────
   13. LOGIN SCREEN
   ──────────────────────────────────────────────────────────────── */

function renderLoginScreen() {
  const userList = $("#user-list");
  if (!userList) return;
  userList.innerHTML = "";

  MOCK_USERS.forEach(user => {
    const card = el("div", {
      className: "user-list-card",
      role: "option",
      "aria-selected": false,
      "data-userId": user.id,
      onClick: () => selectUser(user.id),
      onKeydown: (e) => { if (e.key === "Enter") selectUser(user.id); },
    });

    const avatar = el("div", {
      className: "user-list-avatar",
      style: { background: user.color },
    }, [user.displayName.charAt(0).toUpperCase()]);

    const info = el("div", { className: "user-list-info" });
    info.appendChild(el("div", { className: "user-list-name" }, [user.displayName]));
    info.appendChild(el("div", { className: "user-list-email" }, [user.email]));

    const check = el("div", { className: "user-list-check" });
    check.appendChild(el("i", { className: "ph ph-check" }));

    card.append(avatar, info, check);
    userList.appendChild(card);
  });

  const loginForm = $("#login-form");
  const registerEl = $("#login-register");
  if (loginForm) {
    const savedUserId = loginForm.dataset.userId;
    if (savedUserId) {
      const savedUser = MOCK_USERS.find(u => u.id === savedUserId);
      if (savedUser) {
        loginForm.classList.remove("hidden");
        $("#input-email").value = savedUser.email;
      }
    } else {
      loginForm.classList.add("hidden");
    }
  }
  if (registerEl) registerEl.classList.add("hidden");

  $("button#btn-register")?.addEventListener("click", handleRegister);
  $("button#btn-login-submit")?.addEventListener("click", handleLoginSubmit);
  $("button#btn-forgot")?.addEventListener("click", () => {
    showToast("Восстановление пароля через Email — в продакшене 🔐");
  });
}



function selectUser(userId) {
  // Подсветить выбранного
  $$('.user-list-card').forEach(c => {
    const isSelected = c.dataset.userId === userId;
    c.classList.toggle('selected', isSelected);
    c.setAttribute('aria-selected', isSelected);
  });

  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) return;

  const loginForm = $('#login-form');
  const registerEl = $('#login-register');
  if (loginForm) {
    loginForm.classList.remove('hidden');
    loginForm.dataset.userId = userId;
    $('#input-email').value = user.email;
    $('#input-password').value = '';
  }
  if (registerEl) registerEl.classList.add('hidden');

  // Сфокусировать поле пароля
  setTimeout(() => $('#input-password')?.focus(), 100);
}

function handleLoginSubmit() {
  const form = $('#login-form');
  const userId = form?.dataset.userId;
  const emailInput = $('#input-email');
  const passInput  = $('#input-password');
  const errorEl    = $('#login-error');

  errorEl.classList.add('hidden');

  if (!userId) {
    errorEl.textContent = 'Выберите пользователя';
    errorEl.classList.remove('hidden');
    return;
  }

  const email = emailInput?.value?.trim();
  const pass  = passInput?.value?.trim();

  if (!email) {
    errorEl.textContent = 'Введите email';
    errorEl.classList.remove('hidden');
    emailInput?.focus();
    return;
  }
  if (!pass) {
    errorEl.textContent = 'Введите пароль';
    errorEl.classList.remove('hidden');
    passInput?.focus();
    return;
  }

  if (window.__dlHelpers) {
    handleLoginSubmitViaDL(email, pass, errorEl, loginForm);
    return;
  }

  // Демо-проверка
  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) {
    errorEl.textContent = 'Пользователь не найден';
    errorEl.classList.remove('hidden');
    return;
  }

  if (pass !== user.password) {
    errorEl.textContent = 'Неверный email или пароль';
    errorEl.classList.remove('hidden');
    return;
  }

  // Вход выполнен
  appState.currentUser = user;
  appState.syncStatus  = navigator.onLine ? 'online' : 'offline';
  saveState();
  applyTheme();
  navigateTo('#main');
  renderAll();
  showToast(`Добро пожаловать, ${user.displayName}! 👋`);

  // Скрыть форму
  $('#login-form')?.classList.add('hidden');
}

// === Data-layer login (async, defined here so handleLoginSubmit can call it) ===
async function handleLoginSubmitViaDL(email, pass, errorEl, loginForm) {
  // Проверка валидности email по MOCK_USERS (если есть)
  const user = MOCK_USERS.find(u => u.email === email);
  if (!user) {
    errorEl.textContent = 'Пользователь не найден';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const dlUser = await DL.signIn(email, pass);
    window.appState.currentUser = {
      id:         dlUser.uid,
      email:      dlUser.email,
      displayName: dlUser.displayName || email.split('@')[0],
      color:      user.color || '#6366f1',
    };
    window.appState.syncStatus = navigator.onLine ? 'online' : 'offline';

    localStorage.setItem('trafy-currentUser', JSON.stringify(window.appState.currentUser));

    loginForm?.classList.add('hidden');
    window.showToast?.(`Добро пожаловать, ${dlUser.displayName || email}! 👋`);

    window.renderAll?.();
    window.navigateTo?.('#main');
  } catch (e) {
    errorEl.textContent = 'Неверный email или пароль';
    errorEl.classList.remove('hidden');
  }
}

function handleRegister() {
  const nameInput  = $('#input-register-name');
  const emailInput = $('#input-register-email');
  const passInput  = $('#input-register-pass');
  const errorEl    = $('#register-error');

  errorEl.classList.add('hidden');

  const name  = nameInput?.value?.trim();
  const email = emailInput?.value?.trim();
  const pass  = passInput?.value?.trim();

  if (!name || !email || !pass) {
    errorEl.textContent = 'Заполните все поля';
    errorEl.classList.remove('hidden');
    return;
  }
  if (pass.length < 6) {
    errorEl.textContent = 'Пароль минимум 6 символов';
    errorEl.classList.remove('hidden');
    passInput?.focus();
    return;
  }
  if (!email.includes('@')) {
    errorEl.textContent = 'Некорректный email';
    errorEl.classList.remove('hidden');
    emailInput?.focus();
    return;
  }

  // Использовать data-layer если доступен
  if (window.__dlHelpers) {
    handleRegisterViaDL(name, email, pass, errorEl);
    return;
  }

  // Fallback: мок-регистрация
  if (MOCK_USERS.find(u => u.email === email)) {
    errorEl.textContent = 'Пользователь с таким email уже существует';
    errorEl.classList.remove('hidden');
    return;
  }

  const newUser = {
    id:          'user-' + (MOCK_USERS.length + 1),
    email:       email.toLowerCase(),
    displayName: name,
    color:       ['#6366f1','#ec4899','#22c55e','#f59e0b','#8b5cf6'][MOCK_USERS.length % 5],
  };
  MOCK_USERS.push(newUser);

  // Автоматически выбрать нового пользователя
  const card = $$('.user-list-card').find(c => c.dataset.userId === newUser.id);
  if (card) {
    card.classList.add('selected');
    card.setAttribute('aria-selected', 'true');
  }

  // Показать форму входа для нового пользователя
  const loginForm = $('#login-form');
  loginForm.dataset.userId = newUser.id;
  loginForm.classList.remove('hidden');
  $('#input-email').value = newUser.email;
  $('#input-password').value = '';

  $('#login-register')?.classList.add('hidden');

  errorEl.textContent = `Аккаунт ${name} создан! Введите пароль для входа.`;
  errorEl.classList.remove('hidden');
  errorEl.style.color = 'var(--color-success)';
  errorEl.style.background = 'var(--color-success-bg)';
  setTimeout(() => {
    errorEl.style.color = '';
    errorEl.style.background = '';
    $('#input-password')?.focus();
  }, 2000);
}

async function handleRegisterViaDL(name, email, pass, errorEl) {
  try {
    const dlUser = await DL.signUp(email, pass, name);
    const newUser = {
      id:          dlUser.uid,
      email:       email.toLowerCase(),
      displayName: name,
      color:       ['#6366f1','#ec4899','#22c55e','#f59e0b','#8b5cf6'][MOCK_USERS.length % 5],
    };
    MOCK_USERS.push(newUser);

    // Подсветить нового пользователя в списке
    document.querySelectorAll('.user-list-card').forEach(card => {
      if (card.dataset?.userId === dlUser.uid) {
        card.classList.add('selected');
        card.setAttribute('aria-selected', 'true');
      }
    });

    // Показать форму входа для нового пользователя
    const loginForm = $('#login-form');
    loginForm.dataset.userId = dlUser.uid;
    loginForm.classList.remove('hidden');
    document.getElementById('input-email').value = email;
    document.getElementById('input-password').value = '';
    document.getElementById('login-register')?.classList.add('hidden');

    errorEl.textContent = `Аккаунт ${name} создан! Введите пароль для входа.`;
    errorEl.classList.remove('hidden');
    errorEl.style.color = 'var(--color-success)';
    errorEl.style.background = 'var(--color-success-bg)';
    setTimeout(() => {
      errorEl.style.color = '';
      errorEl.style.background = '';
      document.getElementById('input-password')?.focus();
    }, 2000);
  } catch (e) {
    errorEl.textContent = e.message || 'Ошибка регистрации';
    errorEl.classList.remove('hidden');
  }
}

function logout() {
  // Использовать data-layer если доступен
  if (window.__dlHelpers) {
    window.__dlHelpers.signOut().then(() => {
      appState.currentUser = null;
      appState.syncStatus  = 'offline';
      localStorage.removeItem('trafy-currentUser');
      navigateTo('#login');
      renderAll();
      showToast('Вы вышли из аккаунта 🚪');
    }).catch(err => {
      console.warn('[app.js] DL signOut error:', err);
      appState.currentUser = null;
      appState.syncStatus  = 'offline';
      saveState();
      navigateTo('#login');
      renderAll();
      showToast('Вы вышли из аккаунта 🚪');
    });
    return;
  }

  appState.currentUser = null;
  appState.syncStatus  = 'offline';
  saveState();
  navigateTo('#login');
  renderAll();
  showToast('Вы вышли из аккаунта 🚪');
}

/* ────────────────────────────────────────────────────────────────
   14. TOAST
   ──────────────────────────────────────────────────────────────── */

let toastTimer = null;

function showToast(message, duration = 2400) {
  // Автоматическое создание toast в DOM, если его нет (Hot-fix для статического деплоя)
  if (!document.getElementById('sync-toast')) {
    const toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.className = 'sync-toast hidden';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<i class="ph ph-cloud-check" id="sync-toast-icon" aria-hidden="true"></i><span id="sync-toast-text"></span>';
    document.body.appendChild(toast);
  }
  const toast = $('#sync-toast');
  const text  = $('#sync-toast-text');
  if (!toast || !text) return;
  clearTimeout(toastTimer);
  text.textContent = message;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/* ────────────────────────────────────────────────────────────────
   15. NAVIGATION (hash-based)
   ──────────────────────────────────────────────────────────────── */

let currentRoute = 'login';

function parseHash(hash) {
  const h = hash.replace(/^#/, '') || 'login';
  const parts = h.split('/');
  return parts;
}

function navigateTo(hash) {
  const parsed = parseHash(hash);
  const route  = parsed[0];

  // Всегда добавляем в историю
  if (window.location.hash !== hash) {
    history.pushState({}, '', hash);
  }

  currentRoute = route;

  // Обновляем активный элемент bottom nav
  $$('.nav-item').forEach(item => {
    const navTarget = item.dataset.nav;
    item.classList.toggle('nav-item-active', navTarget === route);
    item.setAttribute('aria-current', navTarget === route ? 'page' : 'false');
  });

  // Скрыть навигацию на экране входа
  const nav = $('#bottom-nav');
  if (nav) {
    nav.style.display = route === 'login' ? 'none' : 'flex';
  }

  switch (route) {
    case 'login':
      showScreen('screen-login');
      renderLoginScreen();
      break;
    case 'main':
      showScreen('screen-main');
      renderMainScreen();
      break;
    case 'list':
      showScreen('screen-list');
      renderListScreen();
      break;
    case 'add':
    case 'edit':
      showScreen('screen-form');
      openFormScreen(route === 'edit' && parsed[1] ? parsed[1] : null);
      break;
    case 'stats':
      showScreen('screen-stats');
      renderStatsScreen();
      break;
    case 'categories':
      showScreen('screen-categories');
      renderCategoriesGrid();
      if (!categories.length) {
        const firstBtn = $('#btn-first-category');
        if (firstBtn) firstBtn.focus();
      }
      break;
    case 'settings':
      showScreen('screen-settings');
      renderSettingsScreen();
      break;
    default:
      showScreen('screen-main');
      renderMainScreen();
      break;
  }
}

/* ────────────────────────────────────────────────────────────────
   16. RENDER ALL (single source of truth)
   ──────────────────────────────────────────────────────────────── */

function renderAll() {
  const user = appState.currentUser;
  renderCategorySelects();
  renderCategoriesGrid();
  renderMainScreen();

  // Если на экране списка — пере-render
  if (currentRoute === 'list') renderListScreen();
  if (currentRoute === 'main') renderMainScreen();
  if (currentRoute === 'stats') renderStatsScreen();
  if (currentRoute === 'settings') renderSettingsScreen();

  // Обновить бейдж навигации
  updateNavBadge();

  // Тема
  applyTheme();
}

function updateNavBadge() {
  const badge = $('#nav-badge');
  if (!badge) return;
  if (!appState.currentUser) { badge.hidden = true; return; }
  const count = expenses.filter(e => e.userId === appState.currentUser.id).length;
  if (count > 0) {
    badge.hidden = false;
    badge.textContent = count > 99 ? '99+' : count;
  } else {
    badge.hidden = true;
  }
}

/* ────────────────────────────────────────────────────────────────
   16. PERSISTENCE (localStorage — заглушка IndexedDB)
   ──────────────────────────────────────────────────────────────── */

function saveState() {
  try {
    const data = {
      categories: categories,
      expenses:   expenses,
      users:      MOCK_USERS,
      theme:      appState.theme,
      currency:   appState.currency,
      sync:       appState.syncEnabled ? appState.syncStatus : 'offline',
      updatedAt:  new Date().toISOString(),
    };
    localStorage.setItem('trafy-state', JSON.stringify(data));
  } catch (e) {
    console.warn('trafy: не удалось сохранить состояние:', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem('trafy-state');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.categories) categories = data.categories;
    if (data.expenses)   expenses   = data.expenses;
    if (data.users)      MOCK_USERS = data.users;
    if (data.theme)      appState.theme = data.theme;
    if (data.currency)   appState.currency = data.currency;
    if (data.sync !== undefined) appState.syncStatus = data.sync;
    return true;
  } catch (e) {
    console.warn('trafy: не удалось загрузить состояние:', e);
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────
   17. EXPORT / IMPORT
   ──────────────────────────────────────────────────────────────── */

function exportData() {
  const user = appState.currentUser;
  if (!user) { showToast('Сначала войдите в аккаунт'); return; }

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    userId: user.id,
    currency: appState.currency,
    categories: categories.filter(c => c.userId === '*' || c.userId === user.id),
    expenses: expenses.filter(e => e.userId === user.id),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `trafy-export-${user.displayName?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Данные экспортированы 📤');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.expenses || !data.categories) {
        showToast('Некорректный файл экспорта');
        return;
      }
      // Добавляем категории (если нет таких)
      data.categories.forEach(c => {
        if (!categories.find(ex => ex.id === c.id)) {
          categories.push(c);
        }
      });
      // Добавляем траты (с текущим пользователем)
      const uid = appState.currentUser?.id || 'user-1';
      data.expenses.forEach(e => {
        expenses.push({
          ...e,
          id: generateId() + '-' + e.id,
          userId: uid,
          createdAt: new Date().toISOString(),
        });
      });
      saveState();
      renderAll();
      showToast(`Импортировано: ${data.expenses.length} записей, ${data.categories.length} категорий 📥`);
    } catch (err) {
      showToast('Ошибка импорта: некорректный файл');
    }
  };
  reader.readAsText(file);
}

/* ────────────────────────────────────────────────────────────────
   18. EVENT WIRING
   ──────────────────────────────────────────────────────────────── */

function wireEvents() {
  // ── Навигация по ссылкам ──
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        navigateTo(href);
      }
    });
  });

  // ── Хэш-изменения (когда пользователь нажимает кнопку браузера "Назад") ──
  window.addEventListener('popstate', () => {
    navigateTo(window.location.hash || '#main');
  });

  // ── Кнопка "Назад" в шапке ──
  $('#btn-back')?.addEventListener('click', () => {
    if (currentRoute === 'login') return;
    // Навигация: из формы → список, из остальных → главная
    if (currentRoute === 'edit' || currentRoute === 'add') {
      navigateTo('#list');
    } else if (currentRoute === 'settings') {
      navigateTo('#main');
    } else if (currentRoute === 'stats') {
      navigateTo('#main');
    } else if (currentRoute === 'list') {
      navigateTo('#main');
    } else if (currentRoute === 'categories') {
      navigateTo('#main');
    } else {
      navigateTo('#main');
    }
  });

  // ── Тема ──
  $('#btn-theme')?.addEventListener('click', () => {
    if (appState.theme === 'dark')      appState.theme = 'light';
    else if (appState.theme === 'light') appState.theme = 'auto';
    else                                appState.theme = 'dark';
    applyTheme();
    renderThemeOptions();
  });

  // ── Быстрое добавление ──
  $('#btn-quick-add')?.addEventListener('click', () => {
    if (!appState.currentUser) { navigateTo('#login'); return; }
    const amountVal = $('#quick-amount')?.value?.trim();
    const catVal    = $('#quick-category')?.value;
    const dateVal   = $('#quick-date')?.value;
    const descVal   = $('#quick-description')?.value?.trim();

    if (!amountVal || parseFloat(amountVal) <= 0) {
      showToast('Введите сумму больше нуля');
      $('#quick-amount')?.focus();
      return;
    }
    if (!catVal) {
      showToast('Выберите категорию');
      $('#quick-category')?.focus();
      return;
    }
    if (!dateVal) {
      showToast('Выберите дату');
      $('#quick-date')?.focus();
      return;
    }

    // Добавляем трату через data-layer если доступен
    if (window.__dlHelpers) {
      window.__dlHelpers.addExpense({
        amount:     parseFloat(amountVal),
        categoryId: catVal,
        description: descVal || '',
        date:       dateVal,
        currency:   appState.currency,
      }).then(result => {
        expenses.push(result);
        renderMainScreen();
        showToast('Трата добавлена ✅');
        $('#quick-amount')?.focus();
      }).catch(err => {
        console.warn('[app.js] DL addExpense error:', err);
        expenses.push({
          id:         generateId(),
          userId:     appState.currentUser.id,
          categoryId: catVal,
          amount:     parseFloat(amountVal),
          description: descVal || '',
          date:       dateVal,
          currency:   appState.currency,
          createdAt:  new Date().toISOString(),
          updatedAt:  new Date().toISOString(),
        });
        saveState();
        renderMainScreen();
        showToast('Трата добавлена ✅');
        $('#quick-amount')?.focus();
      });
      return;
    }

    expenses.push({
      id:         generateId(),
      userId:     appState.currentUser.id,
      categoryId: catVal,
      amount:     parseFloat(amountVal),
      description: descVal || '',
      date:       dateVal,
      currency:   appState.currency,
      createdAt:  new Date().toISOString(),
      updatedAt:  new Date().toISOString(),
    });

    saveState();

    // Очистить поля
    $('#quick-amount').value  = '';
    $('#quick-description').value = '';
    const today = todayStr(0);
    $('#quick-date').value = today;

    renderMainScreen();
    showToast('Трата добавлена ✅');
    $('#quick-amount')?.focus();
  });

  // ── Форма добавления/редактирования ──
  $('#expense-form')?.addEventListener('submit', submitExpenseForm);
  $('#btn-form-cancel')?.addEventListener('click', () => {
    if (editingExpenseId) navigateTo('#list');
    else                   navigateTo('#main');
  });

  // ── Удаление ──
  $('#delete-modal-confirm')?.addEventListener('click', confirmDelete);
  $('#delete-modal-cancel')?.addEventListener('click', () => closeModal('modal-delete'));
  $('#delete-modal-close')?.addEventListener('click', () => closeModal('modal-delete'));

  // ── Категории ──
  $('#btn-category-add')?.addEventListener('click', () => openCategoryModal());
  $('#btn-first-category')?.addEventListener('click', () => openCategoryModal());
  $('#cat-modal-save')?.addEventListener('click', saveCategoryModal);
  $('#cat-modal-cancel')?.addEventListener('click', () => closeModal('modal-category'));
  $('#category-modal-close')?.addEventListener('click', () => closeModal('modal-category'));

  // Закрытие модалок по клику на оверлей
  $$('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // ── Настройки ──
  $('#settings-name-save')?.addEventListener('click', () => {
    const input = $('#settings-name-input');
    const user  = appState.currentUser;
    if (user && input) {
      user.displayName = input.value.trim() || user.email.split('@')[0];
      saveState();
      renderSettingsScreen();
      renderLoginScreen();
      showToast('Имя сохранено ✅');
    }
  });

  $('#settings-currency')?.addEventListener('change', (e) => {
    appState.currency = e.target.value;
    saveState();
    renderAll();
    showToast(`Валюта изменена на ${e.target.value} 💰`);
  });

  $('#btn-sync-now')?.addEventListener('click', () => {
    appState.syncStatus = 'online';
    updateSyncUI();
    showToast('Синхронизация запущена…');
    setTimeout(() => {
      appState.syncStatus = 'online';
      updateSyncUI();
      showToast('Синхронизация завершена ✅');
    }, 1200);
  });

  $('#btn-export')?.addEventListener('click', exportData);
  $('#btn-import-trigger')?.addEventListener('click', () => {
    $('#input-import')?.click();
  });
  $('#input-import')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importData(e.target.files[0]);
      e.target.value = '';
    }
  });

  $('#btn-logout')?.addEventListener('click', () => {
    // В headless-режиме confirm может не сработать — используем прямой вызов
    logout();
  });

  // ── Фильтры списка ──
  $$('#filter-period').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#filter-period .chip').forEach(b => b.classList.remove('chip-active'));
      btn.classList.add('chip-active');
      activeFilters.period = btn.dataset.value;
      if (currentRoute === 'list') renderListScreen();
    });
  });

  $('#filter-user')?.addEventListener('change', (e) => {
    activeFilters.user = e.target.value;
    if (currentRoute === 'list') renderListScreen();
  });

  $('#filter-category')?.addEventListener('change', (e) => {
    activeFilters.category = e.target.value;
    if (currentRoute === 'list') renderListScreen();
  });

  // ── Период статистики ──
  $$('.pill[data-stat-period]').forEach(pill => {
    pill.addEventListener('click', () => {
      $$('.pill[data-stat-period]').forEach(p => p.classList.remove('pill-active'));
      pill.classList.add('pill-active');
      if (currentRoute === 'stats') renderStatsScreen();
    });
  });

  // ── Видимость пароля ──
  $('#btn-visibility')?.addEventListener('click', () => {
    const passEl = $('#input-password');
    const icon   = $('#eye-icon');
    if (!passEl) return;
    const isHidden = passEl.type === 'password';
    passEl.type = isHidden ? 'text' : 'password';
    icon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
  });

  // ── Быстрая клавиша Esc для закрытия модалок ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal-overlay:not(.hidden)').forEach(m => closeModal(m.id));
    }
    if (e.key === 'Enter' && currentRoute === 'login') {
      const loginForm = $('#login-form');
      if (loginForm && !loginForm.classList.contains('hidden')) {
        handleLoginSubmit();
      }
    }
  });

  // ── Экран входа (привязка один раз при инициализации) ──
  $('#btn-login-submit')?.addEventListener('click', handleLoginSubmit);
  $('#btn-register')?.addEventListener('click', handleRegister);
  $('#btn-forgot')?.addEventListener('click', () => {
    showToast('Восстановление пароля через Email — в продакшене 🔐');
  });

  // ── Онлайн/офлайн ──
  window.addEventListener('online',  () => {
    if (appState.syncEnabled) {
      appState.syncStatus = 'online';
      updateSyncUI();
      showToast('Соединение восстановлено ✅');
    }
  });
  window.addEventListener('offline', () => {
    appState.syncStatus = 'offline';
    updateSyncUI();
    showToast('Ответ сервера не получен — данные сохранятся локально ⏸');
  });
}

/* ────────────────────────────────────────────────────────────────
   19. INIT
   ──────────────────────────────────────────────────────────────── */

async function init() {
  // Загружаем состояние из localStorage (мок-фоллбэк)
  const loaded = loadState();

  // Если доступен data-layer — загружаем данные из него
  if (DL) {
    try {
      // Попытаться восстановить сессию
      const dlUser = DL.getCurrentUser();
      if (dlUser) {
        const color = ['#6366f1','#ec4899','#22c55e','#f59e0b','#8b5cf6'][
          parseInt(dlUser.uid?.replace('user-', '')) % 5 || 0
        ];
        appState.currentUser = {
          id: dlUser.uid,
          email: dlUser.email,
          displayName: dlUser.displayName || dlUser.email.split('@')[0],
          color,
        };
      }

      // Загрузить категории и траты из DL
      const dlCats = await DL.getCategories();
      const dlExps = await DL.getExpenses();

      if (dlCats.length > 0) {
        categories = dlCats.map(c => ({ ...c }));
      } else if (!loaded || categories.length === 0) {
        initData();
      }

      if (dlExps.length > 0) {
        expenses = dlExps.map(e => ({ ...e }));
      } else if (!loaded || expenses.length === 0) {
        initData();
      }

      // Синхронизировать MOCK_USERS из localStorage mock-хранилища
      const stored = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
      if (Object.keys(stored).length > 0) {
        MOCK_USERS = Object.entries(stored).map(([email, data]) => ({
          id: data.uid,
          email: email,
          displayName: data.displayName,
          color: '#6366f1',
          password: data.password,
        }));
      }
    } catch (e) {
      console.warn('[app.js] DL load error, fallback to localStorage:', e);
      if (!loaded || categories.length === 0) initData();
    }
  } else {
    // Фоллбэк без DL
    if (!loaded || categories.length === 0) {
      initData();
    }
  }

  // Если нет currentUser, но есть сохранённый в localStorage — восстановить
  if (!appState.currentUser) {
    const savedUserRaw = localStorage.getItem('trafy-currentUser');
    if (savedUserRaw) {
      try {
        const savedUser = JSON.parse(savedUserRaw);
        const found = MOCK_USERS.find(u => u.id === savedUser.id);
        if (found) appState.currentUser = found;
      } catch (e) { /* ignore */ }
    }
  }

  // Применяем тему
  applyTheme();

  // Регистрируем Service Worker для PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/js/sw.js')
      .then((reg) => {
        console.log('[PWA] SW зарегистрирован:', reg.scope);
        window.__swReady = true;
      })
      .catch((err) => console.warn('[PWA] SW регистрация не удалась:', err));
  }

  // Определяем начальный экран
  const hash = window.location.hash || '#login';
  parseHash(hash);

  // Рендерим
  if (appState.currentUser) {
    navigateTo(hash || '#main');
  } else {
    navigateTo('#login');
  }

  wireEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
