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

})();

(function () {
  const wrapper = document.querySelector('[data-cards-glow]');
  if (!wrapper) return;

  // jen pro “normální” kurzor, ne mobil
  const prefersFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (!prefersFinePointer) return;

  const glow = wrapper.querySelector('.cards-glow');
  if (!glow) return;

  let glowVisible = false;
  let rafId = null;

  const state = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };

  function updateGlow() {
    // jednoduchý “lerp” – aby se hezky zpožďoval
    const lerpFactor = 0.18;
    state.x += (state.targetX - state.x) * lerpFactor;
    state.y += (state.targetY - state.y) * lerpFactor;

    glow.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;

    // pokud je blob viditelný, pokračuj v animaci
    if (glowVisible) {
      rafId = window.requestAnimationFrame(updateGlow);
    } else {
      rafId = null;
    }
  }

  wrapper.addEventListener('pointermove', (event) => {
    const rect = wrapper.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // posuneme glow tak, aby byl střed v místě kurzoru
    state.targetX = x - glow.offsetWidth / 2;
    state.targetY = y - glow.offsetHeight / 2;

    if (!glowVisible) {
      glowVisible = true;
      glow.style.opacity = '1';
      if (rafId == null) {
        rafId = window.requestAnimationFrame(updateGlow);
      }
    }
  });

  wrapper.addEventListener('pointerleave', () => {
    glowVisible = false;
    glow.style.opacity = '0';

    if (rafId != null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  });
})();
