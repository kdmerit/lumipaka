(() => {
  'use strict';

  const WIDTH = 720;
  const HEIGHT = 1280;
  const STAGE_COUNT = 10;
  const CHARACTER = 'stellar-fighter';
  const PROGRESS_KEY = 'stellar-rush-progress-v1';
  const SETTINGS_KEY = 'stellar-rush-settings-v1';
  const MAX_MODULE_LEVEL = 2;
  const PICKUP_DROP_RATE = .075;
  const TURRET_PICKUP_DROP_RATE = .0875;
  const MOB_BULLET_COLOR = '#FF781F';
  const MOB_BULLET_SPEED_MULTIPLIER = 3;
  const PLAYER_REAR_Y = HEIGHT - 112;
  const PLAYER_FORWARD_Y = HEIGHT / 2;
  const TOUCH_OFFSET_PX = 60;
  const PICKUP_SPEEDS = { shield: 440, bomb: 400, missile: 360, spread: 320, split: 280, score: 240 };
  const HEART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3 12C-3 5 6-2 12 5 18-2 27 5 21 12Z"/></svg>';
  const BOMB_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="15" r="7" fill="currentColor"/><path d="m14 9 3-3c-2-4 2-5 3-3M19 1v2m2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const MODULES = ['split', 'missile', 'spread'];
  const MISSILE = { speed: 700, damage: 14, turnRate: 6, life: 2, intervals: [0, 2, 1, .5] };
  const AUDIO_SAMPLES = {
    enemyDestroy: './audio-samples/enemy_destroy.wav',
    subBolt: './audio-samples/low-03-sub-bolt.wav',
    bassPlasma: './audio-samples/low-01-bass-plasma.wav',
    itemGet: './audio-samples/item_get2.wav', bombExplosion: './audio-samples/bomb_explosion.wav',
    victory: './audio-samples/victory-01-serene-spark.wav'
  };
  const skins = window.StellarSkins;
  const SKIN_VARIANTS = { scout: [1, 3], zigzag: [7], shooter: [2, 6], charger: [5], turret: [4, 8], orbiter: [9] };
  const skinCounts = {};
  let assetsReady = false;
  const SHIP = { width: 34, height: 48, speed: 520, hitRadius: 11 };

  const STAGE_NAMES = [
    'ORBITAL DAWN',
    'COMET BELT',
    'NEBULA FRONT',
    'SOLAR FORGE',
    'MOON RUINS',
    'VOID CARRIER',
    'PRISM GATE',
    'GRAVITY MAW',
    'ECLIPSE SERAPH',
    'SINGULARITY CORE'
  ];

  const STAGE_PALETTES = [
    { top: '#172d6f', bottom: '#070b24', accent: '#72e7ff', accent2: '#c5a7ff' },
    { top: '#3b1d69', bottom: '#12072a', accent: '#ff7bc7', accent2: '#ffd86e' },
    { top: '#102f5c', bottom: '#071326', accent: '#77f0d0', accent2: '#72e7ff' },
    { top: '#71301d', bottom: '#1d0810', accent: '#ffd86e', accent2: '#ff789d' },
    { top: '#332a70', bottom: '#0c0a26', accent: '#c5a7ff', accent2: '#72e7ff' },
    { top: '#183e50', bottom: '#06131e', accent: '#72e7ff', accent2: '#77f0d0' },
    { top: '#5a285e', bottom: '#19081e', accent: '#ff7bc7', accent2: '#c5a7ff' },
    { top: '#142c4c', bottom: '#050b19', accent: '#72e7ff', accent2: '#ffd86e' },
    { top: '#5d193d', bottom: '#130615', accent: '#ff789d', accent2: '#c5a7ff' },
    { top: '#21134d', bottom: '#02030d', accent: '#f4f8ff', accent2: '#72e7ff' }
  ];

  const STAGE_PROFILES = [
    { enemySpeed: .80, bulletSpeed: .88, bulletDensity: .60, bossHp: 520 },
    { enemySpeed: .86, bulletSpeed: .92, bulletDensity: .70, bossHp: 600 },
    { enemySpeed: .92, bulletSpeed: .96, bulletDensity: .80, bossHp: 700 },
    { enemySpeed: .98, bulletSpeed: 1.00, bulletDensity: .90, bossHp: 820 },
    { enemySpeed: 1.04, bulletSpeed: 1.05, bulletDensity: 1.00, bossHp: 960 },
    { enemySpeed: 1.10, bulletSpeed: 1.10, bulletDensity: 1.12, bossHp: 1120 },
    { enemySpeed: 1.16, bulletSpeed: 1.16, bulletDensity: 1.25, bossHp: 1300 },
    { enemySpeed: 1.24, bulletSpeed: 1.23, bulletDensity: 1.40, bossHp: 1500 },
    { enemySpeed: 1.32, bulletSpeed: 1.30, bulletDensity: 1.60, bossHp: 1750 },
    { enemySpeed: 1.40, bulletSpeed: 1.38, bulletDensity: 1.85, bossHp: 2150 }
  ];

  const ENEMY_STATS = {
    scout: { hp: 7, speed: 140, radius: 20, score: 100, color: '#72e7ff' },
    zigzag: { hp: 12, speed: 118, radius: 23, score: 150, color: '#c5a7ff' },
    shooter: { hp: 18, speed: 83, radius: 25, score: 220, color: '#ff7bc7' },
    charger: { hp: 15, speed: 190, radius: 22, score: 250, color: '#ffd86e' },
    turret: { hp: 35, speed: 38, radius: 29, score: 320, color: '#77f0d0' },
    orbiter: { hp: 24, speed: 100, radius: 25, score: 360, color: '#ff789d' }
  };

  const BOSS_PROFILES = [
    { name: 'ORBIT WARDEN', color: '#72e7ff', phases: [['radial', 'aimed'], ['sweep', 'radial']] },
    { name: 'COMET MANTIS', color: '#ff7bc7', phases: [['dash', 'aimed'], ['cross', 'sweep']] },
    { name: 'NEBULA HYDRA', color: '#77f0d0', phases: [['spiral', 'minions'], ['radial', 'aimed'], ['spiral', 'grid']] },
    { name: 'SOLAR FORGE', color: '#ffd86e', phases: [['lane', 'sweep'], ['grid', 'radial'], ['lane', 'cross']] },
    { name: 'MOON BASTION', color: '#c5a7ff', phases: [['orbit', 'mines'], ['cross', 'orbit'], ['grid', 'mines']] },
    { name: 'VOID CARRIER', color: '#72e7ff', phases: [['minions', 'aimed'], ['radial', 'dash'], ['grid', 'minions']] },
    { name: 'PRISM LEVIATHAN', color: '#ff7bc7', phases: [['sweep', 'lane'], ['cross', 'spiral'], ['lane', 'sweep']] },
    { name: 'GRAVITY MAW', color: '#ffd86e', phases: [['orbit', 'mine'], ['spiral', 'grid'], ['orbit', 'lane']] },
    { name: 'ECLIPSE SERAPH', color: '#ff789d', phases: [['mine', 'grid'], ['sweep', 'spiral'], ['lane', 'cross']] },
    { name: 'SINGULARITY CORE', color: '#f4f8ff', phases: [['radial', 'aimed'], ['lane', 'sweep'], ['spiral', 'grid'], ['orbit', 'cross', 'mine']] }
  ];

  const WAVE_PATTERNS = [
    ['line', 'zigzag', 'shooter'],
    ['vee', 'line', 'mixed'],
    ['zigzag', 'turret', 'charger'],
    ['mixed', 'spiral', 'shooter'],
    ['turret', 'vee', 'orbiter'],
    ['charger', 'mixed', 'turret'],
    ['spiral', 'orbiter', 'shooter'],
    ['lane', 'mixed', 'charger'],
    ['orbiter', 'spiral', 'turret'],
    ['lane', 'spiral', 'mixed']
  ];

  const STAGES = STAGE_NAMES.map((name, index) => {
    const profile = STAGE_PROFILES[index];
    const baseDuration = 21 + index * 1.5;
    const patterns = WAVE_PATTERNS[index];
    return {
      id: index + 1,
      name,
      palette: STAGE_PALETTES[index],
      profile,
      waves: [
        { duration: baseDuration, spawnEvery: Math.max(.78, 1.55 - index * .055), pattern: patterns[0] },
        { duration: baseDuration + 3, spawnEvery: Math.max(.72, 1.38 - index * .05), pattern: patterns[1] },
        { duration: baseDuration + 6, spawnEvery: Math.max(.66, 1.24 - index * .045), pattern: patterns[2] }
      ],
      boss: BOSS_PROFILES[index]
    };
  });

  const canvas = document.querySelector('#game');
  const context = canvas.getContext('2d');
  const gameShell = document.querySelector('.game-shell');
  const $ = (selector) => document.querySelector(selector);
  const scoreElement = $('#score');
  const stageElement = $('#stage');
  const stageNameElement = $('#stage-name');
  const livesElement = $('#lives');
  const bombCountElement = $('#bomb-count');
  const toolBombCountElement = $('#tool-bomb-count');
  const shieldStatusElement = $('#shield-status');
  const moduleElements = {
    split: $('#module-split'),
    missile: $('#module-missile'),
    spread: $('#module-spread')
  };
  const setupOverlay = $('#setup-overlay');
  const stageOverlay = $('#stage-overlay');
  const resultOverlay = $('#result-overlay');
  const pauseOverlay = $('#pause-overlay');
  const stageGrid = $('#stage-grid');
  const selectedStageLabel = $('#selected-stage-label');
  const setupProgress = $('#setup-progress');
  const startRunButton = $('#start-run-button');
  const practiceButton = $('#practice-button');
  const nextStageButton = $('#next-stage-button');
  const stageEyebrow = $('#stage-eyebrow');
  const stageTitle = $('#stage-title');
  const stageMedalElement = $('#stage-medal');
  const stageCopy = $('#stage-copy');
  const stageScoreLine = $('#stage-score-line');
  const stageTotalScoreLine = $('#stage-total-score-line');
  const resultEyebrow = $('#result-eyebrow');
  const resultTitle = $('#result-title');
  const resultScore = $('#result-score');
  const resultCopy = $('#result-copy');
  const restartButton = $('#restart-button');
  const setupButton = $('#setup-button');
  const bombButton = $('#bomb-button');
  const pauseButton = $('#pause-button');
  const soundButton = $('#sound-button');
  const resumeButton = $('#resume-button');

  for (const eventName of ['selectstart', 'dragstart', 'contextmenu']) {
    gameShell.addEventListener(eventName, (event) => event.preventDefault());
  }

  function defaultProgress() {
    return {
      unlockedStage: 0,
      medals: Array(STAGE_COUNT).fill(''),
      stageScores: Array(STAGE_COUNT).fill(0),
      bestRunScore: 0
    };
  }

  function readProgress() {
    try {
      const value = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || 'null');
      if (!value || typeof value !== 'object') return defaultProgress();
      const fallback = defaultProgress();
      return {
        unlockedStage: Math.max(0, Math.min(STAGE_COUNT - 1, Number(value.unlockedStage) || 0)),
        medals: Array.from({ length: STAGE_COUNT }, (_, index) => typeof value.medals?.[index] === 'string' ? value.medals[index] : ''),
        stageScores: Array.from({ length: STAGE_COUNT }, (_, index) => Math.max(0, Number(value.stageScores?.[index]) || 0)),
        bestRunScore: Math.max(0, Number(value.bestRunScore) || fallback.bestRunScore)
      };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
    } catch {
      // Storage may be disabled in private or embedded browser contexts.
    }
  }

  function readSettings() {
    try {
      const value = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      return { sound: value?.sound !== false, selectedStage: Number.isInteger(value?.selectedStage) ? value.selectedStage : 0 };
    } catch {
      return { sound: true, selectedStage: 0 };
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound: state.soundEnabled, selectedStage: state.selectedStage }));
    } catch {
      // Ignore storage errors and keep the current session playable.
    }
  }

  const settings = readSettings();
  const state = {
    screen: 'setup',
    runMode: 'run',
    selectedStage: Math.max(0, Math.min(STAGE_COUNT - 1, settings.selectedStage)),
    stageIndex: 0,
    stagePhase: 'wave',
    waveIndex: 0,
    waveElapsed: 0,
    waveSpawnTimer: 0,
    transitionTimer: 0,
    stageScoreStart: 0,
    stageScore: 0,
    score: 0,
    lives: 3,
    bombs: 2,
    bombCooldown: 0,
    bombProjectile: null,
    bombEffect: null,
    pendingStageClear: false,
    stageClearDelay: 0,
    visualTime: 0,
    shield: 0,
    modules: { split: 0, missile: 0, spread: 0 },
    playerX: WIDTH / 2,
    playerY: HEIGHT - 112,
    pointerTargetX: WIDTH / 2,
    pointerTargetY: PLAYER_REAR_Y,
    pointerActive: false,
    pointerId: null,
    keys: { left: false, right: false, up: false, down: false },
    fireTimer: .1,
    missileTimer: 0,
    invulnerable: 0,
    respawnTimer: 0,
    boss: null,
    enemies: [],
    playerBullets: [],
    enemyBullets: [],
    pickups: [],
    hazards: [],
    particles: [],
    stars: [],
    bossDash: null,
    toast: '',
    toastTimer: 0,
    randomSeed: 1,
    progress: readProgress(),
    soundEnabled: settings.sound !== false,
    lastTime: performance.now()
  };

  const audio = { context: null, compressor: null, samples: new Map() };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function random() {
    state.randomSeed = (state.randomSeed * 1664525 + 1013904223) >>> 0;
    return state.randomSeed / 4294967296;
  }

  function randomRange(minimum, maximum) {
    return minimum + random() * (maximum - minimum);
  }

  function currentStage() {
    return STAGES[state.stageIndex] || STAGES[0];
  }

  function currentProfile() {
    return currentStage().profile;
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(value)).toLocaleString('en-US');
  }

  function emit(event, payload = {}) {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'lumipaka-game', event, payload }, '*');
    }
  }

  function emitAnalytics(name, params = {}) {
    emit('analytics-event', { name, params });
  }

  function ensureAudio() {
    if (!state.soundEnabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audio.context) {
      try {
        audio.context = new AudioContextClass({ latencyHint: 'interactive' });
      } catch {
        try { audio.context = new AudioContextClass(); } catch { return null; }
      }
      audio.compressor = audio.context.createDynamicsCompressor();
      audio.compressor.threshold.value = -20;
      audio.compressor.knee.value = 12;
      audio.compressor.ratio.value = 10;
      audio.compressor.attack.value = .003;
      audio.compressor.release.value = .16;
      audio.compressor.connect(audio.context.destination);
    }
    if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
    return audio.context;
  }

  function preloadWeaponSamples() {
    return Promise.all(Object.entries(AUDIO_SAMPLES).map(async ([name, source]) => {
      try {
        const response = await fetch(source);
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = audio.context || (() => {
          try { return new AudioContextClass({ latencyHint: 'interactive' }); } catch { return new AudioContextClass(); }
        })();
        audio.context = audioContext;
        if (!audio.compressor) {
          audio.compressor = audioContext.createDynamicsCompressor();
          audio.compressor.threshold.value = -20;
          audio.compressor.knee.value = 12;
          audio.compressor.ratio.value = 10;
          audio.compressor.attack.value = .003;
          audio.compressor.release.value = .16;
          audio.compressor.connect(audioContext.destination);
        }
        audio.samples.set(name, await audioContext.decodeAudioData(bytes));
      } catch {
        // Effects remain playable with the rest of the game if a sample cannot load.
      }
    }));
  }

  function weaponPlaybackRate(level) {
    return level >= 3 ? 1.5 : level === 2 ? 1.25 : 1;
  }

  function playWeaponSample(name, level) {
    const audioContext = ensureAudio();
    const buffer = audio.samples.get(name);
    if (!audioContext || !buffer) return;
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = weaponPlaybackRate(level);
    gain.gain.value = name === 'bassPlasma' ? .14 : .10;
    source.connect(gain).connect(audio.compressor || audioContext.destination);
    source.start();
  }

  function playGameSample(name, gainValue = .18) {
    const audioContext = ensureAudio(); const buffer = audio.samples.get(name);
    if (!audioContext || !buffer) return;
    const source = audioContext.createBufferSource(); const gain = audioContext.createGain();
    source.buffer = buffer; gain.gain.value = gainValue;
    source.connect(gain).connect(audio.compressor || audioContext.destination); source.start();
  }

  function playTone(type) {
    const audioContext = ensureAudio();
    if (!audioContext) return;
    const profiles = {
      pickup: { frequency: 680, duration: .12, gain: .045, wave: 'sine' },
      hit: { frequency: 110, duration: .08, gain: .04, wave: 'sawtooth' },
      bomb: { frequency: 70, duration: .34, gain: .09, wave: 'sawtooth' },
      shield: { frequency: 540, duration: .18, gain: .055, wave: 'triangle' },
      boss: { frequency: 190, duration: .22, gain: .05, wave: 'square' },
      clear: { frequency: 820, duration: .28, gain: .05, wave: 'sine' }
    };
    const profile = profiles[type] || profiles.hit;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, profile.frequency * .62), now + profile.duration);
    gain.gain.setValueAtTime(profile.gain, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + profile.duration);
    oscillator.connect(gain).connect(audio.compressor || audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + .02);
  }

  function showToast(message, duration = 1.4) {
    state.toast = message;
    state.toastTimer = duration;
  }

  function medalRank(medal) {
    return medal === 'GOLD' ? 3 : medal === 'SILVER' ? 2 : medal === 'BRONZE' ? 1 : 0;
  }

  function stageMedal() {
    if (state.lives >= 3) return 'GOLD';
    if (state.lives === 2) return 'SILVER';
    return 'BRONZE';
  }

  function updateProgressForStage() {
    const index = state.stageIndex;
    const medal = stageMedal();
    state.progress.unlockedStage = Math.max(state.progress.unlockedStage, Math.min(STAGE_COUNT - 1, index + 1));
    if (medalRank(medal) > medalRank(state.progress.medals[index])) state.progress.medals[index] = medal;
    state.progress.stageScores[index] = Math.max(state.progress.stageScores[index] || 0, state.stageScore);
    saveProgress();
  }

  function hideAllOverlays() {
    setupOverlay.hidden = true;
    stageOverlay.hidden = true;
    resultOverlay.hidden = true;
    pauseOverlay.hidden = true;
  }

  function renderStageButtons() {
    stageGrid.innerHTML = '';
    for (let index = 0; index < STAGE_COUNT; index += 1) {
      const button = document.createElement('button');
      const unlocked = index <= state.progress.unlockedStage;
      button.type = 'button';
      button.className = `stage-button${index === state.selectedStage ? ' selected' : ''}`;
      button.dataset.stage = String(index);
      button.disabled = !unlocked;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.selectedStage));
      button.innerHTML = `STAGE ${String(index + 1).padStart(2, '0')}<span class="medal">${state.progress.medals[index] || (unlocked ? 'OPEN' : 'LOCK')}</span>`;
      button.addEventListener('click', () => selectStage(index));
      stageGrid.appendChild(button);
    }
    selectedStageLabel.textContent = `STAGE ${String(state.selectedStage + 1).padStart(2, '0')} · ${STAGES[state.selectedStage].name}`;
    practiceButton.disabled = !assetsReady || state.selectedStage > state.progress.unlockedStage;
    setupProgress.textContent = `CLEARED ${Math.min(STAGE_COUNT, state.progress.unlockedStage + 1)}/${STAGE_COUNT} · BEST RUN ${formatScore(state.progress.bestRunScore)} · cleared stages unlock practice`;
  }

  function selectStage(index) {
    if (index < 0 || index > state.progress.unlockedStage) return;
    state.selectedStage = index;
    saveSettings();
    renderStageButtons();
  }

  function resetEntities() {
    state.bombProjectile = null;
    state.bombEffect = null;
    state.pendingStageClear = false;
    state.stageClearDelay = 0;
    state.enemies.length = 0;
    state.playerBullets.length = 0;
    state.enemyBullets.length = 0;
    state.pickups.length = 0;
    state.hazards.length = 0;
    state.particles.length = 0;
    state.boss = null;
    state.bossDash = null;
  }

  function resetModules() {
    for (const moduleName of MODULES) state.modules[moduleName] = 0;
    state.missileTimer = 0;
  }

  function startRun(stageIndex, mode) {
    if (!assetsReady) return;
    state.bombCooldown = 0;
    for (const key of Object.keys(skinCounts)) delete skinCounts[key];
    ensureAudio();
    state.runMode = mode;
    state.score = 0;
    state.stageScore = 0;
    state.lives = 3;
    state.bombs = 2;
    state.shield = 0;
    resetModules();
    state.stageIndex = mode === 'run' ? 0 : stageIndex;
    state.randomSeed = 1000 + state.stageIndex * 7919 + (mode === 'practice' ? 333 : 0);
    state.screen = 'playing';
    hideAllOverlays();
    emitAnalytics('lumipaka_game_start', { character: CHARACTER });
    beginStage(state.stageIndex);
  }

  function beginStage(index) {
    state.stageIndex = clamp(index, 0, STAGE_COUNT - 1);
    state.stagePhase = 'wave';
    state.waveIndex = 0;
    state.waveElapsed = 0;
    state.waveSpawnTimer = .8;
    state.transitionTimer = 0;
    state.stageScoreStart = state.score;
    state.stageScore = 0;
    state.playerX = WIDTH / 2;
    state.playerY = PLAYER_REAR_Y;
    state.pointerTargetX = state.playerX;
    state.pointerTargetY = state.playerY;
    state.missileTimer = 0;
    state.invulnerable = 1.2;
    state.respawnTimer = 0;
    resetEntities();
    emitAnalytics('level_start', { level_name: `stage-${String(state.stageIndex + 1).padStart(2, '0')}` });
    updateHud();
  }

  function endStage() {
    if (state.screen !== 'playing') return;
    state.screen = 'stage-clear';
    state.stageScore = Math.max(0, state.score - state.stageScoreStart);
    updateProgressForStage();
    emitAnalytics('level_end', { level_name: `stage-${String(state.stageIndex + 1).padStart(2, '0')}`, success: true });
    stageEyebrow.textContent = state.stageIndex === STAGE_COUNT - 1 ? 'MISSION COMPLETE' : 'STAGE CLEAR';
    stageTitle.textContent = currentStage().name;
    stageMedalElement.textContent = stageMedalValue();
    state.lives = Math.min(3, state.lives + 1);
    stageCopy.textContent = state.stageIndex === STAGE_COUNT - 1 ? '모든 궤도를 돌파했습니다.' : '다음 궤도로 진입합니다.';
    stageScoreLine.textContent = `STAGE SCORE ${formatScore(state.stageScore)}`;
    stageTotalScoreLine.textContent = `SCORE ${formatScore(state.score)}`;
    nextStageButton.textContent = state.stageIndex === STAGE_COUNT - 1 ? 'VIEW RESULT' : state.runMode === 'run' ? 'NEXT STAGE' : 'STAGE SELECT';
    stageOverlay.hidden = false;
    playGameSample('victory', .20);
    updateHud();
  }

  function stageMedalValue() {
    const medal = stageMedal();
    return medal;
  }

  function finishRun(result) {
    state.bombProjectile = null;
    state.bombEffect = null;
    state.pendingStageClear = false;
    state.screen = 'result';
    if (state.runMode === 'run' && result === 'clear') state.progress.bestRunScore = Math.max(state.progress.bestRunScore, state.score);
    saveProgress();
    emitAnalytics('post_score', { score: state.score });
    emitAnalytics('lumipaka_game_end', { result, score: state.score, character: CHARACTER });
    resultEyebrow.textContent = result === 'clear' ? 'MISSION COMPLETE' : result === 'practice_clear' ? 'PRACTICE CLEAR' : 'RUN OVER';
    resultTitle.textContent = result === 'clear' ? 'RUN COMPLETE' : result === 'practice_clear' ? 'STAGE CLEAR' : 'GAME OVER';
    resultScore.textContent = formatScore(state.score);
    resultCopy.textContent = result === 'clear'
      ? `최고 기록 ${formatScore(state.progress.bestRunScore)} · 모든 스테이지를 정복했습니다.`
      : result === 'practice_clear'
        ? `${currentStage().name} 기록을 저장했습니다.`
        : '다시 출격해 패턴을 익혀보세요.';
    restartButton.textContent = result === 'practice_clear' ? 'PRACTICE AGAIN' : 'RESTART RUN';
    resultOverlay.hidden = false;
    updateHud();
  }

  function handleStageButton() {
    if (state.stageIndex === STAGE_COUNT - 1) {
      finishRun(state.runMode === 'run' ? 'clear' : 'practice_clear');
      return;
    }
    if (state.runMode === 'run') {
      beginStage(state.stageIndex + 1);
      state.screen = 'playing';
      hideAllOverlays();
      return;
    }
    showSetup();
  }

  function showSetup() {
    state.screen = 'setup';
    hideAllOverlays();
    setupOverlay.hidden = false;
    renderStageButtons();
    updateHud();
  }

  function togglePause() {
    if (state.screen !== 'playing' && state.screen !== 'paused') return;
    if (state.screen === 'paused') {
      state.screen = 'playing';
      pauseOverlay.hidden = true;
      pauseButton.setAttribute('aria-pressed', 'false');
      return;
    }
    state.screen = 'paused';
    pauseOverlay.hidden = false;
    pauseButton.setAttribute('aria-pressed', 'true');
  }

  function updateHud() {
    const stage = currentStage();
    scoreElement.textContent = formatScore(state.score);
    stageElement.textContent = String(state.stageIndex + 1).padStart(2, '0');
    stageNameElement.textContent = stage.name;
    if (livesElement.dataset.count !== String(state.lives)) {
      livesElement.innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="heart${i < state.lives ? '' : ' empty'}">${HEART_ICON}</span>`).join('');
      livesElement.dataset.count = String(state.lives);
      livesElement.setAttribute('aria-label', `남은 목숨 ${state.lives}개`);
    }
    for (const element of [bombCountElement, toolBombCountElement]) {
      const icon = skins.images.has('bomb') ? `<img src="${skins.urls.get('bomb')}" alt="" />` : BOMB_ICON;
      const key = `${state.bombs}-${skins.images.has('bomb')}`;
      if (element.dataset.count === key) continue;
      element.innerHTML = `${icon}<span>x${state.bombs}</span>`;
      element.dataset.count = key;
      element.setAttribute('aria-label', `폭탄 ${state.bombs}개`);
    }
    bombButton.setAttribute('aria-label', `폭탄 사용, 남은 폭탄 ${state.bombs}개`);
    let cooldownLabel = bombButton.querySelector('.bomb-cooldown');
    if (!cooldownLabel) { cooldownLabel = document.createElement('span'); cooldownLabel.className = 'bomb-cooldown'; bombButton.append(cooldownLabel); }
    cooldownLabel.textContent = state.bombCooldown > 0 ? `${Math.ceil(state.bombCooldown)}s` : '';
    if (state.bombCooldown > 0) bombButton.setAttribute('aria-label', `폭탄 ${state.bombs}개, 재사용까지 ${Math.ceil(state.bombCooldown)}초`);
    shieldStatusElement.textContent = state.shield ? 'READY' : 'EMPTY';
    shieldStatusElement.style.color = state.shield ? 'var(--yellow)' : 'var(--muted)';
    for (const moduleName of MODULES) {
      const element = moduleElements[moduleName];
      const level = state.modules[moduleName];
      element.innerHTML = `${moduleName.toUpperCase()} <b>${level}</b>`;
      element.classList.toggle('active', level > 0);
    }
    bombButton.disabled = state.screen !== 'playing' || state.bombs <= 0 || state.bombCooldown > 0 || state.pendingStageClear;
    pauseButton.disabled = !['playing', 'paused'].includes(state.screen);
    if (state.screen !== 'paused') pauseButton.setAttribute('aria-pressed', 'false');
    soundButton.textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(state.soundEnabled));
  }

  function spawnParticle(x, y, color, count = 5, speed = 130) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      state.particles.push({ x, y, vx: Math.cos(angle) * randomRange(speed * .4, speed), vy: Math.sin(angle) * randomRange(speed * .4, speed), life: randomRange(.3, .75), maxLife: .75, size: randomRange(2, 6), color });
    }
  }

  function spawnPlayerBullet(x, y, vx, vy, options = {}) {
    state.playerBullets.push({
      x,
      y,
      vx,
      vy,
      damage: options.damage || 1,
      radius: options.radius || 5,
      kind: options.kind || 'normal',
      color: options.color || '#72e7ff',
      life: options.life || 2.2,
      hitTimer: 0
    });
  }

  function spawnEnemyBullet(x, y, vx, vy, options = {}) {
    if (state.enemyBullets.length >= 260) return;
    state.enemyBullets.push({
      x,
      y,
      vx,
      vy,
      radius: options.radius || 6,
      swept: options.swept === true,
      color: options.color || '#ff789d',
      orbit: options.orbit || null
    });
  }

  function spawnAimedBurst(x, y, count, spread, speed, options = {}) {
    const baseAngle = Math.atan2(state.playerY - y, state.playerX - x);
    const profile = currentProfile();
    for (let index = 0; index < count; index += 1) {
      const ratio = count === 1 ? 0 : index / (count - 1) - .5;
      const angle = baseAngle + ratio * spread;
      spawnEnemyBullet(x, y, Math.cos(angle) * speed * profile.bulletSpeed, Math.sin(angle) * speed * profile.bulletSpeed, { color: currentStage().palette.accent2, ...options });
    }
  }

  function spawnPickup(x, y, type) {
    if (state.pickups.length >= 8) return;
    state.pickups.push({ x, y, type, radius: 16, angle: random() * Math.PI * 2 });
  }

  function choosePickup(enemy) {
    const dropRate = enemy.type === 'turret' ? TURRET_PICKUP_DROP_RATE : PICKUP_DROP_RATE;
    if (random() >= dropRate) return null;
    const roll = random();
    if (enemy.type === 'turret') {
      if (roll < .32) return 'shield';
      if (roll < .40) return 'bomb';
      if (roll < .55) return 'score';
      if (roll < .70) return 'split';
      if (roll < .85) return 'missile';
      return 'spread';
    }
    if (roll < .12) return 'bomb';
    if (roll < .32) return 'score';
    if (roll < .55) return 'split';
    if (roll < .78) return 'missile';
    return 'spread';
  }

  function spawnEnemy(type, x, y, options = {}) {
    const variants = SKIN_VARIANTS[type] || [1];
    const skinId = variants[(skinCounts[type] || 0) % variants.length];
    skinCounts[type] = (skinCounts[type] || 0) + 1;
    const stats = ENEMY_STATS[type] || ENEMY_STATS.scout;
    const stageScale = 1 + state.stageIndex * .08;
    state.enemies.push({
      skinId,
      type,
      x,
      y,
      originX: x,
      originY: y,
      vx: options.vx || 0,
      vy: options.vy || stats.speed * currentProfile().enemySpeed,
      hp: Math.ceil((options.hp || stats.hp) * stageScale),
      maxHp: Math.ceil((options.hp || stats.hp) * stageScale),
      radius: stats.radius,
      score: stats.score,
      color: stats.color,
      age: 0,
      shootTimer: randomRange(.5, 1.6),
      phase: random() * Math.PI * 2,
      dead: false
    });
  }

  function spawnWaveFormation(wave) {
    const center = WIDTH / 2;
    const gap = 94 + state.stageIndex * 3;
    switch (wave.pattern) {
      case 'line':
        for (let index = -2; index <= 2; index += 1) spawnEnemy('scout', center + index * gap, -48 - Math.abs(index) * 30);
        break;
      case 'vee':
        for (let index = 0; index < 5; index += 1) {
          const side = index % 2 === 0 ? -1 : 1;
          const depth = Math.ceil(index / 2);
          spawnEnemy(index % 3 === 0 ? 'shooter' : 'scout', center + side * depth * gap, -60 - depth * 38);
        }
        break;
      case 'zigzag':
        for (let index = 0; index < 4; index += 1) spawnEnemy('zigzag', 120 + index * 160, -54 - index * 42);
        break;
      case 'shooter':
        spawnEnemy('shooter', 145, -70);
        spawnEnemy('shooter', WIDTH - 145, -110);
        spawnEnemy('scout', center, -160);
        break;
      case 'turret':
        spawnEnemy('turret', 145, 120);
        spawnEnemy('turret', WIDTH - 145, 180);
        spawnEnemy('charger', center, -100);
        break;
      case 'charger':
        for (let index = 0; index < 4; index += 1) spawnEnemy('charger', 100 + index * 174, -80 - index * 30);
        break;
      case 'orbiter':
        for (let index = 0; index < 3; index += 1) spawnEnemy('orbiter', 150 + index * 210, -80 - index * 40);
        break;
      case 'spiral':
        for (let index = 0; index < 6; index += 1) spawnEnemy(index % 2 ? 'zigzag' : 'scout', center + Math.cos(index * 1.05) * 245, -70 - index * 30);
        break;
      case 'lane':
        for (let index = 0; index < 4; index += 1) spawnEnemy(index % 2 ? 'shooter' : 'charger', 100 + index * 174, -70 - index * 35);
        break;
      case 'mixed':
      default:
        spawnEnemy('shooter', 130, -75);
        spawnEnemy('zigzag', center, -125);
        spawnEnemy('charger', WIDTH - 130, -175);
        if (state.stageIndex >= 4) spawnEnemy('turret', center + 180, 80);
        break;
    }
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    spawnParticle(enemy.x, enemy.y, enemy.color, 1, 70);
    if (enemy.hp <= 0 && !enemy.dead) destroyEnemy(enemy);
  }

  function destroyEnemy(enemy) {
    enemy.dead = true;
    state.score += enemy.score;
    state.stageScore += enemy.score;
    spawnParticle(enemy.x, enemy.y, enemy.color, 12, 180);
    const pickupType = choosePickup(enemy);
    if (pickupType) spawnPickup(enemy.x, enemy.y, pickupType);
    playGameSample('enemyDestroy', .10);
  }

  function firePlayer() {
    if (state.respawnTimer > 0) return;
    const x = state.playerX;
    const y = state.playerY - 30;
    spawnPlayerBullet(x - 8, y, 0, -900, { damage: 2, color: '#f4f8ff' });
    spawnPlayerBullet(x + 8, y, 0, -900, { damage: 2, color: '#f4f8ff' });
    playWeaponSample('subBolt', 1);

    const splitLevel = state.modules.split;
    for (let index = 1; index <= splitLevel; index += 1) {
      const angle = .2 + index * .08;
      for (const direction of [-1, 1]) {
        spawnPlayerBullet(x, y, Math.sin(angle) * 900 * direction, -Math.cos(angle) * 900, { damage: 1.25 + index * .25, color: '#c5a7ff' });
      }
    }
    if (splitLevel > 0) playWeaponSample('subBolt', splitLevel);

    const spreadLevel = state.modules.spread;
    const spreadCount = spreadLevel * 2;
    for (let index = 0; index < spreadCount; index += 1) {
      const angle = lerp(-.48, .48, (index + 1) / (spreadCount + 1));
      spawnPlayerBullet(x, y + 4, Math.sin(angle) * 780, -Math.cos(angle) * 780, { damage: 1.05 + spreadLevel * .2, color: '#ff7bc7', radius: 4 });
    }
    if (spreadLevel > 0) playWeaponSample('subBolt', spreadLevel);
  }

  function findMissileTarget() {
    const livingEnemies = state.enemies.filter((enemy) => !enemy.dead);
    const candidates = livingEnemies.length ? livingEnemies : state.boss ? [state.boss] : [];
    if (!candidates.length) return null;
    return candidates.reduce((closest, candidate) => {
      const closestDistance = Math.hypot(closest.x - state.playerX, closest.y - state.playerY);
      const candidateDistance = Math.hypot(candidate.x - state.playerX, candidate.y - state.playerY);
      return candidateDistance < closestDistance ? candidate : closest;
    });
  }

  function spawnMissile() {
    const target = findMissileTarget();
    state.playerBullets.push({
      x: state.playerX,
      y: state.playerY - 30,
      vx: 0,
      vy: -MISSILE.speed,
      damage: MISSILE.damage,
      radius: 10,
      kind: 'missile',
      color: '#ff9a43',
      life: MISSILE.life,
      hitTimer: 0,
      target
    });
  }

  function updateMissileLauncher(dt) {
    const level = state.modules.missile;
    if (!level || state.respawnTimer > 0) return;
    state.missileTimer -= dt;
    while (state.missileTimer <= 0) {
      spawnMissile();
      playWeaponSample('bassPlasma', level);
      state.missileTimer += MISSILE.intervals[level];
    }
  }

  function useBomb() {
    if (state.screen !== 'playing' || state.bombs <= 0 || state.respawnTimer > 0 || state.bombCooldown > 0 || state.pendingStageClear) return;
    state.bombs -= 1;
    state.bombCooldown = 10;
    detonateBomb({ x: state.playerX });
    updateHud();
  }

  function detonateBomb(projectile) {
    const bursts = [{ x: projectile.x, y: 640, start: 0, size: 300 }];
    for (let i = 0; i < 15; i++) bursts.push({ x: 85 + ((i * 197) % 550), y: 150 + ((i * 277) % 940), start: .12 + i * 1.88 / 14, size: 190 + (i % 4) * 35 });
    state.bombEffect = { elapsed: 0, bursts };
    for (const bullet of state.enemyBullets) spawnParticle(bullet.x, bullet.y, '#ffd86e', 1, 80);
    state.enemyBullets.length = 0;
    state.hazards.length = 0;
    state.invulnerable = 1;
    for (const enemy of state.enemies) damageEnemy(enemy, 18 + state.stageIndex * 3);
    if (state.boss) state.boss.hp -= 90 + state.stageIndex * 16;
    showToast('BOMB CLEAR', 1.2);
    playGameSample('bombExplosion', .24);
    updateHud();
  }

  function updateBomb(dt) {
    state.bombCooldown = Math.max(0, state.bombCooldown - dt);
    if (state.bombEffect) {
      state.bombEffect.elapsed += dt;
      if (state.bombEffect.elapsed >= 2.5) {
        state.bombEffect = null;
        if (state.pendingStageClear) { state.stageClearDelay = 1; }
      }
    }
    if (state.stageClearDelay > 0) {
      state.stageClearDelay = Math.max(0, state.stageClearDelay - dt);
      if (state.stageClearDelay === 0) { state.pendingStageClear = false; endStage(); return; }
    }
    if (state.bombProjectile) {
      state.bombProjectile.elapsed += dt;
      const progress = Math.min(1, state.bombProjectile.elapsed / .5);
      state.bombProjectile.y = state.bombProjectile.startY + (640 - state.bombProjectile.startY) * progress;
      if (progress >= 1) {
        const projectile = state.bombProjectile;
        state.bombProjectile = null;
        detonateBomb(projectile);
      }
    }
  }

  function clearBombThreats() {
    if (!state.bombEffect || state.stagePhase === 'boss-clear') return;
    state.enemyBullets.length = 0;
    state.hazards.length = 0;
  }

  function drawBomb() {
    const p = state.bombProjectile;
    if (p && !skins.draw(context, 'bomb', p.x, p.y, 28, 64)) {
      context.fillStyle = '#ffd86e'; context.fillRect(p.x - 9, p.y - 24, 18, 48);
    }
    if (!state.bombEffect) return;
    const flash = state.bombEffect.elapsed % .17;
    if (state.bombEffect.elapsed < .51 && flash < .075) { context.save(); context.fillStyle = 'rgba(255,255,255,.72)'; context.fillRect(0, 0, WIDTH, HEIGHT); context.restore(); }
    for (const burst of state.bombEffect.bursts) {
      const age = state.bombEffect.elapsed - burst.start;
      if (age < 0 || age >= .5) continue;
      const frame = age < .08 ? 1 : age < .18 ? 2 : 3;
      const size = burst.size * (.45 + .55 * Math.min(1, age / .32));
      context.save();
      context.globalAlpha = age < .32 ? .9 : .9 * (1 - (age - .32) / .18);
      if (!skins.draw(context, `explosion-${frame}`, burst.x, burst.y, size, size)) {
        context.fillStyle = '#ffd86e'; context.beginPath(); context.arc(burst.x, burst.y, size / 2, 0, Math.PI * 2); context.fill();
      }
      context.restore();
    }
  }

  function collectPickup(pickup) {
    if (MODULES.includes(pickup.type)) {
      if (pickup.type === 'split') state.modules.spread = 0;
      if (pickup.type === 'spread') state.modules.split = 0;
      state.modules[pickup.type] = Math.min(MAX_MODULE_LEVEL, state.modules[pickup.type] + 1);
      if (pickup.type === 'missile') state.missileTimer = 0;
      showToast(`${pickup.type.toUpperCase()} +${state.modules[pickup.type]}`, 1.1);
    } else if (pickup.type === 'bomb') {
      state.bombs = Math.min(3, state.bombs + 1);
      showToast('BOMB +1', 1.1);
    } else if (pickup.type === 'shield') {
      state.shield = 1;
      showToast('SHIELD READY', 1.1);
    } else if (pickup.type === 'score') {
      state.score += 500;
      state.stageScore += 500;
      showToast('SCORE +500', 1.1);
    }
    playGameSample('itemGet', .16);
    updateHud();
  }

  function startBoss() {
    const stage = currentStage();
    state.stagePhase = 'boss';
    state.boss = {
      x: WIDTH / 2,
      y: 175,
      width: 150,
      height: 100,
      hp: stage.profile.bossHp,
      maxHp: stage.profile.bossHp,
      phase: 0,
      moveTime: 0,
      patternIndex: 0,
      patternCooldown: 1.0,
      telegraph: 0,
      pendingPattern: null,
      dashTimer: 0
    };
    state.bossDash = null;
    showToast(`${stage.boss.name} INBOUND`, 1.7);
    playTone('boss');
  }

  function patternCooldown(pattern) {
    const cooldowns = { radial: 1.15, aimed: 1.35, sweep: 1.85, cross: 1.3, lane: 1.9, spiral: 1.6, grid: 1.75, minions: 2.1, orbit: 1.65, mine: 1.8, mines: 1.9, dash: 1.55 };
    return cooldowns[pattern] || 1.45;
  }

  function executeBossPattern(pattern) {
    const boss = state.boss;
    const profile = currentProfile();
    const palette = currentStage().palette;
    if (!boss) return;
    switch (pattern) {
      case 'radial': {
        const count = 14 + state.stageIndex * 2;
        const speed = 155 + state.stageIndex * 10;
        for (let index = 0; index < count; index += 1) {
          const angle = (Math.PI * 2 * index) / count + boss.moveTime * .3;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * speed * profile.bulletSpeed, Math.sin(angle) * speed * profile.bulletSpeed, { color: palette.accent2, radius: 7 });
        }
        break;
      }
      case 'aimed':
        spawnAimedBurst(boss.x, boss.y + 35, 5, .46, 230 + state.stageIndex * 10);
        break;
      case 'sweep': {
        const minX = state.stageIndex === 0 ? 128 : state.stageIndex < 7 ? 112 : 96;
        const maxX = WIDTH - minX;
        const fromLeft = boss.moveTime % 2 < 1;
        state.hazards.push({ type: 'vertical-beam', x: fromLeft ? minX : maxX, vx: fromLeft ? 260 : -260, minX, maxX, warning: 1, width: 26, life: 10, color: palette.accent2 });
        break;
      }
      case 'cross': {
        const speed = 190 + state.stageIndex * 9;
        for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * speed * profile.bulletSpeed, Math.sin(angle) * speed * profile.bulletSpeed, { color: palette.accent, radius: 8 });
        }
        spawnAimedBurst(boss.x, boss.y, 3, .28, 250);
        break;
      }
      case 'lane': {
        const laneCount = 7;
        const safeLane = Math.floor(random() * laneCount);
        state.hazards.push({ type: 'lane-warning', safeLane, life: .75, laneCount });
        for (let lane = 0; lane < laneCount; lane += 1) {
          if (lane === safeLane) continue;
          for (let row = 0; row < 3; row += 1) {
            spawnEnemyBullet((lane + .5) * (WIDTH / laneCount), 265 - row * 44, 0, (190 + state.stageIndex * 8) * profile.bulletSpeed, { color: palette.accent2, radius: 8 });
          }
        }
        break;
      }
      case 'spiral': {
        const count = 28 + state.stageIndex * 2;
        for (let index = 0; index < count; index += 1) {
          const angle = index * .46 + boss.moveTime;
          const speed = 145 + index * 2;
          spawnEnemyBullet(boss.x, boss.y, Math.cos(angle) * speed * profile.bulletSpeed, Math.sin(angle) * speed * profile.bulletSpeed, { color: palette.accent, radius: 6 });
        }
        break;
      }
      case 'grid': {
        const gap = Math.floor(random() * 5);
        for (let row = 0; row < 2; row += 1) {
          for (let column = 0; column < 9; column += 1) {
            if ((column + row) % 9 === gap) continue;
            spawnEnemyBullet((column + .5) * (WIDTH / 9), 245 - row * 48, 0, (210 + state.stageIndex * 8) * profile.bulletSpeed, { color: palette.accent2, radius: 7 });
          }
        }
        break;
      }
      case 'minions':
        spawnEnemy('scout', 150, 130, { hp: 14 });
        spawnEnemy('shooter', WIDTH - 150, 150, { hp: 24 });
        if (state.stageIndex >= 5) spawnEnemy('orbiter', boss.x, 245, { hp: 34 });
        break;
      case 'orbit': {
        const count = 8 + state.stageIndex;
        for (let index = 0; index < count; index += 1) {
          const angle = (Math.PI * 2 * index) / count;
          spawnEnemyBullet(boss.x + Math.cos(angle) * 80, boss.y + Math.sin(angle) * 80, 0, 0, { radius: 8, color: palette.accent, orbit: { cx: boss.x, cy: boss.y, angle, radius: 80, speed: 1.5 + state.stageIndex * .08, remaining: 4.2 } });
        }
        break;
      }
      case 'mine':
      case 'mines': {
        const count = 3 + Math.floor(state.stageIndex / 3);
        for (let index = 0; index < count; index += 1) {
          state.hazards.push({ type: 'mine', x: 90 + random() * (WIDTH - 180), y: 360 + random() * 560, radius: 24, life: 5.5, color: palette.accent2, pulse: random() * Math.PI * 2 });
        }
        break;
      }
      case 'dash': {
        const targetX = state.playerX < WIDTH / 2 ? WIDTH - 120 : 120;
        state.bossDash = { from: boss.x, to: targetX, elapsed: 0, duration: .7 };
        spawnAimedBurst(boss.x, boss.y + 30, 7, .8, 245);
        break;
      }
      default:
        spawnAimedBurst(boss.x, boss.y, 3, .3, 220);
        break;
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return;
    const stage = currentStage();
    boss.moveTime += dt;
    boss.x = WIDTH / 2 + Math.sin(boss.moveTime * (.55 + state.stageIndex * .025)) * (220 - state.stageIndex * 4);
    if (state.bossDash) {
      state.bossDash.elapsed += dt;
      const amount = clamp(state.bossDash.elapsed / state.bossDash.duration, 0, 1);
      boss.x = lerp(state.bossDash.from, state.bossDash.to, amount);
      if (amount >= 1) state.bossDash = null;
    }
    const ratio = boss.hp / boss.maxHp;
    const targetPhase = ratio <= .25 ? Math.min(stage.boss.phases.length - 1, 3) : ratio <= .5 ? Math.min(stage.boss.phases.length - 1, 2) : ratio <= .72 ? 1 : 0;
    if (targetPhase > boss.phase) {
      boss.phase = targetPhase;
      boss.patternIndex = 0;
      boss.patternCooldown = .85;
      state.hazards.length = 0;
      showToast(`PHASE ${boss.phase + 1}`, 1.2);
      playTone('boss');
    }
    if (boss.hp <= 0) {
      defeatBoss();
      return;
    }
    if (boss.telegraph > 0) {
      boss.telegraph -= dt;
      if (boss.telegraph <= 0) {
        executeBossPattern(boss.pendingPattern);
        boss.patternCooldown = patternCooldown(boss.pendingPattern);
        boss.pendingPattern = null;
      }
      return;
    }
    if (boss.patternCooldown > 0) {
      boss.patternCooldown -= dt;
      return;
    }
    const phasePatterns = stage.boss.phases[Math.min(boss.phase, stage.boss.phases.length - 1)];
    boss.pendingPattern = phasePatterns[boss.patternIndex % phasePatterns.length];
    boss.patternIndex += 1;
    boss.telegraph = Math.max(.48, .78 - state.stageIndex * .02);
  }

  function defeatBoss() {
    const boss = state.boss;
    if (!boss) return;
    state.score += 2500 + state.stageIndex * 450;
    state.stageScore += 2500 + state.stageIndex * 450;
    spawnParticle(boss.x, boss.y, currentStage().boss.color, 60, 300);
    state.hazards.length = 0;
    state.boss = null; state.bombProjectile = null; state.bombEffect = { elapsed: 0, bursts: Array.from({ length: 9 }, (_, i) => ({ x: boss.x + ((i % 3) - 1) * 90, y: boss.y + (Math.floor(i / 3) - 1) * 85, start: i * .13, size: 260 })) };
    state.pendingStageClear = true; state.stagePhase = 'boss-clear'; playGameSample('bombExplosion', .24);
  }

  function updateWave(dt) {
    const stage = currentStage();
    const wave = stage.waves[state.waveIndex];
    if (!wave) {
      startBoss();
      return;
    }
    state.waveElapsed += dt;
    state.waveSpawnTimer -= dt;
    if (state.waveElapsed < wave.duration && state.waveSpawnTimer <= 0) {
      spawnWaveFormation(wave);
      state.waveSpawnTimer = wave.spawnEvery / currentProfile().bulletDensity;
    }
    if (state.waveElapsed >= wave.duration && (state.enemies.length === 0 || state.waveElapsed >= wave.duration + 4)) {
      for (const enemy of state.enemies) {
        if (enemy.type === 'turret') enemy.retreating = true;
      }
      state.stagePhase = 'transition';
      state.transitionTimer = 1.0;
    }
  }

  function updateStage(dt) {
    if (state.stagePhase === 'wave') {
      updateWave(dt);
    } else if (state.stagePhase === 'transition') {
      state.transitionTimer -= dt;
      if (state.transitionTimer <= 0) {
        state.waveIndex += 1;
        if (state.waveIndex >= currentStage().waves.length) startBoss();
        else {
          state.stagePhase = 'wave';
          state.waveElapsed = 0;
          state.waveSpawnTimer = .7;
        }
      }
    } else if (state.stagePhase === 'boss') {
      updateBoss(dt);
    }
  }

  function updateEnemies(dt) {
    const profile = currentProfile();
    for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = state.enemies[index];
      if (enemy.dead) {
        state.enemies.splice(index, 1);
        continue;
      }
      enemy.age += dt;
      if (enemy.type === 'zigzag') {
        enemy.x = enemy.originX + Math.sin(enemy.age * (2.1 + state.stageIndex * .08) + enemy.phase) * (75 + state.stageIndex * 4);
        enemy.y += enemy.vy * dt;
      } else if (enemy.type === 'charger') {
        enemy.y += enemy.vy * dt;
        if (enemy.y > 160) enemy.x += Math.sign(state.playerX - enemy.x) * (170 + state.stageIndex * 8) * dt;
      } else if (enemy.type === 'turret' && enemy.retreating) {
        enemy.y += enemy.vy * dt;
      } else if (enemy.type === 'turret') {
        enemy.y = enemy.originY + Math.sin(enemy.age * .7 + enemy.phase) * 22;
      } else if (enemy.type === 'orbiter') {
        enemy.y += enemy.vy * dt;
        enemy.x = enemy.originX + Math.cos(enemy.age * 1.4 + enemy.phase) * 100;
      } else {
        enemy.y += enemy.vy * dt;
      }
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && ['shooter', 'turret', 'orbiter'].includes(enemy.type)) {
        spawnAimedBurst(enemy.x, enemy.y + enemy.radius, enemy.type === 'turret' ? 3 : 1, enemy.type === 'turret' ? .38 : .12, (170 + state.stageIndex * 12) * MOB_BULLET_SPEED_MULTIPLIER, { color: MOB_BULLET_COLOR, swept: true });
        enemy.shootTimer = (enemy.type === 'turret' ? 1.9 : 2.4) / profile.bulletDensity;
      }
      if (enemy.y > HEIGHT + 120 || enemy.x < -150 || enemy.x > WIDTH + 150) state.enemies.splice(index, 1);
    }
  }

  function updatePlayer(dt) {
    if (state.respawnTimer > 0) state.respawnTimer = Math.max(0, state.respawnTimer - dt);
    if (state.invulnerable > 0) state.invulnerable = Math.max(0, state.invulnerable - dt);
    if (state.pointerActive) {
      state.playerX += (state.pointerTargetX - state.playerX) * Math.min(1, dt * 18);
      state.playerY += (state.pointerTargetY - state.playerY) * Math.min(1, dt * 18);
    } else {
      const directionX = (state.keys.left ? -1 : 0) + (state.keys.right ? 1 : 0);
      const directionY = (state.keys.up ? -1 : 0) + (state.keys.down ? 1 : 0);
      const length = Math.hypot(directionX, directionY) || 1;
      state.playerX += directionX / length * SHIP.speed * dt;
      state.playerY += directionY / length * SHIP.speed * dt;
    }
    state.playerX = clamp(state.playerX, 32, WIDTH - 32);
    state.playerY = clamp(state.playerY, PLAYER_FORWARD_Y, PLAYER_REAR_Y);
    updateMissileLauncher(dt);
    state.fireTimer -= dt;
    if (state.fireTimer <= 0) {
      firePlayer();
      state.fireTimer += .13;
    }
  }

  function updatePlayerBullets(dt) {
    for (let index = state.playerBullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.playerBullets[index];
      if (bullet.kind === 'missile') {
        const target = findMissileTarget();
        if (target) {
          const desiredAngle = Math.atan2(target.y - bullet.y, target.x - bullet.x);
          const currentAngle = Math.atan2(bullet.vy, bullet.vx);
          const difference = Math.atan2(Math.sin(desiredAngle - currentAngle), Math.cos(desiredAngle - currentAngle));
          const nextAngle = currentAngle + clamp(difference, -MISSILE.turnRate * dt, MISSILE.turnRate * dt);
          bullet.vx = Math.cos(nextAngle) * MISSILE.speed;
          bullet.vy = Math.sin(nextAngle) * MISSILE.speed;
          bullet.target = target;
        }
      }
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      bullet.hitTimer -= dt;
      if (bullet.life <= 0 || bullet.y < -80 || bullet.x < -100 || bullet.x > WIDTH + 100) state.playerBullets.splice(index, 1);
    }
  }

  function updateEnemyBullets(dt) {
    for (let index = state.enemyBullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.enemyBullets[index];
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      if (bullet.orbit) {
        bullet.orbit.angle += bullet.orbit.speed * dt;
        bullet.x = bullet.orbit.cx + Math.cos(bullet.orbit.angle) * bullet.orbit.radius;
        bullet.y = bullet.orbit.cy + Math.sin(bullet.orbit.angle) * bullet.orbit.radius;
        bullet.orbit.remaining -= dt;
        if (bullet.orbit.remaining <= 0) {
          const speed = bullet.orbit.radius * bullet.orbit.speed;
          bullet.vx = -Math.sin(bullet.orbit.angle) * speed;
          bullet.vy = Math.cos(bullet.orbit.angle) * speed;
          bullet.orbit = null;
        }
      } else {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
      }
      if (bullet.y < -100 || bullet.y > HEIGHT + 100 || bullet.x < -100 || bullet.x > WIDTH + 100) state.enemyBullets.splice(index, 1);
    }
  }

  function updatePickups(dt) {
    for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = state.pickups[index];
      pickup.y += PICKUP_SPEEDS[pickup.type] * dt;
      pickup.angle = 0;
      if (Math.hypot(pickup.x - state.playerX, pickup.y - state.playerY) < pickup.radius + 20) {
        collectPickup(pickup);
        state.pickups.splice(index, 1);
      } else if (pickup.y > HEIGHT + 50) {
        state.pickups.splice(index, 1);
      }
    }
  }

  function updateHazards(dt) {
    for (let index = state.hazards.length - 1; index >= 0; index -= 1) {
      const hazard = state.hazards[index];
      hazard.life -= dt;
      if (hazard.type === 'vertical-beam') {
        if (hazard.warning > 0) {
          hazard.warning = Math.max(0, hazard.warning - dt);
          continue;
        }
        hazard.x += hazard.vx * dt;
        if (hazard.x <= hazard.minX || hazard.x >= hazard.maxX) {
          state.hazards.splice(index, 1);
          continue;
        }
      }
      if (hazard.type === 'mine') hazard.pulse += dt * 5;
      if (hazard.type === 'vertical-beam' && state.playerY + SHIP.hitRadius >= 80 && state.playerY - SHIP.hitRadius <= HEIGHT - 70 && Math.abs(hazard.x - state.playerX) < hazard.width / 2 + SHIP.hitRadius) takeHit();
      if (hazard.type === 'mine' && Math.hypot(hazard.x - state.playerX, hazard.y - state.playerY) < hazard.radius + SHIP.hitRadius) takeHit();
      if (hazard.type === 'lane-warning') {
        if (hazard.life <= 0) state.hazards.splice(index, 1);
        continue;
      }
      if (hazard.life <= 0 || (hazard.type === 'vertical-beam' && (hazard.x < -80 || hazard.x > WIDTH + 80))) state.hazards.splice(index, 1);
    }
  }

  function updateParticles(dt) {
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 2.5);
      particle.vy *= Math.max(0, 1 - dt * 2.5);
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(index, 1);
    }
  }

  function circleRectCollision(circle, rect) {
    const closestX = clamp(circle.x, rect.x - rect.width / 2, rect.x + rect.width / 2);
    const closestY = clamp(circle.y, rect.y - rect.height / 2, rect.y + rect.height / 2);
    return Math.hypot(circle.x - closestX, circle.y - closestY) <= circle.radius;
  }

  function playerRect() {
    return { x: state.playerX, y: state.playerY, width: SHIP.width, height: SHIP.height };
  }

  function sweptBulletCollision(bullet, rect) {
    const ax = bullet.previousX ?? bullet.x, ay = bullet.previousY ?? bullet.y;
    if (circleRectCollision(bullet, rect) || circleRectCollision({ x: ax, y: ay, radius: bullet.radius }, rect)) return true;
    const dx = bullet.x - ax, dy = bullet.y - ay;
    const left = rect.x - rect.width / 2, right = rect.x + rect.width / 2;
    const top = rect.y - rect.height / 2, bottom = rect.y + rect.height / 2;
    // Segment/rectangle intersection, then exact rounded corners. Do not
    // expand the hitbox to an oversized rectangular approximation.
    let enter = 0, leave = 1;
    for (const [start, delta, low, high] of [[ax, dx, left, right], [ay, dy, top, bottom]]) {
      if (delta === 0) { if (start < low || start > high) { enter = 2; break; } }
      else {
        const a = (low - start) / delta, b = (high - start) / delta;
        enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      }
    }
    if (enter <= leave) return true;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return false;
    return [[left, top], [right, top], [left, bottom], [right, bottom]].some(([x, y]) => {
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / lengthSquared, 0, 1);
      return Math.hypot(ax + t * dx - x, ay + t * dy - y) <= bullet.radius;
    });
  }

  function enemyRect(enemy) {
    return { x: enemy.x, y: enemy.y, width: enemy.radius * 2, height: enemy.radius * 2 };
  }

  function bossRect() {
    if (!state.boss) return null;
    return { x: state.boss.x, y: state.boss.y, width: state.boss.width, height: state.boss.height };
  }

  function updateCollisions() {
    const boss = state.boss;
    for (let bulletIndex = state.playerBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = state.playerBullets[bulletIndex];
      let consumed = false;
      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = state.enemies[enemyIndex];
        if (enemy.dead || !circleRectCollision({ x: bullet.x, y: bullet.y, radius: bullet.radius }, enemyRect(enemy))) continue;
        damageEnemy(enemy, bullet.damage);
        consumed = true;
        break;
      }
      if (!consumed && boss && circleRectCollision({ x: bullet.x, y: bullet.y, radius: bullet.radius }, bossRect())) {
        boss.hp -= bullet.damage;
        spawnParticle(bullet.x, bullet.y, currentStage().boss.color, 1, 50);
        consumed = true;
      }
      if (consumed) state.playerBullets.splice(bulletIndex, 1);
    }

    if (state.respawnTimer > 0 || state.invulnerable > 0) return;
    const rect = playerRect();
    for (let index = state.enemyBullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.enemyBullets[index];
      if (bullet.swept ? sweptBulletCollision(bullet, rect) : circleRectCollision(bullet, rect)) {
        state.enemyBullets.splice(index, 1);
        takeHit();
        if (state.screen !== 'playing') return;
        break;
      }
    }
    for (const enemy of state.enemies) {
      if (!enemy.dead && circleRectCollision({ x: enemy.x, y: enemy.y, radius: enemy.radius * .7 }, rect)) {
        takeHit();
        break;
      }
    }
  }

  function takeHit() {
    if (state.screen !== 'playing' || state.pendingStageClear || state.respawnTimer > 0 || state.invulnerable > 0) return;
    if (state.shield) {
      state.shield = 0;
      state.invulnerable = .85;
      state.enemyBullets = state.enemyBullets.filter((bullet) => Math.hypot(bullet.x - state.playerX, bullet.y - state.playerY) > 80);
      showToast('SHIELD BREAK', 1.0);
      playTone('shield');
      updateHud();
      return;
    }
    state.lives -= 1;
    resetModules();
    state.invulnerable = 1.5;
    state.respawnTimer = .7;
    state.playerX = WIDTH / 2;
    state.playerY = PLAYER_REAR_Y;
    state.pointerTargetX = state.playerX;
    state.pointerTargetY = state.playerY;
    spawnParticle(state.playerX, state.playerY, '#ff789d', 22, 260);
    playTone('hit');
    showToast(state.lives > 0 ? 'MODULES LOST' : 'LAST LIFE', 1.1);
    if (state.lives <= 0) {
      state.screen = 'result';
      emitAnalytics('level_end', { level_name: `stage-${String(state.stageIndex + 1).padStart(2, '0')}`, success: false });
      finishRun('game_over');
    }
    updateHud();
  }

  function updateStars(dt) {
    for (const star of state.stars) {
      star.y += star.speed * dt;
      if (star.y > HEIGHT + 10) {
        star.y = -10;
        star.x = random() * WIDTH;
      }
    }
  }

  function update(dt) {
    if (document.hidden) return;
    updateStars(dt * (state.screen === 'playing' ? 1 : .28));
    if (state.toastTimer > 0) state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.screen !== 'playing') return;
    state.visualTime += dt;
    updateBomb(dt);
    if (state.screen !== 'playing') return;
    if (state.pendingStageClear) { updateClearProjectiles(dt); return; }
    updatePlayer(dt);
    updateStage(dt);
    if (state.pendingStageClear) { updateClearProjectiles(dt); return; }
    updateEnemies(dt);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updatePickups(dt);
    clearBombThreats();
    updateHazards(dt);
    updateParticles(dt);
    updateCollisions();
    updateHud();
  }

  function updateClearProjectiles(dt) {
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updateParticles(dt);
    updateHud();
  }

  function drawBackground() {
    const palette = currentStage().palette;
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, palette.top);
    gradient.addColorStop(1, palette.bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.save();
    for (const star of state.stars) {
      context.globalAlpha = star.alpha;
      context.fillStyle = star.color;
      context.fillRect(star.x, star.y, star.size, star.size * 2.2);
    }
    context.restore();
    context.save();
    context.globalAlpha = .12;
    context.strokeStyle = palette.accent;
    context.lineWidth = 1;
    for (let y = 70; y < HEIGHT; y += 86) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }
    context.restore();
  }

  function drawPlayer() {
    if (state.invulnerable > 0 && Math.floor(state.invulnerable * 12) % 2 === 0) return;
    const x = state.playerX;
    const y = state.playerY;
    const palette = currentStage().palette;
    context.save();
    context.translate(x, y);
    if (skins.images.has('fighter')) {
      for (let i = 0; i < 2; i++) {
        const wave = Math.sin(state.visualTime * 23 + i * 2.3);
        const length = 30 * (1 + wave * .15);
        context.save(); context.globalAlpha = .92 + wave * .08;
        skins.draw(context, 'flame', i === 0 ? -10 : 10, 27 + length / 2, 10 * (1 + wave * .08), length);
        context.restore();
      }
      skins.draw(context, 'fighter', 0, 0, 58, 66);
      if (state.shield) { context.strokeStyle = '#ffd86e'; context.lineWidth = 3; context.beginPath(); context.arc(0, 0, 35, 0, Math.PI * 2); context.stroke(); }
      context.restore(); return;
    }
    context.shadowColor = palette.accent;
    context.shadowBlur = 22;
    context.fillStyle = '#f4f8ff';
    context.beginPath();
    context.moveTo(0, -30);
    context.lineTo(19, 22);
    context.lineTo(0, 14);
    context.lineTo(-19, 22);
    context.closePath();
    context.fill();
    context.fillStyle = palette.accent;
    context.beginPath();
    context.moveTo(0, -18);
    context.lineTo(8, 15);
    context.lineTo(0, 9);
    context.lineTo(-8, 15);
    context.closePath();
    context.fill();
    context.fillStyle = '#ff7bc7';
    context.beginPath();
    context.moveTo(-6, 17);
    context.lineTo(0, 39);
    context.lineTo(6, 17);
    context.closePath();
    context.fill();
    if (state.shield) {
      context.shadowColor = '#ffd86e';
      context.strokeStyle = '#ffd86e';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 31, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawPlayerBullet(bullet) {
    context.save();
    context.fillStyle = bullet.color;
    context.shadowColor = bullet.color;
    context.shadowBlur = bullet.kind === 'missile' ? 18 : 9;
    if (bullet.kind === 'missile') {
      const angle = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2;
      context.translate(bullet.x, bullet.y);
      context.rotate(angle);
      context.fillStyle = '#fff3d7';
      context.beginPath();
      context.moveTo(0, -15); context.lineTo(8, 11); context.lineTo(0, 7); context.lineTo(-8, 11); context.closePath();
      context.fill();
      context.fillStyle = '#ff7a2a';
      context.fillRect(-3, 7, 6, 13);
    } else {
      context.beginPath();
      context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawEnemyBullet(bullet) {
    context.save();
    context.fillStyle = bullet.color;
    context.shadowColor = bullet.color;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEnemy(enemy) {
    context.save();
    context.translate(enemy.x, enemy.y);
    context.rotate(Math.sin(enemy.age * 2 + enemy.phase) * .08);
    if (skins.draw(context, `enemy-${enemy.skinId}`, 0, 0, enemy.radius * 2.5, enemy.radius * 2.5)) { context.restore(); return; }
    context.fillStyle = enemy.color;
    context.shadowColor = enemy.color;
    context.shadowBlur = 14;
    if (enemy.type === 'turret') {
      context.fillRect(-24, -24, 48, 48);
      context.fillStyle = '#071326';
      context.beginPath();
      context.arc(0, 0, 12, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.type === 'charger') {
      context.beginPath();
      context.moveTo(0, 26);
      context.lineTo(24, -20);
      context.lineTo(0, -8);
      context.lineTo(-24, -20);
      context.closePath();
      context.fill();
    } else if (enemy.type === 'orbiter') {
      context.beginPath();
      context.arc(0, 0, 22, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#f4f8ff';
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(0, 0, 34, 10, enemy.age, 0, Math.PI * 2);
      context.stroke();
    } else {
      context.beginPath();
      context.moveTo(0, 24);
      context.lineTo(23, -18);
      context.lineTo(0, -9);
      context.lineTo(-23, -18);
      context.closePath();
      context.fill();
      context.fillStyle = '#071326';
      context.beginPath();
      context.arc(0, -4, 7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawBoss() {
    const boss = state.boss;
    if (!boss) return;
    const profile = currentStage().boss;
    context.save();
    context.translate(boss.x, boss.y);
    const hasSkin = skins.draw(context, `boss-${state.stageIndex + 1}`, 0, 0, state.stageIndex === 9 ? 260 : 180, state.stageIndex === 9 ? 210 : 180);
    if (!hasSkin) {
    context.fillStyle = profile.color;
    context.shadowColor = profile.color;
    context.shadowBlur = 28;
    context.beginPath();
    context.moveTo(0, -57);
    context.lineTo(78, -18);
    context.lineTo(61, 44);
    context.lineTo(0, 62);
    context.lineTo(-61, 44);
    context.lineTo(-78, -18);
    context.closePath();
    context.fill();
    context.fillStyle = '#080d28';
    context.beginPath();
    context.arc(0, 4, 25, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f4f8ff';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 4, 36 + Math.sin(boss.moveTime * 3) * 3, 0, Math.PI * 2);
    context.stroke();
    }
    context.restore();
    const barWidth = 520;
    const barX = (WIDTH - barWidth) / 2;
    context.fillStyle = 'rgba(0,0,0,.45)';
    context.fillRect(barX, 24, barWidth, 12);
    context.fillStyle = profile.color;
    context.fillRect(barX, 24, barWidth * clamp(boss.hp / boss.maxHp, 0, 1), 12);
    context.fillStyle = '#f4f8ff';
    context.font = '900 16px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText(profile.name, WIDTH / 2, 60);
    if (boss.telegraph > 0 && boss.pendingPattern) {
      context.fillStyle = '#ffd86e';
      context.font = '900 15px Inter, sans-serif';
      context.fillText(boss.pendingPattern.toUpperCase(), WIDTH / 2, 88);
    }
  }

  function drawPickup(pickup) {
    const colors = { split: '#c5a7ff', missile: '#ff9a43', spread: '#ff7bc7', bomb: '#ff4c5e', shield: '#77f0d0', score: '#f4d34d' };
    const labels = { split: 'S', missile: 'M', spread: 'W', bomb: 'B', shield: 'S', score: '★' };
    context.save();
    context.translate(pickup.x, pickup.y);
    context.scale(1.2, 1.2);
    if (skins.draw(context, `pickup-${pickup.type}`, 0, 0, 42, 42)) { context.restore(); return; }
    context.fillStyle = colors[pickup.type];
    context.shadowColor = colors[pickup.type];
    context.shadowBlur = 16;
    context.beginPath();
    context.moveTo(0, -15);
    context.lineTo(15, 0);
    context.lineTo(0, 15);
    context.lineTo(-15, 0);
    context.closePath();
    context.fill();
    context.fillStyle = '#071326';
    context.font = '900 12px Inter, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(labels[pickup.type], 0, 1);
    context.restore();
  }

  function drawHazard(hazard) {
    const palette = currentStage().palette;
    context.save();
    if (hazard.type === 'vertical-beam') {
      if (hazard.warning > 0) {
        const safeWidth = hazard.minX - hazard.width / 2 - SHIP.hitRadius - 2;
        context.fillStyle = '#77f0d0';
        context.globalAlpha = .2;
        context.fillRect(32, 80, safeWidth - 32, HEIGHT - 150);
        context.fillRect(WIDTH - safeWidth, 80, safeWidth - 32, HEIGHT - 150);
        context.globalAlpha = .85;
        context.strokeStyle = hazard.color;
        context.setLineDash([12, 12]);
        context.strokeRect(hazard.x - hazard.width / 2, 80, hazard.width, HEIGHT - 150);
        context.fillStyle = hazard.color;
        context.font = 'bold 44px sans-serif';
        context.textAlign = 'center';
        context.fillText(hazard.vx > 0 ? '→' : '←', WIDTH / 2, state.playerY - 80);
        context.restore();
        return;
      }
      context.globalAlpha = .75;
      context.fillStyle = hazard.color;
      context.shadowColor = hazard.color;
      context.shadowBlur = 24;
      context.fillRect(hazard.x - hazard.width / 2, 80, hazard.width, HEIGHT - 150);
    } else if (hazard.type === 'mine') {
      context.fillStyle = hazard.color;
      context.globalAlpha = .8;
      context.shadowColor = hazard.color;
      context.shadowBlur = 18;
      context.beginPath();
      context.arc(hazard.x, hazard.y, hazard.radius + Math.sin(hazard.pulse) * 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#080d28';
      context.beginPath();
      context.arc(hazard.x, hazard.y, 7, 0, Math.PI * 2);
      context.fill();
    } else if (hazard.type === 'lane-warning') {
      context.globalAlpha = .42;
      context.fillStyle = palette.accent2;
      const laneWidth = WIDTH / hazard.laneCount;
      for (let lane = 0; lane < hazard.laneCount; lane += 1) {
        if (lane === hazard.safeLane) continue;
        context.fillRect(lane * laneWidth + 4, 116, laneWidth - 8, HEIGHT - 220);
      }
    }
    context.restore();
  }

  function drawToast() {
    if (!state.toast || state.toastTimer <= 0) return;
    context.save();
    context.globalAlpha = clamp(state.toastTimer / .35, 0, 1);
    context.fillStyle = '#f4f8ff';
    context.font = '900 20px Inter, sans-serif';
    context.textAlign = 'center';
    context.shadowColor = currentStage().palette.accent;
    context.shadowBlur = 15;
    context.fillText(state.toast, WIDTH / 2, HEIGHT * .47);
    context.restore();
  }

  function draw() {
    drawBackground();
    for (const hazard of state.hazards) drawHazard(hazard);
    for (const bullet of state.enemyBullets) drawEnemyBullet(bullet);
    for (const bullet of state.playerBullets) drawPlayerBullet(bullet);
    for (const enemy of state.enemies) if (!enemy.dead) drawEnemy(enemy);
    drawBoss();
    for (const pickup of state.pickups) drawPickup(pickup);
    for (const particle of state.particles) {
      context.save();
      context.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
      context.restore();
    }
    if (state.screen !== 'setup') drawPlayer();
    drawBomb();
    drawToast();
  }

  function pointerToCanvas(clientX, clientY, pointerType = 'mouse') {
    const bounds = canvas.getBoundingClientRect();
    // Offset in displayed CSS pixels so fullscreen and smaller screens feel alike.
    const offsetY = pointerType === 'touch' ? TOUCH_OFFSET_PX : 0;
    return {
      x: clamp(((clientX - bounds.left) / bounds.width) * WIDTH, 32, WIDTH - 32),
      y: clamp(((clientY - bounds.top - offsetY) / bounds.height) * HEIGHT, PLAYER_FORWARD_Y, PLAYER_REAR_Y)
    };
  }

  function startPointer(event) {
    if (state.screen !== 'playing') return;
    event.preventDefault();
    state.pointerActive = true;
    state.pointerId = event.pointerId;
    const target = pointerToCanvas(event.clientX, event.clientY, event.pointerType);
    state.pointerTargetX = target.x;
    state.pointerTargetY = target.y;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function movePointer(event) {
    if (!state.pointerActive || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const target = pointerToCanvas(event.clientX, event.clientY, event.pointerType);
    state.pointerTargetX = target.x;
    state.pointerTargetY = target.y;
  }

  function endPointer(event) {
    if (state.pointerId !== event.pointerId) return;
    event.preventDefault();
    state.pointerActive = false;
    state.pointerId = null;
  }

  function handleKey(event, pressed) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd', ' ', 'x', 'p', 'escape'].includes(key)) event.preventDefault();
    if (key === 'arrowleft' || key === 'a') state.keys.left = pressed;
    if (key === 'arrowright' || key === 'd') state.keys.right = pressed;
    if (key === 'arrowup' || key === 'w') state.keys.up = pressed;
    if (key === 'arrowdown' || key === 's') state.keys.down = pressed;
    if (!pressed || event.repeat) return;
    if (key === ' ' || key === 'x') useBomb();
    if (key === 'p' || key === 'escape') togglePause();
  }

  function loop(now) {
    const delta = Math.min(.05, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  function initializeStars() {
    state.stars.length = 0;
    for (let index = 0; index < 110; index += 1) {
      state.stars.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, size: Math.random() < .16 ? 2 : 1, speed: 20 + Math.random() * 95, alpha: .25 + Math.random() * .7, color: Math.random() < .25 ? '#c5a7ff' : '#f4f8ff' });
    }
  }

  startRunButton.addEventListener('click', () => startRun(0, 'run'));
  practiceButton.addEventListener('click', () => startRun(state.selectedStage, 'practice'));
  nextStageButton.addEventListener('click', handleStageButton);
  restartButton.addEventListener('click', () => {
    if (state.runMode === 'practice') startRun(state.stageIndex, 'practice');
    else startRun(0, 'run');
  });
  setupButton.addEventListener('click', showSetup);
  resumeButton.addEventListener('click', togglePause);
  pauseButton.addEventListener('click', togglePause);
  bombButton.addEventListener('click', useBomb);
  soundButton.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    saveSettings();
    if (state.soundEnabled) playTone('pickup');
    updateHud();
  });
  canvas.addEventListener('pointerdown', startPointer, { passive: false });
  canvas.addEventListener('pointermove', movePointer, { passive: false });
  canvas.addEventListener('pointerup', endPointer, { passive: false });
  canvas.addEventListener('pointercancel', endPointer, { passive: false });
  window.addEventListener('keydown', (event) => handleKey(event, true));
  window.addEventListener('keyup', (event) => handleKey(event, false));

  initializeStars();
  renderStageButtons();
  updateHud();
  startRunButton.disabled = true;
  startRunButton.textContent = 'LOADING…';
  practiceButton.disabled = true;
  // Image readiness gates the start button; audio continues preloading in the background.
  // This keeps low-end mobile devices from waiting on multi-second WAV decoding.
  preloadWeaponSamples();
  skins.ready.then(() => { assetsReady = true; startRunButton.disabled = false; startRunButton.textContent = 'PLAY ALL STAGES'; renderStageButtons(); updateHud(); });
  document.addEventListener('visibilitychange', () => {
    state.lastTime = performance.now();
    state.keys.left = state.keys.right = state.keys.up = state.keys.down = false;
    state.pointerActive = false;
  });
  requestAnimationFrame(loop);
})();
