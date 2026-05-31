document.addEventListener('DOMContentLoaded', () => {
  // Client-side authentication guard for cart pages
  if (!API.isLoggedIn()) {
    API.showToast('Please login to manage your shopping cart.', 'warning');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 1200);
    return;
  }

  const path = window.location.pathname;

  if (path.includes('cart.html')) {
    loadShoppingCart();
  } else if (path.includes('checkout.html')) {
    loadCheckoutSummary();
  }
});

let appliedCoupon = null; // Stores applied coupon object { code, discount }

// --- 1. Shopping Cart Management ---
async function loadShoppingCart() {
  const container = document.getElementById('cart-items-container');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const checkoutBtn = document.getElementById('btn-cart-checkout');
  
  const couponInput = document.getElementById('cart-coupon-input');
  const couponBtn = document.getElementById('btn-apply-coupon');
  const couponDiscountRow = document.getElementById('cart-coupon-discount-row');
  const couponDiscountVal = document.getElementById('cart-coupon-discount-val');

  if (!container) return;

  try {
    const res = await API.get('/cart');
    if (res.success) {
      if (res.cart.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:4rem 0;">
            <i class="fa-solid fa-cart-shopping" style="font-size:4rem; margin-bottom:1.5rem; color:var(--border-color);"></i>
            <h3>Your shopping cart is empty</h3>
            <p style="color:var(--text-muted); margin-bottom:2rem; margin-top:0.5rem;">Add some items from the catalog to proceed.</p>
            <a href="/pages/products.html" class="btn btn-primary">Start Shopping</a>
          </div>
        `;
        if (subtotalEl) subtotalEl.innerText = '₹0.00';
        if (totalEl) totalEl.innerText = '₹0.00';
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
      }

      if (checkoutBtn) checkoutBtn.style.display = 'inline-flex';

      // Render cart items
      container.innerHTML = res.cart.map(item => {
        const itemPrice = item.price * (1 - item.discount / 100);
        const lineTotal = (itemPrice * item.quantity).toFixed(2);

        return `
          <div class="cart-item" id="cart-item-${item.product_id}">
            <img src="${item.image || 'https://via.placeholder.com/100'}" class="cart-item-img" />
            <div class="cart-item-details">
              <a href="/pages/product-details.html?id=${item.product_id}"><h4 class="cart-item-title">${item.name}</h4></a>
              <span style="font-size:0.8rem; color:var(--text-muted);">₹${itemPrice.toFixed(2)} each</span>
              <div class="cart-item-qty">
                <button class="qty-btn" data-action="qty-update" data-product-id="${item.product_id}" data-qty="${item.quantity - 1}">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn" data-action="qty-update" data-product-id="${item.product_id}" data-qty="${item.quantity + 1}">+</button>
              </div>
            </div>
            <div class="cart-item-price-box">
              <div class="cart-item-price">₹${lineTotal}</div>
              <button class="cart-item-remove" data-action="remove-cart" data-product-id="${item.product_id}" title="Remove item"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `;
      }).join('');

      calculateCartTotals(res.cart);
    }
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger); text-align:center; padding:2rem;">Failed to load shopping cart: ${err.message}</div>`;
  }

  // Coupon Action Binder
  if (couponBtn) {
    couponBtn.onclick = async () => {
      const code = couponInput.value.trim();
      if (!code) {
        API.showToast('Please enter a coupon code.', 'warning');
        return;
      }

      try {
        const valRes = await API.post('/coupons/validate', { code });
        if (valRes.success) {
          appliedCoupon = { code: valRes.code, discount: parseFloat(valRes.discount) };
          API.showToast(`Coupon ${valRes.code} applied: ${valRes.discount}% OFF!`, 'success');
          
          // Re-load cart to re-calc totals with coupon
          const cartRes = await API.get('/cart');
          if (cartRes.success) calculateCartTotals(cartRes.cart);
        }
      } catch (err) {
        API.showToast(err.message, 'error');
        appliedCoupon = null;
        if (couponDiscountRow) couponDiscountRow.style.display = 'none';
      }
    };
  }
}

function calculateCartTotals(cartItems) {
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  const couponDiscountRow = document.getElementById('cart-coupon-discount-row');
  const couponDiscountVal = document.getElementById('cart-coupon-discount-val');

  let subtotal = 0;
  cartItems.forEach(item => {
    const discountedPrice = item.price * (1 - item.discount / 100);
    subtotal += discountedPrice * item.quantity;
  });

  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;

  let total = subtotal;
  if (appliedCoupon) {
    const discount = subtotal * (appliedCoupon.discount / 100);
    total = Math.max(0, subtotal - discount);

    if (couponDiscountRow && couponDiscountVal) {
      couponDiscountVal.innerText = `-₹${discount.toFixed(2)} (${appliedCoupon.discount}%)`;
      couponDiscountRow.style.display = 'flex';
    }
    // Store coupon locally for checkout session
    sessionStorage.setItem('oneclick_applied_coupon', JSON.stringify(appliedCoupon));
  } else {
    if (couponDiscountRow) couponDiscountRow.style.display = 'none';
    sessionStorage.removeItem('oneclick_applied_coupon');
  }

  if (totalEl) totalEl.innerText = `₹${total.toFixed(2)}`;
}

async function updateItemQuantity(productId, newQty) {
  if (newQty <= 0) {
    removeCartItem(productId);
    return;
  }

  try {
    const res = await API.put('/cart', { product_id: productId, quantity: newQty });
    if (res.success) {
      loadShoppingCart(); // reload list
      updateCartAndWishlistBadges();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function removeCartItem(productId) {
  try {
    const res = await API.delete(`/cart/${productId}`);
    if (res.success) {
      API.showToast('Item removed from cart.', 'success');
      const itemEl = document.getElementById(`cart-item-${productId}`);
      if (itemEl) itemEl.remove();
      loadShoppingCart(); // refresh calculations
      updateCartAndWishlistBadges();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 2. Checkout Workflow ---
async function loadCheckoutSummary() {
  const summaryList = document.getElementById('checkout-items-summary');
  const subtotalEl = document.getElementById('checkout-subtotal');
  const totalEl = document.getElementById('checkout-total');
  const discountRow = document.getElementById('checkout-coupon-row');
  const discountVal = document.getElementById('checkout-coupon-val');
  const addressInput = document.getElementById('checkout-address');
  const checkoutForm = document.getElementById('form-checkout');

  if (!summaryList) return;

  // Retrieve coupon from session storage
  const storedCoupon = sessionStorage.getItem('oneclick_applied_coupon');
  const couponObj = storedCoupon ? JSON.parse(storedCoupon) : null;

  try {
    // 1. Fetch address of user to populate default
    const userRes = await API.get('/auth/profile');
    if (userRes.success && addressInput) {
      addressInput.value = userRes.user.address || '';
    }

    // 2. Fetch cart contents to populate summary
    const cartRes = await API.get('/cart');
    if (cartRes.success) {
      if (cartRes.cart.length === 0) {
        window.location.href = '/pages/cart.html';
        return;
      }

      summaryList.innerHTML = cartRes.cart.map(item => {
        const itemPrice = item.price * (1 - item.discount / 100);
        return `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem;">
            <span style="color:var(--text-muted);">${item.name} <strong style="color:white;">x ${item.quantity}</strong></span>
            <span style="font-weight:600;">₹${(itemPrice * item.quantity).toFixed(2)}</span>
          </div>
        `;
      }).join('');

      // Math calculations
      let subtotal = 0;
      cartRes.cart.forEach(item => {
        const discountedPrice = item.price * (1 - item.discount / 100);
        subtotal += discountedPrice * item.quantity;
      });

      if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;

      let total = subtotal;
      if (couponObj) {
        const discountAmt = subtotal * (couponObj.discount / 100);
        total = Math.max(0, subtotal - discountAmt);

        if (discountRow && discountVal) {
          discountVal.innerText = `-₹${discountAmt.toFixed(2)} (${couponObj.discount}% off via ${couponObj.code})`;
          discountRow.style.display = 'flex';
        }
      } else {
        if (discountRow) discountRow.style.display = 'none';
      }

      if (totalEl) totalEl.innerText = `₹${total.toFixed(2)}`;
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }

  // 3. Checkout submission
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const shipping_address = addressInput.value;
      const payment_method = document.querySelector('input[name="payment_method"]:checked').value;
      const payload = {
        shipping_address,
        payment_method,
        coupon_code: couponObj ? couponObj.code : null
      };

      try {
        const res = await API.post('/orders', payload);
        if (res.success) {
          // Clear session coupon
          sessionStorage.removeItem('oneclick_applied_coupon');
          updateCartAndWishlistBadges();
          
          API.showToast('Order placed successfully!', 'success');
          
          // Redirect to tracking page
          setTimeout(() => {
            window.location.href = `/pages/order-tracking.html?id=${res.orderId}`;
          }, 1500);
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    });
  }
}

// Bind to window for onclick handlers
window.updateItemQuantity = updateItemQuantity;
window.removeCartItem = removeCartItem;

// Event delegation for cart actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const productId = parseInt(btn.dataset.productId, 10);
  if (!productId) return;

  if (action === 'qty-update') {
    const qty = parseInt(btn.dataset.qty, 10);
    updateItemQuantity(productId, qty);
  } else if (action === 'remove-cart') {
    removeCartItem(productId);
  }
});
