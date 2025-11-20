(function () {
  const items = Array.from(document.querySelectorAll('.photo-gallery__item'));
  const modal = document.querySelector('.gallery-modal');

  if (!items.length || !modal) {
    return;
  }

  const imageEl = modal.querySelector('.gallery-modal__image');
  const captionEl = modal.querySelector('.gallery-modal__caption');
  const closeBtn = modal.querySelector('.gallery-modal__close');
  const backdrop = modal.querySelector('.gallery-modal__backdrop');
  const prevBtn = modal.querySelector('.gallery-modal__prev');
  const nextBtn = modal.querySelector('.gallery-modal__next');

  let currentIndex = 0;

  function openModal(index) {
    currentIndex = index;
    const item = items[currentIndex];
    if (!item) return;

    const img = item.querySelector('img');
    const label = item.querySelector('.photo-gallery__label');
    const src = img && img.getAttribute('src');
    const alt = (img && img.getAttribute('alt')) || '';
    const caption = item.dataset.galleryCaption || (label && label.textContent) || '';

    if (src) {
      imageEl.src = src;
      imageEl.alt = alt;
    }

    captionEl.textContent = caption;

    modal.hidden = false;
    document.body.classList.add('no-scroll');
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
  }

  function showNext(delta) {
    const total = items.length;
    currentIndex = (currentIndex + delta + total) % total;
    openModal(currentIndex);
  }

  // Otevření modalu po kliku na náhled
  items.forEach((item, index) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openModal(index);
    });
  });

  // Základní ovládání
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  prevBtn.addEventListener('click', () => showNext(-1));
  nextBtn.addEventListener('click', () => showNext(1));

  // Kliknutí na levou / pravou část obrázku = předchozí / další
  imageEl.addEventListener('click', (event) => {
    const rect = imageEl.getBoundingClientRect();
    const x = event.clientX - rect.left;

    if (x > rect.width * 0.5) {
      showNext(1);   // pravá půlka -> další
    } else {
      showNext(-1);  // levá půlka -> předchozí
    }
  });

  // Touch gesta – svislý swipe (nahoru/dolu) zavře galerii
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;

  function handleTouchStart(event) {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchActive = true;
  }

  function handleTouchEnd(event) {
    if (!touchActive) return;
    touchActive = false;

    if (!event.changedTouches || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const MIN_SWIPE = 40;

    // Převládá svislý pohyb a je dost velký -> zavřít
    if (absDy > absDx && absDy > MIN_SWIPE) {
      closeModal();
    }
  }

  // Swipe na obrázku i na pozadí
  imageEl.addEventListener('touchstart', handleTouchStart, { passive: true });
  imageEl.addEventListener('touchend', handleTouchEnd);
  backdrop.addEventListener('touchstart', handleTouchStart, { passive: true });
  backdrop.addEventListener('touchend', handleTouchEnd);

  // Klávesy – desktop
  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;

    if (event.key === 'Escape') {
      closeModal();
    } else if (event.key === 'ArrowLeft') {
      showNext(-1);
    } else if (event.key === 'ArrowRight') {
      showNext(1);
    }
  });
})();
