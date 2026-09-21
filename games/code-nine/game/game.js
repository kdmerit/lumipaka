(() => {
  'use strict';

  const RECORDS_KEY = 'code-nine-records-v1';
  const SOUND_STORAGE_KEY = 'code-nine-sound';
  const SOUND_URL = './audio/01-click-shimmer.wav';
  const BLITZ_TIME_MS = 100000;
  const MODES = Object.freeze({
    classic: Object.freeze({
      key: 'classic',
      label: 'CLASSIC',
      digits: 3,
      maxAttempts: 10,
      timeLimitMs: null,
      summary: '3자리 코드를 10번 안에 해독하세요. 가장 적은 시도가 최고의 기록이 됩니다.'
    }),
    blitz: Object.freeze({
      key: 'blitz',
      label: 'BLITZ',
      digits: 3,
      maxAttempts: null,
      timeLimitMs: BLITZ_TIME_MS,
      summary: '100초 안에 3자리 코드를 해독하세요. 시도 횟수는 제한하지 않습니다.'
    }),
    hard: Object.freeze({
      key: 'hard',
      label: 'HARD',
      digits: 4,
      maxAttempts: 10,
      timeLimitMs: null,
      summary: '4자리 코드와 10번의 기회로 더 촘촘한 단서를 읽어내세요.'
    })
  });

  const $ = (selector) => document.querySelector(selector);
  const gameShell = $('.game-shell');
  const menuScreen = $('#menu-screen');
  const playScreen = $('#play-screen');
  const pauseOverlay = $('#pause-overlay');
  const resultOverlay = $('#result-overlay');
  const modeSummary = $('#mode-summary');
  const startButton = $('#start-button');
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const playModeLabel = $('#play-mode-label');
  const attemptStatus = $('#attempt-status');
  const attemptStatusCard = $('#attempt-status-card');
  const timerCard = $('#timer-card');
  const timerStatus = $('#timer-status');
  const guessDisplay = $('#guess-display');
  const feedback = $('#feedback');
  const digitButtons = [...document.querySelectorAll('[data-digit]')];
  const actionButtons = [...document.querySelectorAll('[data-action]')];
  const soundButton = $('#sound-button');
  const historyCount = $('#history-count');
  const historyEmpty = $('#history-empty');
  const historyTableWrap = $('#history-table-wrap');
  const historyBody = $('#history-body');
  const pauseButton = $('#pause-button');
  const resumeButton = $('#resume-button');
  const pauseExitButton = $('#pause-exit-button');
  const pauseCopy = $('#pause-copy');
  const resultEyebrow = $('#result-eyebrow');
  const resultTitle = $('#result-title');
  const resultSecret = $('#result-secret');
  const resultCopy = $('#result-copy');
  const resultStats = $('#result-stats');
  const recordCopy = $('#record-copy');
  const againButton = $('#again-button');
  const menuButton = $('#menu-button');

  const audio = {
    context: null,
    rawData: null,
    buffer: null,
    loading: null,
    decoding: null,
    outputWarmed: false,
    activeSources: new Set()
  };

  const state = {
    selectedMode: 'classic',
    mode: null,
    screen: 'menu',
    secret: [],
    currentGuess: [],
    history: [],
    attempts: 0,
    startedAt: 0,
    elapsedMs: 0,
    remainingMs: null,
    frameId: null,
    result: null,
    soundEnabled: readSoundPreference(),
    records: readRecords()
  };

  function defaultRecords() {
    return {
      classic: { wins: 0, bestAttempts: null, bestDurationMs: null },
      blitz: { wins: 0, bestElapsedMs: null, bestAttempts: null },
      hard: { wins: 0, bestAttempts: null, bestDurationMs: null }
    };
  }

  function readRecords() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RECORDS_KEY) || 'null');
      const defaults = defaultRecords();
      if (!parsed || typeof parsed !== 'object') return defaults;
      return {
        classic: normalizeRecord(parsed.classic, defaults.classic),
        blitz: normalizeRecord(parsed.blitz, defaults.blitz),
        hard: normalizeRecord(parsed.hard, defaults.hard)
      };
    } catch {
      return defaultRecords();
    }
  }

  function normalizeRecord(value, fallback) {
    if (!value || typeof value !== 'object') return { ...fallback };
    const record = { ...fallback };
    if (Number.isInteger(value.wins) && value.wins >= 0) record.wins = value.wins;
    for (const key of ['bestAttempts', 'bestDurationMs', 'bestElapsedMs']) {
      if (Number.isFinite(value[key]) && value[key] >= 0) record[key] = value[key];
    }
    return record;
  }

  function saveRecords() {
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(state.records));
    } catch {
      // Keep the current session playable when storage is unavailable.
    }
  }

  function readSoundPreference() {
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  function getAudioContext() {
    if (audio.context) return audio.context;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    try {
      audio.context = new AudioContextConstructor({ latencyHint: 'interactive' });
    } catch {
      try { audio.context = new AudioContextConstructor(); } catch { return null; }
    }
    return audio.context;
  }

  function decodeClickSound() {
    const context = audio.context;
    if (!context || !audio.rawData || audio.buffer || audio.decoding) return;

    audio.decoding = context.decodeAudioData(audio.rawData.slice(0))
      .then((decoded) => {
        audio.buffer = decoded;
        warmAudioOutput();
      })
      .catch(() => {
        audio.buffer = null;
      })
      .finally(() => {
        audio.decoding = null;
      });
  }

  function loadClickSound() {
    if (audio.rawData || audio.loading) return;

    audio.loading = fetch(SOUND_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load CODE NINE click sound.');
        return response.arrayBuffer();
      })
      .then((rawData) => {
        audio.rawData = rawData;
      })
      .catch(() => {
        audio.rawData = null;
      })
      .finally(() => {
        audio.loading = null;
        decodeClickSound();
      });
  }

  function warmAudioOutput() {
    const context = audio.context;
    if (!state.soundEnabled || audio.outputWarmed || !context || !audio.buffer || context.state !== 'running') return;

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = audio.buffer;
      gain.gain.value = 0;
      source.connect(gain).connect(context.destination);
      source.start();
      source.stop(context.currentTime + 0.01);
      audio.outputWarmed = true;
    } catch {
      // The silent warm-up is optional and must not affect the game.
    }
  }

  function activateAudio() {
    if (!state.soundEnabled) return;

    try {
      const context = getAudioContext();
      if (!context) return;

      const prepareAudio = () => {
        decodeClickSound();
        warmAudioOutput();
      };

      loadClickSound();
      if (context.state === 'running') prepareAudio();
      else context.resume().then(prepareAudio).catch(() => {});
    } catch {
      // Sound must never prevent play when Web Audio is unavailable.
    }
  }

  function stopAudio() {
    for (const source of audio.activeSources) {
      try { source.stop(); } catch { /* The source may already have ended. */ }
    }
    audio.activeSources.clear();
  }

  function startBufferSource(context, buffer) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.42;
    source.connect(gain).connect(context.destination);
    audio.activeSources.add(source);
    source.addEventListener('ended', () => audio.activeSources.delete(source), { once: true });
    try { source.start(context.currentTime); } catch { audio.activeSources.delete(source); }
  }

  function playImmediateFallback(context) {
    const start = () => {
      if (!state.soundEnabled) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(2800, now);
      oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.00025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      oscillator.connect(gain).connect(context.destination);
      audio.activeSources.add(oscillator);
      oscillator.addEventListener('ended', () => audio.activeSources.delete(oscillator), { once: true });
      try {
        oscillator.start(now);
        oscillator.stop(now + 0.06);
      } catch { audio.activeSources.delete(oscillator); }
    };
    // Schedule the source before resuming. Waiting on resume() here adds an
    // audible gap on mobile browsers during the first interaction.
    start();
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function playDigitSound() {
    if (!state.soundEnabled) return;
    const context = getAudioContext();
    if (!context) return;
    decodeClickSound();
    if (audio.buffer && context.state === 'running') {
      startBufferSource(context, audio.buffer);
      return;
    }
    // Never wait for a network/decode promise on the input path.
    playImmediateFallback(context);
    loadClickSound();
  }

  function updateSoundButton() {
    soundButton.textContent = state.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(state.soundEnabled));
    soundButton.setAttribute('aria-label', state.soundEnabled ? '게임 사운드 끄기' : '게임 사운드 켜기');
  }

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    try { window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* Keep the session playable. */ }
    updateSoundButton();
    if (enabled) activateAudio();
    else {
      stopAudio();
      audio.outputWarmed = false;
    }
  }

  function getModeConfig() {
    return MODES[state.mode || state.selectedMode];
  }

  function randomInt(maximum) {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % maximum;
    }
    return Math.floor(Math.random() * maximum);
  }

  function generateSecret(length) {
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let index = digits.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [digits[index], digits[swapIndex]] = [digits[swapIndex], digits[index]];
    }
    return digits.slice(0, length);
  }

  function evaluateGuess(secret, guess) {
    let strikes = 0;
    for (let index = 0; index < secret.length; index += 1) {
      if (secret[index] === guess[index]) strikes += 1;
    }

    const secretDigits = new Set(secret);
    const balls = guess.reduce((count, digit, index) => {
      return count + (digit !== secret[index] && secretDigits.has(digit) ? 1 : 0);
    }, 0);

    return { strikes, balls };
  }

  function resultLabel(result, digits) {
    if (result.strikes === digits) return `${result.strikes} STRIKE`;
    if (result.strikes === 0 && result.balls === 0) return 'OUT';
    return `${result.strikes}S ${result.balls}B`;
  }

  function formatDuration(durationMs) {
    return `${(Math.max(0, durationMs) / 1000).toFixed(1)}s`;
  }

  function formatTimer(remainingMs) {
    return (Math.max(0, remainingMs) / 1000).toFixed(1);
  }

  function codeText(code) {
    return code.join('');
  }

  function emitAnalytics(name, params = {}) {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: 'lumipaka-game',
      event: 'analytics-event',
      payload: { name, params }
    }, '*');
  }

  function analyticsParams(result, score) {
    const config = getModeConfig();
    return {
      mode: config.key,
      digits: config.digits,
      attempts: state.attempts,
      duration_seconds: Number((state.elapsedMs / 1000).toFixed(1)),
      remaining_seconds: config.timeLimitMs === null ? 0 : Number((state.remainingMs / 1000).toFixed(1)),
      result,
      score
    };
  }

  function stopFrame() {
    if (state.frameId !== null) {
      window.cancelAnimationFrame(state.frameId);
      state.frameId = null;
    }
  }

  function renderModeSelection() {
    const config = MODES[state.selectedMode];
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === state.selectedMode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    modeSummary.textContent = config.summary;
  }

  function renderGuessDisplay() {
    const config = getModeConfig();
    guessDisplay.style.gridTemplateColumns = `repeat(${config.digits}, minmax(0, 1fr))`;
    guessDisplay.replaceChildren();
    for (let index = 0; index < config.digits; index += 1) {
      const slot = document.createElement('span');
      slot.className = 'guess-slot';
      if (state.currentGuess[index] !== undefined) {
        slot.classList.add('is-filled');
        slot.textContent = String(state.currentGuess[index]);
      } else {
        slot.textContent = '·';
      }
      guessDisplay.append(slot);
    }
    guessDisplay.setAttribute('aria-label', `현재 입력 코드 ${state.currentGuess.join(' ') || '없음'}`);
  }

  function renderKeypad() {
    const playing = state.screen === 'playing';
    const config = getModeConfig();
    digitButtons.forEach((button) => {
      const digit = Number(button.dataset.digit);
      button.disabled = !playing || state.currentGuess.length >= config.digits || state.currentGuess.includes(digit);
    });
    actionButtons.forEach((button) => {
      const action = button.dataset.action;
      button.disabled = !playing || (action === 'submit' && state.currentGuess.length !== config.digits);
    });
  }

  function renderHistory() {
    historyCount.textContent = String(state.history.length);
    historyEmpty.hidden = state.history.length > 0;
    historyTableWrap.hidden = state.history.length === 0;
    historyBody.replaceChildren();
    state.history.forEach((entry, index) => {
      const row = document.createElement('tr');
      if (entry.result.strikes === getModeConfig().digits) row.classList.add('is-win');
      if (entry.result.strikes === 0 && entry.result.balls === 0) row.classList.add('is-out');
      const numberCell = document.createElement('td');
      numberCell.textContent = String(index + 1).padStart(2, '0');
      const codeCell = document.createElement('td');
      codeCell.textContent = codeText(entry.guess);
      const resultCell = document.createElement('td');
      resultCell.textContent = resultLabel(entry.result, getModeConfig().digits);
      row.append(numberCell, codeCell, resultCell);
      historyBody.append(row);
    });
  }

  function renderHud() {
    const config = getModeConfig();
    playModeLabel.textContent = config.label;
    if (config.maxAttempts === null) {
      attemptStatus.textContent = String(state.attempts);
      attemptStatusCard.querySelector('.status-label').textContent = 'GUESSES';
    } else {
      attemptStatus.textContent = `${state.attempts} / ${config.maxAttempts}`;
      attemptStatusCard.querySelector('.status-label').textContent = 'GUESSES';
    }
    timerCard.hidden = config.timeLimitMs === null;
    if (config.timeLimitMs !== null) {
      timerStatus.textContent = formatTimer(state.remainingMs ?? config.timeLimitMs);
      timerCard.classList.toggle('is-warning', (state.remainingMs ?? config.timeLimitMs) <= 10000);
    }
  }

  function renderPlayingState() {
    renderHud();
    renderGuessDisplay();
    renderKeypad();
    renderHistory();
  }

  function setFeedback(message, type = '') {
    feedback.textContent = message;
    feedback.className = `feedback${type ? ` is-${type}` : ''}`;
  }

  function updateClock(now = performance.now()) {
    if (state.screen !== 'playing') return false;
    state.elapsedMs = Math.max(0, now - state.startedAt);
    const config = getModeConfig();
    if (config.timeLimitMs === null) return true;
    state.remainingMs = Math.max(0, config.timeLimitMs - state.elapsedMs);
    if (state.remainingMs <= 0) {
      finishRound('timeout');
      return false;
    }
    renderHud();
    return true;
  }

  function gameLoop(now) {
    if (state.screen !== 'playing') return;
    if (!updateClock(now)) return;
    state.frameId = window.requestAnimationFrame(gameLoop);
  }

  function startGame() {
    stopFrame();
    stopAudio();
    activateAudio();
    const config = MODES[state.selectedMode];
    state.mode = config.key;
    state.screen = 'playing';
    state.secret = generateSecret(config.digits);
    state.currentGuess = [];
    state.history = [];
    state.attempts = 0;
    state.startedAt = performance.now();
    state.elapsedMs = 0;
    state.remainingMs = config.timeLimitMs;
    state.result = null;

    menuScreen.hidden = true;
    playScreen.hidden = false;
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    setFeedback('숫자판에서 첫 번째 추측을 입력하세요.');
    emitAnalytics('lumipaka_game_start', { mode: config.key, digits: config.digits });
    renderPlayingState();
    if (config.timeLimitMs !== null) state.frameId = window.requestAnimationFrame(gameLoop);
  }

  function refreshBeforeInput() {
    if (state.screen !== 'playing') return false;
    return updateClock(performance.now());
  }

  function addDigit(digit) {
    if (!refreshBeforeInput()) return;
    const config = getModeConfig();
    if (state.currentGuess.length >= config.digits) return;
    if (state.currentGuess.includes(digit)) {
      setFeedback('같은 숫자를 한 코드에서 두 번 사용할 수 없습니다.', 'error');
      return;
    }
    state.currentGuess.push(digit);
    playDigitSound();
    setFeedback('입력이 준비되면 ENTER를 누르세요.');
    renderPlayingState();
  }

  function clearGuess() {
    if (!refreshBeforeInput()) return;
    state.currentGuess = [];
    setFeedback('현재 입력을 지웠습니다.');
    renderPlayingState();
  }

  function backspaceGuess() {
    if (!refreshBeforeInput()) return;
    state.currentGuess.pop();
    setFeedback('마지막 숫자를 지웠습니다.');
    renderPlayingState();
  }

  function submitGuess() {
    if (!refreshBeforeInput()) return;
    const config = getModeConfig();
    if (state.currentGuess.length !== config.digits) {
      setFeedback(`${config.digits}자리 숫자를 모두 입력하세요.`, 'error');
      return;
    }

    const guess = [...state.currentGuess];
    const result = evaluateGuess(state.secret, guess);
    state.attempts += 1;
    state.history.push({ guess, result });
    state.currentGuess = [];

    if (result.strikes === config.digits) {
      finishRound('win');
      return;
    }
    if (config.maxAttempts !== null && state.attempts >= config.maxAttempts) {
      finishRound('loss');
      return;
    }

    const label = resultLabel(result, config.digits);
    setFeedback(`${label} · 다음 단서를 조합하세요.`, label === 'OUT' ? 'error' : 'success');
    renderPlayingState();
  }

  function calculateScore(outcome) {
    if (outcome !== 'win') return 0;
    const config = getModeConfig();
    if (config.key === 'blitz') return Math.max(0, Math.floor(state.remainingMs / 100));
    return Math.max(0, 1000 - Math.max(0, state.attempts - 1) * 100);
  }

  function updateRecord() {
    if (state.result !== 'win') return false;
    const config = getModeConfig();
    const record = state.records[config.key];
    record.wins += 1;
    let isNew = false;
    if (config.key === 'blitz') {
      isNew = record.bestElapsedMs === null
        || state.elapsedMs < record.bestElapsedMs
        || (state.elapsedMs === record.bestElapsedMs && state.attempts < record.bestAttempts);
      if (isNew) {
        record.bestElapsedMs = Math.round(state.elapsedMs);
        record.bestAttempts = state.attempts;
      }
    } else {
      isNew = record.bestAttempts === null
        || state.attempts < record.bestAttempts
        || (state.attempts === record.bestAttempts && state.elapsedMs < record.bestDurationMs);
      if (isNew) {
        record.bestAttempts = state.attempts;
        record.bestDurationMs = Math.round(state.elapsedMs);
      }
    }
    saveRecords();
    return isNew;
  }

  function recordText() {
    const config = getModeConfig();
    const record = state.records[config.key];
    if (record.wins === 0) return '아직 이 모드의 기록이 없습니다.';
    if (config.key === 'blitz') return `BEST ${formatDuration(record.bestElapsedMs)} · ${record.bestAttempts} GUESSES`;
    return `BEST ${record.bestAttempts} GUESSES · ${formatDuration(record.bestDurationMs)}`;
  }

  function renderResult(outcome, isNewRecord) {
    const config = getModeConfig();
    const score = calculateScore(outcome);
    const titles = {
      win: ['CODE CRACKED', 'YOU WIN', '정답을 찾아냈습니다.'],
      loss: ['NO MORE GUESSES', 'ROUND OVER', '모든 시도를 사용했습니다.'],
      timeout: ['TIME EXPIRED', 'TIME OUT', '시간 안에 코드를 해독하지 못했습니다.'],
      abandoned: ['ROUND ENDED', 'EXITED', '이번 라운드를 종료했습니다.']
    };
    const [eyebrow, title, copy] = titles[outcome];
    resultEyebrow.textContent = eyebrow;
    resultTitle.textContent = title;
    resultSecret.textContent = codeText(state.secret);
    resultCopy.textContent = copy;
    resultStats.replaceChildren();
    const stats = [
      ['GUESSES', String(state.attempts)],
      ['TIME', formatDuration(state.elapsedMs)]
    ];
    if (config.key === 'blitz') stats.push(['SCORE', String(score)]);
    stats.forEach(([label, value]) => {
      const item = document.createElement('span');
      item.textContent = `${label} ${value}`;
      resultStats.append(item);
    });
    recordCopy.textContent = outcome === 'win' && isNewRecord ? 'NEW PERSONAL RECORD' : recordText();
    pauseOverlay.hidden = true;
    resultOverlay.hidden = false;
  }

  function finishRound(outcome) {
    if (!['playing', 'paused'].includes(state.screen)) return;
    const config = getModeConfig();
    if (state.screen === 'playing') state.elapsedMs = Math.max(0, performance.now() - state.startedAt);
    if (config.timeLimitMs !== null) {
      state.remainingMs = Math.max(0, config.timeLimitMs - state.elapsedMs);
    }
    state.result = outcome;
    state.screen = 'result';
    stopFrame();
    const score = calculateScore(outcome);
    const isNewRecord = updateRecord();
    emitAnalytics('post_score', analyticsParams(outcome, score));
    emitAnalytics('lumipaka_game_end', analyticsParams(outcome, score));
    renderPlayingState();
    renderResult(outcome, isNewRecord);
  }

  function pauseGame(reason = '') {
    if (state.screen !== 'playing') return;
    if (!updateClock(performance.now())) return;
    state.screen = 'paused';
    stopFrame();
    pauseCopy.textContent = reason || '잠시 쉬었다가 코드를 계속 해독하세요.';
    pauseOverlay.hidden = false;
    renderPlayingState();
  }

  function resumeGame() {
    if (state.screen !== 'paused') return;
    state.startedAt = performance.now() - state.elapsedMs;
    state.screen = 'playing';
    pauseOverlay.hidden = true;
    renderPlayingState();
    if (getModeConfig().timeLimitMs !== null) state.frameId = window.requestAnimationFrame(gameLoop);
  }

  function abandonRound() {
    if (!['playing', 'paused'].includes(state.screen)) return;
    if (state.screen === 'playing') state.elapsedMs = Math.max(0, performance.now() - state.startedAt);
    const score = 0;
    state.result = 'abandoned';
    state.screen = 'result';
    stopFrame();
    emitAnalytics('lumipaka_game_end', analyticsParams('abandoned', score));
    renderPlayingState();
    renderResult('abandoned', false);
  }

  function returnToMenu() {
    stopFrame();
    stopAudio();
    state.screen = 'menu';
    state.mode = null;
    state.currentGuess = [];
    state.history = [];
    state.result = null;
    menuScreen.hidden = false;
    playScreen.hidden = true;
    pauseOverlay.hidden = true;
    resultOverlay.hidden = true;
    renderModeSelection();
  }

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (state.screen !== 'menu') return;
      state.selectedMode = button.dataset.mode;
      renderModeSelection();
    });
  });

  digitButtons.forEach((button) => {
    button.addEventListener('click', () => addDigit(Number(button.dataset.digit)));
  });

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'clear') clearGuess();
      if (button.dataset.action === 'backspace') backspaceGuess();
      if (button.dataset.action === 'submit') submitGuess();
    });
  });

  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', () => pauseGame());
  soundButton.addEventListener('click', () => setSoundEnabled(!state.soundEnabled));
  resumeButton.addEventListener('click', resumeGame);
  pauseExitButton.addEventListener('click', abandonRound);
  againButton.addEventListener('click', startGame);
  menuButton.addEventListener('click', returnToMenu);

  window.addEventListener('keydown', (event) => {
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) addDigit(Number(event.key));
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (!event.repeat) backspaceGuess();
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      if (!event.repeat) clearGuess();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) submitGuess();
      return;
    }
    if (!event.repeat && (event.key.toLowerCase() === 'p' || event.key === 'Escape')) {
      event.preventDefault();
      if (state.screen === 'playing') pauseGame();
      else if (state.screen === 'paused') resumeGame();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'playing') pauseGame('탭을 다시 열면 RESUME을 눌러 계속하세요.');
  });

  window.addEventListener('blur', () => {
    if (state.screen === 'playing') pauseGame('창으로 돌아오면 RESUME을 눌러 계속하세요.');
  });

  for (const eventName of ['selectstart', 'dragstart', 'contextmenu']) {
    gameShell.addEventListener(eventName, (event) => event.preventDefault());
  }

  renderModeSelection();
  renderGuessDisplay();
  updateSoundButton();
  if (state.soundEnabled) loadClickSound();
})();
