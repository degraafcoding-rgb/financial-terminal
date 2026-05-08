import { API, setStatus } from './app.js';

let currentCategory = 'general';
let refreshTimer    = null;

export function initNews() {
  // Category buttons
  document.querySelectorAll('.news-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.news-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      loadNews();
    });
  });

  // Ticker-specific news
  document.getElementById('news-ticker-btn').addEventListener('click', () => {
    const ticker = document.getElementById('news-ticker-input').value.trim().toUpperCase();
    if (ticker) loadTickerNews(ticker);
  });
  document.getElementById('news-ticker-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const ticker = e.target.value.trim().toUpperCase();
      if (ticker) loadTickerNews(ticker);
    }
  });

  // Clear filter
  document.getElementById('news-clear-btn').addEventListener('click', () => {
    document.getElementById('news-ticker-input').value = '';
    loadNews();
  });

  // Initial load + auto-refresh every 2 minutes
  loadNews();
  refreshTimer = setInterval(loadNews, 2 * 60 * 1000);
}

async function loadNews() {
  showLoading(true);
  setStatus('LOADING NEWS…');
  try {
    const data = await fetch(`${API}/news?category=${currentCategory}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    renderArticles(data);
    setStatus(`NEWS FEED — ${data.length} ARTICLES`);
  } catch (err) {
    showLoading(false);
    document.getElementById('news-error').hidden = false;
    document.getElementById('news-error-msg').textContent = err.message;
    setStatus('NEWS ERROR');
  }
}

async function loadTickerNews(ticker) {
  showLoading(true);
  setStatus(`LOADING ${ticker} NEWS…`);
  try {
    const data = await fetch(`${API}/news/${ticker}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    renderArticles(data);
    setStatus(`${ticker} NEWS — ${data.length} ARTICLES`);
  } catch (err) {
    showLoading(false);
    document.getElementById('news-error').hidden = false;
    document.getElementById('news-error-msg').textContent = err.message;
  }
}

function showLoading(on) {
  document.getElementById('news-loading').hidden = !on;
  document.getElementById('news-list').hidden    = on;
  document.getElementById('news-error').hidden   = true;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'JUST NOW';
  if (mins < 60)  return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}H AGO`;
  return `${Math.floor(hrs/24)}D AGO`;
}

function renderArticles(articles) {
  const list = document.getElementById('news-list');

  if (!articles || articles.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-state__icon">◉</span><p>NO ARTICLES FOUND.</p></div>`;
    showLoading(false);
    return;
  }

  list.innerHTML = articles.map((a, i) =>
    `<article class="news-article" id="news-item-${i}" role="button" tabindex="0">
      <div class="news-article__meta">
        <span class="news-article__source">${(a.source || 'UNKNOWN').toUpperCase()}</span>
        <span>·</span>
        <span>${timeAgo(a.published)}</span>
        <span>·</span>
        <span>${a.category?.toUpperCase() || 'GENERAL'}</span>
      </div>
      <p class="news-article__headline">${escHtml(a.headline || '')}</p>
      ${a.summary ? `<p class="news-article__summary">${escHtml(a.summary)}</p>` : ''}
      ${a.url ? `<a class="news-article__link" href="${a.url}" target="_blank" rel="noopener">READ FULL ARTICLE →</a>` : ''}
    </article>`
  ).join('');

  // Expand/collapse on click
  list.querySelectorAll('.news-article').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.tagName === 'A') return;
      el.classList.toggle('expanded');
    });
  });

  showLoading(false);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
