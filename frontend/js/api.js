const API_BASE = '/api';
const TOKEN_KEY = 'oneclick_token';
const USER_KEY = 'oneclick_user';

// Safe storage wrapper to prevent crashes in private/sandboxed browser environments
const safeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage read blocked, using memory fallback:', e.message);
      return window.__memoryStorage?.[key] || null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage write blocked, using memory fallback:', e.message);
      if (!window.__memoryStorage) window.__memoryStorage = {};
      window.__memoryStorage[key] = value;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage remove blocked, using memory fallback:', e.message);
      if (window.__memoryStorage) delete window.__memoryStorage[key];
    }
  }
};

const API = {
  // --- Token Management ---
  getToken: () => safeStorage.getItem(TOKEN_KEY),
  
  setToken: (token) => safeStorage.setItem(TOKEN_KEY, token),
  
  clearToken: () => safeStorage.removeItem(TOKEN_KEY),

  // --- User Management ---
  getUser: () => {
    const user = safeStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser: (user) => safeStorage.setItem(USER_KEY, JSON.stringify(user)),

  clearUser: () => safeStorage.removeItem(USER_KEY),

  isLoggedIn: () => !!API.getToken(),

  isAdmin: () => {
    const user = API.getUser();
    return user && user.role === 'admin';
  },

  logout: () => {
    API.clearToken();
    API.clearUser();
    API.showToast('Logged out successfully.', 'success');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 1000);
  },

  // --- REST Fetch Wrapper ---
  request: async (endpoint, options = {}) => {
    const token = API.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        throw new Error('Server connectivity issue. Make sure the Node.js backend server is running instead of a static Python/web server.');
      }

      if (!response.ok) {
        // If unauthorized/token expired
        if (response.status === 401 && API.isLoggedIn()) {
          API.clearToken();
          API.clearUser();
          API.showToast('Session expired. Please log in again.', 'error');
          setTimeout(() => {
            window.location.href = '/pages/login.html';
          }, 1500);
        }
        throw new Error(data.message || 'Something went wrong.');
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err.message);
      throw err;
    }
  },

  get: (endpoint) => API.request(endpoint, { method: 'GET' }),

  post: (endpoint, body) => API.request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  }),

  put: (endpoint, body) => API.request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  }),

  delete: (endpoint) => API.request(endpoint, { method: 'DELETE' }),

  // --- Premium Toast Notification System ---
  showToast: (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-triangle-exclamation';
    if (type === 'warning') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove toast after 3.5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s reverse forwards';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }
};

// Global exports if loaded in browser
window.API = API;

// Global error monitoring for easier debugging
window.addEventListener('error', (event) => {
  console.error('Global Error Caught:', event.error);
  if (window.API && window.API.showToast) {
    window.API.showToast(`Browser JS Error: ${event.message}`, 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  if (window.API && window.API.showToast) {
    const msg = event.reason && event.reason.message ? event.reason.message : event.reason;
    window.API.showToast(`Network/API Error: ${msg}`, 'error');
  }
});
