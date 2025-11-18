// DEMO mód: izolace dat + reset
(() => {
  const PREFIX = 'demo:';   // všechna klíčová data půjdou sem
  const ORIG = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: localStorage.removeItem.bind(localStorage),
    clear: localStorage.clear.bind(localStorage)
  };

  // Prefixed wrapper, aby se demo nehádalo s „ostrými“ daty
  localStorage.getItem = (k) => ORIG.getItem(PREFIX + k);
  localStorage.setItem = (k, v) => ORIG.setItem(PREFIX + k, v);
  localStorage.removeItem = (k) => ORIG.removeItem(PREFIX + k);
  // Pozn.: clear() necháme být, ať nesmaže cizí věci; reset řešíme níž.

  // UI banner
  function mountDemoBar(){
    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `
      <span class="demo-badge">Demo mód</span>
      <span class="spacer"></span>
      <button class="btn" id="demoReset">Resetovat demo</button>
      <a href="/projects/domaci-rozpocet.html" class="btn">Zpět na projekt</a>
      <a href="/" class="btn">Zpět na portfolio</a>
    `;
    document.body.prepend(bar);
    document.getElementById('demoReset').addEventListener('click', () => {
      // smažeme pouze naše prefikované klíče
      const keys = [];
      for (let i=0; i<localStorage.length; i++){
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach(k => ORIG.removeItem(k));
      location.reload();
    });
  }

  // Volitelně: můžeš sem přidat seed dat (pokud víš klíče svého úložiště)
  // localStorage.setItem('transactions', JSON.stringify([...]));

  document.addEventListener('DOMContentLoaded', mountDemoBar);
})();
