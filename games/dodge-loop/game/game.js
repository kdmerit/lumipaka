(() => {
  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const startButton = document.querySelector('#start-button');
  const scoreElement = document.querySelector('#score');
  const bestElement = document.querySelector('#best');
  const pauseToggle = document.querySelector('#pause-toggle');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const resumeButton = document.querySelector('#resume-button');
  const soundToggle = document.querySelector('#sound-toggle');

  const audioTracks = {
    bgm: new Audio('./audio/dodge-loop-mystery-01-veiled-observatory.wav'),
    death: new Audio('./audio/dodge-loop-death.wav?v=e45cabe325e50746657d4b9df3b3567ad21808a897d7652188fac4abf08dc5ed')
  };
  audioTracks.bgm.loop = true;
  audioTracks.bgm.volume = 1;
  audioTracks.death.volume = 0.38;
  Object.values(audioTracks).forEach((track) => { track.preload = 'auto'; });

  const state = {
    active: false,
    paused: false,
    score: 0,
    best: Number(localStorage.getItem('dodge-loop-best') || 0),
    soundEnabled: localStorage.getItem('dodge-loop-sound') !== 'off',
    lastTime: 0,
    spawnTimer: 0,
    pointerX: null,
    keys: { left: false, right: false },
    player: { x: 0.5, y: 0.86, width: 0.12, height: 0.045, speed: 0.0011 },
    blocks: []
  };

  bestElement.textContent = String(state.best);

  function emit(event, payload = {}) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'lumipaka-game', event, payload }, '*');
    }
  }

  function stopTrack(track) {
    track.pause();
    track.currentTime = 0;
  }

  function stopAllAudio() {
    Object.values(audioTracks).forEach(stopTrack);
  }

  function playTrack(track, restart = true) {
    if (!state.soundEnabled) return;
    if (restart) track.currentTime = 0;
    const playback = track.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => {});
  }

  function updateSoundToggle() {
    const enabled = state.soundEnabled;
    soundToggle.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
    soundToggle.setAttribute('aria-pressed', String(enabled));
    soundToggle.setAttribute('aria-label', enabled ? '게임 사운드 끄기' : '게임 사운드 켜기');
  }

  function pauseGameAudio() {
    Object.values(audioTracks).forEach((track) => track.pause());
  }

  function resumeGameAudio() {
    if (!state.soundEnabled || !state.active) return;
    playTrack(audioTracks.bgm, false);
  }

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    localStorage.setItem('dodge-loop-sound', enabled ? 'on' : 'off');
    updateSoundToggle();
    if (!enabled) {
      stopAllAudio();
      return;
    }
    if (state.active && !state.paused) playTrack(audioTracks.bgm);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
    canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function width() { return canvas.getBoundingClientRect().width; }
  function height() { return canvas.getBoundingClientRect().height; }

  function reset() {
    state.paused = false;
    state.score = 0;
    state.spawnTimer = 0;
    state.lastTime = 0;
    state.pointerX = null;
    state.player.x = 0.5;
    state.blocks = [];
    scoreElement.textContent = '0';
  }

  function start() {
    stopAllAudio();
    reset();
    state.active = true;
    updatePauseToggle();
    overlay.classList.add('hidden');
    playTrack(audioTracks.bgm);
    emit('game-start');
    requestAnimationFrame(loop);
  }

  function gameOver() {
    if (!state.active) return;
    state.active = false;
    state.paused = false;
    stopAllAudio();
    playTrack(audioTracks.death);
    const score = Math.floor(state.score);
    if (score > state.best) {
      state.best = score;
      localStorage.setItem('dodge-loop-best', String(score));
      bestElement.textContent = String(score);
    }
    overlayTitle.innerHTML = 'NICE<br /><em>TRY</em>';
    overlayCopy.innerHTML = `기록 <strong>${score}</strong>점<br />다시 한 번 도전해보세요.`;
    startButton.textContent = 'RESTART';
    overlay.classList.remove('hidden');
    updatePauseToggle();
    emit('game-over', { score });
  }

  function updatePauseToggle() {
    const paused = state.paused;
    pauseToggle.disabled = !state.active || paused;
    pauseToggle.textContent = 'PAUSE';
    pauseToggle.setAttribute('aria-pressed', String(paused));
    pauseToggle.setAttribute('aria-label', paused ? '게임이 일시정지됨' : '게임 일시정지');
    pauseOverlay.hidden = !paused;
  }

  function togglePause() {
    if (!state.active) return;
    state.paused = !state.paused;
    state.keys.left = false;
    state.keys.right = false;
    state.pointerX = null;
    state.lastTime = 0;
    if (state.paused) pauseGameAudio();
    else resumeGameAudio();
    updatePauseToggle();
    draw();
    if (!state.paused) requestAnimationFrame(loop);
    emit('game-pause', { paused: state.paused });
  }

  function spawnBlock() {
    const size = 0.055 + Math.random() * 0.07;
    state.blocks.push({
      x: 0.08 + Math.random() * 0.84,
      y: -size,
      size,
      speed: 0.00022 + Math.min(state.score / 120000, 0.00022) + Math.random() * 0.00008,
      hue: Math.random() > 0.82 ? 'purple' : 'lime'
    });
  }

  function update(delta) {
    const direction = Number(state.keys.right) - Number(state.keys.left);
    if (direction !== 0) state.player.x += direction * state.player.speed * delta;
    if (state.pointerX !== null) state.player.x += (state.pointerX - state.player.x) * Math.min(delta * 0.012, 1);
    state.player.x = Math.max(state.player.width / 2, Math.min(1 - state.player.width / 2, state.player.x));

    state.spawnTimer += delta;
    const spawnEvery = Math.max(310, 790 - state.score * 1.3);
    if (state.spawnTimer > spawnEvery) {
      state.spawnTimer = 0;
      spawnBlock();
    }

    const playerLeft = state.player.x - state.player.width / 2;
    const playerRight = state.player.x + state.player.width / 2;
    const playerTop = state.player.y - state.player.height / 2;
    const playerBottom = state.player.y + state.player.height / 2;
    state.blocks = state.blocks.filter((block) => {
      block.y += block.speed * delta;
      const blockLeft = block.x - block.size / 2;
      const blockRight = block.x + block.size / 2;
      const blockTop = block.y - block.size / 2;
      const blockBottom = block.y + block.size / 2;
      if (blockRight > playerLeft && blockLeft < playerRight && blockBottom > playerTop && blockTop < playerBottom) {
        gameOver();
        return false;
      }
      return block.y < 1.12;
    });
    if (!state.active) return;
    state.score += delta / 100;
    scoreElement.textContent = String(Math.floor(state.score));
  }

  function draw() {
    const canvasWidth = width();
    const canvasHeight = height();
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#14213d');
    gradient.addColorStop(1, '#09101f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    context.strokeStyle = 'rgba(184,243,107,.07)';
    context.lineWidth = 1;
    for (let x = 0; x < canvasWidth; x += 32) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvasHeight); context.stroke();
    }
    for (let y = 0; y < canvasHeight; y += 32) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvasWidth, y); context.stroke();
    }

    for (const block of state.blocks) {
      const size = block.size * canvasWidth;
      const x = block.x * canvasWidth - size / 2;
      const y = block.y * canvasHeight - size / 2;
      context.fillStyle = block.hue === 'purple' ? '#a590ff' : '#b8f36b';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 15;
      context.fillRect(x, y, size, size);
      context.shadowBlur = 0;
    }

    const playerWidth = state.player.width * canvasWidth;
    const playerHeight = state.player.height * canvasHeight;
    const playerX = state.player.x * canvasWidth - playerWidth / 2;
    const playerY = state.player.y * canvasHeight - playerHeight / 2;
    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    context.shadowBlur = 18;
    context.fillRect(playerX, playerY, playerWidth, playerHeight);
    context.shadowBlur = 0;

  }

  function loop(time) {
    if (!state.active || state.paused) return;
    const delta = state.lastTime ? Math.min(time - state.lastTime, 50) : 16;
    state.lastTime = time;
    update(delta);
    draw();
    if (state.active && !state.paused) requestAnimationFrame(loop);
  }

  function setPointer(event) {
    const bounds = canvas.getBoundingClientRect();
    state.pointerX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  }

  startButton.addEventListener('click', start);
  pauseToggle.addEventListener('click', togglePause);
  resumeButton.addEventListener('click', () => { if (state.paused) togglePause(); });
  soundToggle.addEventListener('click', () => setSoundEnabled(!state.soundEnabled));
  canvas.addEventListener('pointerdown', (event) => {
    if (state.paused) return;
    canvas.setPointerCapture(event.pointerId);
    setPointer(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (!state.paused && event.buttons) setPointer(event); });
  canvas.addEventListener('pointerup', () => { state.pointerX = null; });
  window.addEventListener('keydown', (event) => {
    if (!event.repeat && (event.key === 'p' || event.key === 'P' || event.key === 'Escape')) {
      if (state.active) {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (event.key === ' ' && state.paused) {
      event.preventDefault();
      togglePause();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = true;
    if (event.key === ' ' && !state.active) {
      event.preventDefault();
      start();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = false;
  });
  window.addEventListener('resize', resize);
  resize();
  updateSoundToggle();
  updatePauseToggle();
  draw();
})();
