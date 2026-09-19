/**
 * data-layer.js — единый слой данных: Firebase Auth + Realtime DB + IndexedDB + Sync Queue
 * ES module. Подменяемый mock-слой, если Firebase не доступен.
 *
 * Экспортирует:
 *   initFirebase(config?) → Promise<{ auth, db, online }>
 *   signIn(email, password) → Promise<User>
 *   signUp(email, password, displayName) → Promise<User>
 *   signOut() → Promise<void>
 *   getExpenses(filters?) → Promise<Expense[]>
 *   addExpense(expense) → Promise<Expense>
 *   updateExpense(id, data) → Promise<Expense>
 *   deleteExpense(id) → Promise<void>
 *   getCategories() → Promise<Category[]>
 *   addCategory(c) → Promise<Category>
 *   updateCategory(id, data) → Promise<Category>
 *   deleteCategory(id) → Promise<void>
 *   onSyncStatus(cb) → () => void   (подписка на статус синхронизации)
 *   getCurrentUser() → User | null
 *   onAuthStateChanged(cb) → () => void
 */

// ─── Типы ───────────────────────────────────────────────────────────────

/** @typedef {Object} User
 *  @property {string} uid
 *  @property {string} email
 *  @property {string|null} displayName
 *  @property {string|null} photoURL
 */

/** @typedef {Object} Expense
 *  @property {string} id
 *  @property {string} userId
 *  @property {number} amount
 *  @property {string} currency
 *  @property {string} categoryId
 *  @property {string} date         (ISO date, YYYY-MM-DD)
 *  @property {string} description
 *  @property {number} createdAt    (unix ms)
 *  @property {number} updatedAt    (unix ms)
 *  @property {string} [syncedBy]   userId, кто последний изменил
 */

/** @typedef {Object} Category
 *  @property {string} id
 *  @property {string} userId
 *  @property {string} name
 *  @property {string} color
 *  @property {string} icon
 *  @property {number} createdAt
 *  @property {number} updatedAt
 *  @property {string} [syncedBy]
 */

/** @typedef {Object} SyncStatus
 *  @property {'idle'|'syncing'|'waiting'|'error'} state
 *  @property {string|null} message
 */

// ─── Константы ───────────────────────────────────────────────────────────

const DB_NAME = 'expense-tracker-db';
const DB_VERSION = 2;
const STORE_EXPENSES = 'expenses';
const STORE_CATEGORIES = 'categories';
const STORE_SYNC_QUEUE = 'syncQueue';
const STORE_META = 'meta';

const FIREBASE_WRITE_DELAY_MS = 500; // debounce для Firebase writes

// ─── Состояние модуля ────────────────────────────────────────────────────

let firebaseAuth = null;       // Firebase Auth instance (real или mock)
let firebaseDb = null;         // Firebase Realtime DB instance (real или mock)
let db = null;                 // idb数据库
let currentUser = null;
let authUnsubscribers = [];
let syncStatusListeners = [];
let syncStatus = { state: 'idle', message: null };
let pendingWrites = [];        // очередь pending записей в Firebase
let writeTimer = null;
let unlistenFirebase = null;   // отписка от Firebase onValue
let isMockMode = false;

// ─── Утилиты ─────────────────────────────────────────────────────────────

function now() { return Date.now(); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

async function openDB() {
  if (db) return db;
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB не поддерживается в этом браузере');
  }
  // vanilla IndexedDB — без внешних зависимостей
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_EXPENSES)) {
        const es = d.createObjectStore(STORE_EXPENSES, { keyPath: 'id' });
        es.createIndex('userId', 'userId', { unique: false });
        es.createIndex('date', 'date', { unique: false });
      }
      if (!d.objectStoreNames.contains(STORE_CATEGORIES)) {
        d.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
        d.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' }).createIndex('userId', 'userId', { unique: false });
      }
      if (!d.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        d.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(STORE_META)) {
        d.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function dbAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbIndexAll(storeName, indexName, query) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(query || null);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function setSyncStatus(state, message) {
  syncStatus = { state, message };
  for (const l of syncStatusListeners) l(clone(syncStatus));
}

// ─── Mock Firebase (используется, если реальный Firebase не настроен) ─────

class MockAuth {
  constructor() {
    this._user = null;
    this._listeners = [];
    // Восстановить сессию из localStorage (если есть)
    try {
      const session = JSON.parse(localStorage.getItem('et_mock_session') || 'null');
      if (session) {
        const stored = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
        const entry = stored[session.email];
        if (entry && entry.uid === session.uid) {
          this._user = { uid: entry.uid, email: session.email, displayName: entry.displayName || null, photoURL: null };
          this._emit();
        }
      }
    } catch (_) {}
  }

  async signInWithEmailAndPassword(email, password) {
    const stored = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
    const entry = stored[email.toLowerCase()];
    if (!entry || entry.password !== password) {
      throw new Error('auth/wrong-credentials');
    }
    this._user = { uid: entry.uid, email, displayName: entry.displayName || null, photoURL: null };
    this._emit();
    // Сохраняем сессию
    localStorage.setItem('et_mock_session', JSON.stringify({ uid: this._user.uid, email: this._user.email }));
    return { user: this._user };
  }

  async createUserWithEmailAndPassword(email, password, { displayName } = {}) {
    const stored = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
    const key = email.toLowerCase();
    if (stored[key]) throw new Error('auth/email-already-in-use');
    const uidVal = uid();
    stored[key] = { uid: uidVal, password, displayName: displayName || null };
    localStorage.setItem('et_mock_users', JSON.stringify(stored));
    this._user = { uid: uidVal, email, displayName: displayName || null, photoURL: null };
    this._emit();
    // Сохраняем сессию
    localStorage.setItem('et_mock_session', JSON.stringify({ uid: this._user.uid, email: this._user.email }));
    return { user: this._user };
  }

  async signOut() {
    this._user = null;
    this._emit();
    localStorage.removeItem('et_mock_session');
    return;
  }

  onAuthStateChanged(cb) {
    this._listeners.push(cb);
    cb(this._user);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  _emit() {
    for (const l of this._listeners) l(this._user);
  }
}

class MockDb {
  constructor() {
    this._roots = {};
  }

  ref(path) {
    return new MockRef(this, path);
  }
}

class MockRef {
  constructor(db, path) {
    this._db = db;
    this._path = path.replace(/^\//, '').replace(/\/$/, '');
  }

  child(name) {
    return new MockRef(this._db, (this._path ? this._path + '/' : '') + name);
  }

  set(value) {
    this._setValue(value);
    return Promise.resolve();
  }

  update(patches) {
    const current = this._getValue();
    const merged = { ...current, ...patches };
    this._setValue(merged);
    return Promise.resolve();
  }

  push(value) {
    const newRef = new MockRef(this._db, this._path + '/' + uid());
    newRef._setValue(value || null);
    return { ref: newRef };
  }

  onValue(cb) {
    const handler = () => cb({ val: () => this._getValue() });
    handler(); // вызвать сразу
    this._listeners = this._listeners || [];
    this._listeners.push(handler);
    // В mock режиме "remote" обновления эмулируем через событие storage
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('et_mock_')) handler();
    });
    return () => { this._listeners = (this._listeners || []).filter(l => l !== handler); };
  }

  _getValue() {
    const root = this._db._roots;
    const parts = this._path.split('/');
    let cur = root;
    for (const p of parts) {
      if (!cur) return null;
      cur = cur[p];
    }
    return cur || null;
  }

  _setValue(val) {
    const root = this._db._roots;
    const parts = this._path.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (i === parts.length - 1) {
        cur[p] = val;
      } else {
        if (!cur[p]) cur[p] = {};
        cur = cur[p];
      }
    }
    // уведомить слушателей
    (this._listeners || []).forEach(l => l());
    // эмулируем меж-вкладковую синхронизацию для mock
    const key = 'et_mock_db_' + this._path;
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
}

// ─── Firebase mock factory ────────────────────────────────────────────────

function createMockFirebase() {
  return {
    auth: () => new MockAuth(),
    database: () => new MockDb(),
  };
}

// ─── initFirebase ─────────────────────────────────────────────────────────

/**
 * Инициализирует Firebase. Если передан объект config — пытается использовать
 * реальный Firebase SDK. Если SDK не загружен или config не передан — использует
 * mock-слой (localStorage + in-memory), который сохраняет данные между перезагрузками.
 *
 * @param {Object|null} config — Firebase web config или null для mock
 * @returns {Promise<{ auth, db, online: () => boolean }>}
 */
export async function initFirebase(config = null) {
  if (db) return { auth: firebaseAuth, db: firebaseDb, online: () => navigator.onLine };

  // открываем IndexedDB первым
  db = await openDB();

  // попытка загрузить реальный Firebase SDK
  if (config && typeof window !== 'undefined') {
    // Проверяем, доступен ли уже Firebase (например, загруженный через <script>)
    if (window.firebase && window.firebase.initializeApp && typeof window.firebase.auth === 'function') {
      try {
        const app = window.firebase.initializeApp(config);
        firebaseAuth = window.firebase.auth(app);
        firebaseDb = window.firebase.database(app);
        isMockMode = false;
        setSyncStatus('idle', 'Firebase подключен');
        return { auth: firebaseAuth, db: firebaseDb, online: () => navigator.onLine };
      } catch (err) {
        console.warn('Firebase SDK инициализация не удалась, переход на mock:', err);
      }
    }
  }

  // fallback: mock
  const mock = createMockFirebase();
  firebaseAuth = mock.auth();
  firebaseDb = mock.database();
  isMockMode = true;
  setSyncStatus('idle', 'Mock-режим (Firebase не настроен)');
  return { auth: firebaseAuth, db: firebaseDb, online: () => navigator.onLine };
}

// ─── Auth-обёртки ────────────────────────────────────────────────────────

/**
 * Вход по email/password.
 * @returns {Promise<User>}
 */
export async function signIn(email, password) {
  if (!firebaseAuth) throw new Error('initFirebase() не вызван');
  const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
  currentUser = result.user;
  return clone(currentUser);
}

/**
 * Регистрация.
 * @returns {Promise<User>}
 */
export async function signUp(email, password, displayName = null) {
  if (!firebaseAuth) throw new Error('initFirebase() не вызван');
  const result = await firebaseAuth.createUserWithEmailAndPassword(email, password, { displayName });
  currentUser = result.user;

  // При первом входе создаём дефолтные категории в IndexedDB + Firebase
  if (currentUser) {
    await ensureDefaultCategories(currentUser.uid);
  }
  return clone(currentUser);
}

/**
 * Выход.
 */
export async function signOut() {
  if (!firebaseAuth) throw new Error('initFirebase() не вызван');
  await firebaseAuth.signOut();
  currentUser = null;
  if (unlistenFirebase) {
    unlistenFirebase();
    unlistenFirebase = null;
  }
  // Очищаем write queue, помечая записи как несинхронизированные
  setSyncStatus('idle', 'Сессия завершена');
}

/**
 * Текущий пользователь.
 */
export function getCurrentUser() {
  return currentUser ? clone(currentUser) : null;
}

/**
 * Подписка на изменение авторизации.
 * @returns {Function} функция отписки
 */
export function onAuthStateChanged(cb) {
  if (!firebaseAuth) throw new Error('initFirebase() не вызван');
  const unsub = firebaseAuth.onAuthStateChanged((user) => {
    currentUser = user || null;
    if (user) {
      ensureDefaultCategories(user.uid).catch(err => console.warn('default categories:', err));
    }
    cb(user ? clone(user) : null);
  });
  authUnsubscribers.push(unsub);
  return () => {
    unsub();
    authUnsubscribers = authUnsubscribers.filter(u => u !== unsub);
  };
}

/**
 * Подписка на статус синхронизации.
 * @returns {Function} функция отписки
 */
export function onSyncStatus(cb) {
  syncStatusListeners.push(cb);
  cb(clone(syncStatus));
  return () => { syncStatusListeners = syncStatusListeners.filter(l => l !== cb); };
}

// ─── Дефолтные категории ──────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Еда', color: '#4CAF50', icon: 'food' },
  { name: 'Транспорт', color: '#2196F3', icon: 'car' },
  { name: 'Жильё', color: '#FF9800', icon: 'home' },
  { name: 'Развлечения', color: '#9C27B0', icon: 'film' },
  { name: 'Здоровье', color: '#F44336', icon: 'heart' },
  { name: 'Прочее', color: '#607D8B', icon: 'dots' },
];

async function ensureDefaultCategories(userId) {
  const existing = await dbIndexAll(STORE_CATEGORIES, 'userId', userId);
  if (existing.length > 0) return;

  const nowMs = now();
  for (const cat of DEFAULT_CATEGORIES) {
    const item = {
      id: uid(),
      userId,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      createdAt: nowMs,
      updatedAt: nowMs,
      syncedBy: userId,
    };
    await dbPut(STORE_CATEGORIES, item);
    await enqueueSync('categories', item);
  }
}

// ─── Синхронизация: очередь + debounce ────────────────────────────────────

async function enqueueSync(kind, item) {
  if (!currentUser) return;

  // сохраняем в очередь
  const queueItem = {
    id: uid(),
    kind, // 'expenses' | 'categories'
    action: 'upsert', // 'upsert' | 'delete'
    data: item,
    timestamp: now(),
    userId: currentUser.uid,
  };
  await dbPut(STORE_SYNC_QUEUE, queueItem);

  // добавляем в pendingWrites для debounce-пересылки
  pendingWrites.push(queueItem);
  scheduleFirebaseWrite();
}

function scheduleFirebaseWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    flushSyncQueue().catch(err => {
      console.error('Sync flush error:', err);
      setSyncStatus('error', 'Ошибка синхронизации');
    });
  }, FIREBASE_WRITE_DELAY_MS);
}

async function flushSyncQueue() {
  if (!currentUser || pendingWrites.length === 0) return;

  setSyncStatus('syncing', `Синхронизация (${pendingWrites.length} записей)...`);

  const batch = pendingWrites.slice();
  pendingWrites = [];

  for (const item of batch) {
    try {
      if (item.action === 'delete') {
        await deleteInFirebase(item.kind, item.data.id);
        await dbDelete(STORE_SYNC_QUEUE, item.id);
      } else {
        await upsertInFirebase(item.kind, item.data);
        await dbDelete(STORE_SYNC_QUEUE, item.id);
      }
    } catch (err) {
      console.warn('Sync item failed, re-enqueue:', item.id, err);
      // возвращаем в очередь
      await dbPut(STORE_SYNC_QUEUE, item);
      pendingWrites.push(item);
    }
  }

  if (pendingWrites.length === 0) {
    setSyncStatus('idle', 'Синхронизация завершена');
  } else {
    setSyncStatus('waiting', `Очередь: ${pendingWrites.length} записей`);
  }
}

// офлайн-реконнект: пробуем сбросить очередь
async function tryReconnect() {
  if (!navigator.onLine) return;
  const queue = await dbAll(STORE_SYNC_QUEUE);
  if (queue.length > 0) {
    setSyncStatus('syncing', `Replay очереди (${queue.length})...`);
    pendingWrites = queue;
    await flushSyncQueue();
  }
}

// слушаем онлайн-статус
if (typeof window !== 'undefined') {
  window.addEventListener('online', tryReconnect);
}

// ─── Firebase CRUD (реальный или mock) ────────────────────────────────────

async function upsertInFirebase(kind, data) {
  const refPath = `users/${data.userId}/${kind}/${data.id}`;
  const ref = firebaseDb.ref(refPath);
  const payload = {
    ...data,
    updatedAt: now(),
    syncedBy: currentUser ? currentUser.uid : data.userId,
  };
  await ref.set(payload);
}

async function deleteInFirebase(kind, id) {
  if (!currentUser) return;
  const refPath = `users/${currentUser.uid}/${kind}/${id}`;
  await firebaseDb.ref(refPath).remove();
}

// ─── Слушатель Firebase → IndexedDB ──────────────────────────────────────

async function startFirebaseListener() {
  if (!currentUser || isMockMode) return;
  if (unlistenFirebase) unlistenFirebase();

  const expensesRef = firebaseDb.ref(`users/${currentUser.uid}/expenses`);
  unlistenFirebase = expensesRef.onValue((snapshot) => {
    const remoteExpenses = snapshot.val();
    if (!remoteExpenses) return;

    const remoteArr = Object.entries(remoteExpenses).map(([id, d]) => ({ id, ...d }));
    applyRemoteBatch('expenses', remoteArr).catch(err => console.warn('expenses sync:', err));
  });

  const categoriesRef = firebaseDb.ref(`users/${currentUser.uid}/categories`);
  // отдельный 리스너 для категорий, чтобы не смешивать
  // (в реальном Firebase можно было бы один listener на users/{uid}, но для ясности разделяем)
  const categoriesUnsub = categoriesRef.onValue((snapshot) => {
    const remoteCats = snapshot.val();
    if (!remoteCats) return;
    const remoteArr = Object.entries(remoteCats).map(([id, d]) => ({ id, ...d }));
    applyRemoteBatch('categories', remoteArr).catch(err => console.warn('categories sync:', err));
  });

  // храним отписку через composite
  const origUnsub = unlistenFirebase;
  unlistenFirebase = () => {
    origUnsub && origUnsub();
    categoriesUnsub();
  };
}

/**
 * Применяет пакет удалённых данных в IndexedDB с разрешением конфликтов.
 * Правило: last-write-wins по updatedAt, но локальная запись имеет приоритет,
 * если 그녀의 updatedAt >= remote (локальные изменения не перезаписываются удалёнными старше).
 */
async function applyRemoteBatch(kind, items) {
  const storeName = kind === 'expenses' ? STORE_EXPENSES : STORE_CATEGORIES;

  for (const remoteItem of items) {
    const local = await dbGet(storeName, remoteItem.id);
    if (!local) {
      // нет локальной — пишем удалённую
      await dbPut(storeName, clone(remoteItem));
    } else {
      // конфликт: выбираем winner по timestamp
      const localTs = local.updatedAt || 0;
      const remoteTs = remoteItem.updatedAt || 0;
      if (remoteTs > localTs) {
        // удалённая новее — обновляем локальную, но сохраняем syncedBy
        const merged = {
          ...clone(remoteItem),
          syncedBy: remoteItem.syncedBy || remoteItem.userId,
        };
        await dbPut(storeName, merged);
      }
      // если локальная новее или равна — пропускаем (локальная побеждает)
    }
  }
}

// ─── Экспортируемые CRUD-функции ─────────────────────────────────────────

/**
 * Получить все расходы (с фильтрами).
 * @param {Object} [filters] — { userId?, categoryId?, from?, to?, minAmount?, maxAmount? }
 */
export async function getExpenses(filters = {}) {
  await ensureDb();
  let items = await dbIndexAll(STORE_EXPENSES, 'userId', filters.userId || currentUser?.uid || '');
  if (!items) items = [];

  // доп. фильтры
  if (filters.categoryId) {
    items = items.filter(e => e.categoryId === filters.categoryId);
  }
  if (filters.from) {
    items = items.filter(e => e.date >= filters.from);
  }
  if (filters.to) {
    items = items.filter(e => e.date <= filters.to);
  }
  if (filters.minAmount != null) {
    items = items.filter(e => e.amount >= filters.minAmount);
  }
  if (filters.maxAmount != null) {
    items = items.filter(e => e.amount <= filters.maxAmount);
  }

  // сортировка по дате (desc)
  items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
  return items.map(clone);
}

/**
 * Добавить расход.
 */
export async function addExpense(expense) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');
  if (!expense.amount || expense.amount <= 0) throw new Error('amount должна быть > 0');
  if (!expense.date) throw new Error('date обязательна');
  if (!expense.categoryId) throw new Error('categoryId обязательна');

  const nowMs = now();
  const item = {
    id: expense.id || uid(),
    userId: currentUser.uid,
    amount: Math.round(+(expense.amount || 0) * 100) / 100,
    currency: expense.currency || 'RUB',
    categoryId: expense.categoryId,
    date: expense.date, // YYYY-MM-DD
    description: expense.description || '',
    createdAt: nowMs,
    updatedAt: nowMs,
    syncedBy: currentUser.uid,
  };

  await dbPut(STORE_EXPENSES, item);
  await enqueueSync('expenses', item);

  // запускаем Firebase-слушатель, если ещё не запущен (реальный Firebase)
  if (!isMockMode) startFirebaseListener();

  return clone(item);
}

/**
 * Обновить расход.
 */
export async function updateExpense(id, data) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');

  const existing = await dbGet(STORE_EXPENSES, id);
  if (!existing) throw new Error('Расход не найден');

  const nowMs = now();
  const updated = {
    ...existing,
    ...data,
    id: id, // не допускаем смены id
    userId: existing.userId,
    updatedAt: nowMs,
    syncedBy: currentUser.uid,
  };

  await dbPut(STORE_EXPENSES, updated);
  await enqueueSync('expenses', updated);

  if (!isMockMode) startFirebaseListener();

  return clone(updated);
}

/**
 * Удалить расход.
 */
export async function deleteExpense(id) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');

  const existing = await dbGet(STORE_EXPENSES, id);
  if (!existing) throw new Error('Расход не найден');

  await dbDelete(STORE_EXPENSES, id);
  await enqueueSync('expenses', { ...existing, action: 'delete' });

  if (!isMockMode) startFirebaseListener();
}

/**
 * Получить все категории пользователя.
 */
export async function getCategories() {
  await ensureDb();
  const items = await dbIndexAll(STORE_CATEGORIES, 'userId', currentUser?.uid || '');
  return (items || []).map(clone);
}

/**
 * Добавить категорию.
 */
export async function addCategory(c) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');

  const nowMs = now();
  const item = {
    id: c.id || uid(),
    userId: currentUser.uid,
    name: c.name || 'Без названия',
    color: c.color || '#607D8B',
    icon: c.icon || 'dots',
    createdAt: nowMs,
    updatedAt: nowMs,
    syncedBy: currentUser.uid,
  };

  await dbPut(STORE_CATEGORIES, item);
  await enqueueSync('categories', item);

  if (!isMockMode) startFirebaseListener();

  return clone(item);
}

/**
 * Обновить категорию.
 */
export async function updateCategory(id, data) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');

  const existing = await dbGet(STORE_CATEGORIES, id);
  if (!existing) throw new Error('Категория не найдена');

  const nowMs = now();
  const updated = {
    ...existing,
    ...data,
    id,
    userId: existing.userId,
    updatedAt: nowMs,
    syncedBy: currentUser.uid,
  };

  await dbPut(STORE_CATEGORIES, updated);
  await enqueueSync('categories', updated);

  if (!isMockMode) startFirebaseListener();

  return clone(updated);
}

/**
 * Удалить категорию.
 */
export async function deleteCategory(id) {
  await ensureDb();
  if (!currentUser) throw new Error('Пользователь не авторизован');

  const existing = await dbGet(STORE_CATEGORIES, id);
  if (!existing) throw new Error('Категория не найдена');

  await dbDelete(STORE_CATEGORIES, id);
  await enqueueSync('categories', { ...existing, action: 'delete' });

  if (!isMockMode) startFirebaseListener();
}

// ─── Вспомогательные внутренние функции ──────────────────────────────────

async function ensureDb() {
  if (!db) db = await openDB();
  return db;
}

// ─── Дополнительный API для мок-режима: seed данных ─────────────────────

/**
 * (Полезно для тестов) Залить тестовые данные в mock-хранилище.
 * В mock-режиме читает/пишет localStorage по ключам et_mock_users / et_mock_db_*.
 */
export function mockClearData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('et_mock_users');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('et_mock_')) localStorage.removeItem(key);
  }
}

/**
 * В режиме mock — вернуть сырое состояние БД (для тестов).
 */
export function mockGetDbRoot() {
  if (!isMockMode || !firebaseDb) return null;
  return clone(firebaseDb._roots);
}

// ─── Tab visibility: пытаемся синхронизироваться при возвращении ────────

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && navigator.onLine && currentUser) {
      const queue = await dbAll(STORE_SYNC_QUEUE);
      if (queue.length > 0) {
        setSyncStatus('syncing', 'Фоновая синхронизация...');
        pendingWrites = queue;
        await flushSyncQueue();
      }
    }
  });
}

// ─── Точка входа по умолчанию (для удобства импорта) ────────────────────
export default {
  initFirebase,
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  onAuthStateChanged,
  onSyncStatus,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  mockClearData,
  mockGetDbRoot,
  isMockMode,
};
