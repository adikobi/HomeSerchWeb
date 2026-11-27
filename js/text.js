const NIQQUD = /[\u0591-\u05C7]/g;
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
export const norm = (s) => String(s ?? '').toLowerCase().replace(NIQQUD, '').trim();
export const tokenize = (q) => norm(q).split(/\s+/).filter(Boolean);

/** Escape + wrap matched tokens in <mark>. Returns HTML string. */
export function highlight(raw, tokens) {
  raw = String(raw ?? '');
  if (!tokens || !tokens.length) return esc(raw);
  const low = raw.toLowerCase();
  const ranges = [];
  for (const t of tokens) {
    let i = 0;
    while ((i = low.indexOf(t, i)) !== -1) {
      ranges.push([i, i + t.length]);
      i += t.length;
    }
  }
  if (!ranges.length) return esc(raw);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (let k = 1; k < ranges.length; k++) {
    const last = merged[merged.length - 1];
    if (ranges[k][0] <= last[1]) last[1] = Math.max(last[1], ranges[k][1]);
    else merged.push(ranges[k].slice());
  }
  let out = '';
  let pos = 0;
  for (const [s, e] of merged) {
    out += esc(raw.slice(pos, s)) + '<mark>' + esc(raw.slice(s, e)) + '</mark>';
    pos = e;
  }
  return out + esc(raw.slice(pos));
}

/* ---------- Links ---------- */
const URL_SRC = '(?:https?:\\/\\/|www\\.)[^\\s\\u0590-\\u05FF<>"\'`]+';
const TRAIL = '.,;:!?\'"»”’]}';

function trimTrail(u) {
  let trail = '';
  while (u) {
    const c = u.slice(-1);
    const unbalanced =
      c === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length;
    if (TRAIL.includes(c) || unbalanced) {
      trail = c + trail;
      u = u.slice(0, -1);
    } else break;
  }
  return [u, trail];
}

function prettyUrl(href) {
  try {
    const u = new URL(href);
    let s = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '') + u.search;
    return s.length > 44 ? s.slice(0, 43) + '…' : s;
  } catch {
    return href;
  }
}

/** Split text into [{t}] and [{href,label}] segments. */
export function splitLinks(text) {
  text = String(text ?? '');
  const re = new RegExp(URL_SRC, 'gi');
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    const [url, trail] = trimTrail(m[0]);
    if (!url) continue;
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push({ href: /^www\./i.test(url) ? 'https://' + url : url, label: prettyUrl(url) });
    if (trail) out.push({ t: trail });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}

/* ---------- Rich text (recipes / notes) ---------- */
const BULLET = /^([-•*–·]|\d{1,2}[.)])\s+(.*)$/;

export function parseBlocks(text) {
  const blocks = [];
  let list = null;
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    const b = line.match(BULLET);
    if (b) {
      const ordered = /\d/.test(b[1]);
      if (!list || list.ordered !== ordered) {
        list = { k: 'list', ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(b[2]);
      continue;
    }
    list = null;
    if (/[:：]$/.test(line) && line.length <= 40) blocks.push({ k: 'h', text: line.replace(/[:：]$/, '') });
    else blocks.push({ k: 'p', text: line });
  }
  return blocks;
}

function inlineDom(text) {
  const frag = document.createDocumentFragment();
  for (const s of splitLinks(text)) {
    if (s.href) {
      const a = document.createElement('a');
      a.href = s.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'ext-link';
      a.dir = 'ltr';
      a.textContent = s.label;
      frag.append(a);
    } else frag.append(document.createTextNode(s.t));
  }
  return frag;
}

/** Render text into an element using DOM nodes only (no innerHTML => no XSS). */
export function renderRich(el, text) {
  el.replaceChildren();
  for (const b of parseBlocks(text)) {
    let node;
    if (b.k === 'h') {
      node = document.createElement('h4');
      node.textContent = b.text;
    } else if (b.k === 'list') {
      node = document.createElement(b.ordered ? 'ol' : 'ul');
      for (const it of b.items) {
        const li = document.createElement('li');
        li.append(inlineDom(it));
        node.append(li);
      }
    } else {
      node = document.createElement('p');
      node.append(inlineDom(b.text));
    }
    el.append(node);
  }
}

function inlineHtml(text) {
  return splitLinks(text)
    .map((s) => (s.href ? `<a href="${esc(s.href)}">${esc(s.label)}</a>` : esc(s.t)))
    .join('');
}

/** Same as renderRich but returns an HTML string (for Word export). */
export function blocksToHtml(text) {
  return parseBlocks(text)
    .map((b) => {
      if (b.k === 'h') return `<h3>${esc(b.text)}</h3>`;
      if (b.k === 'list') {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</${tag}>`;
      }
      return `<p>${inlineHtml(b.text)}</p>`;
    })
    .join('');
}

/** One-line plain preview of a recipe body. */
export function plainPreview(text, max = 150) {
  const parts = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !(/[:：]$/.test(l) && l.length <= 40))
    .map((l) => l.replace(/^([-•*–·]|\d{1,2}[.)])\s+/, ''));
  const s = parts.join(' · ');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
