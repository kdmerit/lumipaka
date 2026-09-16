(() => {
  const canvas = document.querySelector('#game');
  // Block browser selection/drag menus without cancelling taps, scrolling or game input.
  const gameShell = document.querySelector('.game-shell');
  for (const eventName of ['selectstart', 'dragstart', 'contextmenu']) {
    gameShell.addEventListener(eventName, (event) => event.preventDefault());
  }
  const context = canvas.getContext('2d');
  const setupOverlay = document.querySelector('#setup-overlay');
  const overlay = document.querySelector('#overlay');
  const overlayTitle = document.querySelector('#overlay-title');
  const overlayCopy = document.querySelector('#overlay-copy');
  const startButton = document.querySelector('#start-button');
  const stageSelectButton = document.querySelector('#stage-select-button');
  const stageGrid = document.querySelector('#stage-grid');
  const selectedStageLabel = document.querySelector('#selected-stage-label');
  const setupProgress = document.querySelector('#setup-progress');
  const playAllButton = document.querySelector('#play-all-button');
  const playSelectedButton = document.querySelector('#play-selected-button');
  const scoreElement = document.querySelector('#score');
  const bestElement = document.querySelector('#best');
  const levelElement = document.querySelector('#level');
  const livesElement = document.querySelector('#lives');
  const pauseToggle = document.querySelector('#pause-toggle');
  const pauseOverlay = document.querySelector('#pause-overlay');
  const resumeButton = document.querySelector('#resume-button');
  const soundToggle = document.querySelector('#sound-toggle');
  const powerupsElement = document.querySelector('#powerups');
  const launchPrompt = document.querySelector('#launch-prompt');

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
  let sfxOutputWarmed = false;

  const WIDTH = 720;
  const HEIGHT = 960;
  const STAGE_COUNT = 10;
  const PROGRESS_KEY = 'brick-loop-progress-v1';
  const BASE_PADDLE_WIDTH = 150;
  const CURRENT_BALL_SPEED = 500;
  const PREVIOUS_BASE_BALL_SPEED = CURRENT_BALL_SPEED * 1.5;
  const BASE_BALL_SPEED = PREVIOUS_BASE_BALL_SPEED * 0.8;
  // Stage 01 stays at 600 and Stage 10 is fixed at 1,500; the nine intervals are equal.
  const FINAL_BALL_SPEED = 1500;
  const STAGE_SPEED_STEP = (FINAL_BALL_SPEED - BASE_BALL_SPEED) / (STAGE_COUNT - 1);
  const MAX_BALL_TRAVEL_PER_STEP = 18;
  const MAX_LIVES = 3;
  const LIFE_LOSS_PAUSE = 0.9;
  const LEVEL_CLEAR_PAUSE = 5;
  const ITEM_DROP_CHANCE = 0.1;
  const ITEM_DROP_HEIGHT = 36;
  const SHIELD_Y = HEIGHT - 28;
  const HIT_SOUND_LOOKAHEAD = 0.5;
  const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3 12C-3 5 6-2 12 5 18-2 27 5 21 12Z"/></svg>';

  function defaultProgress() {
    return { unlockedStage: 0 };
  }

  function readProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');
      return {
        unlockedStage: Math.max(0, Math.min(STAGE_COUNT - 1, Number(value?.unlockedStage) || 0))
      };
    } catch (_) {
      return defaultProgress();
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch (_) {
      // Storage may be unavailable in private or embedded browser contexts.
    }
  }

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const paddle = { x: WIDTH / 2, y: HEIGHT - 54, width: BASE_PADDLE_WIDTH, height: 16, speed: 660 };
  const ball = { x: WIDTH / 2, y: HEIGHT - 88, radius: 10, vx: 210, vy: -420, speed: BASE_BALL_SPEED, hitSoundPrimedTarget: null };
  const state = {
    active: false,
    paused: false,
    waiting: 0,
    awaitingLaunch: false,
    score: 0,
    best: Number(localStorage.getItem('brick-loop-best') || 0),
    lives: MAX_LIVES,
    level: 1,
    selectedStage: 0,
    stageIndex: 0,
    runMode: 'run',
    testMode: false,
    cheatTaps: 0,
    progress: readProgress(),
    lastTime: 0,
    pointerX: null,
    pointerInput: null,
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
  // Ten curated patterns are used once per stage. Later stages add denser layouts and fixed obstacles.
  const BRICK_PATTERNS = [
    // 01: full opening wall
    ['#######', '#######', '#######', '#######', '#######'],
    // 02: diamond
    ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    // 03: pyramid
    ['...#...', '..###..', '.#####.', '#######', '#######', '#######'],
    // 04: inverted pyramid
    ['#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    // 05: cross
    ['...#...', '...#...', '#######', '#######', '...#...', '...#...', '...#...'],
    // 06: hourglass
    ['#######', '.#####.', '..###..', '...#...', '..###..', '.#####.', '#######'],
    // 07: X
    ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
    // 08: checkerboard
    ['#.#.#.#', '.#.#.#.', '#.#.#.#', '.#.#.#.', '#.#.#.#', '.#.#.#.', '#.#.#.#'],
    // 09: vertical bars
    ['#.#.#.#', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#.#.#.#', '#.#.#.#'],
    // 10: target finale
    ['...#...', '..###..', '.#####.', '##.###.', '.#####.', '..###..', '...#...']
  ];
  const STAGE_CONFIGS = [
    { name: 'OPENING WALL', pattern: BRICK_PATTERNS[0], obstacles: [] },
    { name: 'DIAMOND FIELD', pattern: BRICK_PATTERNS[1], obstacles: [] },
    { name: 'RISING PYRAMID', pattern: BRICK_PATTERNS[2], obstacles: [] },
    { name: 'FALLING PYRAMID', pattern: BRICK_PATTERNS[3], obstacles: [] },
    { name: 'CROSS CURRENT', pattern: BRICK_PATTERNS[4], obstacles: [] },
    { name: 'HOURGLASS', pattern: BRICK_PATTERNS[5], obstacles: [] },
    { name: 'BUTTERFLY ARRAY', pattern: ['#.....#', '###.###', '#######', '.#####.', '#######', '###.###', '#.....#'], obstacles: [] },
    { name: 'CHECKER CORE', pattern: BRICK_PATTERNS[7], obstacles: [[2, 2], [2, 4], [4, 2], [4, 4]] },
    { name: 'IRON MAZE', pattern: ['#######', '#...#.#', '#.#.#.#', '#.#...#', '#...#.#', '#.#.#.#', '#######'], obstacles: [[1, 0], [1, 4], [3, 2], [5, 2], [5, 4]] },
    { name: 'FINAL TARGET', pattern: ['...#...', '..###..', '.#####.', '##.###.', '.#####.', '..###..', '...#...'], obstacles: [[1, 2], [1, 4], [3, 3], [5, 2], [5, 4]] }
  ];
  const itemTypes = [
    { key: 'wide', label: 'W', name: 'WIDE', color: '#b8f36b', duration: 10, weight: 30 },
    { key: 'multi', label: '3', name: 'MULTI', color: '#a590ff', weight: 20 },
    { key: 'shield', label: 'S', name: 'SHIELD', color: '#74d8ff', weight: 20 },
    { key: 'fire', label: 'F', name: 'FIRE', color: '#ff9f43', duration: 6, weight: 12 },
    { key: 'double', label: '×2', name: 'DOUBLE', color: '#ffd166', duration: 10, weight: 12 }
  ];
  const itemTypeMap = Object.fromEntries(itemTypes.map((item) => [item.key, item]));

  function emit(event, payload = {}) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'lumipaka-game', event, payload }, '*');
    }
  }

  function emitAnalytics(name, params = {}) {
    emit('analytics-event', { name, params });
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

  function getScheduledSfxTime(context, delay = 0) {
    const safeDelay = Math.max(0, Number(delay) || 0);
    try {
      if (typeof context.getOutputTimestamp === 'function') {
        const timestamp = context.getOutputTimestamp();
        if (Number.isFinite(timestamp.contextTime) && Number.isFinite(timestamp.performanceTime)) {
          const targetPerformanceTime = performance.now() + safeDelay * 1000;
          const targetContextTime = timestamp.contextTime + (targetPerformanceTime - timestamp.performanceTime) / 1000;
          if (Number.isFinite(targetContextTime) && targetContextTime >= context.currentTime) return targetContextTime;
        }
      }
    } catch (_) {
      // Output timestamp support varies between browsers and embedded WebViews.
    }
    return context.currentTime + safeDelay;
  }

  function decodeSfx(name) {
    const context = getSfxContext();
    const rawData = sfxRawData.get(name);
    if (!context || !rawData || sfxBuffers.has(name) || sfxDecoding.has(name)) return;
    const decoding = context.decodeAudioData(rawData.slice(0))
      .then((buffer) => {
        sfxBuffers.set(name, buffer);
        warmSfxOutput();
      })
      .catch(() => {})
      .finally(() => { sfxDecoding.delete(name); });
    sfxDecoding.set(name, decoding);
  }

  function warmSfx() {
    const context = getSfxContext();
    if (!context) return;
    if (context.state === 'suspended') {
      context.resume().then(() => {
        Object.keys(sfxDefinitions).forEach(decodeSfx);
        warmSfxOutput();
      }).catch(() => {});
      return;
    }
    Object.keys(sfxDefinitions).forEach(decodeSfx);
    warmSfxOutput();
  }

  function warmSfxOutput() {
    const context = sfxContext;
    const buffer = sfxBuffers.get('hit');
    if (!state.soundEnabled || sfxOutputWarmed || !context || !buffer || context.state !== 'running') return;
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      source.start();
      source.stop(context.currentTime + 0.01);
      sfxOutputWarmed = true;
    } catch (_) {
      // Audio output warm-up is optional and must not affect gameplay.
    }
  }

  function playSfx(name, delay = 0) {
    if (!state.soundEnabled || state.paused) return false;
    const context = getSfxContext();
    const buffer = sfxBuffers.get(name);
    if (!context || !buffer || context.state !== 'running') {
      warmSfx();
      return false;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = sfxDefinitions[name].volume;
    source.connect(gain).connect(context.destination);
    source.onended = () => { activeSfx.delete(source); };
    activeSfx.add(source);
    source.start(getScheduledSfxTime(context, delay));
    return true;
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

  function updateLaunchPrompt() {
    if (!launchPrompt) return;
    launchPrompt.hidden = !state.active || state.paused || !state.awaitingLaunch || state.waiting > 0;
  }

  function pauseGameAudio() {
    Object.values(audioTracks).forEach((track) => track.pause());
    sfxOutputWarmed = false;
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
    state.pointerInput = null;
    if (state.paused) {
      pauseGameAudio();
    } else {
      state.lastTime = 0;
      resumeGameAudio();
      requestAnimationFrame(loop);
    }
    updatePauseToggle();
    updateLaunchPrompt();
    draw();
    emit('game-pause', { paused: state.paused });
  }

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    localStorage.setItem('brick-loop-sound', enabled ? 'on' : 'off');
    updateSoundToggle();
    if (!enabled) {
      sfxOutputWarmed = false;
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

  function updateHud() {
    state.lives = Math.max(0, Math.min(MAX_LIVES, Math.floor(state.lives)));
    scoreElement.textContent = String(Math.floor(state.score));
    levelElement.textContent = String(state.level).padStart(2, '0');
    bestElement.textContent = String(state.best);
    const lifeSignature = String(state.lives);
    if (livesElement.dataset.count === lifeSignature) return;
    livesElement.innerHTML = Array.from(
      { length: MAX_LIVES },
      (_, index) => `<span class="heart${index < state.lives ? '' : ' empty'}">${HEART_ICON}</span>`
    ).join('');
    livesElement.dataset.count = lifeSignature;
    livesElement.setAttribute('aria-label', `남은 목숨 ${state.lives}개`);
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

  function renderStageButtons() {
    const selectableStage = state.testMode
      ? STAGE_COUNT - 1
      : Math.max(0, Math.min(STAGE_COUNT - 1, state.progress.unlockedStage));
    state.selectedStage = Math.max(0, Math.min(selectableStage, state.selectedStage));
    stageGrid.innerHTML = '';
    for (let index = 0; index < STAGE_COUNT; index += 1) {
      const button = document.createElement('button');
      const unlocked = index <= selectableStage;
      button.type = 'button';
      button.className = `stage-button${index === state.selectedStage ? ' selected' : ''}`;
      button.dataset.stage = String(index);
      button.disabled = !unlocked;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.selectedStage));
      button.innerHTML = `<span>STAGE ${String(index + 1).padStart(2, '0')}</span><small class="status">${unlocked ? 'OPEN' : 'LOCK'}</small>`;
      button.addEventListener('click', () => selectStage(index));
      stageGrid.appendChild(button);
    }
    const config = STAGE_CONFIGS[state.selectedStage];
    selectedStageLabel.textContent = `STAGE ${String(state.selectedStage + 1).padStart(2, '0')} · ${config.name}`;
    setupProgress.textContent = state.testMode
      ? 'TEST MODE ACTIVE · ALL STAGES OPEN · RECORDS DISABLED'
      : `OPEN ${Math.min(STAGE_COUNT, selectableStage + 1)}/${STAGE_COUNT} · PLAY ALL STAGES to unlock more`;
    playSelectedButton.disabled = state.selectedStage > selectableStage;
  }

  function selectStage(index) {
    const selectableStage = state.testMode
      ? STAGE_COUNT - 1
      : Math.max(0, Math.min(STAGE_COUNT - 1, state.progress.unlockedStage));
    if (!Number.isInteger(index) || index < 0 || index > selectableStage) return;
    state.selectedStage = index;
    renderStageButtons();
  }

  function activateTestMode() {
    state.testMode = true;
    state.cheatTaps = 0;
    renderStageButtons();
    setupProgress.setAttribute('aria-label', '테스트 모드 활성화: 모든 스테이지 선택 가능, 기록 저장 안 함');
  }

  function showSetup() {
    state.active = false;
    state.paused = false;
    state.cheatTaps = 0;
    state.awaitingLaunch = false;
    state.waiting = 0;
    state.deathPause = 0;
    state.victoryPause = 0;
    state.pointerX = null;
    state.pointerInput = null;
    state.keys.left = false;
    state.keys.right = false;
    stopAllAudio();
    setupOverlay.classList.remove('hidden');
    overlay.classList.add('hidden');
    pauseOverlay.hidden = true;
    renderStageButtons();
    updatePauseToggle();
    updateLaunchPrompt();
    draw();
  }

  function handleTestModeTap(event) {
    if (state.testMode) return;
    if (state.active || setupOverlay.classList.contains('hidden')) {
      state.cheatTaps = 0;
      return;
    }
    const target = event.target instanceof Element ? event.target.closest('.score-stat, .lives-stat') : null;
    if (!target) {
      state.cheatTaps = 0;
      return;
    }
    if (state.cheatTaps < 5) {
      state.cheatTaps = target.classList.contains('score-stat') ? state.cheatTaps + 1 : 0;
      return;
    }
    if (target.classList.contains('lives-stat')) {
      state.cheatTaps += 1;
      if (state.cheatTaps === 10) activateTestMode();
    } else {
      state.cheatTaps = 0;
    }
  }

  function makeBricks() {
    state.bricks = [];
    const columns = 7;
    const width = 80;
    const height = 28;
    const gap = 10;
    const startX = (WIDTH - (columns * width + (columns - 1) * gap)) / 2;
    const config = STAGE_CONFIGS[Math.max(0, Math.min(STAGE_COUNT - 1, state.level - 1))];
    const pattern = config.pattern;
    pattern.forEach((line, row) => {
      [...line].forEach((cell, column) => {
        if (cell === '#') {
          state.bricks.push({
            x: startX + column * (width + gap),
            y: 82 + row * (height + gap),
            width,
            height,
            color: colors[(row + state.level - 1) % colors.length],
            alive: true,
            indestructible: false,
            row,
            column
          });
        }
      });
    });
    for (const [row, column] of config.obstacles) {
      const obstacle = state.bricks.find((brick) => brick.row === row && brick.column === column);
      if (obstacle) {
        obstacle.color = '#56627d';
        obstacle.indestructible = true;
      }
    }
  }

  function stageBallSpeed(stage = state.level) {
    const stageNumber = Math.max(1, Math.min(STAGE_COUNT, Math.floor(Number(stage) || 1)));
    return BASE_BALL_SPEED + (stageNumber - 1) * STAGE_SPEED_STEP;
  }

  function resetBall(targetBall = ball, waitingDuration = 0.8, awaitLaunch = false) {
    targetBall.x = paddle.x;
    targetBall.y = paddle.y - 34;
    targetBall.speed = stageBallSpeed();
    const direction = Math.random() > 0.5 ? 1 : -1;
    targetBall.vx = direction * (170 + Math.random() * 70);
    targetBall.vy = -Math.sqrt(Math.max(targetBall.speed * targetBall.speed - targetBall.vx * targetBall.vx, 340 * 340));
    targetBall.hitSoundPrimedTarget = null;
    state.waiting = waitingDuration;
    state.awaitingLaunch = awaitLaunch;
    updateLaunchPrompt();
  }

  function launchBall() {
    if (!state.active || state.paused || !state.awaitingLaunch || state.waiting > 0) return false;
    state.awaitingLaunch = false;
    state.lastTime = 0;
    updateLaunchPrompt();
    return true;
  }

  function resetGame(startStage = 0, runMode = 'run') {
    state.paused = false;
    state.awaitingLaunch = false;
    state.score = 0;
    state.lives = MAX_LIVES;
    state.stageIndex = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(Number(startStage) || 0)));
    state.level = state.stageIndex + 1;
    state.runMode = runMode === 'selected' ? 'selected' : 'run';
    state.lastTime = 0;
    state.pointerX = null;
    state.pointerInput = null;
    state.items = [];
    state.balls = [ball];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    state.powerupUiTimer = 0;
    state.deathPause = 0;
    state.victoryPause = 0;
    paddle.width = BASE_PADDLE_WIDTH;
    paddle.x = WIDTH / 2;
    makeBricks();
    updateHud();
    // Hold the opening ball on the paddle until the player chooses a launch moment.
    resetBall(ball, 0.8, true);
    updatePowerupStatus();
  }

  function start(startStage = 0, runMode = 'run') {
    if (state.active) return;
    stopAllAudio();
    warmSfx();
    resetGame(startStage, runMode);
    state.active = true;
    updatePauseToggle();
    updateLaunchPrompt();
    setupOverlay.classList.add('hidden');
    overlay.classList.add('hidden');
    emit('game-start');
    emitAnalytics('lumipaka_game_start');
    emitAnalytics('level_start', { level_name: `LOOP ${state.level}` });
    requestAnimationFrame(loop);
  }

  function gameOver() {
    state.active = false;
    state.paused = false;
    state.awaitingLaunch = false;
    state.pointerInput = null;
    stopAllAudio();
    playTrack(audioTracks.gameOver);
    const score = Math.floor(state.score);
    if (!state.testMode && score > state.best) {
      state.best = score;
      localStorage.setItem('brick-loop-best', String(score));
    }
    updateHud();
    state.items = [];
    state.balls = [ball];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    paddle.width = BASE_PADDLE_WIDTH;
    updatePowerupStatus();
    updatePauseToggle();
    updateLaunchPrompt();
    setupOverlay.classList.add('hidden');
    overlayTitle.innerHTML = 'LOOP<br /><em>OVER</em>';
    overlayCopy.innerHTML = `기록 <strong>${score}</strong>점 · 레벨 ${state.level}<br />부서진 패턴을 다시 시작해보세요.`;
    startButton.textContent = state.runMode === 'selected' ? 'REPLAY STAGE' : 'RESTART RUN';
    stageSelectButton.hidden = false;
    overlay.classList.remove('hidden');
    emit('game-over', { score, level: state.level });
    emitAnalytics('level_end', { level_name: `LOOP ${state.level}`, success: false });
    if (!state.testMode) emitAnalytics('post_score', { score, level: state.level, character: 'player' });
    emitAnalytics('lumipaka_game_end', { result: 'game_over', score, level: state.level });
  }

  function nextLevel() {
    stopTrack(audioTracks.victory);
    state.level = Math.min(STAGE_COUNT, state.level + 1);
    state.stageIndex = state.level - 1;
    makeBricks();
    state.items = [];
    state.effects = { wide: 0, fire: 0, double: 0, shield: false };
    state.powerupUiTimer = 0;
    paddle.width = BASE_PADDLE_WIDTH;
    state.balls = [ball];
    // Each new level starts with the ball held on the paddle as well.
    resetBall(ball, 0.8, true);
    updateHud();
    updatePowerupStatus();
    emitAnalytics('level_start', { level_name: `LOOP ${state.level}` });
  }

  function beginLevelClear() {
    if (state.victoryPause > 0 || !state.active) return;
    state.victoryPause = LEVEL_CLEAR_PAUSE;
    state.waiting = 0;
    state.items = [];
    stopAllAudio();
    playTrack(audioTracks.victory);
    if (state.runMode === 'run' && !state.testMode) {
      const nextStage = Math.min(STAGE_COUNT - 1, state.level);
      if (nextStage > state.progress.unlockedStage) {
        state.progress.unlockedStage = nextStage;
        saveProgress();
      }
      renderStageButtons();
    }
    emit('level-clear', { level: state.level, score: Math.floor(state.score) });
    emitAnalytics('level_end', { level_name: `LOOP ${state.level}`, success: true });
  }

  function finishLevelClear() {
    state.active = false;
    state.paused = false;
    state.victoryPause = 0;
    state.awaitingLaunch = false;
    state.pointerX = null;
    state.pointerInput = null;
    stopAllAudio();
    const score = Math.floor(state.score);
    if (!state.testMode && score > state.best) {
      state.best = score;
      localStorage.setItem('brick-loop-best', String(score));
    }
    updateHud();
    updatePauseToggle();
    updateLaunchPrompt();
    setupOverlay.classList.add('hidden');
    overlayTitle.innerHTML = state.runMode === 'run' ? 'ALL<br /><em>CLEAR</em>' : 'STAGE<br /><em>CLEAR</em>';
    overlayCopy.innerHTML = state.runMode === 'run'
      ? `10개 스테이지를 모두 돌파했습니다.<br />최종 기록 <strong>${score}</strong>점`
      : `선택한 스테이지를 클리어했습니다.<br />기록 <strong>${score}</strong>점`;
    startButton.textContent = state.runMode === 'run' ? 'RESTART RUN' : 'REPLAY STAGE';
    stageSelectButton.hidden = false;
    overlay.classList.remove('hidden');
    emit('game-clear', { score, level: state.level, mode: state.runMode });
    if (!state.testMode) emitAnalytics('post_score', { score, level: state.level, character: 'player' });
    emitAnalytics('lumipaka_game_end', { result: 'clear', score, level: state.level });
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

  function reflectedBallXAt(currentBall, time) {
    const travelWidth = WIDTH - currentBall.radius * 2;
    const period = travelWidth * 2;
    let projected = currentBall.x - currentBall.radius + currentBall.vx * time;
    projected = ((projected % period) + period) % period;
    if (projected > travelWidth) projected = period - projected;
    return projected + currentBall.radius;
  }

  function timeToVerticalImpact(currentBall, rect) {
    if (currentBall.vy === 0) return null;
    const top = rect.y - currentBall.radius;
    const bottom = rect.y + rect.height + currentBall.radius;
    const targetEdge = currentBall.vy > 0 ? top : bottom;
    const time = (targetEdge - currentBall.y) / currentBall.vy;
    if (time < 0 || time > HIT_SOUND_LOOKAHEAD) return null;

    const projectedX = reflectedBallXAt(currentBall, time);
    if (projectedX < rect.x - currentBall.radius || projectedX > rect.x + rect.width + currentBall.radius) return null;
    return time;
  }

  function findApproachingHitTarget(currentBall, paddleRect) {
    let target = null;
    let nearestTime = HIT_SOUND_LOOKAHEAD;
    if (currentBall.vy > 0) {
      const paddleTime = timeToVerticalImpact(currentBall, paddleRect);
      if (paddleTime !== null) {
        target = 'paddle';
        nearestTime = paddleTime;
      }
    }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const brickTime = timeToVerticalImpact(currentBall, brick);
      if (brickTime !== null && brickTime <= nearestTime) {
        target = brick;
        nearestTime = brickTime;
      }
    }
    return target === null ? null : { target, time: nearestTime };
  }

  function primeApproachingHitSound(currentBall, paddleRect) {
    if (currentBall.hitSoundPrimedTarget) return;
    const impact = findApproachingHitTarget(currentBall, paddleRect);
    if (impact !== null && playSfx('hit', impact.time)) currentBall.hitSoundPrimedTarget = impact.target;
  }

  function playCollisionSfx(currentBall, target) {
    const wasPrimed = currentBall.hitSoundPrimedTarget === target;
    currentBall.hitSoundPrimedTarget = null;
    if (!wasPrimed) playSfx('hit');
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
    const speed = source.speed || BASE_BALL_SPEED;
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
        vy: Math.sin(angle) * speed,
        hitSoundPrimedTarget: null
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
    state.lives = Math.max(0, state.lives - 1);
    updateHud();
    if (state.lives <= 0) {
      gameOver();
      return;
    }

    state.items = [];
    state.deathPause = LIFE_LOSS_PAUSE;
    state.victoryPause = 0;
    state.waiting = 0;
    state.pointerX = null;
    state.pointerInput = null;
    state.keys.left = false;
    state.keys.right = false;
    state.awaitingLaunch = false;
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
        if (state.runMode === 'selected' || state.level >= STAGE_COUNT) finishLevelClear();
        else nextLevel();
      }
      return;
    }

    if (state.deathPause > 0) {
      state.deathPause = Math.max(0, state.deathPause - delta);
      if (state.deathPause === 0) {
        resetBall(ball, 0.45, true);
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
    if (state.waiting > 0 || state.awaitingLaunch) {
      state.waiting = Math.max(0, state.waiting - delta);
      state.balls.forEach((currentBall) => {
        currentBall.x = paddle.x;
        currentBall.y = paddle.y - 34;
      });
      updateItems(delta, paddleRect);
      updateLaunchPrompt();
      return;
    }

    updateItems(delta, paddleRect);
    const survivingBalls = [];
    let lastMissedBall = null;
    for (const currentBall of state.balls) {
      // High stage speeds use short travel steps so a ball cannot skip over a brick or paddle.
      const stepCount = Math.max(1, Math.ceil((Math.hypot(currentBall.vx, currentBall.vy) * delta) / MAX_BALL_TRAVEL_PER_STEP));
      const stepDelta = delta / stepCount;
      let alive = true;
      for (let step = 0; step < stepCount; step += 1) {
        primeApproachingHitSound(currentBall, paddleRect);
        currentBall.x += currentBall.vx * stepDelta;
        currentBall.y += currentBall.vy * stepDelta;

        if (currentBall.x - currentBall.radius <= 0 || currentBall.x + currentBall.radius >= WIDTH) {
          currentBall.x = Math.max(currentBall.radius, Math.min(WIDTH - currentBall.radius, currentBall.x));
          currentBall.vx *= -1;
          currentBall.hitSoundPrimedTarget = null;
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
          playCollisionSfx(currentBall, 'paddle');
        }

        for (const brick of state.bricks) {
          if (!brick.alive || !circleIntersectsRect(currentBall, brick)) continue;
          if (brick.indestructible) {
            currentBall.vy *= -1;
            playCollisionSfx(currentBall, brick);
            break;
          }
          brick.alive = false;
          state.score += 10 * state.level * (state.effects.double > 0 ? 2 : 1);
          scoreElement.textContent = String(Math.floor(state.score));
          maybeDropItem(brick);
          if (state.effects.fire <= 0) currentBall.vy *= -1;
          playCollisionSfx(currentBall, brick);
          break;
        }

        if (currentBall.vy > 0 && state.effects.shield && currentBall.y + currentBall.radius >= SHIELD_Y) {
          currentBall.y = SHIELD_Y - currentBall.radius;
          currentBall.vy = -Math.abs(currentBall.vy);
          state.effects.shield = false;
          playCollisionSfx(currentBall, 'shield');
          updatePowerupStatus();
        }

        if (currentBall.y - currentBall.radius > HEIGHT) {
          alive = false;
          lastMissedBall = currentBall;
          break;
        }
      }
      if (alive) survivingBalls.push(currentBall);
    }

    state.balls = survivingBalls;
    if (state.bricks.every((brick) => brick.indestructible || !brick.alive)) {
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
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
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
    // Redraw an opaque frame and reset compositing so moving balls never leave an afterimage.
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.filter = 'none';
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#101a31';
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.strokeStyle = 'rgba(184,243,107,.055)';
    context.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke(); }

    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      context.fillStyle = brick.indestructible ? '#2f3b57' : brick.color;
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.beginPath();
      context.roundRect(brick.x, brick.y, brick.width, brick.height, 6);
      context.fill();
      context.shadowBlur = 0;
      if (brick.indestructible) {
        context.strokeStyle = 'rgba(184,243,107,.55)';
        context.lineWidth = 2;
        context.stroke();
        context.strokeStyle = 'rgba(148,160,189,.7)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(brick.x + 18, brick.y + 8);
        context.lineTo(brick.x + brick.width - 18, brick.y + brick.height - 8);
        context.moveTo(brick.x + brick.width - 18, brick.y + 8);
        context.lineTo(brick.x + 18, brick.y + brick.height - 8);
        context.stroke();
      } else {
        context.fillStyle = 'rgba(255,255,255,.3)';
        context.fillRect(brick.x + 10, brick.y + 5, brick.width - 20, 2);
      }
    }

    for (const item of state.items) drawItem(item);

    if (state.effects.shield) {
      context.save();
      context.strokeStyle = '#74d8ff';
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(18, SHIELD_Y);
      context.lineTo(WIDTH - 18, SHIELD_Y);
      context.stroke();
      context.restore();
    }

    context.fillStyle = '#ffffff';
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.beginPath();
    context.roundRect(paddle.x - paddle.width / 2, paddle.y, paddle.width, paddle.height, 7);
    context.fill();
    context.shadowBlur = 0;

    for (const currentBall of state.balls) {
      const fireActive = state.effects.fire > 0;
      context.fillStyle = fireActive ? '#ff9f43' : '#b8f36b';
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
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

  function startPointer(event) {
    if (!state.active || state.paused) return;
    if (event.pointerType === 'touch') event.preventDefault();
    setPointer(event);
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
    setPointer(event);
  }

  function endPointer(event) {
    if (!state.pointerInput || state.pointerInput.id !== event.pointerId) return;
    if (event.pointerType === 'touch') event.preventDefault();
    setPointer(event);
    // Apply the final drag position before attaching or launching the ball.
    if (state.pointerX !== null) paddle.x = state.pointerX;
    const shouldLaunch = state.active && !state.paused && state.awaitingLaunch && state.waiting <= 0 && !state.pointerInput.moved;
    state.pointerInput = null;
    state.pointerX = null;
    if (shouldLaunch) launchBall();
  }

  playAllButton.addEventListener('click', () => start(0, 'run'));
  playSelectedButton.addEventListener('click', () => start(state.selectedStage, 'selected'));
  startButton.addEventListener('click', () => {
    if (state.runMode === 'selected') start(state.stageIndex, 'selected');
    else start(0, 'run');
  });
  stageSelectButton.addEventListener('click', showSetup);
  document.addEventListener('pointerdown', handleTestModeTap, true);
  pauseToggle.addEventListener('click', togglePause);
  resumeButton.addEventListener('click', () => { if (state.paused) togglePause(); });
  soundToggle.addEventListener('click', () => setSoundEnabled(!state.soundEnabled));
  canvas.addEventListener('pointerdown', startPointer, { passive: false });
  canvas.addEventListener('pointermove', movePointer, { passive: false });
  canvas.addEventListener('pointerup', endPointer, { passive: false });
  const releasePointer = () => {
    state.pointerInput = null;
    state.pointerX = null;
  };
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);

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
      if (state.pointerX !== null) paddle.x = state.pointerX;
      const shouldLaunch = state.active && !state.paused && state.awaitingLaunch && state.waiting <= 0 && !state.pointerInput.moved;
      state.pointerInput = null;
      state.pointerX = null;
      if (shouldLaunch) launchBall();
    }, { passive: false });

    canvas.addEventListener('touchcancel', releasePointer, { passive: false });
  }
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
    if (!event.repeat && (event.key === ' ' || event.key === 'Enter') && state.awaitingLaunch && state.waiting <= 0) {
      event.preventDefault();
      launchBall();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') state.keys.left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = false;
  });

  makeBricks();
  renderStageButtons();
  updateHud();
  updateSoundToggle();
  updatePauseToggle();
  updateLaunchPrompt();
  updatePowerupStatus();
  draw();
})();
