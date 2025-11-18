(() => {
  const btn = document.getElementById('contactBtn');
  const pop = document.getElementById('contactPopover');
  const copyBtn = document.getElementById('copyEmailBtn');
  const toast = document.getElementById('toast');
  if (!btn || !pop || !copyBtn) return;

  const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded','true'); };
  const close = () => { pop.hidden = true;  btn.setAttribute('aria-expanded','false'); };

  btn.addEventListener('click', (e) => { e.preventDefault(); pop.hidden ? open() : close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', (e) => {
    if (pop.hidden) return;
    if (!pop.contains(e.target) && e.target !== btn) close();
  });

  // copy → check → zpět
  const COPIED_MS = 1400;
  let t;
  const showError = (msg='✖️ Nepodařilo se zkopírovat') => {
    if (!toast) return;
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(showError._t);
    showError._t = setTimeout(() => { toast.hidden = true; }, 1800);
  };

  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email || copyBtn.querySelector('.copy-text')?.textContent?.trim();
    if (!email) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email);
      else { const i = document.createElement('input'); i.value = email; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
      copyBtn.classList.add('copied');
      copyBtn.setAttribute('aria-label', 'Zkopírováno');
      clearTimeout(t);
      t = setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.setAttribute('aria-label', 'Zkopírovat e-mail');
      }, COPIED_MS);
    } catch { showError(); }
  });
})();

(() => {
  const thumbs = Array.from(document.querySelectorAll('.gallery img'));
  if (!thumbs.length) return;

  // Overlay DOM
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('hidden','');

  overlay.innerHTML = `
    <img class="lightbox__img" alt="">
    <button class="lightbox__btn lightbox__prev" aria-label="Předchozí (šipka vlevo)">&#x2039;</button>
    <button class="lightbox__btn lightbox__next" aria-label="Další (šipka vpravo)">&#x203A;</button>
    <button class="lightbox__btn lightbox__close" aria-label="Zavřít (Esc)">&#x2715;</button>
  `;
  document.body.appendChild(overlay);

  const img = overlay.querySelector('.lightbox__img');
  const btnPrev = overlay.querySelector('.lightbox__prev');
  const btnNext = overlay.querySelector('.lightbox__next');
  const btnClose = overlay.querySelector('.lightbox__close');

  let idx = 0;
  const srcFor = (el) => el.dataset.full || el.currentSrc || el.src;

  const open = (i) => {
    idx = i;
    img.src = srcFor(thumbs[idx]);
    overlay.removeAttribute('hidden');
    document.documentElement.style.overflow = 'hidden';
    btnClose.focus();
  };
  const close = () => {
    overlay.setAttribute('hidden','');
    img.src = '';
    document.documentElement.style.overflow = '';
  };
  const prev = () => open((idx - 1 + thumbs.length) % thumbs.length);
  const next = () => open((idx + 1) % thumbs.length);

  thumbs.forEach((t, i) => {
    t.addEventListener('click', () => open(i));
  });

  // Interakce
  overlay.addEventListener('click', (e) => {
    // klik mimo obrázek = zavřít
    if (e.target === overlay) close();
  });
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  btnNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });

  document.addEventListener('keydown', (e) => {
    if (overlay.hasAttribute('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });
})();
