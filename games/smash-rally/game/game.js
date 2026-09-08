(() => {
  'use strict';

  const WIDTH = 720;
  const HEIGHT = 960;
  const BASE_SPEED = 608.4;
  const BALL_RADIUS = 10;
  const PADDLE_WIDTH = 164;
  const PADDLE_HEIGHT = 18;
  const PLAYER_Y = 882;
  const CPU_Y = 60;
  const PLAYER_SPEEDS = { easy: 560, normal: 640, hard: 720 };
  const CPU_SERVE_DELAY = 0.8;
  const HIT_SOUND_LOOKAHEAD = 0.5;
  const SOUND_STORAGE_KEY = 'smash-rally-sound';
  const SETTINGS_STORAGE_KEY = 'smash-rally-settings';
  const DEFAULT_SETTINGS = Object.freeze({ targetScore: 5, matches: 1, deuce: true, difficulty: 'normal' });
  const VALID_TARGET_SCORES = new Set([5, 10, 15, 20]);
  const VALID_SET_COUNTS = new Set([1, 3, 5]);
  const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);

  const AI_PROFILES = {
    easy: { reaction: 0.50, speed: 170, error: 110 },
    normal: { reaction: 0.29, speed: 260, error: 64 },
    hard: { reaction: 0.12, speed: 375, error: 22 }
  };
  const BALL_PROFILES = {
    easy: { baseSpeed: BASE_SPEED, acceleration: 0.02 },
    normal: { baseSpeed: BASE_SPEED * 1.3, acceleration: 0.03 },
    hard: { baseSpeed: BASE_SPEED * 1.5, acceleration: 0.05 }
  };

  const canvas = document.querySelector('#game');
  // Block browser selection/drag menus without cancelling taps, scrolling or game input.
  const gameShell = document.querySelector('.game-shell');
  for (const eventName of ['selectstart', 'dragstart', 'contextmenu']) {
    gameShell.addEventListener(eventName, (event) => event.preventDefault());
  }
  const context = canvas.getContext('2d');
  const playerScoreElement = document.querySelector('#player-score');
  const targetScoreElement = document.querySelector('#target-score');
  const cpuScoreElement = document.querySelector('#cpu-score');
  const matchStatusElement = document.querySelector('#match-status');
  const difficultyStatusElement = document.querySelector('#difficulty-status');
  const deuceStatusElement = document.querySelector('#deuce-status');
  const setupOverlay = document.querySelector('#setup-overlay');
  const resultOverlay = document.querySelector('#result-overlay');
  const setBreakOverlay = document.querySelector('#set-break-overlay');
  const setBreakTitle = document.querySelector('#set-break-title');
  const setBreakScore = document.querySelector('#set-break-score');
  const setBreakCopy = document.querySelector('#set-break-copy');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const resultTitle = document.querySelector('#result-title');
  const resultEyebrow = document.querySelector('#result-eyebrow');
  const resultSetScore = document.querySelector('#result-set-score');
  const resultGameScore = document.querySelector('#result-game-score');
  const resultCopy = document.querySelector('#result-copy');
  const startButton = document.querySelector('#start-button');
  const rematchButton = document.querySelector('#rematch-button');
  const nextSetButton = document.querySelector('#next-set-button');
  const settingsButton = document.querySelector('#settings-button');
  const resumeButton = document.querySelector('#resume-button');
  const pauseButton = document.querySelector('#pause-toggle');
  const soundButton = document.querySelector('#sound-toggle');
  const serveButton = document.querySelector('#serve-button');
  const deuceButton = document.querySelector('#deuce-toggle');
  const scoreButtons = [...document.querySelectorAll('[data-score]')];
  const difficultyButtons = [...document.querySelectorAll('[data-difficulty]')];
  const matchButtons = [...document.querySelectorAll('[data-matches]')];

  const state = {
    active: false,
    paused: false,
    phase: 'setup',
    settings: readSettingsPreference(),
    playerScore: 0,
    cpuScore: 0,
    playerMatches: 0,
    cpuMatches: 0,
    playerPoints: 0,
    cpuPoints: 0,
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
    rawHitData: null,
    loading: null,
    decoding: null,
    cheerBuffer: null,
    rawCheerData: null,
    cheerLoading: null,
    cheerDecoding: null,
    cheerSource: null,
    outputWarmed: false,
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

  function readSettingsPreference() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...DEFAULT_SETTINGS };
      return {
        targetScore: VALID_TARGET_SCORES.has(stored.targetScore) ? stored.targetScore : DEFAULT_SETTINGS.targetScore,
        matches: VALID_SET_COUNTS.has(stored.matches) ? stored.matches : DEFAULT_SETTINGS.matches,
        deuce: typeof stored.deuce === 'boolean' ? stored.deuce : DEFAULT_SETTINGS.deuce,
        difficulty: VALID_DIFFICULTIES.has(stored.difficulty) ? stored.difficulty : DEFAULT_SETTINGS.difficulty
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettingsPreference() {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
    } catch {
      // Storage can be disabled in private or embedded browser contexts.
    }
  }

  function emit(event, payload = {}) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'lumipaka-game', event, payload }, '*');
    }
  }

  function emitAnalytics(name, params = {}) {
    emit('analytics-event', { name, params });
  }

  function getBallSpeed() {
    return Math.hypot(state.ball.vx, state.ball.vy);
  }

  function getPlayerSpeed() {
    return PLAYER_SPEEDS[state.settings.difficulty] || PLAYER_SPEEDS.normal;
  }

  function setBallSpeed(speed) {
    const currentSpeed = getBallSpeed();
    if (currentSpeed <= 0) return;
    state.ball.vx = (state.ball.vx / currentSpeed) * speed;
    state.ball.vy = (state.ball.vy / currentSpeed) * speed;
  }

  function getBallProfile() {
    return BALL_PROFILES[state.settings.difficulty] || BALL_PROFILES.normal;
  }

  function targetSpeed() {
    const profile = getBallProfile();
    return profile.baseSpeed * ((1 + profile.acceleration) ** state.exchangePairs);
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
    matchStatusElement.textContent = `SET ${state.playerMatches}:${state.cpuMatches} / ${state.settings.matches}`;
    difficultyStatusElement.textContent = state.settings.difficulty.toUpperCase();
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
    for (const button of matchButtons) {
      const selected = Number(button.dataset.matches) === state.settings.matches;
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

  function getAudioContext() {
    if (audio.context) return audio.context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audio.context = new AudioContextClass({ latencyHint: 'interactive' });
    } catch {
      try {
        audio.context = new AudioContextClass();
      } catch {
        return null;
      }
    }
    return audio.context;
  }

  function getScheduledAudioTime(audioContext, delay = 0) {
    const safeDelay = Math.max(0, Number(delay) || 0);
    try {
      if (typeof audioContext.getOutputTimestamp === 'function') {
        const timestamp = audioContext.getOutputTimestamp();
        if (Number.isFinite(timestamp.contextTime) && Number.isFinite(timestamp.performanceTime)) {
          const targetPerformanceTime = performance.now() + safeDelay * 1000;
          const targetContextTime = timestamp.contextTime + (targetPerformanceTime - timestamp.performanceTime) / 1000;
          if (Number.isFinite(targetContextTime) && targetContextTime >= audioContext.currentTime) return targetContextTime;
        }
      }
    } catch {
      // Output timestamp support varies between browsers and embedded WebViews.
    }
    return audioContext.currentTime + safeDelay;
  }

  function decodeHitSound() {
    const audioContext = audio.context;
    if (!audioContext || !audio.rawHitData || audio.hitBuffer || audio.decoding) return;

    audio.decoding = audioContext.decodeAudioData(audio.rawHitData.slice(0))
      .then((decoded) => {
        audio.hitBuffer = decoded;
        warmAudioOutput();
      })
      .catch(() => {
        audio.hitBuffer = null;
      })
      .finally(() => {
        audio.decoding = null;
      });
  }

  function loadHitSound() {
    if (audio.rawHitData || audio.loading) return;

    audio.loading = fetch('./audio/brick-hit.wav')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load hit sound.');
        return response.arrayBuffer();
      })
      .then((rawData) => {
        audio.rawHitData = rawData;
      })
      .catch(() => {
        audio.rawHitData = null;
      })
      .finally(() => {
        audio.loading = null;
        decodeHitSound();
      });
  }

  function decodeScoreCheer() {
    const audioContext = audio.context;
    if (!audioContext || !audio.rawCheerData || audio.cheerBuffer || audio.cheerDecoding) return;

    audio.cheerDecoding = audioContext.decodeAudioData(audio.rawCheerData.slice(0))
      .then((decoded) => {
        audio.cheerBuffer = decoded;
      })
      .catch(() => {
        audio.cheerBuffer = null;
      })
      .finally(() => {
        audio.cheerDecoding = null;
      });
  }

  function loadScoreCheer() {
    if (audio.rawCheerData || audio.cheerLoading) return;

    audio.cheerLoading = fetch('./audio/player-score-cheer.wav')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load score cheer.');
        return response.arrayBuffer();
      })
      .then((rawData) => {
        audio.rawCheerData = rawData;
      })
      .catch(() => {
        audio.rawCheerData = null;
      })
      .finally(() => {
        audio.cheerLoading = null;
        decodeScoreCheer();
      });
  }

  function warmAudioOutput() {
    const audioContext = audio.context;
    if (!state.soundEnabled || audio.outputWarmed || !audioContext || !audio.hitBuffer || audioContext.state !== 'running') return;

    try {
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = audio.hitBuffer;
      gain.gain.value = 0;
      source.connect(gain).connect(audioContext.destination);
      source.start();
      source.stop(audioContext.currentTime + 0.01);
      audio.outputWarmed = true;
    } catch {
      // The silent warm-up is optional and must not affect the game.
    }
  }

  function activateAudio() {
    if (!state.soundEnabled) return;
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      const prepareAudio = () => {
        decodeHitSound();
        decodeScoreCheer();
        warmAudioOutput();
      };
      loadHitSound();
      loadScoreCheer();
      if (audioContext.state === 'running') prepareAudio();
      else audioContext.resume().then(prepareAudio).catch(() => {});
    } catch {
      // Sound must never prevent play when Web Audio is unavailable.
    }
  }

  function stopActiveSounds() {
    audio.cheerSource = null;
    for (const source of audio.activeSources) {
      try {
        source.stop();
      } catch {
        // The source may already have completed.
      }
    }
    audio.activeSources.clear();
  }

  function playHitSound(delay = 0) {
    if (!state.soundEnabled || !audio.context || !audio.hitBuffer || audio.context.state !== 'running') return false;
    try {
      const source = audio.context.createBufferSource();
      const gain = audio.context.createGain();
      source.buffer = audio.hitBuffer;
      gain.gain.value = 0.18;
      source.connect(gain).connect(audio.context.destination);
      source.onended = () => audio.activeSources.delete(source);
      audio.activeSources.add(source);
      source.start(getScheduledAudioTime(audio.context, delay));
      return true;
    } catch {
      // A transient audio failure does not affect the game loop.
      return false;
    }
  }

  function playScoreCheer() {
    if (!state.soundEnabled || !audio.context || !audio.cheerBuffer || audio.context.state !== 'running') return false;
    try {
      if (audio.cheerSource) {
        const previousSource = audio.cheerSource;
        audio.cheerSource = null;
        audio.activeSources.delete(previousSource);
        try {
          previousSource.stop();
        } catch {
          // The previous cheer may already have completed.
        }
      }

      const source = audio.context.createBufferSource();
      const gain = audio.context.createGain();
      source.buffer = audio.cheerBuffer;
      gain.gain.value = 0.5;
      source.connect(gain).connect(audio.context.destination);
      source.onended = () => {
        audio.activeSources.delete(source);
        if (audio.cheerSource === source) {
          audio.cheerSource = null;
          if (!state.active && state.phase === 'finished') audio.context?.suspend().catch(() => {});
        }
      };
      audio.activeSources.add(source);
      audio.cheerSource = source;
      source.start();
      return true;
    } catch {
      // A crowd-audio failure must not affect scoring or the game loop.
      return false;
    }
  }

  function startMatch() {
    stopActiveSounds();
    state.active = true;
    state.paused = false;
    state.playerScore = 0;
    state.cpuScore = 0;
    state.playerMatches = 0;
    state.cpuMatches = 0;
    state.playerPoints = 0;
    state.cpuPoints = 0;
    state.elapsed = 0;
    state.hitSoundPrimedUntil = 0;
    state.keys.left = false;
    state.keys.right = false;
    setupOverlay.hidden = true;
    resultOverlay.hidden = true;
    setBreakOverlay.hidden = true;
    pauseOverlay.hidden = true;
    resetRally('player');
    activateAudio();
    state.lastTime = 0;
    cancelAnimationFrame(state.frame);
    emitAnalytics('lumipaka_game_start', {
      difficulty: state.settings.difficulty,
      target_score: state.settings.targetScore,
      set_count: state.settings.matches,
      deuce: state.settings.deuce
    });
    emitAnalytics('level_start', { level_name: 'SET 1' });
    state.frame = requestAnimationFrame(loop);
  }

  function openSettings() {
    state.active = false;
    state.paused = false;
    state.phase = 'setup';
    state.playerScore = 0;
    state.cpuScore = 0;
    state.playerMatches = 0;
    state.cpuMatches = 0;
    state.playerPoints = 0;
    state.cpuPoints = 0;
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
    setBreakOverlay.hidden = true;
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
      audio.outputWarmed = false;
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
    const baseSpeed = getBallProfile().baseSpeed;
    const normalizedPosition = clamp((state.player.x - WIDTH / 2) / (WIDTH / 2), -1, 1);
    const angle = normalizedPosition * 0.48;
    state.ball.x = state.player.x;
    state.ball.y = state.player.y - state.ball.radius - 2;
    state.ball.vx = Math.sin(angle) * baseSpeed;
    state.ball.vy = -Math.cos(angle) * baseSpeed;
    state.phase = 'rally';
    state.aiReactionTimer = 0;
    updateHud();
  }

  function launchCpuServe() {
    if (!state.active || state.paused || state.phase !== 'serve-cpu') return;
    const profile = AI_PROFILES[state.settings.difficulty];
    const baseSpeed = getBallProfile().baseSpeed;
    const target = clamp(state.player.x + randomRange(-profile.error, profile.error), BALL_RADIUS, WIDTH - BALL_RADIUS);
    const horizontal = clamp((target - state.cpu.x) / (HEIGHT * 0.55), -0.58, 0.58);
    const vertical = Math.sqrt(1 - horizontal * horizontal);
    state.ball.x = state.cpu.x;
    state.ball.y = state.cpu.y + state.cpu.height + state.ball.radius + 2;
    state.ball.vx = horizontal * baseSpeed;
    state.ball.vy = vertical * baseSpeed;
    state.phase = 'rally';
    state.aiReactionTimer = 0;
    updateHud();
  }

  function awardPoint(winner) {
    if (winner === 'player') {
      state.playerScore += 1;
      state.playerPoints += 1;
    } else {
      state.cpuScore += 1;
      state.cpuPoints += 1;
    }

    const winnerScore = winner === 'player' ? state.playerScore : state.cpuScore;
    const opponentScore = winner === 'player' ? state.cpuScore : state.playerScore;
    if (isMatchWon(winnerScore, opponentScore)) {
      if (winner === 'player') state.playerMatches += 1;
      else state.cpuMatches += 1;
      const completedSet = state.playerMatches + state.cpuMatches;
      emitAnalytics('level_end', { level_name: `SET ${completedSet}`, success: winner === 'player' });
      if ((winner === 'player' ? state.playerMatches : state.cpuMatches) >= Math.ceil(state.settings.matches / 2)) {
        finishMatch(winner);
        return;
      }
      state.playerScore = 0;
      state.cpuScore = 0;
      if (winner === 'player') playScoreCheer();
      state.phase = 'set-break';
      setBreakTitle.textContent = winner === 'player' ? '세트 승리' : '세트 패배';
      setBreakScore.textContent = `SET ${state.playerMatches} : ${state.cpuMatches}`;
      setBreakCopy.textContent = '다음 세트를 준비하세요';
      setBreakOverlay.hidden = false;
      updateHud();
      return;
    }

    if (winner === 'player') playScoreCheer();
    resetRally(winner === 'player' ? 'cpu' : 'player');
  }

  function finishMatch(winner) {
    state.active = false;
    state.paused = false;
    state.phase = 'finished';
    stopActiveSounds();
    audio.outputWarmed = false;
    const cheerStarted = winner === 'player' && playScoreCheer();
    if (!cheerStarted && audio.context) audio.context.suspend().catch(() => {});
    resultEyebrow.textContent = winner === 'player' ? 'SETS COMPLETE' : 'KEEP THE RALLY GOING';
    resultTitle.textContent = winner === 'player' ? 'YOU WIN' : 'CPU WINS';
    resultSetScore.textContent = `SET ${state.playerMatches} : ${state.cpuMatches}`;
    resultGameScore.textContent = `${state.playerScore} : ${state.cpuScore}`;
    resultCopy.textContent = winner === 'player' ? '플레이어의 승리' : '플레이어의 패배';
    resultOverlay.hidden = false;
    updateHud();
    draw();
    emitAnalytics('post_score', {
      score: state.playerPoints,
      level: state.playerMatches + state.cpuMatches,
      character: 'player'
    });
    emitAnalytics('lumipaka_game_end', {
      result: winner === 'player' ? 'win' : 'loss',
      difficulty: state.settings.difficulty,
      target_score: state.settings.targetScore,
      set_count: state.settings.matches,
      player_sets: state.playerMatches,
      cpu_sets: state.cpuMatches,
      player_points: state.playerPoints,
      cpu_points: state.cpuPoints
    });
  }

  function updatePlayer(delta) {
    const direction = Number(state.keys.right) - Number(state.keys.left);
    if (direction !== 0) state.player.x += direction * getPlayerSpeed() * delta;
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
    const speed = Math.max(getBallProfile().baseSpeed, getBallSpeed());
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
    if (timeToContact < 0 || timeToContact > HIT_SOUND_LOOKAHEAD) return;

    const projectedX = reflectedBallXAt(timeToContact);
    const paddleSpeed = state.ball.vy < 0
      ? AI_PROFILES[state.settings.difficulty].speed
      : getPlayerSpeed();
    const movementMargin = Math.min(96, paddleSpeed * timeToContact * 0.5);
    const left = paddle.x - paddle.width / 2 - state.ball.radius - movementMargin;
    const right = paddle.x + paddle.width / 2 + state.ball.radius + movementMargin;
    if (projectedX < left || projectedX > right) return;

    if (playHitSound(timeToContact)) state.hitSoundPrimedUntil = state.elapsed + timeToContact + 0.12;
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
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
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
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
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
    // Redraw an opaque frame and reset compositing so the moving ball never leaves an afterimage.
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
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
  nextSetButton.addEventListener('click', continueSet);
  setBreakOverlay.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    continueSet();
  }, { passive: false });
  settingsButton.addEventListener('click', openSettings);
  resumeButton.addEventListener('click', togglePause);
  pauseButton.addEventListener('click', togglePause);
  serveButton.addEventListener('click', launchPlayerServe);
  soundButton.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveSoundPreference();
    if (state.soundEnabled) activateAudio();
    else {
      stopActiveSounds();
      audio.outputWarmed = false;
    }
    updateSoundButton();
  });
  deuceButton.addEventListener('click', () => {
    state.settings.deuce = !state.settings.deuce;
    saveSettingsPreference();
    updateSettingButtons();
  });

  for (const button of scoreButtons) {
    button.addEventListener('click', () => {
      state.settings.targetScore = Number(button.dataset.score);
      saveSettingsPreference();
      updateSettingButtons();
    });
  }

  function continueSet() {
    if (!state.active || state.phase !== 'set-break') return;
    setBreakOverlay.hidden = true;
    resetRally(state.playerMatches > state.cpuMatches ? 'cpu' : 'player');
    emitAnalytics('level_start', { level_name: `SET ${state.playerMatches + state.cpuMatches + 1}` });
  }
  for (const button of matchButtons) {
    button.addEventListener('click', () => {
      state.settings.matches = Number(button.dataset.matches);
      saveSettingsPreference();
      updateSettingButtons();
    });
  }
  for (const button of difficultyButtons) {
    button.addEventListener('click', () => {
      state.settings.difficulty = button.dataset.difficulty;
      saveSettingsPreference();
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
  loadHitSound();
  loadScoreCheer();
  updateSoundButton();
  updateSettingButtons();
  draw();
})();
