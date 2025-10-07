
    // Mostrar/ocultar contraseña
    document.addEventListener("click", (e)=>{
      const btn = e.target.closest(".pw-toggle"); 
      if(!btn) return;
      const id = btn.getAttribute("data-for");
      const input = document.getElementById(id);
      input.type = input.type === "password" ? "text" : "password";
      btn.classList.toggle("fa-eye");
      btn.classList.toggle("fa-eye-slash");
    });

    // Medidor de fuerza de contraseña
    const pw = document.getElementById("password");
    const meter = document.getElementById("pw-meter");
    pw.addEventListener("input", ()=>{
      const v = pw.value;
      let score = 0;
      if (v.length >= 6) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const pct = Math.min(100, score * 25);
      meter.querySelector("span").style.width = pct + "%";
      meter.classList.toggle("good", score>=2 && score<3);
      meter.classList.toggle("strong", score>=3);
    });

    // Utilidades
    function setErr(field, msg){ 
      const el = document.querySelector('[data-err="'+field+'"]'); 
      if(el){ 
        el.textContent = msg || ""; 
      } 
    }
    
    function clearAllErr(){ 
      setErr("name",""); 
      setErr("email",""); 
      setErr("password2", "");
      document.getElementById("form-error").textContent = "";
      document.getElementById("form-error").style.display = "none";
    }
    
    function disableForm(dis){ 
      document.querySelectorAll("#register-form input, #register-form button, #register-form textarea").forEach(el => {
        el.disabled = dis;
      });
      document.getElementById("submit-btn").textContent = dis ? "Creando cuenta..." : "Crear cuenta";
    }

    // Validación en tiempo real de coincidencia de contraseñas
    document.getElementById('password2').addEventListener('input', function() {
      const password = document.getElementById('password').value;
      const password2 = this.value;
      
      if (password2 && password !== password2) {
        setErr("password2", "Las contraseñas no coinciden");
      } else {
        setErr("password2", "");
      }
    });

    // Submit del formulario
    document.getElementById("register-form").addEventListener("submit", async (e) => {
      e.preventDefault(); 
      clearAllErr();
      
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const password2 = document.getElementById("password2").value;
      const phone = document.getElementById("phone").value.trim();
      const address = document.getElementById("address").value.trim();

      let isValid = true;

      if (!name) { 
        setErr("name", "Ingresa tu nombre completo"); 
        isValid = false;
      }
      
      if (!email) { 
        setErr("email", "Ingresa tu correo electrónico"); 
        isValid = false;
      } else if (!/^\S+@\S+\.\S+$/.test(email)) { 
        setErr("email", "Correo electrónico inválido"); 
        isValid = false;
      }
      
      if (password.length < 6) { 
        showTopError("La contraseña debe tener al menos 6 caracteres"); 
        isValid = false;
      }
      
      if (password !== password2) { 
        setErr("password2", "Las contraseñas no coinciden"); 
        isValid = false;
      }

      if (!isValid) return;

      disableForm(true);
      
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer admin-token" // En producción, esto debería obtenerse de un login admin
          },
          body: JSON.stringify({ name, email, password, phone, address, role: "customer" })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          showTopError(data.message || "No se pudo crear la cuenta");
          disableForm(false);
          return;
        }
        
        showTopSuccess("Cuenta creada con éxito. Ya puedes iniciar sesión.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } catch (err) {
        showTopError("Error de conexión. Intenta de nuevo.");
        disableForm(false);
      }
    });

    function showTopError(msg) {
      const el = document.getElementById("form-error");
      el.textContent = msg; 
      el.style.display = "block";
      document.getElementById("form-msg").style.display = "none";
    }
    
    function showTopSuccess(msg) {
      const el = document.getElementById("form-msg");
      el.textContent = msg; 
      el.style.display = "block";
      document.getElementById("form-error").style.display = "none";
    }
 