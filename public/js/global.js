// ============================================================================
// global.js — Header, Footer, Sticky Header y Control de Scroll
// ============================================================================

(function(){
  // --------------------------------------------------------------------------
  // Evitar que el script se instale más de una vez
  // --------------------------------------------------------------------------
  if (window.__GlobalInstalled) return;
  window.__GlobalInstalled = true;

  // --------------------------------------------------------------------------
  // Control del comportamiento del scroll
  // --------------------------------------------------------------------------
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("pageshow", (e) => { 
    if (e.persisted) window.scrollTo(0, 0); 
  });
  window.addEventListener("beforeunload", () => {
    window.scrollTo(0, 0);
  });

  const THEME_KEY = 'theme';

  function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }

  function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    return next;
  }

  window.toggleTheme = toggleTheme;

// --------------------------------------------------------------------------
// Plantilla del Header con lógica de autenticación
// --------------------------------------------------------------------------
const headerHTML = `
  <header>
    <div class="container">
      <nav class="navbar">
        <a href="index.html" class="logo"><span>Heladeria</span> <span>Victoria</span></a>
        <ul class="nav-links">
          <li><a href="index.html">Inicio</a></li>
          <li><a href="store.html">Tienda</a></li>
          <li><a href="about.html">Nosotros</a></li>
          <li><a href="contact.html">Contacto</a></li>
        </ul>
        <div class="cart-area">
          <a href="cart.html" class="btn-pill btn-cart" title="Carrito">
            <i class="fas fa-shopping-cart"></i>
            <span class="cart-count">0</span>
            <span class="sr-only">Carrito</span>
          </a>
          <a href="login.html" id="account-link" class="btn-pill btn-account" title="Mi cuenta">
            <i class="fas fa-user"></i>
            <span class="sr-only">Mi cuenta</span>
          </a>
          <div id="user-menu" style="display: none;">
            <span>Hola, <span id="user-name"></span></span>
            <button id="logout-button" class="btn btn-outline">Cerrar Sesión</button>
          </div>
        </div>
      </nav>
    </div>
  </header>
`.trim();

  // --------------------------------------------------------------------------
  // Plantilla del Footer
  // --------------------------------------------------------------------------
  const footerHTML = `
    <footer>
      <div class="container">
        <div class="footer-grid">
          <div class="footer-column">
            <h3>Heladeria Victoria</h3>
            <p>Deliciosos helados de Doña Vicky.</p>
            <div class="social" aria-label="Redes sociales">
              <a href="#" class="social-icon fb" title="Facebook"><i class="fab fa-facebook-f"></i></a>
              <a href="#" class="social-icon ig" title="Instagram"><i class="fab fa-instagram"></i></a>
              <a href="#" class="social-icon tt" title="TikTok"><i class="fab fa-tiktok"></i></a>
              <a href="#" class="social-icon yt" title="YouTube"><i class="fab fa-youtube"></i></a>
            </div>
          </div>
          <div class="footer-column footer-products">
            <h3>Nuestras Creaciones</h3>
            <a href="#"><i class="fas fa-ice-cream"></i> Helados</a>
            <a href="#"><i class="fas fa-candy-cane"></i> Toppings</a>
            <a href="#"><i class="fas fa-glass-whiskey"></i> Copas</a>
            <a href="#"><i class="fas fa-gift"></i> Promociones</a>
          </div>
          <div class="footer-column footer-quick-links">
            <h3>Explorar</h3>
            <a href="index.html"><i class="fas fa-home"></i> Inicio</a>
            <a href="store.html"><i class="fas fa-store"></i> Tienda</a>
            <a href="about.html"><i class="fas fa-users"></i> Nosotros</a>
            <a href="contact.html"><i class="fas fa-envelope"></i> Contacto</a>
          </div>
          <div class="footer-column footer-contact">
            <h3>Contacto</h3>
            <p><i class="fas fa-phone"></i> +502 5907-9067</p>
            <p><i class="fab fa-whatsapp"></i> +502 5907-9067</p>
            <p><i class="fas fa-envelope"></i> info@heladeriavictoria.com</p>
            <p><i class="fas fa-map-marker-alt"></i> Chimaltenango, Guatemala</p>
          </div>
        </div>
        <div class="copyright">
          <p>&copy; 2025 Heladeria Victoria. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  `.trim();

  // --------------------------------------------------------------------------
  // Función genérica para insertar componentes en el DOM
  // --------------------------------------------------------------------------
  function insertComponent(id, html) {
    const mount = document.getElementById(id);
    if (!mount) return;
    mount.innerHTML = html;
    mount.removeAttribute("aria-hidden");
  }

  // --------------------------------------------------------------------------
  // Activar sticky únicamente en el header (Fixed fallback)
  // --------------------------------------------------------------------------
  function applyHeaderStickyOnly() {
    const mount = document.getElementById('header-placeholder');
    const hdr = mount ? mount.querySelector('header') : document.querySelector('#header-placeholder header');
    if (!hdr) return;

    // Establecer placeholder para mantener flujo si usamos fixed
    const placeholder = document.createElement('div');
    placeholder.style.height = hdr.offsetHeight + 'px';
    placeholder.style.width = '100%';
    hdr.parentNode.insertBefore(placeholder, hdr);

    // Forzar fixed
    hdr.style.position = 'fixed';
    hdr.style.top = '0';
    hdr.style.left = '0';
    hdr.style.right = '0';
    hdr.style.zIndex = '1000';
    hdr.style.width = '100%';

    // Asegurar fondo para no quedar transparente
    const bg = getComputedStyle(hdr).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)') hdr.style.backgroundColor = '#fff';
  }

  // --------------------------------------------------------------------------
  // Inicialización del layout al cargar el DOM
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", function () {
    // Insertar header y footer
    insertComponent("header-placeholder", headerHTML);
    insertComponent("footer-placeholder", footerHTML);

    // Hacer el header sticky/fixed
    applyHeaderStickyOnly();

    // Aplicar tema almacenado
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(savedTheme);

    // Señal de que el layout está listo para otros scripts
    document.dispatchEvent(new CustomEvent("layout:ready"));

    // Forzar scroll al inicio tras la carga
    setTimeout(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      catch {
        window.scrollTo(0, 0);
      }
    }, 20);
  });
})();

// global.js

// Función para verificar autenticación
async function checkAuth() {
  const token = localStorage.getItem('authToken');
  const userData = localStorage.getItem('user');
  
  if (!token || !userData) {
    return false;
  }
  
  try {
    const response = await fetch('/api/verify', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return JSON.parse(userData);
    } else {
      // Token inválido, limpiar almacenamiento
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      return false;
    }
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    return false;
  }
}

// Función para cerrar sesión
async function logout() {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (error) {
    console.error('Error en logout:', error);
  } finally {
    // Limpiar almacenamiento local
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/';
  }
}

// Actualizar la UI según el estado de autenticación
async function updateAuthUI() {
  const user = await checkAuth();
  const accountLink = document.getElementById('account-link');
  
  if (user) {
    // Usuario autenticado - cambiar enlace a admin.html
    if (accountLink) {
      accountLink.href = 'admin.html';
      
      // Cambiar icono según el rol del usuario
      if (user.role === 'admin') {
        accountLink.innerHTML = '<i class="fas fa-user-cog"></i><span class="sr-only">Administración</span>';
        accountLink.title = 'Panel de Administración';
      } else {
        accountLink.innerHTML = '<i class="fas fa-user"></i><span class="sr-only">Mi cuenta</span>';
        accountLink.title = 'Mi cuenta';
      }
    }
  } else {
    // Usuario no autenticado - mantener enlace a login.html
    if (accountLink) {
      accountLink.href = 'login.html';
      accountLink.innerHTML = '<i class="fas fa-user"></i><span class="sr-only">Iniciar sesión</span>';
      accountLink.title = 'Iniciar sesión';
    }
  }
}

// Llamar a updateAuthUI cuando se cargue la página
document.addEventListener('DOMContentLoaded', function() {
  // Actualizar UI de autenticación
  updateAuthUI();
  
  // Actualizar contador de carrito
  if (typeof updateCartCount === 'function') {
    updateCartCount();
  }
});

// Hacer funciones disponibles globalmente
window.checkAuth = checkAuth;
window.logout = logout;
window.updateAuthUI = updateAuthUI;