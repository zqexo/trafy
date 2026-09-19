function showToast(message, duration = 2400) {
  // Создаём toast-элемент динамически, если отсутствует в DOM
  let toast = document.getElementById('app-toast');
  let text  = document.getElementById('app-toast-text');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast hidden';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const icon = document.createElement('i');
    icon.className = 'ph ph-info';
    icon.setAttribute('aria-hidden', 'true');
    text = document.createElement('span');
    text.id = 'app-toast-text';
    toast.append(icon, text);
    document.body.appendChild(toast);
  }
  if (!text) {
    text = document.createElement('span');
    text.id = 'app-toast-text';
    toast.appendChild(text);
  }
  clearTimeout(toastTimer);
  text.textContent = message;
  toast.classList.remove('hidden');
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}
