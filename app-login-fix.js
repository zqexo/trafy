function renderLoginScreen() {
  const userList = $('#user-list');
  if (!userList) return;
  userList.innerHTML = '';

  MOCK_USERS.forEach(user => {
    const card = el('div', {
      className: 'user-list-card',
      role: 'option',
      'aria-selected': false,
      'data-userId': user.id,
      onClick: () => selectUser(user.id),
      onKeydown: (e) => { if (e.key === 'Enter') selectUser(user.id); },
    });

    const avatar = el('div', {
      className: 'user-list-avatar',
      style: { background: user.color },
    }, [user.displayName.charAt(0).toUpperCase()]);

    const info = el('div', { className: 'user-list-info' });
    info.appendChild(el('div', { className: 'user-list-name' }, [user.displayName]));
    info.appendChild(el('div', { className: 'user-list-email' }, [user.email]));

    const check = el('div', { className: 'user-list-check' });
    check.appendChild(el('i', { className: 'ph ph-check' }));

    card.append(avatar, info, check);
    userList.appendChild(card);
  });

  // Показать форму входа если пользователь выбран (из localStorage)
  const loginForm = $('#login-form');
  const registerEl = $('#login-register');
  if (loginForm) {
    const savedUserId = loginForm.dataset.userId;
    if (savedUserId) {
      const savedUser = MOCK_USERS.find(u => u.id === savedUserId);
      if (savedUser) {
        loginForm.classList.remove('hidden');
        $('#input-email').value = savedUser.email;
      }
    } else {
      loginForm.classList.add('hidden');
    }
  }
  if (registerEl) registerEl.classList.add('hidden');

  // Регистрация
  $('button#btn-register')?.addEventListener('click', handleRegister);
  $('button#btn-login-submit')?.addEventListener('click', handleLoginSubmit);
  $('button#btn-forgot')?.addEventListener('click', () => {
    showToast('Восстановление пароля через Email — в продакшене 🔐');
  });
}
