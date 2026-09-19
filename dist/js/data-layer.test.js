/**
 * data-layer.test.js — smoke-тесты для data-layer.js в mock-режиме.
 * Запускается в браузере через browser_exec (jsdom недоступен, тестируем через реальный IndexedDB).
 */

// Тесты выполняются в браузере; используем browser_exec с кодом, который
// импортирует data-layer.js через <script type="module">.

const TEST_EMAIL = 'test@example.com';
const TEST_PASS = 'testpass123';
const TEST_DISPLAY = 'Тест Юзер';

async function runTests() {
  const results = [];

  function assert(condition, label) {
    results.push({ label, passed: !!condition, detail: condition ? 'OK' : 'FAIL' });
    if (!condition) console.error('❌', label);
    else console.log('✅', label);
  }

  // 1. Инициализация
  await import('../../frontend/js/data-layer.js').then(async (mod) => {
    const { initFirebase, signUp, signIn, signOut, getCurrentUser,
            addExpense, getExpenses, updateExpense, deleteExpense,
            addCategory, getCategories, updateCategory, deleteCategory,
            onSyncStatus, mockClearData, mockGetDbRoot } = mod;

    // Очищаем мок-данные перед тестом
    mockClearData();

    // init без config → mock
    const fb = await initFirebase(null);
    assert(fb && fb.auth && fb.db, 'initFirebase(null) возвращает mock');
    assert(fb.online() !== undefined, 'initFirebase возвращает online()');

    // 2. Регистрация
    const user = await signUp(TEST_EMAIL, TEST_PASS, TEST_DISPLAY);
    assert(user && user.uid && user.email === TEST_EMAIL, 'signUp создаёт пользователя');
    assert(getCurrentUser()?.uid === user.uid, 'getCurrentUser после signUp');

    // 3. Запуск слушателя синхронизации
    const unsubSync = onSyncStatus((s) => {
      console.log('sync status:', s.state, s.message);
    });

    // 4. Добавление категорий
    const cat1 = await addCategory({ name: 'Тест Категория', color: '#FF0000', icon: 'test' });
    assert(cat1 && cat1.id && cat1.name === 'Тест Категория', 'addCategory возвращает созданную категорию');
    assert(cat1.userId === user.uid, 'addCategory привязывает userId');

    const cat2 = await addCategory({ name: 'Ещё одна', color: '#00FF00' });
    assert(cat2 && cat2.id, 'addCategory v2');

    // 5. Получение категорий
    const cats = await getCategories();
    assert(cats.length >= 2, `getCategories возвращает ≥2 категории (получено ${cats.length})`);
    assert(cats.some(c => c.name === 'Тест Категория'), 'getCategories содержит добавленную категорию');

    // 6. Добавление расходов
    const exp1 = await addExpense({
      amount: 1500.50,
      currency: 'RUB',
      categoryId: cat1.id,
      date: '2026-09-15',
      description: 'Тестовая покупка',
    });
    assert(exp1 && exp1.id && exp1.amount === 1500.5, 'addExpense возвращает с корректным amount');
    assert(exp1.userId === user.uid, 'addExpense userId совпадает');
    assert(exp1.syncedBy === user.uid, 'addExpense syncedBy установлен');

    const exp2 = await addExpense({
      amount: 3200,
      currency: 'RUB',
      categoryId: cat2.id,
      date: '2026-09-16',
      description: 'Ещё трата',
    });
    assert(exp2.amount === 3200, 'addExpense c целым amount');

    // 7. Получение расходов без фильтров
    const allExpenses = await getExpenses();
    assert(allExpenses.length >= 2, `getExpenses без фильтров: ≥2 (получено ${allExpenses.length})`);

    // 8. Получение расходов с фильтром по категории
    const filtered = await getExpenses({ categoryId: cat1.id });
    assert(filtered.length === 1 && filtered[0].id === exp1.id, 'getExpenses с categoryId фильтром');

    // 9. Получение расходов с фильтром по дате
    const byDate = await getExpenses({ from: '2026-09-15' });
    assert(byDate.length >= 2, 'getExpenses с from-фильтром');

    // 10. Обновление расхода
    const updated = await updateExpense(exp1.id, { amount: 2000, description: 'Обновлённая покупка' });
    assert(updated.amount === 2000, 'updateExpense меняет amount');
    assert(updated.description === 'Обновлённая покупка', 'updateExpense меняет description');
    assert(updated.updatedAt > exp1.updatedAt, 'updateExpense увеличивает updatedAt');

    // 11. Удаление расхода
    await deleteExpense(exp2.id);
    const afterDelete = await getExpenses({ categoryId: cat2.id });
    assert(afterDelete.length === 0, 'deleteExpense удаляет из IndexedDB');

    // 12. Обновление категории
    const updatedCat = await updateCategory(cat1.id, { name: 'Переименованная' });
    assert(updatedCat.name === 'Переименованная', 'updateCategory меняет name');

    const catsAfter = await getCategories();
    assert(catsAfter.some(c => c.name === 'Переименованная'), 'getCategories после updateCategory');

    // 13. Удаление категории
    await deleteCategory(cat2.id);
    const catsFinal = await getCategories();
    assert(!catsFinal.some(c => c.name === 'Ещё одна'), 'deleteCategory удаляет категорию');

    // 14. Вход по существующему пользователю
    await signOut();
    assert(getCurrentUser() === null, 'signOut очищает текущего пользователя');

    const user2 = await signIn(TEST_EMAIL, TEST_PASS);
    assert(user2 && user2.uid === user.uid, 'signIn возвращает того же пользователя');
    assert(getCurrentUser()?.email === TEST_EMAIL, 'getCurrentUser после signIn');

    // 15. Ошибка при входе с неверным паролем
    try {
      await signIn(TEST_EMAIL, 'wrongpass');
      assert(false, 'signIn с неверным паролем должен бросить');
    } catch (e) {
      assert(true, 'signIn с неверным паролем бросает ошибку');
    }

    // 16. Статус синхронизации
    let syncState = null;
    const unsub2 = onSyncStatus((s) => { syncState = s; });
    // ждём, пока очередь обработается
    await new Promise(r => setTimeout(r, 1000));
    assert(syncState !== null, 'onSyncStatus вызывается');
    unsub2();

    // 17. Проверка, что данные persisted в mock (localStorage)
    const dbRoot = mockGetDbRoot();
    assert(dbRoot !== null, 'mockGetDbRoot() доступен в мок-режиме');
    const storedUser = JSON.parse(localStorage.getItem('et_mock_users') || '{}');
    assert(storedUser[TEST_EMAIL.toLowerCase()], ' пользователь persists в localStorage');

    // 18. Дефолтные категории при первом входе
    mockClearData();
    await signUp('newperson@test.com', 'pass123', 'Новый');
    const newCats = await getCategories();
    assert(newCats.length >= 6, `дефолтные категории созданы: ${newCats.length} (ожидаемо 6+)`);
    assert(newCats.some(c => c.name === 'Еда'), 'дефолтная категория "Еда" существует');
    assert(newCats.some(c => c.name === 'Транспорт'), 'дефолтная категория "Транспорт" существует');

    unsubSync();
  });

  return results;
}

// Запускаем в контексте browser_exec
runTests().then(results => {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n=== ${passed}/${total} тестов пройдено ===`);
  if (passed < total) {
    console.error('Непрошедшие:');
    results.filter(r => !r.passed).forEach(r => console.error(' -', r.label));
    process.exit(1);
  } else {
    console.log('Все тесты пройдены.');
  }
}).catch(err => {
  console.error('Тестовая среда не загрузилась:', err);
  process.exit(1);
});
