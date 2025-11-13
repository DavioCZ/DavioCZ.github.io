(() => {
  console.info('Portfolio ready');
})();

(() => {
  const btn = document.getElementById('contactBtn');
  const pop = document.getElementById('contactPopover');
  const copyBtn = document.getElementById('copyEmailBtn');
  const toast = document.getElementById('toast');

  if (!btn || !pop || !copyBtn || !toast) return;

  // Toggle popoveru
  const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded','true'); };
  const close = () => { pop.hidden = true;  btn.setAttribute('aria-expanded','false'); };
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));

  // Zavření ESC a klik mimo
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', e => {
    if (pop.hidden) return;
    const t = e.target;
    if (!pop.contains(t) && t !== btn) close();
  });

  // Kopírování e-mailu
  const showToast = (msg='📋 Zkopírováno do schránky') => {
    toast.textContent = msg;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => { toast.hidden = true; }, 1600);
  };

  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email || copyBtn.querySelector('.copy-text')?.textContent?.trim();
    if (!email) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        // Fallback pro starší prohlížeče
        const tmp = document.createElement('input');
        tmp.value = email; document.body.appendChild(tmp);
        tmp.select(); document.execCommand('copy'); tmp.remove();
      }
      showToast();
    } catch {
      showToast('✖️ Nepodařilo se zkopírovat');
    }
  });
})();
