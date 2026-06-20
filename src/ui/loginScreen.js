import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } from '../core/auth.js';

// ─── Renderizar Tela de Login ─────────────────────────────────────────────────

export function showLoginScreen(onSuccess) {
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  _bindEvents(overlay, onSuccess);
}

export function hideLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// ─── Binding de Eventos ───────────────────────────────────────────────────────

function _bindEvents(overlay, onSuccess) {
  const googleBtn    = overlay.querySelector('#btn-google');
  const emailForm    = overlay.querySelector('#email-form');
  const emailInput   = overlay.querySelector('#login-email');
  const passInput    = overlay.querySelector('#login-password');
  const btnLogin     = overlay.querySelector('#btn-email-login');
  const btnRegister  = overlay.querySelector('#btn-email-register');
  const btnReset     = overlay.querySelector('#btn-reset-password');
  const toggleEmail  = overlay.querySelector('#toggle-email-form');
  const errorMsg     = overlay.querySelector('#login-error');

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 5000);
  }

  // Mostrar/ocultar formulário de e-mail
  toggleEmail?.addEventListener('click', () => {
    emailForm.classList.toggle('hidden');
  });

  // Google
  googleBtn?.addEventListener('click', async () => {
    try {
      googleBtn.disabled = true;
      googleBtn.textContent = 'Invocando portal…';
      const user = await loginWithGoogle();
      onSuccess(user);
    } catch (e) {
      googleBtn.disabled = false;
      googleBtn.textContent = 'Entrar com Google';
      showError(_friendlyError(e.code));
    }
  });

  // E-mail login
  btnLogin?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    if (!email || !pass) { showError('Preencha e-mail e senha, herói preguiçoso.'); return; }
    try {
      btnLogin.disabled = true;
      const user = await loginWithEmail(email, pass);
      onSuccess(user);
    } catch (e) {
      btnLogin.disabled = false;
      showError(_friendlyError(e.code));
    }
  });

  // Cadastro
  btnRegister?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    if (!email || !pass) { showError('Preencha e-mail e senha para se alistar.'); return; }
    if (pass.length < 6)  { showError('A senha precisa ter ao menos 6 caracteres. Segurança mínima!'); return; }
    try {
      btnRegister.disabled = true;
      const user = await registerWithEmail(email, pass);
      onSuccess(user);
    } catch (e) {
      btnRegister.disabled = false;
      showError(_friendlyError(e.code));
    }
  });

  // Reset de senha
  btnReset?.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) { showError('Digite o e-mail para redefinir a senha.'); return; }
    try {
      await resetPassword(email);
      showError('E-mail de redefinição enviado! (Olha no spam, aventureiro.)');
    } catch (e) {
      showError(_friendlyError(e.code));
    }
  });
}

// ─── Mensagens de Erro Humanizadas ───────────────────────────────────────────

function _friendlyError(code) {
  const msgs = {
    'auth/invalid-email':            'E-mail inválido. Tente algo como guerreiro@reino.com.',
    'auth/user-not-found':           'Nenhum herói com esse e-mail. Ainda não se alistou?',
    'auth/wrong-password':           'Senha errada. Seus heróis ficaram decepcionados.',
    'auth/email-already-in-use':     'Já existe um herói com esse e-mail. Faça login!',
    'auth/weak-password':            'Senha fraca demais até para um goblin adivinhar.',
    'auth/popup-closed-by-user':     'Fechou o portal antes de entrar. Covardia!',
    'auth/network-request-failed':   'Sem conexão. Até os mensageiros precisam de estrada.',
    'auth/too-many-requests':        'Muitas tentativas. Descanse um pouco (como seus heróis).',
    'auth/invalid-credential':       'E-mail ou senha incorretos.',
  };
  return msgs[code] || `Erro inesperado: ${code}`;
}
