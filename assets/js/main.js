/* =========================================
   1. LOGIKA PRO IKONY (Copy Email)
   ========================================= */
(() => {
  const copyBtn = document.getElementById('copyEmailIcon');
  const feedback = document.getElementById('copyFeedback');

  if (copyBtn && feedback) {
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.email;
      if (!email) return;

      try {
        // Zkopírovat do schránky
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

        // Vizuální efekt: Pouze změna barvy na zelenou a zobrazení textu
        copyBtn.style.color = 'var(--accent)'; 
        feedback.classList.add('visible');

        // Reset po 2 sekundách
        setTimeout(() => {
          copyBtn.style.color = ''; // Reset barvy
          feedback.classList.remove('visible');
        }, 2000);

      } catch (err) {
        console.error('Chyba kopírování', err);
      }
    });
  }
})();

/* =========================================
   2. SPOTLIGHT EFEKT (Optimalizovaný)
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".project-card");
  if (!cards.length) return;

  let isTicking = false;

  document.addEventListener("mousemove", (e) => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        const { clientX, clientY } = e;
        
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const x = clientX - rect.left;
          const y = clientY - rect.top;
          
          card.style.setProperty("--x", `${x}px`);
          card.style.setProperty("--y", `${y}px`);
        });

        isTicking = false;
      });
      
      isTicking = true;
    }
  });
});

