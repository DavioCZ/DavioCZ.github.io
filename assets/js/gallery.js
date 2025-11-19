(function () {
  const items = Array.from(document.querySelectorAll('.gallery__item'));
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
    const item = items[index];
    if (!item) return;

    currentIndex = index;

    const fullSrc = item.getAttribute('data-full') || item.querySelector('img').src;
    const caption = item.getAttribute('data-caption') || item.querySelector('.gallery__label')?.textContent || '';

    imageEl.src = fullSrc;
    imageEl.alt = caption || item.querySelector('img').alt || '';
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

  items.forEach((item, index) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openModal(index);
    });
  });

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  prevBtn.addEventListener('click', () => showNext(-1));
  nextBtn.addEventListener('click', () => showNext(1));

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
