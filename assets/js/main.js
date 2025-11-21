document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".project-card");
  
  // Zde už nepotřebujeme vybírat grid pro event listener,
  // ale hodí se ověřit, zda vůbec máme karty, abychom neběželi zbytečně.
  if (!cards.length) return;

  // ZMĚNA: Místo grid.addEventListener posloucháme na celém dokumentu
  document.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      
      // Výpočet funguje i mimo element (vyjdou záporná čísla nebo čísla větší než šířka)
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      card.style.setProperty("--x", `${x}px`);
      card.style.setProperty("--y", `${y}px`);
    });
  });
});
