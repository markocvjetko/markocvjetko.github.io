(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('lenia-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const NW = 144;
  const NH = 80;
  canvas.width = NW;
  canvas.height = NH;

  const R = 13;
  const dt = 0.1;
  const mu = 0.15;
  const sigma = 0.015;
  const kStd = 0.15;

  // Ring-Gaussian kernel, sparse: keep only non-trivial weights.
  const raw = [];
  let kSum = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.sqrt(dx * dx + dy * dy) / R;
      if (r === 0 || r >= 1) continue;
      const w = Math.exp(-((r - 0.5) ** 2) / (2 * kStd * kStd));
      raw.push([dx, dy, w]);
      kSum += w;
    }
  }
  const filtered = raw.filter((k) => k[2] / kSum > 1e-4);
  const KL = filtered.length;
  const KX = new Int32Array(KL);
  const KY = new Int32Array(KL);
  const KW = new Float32Array(KL);
  for (let i = 0; i < KL; i++) {
    KX[i] = filtered[i][0];
    KY[i] = filtered[i][1];
    KW[i] = filtered[i][2] / kSum;
  }

  // Canonical Orbium (Bert Chan).
  const orbium = [
    [0,0,0,0,0,0,0.1,0.14,0.1,0,0,0.03,0.03,0,0,0.3,0,0,0,0],
    [0,0,0,0,0,0.08,0.24,0.3,0.3,0.18,0.14,0.15,0.16,0.15,0.09,0.2,0,0,0,0],
    [0,0,0,0,0.15,0.34,0.44,0.46,0.38,0.18,0.14,0.11,0.13,0.19,0.18,0.45,0,0,0,0],
    [0,0,0,0.06,0.13,0.39,0.5,0.5,0.37,0.06,0,0,0,0.02,0.16,0.68,0,0,0,0],
    [0,0,0,0.11,0.17,0.17,0.33,0.4,0.38,0.28,0.14,0,0,0,0,0.18,0.42,0,0,0],
    [0,0,0.09,0.18,0.13,0.06,0.08,0.26,0.32,0.32,0.27,0,0,0,0,0,0.82,0,0,0],
    [0.27,0,0.16,0.12,0,0,0,0.25,0.38,0.44,0.45,0.34,0,0,0,0,0.22,0.17,0,0],
    [0,0.07,0.2,0.02,0,0,0,0.31,0.48,0.57,0.6,0.57,0,0,0,0,0,0.49,0,0],
    [0,0.59,0.19,0,0,0,0,0.2,0.57,0.69,0.76,0.76,0.49,0,0,0,0,0.36,0,0],
    [0,0.58,0.19,0,0,0,0,0,0.67,0.83,0.9,0.92,0.87,0.12,0,0,0,0.22,0.07,0],
    [0,0,0.46,0,0,0,0,0,0.7,0.93,1,1,1,0.61,0,0,0,0.18,0.11,0],
    [0,0,0.82,0,0,0,0,0,0.47,1,1,0.98,1,0.96,0.27,0,0,0.19,0.1,0],
    [0,0,0.46,0,0,0,0,0,0.25,1,1,0.84,0.92,0.97,0.54,0.14,0.04,0.1,0.21,0.05],
    [0,0,0,0.4,0,0,0,0,0.09,0.8,1,0.82,0.8,0.85,0.63,0.31,0.18,0.19,0.2,0.01],
    [0,0,0,0.36,0.1,0,0,0,0.05,0.54,0.86,0.79,0.74,0.72,0.6,0.39,0.28,0.24,0.13,0],
    [0,0,0,0.01,0.3,0.07,0,0,0.08,0.36,0.64,0.7,0.64,0.6,0.51,0.39,0.29,0.19,0.04,0],
    [0,0,0,0,0.1,0.24,0.14,0.1,0.15,0.29,0.45,0.53,0.52,0.46,0.4,0.31,0.21,0.08,0,0],
    [0,0,0,0,0,0.08,0.21,0.21,0.22,0.29,0.36,0.39,0.37,0.33,0.26,0.18,0.09,0,0,0],
    [0,0,0,0,0,0,0.03,0.13,0.19,0.22,0.24,0.24,0.23,0.18,0.13,0.05,0,0,0,0],
    [0,0,0,0,0,0,0,0,0.02,0.06,0.08,0.09,0.07,0.05,0.01,0,0,0,0,0]
  ];

  let A = new Float32Array(NW * NH);
  let B = new Float32Array(NW * NH);
  const shiftTmp = new Float32Array(NW * NH);

  (function place() {
    const oy = (NH >> 1) - 10;
    const ox = (NW >> 1) - 10;
    for (let y = 0; y < orbium.length; y++) {
      for (let x = 0; x < orbium[y].length; x++) {
        A[((oy + y + NH) % NH) * NW + ((ox + x + NW) % NW)] = orbium[y][x];
      }
    }
  })();

  function step() {
    const inv2s2 = 1 / (2 * sigma * sigma);
    for (let y = 0; y < NH; y++) {
      for (let x = 0; x < NW; x++) {
        let u = 0;
        for (let k = 0; k < KL; k++) {
          let xi = x + KX[k];
          let yi = y + KY[k];
          if (xi < 0) xi += NW; else if (xi >= NW) xi -= NW;
          if (yi < 0) yi += NH; else if (yi >= NH) yi -= NH;
          u += A[yi * NW + xi] * KW[k];
        }
        const d = u - mu;
        const g = 2 * Math.exp(-d * d * inv2s2) - 1;
        let v = A[y * NW + x] + dt * g;
        if (v < 0) v = 0; else if (v > 1) v = 1;
        B[y * NW + x] = v;
      }
    }
    const tmp = A; A = B; B = tmp;
  }

  // Toroidal vertical shift of the whole field. Positive n shifts content down.
  function shiftFieldVertical(n) {
    n = ((n % NH) + NH) % NH;
    if (n === 0) return;
    for (let y = 0; y < NH; y++) {
      const src = (y - n + NH) % NH;
      for (let x = 0; x < NW; x++) {
        shiftTmp[y * NW + x] = A[src * NW + x];
      }
    }
    A.set(shiftTmp);
  }

  // Plasma colormap (polynomial fit of matplotlib's plasma, by Matt Zucker).
  // Precomputed 256-entry RGB LUT keyed on the cell value scaled to 0..255.
  const PLASMA = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r = 0.063861086 + t * (0.971027216 + t * (0.394269428 + t * (-2.418988256 + t * (1.948257430 + t * -0.140898800))));
    let g = 0.020386400 + t * (0.798972380 + t * (-3.064500980 + t * (5.291974480 + t * (-3.901635950 + t * 0.876057820))));
    let b = 0.521716126 + t * (1.296622740 + t * (-3.952574420 + t * (5.336554440 + t * (-3.241729420 + t * 0.555745160))));
    if (r < 0) r = 0; else if (r > 1) r = 1;
    if (g < 0) g = 0; else if (g > 1) g = 1;
    if (b < 0) b = 0; else if (b > 1) b = 1;
    PLASMA[i * 3]     = (r * 255) | 0;
    PLASMA[i * 3 + 1] = (g * 255) | 0;
    PLASMA[i * 3 + 2] = (b * 255) | 0;
  }

  const img = ctx.createImageData(NW, NH);
  function render() {
    const data = img.data;
    for (let i = 0; i < NW * NH; i++) {
      const v = A[i];
      const idx = (v * 255) | 0;
      const k = idx * 3;
      const j = i << 2;
      data[j]     = PLASMA[k];
      data[j + 1] = PLASMA[k + 1];
      data[j + 2] = PLASMA[k + 2];
      data[j + 3] = (v * 255) | 0;
    }
    ctx.putImageData(img, 0, 0);
  }

  // Scroll-driven shift: scrolling down pushes the glider up through the world.
  const SCROLL_FACTOR = 0.05;
  let totalShift = 0;
  let scrollScheduled = false;
  function applyScrollShift() {
    const target = Math.round(-window.scrollY * SCROLL_FACTOR);
    const delta = target - totalShift;
    if (delta !== 0) {
      shiftFieldVertical(delta);
      totalShift = target;
    }
  }
  function onScroll() {
    if (!scrollScheduled) {
      scrollScheduled = true;
      requestAnimationFrame(() => {
        scrollScheduled = false;
        applyScrollShift();
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  applyScrollShift(); // align with current scroll position on load

  function isLeniaOn() {
    return document.documentElement.getAttribute('data-lenia') !== 'off';
  }

  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.attributeName === 'data-lenia') {
        if (isLeniaOn()) startLoop(); else stopLoop();
      }
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lenia'] });

  let last = 0;
  let raf = 0;
  function loop(t) {
    if (t - last > 50) {
      step();
      render();
      last = t;
    }
    raf = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }
  function stopLoop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (isLeniaOn()) startLoop();
  });

  if (isLeniaOn()) startLoop();
})();
