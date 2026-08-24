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
  const soundToggle = document.querySelector('#sound-toggle');

  const audioTracks = {
    bgm: new Audio('./audio/brick-loop-bgm.wav'),
    hit: new Audio('./audio/brick-hit.wav'),
    gameOver: new Audio('./audio/brick-loop-game-over.wav')
  };
  audioTracks.bgm.loop = true;
  audioTracks.bgm.volume = 0.22;
  audioTracks.hit.volume = 0.34;
  audioTracks.gameOver.volume = 0.42;
  Object.values(audioTracks).forEach((track) => { track.preload = 'auto'; });

  const WIDTH = 720;
  const HEIGHT = 960;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const paddle = { x: WIDTH / 2, y: HEIGHT - 54, width: 150, height: 16, speed: 660 };
  const ball = { x: WIDTH / 2, y: HEIGHT - 88, radius: 10, vx: 210, vy: -420, speed: 500 };
  const state = {
    active: false,
    waiting: 0,
    score: 0,
    best: Number(localStorage.getItem('brick-loop-best') || 0),
    lives: 3,
    level: 1,
    lastTime: 0,
    pointerX: null,
    soundEnabled: localStorage.getItem('brick-loop-sound') !== 'off',
    keys: { left: false, right: false },
    bricks: []
  };

  const colors = ['#b8f36b', '#a590ff', '#74d8ff', '#ff8bc9', '#ffd166'];
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

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    localStorage.setItem('brick-loop-sound', enabled ? 'on' : 'off');
    updateSoundToggle();
    if (!enabled) {
      stopAllAudio();
    } else if (state.active) {
      playTrack(audioTracks.bgm, false);
    }
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

  function resetBall() {
    ball.x = paddle.x;
    ball.y = paddle.y - 34;
    ball.speed = 500 + (state.level - 1) * 30;
    const direction = Math.random() > 0.5 ? 1 : -1;
    ball.vx = direction * (170 + Math.random() * 70);
    ball.vy = -Math.sqrt(Math.max(ball.speed * ball.speed - ball.vx * ball.vx, 340 * 340));
    state.waiting = 0.8;
  }

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.lastTime = 0;
    state.pointerX = null;
    paddle.x = WIDTH / 2;
    livesElement.textContent = String(state.lives);
    scoreElement.textContent = '0';
    makeBricks();
    resetBall();
  }

  function start() {
    stopAllAudio();
    resetGame();
    state.active = true;
    overlay.classList.add('hidden');
    playTrack(audioTracks.bgm);
    emit('game-start');
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.active = false;
    stopTrack(audioTracks.bgm);
    playTrack(audioTracks.gameOver);
    const score = Math.floor(state.score);
    if (score > state.best) {
      state.best = score;
      localStorage.setItem('brick-loop-best', String(score));
      bestElement.textContent = String(score);
    }
    overlayTitle.innerHTML = 'LOOP<br /><em>OVER</em>';
    overlayCopy.innerHTML = `기록 <strong>${score}</strong>점 · 레벨 ${state.level}<br />부서진 패턴을 다시 시작해보세요.`;
    startButton.textContent = 'RESTART';
    overlay.classList.remove('hidden');
    emit('game-over', { score, level: state.level });
  }

  function nextLevel() {
    state.level += 1;
    makeBricks();
    resetBall();
  }

  function circleIntersectsRect(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.radius * circle.radius;
  }

  function update(delta) {
    const direction = Number(state.keys.right) - Number(state.keys.left);
    if (direction !== 0) paddle.x += direction * paddle.speed * delta;
    if (state.pointerX !== null) paddle.x += (state.pointerX - paddle.x) * Math.min(delta * 12, 1);
    paddle.x = Math.max(paddle.width / 2, Math.min(WIDTH - paddle.width / 2, paddle.x));

    if (state.waiting > 0) {
      state.waiting -= delta;
      ball.x = paddle.x;
      ball.y = paddle.y - 34;
      return;
    }

    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= WIDTH) {
      ball.x = Math.max(ball.radius, Math.min(WIDTH - ball.radius, ball.x));
      ball.vx *= -1;
    }
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    const paddleRect = { x: paddle.x - paddle.width / 2, y: paddle.y, width: paddle.width, height: paddle.height };
    if (ball.vy > 0 && circleIntersectsRect(ball, paddleRect)) {
      ball.y = paddle.y - ball.radius;
      const offset = (ball.x - paddle.x) / (paddle.width / 2);
      ball.vx = Math.max(-ball.speed * 0.92, Math.min(ball.speed * 0.92, offset * ball.speed * 0.95));
      ball.vy = -Math.sqrt(Math.max(ball.speed * ball.speed - ball.vx * ball.vx, 340 * 340));
      playTrack(audioTracks.hit);
    }

    for (const brick of state.bricks) {
      if (!brick.alive || !circleIntersectsRect(ball, brick)) continue;
      brick.alive = false;
      state.score += 10 * state.level;
      scoreElement.textContent = String(Math.floor(state.score));
      ball.vy *= -1;
      playTrack(audioTracks.hit);
      break;
    }

    if (state.bricks.every((brick) => !brick.alive)) nextLevel();

    if (ball.y - ball.radius > HEIGHT) {
      state.lives -= 1;
      livesElement.textContent = String(state.lives);
      if (state.lives <= 0) {
        gameOver();
      } else {
        resetBall();
      }
    }
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

    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    context.shadowBlur = 20;
    context.beginPath();
    context.roundRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height, 7);
    context.fill();
    context.fillStyle = '#b8f36b';
    context.beginPath(); context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0;
  }

  function loop(time) {
    if (!state.active) return;
    const delta = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.04) : 0.016;
    state.lastTime = time;
    update(delta);
    draw();
    if (state.active) requestAnimationFrame(loop);
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
  soundToggle.addEventListener('click', () => setSoundEnabled(!state.soundEnabled));
  const startFromSurface = (event) => {
    if (!state.active && event.target !== startButton) start();
  };
  overlay.addEventListener('pointerdown', startFromSurface);
  overlay.addEventListener('click', startFromSurface);
  canvas.addEventListener('pointerdown', (event) => {
    if (!state.active) start();
    if (event.pointerType === 'touch') event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    setPointer(event);
  });
  canvas.addEventListener('click', () => { if (!state.active) start(); });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || event.buttons || event.pressure > 0) {
      if (event.pointerType === 'touch') event.preventDefault();
      setPointer(event);
    }
  });
  canvas.addEventListener('touchstart', setTouchPointer, { passive: false });
  canvas.addEventListener('touchmove', setTouchPointer, { passive: false });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = true;
    if (event.key === ' ' && !state.active) start();
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = false;
  });

  makeBricks();
  updateSoundToggle();
  draw();
})();
