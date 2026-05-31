document.addEventListener('DOMContentLoaded', () => {
  // Check which page is loading and trigger appropriate functions
  const path = window.location.pathname;
  if (path === '/' || path === '/index.html' || path.endsWith('/index.html')) {
    initHomepage();
  } else if (path.includes('product-details.html')) {
    initProductDetails();
  } else if (path.includes('products.html')) {
    initProductsPage();
  } else if (path.includes('categories.html')) {
    initCategoriesPage();
  }
});

// --- Unified Card Renderer ---
function createProductCardHTML(p) {
  const finalPrice = (p.price * (1 - p.discount / 100)).toFixed(2);
  const originalPriceHTML = p.discount > 0 ? `<span class="product-price-original">₹${p.price}</span>` : '';
  const discountBadgeHTML = p.discount > 0 ? `<div class="product-discount-badge">${Math.round(p.discount)}% OFF</div>` : '';
  
  // Build star rating
  let starsHTML = '';
  const rating = parseFloat(p.rating) || 0;
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      starsHTML += '<i class="fa-solid fa-star"></i>';
    } else if (i - 0.5 <= rating) {
      starsHTML += '<i class="fa-solid fa-star-half-stroke"></i>';
    } else {
      starsHTML += '<i class="fa-regular fa-star"></i>';
    }
  }

  return `
    <div class="product-card" data-id="${p.id}">
      ${discountBadgeHTML}
      <div class="product-card-image-box">
        <img src="${p.image || 'https://via.placeholder.com/300x250?text=No+Image'}" alt="${p.name}" class="product-card-img" data-action="quickview" data-product-id="${p.id}" style="cursor: pointer;" />
        <button class="product-wishlist-btn" data-product-id="${p.id}" data-action="wishlist" title="Add to Wishlist">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="product-card-details">
        <div class="product-card-category">${p.category_name || 'General'}</div>
        <a href="/pages/product-details.html?id=${p.id}"><h3 class="product-card-title">${p.name}</h3></a>
        <div class="product-card-rating">
          ${starsHTML}
          <span>(${rating.toFixed(1)})</span>
        </div>
        <div class="product-card-footer">
          <div class="product-price-box">
            ${originalPriceHTML}
            <span class="product-price-current">₹${finalPrice}</span>
          </div>
          <div class="product-card-actions">
            <button class="product-action-btn product-action-btn-cart" data-product-id="${p.id}" data-action="addcart" title="Add to Cart">
              <i class="fa-solid fa-cart-plus"></i>
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Home Page Logic ---
async function initHomepage() {
  startCountdownTimer();
  
  const categoriesGrid = document.getElementById('home-categories-grid');
  const featuredGrid = document.getElementById('home-featured-grid');
  const flashGrid = document.getElementById('home-flash-grid');

  // Load categories
  try {
    const catRes = await API.get('/categories');
    if (catRes.success && categoriesGrid) {
      categoriesGrid.innerHTML = catRes.categories.slice(0, 6).map(c => `
        <div class="category-card" data-action="filter-category-home" data-category-name="${c.name}" style="cursor: pointer;">
          <img src="${c.image || 'https://via.placeholder.com/60?text=' + c.name}" alt="${c.name}" class="category-card-img" />
          <div class="category-card-name">${c.name}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Home load categories failed:', err.message);
  }

  // Load products (Featured & Flash Deals)
  try {
    const prodRes = await API.get('/products?limit=8');
    if (prodRes.success) {
      const items = prodRes.products;

      if (featuredGrid) {
        featuredGrid.innerHTML = items.slice(0, 4).map(p => createProductCardHTML(p)).join('');
      }

      if (flashGrid) {
        // Render items with active discounts for flash deals
        const discounted = items.filter(p => p.discount > 0);
        const flashItems = discounted.length > 0 ? discounted : items.slice(4, 8);
        flashGrid.innerHTML = flashItems.map(p => createProductCardHTML(p)).join('');
      }

      syncWishlistStateOnCards();
    }
  } catch (err) {
    console.error('Home load products failed:', err.message);
  }
}

function startCountdownTimer() {
  const countEl = document.getElementById('countdown-timer');
  if (!countEl) return;

  // 12 hours from now
  let distance = 12 * 60 * 60 * 1000; 

  const timer = setInterval(() => {
    distance -= 1000;

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countEl.innerHTML = `
      <div style="display:inline-flex; gap:0.5rem; font-weight:700;">
        <span style="background:var(--danger); padding:0.25rem 0.5rem; border-radius:0.25rem;">${hours.toString().padStart(2, '0')}</span> :
        <span style="background:var(--danger); padding:0.25rem 0.5rem; border-radius:0.25rem;">${minutes.toString().padStart(2, '0')}</span> :
        <span style="background:var(--danger); padding:0.25rem 0.5rem; border-radius:0.25rem;">${seconds.toString().padStart(2, '0')}</span>
      </div>
    `;

    if (distance < 0) {
      clearInterval(timer);
      countEl.innerHTML = "EXPIRED";
    }
  }, 1000);
}

// --- Cart and Wishlist Click Actions ---
async function handleAddToCart(productId, qty = 1) {
  console.log(`[OneClick] handleAddToCart triggered: productId=${productId}, quantity=${qty}`);
  const loggedIn = API.isLoggedIn();
  console.log(`[OneClick] User logged-in status check: ${loggedIn}`);

  if (!loggedIn) {
    console.log('[OneClick] User is not logged in. Dispatching alert and redirecting to login page...');
    API.showToast('Please login to add items to your cart.', 'warning');
    setTimeout(() => { window.location.href = '/pages/login.html'; }, 1000);
    return;
  }

  try {
    console.log(`[OneClick] Dispatching POST /cart API request with product ${productId}...`);
    const res = await API.post('/cart', { product_id: productId, quantity: qty });
    console.log('[OneClick] POST /cart response:', res);
    if (res.success) {
      API.showToast(res.message, 'success');
      updateCartAndWishlistBadges();
    }
  } catch (err) {
    console.error('[OneClick] API request failed in handleAddToCart:', err);
    API.showToast(err.message, 'error');
  }
}

async function handleWishlistToggle(productId, btnElement) {
  console.log(`[OneClick] handleWishlistToggle triggered: productId=${productId}`);
  const loggedIn = API.isLoggedIn();
  console.log(`[OneClick] User logged-in status check: ${loggedIn}`);

  if (!loggedIn) {
    console.log('[OneClick] User is not logged in. Dispatching alert and redirecting to login page...');
    API.showToast('Please login to save items to your wishlist.', 'warning');
    setTimeout(() => { window.location.href = '/pages/login.html'; }, 1000);
    return;
  }

  const isActive = btnElement.classList.contains('active');
  console.log(`[OneClick] Heart button wishlist state currently active: ${isActive}`);

  try {
    if (isActive) {
      console.log(`[OneClick] Dispatching DELETE /wishlist/${productId} API request...`);
      const res = await API.delete(`/wishlist/${productId}`);
      console.log('[OneClick] DELETE response:', res);
      if (res.success) {
        btnElement.classList.remove('active');
        btnElement.style.color = '';
        API.showToast('Removed from wishlist.', 'success');
      }
    } else {
      console.log(`[OneClick] Dispatching POST /wishlist API request for product ${productId}...`);
      const res = await API.post('/wishlist', { product_id: productId });
      console.log('[OneClick] POST response:', res);
      if (res.success) {
        btnElement.classList.add('active');
        btnElement.style.color = 'var(--danger)';
        API.showToast('Added to wishlist.', 'success');
      }
    }
    updateCartAndWishlistBadges();
  } catch (err) {
    console.error('[OneClick] API request failed in handleWishlistToggle:', err);
    API.showToast(err.message, 'error');
  }
}

// --- Dynamic Products Browse Page ---
async function initProductsPage() {
  const container = document.getElementById('products-page-grid');
  const catFilter = document.getElementById('filter-category');
  const sortFilter = document.getElementById('filter-sort');
  const minPriceFilter = document.getElementById('filter-min-price');
  const maxPriceFilter = document.getElementById('filter-max-price');
  const applyBtn = document.getElementById('btn-apply-filters');
  const searchTitle = document.getElementById('search-query-title');

  // Load URL search parameters
  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get('category') || '';
  let activeSearch = params.get('search') || '';

  if (activeSearch && searchTitle) {
    searchTitle.innerText = `Search Results for "${activeSearch}"`;
    searchTitle.style.display = 'block';
  }

  // Load category filter select options
  try {
    const catRes = await API.get('/categories');
    if (catRes.success && catFilter) {
      catFilter.innerHTML = '<option value="">All Categories</option>' + 
        catRes.categories.map(c => `<option value="${c.id}" ${activeCategory === c.name ? 'selected' : ''}>${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Products load filter categories failed:', err.message);
  }

  // Load Products function
  const loadFilteredProducts = async () => {
    if (container) container.innerHTML = '<div class="skeleton" style="grid-column:1/-1; height:300px;"></div>';
    
    let query = `/products?page=1&limit=20`;
    
    // Add filters
    const selectedCat = catFilter ? catFilter.value : '';
    if (selectedCat) query += `&category=${selectedCat}`;
    else if (activeCategory) query += `&category=${encodeURIComponent(activeCategory)}`;

    if (activeSearch) query += `&search=${encodeURIComponent(activeSearch)}`;

    if (minPriceFilter && minPriceFilter.value) query += `&minPrice=${minPriceFilter.value}`;
    if (maxPriceFilter && maxPriceFilter.value) query += `&maxPrice=${maxPriceFilter.value}`;
    
    if (sortFilter && sortFilter.value) query += `&sort=${sortFilter.value}`;

    try {
      const res = await API.get(query);
      if (res.success && container) {
        if (res.products.length === 0) {
          container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No products found matching your filter criteria.</div>';
          return;
        }
        container.innerHTML = res.products.map(p => createProductCardHTML(p)).join('');
        syncWishlistStateOnCards();
      }
    } catch (err) {
      if (container) container.innerHTML = `<div style="grid-column:1/-1; color:var(--danger); text-align:center;">Failed to load products: ${err.message}</div>`;
    }
  };

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      // Clear URL params that might conflict
      activeCategory = '';
      if (searchTitle) searchTitle.style.display = 'none';
      activeSearch = '';
      loadFilteredProducts();
    });
  }

  loadFilteredProducts();
}

async function syncWishlistStateOnCards() {
  if (!API.isLoggedIn()) return;
  try {
    const res = await API.get('/wishlist');
    if (res.success) {
      const savedIds = res.wishlist.map(w => w.product_id);
      document.querySelectorAll('.product-card').forEach(card => {
        const id = parseInt(card.getAttribute('data-id'), 10);
        if (savedIds.includes(id)) {
          const wishBtn = card.querySelector('.product-wishlist-btn');
          if (wishBtn) wishBtn.classList.add('active');
        }
      });
    }
  } catch (err) {
    console.warn('Sync wishlist error:', err.message);
  }
}

// --- Product Details Page ---
async function initProductDetails() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    window.location.href = '/pages/products.html';
    return;
  }

  try {
    const res = await API.get(`/products/${id}`);
    if (res.success) {
      const p = res.product;
      const finalPrice = (p.price * (1 - p.discount / 100)).toFixed(2);

      // Render product layout details
      document.getElementById('details-img').src = p.image || 'https://via.placeholder.com/500x500?text=No+Image';
      document.getElementById('details-category').innerText = p.category_name || 'General';
      document.getElementById('details-name').innerText = p.name;
      document.getElementById('details-desc').innerText = p.description || 'No description available for this item.';
      
      const priceBox = document.getElementById('details-price-box');
      if (p.discount > 0) {
        priceBox.innerHTML = `
          <span style="text-decoration: line-through; color: var(--text-muted); font-size: 1.1rem; margin-right: 0.5rem;">₹${p.price}</span>
          <span style="font-size: 2rem; font-weight: 700;">₹${finalPrice}</span>
          <span style="background:var(--danger); padding:0.25rem 0.5rem; border-radius:0.25rem; font-size:0.8rem; margin-left:0.5rem;">${Math.round(p.discount)}% OFF</span>
        `;
      } else {
        priceBox.innerHTML = `<span style="font-size: 2rem; font-weight: 700;">₹${p.price}</span>`;
      }

      // Stock status
      const stockEl = document.getElementById('details-stock-status');
      if (p.stock > 0) {
        stockEl.innerHTML = `<span class="badge badge-success">In Stock (${p.stock} units left)</span>`;
      } else {
        stockEl.innerHTML = `<span class="badge badge-danger">Out of Stock</span>`;
        document.getElementById('btn-details-addcart').disabled = true;
      }

      // Action bindings
      document.getElementById('btn-details-addcart').onclick = () => {
        const qty = parseInt(document.getElementById('details-qty').value, 10) || 1;
        handleAddToCart(p.id, qty);
      };
      
      document.getElementById('btn-details-wishlist').onclick = (e) => {
        handleWishlistToggle(p.id, e.currentTarget);
      };

      // Check if item is in wishlist to highlight the heart icon
      if (API.isLoggedIn()) {
        API.get('/wishlist').then(wishlistRes => {
          if (wishlistRes.success) {
            const isSaved = wishlistRes.wishlist.some(w => w.product_id === p.id);
            if (isSaved) {
              const detailsWishBtn = document.getElementById('btn-details-wishlist');
              if (detailsWishBtn) {
                detailsWishBtn.classList.add('active');
                detailsWishBtn.style.color = 'var(--danger)';
              }
            }
          }
        }).catch(err => console.warn('Details wishlist sync failed:', err.message));
      }

      // Review submission setup
      setupReviewSubmission(p.id);

      // Render reviews
      renderProductReviews(res.reviews);

      // Load related items
      loadRelatedProducts(p.id);
    }
  } catch (err) {
    API.showToast(err.message, 'error');
  }
}

function renderProductReviews(reviews) {
  const container = document.getElementById('details-reviews-list');
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">No reviews verified for this product yet.</p>';
    return;
  }

  container.innerHTML = reviews.map(r => {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += i <= r.rating ? '<i class="fa-solid fa-star" style="color:var(--warning); font-size:0.75rem;"></i>' : '<i class="fa-regular fa-star" style="color:var(--warning); font-size:0.75rem;"></i>';
    }

    return `
      <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:0.5rem; padding:1.25rem; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <div style="font-weight:600;">${r.user_name}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${new Date(r.created_at).toLocaleDateString()}</div>
        </div>
        <div style="margin-bottom:0.5rem;">${stars}</div>
        <p style="font-size:0.95rem; color:var(--text-muted);">${r.comment}</p>
      </div>
    `;
  }).join('');
}

function setupReviewSubmission(productId) {
  const form = document.getElementById('form-submit-review');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!API.isLoggedIn()) {
      API.showToast('Please login to write a review.', 'warning');
      return;
    }

    const ratingVal = document.getElementById('review-rating').value;
    const commentVal = document.getElementById('review-comment').value;

    try {
      const res = await API.post('/reviews', {
        product_id: productId,
        rating: ratingVal,
        comment: commentVal
      });

      if (res.success) {
        API.showToast(res.message, 'success');
        form.reset();
      }
    } catch (err) {
      API.showToast(err.message, 'error');
    }
  });
}

async function loadRelatedProducts(productId) {
  const grid = document.getElementById('details-related-grid');
  if (!grid) return;

  try {
    const res = await API.get(`/products/${productId}/related`);
    if (res.success && res.products.length > 0) {
      grid.innerHTML = res.products.map(p => createProductCardHTML(p)).join('');
      syncWishlistStateOnCards();
    } else {
      grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1;">No related items found.</p>';
    }
  } catch (err) {
    console.error('Related products failed:', err.message);
  }
}

// --- Quick View Modal Helper ---
function closeQuickView() {
  const modal = document.getElementById('quickview-modal');
  if (modal) modal.style.display = 'none';
}

function triggerQuickView(productId) {
  console.log(`[OneClick] triggerQuickView triggered for product ${productId}`);
  let modal = document.getElementById('quickview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'quickview-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
    // Close on overlay click (but not inner card click)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  }

  modal.innerHTML = '<div class="skeleton" style="width:500px;height:300px;border-radius:1rem;"></div>';
  modal.style.display = 'flex';

  API.get(`/products/${productId}`).then(res => {
    if (res.success) {
      const p = res.product;
      const finalPrice = (p.price * (1 - p.discount / 100)).toFixed(2);
      
      // Build stock info
      const stockBadge = p.stock > 0
        ? `<span style="color:var(--success);font-size:0.8rem;"><i class="fa-solid fa-circle-check"></i> In Stock (${p.stock} left)</span>`
        : `<span style="color:var(--danger);font-size:0.8rem;"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>`;
      
      // Build rating stars
      const rating = parseFloat(p.rating) || 0;
      let starsHTML = '';
      for (let i = 1; i <= 5; i++) {
        starsHTML += i <= rating ? '<i class="fa-solid fa-star" style="color:var(--warning);font-size:0.75rem;"></i>'
          : i - 0.5 <= rating ? '<i class="fa-solid fa-star-half-stroke" style="color:var(--warning);font-size:0.75rem;"></i>'
          : '<i class="fa-regular fa-star" style="color:var(--warning);font-size:0.75rem;"></i>';
      }

      const innerDiv = document.createElement('div');
      innerDiv.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-color);border-radius:1rem;width:100%;max-width:620px;padding:2rem;position:relative;box-shadow:var(--shadow-premium);display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin:1rem;';
      innerDiv.innerHTML = `
        <button id="quickview-close-btn" style="position:absolute;top:0.75rem;right:0.75rem;background:rgba(255,255,255,0.1);border:1px solid var(--border-color);color:white;cursor:pointer;font-size:1.1rem;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;" title="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div>
          <img src="${p.image || 'https://via.placeholder.com/300x300?text=No+Image'}" 
               style="border-radius:0.5rem;width:100%;height:260px;object-fit:cover;" 
               alt="${p.name}" />
        </div>
        <div style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">${p.category_name || 'General'}</span>
            <h2 style="font-size:1.2rem;margin:0.3rem 0 0.4rem 0;line-height:1.3;">${p.name}</h2>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem;">
              <div>${starsHTML}</div>
              <span style="font-size:0.75rem;color:var(--text-muted);">(${rating.toFixed(1)})</span>
            </div>
            <p style="font-size:0.82rem;color:var(--text-muted);line-height:1.5;max-height:90px;overflow-y:auto;margin-bottom:0.75rem;">${p.description || 'No description available.'}</p>
            <div style="margin-bottom:0.5rem;">${stockBadge}</div>
          </div>
          <div>
            <div style="margin-bottom:1rem;">
              <span style="font-size:1.6rem;font-weight:700;color:white;">₹${finalPrice}</span>
              ${p.discount > 0 ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:0.85rem;margin-left:0.5rem;">₹${p.price}</span> <span style="background:var(--danger);color:white;font-size:0.7rem;padding:0.15rem 0.4rem;border-radius:0.25rem;margin-left:0.25rem;">${Math.round(p.discount)}% OFF</span>` : ''}
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              <button id="quickview-addcart-btn" class="btn btn-primary" style="flex:1;" ${p.stock === 0 ? 'disabled' : ''}>
                <i class="fa-solid fa-cart-plus"></i> Add to Cart
              </button>
              <a href="/pages/product-details.html?id=${p.id}" class="btn btn-secondary">
                <i class="fa-solid fa-circle-info"></i> Details
              </a>
            </div>
          </div>
        </div>
      `;

      modal.innerHTML = '';
      modal.appendChild(innerDiv);

      // Bind close button via event listener (avoids inline onclick CSP issues)
      document.getElementById('quickview-close-btn').addEventListener('click', () => {
        modal.style.display = 'none';
      });

      // Bind add to cart button via event listener
      const addCartBtn = document.getElementById('quickview-addcart-btn');
      if (addCartBtn) {
        addCartBtn.addEventListener('click', () => {
          handleAddToCart(p.id);
          modal.style.display = 'none';
        });
      }
    }
  }).catch(err => {
    API.showToast(err.message, 'error');
    modal.style.display = 'none';
  });
}

// Event delegation for product card buttons (avoids inline onclick issues)
document.addEventListener('click', function(e) {
  // Find the closest button with a data-action attribute
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  
  if (action === 'filter-category-home') {
    const catName = btn.dataset.categoryName;
    if (catName) {
      window.location.href = `/pages/products.html?category=${encodeURIComponent(catName)}`;
    }
    return;
  }

  const productId = parseInt(btn.dataset.productId, 10);
  if (!productId) return;

  if (action === 'quickview') {
    triggerQuickView(productId);
  } else if (action === 'addcart') {
    handleAddToCart(productId);
  } else if (action === 'wishlist') {
    handleWishlistToggle(productId, btn);
  }
});

// Also bind to window for any legacy or direct calls
window.handleAddToCart = handleAddToCart;
window.handleWishlistToggle = handleWishlistToggle;
window.triggerQuickView = triggerQuickView;
window.closeQuickView = closeQuickView;
