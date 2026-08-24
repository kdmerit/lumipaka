(() => {
  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const startButton = document.querySelector('#start-button');
  const scoreElement = document.querySelector('#score');
  const bestElement = document.querySelector('#best');
  const livesElement = document.querySelector('#lives');
  const pauseToggle = document.querySelector('#pause-toggle');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const resumeButton = document.querySelector('#resume-button');
  const soundToggle = document.querySelector('#sound-toggle');
  const powerupsElement = document.querySelector('#powerups');

  const audioTracks = {
    death: new Audio('./audio/brick-loop-death.wav'),
    victory: new Audio('./audio/brick-loop-victory.wav'),
    gameOver: new Audio('./audio/brick-loop-game-over.wav')
  };
  audioTracks.death.volume = 0.2;
  audioTracks.victory.volume = 0.26;
  audioTracks.gameOver.volume = 0.28;
  Object.values(audioTracks).forEach((track) => { track.preload = 'auto'; });

  const sfxDefinitions = {
    hit: { url: './audio/brick-hit.wav', volume: 0.18 },
    pickup: { url: './audio/item-pickup.wav', volume: 0.2 }
  };
  let sfxContext = null;
  const sfxRawData = new Map();
  const sfxBuffers = new Map();
  const sfxDecoding = new Map();
  const activeSfx = new Set();

  const WIDTH = 720;
  const HEIGHT = 960;
  const BASE_PADDLE_WIDTH = 150;
  const BASE_BALL_SPEED = 500;
  const LEVEL_SPEED_STEP = 25;
  const MAX_BALL_SPEED = 750;
  const LIFE_LOSS_PAUSE = 0.9;
  const LEVEL_CLEAR_PAUSE = 5;
  const ITEM_DROP_CHANCE = 0.1;
  const ITEM_DROP_HEIGHT = 36;
  const SHIELD_Y = HEIGHT - 28;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const paddle = { x: WIDTH / 2, y: HEIGHT - 54, width: BASE_PADDLE_WIDTH, height: 16, speed: 660 };
  const ball = { x: WIDTH / 2, y: HEIGHT - 88, radius: 10, vx: 210, vy: -420, speed: 500 };
  const state = {
    active: false,
    paused: false,
    waiting: 0,
    score: 0,
    best: Number(localStorage.getItem('brick-loop-best') || 0),
    lives: 3,
    level: 1,
    lastTime: 0,
    pointerX: null,
    soundEnabled: localStorage.getItem('brick-loop-sound') !== 'off',
    keys: { left: false, right: false },
    bricks: [],
    items: [],
    balls: [ball],
    effects: { wide: 0, fire: 0, double: 0, shield: false },
    powerupUiTimer: 0,
    deathPause: 0,
    victoryPause: 0
  };

  const colors = ['#b8f36b', '#a590ff', '#74d8ff', '#ff8bc9', '#ffd166'];
  const itemTypes = [
    { key: 'wide', label: 'W', name: 'WIDE', color: '#b8f36b', duration: 10, weight: 30 },
    { key: 'multi', label: '3', name: 'MULTI', color: '#a590ff', weight: 20 },
    { key: 'shield', label: 'S', name: 'SHIELD', color: '#74d8ff', weight: 20 },
    { key: 'fire', label: 'F', name: 'FIRE', color: '#ff9f43', duration: 6, weight: 12 },
    { key: 'double', label: '×2', name: 'DOUBLE', color: '#ffd166', duration: 10, weight: 12 },
    { key: 'life', label: '+1', name: 'LIFE', color: '#ff8bc9', weight: 6 }
  ];
  const itemTypeMap = Object.fromEntries(itemTypes.map((item) => [item.key, item]));
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

  function stopSfx() {
    activeSfx.forEach((source) => {
      try {
        source.stop();
      } catch (_) {
        // The source may have already ended.
      }
    });
    activeSfx.clear();
  }

  function stopAllAudio() {
    Object.values(audioTracks).forEach(stopTrack);
    stopSfx();
  }

  function getSfxContext() {
    if (sfxContext) return sfxContext;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    try {
      sfxContext = new AudioContextConstructor({ latencyHint: 'interactive' });
    } catch (_) {
      sfxContext = new AudioContextConstructor();
    }
    return sfxContext;
  }

  function decodeSfx(name) {
    const context = getSfxContext();
    const rawData = sfxRawData.get(name);
    if (!context || !rawData || sfxBuffers.has(name) || sfxDecoding.has(name)) return;
    const decoding = context.decodeAudioData(rawData.slice(0))
      .then((buffer) => { sfxBuffers.set(name, buffer); })
      .catch(() => {})
      .finally(() => { sfxDecoding.delete(name); });
    sfxDecoding.set(name, decoding);
  }

  function warmSfx() {
    const context = getSfxContext();
    if (!context) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    Object.keys(sfxDefinitions).forEach(decodeSfx);
  }

  function playSfx(name) {
    if (!state.soundEnabled || state.paused) return;
    const context = getSfxContext();
    const buffer = sfxBuffers.get(name);
    if (!context || !buffer || context.state !== 'running') {
      warmSfx();
      return;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = sfxDefinitions[name].volume;
    source.connect(gain).connect(context.destination);
    source.onended = () => { activeSfx.delete(source); };
    activeSfx.add(source);
    source.start();
  }

  Object.entries(sfxDefinitions).forEach(([name, definition]) => {
    fetch(definition.url)
      .then((response) => response.ok ? response.arrayBuffer() : Promise.reject())
      .then((rawData) => {
        sfxRawData.set(name, rawData);
        if (sfxContext) decodeSfx(name);
      })
      .catch(() => {});
  });

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

  function updatePauseToggle() {
    const paused = state.paused;
    pauseToggle.disabled = !state.active || paused;
    pauseToggle.textContent = 'PAUSE';
    pauseToggle.setAttribute('aria-pressed', String(paused));
    pauseToggle.setAttribute('aria-label', paused ? '게임이 일시정지됨' : '게임 일시정지');
    pauseOverlay.hidden = !paused;
  }

  function pauseGameAudio() {
    Object.values(audioTracks).forEach((track) => track.pause());
    if (sfxContext && sfxContext.state === 'running') sfxContext.suspend().catch(() => {});
  }

  function resumeGameAudio() {
    if (!state.soundEnabled) return;
    warmSfx();
    if (state.victoryPause > 0) playTrack(audioTracks.victory, false);
    if (state.deathPause > 0) playTrack(audioTracks.death, false);
  }

  function togglePause() {
    if (!state.active) return;
    state.paused = !state.paused;
    state.keys.left = false;
    state.keys.right = false;
    state.pointerX = null;
    if (state.paused) {
      pauseGameAudio();
    } else {
      state.lastTime = 0;
      resumeGameAudio();
      requestAnimationFrame(loop);
    }
    updatePauseToggle();
    draw();
    emit('game-pause', { paused: state.paused });
  }

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    localStorage.setItem('brick-loop-sound', enabled ? 'on' : 'off');
    updateSoundToggle();
    if (!enabled) {
      stopAllAudio();
      return;
    }
    if (state.paused) return;
    warmSfx();
    if (state.active) {
      if (state.victoryPause > 0) playTrack(audioTracks.victory, false);
      if (state.deathPause > 0) playTrack(audioTracks.death, false);
    }
  }

  function updatePowerupStatus() {
    const active = [];
    if (state.effects.wide > 0) active.push(`WIDE ${Math.ceil(state.effects.wide)}s`);
    if (state.balls.length > 1) active.push(`MULTI ×${state.balls.length}`);
    if (state.effects.shield) active.push('SHIELD');
    if (state.effects.fire > 0) active.push(`FIRE ${Math.ceil(state.effects.fire)}s`);
    if (state.effects.double > 0) active.push(`DOUBLE ${Math.ceil(state.effects.double)}s`);
    powerupsElement.textContent = active.length ? active.join(' · ') : 'POWER-UPS —';
    powerupsElement.classList.toggle('active', active.length > 0);
  }

  function makeBricks() {
    state.bricks = [];
    const columns = 7;
    const rows = Math.min(5 + state.level - 1, 8);
    const width = 80;
    const height = 28;
    const gap = 10;
    const startX = (WIDTH - (columns * width + (columns - 1) * gap)) / 2;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        state.bricks.push({
          x: startX + column * (width + gap),
          y: 82 + row * (height + gap),
          width,
          height,
          color: colors[(row + state.level - 1) % colors.length],
          alive: true
        });
      }
    }
  }

  function resetBall(targetBall = ball, waitingDuration = 0.8) {
    targetBall.x = paddle.x;
    targetBall.y = paddle.y - 34;
    targetBall.speed = Math.min(BASE_BALL_SPEED + (state.level - 1) * LEVEL_SPEED_STEP, MAX_BALL_SPEED);
    const direction = Math.random() > 0.5 ? 1 : -1;
    targetBall.vx = direction * (170 + Math.random() * 70);
    targetBall.vy = -Math.sqrt(Math.max(targetBall.speed * targetBall.speed - targetBall.vx * targetBall.vx, 340 * 340));
    state.waiting = waitingDuration;
  }

  function resetGame() {
    state.paused = false;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.lastTime = 0;
    state.pointerX = null;
    state.items = [];
    state.balls = [ball];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    state.powerupUiTimer = 0;
    state.deathPause = 0;
    state.victoryPause = 0;
    paddle.width = BASE_PADDLE_WIDTH;
    paddle.x = WIDTH / 2;
    livesElement.textContent = String(state.lives);
    scoreElement.textContent = '0';
    makeBricks();
    resetBall();
    updatePowerupStatus();
  }

  function start() {
    stopAllAudio();
    warmSfx();
    resetGame();
    state.active = true;
    updatePauseToggle();
    overlay.classList.add('hidden');
    emit('game-start');
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.active = false;
    state.paused = false;
    stopAllAudio();
    playTrack(audioTracks.gameOver);
    const score = Math.floor(state.score);
    if (score > state.best) {
      state.best = score;
      localStorage.setItem('brick-loop-best', String(score));
      bestElement.textContent = String(score);
    }
    state.items = [];
    state.balls = [ball];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    paddle.width = BASE_PADDLE_WIDTH;
    updatePowerupStatus();
    updatePauseToggle();
    overlayTitle.innerHTML = 'LOOP<br /><em>OVER</em>';
    overlayCopy.innerHTML = `기록 <strong>${score}</strong>점 · 레벨 ${state.level}<br />부서진 패턴을 다시 시작해보세요.`;
    startButton.textContent = 'RESTART';
    overlay.classList.remove('hidden');
    emit('game-over', { score, level: state.level });
  }

  function nextLevel() {
    stopTrack(audioTracks.victory);
    state.level += 1;
    makeBricks();
    state.items = [];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    state.powerupUiTimer = 0;
    paddle.width = BASE_PADDLE_WIDTH;
    state.balls = [ball];
    resetBall(ball);
    updatePowerupStatus();
  }

  function beginLevelClear() {
    state.victoryPause = LEVEL_CLEAR_PAUSE;
    state.waiting = 0;
    state.items = [];
    stopAllAudio();
    playTrack(audioTracks.victory);
    emit('level-clear', { level: state.level, score: Math.floor(state.score) });
  }

  function circleIntersectsRect(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.radius * circle.radius;
  }

  function rectsOverlap(first, second) {
    return first.x < second.x + second.width
      && first.x + first.width > second.x
      && first.y < second.y + second.height
      && first.y + first.height > second.y;
  }

  function pickItemType() {
    const totalWeight = itemTypes.reduce((total, item) => total + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of itemTypes) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return itemTypes[0];
  }

  function maybeDropItem(brick) {
    if (Math.random() >= ITEM_DROP_CHANCE) return;
    const type = pickItemType();
    state.items.push({
      type: type.key,
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      width: paddle.width,
      height: ITEM_DROP_HEIGHT,
      speed: 145
    });
  }

  function addMultiBalls() {
    if (state.balls.length >= 3) return;
    const source = state.balls[0] || ball;
    const speed = source.speed || 500;
    const baseAngle = Math.atan2(source.vy || -1, source.vx || 0);
    const offsets = state.balls.length === 1 ? [-0.34, 0.34] : [0.42];
    for (const offset of offsets) {
      if (state.balls.length >= 3) break;
      const angle = baseAngle + offset;
      state.balls.push({
        x: source.x,
        y: source.y,
        radius: source.radius,
        speed,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }
  }

  function applyItem(typeKey) {
    const type = itemTypeMap[typeKey];
    if (!type) return;
    playSfx('pickup');
    if (type.key === 'wide') state.effects.wide = type.duration;
    if (type.key === 'multi') addMultiBalls();
    if (type.key === 'shield') state.effects.shield = true;
    if (type.key === 'fire') state.effects.fire = type.duration;
    if (type.key === 'double') state.effects.double = type.duration;
    if (type.key === 'life') {
      state.lives = Math.min(5, state.lives + 1);
      livesElement.textContent = String(state.lives);
    }
    updatePowerupStatus();
    emit('item-collected', { type: type.key, name: type.name });
  }

  function updateEffects(delta) {
    ['wide', 'fire', 'double'].forEach((key) => {
      if (state.effects[key] > 0) state.effects[key] = Math.max(0, state.effects[key] - delta);
    });
    paddle.width = state.effects.wide > 0 ? BASE_PADDLE_WIDTH * 1.45 : BASE_PADDLE_WIDTH;
    state.powerupUiTimer -= delta;
    if (state.powerupUiTimer <= 0) {
      updatePowerupStatus();
      state.powerupUiTimer = 0.2;
    }
  }

  function updateItems(delta, paddleRect) {
    const remainingItems = [];
    for (const item of state.items) {
      item.y += item.speed * delta;
      const itemRect = {
        x: item.x - item.width / 2,
        y: item.y - item.height / 2,
        width: item.width,
        height: item.height
      };
      if (rectsOverlap(itemRect, paddleRect)) {
        applyItem(item.type);
      } else if (item.y - item.height / 2 <= HEIGHT) {
        remainingItems.push(item);
      }
    }
    state.items = remainingItems;
  }

  function beginLifeLoss(missedBall) {
    state.lives -= 1;
    livesElement.textContent = String(state.lives);
    if (state.lives <= 0) {
      gameOver();
      return;
    }

    state.items = [];
    state.deathPause = LIFE_LOSS_PAUSE;
    state.victoryPause = 0;
    state.waiting = 0;
    state.balls = [ball];
    ball.x = Math.max(ball.radius, Math.min(WIDTH - ball.radius, missedBall.x));
    ball.y = HEIGHT - ball.radius - 4;
    ball.vx = 0;
    ball.vy = 0;
    stopAllAudio();
    playTrack(audioTracks.death);
    emit('life-lost', { lives: state.lives });
  }

  function update(delta) {
    if (state.victoryPause > 0) {
      state.victoryPause = Math.max(0, state.victoryPause - delta);
      if (state.victoryPause === 0) {
        nextLevel();
      }
      return;
    }

    if (state.deathPause > 0) {
      state.deathPause = Math.max(0, state.deathPause - delta);
      if (state.deathPause === 0) {
        resetBall(ball, 0.45);
        stopTrack(audioTracks.death);
      }
      return;
    }

    updateEffects(delta);
    const direction = Number(state.keys.right) - Number(state.keys.left);
    if (direction !== 0) paddle.x += direction * paddle.speed * delta;
    if (state.pointerX !== null) paddle.x += (state.pointerX - paddle.x) * Math.min(delta * 12, 1);
    paddle.x = Math.max(paddle.width / 2, Math.min(WIDTH - paddle.width / 2, paddle.x));

    const paddleRect = { x: paddle.x - paddle.width / 2, y: paddle.y, width: paddle.width, height: paddle.height };
    if (state.waiting > 0) {
      state.waiting -= delta;
      state.balls.forEach((currentBall) => {
        currentBall.x = paddle.x;
        currentBall.y = paddle.y - 34;
      });
      updateItems(delta, paddleRect);
      return;
    }

    updateItems(delta, paddleRect);
    const survivingBalls = [];
    let lastMissedBall = null;
    for (const currentBall of state.balls) {
      currentBall.x += currentBall.vx * delta;
      currentBall.y += currentBall.vy * delta;

      if (currentBall.x - currentBall.radius <= 0 || currentBall.x + currentBall.radius >= WIDTH) {
        currentBall.x = Math.max(currentBall.radius, Math.min(WIDTH - currentBall.radius, currentBall.x));
        currentBall.vx *= -1;
      }
      if (currentBall.y - currentBall.radius <= 0) {
        currentBall.y = currentBall.radius;
        currentBall.vy = Math.abs(currentBall.vy);
      }

      if (currentBall.vy > 0 && circleIntersectsRect(currentBall, paddleRect)) {
        currentBall.y = paddle.y - currentBall.radius;
        const offset = (currentBall.x - paddle.x) / (paddle.width / 2);
        currentBall.vx = Math.max(-currentBall.speed * 0.92, Math.min(currentBall.speed * 0.92, offset * currentBall.speed * 0.95));
        currentBall.vy = -Math.sqrt(Math.max(currentBall.speed * currentBall.speed - currentBall.vx * currentBall.vx, 340 * 340));
        playSfx('hit');
      }

      for (const brick of state.bricks) {
        if (!brick.alive || !circleIntersectsRect(currentBall, brick)) continue;
        brick.alive = false;
        state.score += 10 * state.level * (state.effects.double > 0 ? 2 : 1);
        scoreElement.textContent = String(Math.floor(state.score));
        maybeDropItem(brick);
        if (state.effects.fire <= 0) currentBall.vy *= -1;
        playSfx('hit');
        break;
      }

      if (currentBall.vy > 0 && state.effects.shield && currentBall.y + currentBall.radius >= SHIELD_Y) {
        currentBall.y = SHIELD_Y - currentBall.radius;
        currentBall.vy = -Math.abs(currentBall.vy);
        state.effects.shield = false;
        playSfx('hit');
        updatePowerupStatus();
      }

      if (currentBall.y - currentBall.radius <= HEIGHT) survivingBalls.push(currentBall);
      else lastMissedBall = currentBall;
    }

    state.balls = survivingBalls;
    if (state.bricks.every((brick) => !brick.alive)) {
      beginLevelClear();
      return;
    }

    if (!state.balls.length) {
      beginLifeLoss(lastMissedBall || ball);
    }
  }

  function drawItem(item) {
    const type = itemTypeMap[item.type];
    if (!type) return;
    context.save();
    context.translate(item.x, item.y);
    context.fillStyle = type.color;
    context.shadowColor = type.color;
    context.shadowBlur = 18;
    context.beginPath();
    context.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, 12);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#101a31';
    context.font = '900 15px Inter, ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(type.label, 0, 1);
    context.restore();
  }

  function draw() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#101a31';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = 'rgba(184,243,107,.055)';
    context.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke(); }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      context.fillStyle = brick.color;
      context.shadowColor = brick.color;
      context.shadowBlur = 16;
      context.beginPath();
      context.roundRect(brick.x, brick.y, brick.width, brick.height, 6);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255,255,255,.3)';
      context.fillRect(brick.x + 10, brick.y + 5, brick.width - 20, 2);
    }

    for (const item of state.items) drawItem(item);

    if (state.effects.shield) {
      context.save();
      context.strokeStyle = '#74d8ff';
      context.shadowColor = '#74d8ff';
      context.shadowBlur = 18;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(18, SHIELD_Y);
      context.lineTo(WIDTH - 18, SHIELD_Y);
      context.stroke();
      context.restore();
    }

    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    context.shadowBlur = 20;
    context.beginPath();
    context.roundRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height, 7);
    context.fill();
    context.shadowBlur = 0;

    for (const currentBall of state.balls) {
      const fireActive = state.effects.fire > 0;
      context.fillStyle = fireActive ? '#ff9f43' : '#b8f36b';
      context.shadowColor = fireActive ? '#ff9f43' : '#b8f36b';
      context.shadowBlur = fireActive ? 24 : 18;
      context.beginPath();
      context.arc(currentBall.x, currentBall.y, currentBall.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowBlur = 0;

  }

  function loop(time) {
    if (!state.active || state.paused) return;
    const delta = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.04) : 0.016;
    state.lastTime = time;
    update(delta);
    draw();
    if (state.active && !state.paused) requestAnimationFrame(loop);
  }

  function setPointer(event) {
    setPointerX(event.clientX);
  }

  function setPointerX(clientX) {
    const bounds = canvas.getBoundingClientRect();
    state.pointerX = Math.max(paddle.width / 2, Math.min(WIDTH - paddle.width / 2, ((clientX - bounds.left) / bounds.width) * WIDTH));
  }

  function setTouchPointer(event) {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    event.preventDefault();
    setPointerX(touch.clientX);
  }

  startButton.addEventListener('click', start);
  pauseToggle.addEventListener('click', togglePause);
  resumeButton.addEventListener('click', () => { if (state.paused) togglePause(); });
  soundToggle.addEventListener('click', () => setSoundEnabled(!state.soundEnabled));
  const startFromSurface = (event) => {
    if (!state.active && event.target !== startButton) start();
  };
  overlay.addEventListener('pointerdown', startFromSurface);
  overlay.addEventListener('click', startFromSurface);
  canvas.addEventListener('pointerdown', (event) => {
    if (state.paused) return;
    if (!state.active) start();
    if (event.pointerType === 'touch') event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    setPointer(event);
  });
  canvas.addEventListener('click', () => { if (!state.active) start(); });
  canvas.addEventListener('pointermove', (event) => {
    if (state.paused) return;
    if (event.pointerType === 'touch' || event.buttons || event.pressure > 0) {
      if (event.pointerType === 'touch') event.preventDefault();
      setPointer(event);
    }
  });
  canvas.addEventListener('touchstart', (event) => { if (!state.paused) setTouchPointer(event); }, { passive: false });
  canvas.addEventListener('touchmove', (event) => { if (!state.paused) setTouchPointer(event); }, { passive: false });
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

  makeBricks();
  updateSoundToggle();
  updatePauseToggle();
  updatePowerupStatus();
  draw();
})();
