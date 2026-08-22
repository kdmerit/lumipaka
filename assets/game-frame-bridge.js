(() => {
  if (window.parent === window) return;

  const root = document.querySelector('[data-lumipaka-size-root], .game-shell') || document.body;
  let lastHeight = 0;

  function reportSize() {
    const bounds = root.getBoundingClientRect();
    const height = Math.ceil(Math.max(bounds.height, root.scrollHeight));
    if (!height || height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({
      source: 'lumipaka-game',
      event: 'frame-resize',
      payload: { height }
    }, '*');
  }

  window.addEventListener('load', reportSize);
  window.addEventListener('resize', reportSize);
  document.fonts?.ready.then(reportSize);

  if ('ResizeObserver' in window) {
    new ResizeObserver(reportSize).observe(root);
  }

  requestAnimationFrame(() => requestAnimationFrame(reportSize));
})();
