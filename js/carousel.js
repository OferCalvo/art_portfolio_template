(function(){
  // minimal, dependency-free carousel that populates slides from images/ folder

  // fetch external config and populate the carousel using its items
  let ITEMS = [];

  const carousel = document.getElementById('carousel');
  const slidesEl = document.getElementById('slides');
  const captionEl = document.getElementById('ticket');
  const titleEl = document.getElementById('slide-title');
  if (!carousel || !slidesEl) return;

  let current = 0;
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const dotsContainer = document.getElementById('dots');

  function getSlides() { return Array.from(slidesEl.children).filter(n => n.classList && n.classList.contains('slide')); }

  // sanitize simple text for injection
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // create slide and append immediately; return promise resolved on load or rejected on error
  function createSlideForItem(item, base){
    const slide = document.createElement('div');
    slide.className = 'slide';
    const img = document.createElement('img');
    img.className = 'carousel-img';
    img.alt = item.title || '';
    img.loading = 'lazy';
    const url = new URL(item.image, base).href;
    img.src = url;
    // Add click handler directly when creating the image
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      const modal = document.getElementById('imageModal');
      const modalImg = document.getElementById('modalImage');
      modalImg.src = url;
      modalImg.alt = img.alt;
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    });
    slide.appendChild(img);
    slidesEl.appendChild(slide);
    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth) return resolve(slide);
      img.addEventListener('load', () => resolve(slide), {once:true});
      img.addEventListener('error', () => reject({slide, src: url}), {once:true});
    });
  }

  // update title element
  function updateTitle(idx){
    if (!titleEl) return;
    const item = ITEMS[idx] || {};
    titleEl.textContent = item.title || '';
  }

  // update ticket/caption element
  function updateCaption(idx){
    if (!captionEl) return;
    const item = ITEMS[idx] || {};
    if (!item.title && !item.description) { captionEl.innerHTML = ''; return; }
    captionEl.innerHTML = `
      <div class="title">${escapeHtml(item.title || '')}</div>
      <div class="body">${escapeHtml(item.description || '')}</div>
    `;
  }

  // populate slides from ITEMS
  async function populateSlides(){
    slidesEl.innerHTML = '';
    const base = document.baseURI;
    const created = [];
    const promises = ITEMS.map(it => createSlideForItem(it, base)
      .then(s => created.push(s))
      .catch(err => { console.warn('Failed to load', err.src); if (err.slide && err.slide.parentNode) err.slide.parentNode.removeChild(err.slide); }));

    await Promise.all(promises);

    // if nothing succeeded, try a simple fallback (first item) so UI shows something
    if (created.length === 0 && Array.isArray(ITEMS) && ITEMS.length > 0) {
      try {
        await createSlideForItem(ITEMS[0], base);
      } catch (_) { /* ignore */ }
    }

    // set slide widths and heights after load attempts
    computeAndSetCarouselHeight();
    updateSlideWidths();

    // always create dots from whatever slides exist
    createDots();

    // update title + caption to current
    updateTitle(current);
    updateCaption(current);

    // re-run a short time later to catch late layout changes
    setTimeout(()=>{ computeAndSetCarouselHeight(); updateSlideWidths(); updateTitle(current); updateCaption(current); }, 150);

    // listen for late image loads to recompute
    getSlides().forEach(slide => {
      const img = slide.querySelector('img');
      if (!img) return;
      if (!img.complete) img.addEventListener('load', () => { computeAndSetCarouselHeight(); updateSlideWidths(); }, {once:true});
    });
  }

  // modify moveTo to update title + caption on change
  function moveTo(index, animate = true){
    const slides = getSlides();
    if (!slides.length) return;
    current = Math.max(0, Math.min(index, slides.length -1));
    const w = carousel.clientWidth || carousel.getBoundingClientRect().width;
    if (!animate) slidesEl.style.transition = 'none';
    slidesEl.style.transform = `translateX(-${current * w}px)`;
    requestAnimationFrame(()=>{ if (!animate) slidesEl.style.transition = ''; });
    updateDots();
    updateTitle(current);
    updateCaption(current);
  }

  function prev() { moveTo(current - 1); }
  function next() { moveTo(current + 1); }

  function createDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const slides = getSlides();

    // Reset current to 0 when creating new dots
    current = 0;
    slides.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dot';
      btn.setAttribute('data-index', String(i));
      btn.setAttribute('aria-label', `Slide ${i+1}`);
      btn.addEventListener('click', () => moveTo(i));
      dotsContainer.appendChild(btn);
      if (i === 0) btn.classList.add('active');
    });
    // Update dots to show first one as active
    updateDots();
    // Also update title and caption for first slide
    updateTitle(current);
    updateCaption(current);
  }

  function updateDots() {
    if (!dotsContainer) return;
    Array.from(dotsContainer.children).forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      computeAndSetCarouselHeight();
      updateSlideWidths();
    }, 120);
  }

  // Touch handling for swipe gestures
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let isDragging = false;
  let isScrolling = false;
  let startTime = 0;
  const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe
  const SWIPE_TIME_THRESHOLD = 500; // Maximum time for a swipe (ms)
  const SCROLL_TOLERANCE = 10; // Vertical scroll tolerance before canceling swipe

  function handleTouchStart(e) {
    if (e.touches.length !== 1) return; // Ignore multi-touch
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    startTime = Date.now();
    isDragging = true;
    isScrolling = false;

    // Get current transform value
    const style = window.getComputedStyle(slidesEl);
    const matrix = new WebKitCSSMatrix(style.transform);
    currentTransform = matrix.m41;
    
    // Disable transition during drag
    slidesEl.style.transition = 'none';
  }

  function handleTouchMove(e) {
    if (!isDragging || isScrolling) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // We only call preventDefault when we're sure it's a horizontal swipe
      // and the event is cancelable
      if (e.cancelable) {
        e.preventDefault();
      }

      const w = carousel.clientWidth;
      const maxScroll = -(getSlides().length - 1) * w;
      
      // Calculate new position with resistance at edges
      let newTransform = currentTransform + deltaX;
      if (newTransform > 0) {
        newTransform = newTransform * 0.3; // Add resistance at start
      } else if (newTransform < maxScroll) {
        newTransform = maxScroll + (newTransform - maxScroll) * 0.3; // Add resistance at end
      }
      
      slidesEl.style.transform = `translateX(${newTransform}px)`;
    } else if (!isScrolling && Math.abs(deltaY) > SCROLL_TOLERANCE) {
      // If it's clearly a vertical scroll, mark it and stop dragging
      isScrolling = true;
      isDragging = false;
    }
  }

  function handleTouchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    // Re-enable transition
    slidesEl.style.transition = '';
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaTime = Date.now() - startTime;

    // Determine if swipe was valid
    const isValidSwipe = Math.abs(deltaX) > SWIPE_THRESHOLD && 
                        deltaTime < SWIPE_TIME_THRESHOLD &&
                        !isScrolling;

    if (isValidSwipe) {
      if (deltaX > 0) {
        prev(); // Swipe right -> previous slide
      } else {
        next(); // Swipe left -> next slide
      }
    } else {
      // Snap back to nearest slide
      moveTo(current);
    }
  }

  function handleTouchCancel() {
    if (!isDragging) return;
    isDragging = false;
    isScrolling = false;
    slidesEl.style.transition = '';
    moveTo(current); // Snap back to current slide
  }

  function initControls() {
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // Add touch event listeners with proper passive settings
    slidesEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    // Use a separate listener for initial touch movement detection
    let touchMoveInitialized = false;
    slidesEl.addEventListener('touchmove', (e) => {
      if (!touchMoveInitialized) {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartX);
        const deltaY = Math.abs(touch.clientY - touchStartY);
        
        // If horizontal movement is dominant, add the non-passive listener
        if (deltaX > deltaY && deltaX > SCROLL_TOLERANCE) {
          touchMoveInitialized = true;
          slidesEl.addEventListener('touchmove', handleTouchMove, { passive: false });
        }
      }
    }, { passive: true });

    slidesEl.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].clientX;
      handleTouchEnd(e);
      touchMoveInitialized = false; // Reset for next touch
    });
    
    slidesEl.addEventListener('touchcancel', () => {
      handleTouchCancel();
      touchMoveInitialized = false; // Reset for next touch
    });
  }

  // compute a target carousel height so images are centered and maintain aspect ratio
  function computeAndSetCarouselHeight() {
    const slides = getSlides();
    if (!slides.length) {
      slidesEl.style.height = '';
      carousel.style.height = '';
      return;
    }

    const viewportH = window.innerHeight;
    // maximum allowed image height in viewport (matches CSS max-height: 64vh)
    const maxImgBlock = Math.floor(viewportH * 0.64);
    // available width inside carousel (account for slide horizontal padding 40px)
    const carouselW = Math.max(0, carousel.clientWidth);
    const availableW = Math.max(0, carouselW - 40);

    let maxScaledHeight = 0;
    slides.forEach(slide => {
      const img = slide.querySelector('img');
      if (!img || !img.naturalWidth || !img.naturalHeight) return;
      // scale to fit both width and max image height
      const scaleW = availableW / img.naturalWidth;
      const scaleH = maxImgBlock / img.naturalHeight;
      const scale = Math.min(scaleW, scaleH, 1); // don't upscale beyond natural size
      const scaledH = Math.round(img.naturalHeight * scale);
      if (scaledH > maxScaledHeight) maxScaledHeight = scaledH;
    });

    // include slide vertical padding (20px top + 20px bottom)
    const totalHeight = Math.max(0, maxScaledHeight + 40);
    // set heights so each slide fills that height and images are centered by flexbox
    slides.forEach(slide => slide.style.height = totalHeight + 'px');
    slidesEl.style.height = totalHeight + 'px';
    // constrain the outer carousel to the same height to keep controls centered
    carousel.style.height = totalHeight + 'px';
    // ensure carousel is wide enough to fit at least one slide
    carousel.style.minWidth = availableW + 'px';
    // ensure slides are centered vertically
    slidesEl.style.alignItems = 'center';
    // ensure carousel is wide enough to fit at least one slide
    carousel.style.minWidth = availableW + 'px';
    // ensure slides are centered vertically
    slidesEl.style.alignItems = 'center';
  }

  async function loadConfigAndInit(){
    try{
      const resp = await fetch('./carousel-config.json', {cache:'no-store'});
      if (!resp.ok) throw new Error('Failed to fetch config');
      const cfg = await resp.json();
      if (!Array.isArray(cfg) || cfg.length === 0) throw new Error('Empty config');
      ITEMS = cfg;
      // Reset current to 0 to ensure we start with the first slide
      current = 0;
      // Immediately update title and caption before populating slides
      updateTitle(current);
      updateCaption(current);
    }catch(err){
      console.error('Could not load carousel config:', err);
      ITEMS = []; // keep empty — populateSlides will do nothing
    }
    await populateSlides();
  }

  // update slide widths to match carousel width
  function updateSlideWidths() {
    const slides = getSlides();
    if (!slides.length) return;
    const w = carousel.clientWidth || carousel.getBoundingClientRect().width;
    slides.forEach(slide => {
      slide.style.width = w + 'px';
    });
    // update transform to maintain current position
    slidesEl.style.transform = `translateX(-${current * w}px)`;
  }

  function init(){
    initControls();
    loadConfigAndInit();
  }

  // new: refresh all UI pieces (sizes, title, caption, dots) — used on full page load
  function refreshAll(){
    if (!Array.isArray(ITEMS) || ITEMS.length === 0) {
      loadConfigAndInit().catch(()=>{/* ignore */});
      return;
    }
    try {
      computeAndSetCarouselHeight();
      updateSlideWidths();
      // ensure dots are created if missing
      if (dotsContainer && dotsContainer.children.length === 0) createDots();
      updateDots();
      updateTitle(current);
      updateCaption(current);
    } catch (err) {
      console.warn('refreshAll failed:', err);
    }
  }

  // Modal functionality
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const closeBtn = modal.querySelector('.modal-close');

  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
    setTimeout(() => {
      modalImg.src = ''; // Clear source after animation
    }, 300);
  }

  // Setup modal event listeners
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
  });

  // run init when DOM ready
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // new: ensure everything is updated once all page resources (images/CSS) have loaded
  window.addEventListener('load', refreshAll);

})();
