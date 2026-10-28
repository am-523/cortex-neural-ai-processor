import Lenis from 'lenis';

// =====================================================================
// CORTEX SYNAPSE X1 — PRECISION LERP SCRUBBING & CANVAS STREAM
// =====================================================================

const TOTAL_FRAMES = 240;
const INITIAL_PRELOAD_COUNT = 30;
const frames = [];
let loadedCount = 0;
let initialLoaded = false;

// DOM Elements
const canvas = document.getElementById('scrubCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');
const storyStream = document.getElementById('hero');

// Animation State
let targetFrame = 0;
let currentFrame = 0;

// Format frame URL: /asset/0001.jpg -> /asset/0240.jpg
function getFrameUrl(index) {
  const num = String(index + 1).padStart(4, '0');
  return `/asset/${num}.jpg`;
}

// 1. High Resolution Canvas Setup (Supports 2x Retina & Ultra-wide)
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawFrame(Math.round(currentFrame));
}

// 2. High-DPI Aspect Cover Drawing Logic
function drawFrame(frameIndex) {
  let img = frames[frameIndex];

  // Fallback to nearest available frame if target is still downloading
  if (!img || !img.complete || img.naturalWidth === 0) {
    for (let offset = 1; offset < 20; offset++) {
      const prev = frames[Math.max(0, frameIndex - offset)];
      if (prev && prev.complete && prev.naturalWidth > 0) {
        img = prev;
        break;
      }
      const next = frames[Math.min(TOTAL_FRAMES - 1, frameIndex + offset)];
      if (next && next.complete && next.naturalWidth > 0) {
        img = next;
        break;
      }
    }
  }

  if (!img || !img.complete || img.naturalWidth === 0) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // Aspect cover calculation
  const hRatio = cw / iw;
  const vRatio = ch / ih;
  const ratio = Math.max(hRatio, vRatio);

  const nw = iw * ratio;
  const nh = ih * ratio;
  const cx = (cw - nw) / 2;
  const cy = (ch - nh) / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, iw, ih, cx, cy, nw, nh);
}

// 3. Smooth LERP Render Loop (60fps)
function renderLoop() {
  // 0.08 factor gives fluid momentum
  currentFrame += (targetFrame - currentFrame) * 0.08;

  if (Math.abs(targetFrame - currentFrame) > 0.005) {
    drawFrame(Math.round(currentFrame));
  }

  requestAnimationFrame(renderLoop);
}

// 4. Initialize Lenis Smooth Scroll
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.5,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 5. Scroll Handler
lenis.on('scroll', ({ scroll }) => {
  if (!storyStream) return;

  const streamTop = storyStream.offsetTop;
  const streamHeight = storyStream.offsetHeight;
  const maxScrubDistance = streamHeight - window.innerHeight;

  if (maxScrubDistance <= 0) return;

  // Progress across the hero stream [0 to 1]
  const heroProgress = Math.min(Math.max((scroll - streamTop) / maxScrubDistance, 0), 1);
  targetFrame = heroProgress * (TOTAL_FRAMES - 1);

  // Update floating dock active indicator
  updateDockActive(scroll);
});

// Smooth anchor scrolling via Lenis
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId && targetId !== '#') {
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        lenis.scrollTo(targetEl, { offset: 0, duration: 1.4 });
      }
    }
  });
});

function updateDockActive(scroll) {
  const dockLinks = document.querySelectorAll('.dock-link');
  const acts = ['act-1', 'act-2', 'act-3', 'act-4'];

  let currentAct = 'act-1';
  for (const id of acts) {
    const el = document.getElementById(id);
    if (el) {
      const top = el.offsetTop - window.innerHeight * 0.4;
      if (scroll >= top) {
        currentAct = id;
      }
    }
  }

  dockLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === `#${currentAct}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// 6. Two-Phase Preloader: Fast First Paint + Background Streaming
function preloadAssetFrames() {
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      loadedCount++;

      // Update loader for the first 30 critical frames
      if (!initialLoaded) {
        const percent = Math.min(Math.round((loadedCount / INITIAL_PRELOAD_COUNT) * 100), 100);
        if (loaderBar) loaderBar.style.width = `${percent}%`;
        if (loaderPercent) loaderPercent.textContent = `${percent}%`;

        if (loadedCount >= INITIAL_PRELOAD_COUNT) {
          initialLoaded = true;
          if (loader) {
            loader.classList.add('loaded');
            setTimeout(() => {
              loader.style.display = 'none';
            }, 600);
          }
          resizeCanvas();
        }
      }
    };

    img.onerror = () => {
      loadedCount++;
      if (!initialLoaded && loadedCount >= INITIAL_PRELOAD_COUNT) {
        initialLoaded = true;
        if (loader) {
          loader.classList.add('loaded');
          setTimeout(() => {
            loader.style.display = 'none';
          }, 600);
        }
        resizeCanvas();
      }
    };

    // Immediate load first 30 frames, stream the rest
    if (i < INITIAL_PRELOAD_COUNT) {
      img.src = getFrameUrl(i);
    } else {
      setTimeout(() => {
        img.src = getFrameUrl(i);
      }, 100 + (i - INITIAL_PRELOAD_COUNT) * 6);
    }

    frames.push(img);
  }
}

// Window resize
window.addEventListener('resize', resizeCanvas);

// Launch engine
preloadAssetFrames();
resizeCanvas();
requestAnimationFrame(renderLoop);
