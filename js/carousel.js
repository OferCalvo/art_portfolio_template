(function(){
  // minimal, dependency-free carousel that populates slides from images/ folder

  const IMAGES = [
    'abstract_painting_1.png',
    'abstract_painting_2.png',
    'abstract_painting_3.png',
    'abstract_painting_4.png',
    'pumpkins_art.png',
    'mouse_cup.png'
    // add or remove filenames (located in /images) as needed
  ];

  const carousel = document.getElementById('carousel');
  const slidesEl = document.getElementById('slides');
  if (!carousel || !slidesEl) return;

  let current = 0;
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const dotsContainer = document.getElementById('dots');

  function getSlides() { return Array.from(slidesEl.children).filter(n => n.classList && n.classList.contains('slide')); }

  // create a slide element and start loading the image; return a promise that settles when load/error occurs
  function createSlideForSrc(srcUrl, altText = '') {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const img = document.createElement('img');
    img.className = 'carousel-img';
    img.alt = altText;
    img.loading = 'lazy';
    img.src = srcUrl;
    slide.appendChild(img);
    slidesEl.appendChild(slide);

    return new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth) return resolve(slide);
      img.addEventListener('load', () => resolve(slide), {once:true});
      img.addEventListener('error', () => reject({slide, src: srcUrl}), {once:true});
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

  async function populateSlides() {
    slidesEl.innerHTML = '';
    const created = [];
    const base = document.baseURI; // ensure paths resolve relative to the page
    const promises = IMAGES.map(name => {
      const url = new URL('./images/' + name, base).href;
      return createSlideForSrc(url, name)
        .then(slide => { created.push(slide); })
        .catch(err => {
          // missing or failed image: keep note and remove failed slide element
          console.warn('Failed to load image:', err.src);
          if (err.slide && err.slide.parentNode) err.slide.parentNode.removeChild(err.slide);
        });
    });

    await Promise.all(promises);

    // fallback if nothing loaded
    if (created.length === 0) {
      try {
        const fallbackUrl = new URL('./images/night_sky_img.jpg', base).href;
        await createSlideForSrc(fallbackUrl, 'fallback');
      } catch (_) {
        // nothing to show
      }
    }

    // after images are added, compute heights and widths
    computeAndSetCarouselHeight();
    updateSlideWidths();
    createDots();

    // if some images load a bit later, recompute a short time later
    setTimeout(() => { computeAndSetCarouselHeight(); updateSlideWidths(); }, 150);

    // ensure any late-loading images trigger re-computation
    getSlides().forEach(slide => {
      const img = slide.querySelector('img');
      if (!img) return;
      if (!img.complete) {
        img.addEventListener('load', () => {
          computeAndSetCarouselHeight();
          updateSlideWidths();
        }, {once:true});
      }
    });
  }

  function updateSlideWidths() {
    const w = carousel.clientWidth || carousel.getBoundingClientRect().width;
    getSlides().forEach(slide => {
      slide.style.width = w + 'px';
    });
    slidesEl.style.transition = 'transform .6s cubic-bezier(.2,.9,.2,1)';
    moveTo(current, false);
  }

  function moveTo(index, animate = true) {
    const slides = getSlides();
    if (!slides.length) return;
    current = Math.max(0, Math.min(index, slides.length -1));
    const w = carousel.clientWidth || carousel.getBoundingClientRect().width;
    if (!animate) slidesEl.style.transition = 'none';
    slidesEl.style.transform = `translateX(-${current * w}px)`;
    requestAnimationFrame(()=> { if (!animate) slidesEl.style.transition = ''; });
    updateDots();
  }

  function prev() { moveTo(current - 1); }
  function next() { moveTo(current + 1); }

  function createDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const slides = getSlides();
    slides.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.className = 'dot';
      btn.setAttribute('aria-label', `Slide ${i+1}`);
      btn.addEventListener('click', () => moveTo(i));
      dotsContainer.appendChild(btn);
    });
    updateDots();
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

  function initControls() {
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });
  }

  function init() {
    initControls();
    populateSlides();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
