(() => {
  const ids = ['fighter', 'flame', 'bomb', ...['shield', 'split', 'missile', 'spread', 'bomb', 'score'].map(id => `pickup-${id}`), ...Array.from({length: 3}, (_, i) => `explosion-${i + 1}`), ...Array.from({length: 9}, (_, i) => `enemy-${i + 1}`), ...Array.from({length: 10}, (_, i) => `boss-${i + 1}`)];
  const images = new Map();
  const version = document.currentScript ? new URL(document.currentScript.src).search : '';
  const urls = new Map(ids.map(id => [id, new URL(`./sprites/${id}.png`, document.baseURI).href + version]));
  const ready = Promise.all(ids.map(id => new Promise(resolve => {
    const image = new Image();
    const finish = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(finish, 15000);
    image.onload = () => {
      try {
      // Trim transparent padding once, then keep a compact cached canvas for rendering.
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d', {willReadFrequently: true});
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = image.width, top = image.height, right = 0, bottom = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (pixels[(y * image.width + x) * 4 + 3] < 24) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      if (right >= left && bottom >= top) {
        const cached = document.createElement('canvas');
        const scale = Math.min(1, 512 / Math.max(right - left + 1, bottom - top + 1));
        cached.width = Math.ceil((right - left + 1) * scale); cached.height = Math.ceil((bottom - top + 1) * scale);
        cached.getContext('2d').drawImage(image, left, top, right - left + 1, bottom - top + 1, 0, 0, cached.width, cached.height);
        images.set(id, cached);
      }
      } catch (_) {
        // A failed image must never prevent the standalone game from starting.
      } finally { finish(); }
    };
    image.onerror = finish;
    image.src = urls.get(id);
  })));
  function draw(ctx, id, x, y, width, height) {
    const image = images.get(id);
    if (!image) return false;
    const scale = Math.min(width / image.width, height / image.height);
    ctx.drawImage(image, x - image.width * scale / 2, y - image.height * scale / 2, image.width * scale, image.height * scale);
    return true;
  }
  window.StellarSkins = { ready, draw, images, urls };
})();
