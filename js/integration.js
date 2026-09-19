/**
 * integration.js — адаптер между app.js и data-layer.js.
 * 
 * Архитектура:
 * - data-layer.js загружается как ES module (автоматически deferred)
 * - integration.js загружается как ES module (автоматически deferred, выполняется после data-layer)
 * - app.js загружается как классический скрипт с defer (выполняется после модулей)
 *
 * integration.js:
 * 1. Импортирует data-layer.js
 * 2. Инициализирует Firebase (mock режим)
 * 3. Засевает тестовых пользователей, категории, траты
 * 4. Экспортирует DL API на window.DL
 * 5. После загрузки app.js переопределяет ключевые функции для использования DL
 */

'use strict';

/* ────────────────────────────────────────────────────────────────
   1. ДАННЫЕ ДЛЯ СЕЯНИЯ
   ──────────────────────────────────────────────────────────────── */

const SEED_USERS = [
  { uid: 'user-1', email: 'maxim@trafy.app', displayName: 'Максим', color: '#6366f1', password: 'Максим123' },
  { uid: 'user-2', email: 'margarita@trafy.app', displayName: 'Маргарита', color: '#ec4899', password: 'Маргарита123' },
];
const SEED_PASSWORD = 'Максим123';

const SEED_CATEGORIES = [
  { name: 'Еда',           color: '#f59e0b', icon: '🍽' },
  { name: 'Транспорт',     color: '#22c55e', icon: '🚗' },
  { name: 'Развлечения',    color: '#ec4899', icon: '🎮' },
  { name: 'Магазин',        color: '#3b82f6', icon: '🛒' },
  { name: 'Кофе',          color: '#a855f7', icon: '☕' },
  { name: 'Медицина',      color: '#ef4444', icon: '💊' },
  { name: 'Дом',           color: '#14b8a6', icon: '🏠' },
  { name: 'Путешествия',   color: '#06b6d4', icon: '✈️' },
  { name: 'Работа',        color: '#64748b', icon: '💼' },
  { name: 'Подарки',       color: '#f97316', icon: '🎁' },
];

const SEED_EXPENSES = [
  { userId: 'user-1', amount: 350,   description: 'Суши и кофе',        date: _today(0),  currency: '₽' },
  { userId: 'user-1', amount: 120,   description: 'Латте в офисе',       date: _today(0),  currency: '₽' },
  { userId: 'user-1', amount: 2500,  description: 'Продукты на неделю',   date: _today(-1), currency: '₽' },
  { userId: 'user-1', amount: 500,   description: 'Бензин',               date: _today(-2), currency: '₽' },
  { userId: 'user-1', amount: 890,   description: 'Netflix + игра',        date: _today(-3), currency: '₽' },
  { userId: 'user-1', amount: 1850,  description: 'Ужин в ресторане',     date: _today(-4), currency: '₽' },
  { userId: 'user-2', amount: 420,   description: 'Сытный завтрак',       date: _today(0),  currency: '₽' },
  { userId: 'user-2', amount: 300,   description: 'Витамины',             date: _today(-1), currency: '₽' },
  { userId: 'user-2', amount: 1500,  description: 'Проезд на работу',     date: _today(-2), currency: '₽' },
  { userId: 'user-1', amount: 2100,  description: 'Свет и вода',          date: _today(-5), currency: '₽' },
];

// Маппинг индекса траты → индекса категории
const EXPENSE_CATEGORY_MAP = [0, 4, 3, 1, 2, 0, 0, 5, 8, 6];

function _today(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

/* ────────────────────────────────────────────────────────────────
   2. ИНИЦИАЛИЗАЦИЯ data-layer + СЕЯНИЕ
   ──────────────────────────────────────────────────────────────── */

const DL = await import('./data-layer.js');
try {
  await DL.initFirebase();
} catch (e) {
  console.error('[integration] initFirebase failed:', e);
}

// Засеять пользователей
const storedUsers = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
const currentEmails = Object.keys(storedUsers).map(e => e.toLowerCase());
const seedEmails = SEED_USERS.map(u => u.email.toLowerCase());
const needsReseed = Object.keys(storedUsers).length === 0
  || seedEmails.some(email => !currentEmails.includes(email))
  || currentEmails.some(email => !seedEmails.includes(email));

if (needsReseed) {
  const freshUsers = {};
  SEED_USERS.forEach(u => {
    freshUsers[u.email.toLowerCase()] = {
      uid: u.uid,
      password: u.password,
      displayName: u.displayName,
    };
  });
  localStorage.setItem('et_mock_users', JSON.stringify(freshUsers));
  console.log('[integration] Пользователи обновлены');
}

// Авторизоваться для сеяния данных
let seedUser = DL.getCurrentUser();
if (!seedUser) {
  try {
    seedUser = await DL.signIn('maxim@trafy.app', SEED_PASSWORD);
    console.log('[integration] Авторизован для сеяния:', seedUser.email);
  } catch (e) {
    console.warn('[integration] Auto-sign-in failed:', e.message);
  }
}

// Засеять категории
try {
  const existingCats = await DL.getCategories();
  if (existingCats.length === 0 && seedUser) {
    for (const cat of SEED_CATEGORIES) {
      await DL.addCategory(cat);
    }
    console.log('[integration] Засеяны', SEED_CATEGORIES.length, 'категорий');
  }
} catch (e) {
  console.error('[integration] Категории не засеяны:', e);
}

// Засеять траты
try {
  const existingExpenses = await DL.getExpenses();
  if (existingExpenses.length === 0 && seedUser) {
    const cats = await DL.getCategories();
    const catMap = {};
    cats.forEach(c => { catMap[c.name] = c.id; });

    for (const [idx, exp] of SEED_EXPENSES.entries()) {
      const catName = SEED_CATEGORIES[EXPENSE_CATEGORY_MAP[idx]]?.name;
      await DL.addExpense({
        ...exp,
        categoryId: catMap[catName]?.id || cats[0]?.id,
      });
    }
    console.log('[integration] Засеяны', SEED_EXPENSES.length, 'тратов');
  }
} catch (e) {
  console.error('[integration] Траты не засеяны:', e);
}

// Сохранить текущего пользователя для app.js
const currentUser = DL.getCurrentUser();
if (currentUser) {
  localStorage.setItem('trafy-currentUser', JSON.stringify({
    id: currentUser.uid,
    email: currentUser.email,
    displayName: currentUser.displayName || currentUser.email.split('@')[0],
    color: ['#6366f1','#ec4899','#22c55e','#f59e0b','#8b5cf6'][
      parseInt(currentUser.uid?.replace('user-', '')) % 5 || 0
    ],
  }));
}

/* ────────────────────────────────────────────────────────────────
   ЭКСПОРТ DL API НА WINDOW
   ──────────────────────────────────────────────────────────────── */

window.DL = DL;

console.log('[integration] ✅ window.DL готов');

/* ────────────────────────────────────────────────────────────────
   ХЕЛПЕРЫ ДЛЯ APP.JS (window.__dlHelpers)
   ──────────────────────────────────────────────────────────────── */

window.__dlHelpers = {
  async signIn(email, password) {
    const user = await DL.signIn(email, password);
    return { uid: user.uid, email: user.email, displayName: user.displayName || user.email.split('@')[0], color: '#6366f1' };
  },
  async signUp(email, password, displayName) {
    const user = await DL.signUp(email, password, displayName);
    return { uid: user.uid, email: user.email, displayName: user.displayName || displayName, color: '#6366f1' };
  },
  async signOut() { await DL.signOut(); },
  getCurrentUser() {
    const u = DL.getCurrentUser();
    return u ? { uid: u.uid, email: u.email, displayName: u.displayName || u.email.split('@')[0], color: '#6366f1' } : null;
  },
  async getExpenses(filters) { return DL.getExpenses(filters); },
  async addExpense(data) { return DL.addExpense(data); },
  async updateExpense(id, data) { return DL.updateExpense(id, data); },
  async deleteExpense(id) { await DL.deleteExpense(id); },
  async getCategories() { return DL.getCategories(); },
  async addCategory(data) { return DL.addCategory(data); },
  async updateCategory(id, data) { return DL.updateCategory(id, data); },
  async deleteCategory(id) { await DL.deleteCategory(id); },
};

console.log('[integration] ✅ window.__dlHelpers готов');
console.log('[integration] isMockMode:', DL.isMockMode ? 'true' : 'false');

const finalCats = await DL.getCategories();
const finalExps = await DL.getExpenses();
console.log('[integration] Итог: категории=' + finalCats.length + ', траты=' + finalExps.length);
if (finalCats.length > 0 && finalExps.length > 0) console.log('[integration] ✅ Данные засеяны');
else console.warn('[integration] ⚠️ Данные могут быть не полностью засеянными');
