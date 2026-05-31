document.addEventListener('DOMContentLoaded', () => {
  initLayout();
});

async function initLayout() {
  // 1. Inject Navbar
  const header = document.querySelector('header');
  if (header) {
    header.outerHTML = renderNavbar();
    bindNavbarEvents();
  }

  // 2. Inject Footer
  const footer = document.querySelector('footer');
  if (footer) {
    footer.outerHTML = renderFooter();
  }

  // 3. Inject User Dashboard Sidebar
  const userSidebarContainer = document.getElementById('user-sidebar-container');
  if (userSidebarContainer) {
    userSidebarContainer.innerHTML = renderUserSidebar();
  }

  // 4. Inject Admin Sidebar and Route Protection
  const adminSidebarContainer = document.getElementById('admin-sidebar-container');
  if (adminSidebarContainer) {
    // Front-end route protection: redirect non-admins
    if (!API.isLoggedIn() || !API.isAdmin()) {
      API.showToast('Access denied: Administrators only.', 'error');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
      return;
    }
    adminSidebarContainer.innerHTML = renderAdminSidebar();
  }

  // 5. Fetch Cart & Wishlist counters if logged in
  if (API.isLoggedIn()) {
    try {
      updateCartAndWishlistBadges();
    } catch (e) {
      console.warn('Could not sync badges on initial load:', e.message);
    }
  }
}

function renderNavbar() {
  const isLoggedIn = API.isLoggedIn();
  const user = API.getUser();
  const isAdmin = API.isAdmin();

  let userMenuHTML = '';
  if (isLoggedIn && user) {
    userMenuHTML = `
      <div class="user-menu">
        <button class="user-menu-btn" id="user-menu-trigger">
          <i class="fa-solid fa-user-circle"></i>
          <span>Hi, ${user.name.split(' ')[0]}</span>
          <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem;"></i>
        </button>
        <div class="user-dropdown" id="user-dropdown-menu">
          ${isAdmin ? `<a href="/pages/admin-dashboard.html" class="dropdown-item"><i class="fa-solid fa-user-shield"></i> Admin Panel</a>` : ''}
          <a href="/pages/dashboard.html" class="dropdown-item"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
          <a href="/pages/profile.html" class="dropdown-item"><i class="fa-solid fa-address-card"></i> My Profile</a>
          <a href="/pages/orders.html" class="dropdown-item"><i class="fa-solid fa-box"></i> Order History</a>
          <div class="dropdown-divider"></div>
          <a href="#" class="dropdown-item" id="logout-button"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
        </div>
      </div>
    `;
  } else {
    userMenuHTML = `
      <a href="/pages/login.html" class="btn btn-secondary btn-sm" style="padding: 0.5rem 1rem;">
        <i class="fa-solid fa-right-to-bracket"></i> Login
      </a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem;">
        Sign Up
      </a>
    `;
  }

  return `
    <header>
      <nav class="navbar">
        <div class="container navbar-container">
          <a href="/index.html" class="navbar-brand" style="display:flex; align-items:center; gap:0.5rem;">
            <img src="/images/logo.jpg" alt="OneClick Logo" style="height:32px; border-radius:0.25rem;" />
            One<span>Click</span>
          </a>

          <div class="search-bar-wrapper">
            <input type="text" class="search-input" id="navbar-search" placeholder="Search products, brands and categories..." />
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
          </div>

          <div class="nav-links">
            <a href="/pages/products.html" class="nav-link"><i class="fa-solid fa-store"></i> Shop</a>
            <a href="/pages/wishlist.html" class="nav-link">
              <i class="fa-solid fa-heart"></i>
              <span class="nav-icon-badge" id="wishlist-badge" style="display:none;">0</span>
            </a>
            <a href="/pages/cart.html" class="nav-link">
              <i class="fa-solid fa-shopping-cart"></i>
              <span class="nav-icon-badge" id="cart-badge" style="display:none;">0</span>
            </a>
            ${userMenuHTML}
          </div>
        </div>
      </nav>
      <div class="category-nav">
        <div class="container category-nav-container">
          <a href="/pages/products.html" class="category-nav-link">All Products</a>
          <a href="/pages/products.html?category=Electronics" class="category-nav-link">Electronics</a>
          <a href="/pages/products.html?category=Fashion" class="category-nav-link">Fashion</a>
          <a href="/pages/products.html?category=Books" class="category-nav-link">Books</a>
          <a href="/pages/products.html?category=Home%20%26%20Kitchen" class="category-nav-link">Home & Kitchen</a>
          <a href="/pages/products.html?category=Groceries" class="category-nav-link">Groceries</a>
          <a href="/pages/products.html?category=Beauty" class="category-nav-link">Beauty</a>
          <a href="/pages/products.html?category=Sports" class="category-nav-link">Sports</a>
          <a href="/pages/products.html?category=Toys" class="category-nav-link">Toys</a>
          <a href="/pages/products.html?category=Mobile%20Accessories" class="category-nav-link">Mobile Accessories</a>
        </div>
      </div>
    </header>
  `;
}

function bindNavbarEvents() {
  // Trigger menu dropdown on click
  const trigger = document.getElementById('user-menu-trigger');
  const menu = document.getElementById('user-dropdown-menu');

  if (trigger && menu) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      menu.classList.remove('show');
    });
  }

  // Logout binder
  const logoutBtn = document.getElementById('logout-button');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      API.logout();
    });
  }

  // Search input binder
  const searchInput = document.getElementById('navbar-search');
  if (searchInput) {
    // Populate with current query if on products page
    const params = new URLSearchParams(window.location.search);
    if (params.has('search')) {
      searchInput.value = params.get('search');
    }

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim() !== '') {
        window.location.href = `/pages/products.html?search=${encodeURIComponent(searchInput.value.trim())}`;
      }
    });
  }
}

async function updateCartAndWishlistBadges() {
  try {
    const cartRes = await API.get('/cart');
    const wishlistRes = await API.get('/wishlist');

    const cartBadge = document.getElementById('cart-badge');
    if (cartBadge && cartRes.success) {
      const totalItems = cartRes.cart.reduce((sum, item) => sum + item.quantity, 0);
      if (totalItems > 0) {
        cartBadge.innerText = totalItems;
        cartBadge.style.display = 'flex';
      } else {
        cartBadge.style.display = 'none';
      }
    }

    const wishlistBadge = document.getElementById('wishlist-badge');
    if (wishlistBadge && wishlistRes.success) {
      const totalItems = wishlistRes.wishlist.length;
      if (totalItems > 0) {
        wishlistBadge.innerText = totalItems;
        wishlistBadge.style.display = 'flex';
      } else {
        wishlistBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Failed to sync badge counters:', err.message);
  }
}

function renderFooter() {
  return `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <a href="/index.html" class="footer-brand" style="display:inline-flex; align-items:center; gap:0.5rem;"><img src="/images/logo.jpg" alt="OneClick Logo" style="height:28px; border-radius:0.25rem;" /> One<span>Click</span></a>
            <p class="footer-desc">"Everything You Need, One Click Away" - Your premier destination for electronics, fashion, home utilities, groceries, and beauty products.</p>
            <div class="footer-socials">
              <a href="#" class="footer-social-link"><i class="fa-brands fa-facebook-f"></i></a>
              <a href="#" class="footer-social-link"><i class="fa-brands fa-twitter"></i></a>
              <a href="#" class="footer-social-link"><i class="fa-brands fa-instagram"></i></a>
              <a href="#" class="footer-social-link"><i class="fa-brands fa-linkedin-in"></i></a>
            </div>
          </div>
          <div>
            <h4 class="footer-title">Quick Links</h4>
            <ul class="footer-links">
              <li class="footer-link"><a href="/pages/products.html">All Products</a></li>
              <li class="footer-link"><a href="/pages/about.html">About Us</a></li>
              <li class="footer-link"><a href="/pages/contact.html">Contact Us</a></li>
              <li class="footer-link"><a href="#">FAQs</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">Customer Service</h4>
            <ul class="footer-links">
              <li class="footer-link"><a href="/pages/dashboard.html">My Account</a></li>
              <li class="footer-link"><a href="/pages/orders.html">Track Order</a></li>
              <li class="footer-link"><a href="#">Return Policy</a></li>
              <li class="footer-link"><a href="#">Terms & Conditions</a></li>
            </ul>
          </div>
          <div>
            <h4 class="footer-title">Newsletter</h4>
            <p class="footer-desc" style="margin-bottom: 0.75rem;">Subscribe to receive updates on flash sales, new arrivals, and coupons.</p>
            <div class="newsletter-form">
              <input type="email" class="form-control" placeholder="Email address" style="border-radius: 0.5rem 0 0 0.5rem;" />
              <button class="btn btn-primary" style="border-radius: 0 0.5rem 0.5rem 0; padding: 0.5rem 1rem;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
          </div>
        </div>
        <div class="footer-copyright">
          <p>&copy; 2026 OneClick Store. All Rights Reserved. Designed with Dark Premium UI.</p>
        </div>
      </div>
    </footer>
  `;
}

function renderUserSidebar() {
  const currentPath = window.location.pathname;
  return `
    <div class="sidebar">
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="sidebar-avatar-letter">U</div>
        <div>
          <div class="sidebar-username" id="sidebar-user-name">User Account</div>
          <div class="sidebar-useremail" id="sidebar-user-email">user@oneclick.com</div>
        </div>
      </div>
      <ul class="sidebar-menu">
        <li class="sidebar-item ${currentPath.includes('dashboard.html') ? 'active' : ''}">
          <a href="/pages/dashboard.html"><i class="fa-solid fa-chart-line"></i> Dashboard</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('profile.html') ? 'active' : ''}">
          <a href="/pages/profile.html"><i class="fa-solid fa-user-gear"></i> My Profile</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('orders.html') || currentPath.includes('order-tracking.html') ? 'active' : ''}">
          <a href="/pages/orders.html"><i class="fa-solid fa-box-open"></i> Order History</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('wishlist.html') ? 'active' : ''}">
          <a href="/pages/wishlist.html"><i class="fa-solid fa-heart"></i> My Wishlist</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('cart.html') ? 'active' : ''}">
          <a href="/pages/cart.html"><i class="fa-solid fa-shopping-cart"></i> Shopping Cart</a>
        </li>
        <div class="dropdown-divider" style="margin: 0.75rem 0;"></div>
        <li class="sidebar-item">
          <a href="#" id="sidebar-logout"><i class="fa-solid fa-right-from-bracket"></i> Sign Out</a>
        </li>
      </ul>
    </div>
  `;
}

function renderAdminSidebar() {
  const currentPath = window.location.pathname;
  return `
    <div class="sidebar">
      <div class="sidebar-user">
        <div class="sidebar-avatar" style="background-color: var(--success);"><i class="fa-solid fa-user-shield"></i></div>
        <div>
          <div class="sidebar-username">Admin Console</div>
          <div class="sidebar-useremail">Admin Access Granted</div>
        </div>
      </div>
      <ul class="sidebar-menu">
        <li class="sidebar-item ${currentPath.includes('admin-dashboard.html') ? 'active' : ''}">
          <a href="/pages/admin-dashboard.html"><i class="fa-solid fa-gauge"></i> Overview Dashboard</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-products.html') ? 'active' : ''}">
          <a href="/pages/admin-products.html"><i class="fa-solid fa-boxes-packing"></i> Products CRUD</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-categories.html') ? 'active' : ''}">
          <a href="/pages/admin-categories.html"><i class="fa-solid fa-list-ul"></i> Categories</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-orders.html') ? 'active' : ''}">
          <a href="/pages/admin-orders.html"><i class="fa-solid fa-file-invoice-dollar"></i> Customer Orders</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-users.html') ? 'active' : ''}">
          <a href="/pages/admin-users.html"><i class="fa-solid fa-users"></i> Users Audit</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-coupons.html') ? 'active' : ''}">
          <a href="/pages/admin-coupons.html"><i class="fa-solid fa-ticket"></i> Coupons</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-reviews.html') ? 'active' : ''}">
          <a href="/pages/admin-reviews.html"><i class="fa-solid fa-comments"></i> Reviews Moderate</a>
        </li>
        <li class="sidebar-item ${currentPath.includes('admin-analytics.html') ? 'active' : ''}">
          <a href="/pages/admin-analytics.html"><i class="fa-solid fa-chart-pie"></i> Detailed Reports</a>
        </li>
        <div class="dropdown-divider" style="margin: 0.75rem 0;"></div>
        <li class="sidebar-item">
          <a href="/index.html"><i class="fa-solid fa-house"></i> View Storefront</a>
        </li>
        <li class="sidebar-item">
          <a href="#" id="sidebar-admin-logout"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>
        </li>
      </ul>
    </div>
  `;
}

// Sidebar dynamic bindings
document.addEventListener('click', (e) => {
  if (e.target && (e.target.id === 'sidebar-logout' || e.target.id === 'sidebar-admin-logout')) {
    e.preventDefault();
    API.logout();
  }
});

// Update user details inside customer sidebar if page has user-info placeholders
setTimeout(() => {
  const user = API.getUser();
  if (user) {
    const avatar = document.getElementById('sidebar-avatar-letter');
    if (avatar) avatar.innerText = user.name.charAt(0).toUpperCase();

    const username = document.getElementById('sidebar-user-name');
    if (username) username.innerText = user.name;

    const useremail = document.getElementById('sidebar-user-email');
    if (useremail) useremail.innerText = user.email;
  }
}, 50);

// Global export of helper
window.updateCartAndWishlistBadges = updateCartAndWishlistBadges;
