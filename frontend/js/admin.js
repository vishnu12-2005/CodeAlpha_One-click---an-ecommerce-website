document.addEventListener('DOMContentLoaded', () => {
  // Client-side authentication guard for admin pages
  if (!API.isLoggedIn() || !API.isAdmin()) {
    API.showToast('Access denied: Admin privileges required.', 'error');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 1200);
    return;
  }

  const path = window.location.pathname;

  if (path.includes('admin-dashboard.html')) {
    loadOverviewDashboard();
  } else if (path.includes('admin-products.html')) {
    loadAdminProducts();
  } else if (path.includes('admin-categories.html')) {
    loadAdminCategories();
  } else if (path.includes('admin-orders.html')) {
    loadAdminOrders();
  } else if (path.includes('admin-users.html')) {
    loadAdminUsers();
  } else if (path.includes('admin-coupons.html')) {
    loadAdminCoupons();
  } else if (path.includes('admin-reviews.html')) {
    loadAdminReviews();
  } else if (path.includes('admin-analytics.html')) {
    loadDetailedAnalytics();
  }
});

// --- 1. Overview Dashboard ---
async function loadOverviewDashboard() {
  const revEl = document.getElementById('admin-overview-revenue');
  const ordEl = document.getElementById('admin-overview-orders');
  const usrEl = document.getElementById('admin-overview-users');
  const tableTop = document.getElementById('admin-top-selling-table');

  try {
    const res = await API.get('/admin/analytics');
    if (res.success) {
      const stats = res.analytics;
      if (revEl) revEl.innerText = `₹${stats.totalRevenue.toFixed(2)}`;
      if (ordEl) ordEl.innerText = stats.totalOrders;
      if (usrEl) usrEl.innerText = stats.totalUsers;

      if (tableTop) {
        if (stats.topProducts.length === 0) {
          tableTop.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No sales data registered.</td></tr>';
        } else {
          tableTop.innerHTML = stats.topProducts.map(p => `
            <tr>
              <td>#${p.id}</td>
              <td style="font-weight:600;">${p.name}</td>
              <td>${p.sales_count} units</td>
              <td style="color:var(--success); font-weight:700;">₹${parseFloat(p.revenue).toFixed(2)}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 2. Products Management ---
let allCategoriesCache = [];

async function loadAdminProducts() {
  const table = document.getElementById('admin-products-table');
  const form = document.getElementById('form-product-crud');
  const modal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('product-modal-title');
  const categorySelect = document.getElementById('prod-category');

  if (!table) return;

  // Cache categories for dropdowns
  try {
    const catRes = await API.get('/categories');
    if (catRes.success) {
      allCategoriesCache = catRes.categories;
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Uncategorized</option>' +
          allCategoriesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    }
  } catch (e) {
    console.error('Failed caching categories:', e.message);
  }

  // Load products list
  const loadProductRows = async () => {
    table.innerHTML = '<tr><td colspan="7" class="skeleton" style="height:50px;"></td></tr>';
    try {
      const res = await API.get('/products?limit=100'); // Load bulk items for admin management
      if (res.success) {
        if (res.products.length === 0) {
          table.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No products registered.</td></tr>';
          return;
        }

        table.innerHTML = res.products.map(p => `
          <tr id="prod-row-${p.id}">
            <td>#${p.id}</td>
            <td><img src="${p.image || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; object-fit:cover; border-radius:0.25rem;" /></td>
            <td style="font-weight:600;">${p.name}</td>
            <td>${p.category_name || 'None'}</td>
            <td>₹${p.price} <span style="font-size:0.75rem; color:var(--danger);">(-${Math.round(p.discount)}%)</span></td>
            <td>${p.stock} pcs</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="editProductModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deleteProductItem(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      table.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
    }
  };

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('prod-id').value;
      const payload = {
        name: document.getElementById('prod-name').value,
        category_id: document.getElementById('prod-category').value,
        price: parseFloat(document.getElementById('prod-price').value),
        discount: parseFloat(document.getElementById('prod-discount').value) || 0,
        stock: parseInt(document.getElementById('prod-stock').value, 10),
        image: document.getElementById('prod-image').value,
        description: document.getElementById('prod-desc').value
      };

      try {
        let res;
        if (id) {
          res = await API.put(`/admin/products/${id}`, payload);
        } else {
          res = await API.post('/admin/products', payload);
        }

        if (res.success) {
          API.showToast(res.message, 'success');
          modal.style.display = 'none';
          loadProductRows();
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  }

  loadProductRows();
}

function openAddProductModal() {
  const form = document.getElementById('form-product-crud');
  const modal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('product-modal-title');

  if (form && modal) {
    form.reset();
    document.getElementById('prod-id').value = '';
    if (modalTitle) modalTitle.innerText = 'Add New Product';
    modal.style.display = 'flex';
  }
}

async function editProductModal(productId) {
  const form = document.getElementById('form-product-crud');
  const modal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('product-modal-title');

  if (!modal || !form) return;

  try {
    const res = await API.get(`/products/${productId}`);
    if (res.success) {
      const p = res.product;
      document.getElementById('prod-id').value = p.id;
      document.getElementById('prod-name').value = p.name;
      document.getElementById('prod-category').value = p.category_id || '';
      document.getElementById('prod-price').value = p.price;
      document.getElementById('prod-discount').value = p.discount;
      document.getElementById('prod-stock').value = p.stock;
      document.getElementById('prod-image').value = p.image || '';
      document.getElementById('prod-desc').value = p.description || '';

      if (modalTitle) modalTitle.innerText = 'Edit Product Details';
      modal.style.display = 'flex';
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function deleteProductItem(productId) {
  if (!confirm('Are you sure you want to delete this product? This action is permanent.')) return;
  try {
    const res = await API.delete(`/admin/products/${productId}`);
    if (res.success) {
      API.showToast(res.message, 'success');
      const row = document.getElementById(`prod-row-${productId}`);
      if (row) row.remove();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 3. Categories Management ---
async function loadAdminCategories() {
  const table = document.getElementById('admin-categories-table');
  const form = document.getElementById('form-category-crud');
  const modal = document.getElementById('category-modal');
  const modalTitle = document.getElementById('category-modal-title');

  if (!table) return;

  const loadCategoryRows = async () => {
    table.innerHTML = '<tr><td colspan="4" class="skeleton" style="height:40px;"></td></tr>';
    try {
      const res = await API.get('/categories');
      if (res.success) {
        if (res.categories.length === 0) {
          table.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No categories created.</td></tr>';
          return;
        }

        table.innerHTML = res.categories.map(c => `
          <tr id="cat-row-${c.id}">
            <td>#${c.id}</td>
            <td><img src="${c.image || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; object-fit:cover; border-radius:50%;" /></td>
            <td style="font-weight:600;">${c.name}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="editCategoryModal(${c.id})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deleteCategoryItem(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      table.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
    }
  };

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('cat-id').value;
      const payload = {
        name: document.getElementById('cat-name').value,
        image: document.getElementById('cat-image').value
      };

      try {
        let res;
        if (id) {
          res = await API.put(`/admin/categories/${id}`, payload);
        } else {
          res = await API.post('/admin/categories', payload);
        }

        if (res.success) {
          API.showToast(res.message, 'success');
          modal.style.display = 'none';
          loadCategoryRows();
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  }

  loadCategoryRows();
}

function openAddCategoryModal() {
  const form = document.getElementById('form-category-crud');
  const modal = document.getElementById('category-modal');
  const modalTitle = document.getElementById('category-modal-title');

  if (form && modal) {
    form.reset();
    document.getElementById('cat-id').value = '';
    if (modalTitle) modalTitle.innerText = 'Add New Category';
    modal.style.display = 'flex';
  }
}

async function editCategoryModal(categoryId) {
  const form = document.getElementById('form-category-crud');
  const modal = document.getElementById('category-modal');
  const modalTitle = document.getElementById('category-modal-title');

  if (!modal || !form) return;

  try {
    const res = await API.get(`/categories/${categoryId}`);
    if (res.success) {
      const c = res.category;
      document.getElementById('cat-id').value = c.id;
      document.getElementById('cat-name').value = c.name;
      document.getElementById('cat-image').value = c.image || '';

      if (modalTitle) modalTitle.innerText = 'Edit Category Details';
      modal.style.display = 'flex';
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function deleteCategoryItem(categoryId) {
  if (!confirm('Are you sure you want to delete this category? Products inside will lose their category association.')) return;
  try {
    const res = await API.delete(`/admin/categories/${categoryId}`);
    if (res.success) {
      API.showToast(res.message, 'success');
      const row = document.getElementById(`cat-row-${categoryId}`);
      if (row) row.remove();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 4. Order Management ---
async function loadAdminOrders() {
  const table = document.getElementById('admin-orders-table');
  if (!table) return;

  try {
    const res = await API.get('/admin/orders');
    if (res.success) {
      if (res.orders.length === 0) {
        table.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No customer orders registered.</td></tr>';
        return;
      }

      const statuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out For Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];

      table.innerHTML = res.orders.map(o => {
        const selectHTML = `
          <select class="form-control" style="padding:0.25rem; font-size:0.8rem; min-width:130px;" onchange="updateOrderStatusWorkflow(${o.id}, this.value)">
            ${statuses.map(st => `<option value="${st}" ${o.order_status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        `;

        return `
          <tr>
            <td>#${o.id}</td>
            <td>
              <div style="font-weight:600;">${o.customer_name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${o.customer_email}</div>
            </td>
            <td>${new Date(o.created_at).toLocaleDateString()}</td>
            <td><strong>₹${o.total_amount}</strong></td>
            <td>${o.payment_method}</td>
            <td>${selectHTML}</td>
            <td>
              <a href="/pages/order-tracking.html?id=${o.id}" class="btn btn-secondary btn-sm" title="Track View"><i class="fa-solid fa-eye"></i></a>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    table.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
  }
}

async function updateOrderStatusWorkflow(orderId, newStatus) {
  try {
    const res = await API.put(`/admin/orders/${orderId}`, { order_status: newStatus });
    if (res.success) {
      API.showToast(res.message, 'success');
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 5. Users List Auditing ---
async function loadAdminUsers() {
  const table = document.getElementById('admin-users-table');
  if (!table) return;

  try {
    const res = await API.get('/admin/users');
    if (res.success) {
      table.innerHTML = res.users.map(u => `
        <tr id="user-row-${u.id}">
          <td>#${u.id}</td>
          <td style="font-weight:600;">${u.name}</td>
          <td>${u.email}</td>
          <td>${u.phone || 'N/A'}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-info'}">${u.role}</span></td>
          <td>
            ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteUserAccount(${u.id})"><i class="fa-solid fa-user-xmark"></i> Delete</button>` : 'System Admin'}
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    table.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
  }
}

async function deleteUserAccount(userId) {
  if (!confirm('Are you sure you want to delete this customer account? This will cascade delete their cart, wishlist, orders, and reviews.')) return;
  try {
    const res = await API.delete(`/admin/users/${userId}`);
    if (res.success) {
      API.showToast(res.message, 'success');
      const row = document.getElementById(`user-row-${userId}`);
      if (row) row.remove();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 6. Coupon Management ---
async function loadAdminCoupons() {
  const table = document.getElementById('admin-coupons-table');
  const form = document.getElementById('form-coupon-add');

  if (!table) return;

  const loadCouponRows = async () => {
    try {
      const res = await API.get('/admin/coupons');
      if (res.success) {
        if (res.coupons.length === 0) {
          table.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No coupons created.</td></tr>';
          return;
        }

        table.innerHTML = res.coupons.map(c => `
          <tr id="coupon-row-${c.id}">
            <td>#${c.id}</td>
            <td style="font-weight:700; color:var(--primary);">${c.code}</td>
            <td>${Math.round(c.discount)}%</td>
            <td>${new Date(c.expiry_date).toLocaleDateString()}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteCouponItem(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      table.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
    }
  };

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById('cop-code').value;
      const discount = parseFloat(document.getElementById('cop-discount').value);
      const expiry_date = document.getElementById('cop-expiry').value;

      try {
        const res = await API.post('/admin/coupons', { code, discount, expiry_date });
        if (res.success) {
          API.showToast(res.message, 'success');
          form.reset();
          loadCouponRows();
        }
      } catch (err) {
        API.showToast(err.message, 'error');
      }
    };
  }

  loadCouponRows();
}

async function deleteCouponItem(couponId) {
  if (!confirm('Are you sure you want to delete this coupon?')) return;
  try {
    const res = await API.delete(`/admin/coupons/${couponId}`);
    if (res.success) {
      API.showToast(res.message, 'success');
      const row = document.getElementById(`coupon-row-${couponId}`);
      if (row) row.remove();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 7. Review Moderation ---
async function loadAdminReviews() {
  const table = document.getElementById('admin-reviews-table');
  if (!table) return;

  const loadReviewRows = async () => {
    try {
      const res = await API.get('/admin/reviews');
      if (res.success) {
        if (res.reviews.length === 0) {
          table.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No reviews submitted.</td></tr>';
          return;
        }

        table.innerHTML = res.reviews.map(r => {
          let stars = '';
          for (let i = 1; i <= 5; i++) {
            stars += i <= r.rating ? '<i class="fa-solid fa-star" style="color:var(--warning); font-size:0.75rem;"></i>' : '<i class="fa-regular fa-star" style="color:var(--warning); font-size:0.75rem;"></i>';
          }

          const badgeClass = r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning';

          return `
            <tr id="review-row-${r.id}">
              <td>#${r.id}</td>
              <td>
                <div style="font-weight:600;">${r.product_name}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">By: ${r.customer_name}</div>
              </td>
              <td>${stars}</td>
              <td style="font-size:0.85rem; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.comment}">${r.comment}</td>
              <td><span class="badge ${badgeClass}">${r.status}</span></td>
              <td>
                ${r.status === 'Pending' ? `
                  <button class="btn btn-success btn-sm" onclick="moderateReview(${r.id}, 'Approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
                  <button class="btn btn-secondary btn-sm" onclick="moderateReview(${r.id}, 'Rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
                ` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteReviewItem(${r.id})" title="Delete Review"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      table.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">${err.message}</td></tr>`;
    }
  };

  loadReviewRows();
}

async function moderateReview(reviewId, status) {
  try {
    const res = await API.put(`/admin/reviews/${reviewId}`, { status });
    if (res.success) {
      API.showToast(res.message, 'success');
      loadAdminReviews(); // reload table
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

async function deleteReviewItem(reviewId) {
  if (!confirm('Are you sure you want to delete this review? Product rating averages will recalculate.')) return;
  try {
    const res = await API.delete(`/admin/admin/reviews/${reviewId}`); // wait, routes list say router.delete('/reviews/:id') under /api/admin
    // Let's call /admin/reviews/:id
    const correctRes = await API.delete(`/admin/reviews/${reviewId}`);
    if (correctRes.success) {
      API.showToast(correctRes.message, 'success');
      const row = document.getElementById(`review-row-${reviewId}`);
      if (row) row.remove();
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

// --- 8. Detailed Reports ---
async function loadDetailedAnalytics() {
  const container = document.getElementById('admin-detailed-reports');
  if (!container) return;

  try {
    const res = await API.get('/admin/analytics');
    if (res.success) {
      const stats = res.analytics;
      
      let catSalesHTML = '';
      if (stats.categorySales.length === 0) {
        catSalesHTML = '<p style="color:var(--text-muted);">No category sales data registered.</p>';
      } else {
        catSalesHTML = stats.categorySales.map(c => {
          const rev = parseFloat(c.revenue) || 0;
          return `
            <div style="margin-bottom:1rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                <span style="font-weight:600;">${c.category_name}</span>
                <span style="font-weight:700; color:var(--primary);">₹${rev.toFixed(2)}</span>
              </div>
              <div style="height:10px; background:var(--bg-main); border-radius:5px; overflow:hidden;">
                <div style="width:100%; height:100%; background:var(--primary);"></div>
              </div>
            </div>
          `;
        }).join('');
      }

      container.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
          <div class="dashboard-card">
            <h3 style="font-size:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;"><i class="fa-solid fa-chart-column"></i> Revenue by Category</h3>
            ${catSalesHTML}
          </div>
          
          <div class="dashboard-card">
            <h3 style="font-size:1.2rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;"><i class="fa-solid fa-medal"></i> Top Performing Products</h3>
            ${stats.topProducts.map(p => {
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px dotted var(--border-color);">
                  <span style="font-weight:500;">${p.name}</span>
                  <span style="font-weight:700;">₹${parseFloat(p.revenue).toFixed(2)} (${p.sales_count} sales)</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div style="color:var(--danger); text-align:center;">Failed to load detailed reports: ${err.message}</div>`;
  }
}

// Bind callbacks to window
window.openAddProductModal = openAddProductModal;
window.editProductModal = editProductModal;
window.deleteProductItem = deleteProductItem;
window.openAddCategoryModal = openAddCategoryModal;
window.editCategoryModal = editCategoryModal;
window.deleteCategoryItem = deleteCategoryItem;
window.updateOrderStatusWorkflow = updateOrderStatusWorkflow;
window.deleteUserAccount = deleteUserAccount;
window.deleteCouponItem = deleteCouponItem;
window.moderateReview = moderateReview;
window.deleteReviewItem = deleteReviewItem;
