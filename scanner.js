/* scanner.js — barcode scanner overlay (Quagga, lazy-loaded). Returns a promise
   resolving to the scanned/typed code, or null if dismissed. */
import { $, icon, loadScript, pushLayer, popLayer, haptic } from './ui.js';

const QUAGGA = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
let activePromise = null;

export function isValidBarcode(code) {
  if (code.length < 8 || !/^\d+$/.test(code)) return false;
  if (code.length === 13) {
    const sum = code.slice(0, 12).split('').reduce((a, d, i) => a + (i % 2 === 0 ? +d : +d * 3), 0);
    return +code[12] === (10 - (sum % 10)) % 10;
  }
  if (code.length === 12) {
    const sum = code.slice(0, 11).split('').reduce((a, d, i) => a + (i % 2 === 0 ? +d * 3 : +d), 0);
    return +code[11] === (10 - (sum % 10)) % 10;
  }
  return true;
}

const errorText = err => {
  const n = err && (err.name || err.message || '');
  if (/NotAllowed|Permission/i.test(n)) return 'הגישה למצלמה נחסמה. אפשרו אותה בהגדרות הדפדפן, או הקלידו את המספר.';
  if (/NotFound|Devices/i.test(n)) return 'לא נמצאה מצלמה במכשיר. אפשר להקליד את המספר ידנית.';
  if (/NotReadable|TrackStart/i.test(n)) return 'המצלמה בשימוש באפליקציה אחרת. סגרו אותה ונסו שוב.';
  return 'לא ניתן להפעיל את המצלמה. אפשר להקליד את המספר ידנית.';
};

export function scanBarcode() {
  if (activePromise) return activePromise;
  let resolveFn;
  activePromise = new Promise(r => { resolveFn = r; });

  const el = document.createElement('div');
  el.className = 'layer layer-scanner';
  el.innerHTML = `
    <div class="scanner-top">
      <button type="button" class="icon-btn scanner-btn" data-close aria-label="סגירה">${icon('x', 22)}</button>
      <h2 class="scanner-title">סריקת ברקוד</h2>
      <button type="button" class="icon-btn scanner-btn" id="sc-torch" hidden aria-pressed="false" aria-label="פנס">${icon('flash', 22)}</button>
    </div>
    <div class="scanner-stage">
      <div class="scanner-view" id="sc-view">
        <div class="scanner-guide" aria-hidden="true">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="beam-wrap"><div class="beam"></div></div>
        </div>
      </div>
      <p class="scanner-status" id="sc-status" role="status">מפעיל מצלמה…</p>
    </div>
    <form class="scanner-manual" id="sc-form" autocomplete="off">
      <label class="sr-only" for="sc-code">הקלדת מספר ברקוד</label>
      <input id="sc-code" inputmode="numeric" pattern="[0-9]*" placeholder="או הקלידו מספר ברקוד">
      <button type="submit" class="btn btn-primary">אישור</button>
    </form>`;
  $('#layers').append(el);

  const view = $('#sc-view', el), status = $('#sc-status', el), torchBtn = $('#sc-torch', el);
  let done = false, accepted = false, live = false, attached = false, last = null, count = 0;
  const layer = { el, requestClose: () => { finish(null); return Promise.resolve(true); } };

  const setStatus = (msg, tone) => { status.textContent = msg; status.dataset.tone = tone || ''; };

  function stopCamera() {
    if (attached) { try { Quagga.offDetected(onDetected); } catch {} attached = false; }
    if (live) { try { Quagga.stop(); } catch {} live = false; }
    view.querySelectorAll('video,canvas').forEach(n => n.remove());
  }
  function finish(result) {
    if (done) return;
    done = true;
    stopCamera();
    popLayer(layer);
    el.classList.remove('open');
    setTimeout(() => { el.remove(); activePromise = null; }, 260);
    resolveFn(result);
  }
  function accept(code) {
    if (accepted) return;
    accepted = true;
    stopCamera();
    haptic(40);
    el.classList.add('success');
    setStatus('נסרק: ' + code, 'ok');
    setTimeout(() => finish(code), 380);
  }
  function fail(msg) { el.classList.add('failed'); setStatus(msg, 'error'); }

  function onDetected(result) {
    const code = result && result.codeResult && result.codeResult.code;
    if (!code || accepted || !isValidBarcode(code)) return;
    if (code === last) count++; else { last = code; count = 1; }
    const need = code.length === 12 || code.length === 13 ? 2 : 3;
    if (count >= need) accept(code);
  }

  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) finish(null); });
  $('#sc-form', el).addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#sc-code', el).value.replace(/\s+/g, '');
    if (v) { haptic(20); finish(v); }
  });

  pushLayer(layer);
  void el.offsetHeight;
  el.classList.add('open');

  (async () => {
    try { await loadScript(QUAGGA); }
    catch { if (!done) fail('לא ניתן לטעון את הסורק. בדקו את החיבור לאינטרנט או הקלידו את המספר.'); return; }
    if (done) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fail('המצלמה זמינה רק בחיבור מאובטח (HTTPS). אפשר להקליד את המספר ידנית.');
      return;
    }
    Quagga.init({
      inputStream: {
        name: 'Live', type: 'LiveStream', target: view,
        constraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 16 / 9 } },
        area: { top: '25%', right: '10%', left: '10%', bottom: '25%' },
      },
      locator: { patchSize: 'large', halfSample: false },
      numOfWorkers: Math.min(4, navigator.hardwareConcurrency || 2),
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'] },
      locate: true,
    }, err => {
      if (done) { try { Quagga.stop(); } catch {} return; }
      if (err) { console.error(err); fail(errorText(err)); return; }
      Quagga.onDetected(onDetected); attached = true;
      Quagga.start(); live = true;
      el.classList.add('live');
      setStatus('כוונו את הברקוד אל תוך המסגרת');
      try {
        const track = Quagga.CameraAccess.getActiveTrack && Quagga.CameraAccess.getActiveTrack();
        const caps = track && track.getCapabilities && track.getCapabilities();
        if (caps && caps.torch) {
          torchBtn.hidden = false;
          torchBtn.addEventListener('click', async () => {
            const on = torchBtn.getAttribute('aria-pressed') !== 'true';
            try { await track.applyConstraints({ advanced: [{ torch: on }] }); torchBtn.setAttribute('aria-pressed', String(on)); } catch {}
          });
        }
      } catch {}
    });
  })();

  return activePromise;
}
