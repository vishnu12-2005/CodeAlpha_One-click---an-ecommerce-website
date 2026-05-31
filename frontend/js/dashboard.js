document.addEventListener('DOMContentLoaded', () => {
  // Client-side authentication guard for customer pages
  if (!API.isLoggedIn()) {
    API.showToast('Please login to access your account dashboard.', 'warning');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 1200);
    return;
  }

  const path = window.location.pathname;

  if (path.includes('dashboard.html')) {
    loadDashboardSummary();
  } else if (path.includes('profile.html')) {
    loadProfileDetails();
  } else if (path.includes('orders.html')) {
    loadOrdersHistory();
  } else if (path.includes('wishlist.html')) {
    loadWishlistPage();
  } else if (path.includes('order-tracking.html')) {
    loadOrderTrackingDetails();
  }
});

// --- 1. Dashboard Summary Overview ---
async function loadDashboardSummary() {
  const welcomeText = document.getElementById('dash-welcome');
  const countOrders = document.getElementById('dash-count-orders');
  const countWish = document.getElementById('dash-count-wishlist');
  const summaryOrders = document.getElementById('dash-recent-orders');

  const user = API.getUser();
  if (welcomeText && user) {
    welcomeText.innerText = `Welcome, ${user.name}!`;
  }

  try {
    const ordersRes = await API.get('/orders');
    const wishRes = await API.get('/wishlist');

    if (ordersRes.success) {
      if (countOrders) countOrders.innerText = ordersRes.orders.length;
      
      if (summaryOrders) {
        if (ordersRes.orders.length === 0) {
          summaryOrders.innerHTML = '<p style="color:var(--text-muted); padding:1rem 0;">You haven\'t placed any orders yet.</p>';
        } else {
          // Render top 3 recent orders
          summaryOrders.innerHTML = ordersRes.orders.slice(0, 3).map(o => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 0; border-bottom:1px solid var(--border-color);">
              <div>
                <div style="font-weight:600;">Order #${o.id}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span class="badge ${o.order_status === 'Delivered' ? 'badge-success' : o.order_status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}">${o.order_status}</span>
              </div>
              <div style="font-weight:700;">₹${o.total_amount}</div>
              <div>
                <a href="/pages/order-tracking.html?id=${o.id}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-map-location-dot"></i> Track</a>
              </div>
            </div>
          `).join('');
        }
      }
    }

    if (wishRes.success && countWish) {
      countWish.innerText = wishRes.wishlist.length;
    }
  } catch (err) {
    console.error('Summary dashboard load error:', err.message);
  }
}

// --- 2. Profile Management ---
async function loadProfileDetails() {
  const profileForm = document.getElementById('form-edit-profile');
  const passwordForm = document.getElementById('form-edit-password');

  const nameInput = document.getElementById('profile-name');
  const phoneInput = document.getElementById('profile-phone');
  const addressInput = document.getElementById('profile-address');

  // Load current details
  try {
    const res = await API.get('/auth/profile');
    if (res.success) {
      const u = res.user;
      if (nameInput) nameInput.value = u.name || '';
      if (phoneInput) phoneInput.value = u.phone || '';
      if (addressInput) addressInput.value = u.address || '';
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }

  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await API.put('/auth/profile', {
          name: nameInput.value,
          phone: phoneInput.value,
          address: addressInput.value
        });
        if (res.success) {
          // Update cached user object (name might change)
          const userObj = API.getUser();
          userObj.name = nameInput.value;
          API.setUser(userObj);
          
          API.showToast('Profile changes saved successfully.', 'success');
          updateCartAndWishlistBadges(); // sync navbar letters
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('profile-curr-pass').value;
      const newPassword = document.getElementById('profile-new-pass').value;

      try {
        const res = await API.put('/auth/change-password', { currentPassword, newPassword });
        if (res.success) {
          API.showToast('Password changed successfully.', 'success');
          passwordForm.reset();
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }
}

// --- 3. Saved Wishlist Page ---
async function loadWishlistPage() {
  const container = document.getElementById('wishlist-grid-container');
  if (!container) return;

  try {
    const res = await API.get('/wishlist');
    if (res.success) {
      if (res.wishlist.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:4rem; color:var(--text-muted);"><i class="fa-solid fa-heart-broken" style="font-size:3rem; margin-bottom:1rem; color:var(--border-color);"></i><p>Your wishlist is empty.</p><a href="/pages/products.html" class="btn btn-primary" style="margin-top:1rem;">Continue Shopping</a></div>';
        return;
      }

      container.innerHTML = res.wishlist.map(w => {
        const discountedPrice = (w.price * (1 - w.discount / 100)).toFixed(2);
        return `
          <div class="product-card" id="wish-card-${w.product_id}">
            <div class="product-card-image-box" style="height:200px;">
              <img src="${w.image || 'https://via.placeholder.com/300x200?text=No+Image'}" class="product-card-img" data-action="quickview" data-product-id="${w.product_id}" style="cursor: pointer;" />
              <button class="product-wishlist-btn active" data-action="remove-wishlist" data-product-id="${w.product_id}" title="Remove">
                <i class="fa-solid fa-heart"></i>
              </button>
            </div>
            <div class="product-card-details">
              <a href="/pages/product-details.html?id=${w.product_id}"><h3 class="product-card-title">${w.name}</h3></a>
              <div class="product-card-footer" style="margin-top:1rem;">
                <div class="product-price-box">
                  <span class="product-price-current">₹${discountedPrice}</span>
                </div>
                <button class="btn btn-primary btn-sm" data-action="add-to-cart" data-product-id="${w.product_id}">
                  <i class="fa-solid fa-cart-plus"></i> Add
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--danger);">${err.message}</div>`;
  }
}

async function removeWishlistItem(productId) {
  try {
    const res = await API.delete(`/wishlist/${productId}`);
    if (res.success) {
      API.showToast('Removed from wishlist.', 'success');
      const el = document.getElementById(`wish-card-${productId}`);
      if (el) el.remove();
      loadWishlistPage(); // reload summary or refresh state
      updateCartAndWishlistBadges();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 4. Customer Order History ---
async function loadOrdersHistory() {
  const container = document.getElementById('orders-history-list');
  if (!container) return;

  try {
    const res = await API.get('/orders');
    if (res.success) {
      if (res.orders.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:3rem 0;">You have not placed any orders yet.</p>';
        return;
      }

      container.innerHTML = res.orders.map(o => {
        const canCancel = o.order_status === 'Pending' || o.order_status === 'Confirmed';
        const badgeClass = o.order_status === 'Delivered' ? 'badge-success' : o.order_status === 'Cancelled' ? 'badge-danger' : 'badge-warning';

        return `
          <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:1rem; padding:1.5rem; margin-bottom:1.5rem; display:flex; flex-direction:column; gap:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem;">
              <div>
                <span style="color:var(--text-muted); font-size:0.85rem;">Order ID</span>
                <h4 style="font-size:1.1rem; color:var(--primary);">#${o.id}</h4>
              </div>
              <div>
                <span style="color:var(--text-muted); font-size:0.85rem;">Placed On</span>
                <div style="font-weight:500;">${new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span style="color:var(--text-muted); font-size:0.85rem;">Total Amount</span>
                <div style="font-weight:700; color:white;">₹${o.total_amount}</div>
              </div>
              <div>
                <span style="color:var(--text-muted); font-size:0.85rem;">Payment Method</span>
                <div style="font-weight:500;">${o.payment_method} (${o.payment_status})</div>
              </div>
              <div>
                <span class="badge ${badgeClass}" style="padding:0.4rem 0.8rem; font-size:0.8rem;">${o.order_status}</span>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
              <a href="/pages/order-tracking.html?id=${o.id}" class="btn btn-secondary btn-sm"><i class="fa-solid fa-map-location-dot"></i> Track Order</a>
              ${canCancel ? `<button class="btn btn-danger btn-sm" data-action="cancel-order" data-order-id="${o.id}"><i class="fa-solid fa-xmark"></i> Cancel Order</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger); text-align:center;">Failed to load order history: ${err.message}</p>`;
  }
}

async function cancelCustomerOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order? This will replenish stock.')) return;
  try {
    const res = await API.put(`/orders/${orderId}/cancel`, {});
    if (res.success) {
      API.showToast(res.message, 'success');
      loadOrdersHistory(); // reload history
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 5. Order Tracking Visualizer ---
async function loadOrderTrackingDetails() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  
  const idText = document.getElementById('track-order-id');
  const detailsBox = document.getElementById('track-items-summary');
  const stepsContainer = document.getElementById('track-timeline-steps');

  if (!id) {
    window.location.href = '/pages/orders.html';
    return;
  }

  if (idText) idText.innerText = `#${id}`;

  try {
    const res = await API.get(`/orders/${id}`);
    if (res.success && stepsContainer) {
      const order = res.order;
      const items = res.items;

      // Status lists mapping order status workflow
      const statuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered'];
      const currentIdx = statuses.indexOf(order.order_status);

      // Handle custom cancellation states
      if (currentIdx === -1) {
        stepsContainer.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:2rem; background:rgba(239,68,68,0.1); border:1px solid var(--danger); border-radius:1rem;">
            <h3 style="color:var(--danger); margin-bottom:0.5rem;"><i class="fa-solid fa-circle-xmark"></i> Order Status: ${order.order_status}</h3>
            <p style="color:var(--text-muted); font-size:0.95rem;">This order has been processed as ${order.order_status.toLowerCase()} and cannot be actively tracked on the delivery timeline.</p>
          </div>
        `;
      } else {
        stepsContainer.innerHTML = statuses.map((step, idx) => {
          const isActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          
          let icon = 'fa-circle';
          if (step === 'Pending') icon = 'fa-receipt';
          if (step === 'Confirmed') icon = 'fa-circle-check';
          if (step === 'Packed') icon = 'fa-box';
          if (step === 'Shipped') icon = 'fa-truck';
          if (step === 'Out For Delivery') icon = 'fa-motorcycle';
          if (step === 'Delivered') icon = 'fa-house-circle-check';

          return `
            <div style="display:flex; flex-direction:column; align-items:center; position:relative; flex:1; text-align:center; min-width:80px;">
              <div style="width:40px; height:40px; border-radius:50%; background-color:${isActive ? 'var(--primary)' : 'var(--bg-main)'}; border:2px solid ${isCurrent ? 'white' : 'var(--border-color)'}; display:flex; align-items:center; justify-content:center; color:${isActive ? 'white' : 'var(--text-muted)'}; font-size:1.1rem; box-shadow:${isCurrent ? '0 0 15px var(--primary)' : 'none'}; z-index:2;">
                <i class="fa-solid ${icon}"></i>
              </div>
              <h5 style="margin-top:0.75rem; font-size:0.85rem; color:${isActive ? 'white' : 'var(--text-muted)'}; font-weight:${isCurrent ? '700' : '500'};">${step}</h5>
            </div>
          `;
        }).join('');
      }

      // Render items summary inside details box
      if (detailsBox) {
        detailsBox.innerHTML = `
          <div style="margin-bottom:1.5rem;">
            <h4 style="margin-bottom:0.5rem;">Shipping Address</h4>
            <p style="color:var(--text-muted); font-size:0.95rem; border-left:2px solid var(--primary); padding-left:0.75rem;">${order.shipping_address}</p>
          </div>
          
          <h4 style="margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">Products Ordered</h4>
          ${items.map(item => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 0; border-bottom:1px dotted var(--border-color);">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <img src="${item.image || 'https://via.placeholder.com/50'}" style="width:40px; height:40px; object-fit:cover; border-radius:0.25rem;" />
                <div>
                  <div style="font-weight:600; font-size:0.9rem;">${item.name}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">Qty: ${item.quantity}</div>
                </div>
              </div>
              <div style="font-weight:600; font-size:0.95rem;">₹${(item.price * item.quantity).toFixed(2)}</div>
            </div>
          `).join('')}

          <div style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:1.1rem; border-top:1px solid var(--border-color); padding-top:1rem;">
            <span>Total Payment</span>
            <span style="color:var(--primary);">₹${order.total_amount}</span>
          </div>
        `;
      }
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// Global scope binding for callbacks
window.removeWishlistItem = removeWishlistItem;
window.cancelCustomerOrder = cancelCustomerOrder;

// Event delegation for dashboard actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  if (action === 'remove-wishlist') {
    const productId = parseInt(btn.dataset.productId, 10);
    if (productId) removeWishlistItem(productId);
  } else if (action === 'add-to-cart') {
    const productId = parseInt(btn.dataset.productId, 10);
    if (productId) handleAddToCart(productId);
  } else if (action === 'cancel-order') {
    const orderId = parseInt(btn.dataset.orderId, 10);
    if (orderId) cancelCustomerOrder(orderId);
  } else if (action === 'quickview') {
    const productId = parseInt(btn.dataset.productId, 10);
    if (productId && window.triggerQuickView) window.triggerQuickView(productId);
  }
});
