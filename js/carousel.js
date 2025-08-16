(function(){
  // Images in images/ folder, excluding the night-sky image (night_sky_img.jpg)
  const images = [
    'images/abstract_painting_1.png',
    'images/abstract_painting_2.png',
    'images/abstract_painting_3.png',
    'images/abstract_painting_4.png',
    'images/pumpkins_art.png',
    'images/mouse_cup.png'
  ];

  const slidesEl = document.getElementById('slides');
  const dotsEl = document.getElementById('dots');

  images.forEach((src, i) => {
    const s = document.createElement('div'); s.className = 'slide';
    const img = document.createElement('img'); img.src = src; img.alt = src.split('/').pop().replace(/[_\-]/g,' ');
    s.appendChild(img); slidesEl.appendChild(s);

    const d = document.createElement('button'); d.className = 'dot'; d.setAttribute('aria-label', 'Go to slide '+(i+1)); d.addEventListener('click', ()=> goTo(i));
    dotsEl.appendChild(d);
  });

  let index = 0; const total = images.length;
  function update(){ slidesEl.style.transform = 'translateX(-'+(index*100)+'%)'; Array.from(dotsEl.children).forEach((d,i)=> d.classList.toggle('active', i===index)); }
  function prev(){ index = (index-1+total)%total; update(); resetTimer(); }
  function next(){ index = (index+1)%total; update(); resetTimer(); }
  function goTo(i){ index = i%total; update(); resetTimer(); }

  document.getElementById('prev').addEventListener('click', prev);
  document.getElementById('next').addEventListener('click', next);

  let timer = null;
  function startTimer(){ timer = setInterval(()=>{ index = (index+1)%total; update(); }, 4000); }
  function resetTimer(){ clearInterval(timer); startTimer(); }

  const carousel = document.getElementById('carousel');
  carousel.addEventListener('mouseenter', ()=> clearInterval(timer));
  carousel.addEventListener('mouseleave', ()=> startTimer());

  update(); startTimer();
})();
