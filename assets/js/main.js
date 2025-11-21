/* =========================================
   1. LOGIKA PRO KONTAKT (Popover + Copy)
   ========================================= */
(() => {
  const btn = document.getElementById('contactBtn');
  const pop = document.getElementById('contactPopover');
  const copyBtn = document.getElementById('copyEmailBtn');
  const toast = document.getElementById('toast');

  // Otevírání/Zavírání popoveru
  if (btn && pop) {
    const open = () => { 
      pop.hidden = false; 
      btn.setAttribute('aria-expanded', 'true'); 
    };
    const close = () => { 
      pop.hidden = true;  
      btn.setAttribute('aria-expanded', 'false'); 
    };

    btn.addEventListener('click', (e) => { 
      e.preventDefault(); 
      pop.hidden ? open() : close(); 
    });

    // Zavření klávesou Escape
    document.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape') close(); 
    });

    // Zavření kliknutím mimo
    document.addEventListener('click', (e) => {
      if (pop.hidden) return;
      if (!pop.contains(e.target) && e.target !== btn) close();
    });
  }

  // Kopírování e-mailu
  if (copyBtn) {
    const COPIED_MS = 1400; 
    let t;
    
    const showError = (msg = '✖️ Nepodařilo se zkopírovat') => {
      if (!toast) return;
      toast.textContent = msg; 
      toast.hidden = false;
      clearTimeout(showError._t); 
      showError._t = setTimeout(() => { toast.hidden = true; }, 1800);
    };

    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.email || copyBtn.querySelector('.copy-text')?.textContent?.trim();
      if (!email) return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(email);
        } else { 
          // Fallback pro starší prohlížeče
          const i = document.createElement('input'); 
          i.value = email; 
          document.body.appendChild(i); 
          i.select(); 
          document.execCommand('copy'); 
          i.remove(); 
        }

        // Vizuální potvrzení
        copyBtn.classList.add('copied'); 
        copyBtn.setAttribute('aria-label', 'Zkopírováno');
        
        clearTimeout(t); 
        t = setTimeout(() => { 
          copyBtn.classList.remove('copied'); 
          copyBtn.setAttribute('aria-label', 'Zkopírovat e-mail'); 
        }, COPIED_MS);
      } catch { 
        showError(); 
      }
    });
  }
})();

/* =========================================
   2. SPOTLIGHT EFEKT NA KARTÁCH
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".project-card");

  if (!cards.length) return;

  document.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      card.style.setProperty("--x", `${x}px`);
      card.style.setProperty("--y", `${y}px`);
    });
  });
});
