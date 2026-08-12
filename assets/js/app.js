/**
 * Turkpin E-Pin Integration Platform - Frontend Application Script
 * 
 * Clean Code Architecture:
 * - State Management
 * - Product Fetching & Rendering Engine
 * - Shopping Cart System (CartManager)
 * - Order Processing (Single & Batch Checkout)
 * - Order History Vault & LocalStorage Persistence
 * - Toast Notification System
 */

// -------------------------------------------------------------
// Global Application State
// -------------------------------------------------------------

/** @type {string|number|null} */
let currentSelectedGameId = null;

/** @type {Array<Object>} */
let loadedProductsList = [];

/** @type {string} */
let currentLayout = 'grid';

// -------------------------------------------------------------
// Helper & Utility Functions
// -------------------------------------------------------------

/**
 * Formats price numbers supporting micro-amounts (e.g. ₺0.0010)
 * @param {number|string} val
 * @returns {string}
 */
function formatPrice(val) {
    const num = parseFloat(val || 0);
    if (num === 0) return '0.00';
    if (num < 0.01 || Math.abs(num * 100 - Math.round(num * 100)) > 0.0001) {
        return num.toFixed(4);
    }
    return num.toFixed(2);
}

/**
 * Maps Turkpin tax_type ID to official human-readable label
 * @param {string|number} taxType
 * @returns {string}
 */
function getTaxLabel(taxType) {
    const type = String(taxType);
    switch (type) {
        case '0':
            return 'KDV %0';
        case '1':
        case '3':
            return 'KDV %20';
        case '2':
            return 'Ürün KDV-0 / Hizmet KDV-20';
        case '5':
            return 'Komisyon Faturası';
        default:
            return `KDV %${type}`;
    }
}

/**
 * Shows a toast notification on bottom-right
 * @param {string} title
 * @param {string} message
 * @param {string} type - 'success' | 'danger' | 'info'
 */
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast_' + Date.now();
    const iconClass = type === 'success' 
        ? 'bi-check-circle-fill text-success' 
        : (type === 'danger' ? 'bi-exclamation-octagon-fill text-danger' : 'bi-info-circle-fill text-primary');
    
    const toastHTML = `
        <div id="${toastId}" class="toast toast-glass align-items-center border-0 mb-2" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex p-3">
                <div class="me-3 fs-4"><i class="bi ${iconClass}"></i></div>
                <div class="toast-body p-0 flex-grow-1">
                    <strong class="d-block mb-1">${title}</strong>
                    <span class="text-muted small">${message}</span>
                </div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHTML);
    const toastEl = document.getElementById(toastId);
    if (toastEl && window.bootstrap) {
        const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
}

/**
 * Copies text to clipboard
 * @param {string} text
 */
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Kopyalandı', 'E-Pin kodu panoya kopyalandı!', 'success');
        });
    }
}

/**
 * Selects a game item from custom dropdown and triggers product fetch
 * @param {string|number} gameId
 * @param {string} gameName
 * @param {Event} [event]
 */
function selectGameItem(gameId, gameName, event) {
    if (event) event.preventDefault();
    const btnText = document.getElementById('selectedGameText');
    const nativeSelect = document.getElementById('games');

    if (btnText) {
        btnText.innerHTML = gameId == 0 
            ? `<i class="bi bi-controller text-primary fs-5"></i> Oyun Seçiniz`
            : `<i class="bi bi-controller text-primary fs-5"></i> ${gameName}`;
    }

    if (nativeSelect) {
        nativeSelect.value = gameId;
    }

    fetchProducts(gameId);
}

/**
 * Filters items inside custom game dropdown search box
 */
function filterGameDropdownItems() {
    const input = document.getElementById('dropdownGameSearch');
    if (!input) return;
    const filter = input.value.toLowerCase();
    const items = document.querySelectorAll('#gameDropdownList .game-dropdown-item');

    items.forEach(item => {
        const text = item.textContent || item.innerText;
        if (text.toLowerCase().indexOf(filter) > -1) {
            item.parentElement.style.display = '';
        } else {
            item.parentElement.style.display = 'none';
        }
    });
}

// -------------------------------------------------------------
// Product Fetching & Rendering Engine
// -------------------------------------------------------------

/**
 * Fetches products for the selected game ID via API
 * @param {string|number} gameId
 */
function fetchProducts(gameId) {
    currentSelectedGameId = gameId;
    const welcomeState = document.getElementById('welcomeState');
    const container = document.getElementById('products-container');
    const filterContainer = document.getElementById('filterContainer');
    const grid = document.getElementById('products-grid');
    const tbody = document.querySelector('#products-table tbody');
    const gameSelect = document.getElementById('games');

    if (!welcomeState || !container || !grid || !tbody) return;
    
    if (gameId == 0) {
        container.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'none';
        welcomeState.style.display = 'block';
        loadedProductsList = [];
        return;
    }

    if (gameSelect) {
        const selectedOptionText = gameSelect.options[gameSelect.selectedIndex].text;
        const titleEl = document.getElementById('selectedGameTitle');
        if (titleEl) titleEl.innerText = selectedOptionText;
    }

    welcomeState.style.display = 'none';
    if (filterContainer) filterContainer.style.display = 'block';
    container.style.display = 'block';
    
    grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Ürünler Yükleniyor...</p></div>';
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Yükleniyor...</td></tr>';

    fetch(`/api/products/${gameId}`)
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                const errHTML = `<div class="alert alert-danger glass-card p-3">${res.message}</div>`;
                grid.innerHTML = `<div class="col-12">${errHTML}</div>`;
                tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">${res.message}</td></tr>`;
                return;
            }

            let products = res.data.data || res.data;
            if (!Array.isArray(products) || products.length === 0) {
                const emptyHTML = `<div class="col-12 text-center py-5 text-muted"><i class="bi bi-box-seam fs-1 d-block mb-2"></i>Bu oyuna ait ürün bulunamadı.</div>`;
                grid.innerHTML = emptyHTML;
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Bu oyuna ait ürün bulunamadı.</td></tr>';
                const badge = document.getElementById('productCountBadge');
                if (badge) badge.innerText = '0 Ürün';
                loadedProductsList = [];
                return;
            }

            loadedProductsList = products;
            const badge = document.getElementById('productCountBadge');
            if (badge) badge.innerText = `${products.length} Ürün`;
            renderProducts(products);
        })
        .catch(() => {
            grid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="bi bi-wifi-off fs-1 d-block mb-2"></i>Bağlantı hatası oluştu.</div>';
            tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center py-4">Bağlantı hatası oluştu.</td></tr>';
        });
}

/**
 * Renders products in grid and table views
 * @param {Array<Object>} products
 */
function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    const tbody = document.querySelector('#products-table tbody');
    if (!grid || !tbody) return;

    grid.innerHTML = '';
    tbody.innerHTML = '';

    products.forEach(product => {
        const isOutOfStock = product.stock == 0;
        const isPreOrder = product.pre_order === "true" || product.pre_order === true;

        // Stock Status Badges
        let stockBadge = `<span class="badge bg-success bg-opacity-25 text-success rounded-pill"><i class="bi bi-check-circle me-1"></i>Stok: ${product.stock}</span>`;
        if (isOutOfStock) {
            stockBadge = `<span class="badge bg-danger bg-opacity-25 text-danger rounded-pill"><i class="bi bi-x-circle me-1"></i>Stok Tükendi</span>`;
        } else if (isPreOrder) {
            stockBadge = `<span class="badge bg-warning bg-opacity-25 text-warning rounded-pill"><i class="bi bi-clock-history me-1"></i>Ön Sipariş</span>`;
        }

        const formattedPrice = formatPrice(product.price);
        const qtyInputAttr = isOutOfStock ? 'disabled' : '';
        const taxRate = (product.tax_type !== undefined && product.tax_type !== null) ? product.tax_type : '0';
        const taxLabel = getTaxLabel(taxRate);
        const taxBadge = `<span class="badge bg-secondary bg-opacity-25 text-body rounded-pill ms-1" title="Vergi Tipi"><i class="bi bi-percent me-1"></i>${taxLabel}</span>`;

        // Grid Action Buttons
        const btnHemenAl = isOutOfStock 
            ? `<button type="button" class="btn btn-secondary btn-sm rounded-3 py-2 disabled" disabled><i class="bi bi-slash-circle me-1"></i> Stok Tükendi</button>`
            : `<button type="button" class="btn btn-gradient btn-sm rounded-3 py-2" onclick="placeOrder(this, '${product.id}')" id="btn_${product.id}"><i class="bi bi-lightning-charge-fill me-1"></i> Hemen Al</button>`;

        const btnSepet = isOutOfStock
            ? `<button type="button" class="btn btn-outline-secondary btn-sm rounded-3 py-2 disabled" disabled><i class="bi bi-cart-x me-1"></i> Stokta Yok</button>`
            : `<button type="button" class="btn btn-outline-glass btn-sm rounded-3 py-2" onclick="addToCart('${product.id}')"><i class="bi bi-cart-plus me-1"></i> Sepete Ekle</button>`;

        // Render Grid Card Element
        const cardCol = document.createElement('div');
        cardCol.className = 'col-md-6 col-lg-4';
        cardCol.innerHTML = `
            <div class="glass-card h-100 p-4 d-flex flex-column justify-content-between ${isOutOfStock ? 'opacity-75' : ''}">
                <div>
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2.5 rounded-3 bg-primary bg-opacity-10 text-primary">
                            <i class="bi bi-ticket-perforated fs-4"></i>
                        </div>
                        <div class="d-flex align-items-center gap-1">${stockBadge}${taxBadge}</div>
                    </div>
                    <h5 class="fw-bold brand-title mb-2">${product.name || 'Ürün'}</h5>
                    <div class="fs-3 fw-bold text-success mb-3">₺${formattedPrice}</div>
                </div>
                <div>
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <label class="form-label text-muted small mb-0 me-1">Miktar:</label>
                        <div class="input-group input-group-sm form-control-glass p-0 align-items-center" style="max-width: 130px;">
                            <button class="btn btn-sm text-muted px-2 border-0" onclick="adjustQty('${product.id}', -1)" ${qtyInputAttr}><i class="bi bi-dash"></i></button>
                            <input type="number" class="form-control bg-transparent border-0 text-center fw-bold p-0" value="1" min="${product.min_order || 1}" max="${product.max_order || 99}" id="quantity_${product.id}" ${qtyInputAttr}>
                            <button class="btn btn-sm text-muted px-2 border-0" onclick="adjustQty('${product.id}', 1)" ${qtyInputAttr}><i class="bi bi-plus"></i></button>
                        </div>
                    </div>
                    <div class="d-grid gap-2">
                        ${btnHemenAl}
                        ${btnSepet}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(cardCol);

        // Render Table Row Element
        const tr = document.createElement('tr');
        if (isOutOfStock) tr.className = 'opacity-75';
        tr.innerHTML = `
            <td>
                <div class="fw-bold">${product.name || 'Ürün'}</div>
                <small class="text-muted">ID: #${product.id}</small>
            </td>
            <td>${stockBadge}</td>
            <td>
                <div class="fw-bold text-success">₺${formattedPrice}</div>
                <small class="text-muted font-mono" style="font-size: 0.75rem;">${taxLabel}</small>
            </td>
            <td>
                <div class="input-group input-group-sm form-control-glass p-0 align-items-center" style="max-width: 120px;">
                    <button class="btn btn-sm text-muted px-2 border-0" onclick="adjustQty('${product.id}', -1)" ${qtyInputAttr}><i class="bi bi-dash"></i></button>
                    <input type="number" class="form-control bg-transparent border-0 text-center fw-bold p-0" value="1" min="${product.min_order || 1}" max="${product.max_order || 99}" id="quantity_tbl_${product.id}" onchange="syncQty('${product.id}', this.value)" ${qtyInputAttr}>
                    <button class="btn btn-sm text-muted px-2 border-0" onclick="adjustQty('${product.id}', 1)" ${qtyInputAttr}><i class="bi bi-plus"></i></button>
                </div>
            </td>
            <td class="text-end">
                <div class="btn-group btn-group-sm">
                    ${isOutOfStock 
                        ? `<button type="button" class="btn btn-secondary disabled" disabled>Tükendi</button>`
                        : `<button type="button" class="btn btn-gradient px-3" onclick="placeOrder(this, '${product.id}')">Hızlı Al</button>`}
                    ${isOutOfStock
                        ? `<button type="button" class="btn btn-outline-secondary disabled" disabled><i class="bi bi-cart-x"></i></button>`
                        : `<button type="button" class="btn btn-outline-glass px-3" onclick="addToCart('${product.id}')"><i class="bi bi-cart-plus"></i></button>`}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Toggles layout mode (Grid vs Table)
 * @param {'grid'|'table'} mode
 */
function toggleProductLayout(mode) {
    currentLayout = mode;
    const grid = document.getElementById('products-grid');
    const tableWrapper = document.getElementById('products-table-wrapper');
    const btnGrid = document.getElementById('btnGridView');
    const btnTable = document.getElementById('btnTableView');

    if (!grid || !tableWrapper) return;

    if (mode === 'grid') {
        grid.style.display = 'flex';
        tableWrapper.style.display = 'none';
        if (btnGrid) btnGrid.classList.add('active');
        if (btnTable) btnTable.classList.remove('active');
    } else {
        grid.style.display = 'none';
        tableWrapper.style.display = 'block';
        if (btnGrid) btnGrid.classList.remove('active');
        if (btnTable) btnTable.classList.add('active');
    }
}

/**
 * Real-time Product Search Filter
 */
function filterProducts() {
    const input = document.getElementById('productSearchInput');
    if (!input) return;
    const query = input.value.toLowerCase();
    const filtered = loadedProductsList.filter(p => p.name && p.name.toLowerCase().includes(query));
    renderProducts(filtered);
}

/**
 * Adjusts quantity input value (+ / -)
 * @param {string|number} productId
 * @param {number} delta
 */
function adjustQty(productId, delta) {
    const input1 = document.getElementById(`quantity_${productId}`);
    const input2 = document.getElementById(`quantity_tbl_${productId}`);
    let val = parseInt(input1 ? input1.value : (input2 ? input2.value : 1)) || 1;
    val = Math.max(1, val + delta);
    if (input1) input1.value = val;
    if (input2) input2.value = val;
}

/**
 * Synchronizes Table & Grid quantity inputs
 * @param {string|number} productId
 * @param {number|string} val
 */
function syncQty(productId, val) {
    const input1 = document.getElementById(`quantity_${productId}`);
    if (input1) input1.value = val;
}

// -------------------------------------------------------------
// Shopping Cart System (CartManager)
// -------------------------------------------------------------

/** @returns {Array<Object>} */
function getCart() {
    try { return JSON.parse(localStorage.getItem('turkpin_cart_v1')) || []; } catch(e) { return []; }
}

/** @param {Array<Object>} cart */
function saveCart(cart) {
    localStorage.setItem('turkpin_cart_v1', JSON.stringify(cart));
    updateCartBadge();
    renderCartItems();
}

/** @param {string|number} productId */
function addToCart(productId) {
    const product = loadedProductsList.find(p => p.id == productId);
    if (!product) return;

    if (product.stock == 0) {
        showToast('Stok Uyarısı', 'Stoku tükenmiş ürünler sepete eklenemez.', 'danger');
        return;
    }

    const qtyInput = document.getElementById(`quantity_${productId}`) || document.getElementById(`quantity_tbl_${productId}`);
    const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;

    let cart = getCart();
    const existingIndex = cart.findIndex(item => item.id == productId);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += qty;
    } else {
        const isPreOrder = product.pre_order === "true" || product.pre_order === true;
        cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.price || 0),
            taxType: product.tax_type || '0',
            isPreOrder: isPreOrder,
            quantity: qty,
            gameId: currentSelectedGameId
        });
    }

    saveCart(cart);
    showToast('Sepet Güncellendi', `${product.name} (x${qty}) sepete eklendi!`, 'success');
}

/**
 * Updates item quantity inside cart drawer
 * @param {string|number} productId
 * @param {number} delta
 */
function updateCartItemQty(productId, delta) {
    let cart = getCart();
    const index = cart.findIndex(item => item.id == productId);
    if (index > -1) {
        cart[index].quantity += delta;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        saveCart(cart);
    }
}

/** @param {string|number} productId */
function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id != productId);
    saveCart(cart);
    showToast('Ürün Çıkarıldı', 'Ürün sepetinizden silindi.', 'info');
}

function clearCart() {
    saveCart([]);
    showToast('Sepet Temizlendi', 'Sepetiniz boşaltıldı.', 'info');
}

function updateCartBadge() {
    const cart = getCart();
    const badge = document.getElementById('cartCountBadge');
    if (!badge) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (totalItems > 0) {
        badge.innerText = totalItems;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function renderCartItems() {
    const cart = getCart();
    const container = document.getElementById('cartItemsContainer');
    const summary = document.getElementById('cartSummaryContainer');
    const totalEl = document.getElementById('cartTotalAmount');

    if (!container || !summary || !totalEl) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-cart-x fs-1 d-block mb-3 opacity-50"></i>
                <p class="mb-0">Sepetinizde ürün bulunmamaktadır.</p>
            </div>
        `;
        summary.style.display = 'none';
        return;
    }

    summary.style.display = 'block';
    let total = 0;
    let html = '<div class="d-flex flex-column gap-3">';

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const itemTaxLabel = getTaxLabel(item.taxType !== undefined ? item.taxType : '0');
        html += `
            <div class="glass-card p-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="d-flex align-items-center gap-1 mb-1">
                        <h6 class="fw-bold mb-0">${item.name}</h6>
                        <span class="badge bg-secondary bg-opacity-25 text-body rounded-pill" style="font-size: 0.65rem;">${itemTaxLabel}</span>
                    </div>
                    <div class="text-success small font-mono">₺${formatPrice(item.price)} × ${item.quantity} = <strong>₺${formatPrice(itemTotal)}</strong></div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="input-group input-group-sm form-control-glass p-0 align-items-center" style="max-width: 90px;">
                        <button class="btn btn-sm text-muted px-2 border-0" onclick="updateCartItemQty('${item.id}', -1)"><i class="bi bi-dash"></i></button>
                        <span class="px-1 fw-bold small">${item.quantity}</span>
                        <button class="btn btn-sm text-muted px-2 border-0" onclick="updateCartItemQty('${item.id}', 1)"><i class="bi bi-plus"></i></button>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="removeFromCart('${item.id}')"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
    totalEl.innerText = `₺${formatPrice(total)}`;
}

/**
 * Process batch checkout for all cart items
 */
async function processCartCheckout() {
    const cart = getCart();
    if (cart.length === 0) return;

    const btn = document.getElementById('btnCartCheckout');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>İşleniyor...';
    }

    let results = [];
    for (const item of cart) {
        const formData = new FormData();
        formData.append('product_id', item.id);
        formData.append('quantity', item.quantity);
        formData.append('game_id', item.gameId || currentSelectedGameId);
        if (item.isPreOrder) {
            formData.append('pre_order', 'true');
        }

        try {
            const res = await fetch('/api/order', { method: 'POST', body: formData }).then(r => r.json());
            results.push({ name: item.name, success: res.success, message: res.message });
            if (res.success) saveOrderToHistory(item.name, item.quantity, res.message);
        } catch(e) {
            results.push({ name: item.name, success: false, message: 'Bağlantı hatası' });
        }

        // Small delay between batch order requests
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-shield-check me-1"></i> Siparişi Tamamla';
    }

    clearCart();
    const offcanvasEl = document.getElementById('cartDrawer');
    if (offcanvasEl && window.bootstrap) {
        const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();
    }

    let modalHTML = '<div class="d-flex flex-column gap-2">';
    results.forEach(r => {
        const cls = r.success ? 'alert-success' : 'alert-danger';
        modalHTML += `<div class="alert ${cls} mb-0 p-3"><strong>${r.name}:</strong> ${r.message}</div>`;
    });
    modalHTML += '</div>';

    const modalBody = document.getElementById('orderModalBody');
    if (modalBody) modalBody.innerHTML = modalHTML;

    const modalEl = document.getElementById('orderModal');
    if (modalEl && window.bootstrap) {
        new bootstrap.Modal(modalEl).show();
    }
}

// -------------------------------------------------------------
// Single Item Quick Order
// -------------------------------------------------------------

/**
 * Handles single product quick order submission
 * @param {HTMLElement} btn
 * @param {string|number} productId
 */
function placeOrder(btn, productId) {
    const product = loadedProductsList.find(p => p.id == productId);
    if (product && product.stock == 0) {
        showToast('Stok Uyarısı', 'Stoku tükenmiş ürünler satın alınamaz.', 'danger');
        return;
    }

    const quantityInput = document.getElementById(`quantity_${productId}`) || document.getElementById(`quantity_tbl_${productId}`);
    const quantity = quantityInput ? quantityInput.value : 1;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }

    const gameSelect = document.getElementById('games');
    const selectedGame = currentSelectedGameId || (gameSelect ? gameSelect.value : null);

    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('quantity', quantity);
    formData.append('game_id', selectedGame);

    if (product && (product.pre_order === "true" || product.pre_order === true)) {
        formData.append('pre_order', 'true');
    }

    fetch('/api/order', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(res => {
            const modalBody = document.getElementById('orderModalBody');
            const prodName = product ? product.name : 'Ürün';

            if (modalBody) {
                if (res.success) {
                    saveOrderToHistory(prodName, quantity, res.message);
                    modalBody.innerHTML = `
                        <div class="alert alert-success glass-card p-3 mb-0">
                            <div class="d-flex align-items-center gap-2 mb-2">
                                <i class="bi bi-check-circle-fill text-success fs-4"></i>
                                <h6 class="mb-0 fw-bold">Sipariş Başarıyla Oluşturuldu!</h6>
                            </div>
                            <p class="mb-0 small">${res.message}</p>
                        </div>
                    `;
                } else {
                    modalBody.innerHTML = `
                        <div class="alert alert-danger glass-card p-3 mb-0">
                            <div class="d-flex align-items-center gap-2 mb-2">
                                <i class="bi bi-x-circle-fill text-danger fs-4"></i>
                                <h6 class="mb-0 fw-bold">Sipariş Gönderilemedi</h6>
                            </div>
                            <p class="mb-0 small">${res.message}</p>
                        </div>
                    `;
                }
            }
            
            const modalEl = document.getElementById('orderModal');
            if (modalEl && window.bootstrap) {
                new bootstrap.Modal(modalEl).show();
            }
        })
        .catch(() => {
            showToast('Hata', 'Sipariş gönderilirken hata oluştu.', 'danger');
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-lightning-charge-fill me-1"></i> Hemen Al';
            }
        });
}

// -------------------------------------------------------------
// Order History & E-PIN Vault
// -------------------------------------------------------------

/**
 * Saves order record to localStorage vault
 * @param {string} productName
 * @param {number} quantity
 * @param {string} message
 */
function saveOrderToHistory(productName, quantity, message) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('turkpin_history_v1')) || []; } catch(e){}
    
    let epinCode = null;
    if (message.includes('E-Pin Kodu:')) {
        epinCode = message.split('E-Pin Kodu:')[1].trim();
    }

    history.unshift({
        id: Date.now(),
        date: new Date().toLocaleString('tr-TR'),
        name: productName,
        quantity: quantity,
        message: message,
        epinCode: epinCode
    });

    localStorage.setItem('turkpin_history_v1', JSON.stringify(history));
}

/**
 * Maps Turkpin SIPARIS_DURUMU code & EKSTRA to human readable HTML badge
 * @param {string|number} status
 * @param {string} description
 * @param {string} extraInfo
 * @returns {string}
 */
function formatOrderStatusBadge(status, description, extraInfo = '') {
    const code = String(status);
    let badgeClass = 'bg-success bg-opacity-25 text-success';
    let label = description || 'Tamamlandı';

    switch (code) {
        case '1':
            badgeClass = 'bg-info bg-opacity-25 text-info';
            label = description || 'İşleme Alınıyor';
            break;
        case '2':
            badgeClass = 'bg-success bg-opacity-25 text-success';
            label = description || 'Tamamlandı';
            break;
        case '3':
            badgeClass = 'bg-danger bg-opacity-25 text-danger';
            label = description || 'İptal Edildi';
            if (extraInfo) label += ` - ${extraInfo}`;
            break;
        case '99':
            badgeClass = 'bg-warning bg-opacity-25 text-warning';
            label = description || 'Teslimat Aşamasında';
            break;
        case '199':
            badgeClass = 'bg-warning bg-opacity-25 text-warning';
            label = description || 'Ön Sipariş Teslimat Aşamasında';
            break;
    }

    return `<span class="badge ${badgeClass} rounded-pill">${label}</span>`;
}

/**
 * Renders order history inside modal container
 */
function renderOrderHistory() {
    const container = document.getElementById('orderHistoryContainer');
    if (!container) return;

    let history = [];
    try { history = JSON.parse(localStorage.getItem('turkpin_history_v1')) || []; } catch(e){}

    if (history.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-clock-history fs-1 d-block mb-2 opacity-50"></i>
                <p class="mb-0">Henüz verilmiş bir siparişiniz yok.</p>
            </div>
        `;
        return;
    }

    let html = '<div class="d-flex flex-column gap-3">';
    history.forEach(item => {
        const badge = formatOrderStatusBadge(item.status || '2', item.statusDesc || 'Tamamlandı', item.extraInfo || '');
        html += `
            <div class="glass-card p-3 border-start border-4 border-primary">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="fw-bold mb-0">${item.name} (x${item.quantity})</h6>
                        <small class="text-muted">${item.date}</small>
                    </div>
                    <div>${badge}</div>
                </div>
                ${item.epinCode ? `
                    <div class="p-2 rounded-3 bg-body-tertiary d-flex justify-content-between align-items-center mt-2 border border-secondary border-opacity-25">
                        <code class="text-primary fs-6">${item.epinCode}</code>
                        <button class="btn btn-sm btn-outline-glass py-1 px-3 rounded-pill" onclick="copyToClipboard('${item.epinCode}')">
                            <i class="bi bi-clipboard me-1"></i> Kopyala
                        </button>
                    </div>
                ` : `<p class="mb-0 text-muted small">${item.message}</p>`}
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// -------------------------------------------------------------
// Global Theme Management
// -------------------------------------------------------------

function initTheme() {
    const savedTheme = localStorage.getItem('turkpin_theme') || 'dark';
    applyTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('turkpin_theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = theme === 'dark' ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill text-warning';
    }
}

// Initialize application state on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateCartBadge();
    renderCartItems();
});
