/** Resolves once every image has loaded and decoded (or failed), capped by `timeoutMs`. */
export function preloadImages(srcs, timeoutMs = 8000) {
  const unique = [...new Set(srcs.filter(Boolean))];
  const loads = unique.map(
    (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(resolve);
        img.onerror = resolve;
        img.src = src;
      }),
  );
  return Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
