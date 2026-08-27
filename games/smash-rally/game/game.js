(() => {
  'use strict';

  const WIDTH = 720;
  const HEIGHT = 960;
  const BASE_SPEED = 468;
  const BALL_RADIUS = 10;
  const PADDLE_WIDTH = 164;
  const PADDLE_HEIGHT = 18;
  const PLAYER_Y = 882;
  const CPU_Y = 60;
  const PLAYER_SPEED = 560;
  const CPU_SERVE_DELAY = 0.8;
  const HIT_SOUND_LEAD = 0.02;
  const SOUND_STORAGE_KEY = 'smash-rally-sound';

  const AI_PROFILES = {
    easy: { reaction: 0.32, speed: 225, error: 72 },
    normal: { reaction: 0.14, speed: 330, error: 28 },
    hard: { reaction: 0.05, speed: 440, error: 8 }
  };

  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const playerScoreElement = document.querySelector('#player-score');
  const targetScoreElement = document.querySelector('#target-score');
  const cpuScoreElement = document.querySelector('#cpu-score');
  const deuceStatusElement = document.querySelector('#deuce-status');
  const setupOverlay = document.querySelector('#setup-overlay');
  const resultOverlay = document.querySelector('#result-overlay');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const resultTitle = document.querySelector('#result-title');
  const resultEyebrow = document.querySelector('#result-eyebrow');
  const resultScore = document.querySelector('#result-score');
  const resultCopy = document.querySelector('#result-copy');
  const startButton = document.querySelector('#start-button');
  const rematchButton = document.querySelector('#rematch-button');
  const settingsButton = document.querySelector('#settings-button');
  const resumeButton = document.querySelector('#resume-button');
  const pauseButton = document.querySelector('#pause-toggle');
  const soundButton = document.querySelector('#sound-toggle');
  const serveButton = document.querySelector('#serve-button');
  const deuceButton = document.querySelector('#deuce-toggle');
  const scoreButtons = [...document.querySelectorAll('[data-score]')];
  const difficultyButtons = [...document.querySelectorAll('[data-difficulty]')];

  const state = {
    active: false,
    paused: false,
    phase: 'setup',
    settings: { targetScore: 10, deuce: true, difficulty: 'normal' },
    playerScore: 0,
    cpuScore: 0,
    player: { x: WIDTH / 2, y: PLAYER_Y, width: PADDLE_WIDTH, height: PADDLE_HEIGHT },
    cpu: { x: WIDTH / 2, y: CPU_Y, width: PADDLE_WIDTH, height: PADDLE_HEIGHT },
    ball: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, radius: BALL_RADIUS },
    keys: { left: false, right: false },
    pointerX: null,
    pointerInput: null,
    serveTimer: 0,
    cpuServeTarget: WIDTH / 2,
    aiTarget: WIDTH / 2,
    aiReactionTimer: 0,
    rallyReturns: 0,
    exchangePairs: 0,
    elapsed: 0,
    hitSoundPrimedUntil: 0,
    lastTime: 0,
    frame: 0,
    soundEnabled: readSoundPreference()
  };

  const audio = {
    context: null,
    hitBuffer: null,
    loading: null,
    activeSources: new Set()
  };

  function readSoundPreference() {
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function saveSoundPreference() {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, state.soundEnabled ? 'true' : 'false');
    } catch {
      // Storage can be disabled in private or embedded browser contexts.
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function moveTowards(value, target, amount) {
    if (Math.abs(target - value) <= amount) return target;
    return value + Math.sign(target - value) * amount;
  }

  function randomRange(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function getBallSpeed() {
    return Math.hypot(state.ball.vx, state.ball.vy);
  }

  function setBallSpeed(speed) {
    const currentSpeed = getBallSpeed();
    if (currentSpeed <= 0) return;
    state.ball.vx = (state.ball.vx / currentSpeed) * speed;
    state.ball.vy = (state.ball.vy / currentSpeed) * speed;
  }

  function targetSpeed() {
    return BASE_SPEED * (1 + state.exchangePairs * 0.01);
  }

  function resetPaddles() {
    state.player.x = WIDTH / 2;
    state.cpu.x = WIDTH / 2;
    state.aiTarget = WIDTH / 2;
    state.aiReactionTimer = 0;
  }

  function placeBallOnServer() {
    if (state.phase === 'serve-player') {
      state.ball.x = state.player.x;
      state.ball.y = state.player.y - state.ball.radius - 2;
    } else if (state.phase === 'serve-cpu') {
      state.ball.x = state.cpu.x;
      state.ball.y = state.cpu.y + state.cpu.height + state.ball.radius + 2;
    }
    state.ball.vx = 0;
    state.ball.vy = 0;
  }

  function resetRally(server) {
    resetPaddles();
    state.rallyReturns = 0;
    state.exchangePairs = 0;
    state.hitSoundPrimedUntil = 0;
    state.pointerX = null;
    state.serveTimer = server === 'cpu' ? CPU_SERVE_DELAY : 0;
    state.phase = server === 'cpu' ? 'serve-cpu' : 'serve-player';

    const profile = AI_PROFILES[state.settings.difficulty];
    state.cpuServeTarget = clamp(state.player.x + randomRange(-profile.error, profile.error), PADDLE_WIDTH / 2, WIDTH - PADDLE_WIDTH / 2);
    placeBallOnServer();
    updateHud();
  }

  function updateHud() {
    playerScoreElement.textContent = String(state.playerScore);
    targetScoreElement.textContent = String(state.settings.targetScore);
    cpuScoreElement.textContent = String(state.cpuScore);
    deuceStatusElement.hidden = !isDeuce();
    serveButton.disabled = !(state.active && !state.paused && state.phase === 'serve-player');
    pauseButton.disabled = !state.active;
    pauseButton.setAttribute('aria-pressed', String(state.paused));
  }

  function updateSoundButton() {
    soundButton.textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(state.soundEnabled));
    soundButton.setAttribute('aria-label', state.soundEnabled ? '게임 사운드 끄기' : '게임 사운드 켜기');
  }

  function updateSettingButtons() {
    for (const button of scoreButtons) {
      const selected = Number(button.dataset.score) === state.settings.targetScore;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    for (const button of difficultyButtons) {
      const selected = button.dataset.difficulty === state.settings.difficulty;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
    deuceButton.classList.toggle('selected', state.settings.deuce);
    deuceButton.setAttribute('aria-pressed', String(state.settings.deuce));
    updateHud();
  }

  function isDeuce() {
    return state.settings.deuce
      && state.playerScore === state.cpuScore
      && state.playerScore >= state.settings.targetScore - 1;
  }

  function isMatchWon(score, opponentScore) {
    if (score < state.settings.targetScore) return false;
    if (!state.settings.deuce) return true;
    return score - opponentScore >= 2;
  }

  function activateAudio() {
    if (!state.soundEnabled) return;
    try {
      if (!audio.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audio.context = new AudioContextClass();
      }

      audio.context.resume().catch(() => {});
      if (audio.hitBuffer || audio.loading) return;

      audio.loading = fetch('./audio/brick-hit.wav')
        .then((response) => {
          if (!response.ok) throw new Error('Could not load hit sound.');
          return response.arrayBuffer();
        })
        .then((buffer) => audio.context.decodeAudioData(buffer))
        .then((decoded) => {
          audio.hitBuffer = decoded;
        })
        .catch(() => {
          audio.hitBuffer = null;
        })
        .finally(() => {
          audio.loading = null;
        });
    } catch {
      // Sound must never prevent play when Web Audio is unavailable.
    }
  }

  function stopActiveSounds() {
    for (const source of audio.activeSources) {
      try {
        source.stop();
      } catch {
        // The source may already have completed.
      }
    }
    audio.activeSources.clear();
  }

  function playHitSound() {
    if (!state.soundEnabled || !audio.context || !audio.hitBuffer || audio.context.state !== 'running') return false;
    try {
      const source = audio.context.createBufferSource();
      const gain = audio.context.createGain();
      source.buffer = audio.hitBuffer;
      gain.gain.value = 0.18;
      source.connect(gain).connect(audio.context.destination);
      source.onended = () => audio.activeSources.delete(source);
      audio.activeSources.add(source);
      source.start();
      return true;
    } catch {
      // A transient audio failure does not affect the game loop.
      return false;
    }
  }

  function startMatch() {
    stopActiveSounds();
    state.active = true;
    state.paused = false;
    state.playerScore = 0;
    state.cpuScore = 0;
    state.elapsed = 0;
    state.hitSoundPrimedUntil = 0;
    state.keys.left = false;
    state.keys.right = false;
    setupOverlay.hidden = true;
    resultOverlay.hidden = true;
    pauseOverlay.hidden = true;
    resetRally('player');
    activateAudio();
    state.lastTime = 0;
    cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(loop);
  }

  function openSettings() {
    state.active = false;
    state.paused = false;
    state.phase = 'setup';
    state.playerScore = 0;
    state.cpuScore = 0;
    state.elapsed = 0;
    state.hitSoundPrimedUntil = 0;
    stopActiveSounds();
    resetPaddles();
    state.ball.x = WIDTH / 2;
    state.ball.y = HEIGHT / 2;
    state.ball.vx = 0;
    state.ball.vy = 0;
    setupOverlay.hidden = false;
    resultOverlay.hidden = true;
    pauseOverlay.hidden = true;
    updateHud();
    draw();
  }

  function togglePause() {
    if (!state.active || state.phase === 'finished') return;
    state.paused = !state.paused;
    pauseOverlay.hidden = !state.paused;
    updateHud();

    if (state.paused) {
      if (audio.context) audio.context.suspend().catch(() => {});
      return;
    }

    activateAudio();
    state.lastTime = 0;
    state.frame = requestAnimationFrame(loop);
  }

  function launchPlayerServe() {
    if (!state.active || state.paused || state.phase !== 'serve-player') return;
    activateAudio();
    const normalizedPosition = clamp((state.player.x - WIDTH / 2) / (WIDTH / 2), -1, 1);
    const angle = normalizedPosition * 0.48;
    state.ball.x = state.player.x;
    state.ball.y = state.player.y - state.ball.radius - 2;
    state.ball.vx = Math.sin(angle) * BASE_SPEED;
    state.ball.vy = -Math.cos(angle) * BASE_SPEED;
    state.phase = 'rally';
    state.aiReactionTimer = 0;
    updateHud();
  }

  function launchCpuServe() {
    if (!state.active || state.paused || state.phase !== 'serve-cpu') return;
    const profile = AI_PROFILES[state.settings.difficulty];
    const target = clamp(state.player.x + randomRange(-profile.error, profile.error), BALL_RADIUS, WIDTH - BALL_RADIUS);
    const horizontal = clamp((target - state.cpu.x) / (HEIGHT * 0.55), -0.58, 0.58);
    const vertical = Math.sqrt(1 - horizontal * horizontal);
    state.ball.x = state.cpu.x;
    state.ball.y = state.cpu.y + state.cpu.height + state.ball.radius + 2;
    state.ball.vx = horizontal * BASE_SPEED;
    state.ball.vy = vertical * BASE_SPEED;
    state.phase = 'rally';
    state.aiReactionTimer = 0;
    updateHud();
  }

  function awardPoint(winner) {
    if (winner === 'player') state.playerScore += 1;
    else state.cpuScore += 1;

    const winnerScore = winner === 'player' ? state.playerScore : state.cpuScore;
    const opponentScore = winner === 'player' ? state.cpuScore : state.playerScore;
    if (isMatchWon(winnerScore, opponentScore)) {
      finishMatch(winner);
      return;
    }

    resetRally(winner === 'player' ? 'cpu' : 'player');
  }

  function finishMatch(winner) {
    state.active = false;
    state.paused = false;
    state.phase = 'finished';
    stopActiveSounds();
    if (audio.context) audio.context.suspend().catch(() => {});
    resultEyebrow.textContent = winner === 'player' ? 'MATCH COMPLETE' : 'KEEP THE RALLY GOING';
    resultTitle.textContent = winner === 'player' ? 'YOU WIN' : 'CPU WINS';
    resultScore.textContent = `${state.playerScore} : ${state.cpuScore}`;
    resultCopy.textContent = winner === 'player' ? '상단 벽을 넘겨 매치를 가져왔습니다.' : '패들 각도를 바꿔 다음 랠리를 공략하세요.';
    resultOverlay.hidden = false;
    updateHud();
    draw();
  }

  function updatePlayer(delta) {
    const direction = Number(state.keys.right) - Number(state.keys.left);
    if (direction !== 0) state.player.x += direction * PLAYER_SPEED * delta;
    if (state.pointerX !== null) {
      state.player.x += (state.pointerX - state.player.x) * Math.min(delta * 14, 1);
    }
    state.player.x = clamp(state.player.x, state.player.width / 2, WIDTH - state.player.width / 2);
  }

  function reflectedBallXAt(time) {
    const travelWidth = WIDTH - state.ball.radius * 2;
    const period = travelWidth * 2;
    let projected = state.ball.x - state.ball.radius + state.ball.vx * time;
    projected = ((projected % period) + period) % period;
    if (projected > travelWidth) projected = period - projected;
    return projected + state.ball.radius;
  }

  function projectedBallX(targetY) {
    if (state.ball.vy >= 0) return WIDTH / 2;
    const time = (targetY - state.ball.y) / state.ball.vy;
    if (!Number.isFinite(time) || time < 0) return WIDTH / 2;

    return clamp(reflectedBallXAt(time), state.cpu.width / 2, WIDTH - state.cpu.width / 2);
  }

  function updateCpu(delta) {
    const profile = AI_PROFILES[state.settings.difficulty];
    let target = WIDTH / 2;

    if (state.phase === 'serve-cpu') {
      target = state.cpuServeTarget;
    } else if (state.phase === 'rally' && state.ball.vy < 0) {
      state.aiReactionTimer -= delta;
      if (state.aiReactionTimer <= 0) {
        state.aiTarget = clamp(
          projectedBallX(state.cpu.y + state.cpu.height + state.ball.radius) + randomRange(-profile.error, profile.error),
          state.cpu.width / 2,
          WIDTH - state.cpu.width / 2
        );
        state.aiReactionTimer = profile.reaction;
      }
      target = state.aiTarget;
    }

    state.cpu.x = moveTowards(state.cpu.x, target, profile.speed * delta);
    state.cpu.x = clamp(state.cpu.x, state.cpu.width / 2, WIDTH - state.cpu.width / 2);
  }

  function circleIntersectsPaddle(paddle) {
    const nearestX = clamp(state.ball.x, paddle.x - paddle.width / 2, paddle.x + paddle.width / 2);
    const nearestY = clamp(state.ball.y, paddle.y, paddle.y + paddle.height);
    const dx = state.ball.x - nearestX;
    const dy = state.ball.y - nearestY;
    return dx * dx + dy * dy <= state.ball.radius * state.ball.radius;
  }

  function returnBall(paddle, hitter) {
    const usedPrimedSound = state.hitSoundPrimedUntil > state.elapsed;
    state.hitSoundPrimedUntil = 0;
    const offset = clamp((state.ball.x - paddle.x) / (paddle.width / 2), -1, 1);
    const angle = offset * 1.02;
    const speed = Math.max(BASE_SPEED, getBallSpeed());
    state.ball.vx = Math.sin(angle) * speed;
    state.ball.vy = (hitter === 'player' ? -1 : 1) * Math.cos(angle) * speed;

    if (hitter === 'player') {
      state.ball.y = paddle.y - state.ball.radius - 0.5;
    } else {
      state.ball.y = paddle.y + paddle.height + state.ball.radius + 0.5;
    }

    state.rallyReturns += 1;
    if (state.rallyReturns % 2 === 0) {
      state.exchangePairs += 1;
      setBallSpeed(targetSpeed());
    }
    if (!usedPrimedSound) playHitSound();
    updateHud();
  }

  function primeApproachingHitSound() {
    if (state.hitSoundPrimedUntil > state.elapsed || state.ball.vy === 0) return;

    const paddle = state.ball.vy < 0 ? state.cpu : state.player;
    const contactY = state.ball.vy < 0
      ? paddle.y + paddle.height + state.ball.radius
      : paddle.y - state.ball.radius;
    const timeToContact = (contactY - state.ball.y) / state.ball.vy;
    if (timeToContact < 0 || timeToContact > HIT_SOUND_LEAD) return;

    const projectedX = reflectedBallXAt(timeToContact);
    const left = paddle.x - paddle.width / 2 - state.ball.radius;
    const right = paddle.x + paddle.width / 2 + state.ball.radius;
    if (projectedX < left || projectedX > right) return;

    if (playHitSound()) state.hitSoundPrimedUntil = state.elapsed + HIT_SOUND_LEAD * 1.5;
  }

  function updateServe(delta) {
    if (state.phase === 'serve-player') {
      placeBallOnServer();
      return;
    }

    updateCpu(delta);
    placeBallOnServer();
    state.serveTimer = Math.max(0, state.serveTimer - delta);
    if (state.serveTimer === 0) launchCpuServe();
  }

  function updateRally(delta) {
    const furthestTravel = Math.max(Math.abs(state.ball.vx * delta), Math.abs(state.ball.vy * delta));
    const steps = Math.max(1, Math.ceil(furthestTravel / (state.ball.radius * 0.7)));
    const stepDelta = delta / steps;

    for (let step = 0; step < steps; step += 1) {
      updateCpu(stepDelta);
      primeApproachingHitSound();
      state.ball.x += state.ball.vx * stepDelta;
      state.ball.y += state.ball.vy * stepDelta;

      if (state.ball.x - state.ball.radius <= 0) {
        state.ball.x = state.ball.radius;
        state.ball.vx = Math.abs(state.ball.vx);
      } else if (state.ball.x + state.ball.radius >= WIDTH) {
        state.ball.x = WIDTH - state.ball.radius;
        state.ball.vx = -Math.abs(state.ball.vx);
      }

      if (state.ball.vy < 0 && circleIntersectsPaddle(state.cpu)) {
        returnBall(state.cpu, 'cpu');
      } else if (state.ball.vy > 0 && circleIntersectsPaddle(state.player)) {
        returnBall(state.player, 'player');
      }

      if (state.ball.y + state.ball.radius < 0) {
        awardPoint('player');
        return;
      }
      if (state.ball.y - state.ball.radius > HEIGHT) {
        awardPoint('cpu');
        return;
      }
    }
  }

  function update(delta) {
    state.elapsed += delta;
    updatePlayer(delta);
    if (state.phase === 'serve-player' || state.phase === 'serve-cpu') {
      updateServe(delta);
    } else if (state.phase === 'rally') {
      updateRally(delta);
    }
  }

  function roundedRect(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
  }

  function drawPaddle(paddle, cpu) {
    context.save();
    context.fillStyle = '#f7f8ff';
    context.shadowColor = cpu ? 'rgba(247,248,255,.55)' : '#b8f36b';
    context.shadowBlur = cpu ? 14 : 18;
    roundedRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height, 8);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = cpu ? 'rgba(16,26,49,.3)' : 'rgba(16,26,49,.22)';
    roundedRect(paddle.x - paddle.width / 2 + 11, paddle.y + 4, paddle.width - 22, 2, 1);
    context.fill();
    context.restore();
  }

  function drawBall() {
    context.save();
    context.fillStyle = '#b8f36b';
    context.shadowColor = '#b8f36b';
    context.shadowBlur = 22;
    context.beginPath();
    context.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawCourtLabel() {
    let label = '';
    if (state.phase === 'serve-player') label = 'SERVE';
    if (state.phase === 'serve-cpu') label = 'CPU SERVE';
    if (!label) return;

    context.save();
    context.fillStyle = 'rgba(184,243,107,.55)';
    context.font = '900 15px Inter, ui-sans-serif, system-ui, sans-serif';
    context.textAlign = 'center';
    context.letterSpacing = '3px';
    context.fillText(label, WIDTH / 2, HEIGHT / 2 + 5);
    context.restore();
  }

  function draw() {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#101a31';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.save();
    context.strokeStyle = 'rgba(184,243,107,.055)';
    context.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += 40) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }
    context.strokeStyle = 'rgba(184,243,107,.28)';
    context.lineWidth = 3;
    context.setLineDash([12, 16]);
    context.beginPath();
    context.moveTo(28, HEIGHT / 2);
    context.lineTo(WIDTH - 28, HEIGHT / 2);
    context.stroke();
    context.restore();

    context.save();
    context.fillStyle = 'rgba(135,148,178,.52)';
    context.font = '800 11px Inter, ui-sans-serif, system-ui, sans-serif';
    context.letterSpacing = '2px';
    context.textAlign = 'center';
    context.fillText('CPU WALL', WIDTH / 2, 32);
    context.fillText('PLAYER WALL', WIDTH / 2, HEIGHT - 22);
    context.restore();

    drawPaddle(state.cpu, true);
    drawPaddle(state.player, false);
    drawBall();
    drawCourtLabel();
  }

  function loop(time) {
    if (!state.active || state.paused) return;
    const delta = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.04) : 1 / 60;
    state.lastTime = time;
    update(delta);
    draw();
    if (state.active && !state.paused) state.frame = requestAnimationFrame(loop);
  }

  function setPointerX(clientX) {
    const bounds = canvas.getBoundingClientRect();
    state.pointerX = clamp(((clientX - bounds.left) / bounds.width) * WIDTH, state.player.width / 2, WIDTH - state.player.width / 2);
  }

  function startPointer(event) {
    if (!state.active || state.paused) return;
    if (event.pointerType === 'touch') event.preventDefault();
    setPointerX(event.clientX);
    state.pointerInput = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can be unavailable in embedded browsers.
    }
  }

  function movePointer(event) {
    if (!state.active || state.paused || !state.pointerInput || state.pointerInput.id !== event.pointerId) return;
    if (event.pointerType === 'touch') event.preventDefault();
    if (Math.abs(event.clientX - state.pointerInput.x) > 8 || Math.abs(event.clientY - state.pointerInput.y) > 8) {
      state.pointerInput.moved = true;
    }
    setPointerX(event.clientX);
  }

  function endPointer(event) {
    if (!state.pointerInput || state.pointerInput.id !== event.pointerId) return;
    if (event.pointerType === 'touch') event.preventDefault();
    setPointerX(event.clientX);
    state.player.x = state.pointerX;
    const shouldServe = state.active && !state.paused && state.phase === 'serve-player' && !state.pointerInput.moved;
    state.pointerInput = null;
    state.pointerX = null;
    if (shouldServe) launchPlayerServe();
  }

  startButton.addEventListener('click', startMatch);
  rematchButton.addEventListener('click', startMatch);
  settingsButton.addEventListener('click', openSettings);
  resumeButton.addEventListener('click', togglePause);
  pauseButton.addEventListener('click', togglePause);
  serveButton.addEventListener('click', launchPlayerServe);
  soundButton.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveSoundPreference();
    if (state.soundEnabled) activateAudio();
    else stopActiveSounds();
    updateSoundButton();
  });
  deuceButton.addEventListener('click', () => {
    state.settings.deuce = !state.settings.deuce;
    updateSettingButtons();
  });

  for (const button of scoreButtons) {
    button.addEventListener('click', () => {
      state.settings.targetScore = Number(button.dataset.score);
      updateSettingButtons();
    });
  }
  for (const button of difficultyButtons) {
    button.addEventListener('click', () => {
      state.settings.difficulty = button.dataset.difficulty;
      updateSettingButtons();
    });
  }

  canvas.addEventListener('pointerdown', startPointer, { passive: false });
  canvas.addEventListener('pointermove', movePointer, { passive: false });
  canvas.addEventListener('pointerup', endPointer, { passive: false });
  canvas.addEventListener('pointercancel', () => {
    state.pointerInput = null;
    state.pointerX = null;
  });

  // Older embedded WebViews can lack Pointer Events even though they support touch input.
  if (!window.PointerEvent) {
    canvas.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      if (!touch || !state.active || state.paused) return;
      event.preventDefault();
      setPointerX(touch.clientX);
      state.pointerInput = { id: 'legacy-touch', x: touch.clientX, y: touch.clientY, moved: false };
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
      const touch = event.touches[0];
      if (!touch || !state.pointerInput || state.pointerInput.id !== 'legacy-touch') return;
      event.preventDefault();
      if (Math.abs(touch.clientX - state.pointerInput.x) > 8 || Math.abs(touch.clientY - state.pointerInput.y) > 8) {
        state.pointerInput.moved = true;
      }
      setPointerX(touch.clientX);
    }, { passive: false });

    canvas.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      if (!touch || !state.pointerInput || state.pointerInput.id !== 'legacy-touch') return;
      event.preventDefault();
      setPointerX(touch.clientX);
      state.player.x = state.pointerX;
      const shouldServe = state.active && !state.paused && state.phase === 'serve-player' && !state.pointerInput.moved;
      state.pointerInput = null;
      state.pointerX = null;
      if (shouldServe) launchPlayerServe();
    }, { passive: false });

    canvas.addEventListener('touchcancel', () => {
      state.pointerInput = null;
      state.pointerX = null;
    }, { passive: false });
  }

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (!event.repeat && (key === 'p' || event.key === 'Escape')) {
      if (state.active) {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (event.key === ' ') {
      if (state.paused) {
        event.preventDefault();
        togglePause();
      } else if (state.active && state.phase === 'serve-player') {
        event.preventDefault();
        launchPlayerServe();
      }
      return;
    }
    if (event.key === 'ArrowLeft' || key === 'a') {
      event.preventDefault();
      state.pointerX = null;
      state.keys.left = true;
    }
    if (event.key === 'ArrowRight' || key === 'd') {
      event.preventDefault();
      state.pointerX = null;
      state.keys.right = true;
    }
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (event.key === 'ArrowLeft' || key === 'a') state.keys.left = false;
    if (event.key === 'ArrowRight' || key === 'd') state.keys.right = false;
  });

  window.addEventListener('blur', () => {
    state.keys.left = false;
    state.keys.right = false;
    if (state.active && !state.paused) togglePause();
  });

  resetPaddles();
  state.ball.x = WIDTH / 2;
  state.ball.y = HEIGHT / 2;
  updateSoundButton();
  updateSettingButtons();
  draw();
})();
