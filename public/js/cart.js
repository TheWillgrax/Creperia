// cart.js — toda la lógica del carrito (localStorage: 'heladeriaCart')
// Movido desde global. Exporta funciones globales para uso desde HTML/store.
(function(){
  const STORAGE_KEY = 'heladeriaCart';

  // Inicializa la clave si no existe
  function ensureCartKey() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  }

  function getCart() {
    ensureCartKey();
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateCartUI();
  }

  // API pública
  window.addToCart = function(product) {
    // product: { id, name, price, image, quantity? }
    if (!product || !product.id) return;
    const cart = getCart();
    const existing = cart.find(i => String(i.id) === String(product.id));
    if (existing) {
      existing.quantity = (existing.quantity || 0) + (product.quantity || 1);
    } else {
      cart.push({
        id: String(product.id),
        name: product.name || '',
        price: Number(product.price) || 0,
        image: product.image || '',
        quantity: product.quantity || 1
      });
    }
    saveCart(cart);
    showNotification(`${product.name || 'Producto'} añadido al carrito`, 'success');
  };

  window.removeFromCart = function(productId) {
    const cart = getCart().filter(i => String(i.id) !== String(productId));
    saveCart(cart);
  };

  window.updateQuantity = function(productId, quantity) {
    quantity = Number(quantity) || 0;
    if (quantity < 1) {
      window.removeFromCart(productId);
      return;
    }
    const cart = getCart().map(i => {
      if (String(i.id) === String(productId)) return { ...i, quantity };
      return i;
    });
    saveCart(cart);
  };

  window.clearCart = function() {
    saveCart([]);
  };

  window.getCartItemCount = function() {
    return getCart().reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  };

  window.getCartTotal = function() {
    return getCart().reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
  };

  // Actualiza contador en header y, si aplica, la página del carrito
  function updateCartUI() {
    const count = window.getCartItemCount();
    const cartCountElements = document.querySelectorAll('.cart-count');
    cartCountElements.forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });

    if (document.querySelector('.cart-page')) {
      renderCartItems();
      updateCartSummary();
      updateCartHeader();
    }
  }

  // Renderizar items en .cart-items
  function renderCartItems() {
    const container = document.querySelector('.cart-items');
    if (!container) return;
    const cart = getCart();

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="empty-cart">
          <i class="fas fa-shopping-cart"></i>
          <h3>Tu carrito está vacío</h3>
          <p>¡Agrega algunos deliciosos helados!</p>
          <a href="store.html" class="btn-pill">Ir a la tienda</a>
        </div>
      `;
      return;
    }

    container.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="item-image">
          <img src="${item.image || ''}" alt="${item.name || ''}">
        </div>
        <div class="item-details">
          <h4>${item.name || ''}</h4>
          <p class="item-price">Q${Number(item.price).toFixed(2)}</p>
          <button class="item-remove" data-action="remove" data-id="${item.id}">
            <i class="fas fa-trash"></i> Eliminar
          </button>
        </div>
        <div class="item-quantity">
          <button class="quantity-btn" data-action="decrease" data-id="${item.id}"><i class="fas fa-minus"></i></button>
          <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-id="${item.id}">
          <button class="quantity-btn" data-action="increase" data-id="${item.id}"><i class="fas fa-plus"></i></button>
        </div>
        <div class="item-total">
          <span class="total-price">Q${(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
        </div>
      </div>
    `).join('');

    // Delegación de eventos dentro del contenedor
    container.querySelectorAll('.quantity-btn').forEach(btn => {
      btn.addEventListener('click', function(e){
        const action = this.getAttribute('data-action');
        const id = this.getAttribute('data-id');
        const cart = getCart();
        const item = cart.find(x => String(x.id) === String(id));
        if (!item) return;
        if (action === 'increase') updateQuantity(id, Number(item.quantity || 0) + 1);
        if (action === 'decrease') updateQuantity(id, Number(item.quantity || 0) - 1);
      });
    });

    container.querySelectorAll('.quantity-input').forEach(input => {
      input.addEventListener('change', function(){
        const id = this.getAttribute('data-id');
        let q = parseInt(this.value, 10);
        if (isNaN(q) || q < 1) q = 1;
        this.value = q;
        updateQuantity(id, q);
      });
      input.addEventListener('keydown', function(e){
        // bloquear input no numérico simple
        if (![8,9,13,46,37,39].includes(e.keyCode) && (e.keyCode < 48 || (e.keyCode > 57 && e.keyCode < 96) || e.keyCode > 105)) {
          e.preventDefault();
        }
      });
    });

    container.querySelectorAll('.item-remove').forEach(btn => {
      btn.addEventListener('click', function(){
        const id = this.getAttribute('data-id');
        removeFromCart(id);
        showNotification('Producto eliminado del carrito', 'success');
      });
    });
  }

  function updateCartHeader() {
    const itemCount = window.getCartItemCount(); // suma real de todas las cantidades
    const cartHeader = document.querySelector('.cart-header h3');
    if (cartHeader) cartHeader.textContent = `Productos (${itemCount})`;
    updateHeaderCartCount(itemCount);
  }


  function updateHeaderCartCount(count) {
    const cartCount = document.querySelector('.cart-count');
    if (!cartCount) return;
    if (count > 0) {
      cartCount.textContent = count;
      cartCount.style.display = 'flex';
    } else {
      cartCount.style.display = 'none';
    }
  }

  function updateCartSummary() {
    const cart = getCart();
    const subtotal = cart.reduce((s, i) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
    const taxRate = 0.12;
    const taxes = subtotal * taxRate;
    const shipping = subtotal > 50 ? 0 : 15;
    const total = subtotal + taxes + shipping;

    const subtotalElement = document.querySelector('.summary-subtotal');
    const taxesElement = document.querySelector('.summary-taxes');
    const shippingElement = document.querySelector('.summary-shipping');
    const totalElement = document.querySelector('.summary-total');

    if (subtotalElement) subtotalElement.textContent = `Q${subtotal.toFixed(2)}`;
    if (taxesElement) taxesElement.textContent = `Q${taxes.toFixed(2)}`;
    if (shippingElement) {
      shippingElement.textContent = shipping === 0 ? 'Gratis' : `Q${shipping.toFixed(2)}`;
      shippingElement.className = shipping === 0 ? 'summary-shipping free-shipping' : 'summary-shipping';
    }
    if (totalElement) totalElement.textContent = `Q${total.toFixed(2)}`;
  }

  // Funciones expuestas para botones en HTML
  window.removeCartItem = function(productId) {
    removeFromCart(productId);
    showNotification('Producto eliminado del carrito', 'success');
  };

  window.increaseQuantity = function(productId) {
    const cart = getCart();
    const item = cart.find(i => String(i.id) === String(productId));
    if (item) updateQuantity(productId, Number(item.quantity || 0) + 1);
  };

  window.decreaseQuantity = function(productId) {
    const cart = getCart();
    const item = cart.find(i => String(i.id) === String(productId));
    if (item) updateQuantity(productId, Number(item.quantity || 0) - 1);
  };

  window.updateItemQuantity = function(productId, quantity) {
    updateQuantity(productId, Number(quantity) || 1);
  };

  window.applyPromoCode = function() {
    const promoInput = document.querySelector('.promo-input input');
    const promoCode = promoInput ? promoInput.value.trim() : '';
    if (!promoCode) { showNotification('Por favor ingresa un código de descuento', 'error'); return; }
    const validCodes = { 'HELADO10': 0.1, 'VERANO20': 0.2, 'VICKY15': 0.15 };
    if (validCodes.hasOwnProperty(promoCode)) {
      const discount = validCodes[promoCode];
      applyDiscount(discount, promoCode);
      showNotification(`¡Código aplicado! Descuento del ${discount * 100}%`, 'success');
      if (promoInput) promoInput.value = '';
    } else {
      showNotification('Código de descuento no válido', 'error');
    }
  };

  function applyDiscount(discount, code) {
    // Implementación mínima: guarda el descuento en sessionStorage para uso futuro
    sessionStorage.setItem('heladeria_discount', JSON.stringify({ code, discount }));
    // Recalcular resumen (si se mostrara en UI real, aquí se aplicaría)
    updateCartSummary();
    console.log(`Aplicando descuento del ${discount * 100}% con código: ${code}`);
  }

  window.continueShopping = function() { window.location.href = 'store.html'; };
  window.proceedToCheckout = function() {
    if (window.getCartItemCount() === 0) { showNotification('El carrito está vacío', 'error'); return; }
    window.location.href = 'checkout.html';
  };

  // Guardar carrito leyendo la página (usado por cart page)
  function saveCartToLocalStorageFromDOM() {
    const items = [];
    document.querySelectorAll('.cart-item').forEach(el => {
      const id = el.getAttribute('data-id');
      const name = el.querySelector('h4') ? el.querySelector('h4').textContent : '';
      const priceText = el.querySelector('.item-price') ? el.querySelector('.item-price').textContent : 'Q0';
      const price = Number(priceText.replace('Q', '').replace(',', '')) || 0;
      const quantity = Number(el.querySelector('.quantity-input') ? el.querySelector('.quantity-input').value : 1) || 1;
      const image = (el.querySelector('img') && el.querySelector('img').src) || '';
      items.push({ id, name, price, quantity, image });
    });
    saveCart(items);
  }

  // Notificaciones
  function showNotification(message, type = 'info') {
    let container = document.querySelector('.notification-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => { notification.classList.add('visible'); }, 50);
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => { notification.remove(); }, 300);
    }, 3000);
  }
  // Export showNotification global por si otras partes lo usan
  window.showNotification = showNotification;

  // Inicialización: actualizar UI cuando layout esté listo y al cargar la página
  function initOnReady() {
    ensureCartKey();
    updateCartUI();
  }

  document.addEventListener('layout:ready', initOnReady);
  document.addEventListener('DOMContentLoaded', function(){
    initOnReady();
    // Si estamos en la página de carrito, ligar botones adicionales
    if (document.querySelector('.cart-page')) {
      // Clear cart
      const clearBtn = document.getElementById('clear-cart');
      if (clearBtn) clearBtn.addEventListener('click', function(){
        if (!confirm('¿Estás seguro de que quieres vaciar el carrito?')) return;
        window.clearCart();
        showNotification('Carrito vaciado', 'success');
      });

      // Promo
      const applyPromoBtn = document.querySelector('.promo-input .btn');
      if (applyPromoBtn) applyPromoBtn.addEventListener('click', window.applyPromoCode);

      // Continue / Checkout
      const continueShoppingBtn = document.querySelector('.continue-shopping');
      const checkoutBtn = document.querySelector('.btn-checkout');
      if (continueShoppingBtn) continueShoppingBtn.addEventListener('click', window.continueShopping);
      if (checkoutBtn) checkoutBtn.addEventListener('click', window.proceedToCheckout);
    }
  });

})();
