(function () {
  const NS = 'mathewrean-portfolio';
  const ABACUS = 'https://abacus.jasoncameron.dev';
  const personKey = 'm47_reader';
  const COUNTER_TIMEOUT_MS = 3000;
  const useLocalCounters = ['localhost', '127.0.0.1'].includes(location.hostname);

  function base() {
    const m = window.location.pathname.match(/^(.*\/portfolio)(?:\/|$)/);
    return m ? m[1] : '';
  }

  function url(path) {
    const b = base();
    const p = String(path || '').replace(/^\/+/, '');
    return b ? `${b}/${p}` : p;
  }

  function readerId() {
    let id = localStorage.getItem(personKey);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
      localStorage.setItem(personKey, id);
    }
    return id;
  }

  function onceFlag(kind, slug) {
    return `m47_${kind}_${slug}`;
  }

  async function counter(op, name) {
    const safe = encodeURIComponent(name).slice(0, 80);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COUNTER_TIMEOUT_MS);
    try {
      const res = await fetch(`${ABACUS}/${op}/${NS}/${safe}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Counter request failed: ${res.status}`);
      const data = await res.json();
      return Number(data.value || 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  function localCount(name) {
    return Number(localStorage.getItem(`localcount_${name}`) || 0);
  }

  function localStats(slug) {
    return {
      views: localCount(`view-${slug}`),
      reacts: localCount(`react-${slug}`),
      stars: localCount(`star-${slug}`),
    };
  }

  async function readCount(name) {
    if (useLocalCounters) return localCount(name);
    try {
      return await counter('get', name);
    } catch {
      return localCount(name);
    }
  }

  async function bumpOnce(kind, slug) {
    const flag = onceFlag(kind, slug);
    if (localStorage.getItem(flag)) return readCount(`${kind}-${slug}`);
    localStorage.setItem(flag, readerId());
    const name = `${kind}-${slug}`;
    if (useLocalCounters) {
      const next = localCount(name) + 1;
      localStorage.setItem(`localcount_${name}`, String(next));
      return next;
    }
    try {
      return await counter('hit', name);
    } catch {
      const next = Number(localStorage.getItem(`localcount_${name}`) || 0) + 1;
      localStorage.setItem(`localcount_${name}`, String(next));
      return next;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderMarkdown(md) {
    const fences = [];
    const stashed = md.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, body) => {
      const i = fences.length;
      fences.push({ lang: (lang || 'text').toLowerCase(), body });
      return `\n\n@@FENCE${i}@@\n\n`;
    });
    let html = window.marked ? window.marked.parse(stashed) : `<pre>${escapeHtml(stashed)}</pre>`;
    html = html.replace(/@@FENCE(\d+)@@/g, (_, n) => terminal(fences[Number(n)]));
    html = html.replace(/<img([^>]+)src="(?!https?:|data:)([^"]+)"/g, (_, pre, src) => `<img${pre}src="${url(src)}"`);
    return html;
  }

  function terminal(block) {
    const lang = /^(bash|sh|shell|zsh|console|terminal|ps1|powershell)$/.test(block.lang)
      ? block.lang
      : block.lang || 'text';
    const text = block.body.replace(/\n$/, '');
    const b64 = btoa(unescape(encodeURIComponent(text)));
    return `<div class="term"><div class="term-bar"><i></i><i></i><i></i><span>${escapeHtml(lang)}</span><button class="copy" type="button" data-copy="${b64}">Copy</button></div><pre><code>${escapeHtml(text)}</code></pre></div>`;
  }

  function wireCopy(root) {
    root.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const raw = decodeURIComponent(escape(atob(btn.getAttribute('data-copy'))));
        try {
          await navigator.clipboard.writeText(raw);
          btn.textContent = 'Copied';
        } catch {
          btn.textContent = 'Select';
        }
      });
    });
  }

  async function loadCatalog() {
    const res = await fetch(url('data/writeups.json'));
    if (!res.ok) throw new Error('writeups.json');
    return res.json();
  }

  function shareLink(slug) {
    const path = url(`writeup.html?slug=${encodeURIComponent(slug)}`);
    return new URL(path, window.location.href).href;
  }

  function card(item, stats) {
    const cover = item.cover
      ? `<img class="badge" src="${url(item.cover)}" alt="" />`
      : '';
    return `<a class="writeup-card" href="${url('writeup.html')}?slug=${encodeURIComponent(item.slug)}">
      ${cover}
      <span class="chip">${escapeHtml(item.category)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="muted">${escapeHtml(item.excerpt || '')}</p>
      <div class="statline"><span>${stats.views} reads</span><span>${stats.reacts} reacts</span><span>${stats.stars} stars</span></div>
    </a>`;
  }

  async function statsFor(slug) {
    const [views, reacts, stars] = await Promise.all([
      readCount(`view-${slug}`),
      readCount(`react-${slug}`),
      readCount(`star-${slug}`),
    ]);
    return { views, reacts, stars };
  }

  async function mountIndex() {
    const grid = document.getElementById('writeupGrid');
    if (!grid || grid.dataset.ready === '1') {
      applyFilters();
      return;
    }
    const catalog = await loadCatalog();
    grid.dataset.ready = '1';
    window.__writeups = catalog;
    window.__writeupStats = Object.fromEntries(catalog.items.map((item) => [item.slug, localStats(item.slug)]));
    const cat = document.getElementById('writeupCategory');
    cat.innerHTML = ['All', ...catalog.categories].map((c) => `<option>${c}</option>`).join('');
    const composerCat = document.getElementById('cCategory');
    if (composerCat) composerCat.innerHTML = catalog.categories.map((c) => `<option>${c}</option>`).join('');
    document.getElementById('writeupSearch').addEventListener('input', applyFilters);
    cat.addEventListener('change', applyFilters);
    document.getElementById('writeupSort').addEventListener('change', applyFilters);
    const composer = document.getElementById('openComposer');
    if (composer && composer.tagName === 'BUTTON') {
      composer.addEventListener('click', () => document.getElementById('composerDialog').showModal());
    }
    document.getElementById('closeComposer').addEventListener('click', () => {
      document.getElementById('composerDialog').close();
    });
    document.getElementById('composerForm').addEventListener('submit', onCompose);
    document.getElementById('mailForm')?.addEventListener('submit', onMail);
    applyFilters();
    refreshStats().then(applyFilters).catch((error) => {
      console.error('[Writeups] Could not refresh counters:', error);
    });
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'writeups' || location.hash === '#writeups') {
      document.querySelector('.nav-link[data-view="writeups"]')?.click();
    }
  }

  async function refreshStats() {
    const items = window.__writeups.items;
    window.__writeupStats = Object.fromEntries(items.map((item) => [item.slug, localStats(item.slug)]));
    renderMostRead(items);
    const pairs = await Promise.all(items.map(async (item) => [item.slug, await statsFor(item.slug)]));
    window.__writeupStats = Object.fromEntries(pairs);
    renderMostRead(items);
  }

  function renderMostRead(items) {
    const stats = (slug) => window.__writeupStats?.[slug] || localStats(slug);
    const ranked = [...items].sort((a, b) => (stats(b.slug).views - stats(a.slug).views)).slice(0, 3);
    const box = document.getElementById('mostRead');
    if (box) {
      box.innerHTML = ranked.map((item) => {
        const s = stats(item.slug);
        return `<a href="${url('writeup.html')}?slug=${encodeURIComponent(item.slug)}"><strong>${escapeHtml(item.title)}</strong><div class="statline"><span>${s.views} reads</span></div></a>`;
      }).join('');
    }
  }

  function applyFilters() {
    const grid = document.getElementById('writeupGrid');
    if (!grid || !window.__writeups) return;
    const q = (document.getElementById('writeupSearch').value || '').toLowerCase();
    const category = document.getElementById('writeupCategory').value;
    const sort = document.getElementById('writeupSort').value;
    let items = window.__writeups.items.filter((item) => {
      if (category && category !== 'All' && item.category !== category) return false;
      const blob = `${item.title} ${(item.tags || []).join(' ')} ${item.excerpt || ''}`.toLowerCase();
      return !q || blob.includes(q);
    });
    const stats = (slug) => window.__writeupStats?.[slug] || localStats(slug);
    const stat = (slug, key) => stats(slug)[key];
    items.sort((a, b) => {
      if (sort === 'reads') return stat(b.slug, 'views') - stat(a.slug, 'views');
      if (sort === 'stars') return stat(b.slug, 'stars') - stat(a.slug, 'stars');
      if (sort === 'reacts') return stat(b.slug, 'reacts') - stat(a.slug, 'reacts');
      return String(b.date).localeCompare(String(a.date));
    });
    grid.innerHTML = items.map((item) => card(item, stats(item.slug))).join('')
      || '<p class="muted">No writeups in this filter yet.</p>';
  }

  function onCompose(event) {
    event.preventDefault();
    const title = document.getElementById('cTitle').value.trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
    const category = document.getElementById('cCategory').value;
    const tags = document.getElementById('cTags').value.split(',').map((t) => t.trim()).filter(Boolean);
    const excerpt = document.getElementById('cExcerpt').value.trim();
    const body = document.getElementById('cBody').value;
    const md = `---\ntitle: ${title}\ncategory: ${category}\n---\n\n${body}\n`;
    const entry = {
      slug,
      title,
      category,
      tags,
      difficulty: 'Notes',
      date: new Date().toISOString().slice(0, 10),
      excerpt,
      md_path: `content/writeups/${slug}.md`,
      reading_minutes: Math.max(2, Math.round(body.split(/\s+/).length / 180)),
    };
    const catalog = structuredClone(window.__writeups);
    catalog.items = catalog.items.filter((item) => item.slug !== slug);
    catalog.items.unshift(entry);
    download(`${slug}.md`, md);
    download('writeups.json', JSON.stringify(catalog, null, 2));
    alert('Downloaded the markdown and writeups.json. Put the markdown in content/writeups/ and replace data/writeups.json, then commit to GitHub.');
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onMail(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form._honey?.value) return;
    const payload = {
      name: form.name.value,
      email: form.email.value,
      message: form.message.value,
      _subject: 'Portfolio note',
      _template: 'table',
    };
    try {
      const res = await fetch('https://formsubmit.co/ajax/mathewrean@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('mail');
      form.reset();
      alert('Sent. If this is the first time, confirm the FormSubmit email.');
    } catch {
      window.location.href = `mailto:mathewrean@gmail.com?subject=${encodeURIComponent('Portfolio note')}&body=${encodeURIComponent(form.message.value)}`;
    }
  }

  async function mountArticle() {
    const root = document.getElementById('article');
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const catalog = await loadCatalog();
    const item = catalog.items.find((entry) => entry.slug === slug) || catalog.items[0];
    if (!item) {
      root.innerHTML = '<p>Writeup not found.</p>';
      return;
    }
    document.title = `${item.title} · Mathewrean`;
    const mdRes = await fetch(url(item.md_path));
    const raw = mdRes.ok ? await mdRes.text() : 'Writeup file missing.';
    const isHtml = /\.html?$/i.test(item.md_path);
    const bodyHtml = isHtml ? raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') : renderMarkdown(raw);
    const stats = localStats(item.slug);
    const reacted = localStorage.getItem(onceFlag('react', item.slug));
    const starred = localStorage.getItem(onceFlag('star', item.slug));
    const link = shareLink(item.slug);
    root.innerHTML = `
      <div class="article-nav">
        <a class="btn" href="${url('index.html')}?view=writeups">All writeups</a>
        <span class="chip">${escapeHtml(item.category)}</span>
      </div>
      <p class="muted">${escapeHtml(item.date || '')} · ${item.reading_minutes || 3} min</p>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(item.excerpt || '')}</p>
      <div class="article-body">${bodyHtml}</div>
      <div class="react-row">
        <button id="reactBtn" type="button" class="btn" aria-pressed="${reacted ? 'true' : 'false'}">React ${stats.reacts}</button>
        <button id="starBtn" type="button" class="btn" aria-pressed="${starred ? 'true' : 'false'}">Star ${stats.stars}</button>
        <span class="muted" id="viewCount">${stats.views} reads</span>
      </div>
      <div class="share-row">
        <button id="copyLink" class="btn btn-primary" type="button">Copy share link</button>
        <a class="btn" id="nativeShare" href="${link}">Open link</a>
      </div>
      <p class="muted" id="shareUrl">${escapeHtml(link)}</p>`;
    wireCopy(root);
    document.getElementById('reactBtn').addEventListener('click', () => vote('react', item.slug, 'reactBtn', 'React'));
    document.getElementById('starBtn').addEventListener('click', () => vote('star', item.slug, 'starBtn', 'Star'));
    document.getElementById('copyLink').addEventListener('click', async () => {
      await navigator.clipboard.writeText(link);
      document.getElementById('copyLink').textContent = 'Link copied';
    });
    document.getElementById('nativeShare').addEventListener('click', async (event) => {
      if (navigator.share) {
        event.preventDefault();
        try {
          await navigator.share({ title: item.title, text: item.excerpt || item.title, url: link });
        } catch { /* dismissed */ }
      }
    });
    Promise.all([
      bumpOnce('view', item.slug),
      readCount(`react-${item.slug}`),
      readCount(`star-${item.slug}`),
    ]).then(([views, reacts, stars]) => {
      const viewCount = document.getElementById('viewCount');
      const reactButton = document.getElementById('reactBtn');
      const starButton = document.getElementById('starBtn');
      if (viewCount) viewCount.textContent = `${views} reads`;
      if (reactButton) reactButton.textContent = `React ${reacts}`;
      if (starButton) starButton.textContent = `Star ${stars}`;
      window.__writeupStats = {
        ...window.__writeupStats,
        [item.slug]: { views, reacts, stars },
      };
    }).catch((error) => {
      console.error('[Writeups] Could not refresh article counters:', error);
    });
  }

  async function vote(kind, slug, id, label) {
    const btn = document.getElementById(id);
    if (btn.getAttribute('aria-pressed') === 'true') return;
    const count = await bumpOnce(kind, slug);
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = `${label} ${count}`;
  }

  window.Writeups = { mountIndex, mountArticle, renderMarkdown };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page === 'writeup') mountArticle();
    else {
      document.getElementById('mailForm')?.addEventListener('submit', onMail);
      if (new URLSearchParams(location.search).get('view') === 'writeups') {
        setTimeout(() => document.querySelector('[data-view="writeups"]')?.click(), 50);
      }
    }
  });
})();
