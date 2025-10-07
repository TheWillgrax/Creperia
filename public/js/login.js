// login.js
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si ya hay una sesión activa
  checkExistingSession();
  
  const loginForm = document.getElementById('login-form');
  const registerBtn = document.getElementById('register-btn');
  const messageDiv = document.getElementById('login-message');

  // Manejar envío del formulario
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Validaciones básicas
    if (!email || !password) {
      showMessage('Por favor completa todos los campos', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Guardar token y información del usuario
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        showMessage('Inicio de sesión exitoso. Redirigiendo...', 'success');
        
        // Redirigir a admin.html después de un breve delay
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 1500);
      } else {
        showMessage(data.message || 'Error en el inicio de sesión', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showMessage('Error de conexión. Intenta nuevamente.', 'error');
    }
  });
  
  // Manejar botón de registro
  registerBtn.addEventListener('click', function() {
    window.location.href = '/register.html';
  });
  
  // Función para mostrar mensajes
  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
});

// Verificar si ya existe una sesión activa
function checkExistingSession() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    // Si ya hay una sesión, redirigir al admin
    window.location.href = 'admin.html';
  }
}