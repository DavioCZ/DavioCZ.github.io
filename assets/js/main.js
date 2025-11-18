(() => {
  // ===== Kontakt popover (jen pokud existuje) =====
  const btn = document.getElementById('contactBtn');
  const pop = document.getElementById('contactPopover');
  const copyBtn = document.getElementById('copyEmailBtn');
  const toast = document.getElementById('toast');

  if (btn && pop) {
    const open = () => { pop.hidden = false; btn.setAttribute('aria-expanded','true'); };
    const close = () => { pop.hidden = true;  btn.setAttribute('aria-expanded','false'); };
    btn.addEventListener('click', (e) => { e.preventDefault(); pop.hidden ? open() : close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.addEventListener('click', (e) => {
      if (pop.hidden) return;
      if (!pop.contains(e.target) && e.target !== btn) close();
    });
  }

  if (copyBtn) {
    const COPIED_MS = 1400; let t;
    const showError = (msg='✖️ Nepodařilo se zkopírovat') => {
      if (!toast) return;
      toast.textContent = msg; toast.hidden = false;
      clearTimeout(showError._t); showError._t = setTimeout(() => { toast.hidden = true; }, 1800);
    };
    copyBtn.addEventListener('click', async () => {
      const email = copyBtn.dataset.email || copyBtn.querySelector('.copy-text')?.textContent?.trim();
      if (!email) return;
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email);
        else { const i = document.createElement('input'); i.value = email; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); }
        copyBtn.classList.add('copied'); copyBtn.setAttribute('aria-label', 'Zkopírováno');
        clearTimeout(t); t = setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.setAttribute('aria-label', 'Zkopírovat e-mail'); }, COPIED_MS);
      } catch { showError(); }
    });
  }

  // ===== Lightbox přes delegaci (funguje všude) =====
  let thumbs = [];
  const collect = () => { thumbs = Array.from(document.querySelectorAll('.gallery img')); return thumbs; };

  // vytvoř/vrat overlay jen jednou
  const ensureOverlay = () => {
    let ov = document.getElementById('lightbox');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'lightbox';
    ov.className = 'lightbox';
    ov.setAttribute('role','dialog');
    ov.setAttribute('aria-modal','true');
    ov.setAttribute('hidden','');
    ov.innerHTML = `
      <img class=\"lightbox__img\" alt=\"\">
      <button class=\"lightbox__btn lightbox__prev\" aria-label=\"Předchozí\">&#x2039;</button>
      <button class=\"lightbox__btn lightbox__next\" aria-label=\"Další\">&#x203A;</button>
      <button class=\"lightbox__btn lightbox__close\" aria-label=\"Zavřít\">&#x2715;</button>
    `;
    document.body.appendChild(ov);
    return ov;
  };

  const overlay = ensureOverlay();
  const img = overlay.querySelector('.lightbox__img');
  const btnPrev = overlay.querySelector('.lightbox__prev');
  const btnNext = overlay.querySelector('.lightbox__next');
  const btnClose = overlay.querySelector('.lightbox__close');

  let idx = -1;
  const srcFor = (el) => el.dataset.full || el.currentSrc || el.src;

  const openByEl = (el) => {
    collect();
    idx = thumbs.indexOf(el);
    if (idx < 0) return;
    img.src = srcFor(el);
    overlay.removeAttribute('hidden');
    document.documentElement.style.overflow = 'hidden';
    btnClose.focus();
  };
  const close = () => { overlay.setAttribute('hidden',''); img.src = ''; document.documentElement.style.overflow = ''; };
  const prev  = () => { collect(); if (!thumbs.length) return; idx = (idx - 1 + thumbs.length) % thumbs.length; img.src = srcFor(thumbs[idx]); };
  const next  = () => { collect(); if (!thumbs.length) return; idx = (idx + 1) % thumbs.length;       img.src = srcFor(thumbs[idx]); };

  // klik na libovolný obrázek v .gallery
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.gallery img');
    if (t) openByEl(t);
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', (e)=>{ e.stopPropagation(); prev(); });
  btnNext.addEventListener('click', (e)=>{ e.stopPropagation(); next(); });

  document.addEventListener('keydown', (e) => {
    if (overlay.hasAttribute('hidden')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });
})();
