import { $, createSheet, openSheet, closeSheet, vibrate } from './ui.js';
import { loadScript } from './lazy.js';

const QUAGGA_URL = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
const el = $('#scanner');
const viewport = $('#scan-view');
const reticle = $('#reticle');
const statusEl = $('#scan-status');
const torchBtn = $('#scan-torch');
const manual = $('#scan-manual');
const manualInput = $('#scan-manual-input');

let session = null;
const sheet = createSheet(el, { backdropClose: false });
sheet.onClosing = () => {
  const s = session;
  if (s && !s.done) { s.done = true; try { s.stop?.(); } catch {} session = null; s.resolve(null); }
};

const setStatus = (t, err = false) => { statusEl.textContent = t; statusEl.classList.toggle('err', err); };

/** EAN-8/13, UPC checksum validation (same rules as the original app). */
export function isValidBarcode(code) {
  if (!/^\d{8,}$/.test(code)) return false;
  const check = (digits, odd, even) => {
    const sum = digits.split('').reduce((a, d, i) => a + (i % 2 === 0 ? +d * odd : +d * even), 0);
    return (10 - (sum % 10)) % 10;
  };
  if (code.length === 13) return +code[12] === check(code.slice(0, 12), 1, 3);
  if (code.length === 12) return +code[11] === check(code.slice(0, 11), 3, 1);
  return true;
}

function explain(err) {
  const n = err?.name || '';
  if (!navigator.mediaDevices?.getUserMedia) return 'הסריקה דורשת חיבור מאובטח (HTTPS).';
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError') return 'הגישה למצלמה נחסמה. אפשר אותה בהגדרות הדפדפן ונסה שוב.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'לא נמצאה מצלמה במכשיר.';
  if (n === 'NotReadableError') return 'המצלמה בשימוש באפליקציה אחרת.';
  return 'לא הצלחנו להפעיל את המצלמה. אפשר להקליד את הברקוד ידנית.';
}

function setupTorch(track) {
  const caps = track?.getCapabilities?.();
  if (!caps?.torch) return;
  let on = false;
  torchBtn.hidden = false;
  torchBtn.onclick = () => {
    on = !on;
    track.applyConstraints({ advanced: [{ torch: on }] })
      .then(() => torchBtn.setAttribute('aria-pressed', on))
      .catch(() => { on = !on; });
  };
}

function accept(s, code) {
  if (s.accepted || s.done) return;
  s.accepted = true;
  vibrate(40);
  reticle.classList.add('ok');
  setStatus(code);
  setTimeout(() => finish(s, code), 260);
}

function finish(s, code) {
  if (s.done) return;
  s.done = true;
  try { s.stop?.(); } catch {}
  session = null;
  closeSheet(sheet, true).then(() => s.resolve(code));
}

async function startNative(s) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  const stopStream = () => stream.getTracks().forEach((t) => t.stop());
  if (s.done) { stopStream(); return () => {}; }
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  viewport.replaceChildren(video);
  await video.play().catch(() => {});
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  setupTorch(stream.getVideoTracks()[0]);
  setStatus('כוון את הברקוד למסגרת');

  let stopped = false, last = 0, lastCode = null, count = 0;
  const tick = async (t) => {
    if (stopped) return;
    if (t - last > 90 && video.readyState >= 2) {
      last = t;
      try {
        const res = await detector.detect(video);
        const code = res.map((r) => r.rawValue).find(isValidBarcode);
        if (code) {
          if (code === lastCode) count++; else { lastCode = code; count = 1; }
          if (count >= 2) { accept(s, code); return; }
        } else { lastCode = null; count = 0; }
      } catch {}
    }
    if (!stopped) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { stopped = true; stopStream(); video.srcObject = null; viewport.replaceChildren(); };
}

async function startQuagga(s) {
  await loadScript(QUAGGA_URL);
  await new Promise((res, rej) =>
    Quagga.init({
      inputStream: {
        name: 'Live', type: 'LiveStream', target: viewport,
        constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        area: { top: '25%', right: '10%', left: '10%', bottom: '25%' },
      },
      locator: { patchSize: 'large', halfSample: false },
      numOfWorkers: Math.min(navigator.hardwareConcurrency || 2, 4),
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'] },
      locate: true,
    }, (err) => (err ? rej(err) : res()))
  );
  let last = null, count = 0;
  const handler = (r) => {
    const code = r?.codeResult?.code;
    if (!code || !isValidBarcode(code)) return;
    if (code === last) count++; else { last = code; count = 1; }
    if (count >= 3) accept(s, code);
  };
  const stop = () => {
    try { Quagga.offDetected(handler); } catch {}
    try { Quagga.stop(); } catch {}
    viewport.replaceChildren();
  };
  if (s.done) { stop(); return () => {}; }
  Quagga.onDetected(handler);
  Quagga.start();
  try { setupTorch(Quagga.CameraAccess?.getActiveTrack?.()); } catch {}
  setStatus('כוון את הברקוד למסגרת');
  return stop;
}

let nativeOk;
async function hasNative() {
  if (nativeOk !== undefined) return nativeOk;
  try {
    nativeOk = 'BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('ean_13');
  } catch { nativeOk = false; }
  return nativeOk;
}

async function start(s) {
  try {
    const stop = (await hasNative()) ? await startNative(s) : await startQuagga(s);
    if (s.done) { stop(); return; }
    s.stop = stop;
  } catch (err) {
    console.error('Scanner error', err);
    if (!s.done) setStatus(explain(err), true);
  }
}

manual.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = manualInput.value.replace(/\s/g, '');
  if (!session) return;
  if (!/^\d{4,}$/.test(v)) { setStatus('הקלד ספרות בלבד', true); return; }
  accept(session, v);
});

/** Opens the scanner. Resolves with the code, or null if dismissed. */
export function scanBarcode() {
  if (session) return session.promise;
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  const s = (session = { promise, resolve, done: false, accepted: false, stop: null });
  reticle.classList.remove('ok');
  torchBtn.hidden = true;
  torchBtn.setAttribute('aria-pressed', 'false');
  manualInput.value = '';
  viewport.replaceChildren();
  setStatus('מפעיל מצלמה…');
  openSheet(sheet);
  start(s);
  return promise;
}
