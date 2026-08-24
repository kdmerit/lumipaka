const body = document.body;
const app = document.querySelector('#app');
const page = body.dataset.page;
const catalogUrl = body.dataset.catalogUrl;
const gameSlug = body.dataset.gameSlug;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function resolveFromCatalog(relativePath) {
  return new URL(relativePath, new URL(catalogUrl, window.location.href)).href;
}

function adSlot(label = '광고 영역') {
  return `<div class="ad-slot" aria-label="${escapeHtml(label)}"><span>${escapeHtml(label)}</span></div>`;
}

function listMarkup(items, fallback) {
  const values = Array.isArray(items) && items.length ? items : [fallback];
  return values.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function gameGuide(game) {
  return `
    <section class="game-guide" aria-labelledby="game-guide-title">
      <div class="guide-card guide-intro">
        <div class="eyebrow">PLAY GUIDE</div>
        <h2 id="game-guide-title">게임 플레이 가이드</h2>
        <p>${escapeHtml(game.howToPlay || '화면의 안내에 따라 게임을 플레이하세요.')}</p>
      </div>
      <div class="guide-grid">
        <article class="guide-card">
          <div class="eyebrow">RULES</div>
          <h3>게임 규칙</h3>
          <ul>${listMarkup(game.rules, '게임 화면의 안내에 따라 플레이하세요.')}</ul>
        </article>
        <article class="guide-card">
          <div class="eyebrow">TIPS</div>
          <h3>플레이 팁</h3>
          <ul>${listMarkup(game.tips, '게임의 움직임을 먼저 익혀보세요.')}</ul>
        </article>
      </div>
      <p class="game-credit">${escapeHtml(game.credits || 'LUMIPAKA 오리지널 HTML5 게임')}</p>
    </section>
  `;
}

function gameCard(game) {
  const thumbnail = resolveFromCatalog(game.thumbnail);
  return `
    <article class="game-card">
      <a class="game-card-image" href="games/${encodeURIComponent(game.slug)}/">
        <img src="${thumbnail}" alt="${escapeHtml(game.title)} 썸네일" loading="lazy" />
        <span class="play-chip">PLAY</span>
      </a>
      <div class="game-card-body">
        <div class="eyebrow">${escapeHtml(game.category || 'HTML5 GAME')}</div>
        <h2><a href="games/${encodeURIComponent(game.slug)}/">${escapeHtml(game.title)}</a></h2>
        <p>${escapeHtml(game.description)}</p>
        <a class="text-link" href="games/${encodeURIComponent(game.slug)}/">게임 정보 보기 <span aria-hidden="true">→</span></a>
      </div>
    </article>
  `;
}

function renderHome(catalog) {
  const games = catalog.games || [];
  app.innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">WELCOME TO LUMIPAKA</div>
        <h1>잠깐의 틈을<br /><em>플레이 타임</em>으로.</h1>
        <p>설치 없이 브라우저에서 바로 시작하는 짧고 선명한 게임들.</p>
      </div>
      <div class="hero-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
    </section>
    ${adSlot('상단 배너 광고 슬롯')}
    <section class="section-heading">
      <div>
        <div class="eyebrow">CURATED GAMES</div>
        <h2>오늘의 게임</h2>
      </div>
      <span class="game-count">${games.length} GAMES</span>
    </section>
    ${games.length ? `<section class="game-grid">${games.map(gameCard).join('')}</section>` : '<div class="empty-card">아직 공개된 게임이 없습니다.</div>'}
  `;
}

function renderDetail(catalog, game) {
  const thumbnail = resolveFromCatalog(game.thumbnail);
  app.innerHTML = `
    <div class="breadcrumb"><a href="../../">전체 게임</a><span>/</span><span>${escapeHtml(game.title)}</span></div>
    <section class="detail-card">
      <div class="detail-art"><img src="${thumbnail}" alt="${escapeHtml(game.title)} 썸네일" /></div>
      <div class="detail-copy">
        <div class="eyebrow">${escapeHtml(game.category || 'HTML5 GAME')}</div>
        <h1>${escapeHtml(game.title)}</h1>
        <p class="lead">${escapeHtml(game.description)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(game.orientation || 'auto')}</span>
          <span class="tag">브라우저 실행</span>
          <span class="tag">짧은 플레이</span>
        </div>
        <a class="primary-button" href="play/">게임 시작 <span aria-hidden="true">→</span></a>
      </div>
    </section>
    <section class="info-grid">
      <div class="info-card"><span class="eyebrow">HOW TO PLAY</span><h2>조작 방법</h2><p>${escapeHtml(game.controls || '화면의 안내에 따라 조작하세요.')}</p></div>
      <div class="info-card"><span class="eyebrow">ABOUT</span><h2>게임 정보</h2><p>이 게임은 별도 설치 없이 모바일과 PC 브라우저에서 플레이할 수 있습니다.</p></div>
    </section>
    ${gameGuide(game)}
    ${adSlot('상세 페이지 배너 광고 슬롯')}
  `;
}

function renderPlay(game) {
  const gameUrl = resolveFromCatalog(game.gameUrl);
  const orientation = game.orientation || 'auto';
  app.innerHTML = `
    <div class="play-toolbar">
      <a class="back-link" href="../"><span aria-hidden="true">←</span> ${escapeHtml(game.title)} 정보</a>
      <div class="play-actions">
        <span class="orientation-label">${escapeHtml(orientation)}</span>
        <button class="ghost-button" type="button" id="fullscreen-button">전체화면</button>
      </div>
    </div>
    ${adSlot('플레이 화면 배너 광고 슬롯')}
    <section class="game-stage ${orientation}">
      <iframe
        id="game-frame"
        title="${escapeHtml(game.title)} 플레이 화면"
        src="${gameUrl}"
        allow="fullscreen; autoplay; gamepad"
        allowfullscreen
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
      ></iframe>
    </section>
    <p class="play-note">게임 화면을 눌러 시작하세요. 브라우저 전체화면을 사용할 수 있습니다.</p>
  `;

  const frame = document.querySelector('#game-frame');
  const fullscreenButton = document.querySelector('#fullscreen-button');
  const applyFrameHeight = (value) => {
    const height = Number(value);
    if (!Number.isFinite(height) || height < 120 || height > 1600) return;
    frame.style.height = `${Math.ceil(height)}px`;
  };

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    const message = event.data;
    if (message?.source !== 'lumipaka-game' || message.event !== 'frame-resize') return;
    applyFrameHeight(message.payload?.height);
  });

  frame.addEventListener('load', () => {
    try {
      const root = frame.contentDocument?.querySelector('[data-lumipaka-size-root], .game-shell');
      if (root) applyFrameHeight(Math.max(root.getBoundingClientRect().height, root.scrollHeight));
    } catch {
      // Cross-origin games use the postMessage bridge instead.
    }
  });

  fullscreenButton.addEventListener('click', () => {
    if (frame.requestFullscreen) {
      frame.requestFullscreen();
    }
  });
}

function renderError(message) {
  const homeUrl = page === 'home' ? './' : (page === 'play' ? '../../../' : '../../');
  app.innerHTML = `<div class="error-card"><div class="eyebrow">SOMETHING WENT WRONG</div><h1>게임을 불러오지 못했습니다.</h1><p>${escapeHtml(message)}</p><a class="primary-button" href="${homeUrl}">홈으로 돌아가기</a></div>`;
}

async function loadCatalog() {
  const response = await fetch(catalogUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`게임 목록을 불러오지 못했습니다. (${response.status})`);
  }
  return response.json();
}

if (page !== 'static') {
  loadCatalog()
    .then((catalog) => {
      if (page === 'home') {
        renderHome(catalog);
        return;
      }

      const game = (catalog.games || []).find((item) => item.slug === gameSlug);
      if (!game) {
        renderError('존재하지 않거나 공개되지 않은 게임입니다.');
        return;
      }

      if (page === 'detail') {
        renderDetail(catalog, game);
      } else if (page === 'play') {
        renderPlay(game);
      } else {
        renderError('알 수 없는 페이지입니다.');
      }
    })
    .catch((error) => renderError(error.message));
}
