document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const forgotForm = document.getElementById('form-forgot');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await API.post('/auth/login', { email, password });
        if (res.success) {
          API.setToken(res.token);
          API.setUser(res.user);
          API.showToast('Login successful! Redirecting...', 'success');
          
          setTimeout(() => {
            if (res.user.role === 'admin') {
              window.location.href = '/pages/admin-dashboard.html';
            } else {
              window.location.href = '/pages/dashboard.html';
            }
          }, 1000);
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const phone = document.getElementById('register-phone').value;
      const address = document.getElementById('register-address').value;

      try {
        const res = await API.post('/auth/register', { name, email, password, phone, address });
        if (res.success) {
          API.setToken(res.token);
          API.setUser(res.user);
          API.showToast('Registration successful! Welcome.', 'success');
          
          setTimeout(() => {
            window.location.href = '/pages/dashboard.html';
          }, 1000);
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;

      try {
        const res = await API.post('/auth/forgot-password', { email });
        if (res.success) {
          API.showToast(res.message, 'success');
          forgotForm.reset();
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }
});
