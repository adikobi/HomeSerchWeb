const cache = new Map();

/** Load a classic <script> once; resolves when ready. */
export function loadScript(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      cache.delete(src);
      s.remove();
      reject(new Error('Failed to load ' + src));
    };
    document.head.append(s);
  });
  cache.set(src, p);
  return p;
}
