(() => {
  const btn = document.getElementById('contactBtn');
  const pop = document.getElementById('contactPopover');
  const copyBtn = document.getElementById('copyEmailBtn');
  const toast = document.getElementById('toast');
  if (!btn || !pop || !copyBtn || !toast) return;

  const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded','true'); };
  const close = () => { pop.hidden = true;  btn.setAttribute('aria-expanded','false'); };

  btn.addEventListener('click', (e) => { e.preventDefault(); pop.hidden ? open() : close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', (e) => {
    if (pop.hidden) return;
    const t = e.target;
    if (!pop.contains(t) && t !== btn) close();
  });

  const showToast = (msg='📋 Zkopírováno do schránky') => {
    toast.textContent = msg; toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => { toast.hidden = true; }, 1600);
  };

  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email || copyBtn.querySelector('.copy-text')?.textContent?.trim();
    if (!email) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email);
      else { const i = document.createElement('input'); i.value = email; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
      showToast();
    } catch { showToast('✖️ Nepodařilo se zkopírovat'); }
  });
})();
