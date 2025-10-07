// ============================================================================
// contact.js — Maneja el formulario de contacto y envía datos por WhatsApp
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const message = document.getElementById('message').value.trim();

    const whatsappNumber = '50259079067';
    const fullMessage = `Nombre: ${name}\nCorreo: ${email}\nTeléfono: ${phone}\nMensaje: ${message}`;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(fullMessage)}`;

    window.open(url, '_blank');
    form.reset();
  });
});
