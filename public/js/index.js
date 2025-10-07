// Carrusel de productos con carga desde API
    document.addEventListener('DOMContentLoaded', function() {
      const track = document.getElementById('products-track');
      const prevBtn = document.querySelector('.carousel-btn.prev');
      const nextBtn = document.querySelector('.carousel-btn.next');
      
      let products = [];
      let currentPosition = 0;
      
      // Cargar productos desde la API
      async function loadProducts() {
        try {
          track.innerHTML = '<div class="loading">Cargando productos...</div>';
          
          const response = await fetch('/api/products');
          if (!response.ok) {
            throw new Error('Error al cargar productos');
          }
          
          products = await response.json();
          
          if (products.length === 0) {
            track.innerHTML = '<div class="loading">No hay productos disponibles</div>';
            return;
          }
          
          renderProducts();
          initCarousel();
          
        } catch (error) {
          console.error('Error:', error);
          track.innerHTML = '<div class="loading">Error al cargar los productos. Intenta nuevamente.</div>';
        }
      }
      
      // Renderizar productos en el carrusel
      function renderProducts() {
        track.innerHTML = '';
        
        products.forEach(product => {
          const productCard = document.createElement('div');
          productCard.className = 'carousel-item';
          productCard.innerHTML = `
            <div class="product-card">
              <div class="product-image">
                <img src="${product.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible'}" alt="${product.name}">
              </div>
              <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-price">Q${product.price.toFixed(2)}</p>
                <div class="product-actions">
                  <button class="card-btn outline view-details" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="card-btn primary add-to-cart" title="Añadir al carrito">
                    <i class="fas fa-shopping-cart"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
          
          track.appendChild(productCard);
        });
      }
      
      // Inicializar carrusel
      function initCarousel() {
        const items = track.querySelectorAll('.carousel-item');
        const itemCount = items.length;
        if (itemCount === 0) return;
        
        const itemWidth = items[0].offsetWidth + parseInt(getComputedStyle(track).gap);
        const visibleItems = Math.floor(track.offsetWidth / itemWidth);
        let maxPosition = -((itemCount - visibleItems) * itemWidth);
        
        // Actualizar posición del carrusel
        function updateCarousel() {
          track.style.transform = `translateX(${currentPosition}px)`;
          
          // Habilitar/deshabilitar botones según la posición
          prevBtn.disabled = currentPosition >= 0;
          nextBtn.disabled = currentPosition <= maxPosition;
        }
        
        // Botón siguiente
        nextBtn.addEventListener('click', function() {
          if (currentPosition > maxPosition) {
            currentPosition -= itemWidth;
            updateCarousel();
          }
        });
        
        // Botón anterior
        prevBtn.addEventListener('click', function() {
          if (currentPosition < 0) {
            currentPosition += itemWidth;
            updateCarousel();
          }
        });
        
        // Event listeners para botones de producto
        document.addEventListener('click', function(e) {
          // Ver detalles
          if (e.target.closest('.view-details')) {
            const productCard = e.target.closest('.product-card');
            const productName = productCard.querySelector('h3').textContent;
            alert(`Ver detalles de: ${productName}`);
          }
          
          // Añadir al carrito
          if (e.target.closest('.add-to-cart')) {
            const productCard = e.target.closest('.product-card');
            const productName = productCard.querySelector('h3').textContent;
            const productPrice = productCard.querySelector('.product-price').textContent;
            const productImage = productCard.querySelector('img').src;
            
            // Buscar el producto completo en el array
            const product = products.find(p => p.name === productName);
            if (product) {
              if (typeof window.addToCart === 'function') {
                window.addToCart({
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.image_url
                });
              } else {
                alert(`Añadiendo al carrito: ${productName} - ${productPrice}`);
              }
            }
          }
        });
        
        // Inicializar estado de botones
        updateCarousel();
        
        // Recalcular en redimensionamiento
        window.addEventListener('resize', function() {
          const newItemWidth = items[0].offsetWidth + parseInt(getComputedStyle(track).gap);
          const newVisibleItems = Math.floor(track.offsetWidth / newItemWidth);
          maxPosition = -((itemCount - newVisibleItems) * newItemWidth);
          
          // Ajustar posición actual si es necesario
          if (currentPosition < maxPosition) {
            currentPosition = maxPosition;
          }
          if (currentPosition > 0) {
            currentPosition = 0;
          }
          
          updateCarousel();
        });
      }
      
      // Iniciar carga de productos
      loadProducts();
    });