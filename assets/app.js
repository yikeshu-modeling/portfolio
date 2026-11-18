/* ============================================================
   作品集前端逻辑
   一般不需要改这个文件；要改文字/加论文，去 data/ 下面改
   ============================================================ */
const T = window.SITE || {};
const PAPERS = (window.PAPERS || []).map(p => ({
  id: p.编号,
  comp: p.赛事,
  year: p.年份 == null ? '' : String(p.年份),
  letter: p.题号 || '',
  title: p.题目 || '',
  award: p.奖项 || '',
  kw: String(p.关键词 || '').split(/\s+/).filter(Boolean),
  pages: +p.页数 || 1
}));
const COMPS = Object.entries(T.赛事 || {});
const FB = window.FEEDBACK || {};

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

let filter = store.get('sm-filter') || 'all';
if (filter !== 'all' && !COMPS.some(c => c[0] === filter)) filter = 'all';

const ICON = {
  notice: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  feedback: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>'
};
let view = 'list';

/* ---------------- 左侧导航 ---------------- */
function nav() {
  const extra = [];
  if (String(window.NOTICE_TEXT || '').trim()) extra.push(['notice', T.通知页 || '通知']);
  if ((FB.图片 || []).length) extra.push(['feedback', FB.页面名 || '反馈']);
  $('#nav2').innerHTML = extra.length
    ? '<div class="sep"></div>' + extra.map(([k, n]) =>
        `<button class="nav page" data-v="${k}" aria-current="${k !== 'notice' && view === k}">${ICON[k] || ''}${esc(n)}</button>`).join('')
    : '';
  $('#nav').innerHTML = [['all', T.全部 || '全部'], ...COMPS]
    .map(([k, n]) => `<button class="nav" data-k="${k}" aria-current="${view === 'list' && filter === k}"${k === 'all' ? '' : ` style="--c:var(--${k})"`}><i></i>${n}</button>`).join('');
}

/* ---------------- 反馈 ---------------- */
function renderFeedback() {
  const items = (FB.图片 || []).map(x => typeof x === 'string' ? { 文件: x } : x).filter(x => x && x.文件);
  const src = x => 'feedback/' + encodeURIComponent(x.文件);
  $('#main').innerHTML = `<section class="zone" style="--c:var(--brand1)">
    <div class="zone-head"><i></i><h2>${esc(FB.页面名 || '反馈')}</h2></div>
    ${FB.说明 ? `<p class="lead">${esc(FB.说明)}</p>` : ''}
    ${items.length ? `<div class="masonry">${items.map((x, i) => `<figure class="fb" data-src="${src(x)}" style="--i:${i}"><img src="${src(x)}" alt="${esc(x.说明 || '')}" loading="lazy">${x.说明 ? `<figcaption>${esc(x.说明)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
  </section>`;
}

/* ---------------- 作品列表 ---------------- */
/* 奖项等级 → 角标配色（金/银/铜） */
const lvOf = a => /[一特OF]/.test(a) ? 1 : /[二M]/.test(a) ? 2 : /三/.test(a) ? 3 : 0;

function render() {
  if (view === 'feedback') return renderFeedback();
  let h = '', i = 0;
  for (const [k, n] of COMPS) {
    if (filter !== 'all' && filter !== k) continue;
    const ps = PAPERS
      .filter(p => p.comp === k)
      .sort((a, b) => (b.year - a.year) || String(a.letter).localeCompare(String(b.letter)));
    h += `<section class="zone" style="--c:var(--${k})">
      <div class="zone-head"><i></i><h2>${esc(n)}</h2></div>
      ${ps.length ? `<div class="grid">${ps.map(p => `<button class="card" data-id="${p.id}" style="--i:${i++}">
        <div class="cover"><img src="thumbs/${p.id}.jpg" alt="" loading="lazy">${p.letter ? `<span class="tag">${esc(p.letter)}</span>` : ''}${p.award ? `<span class="aw" data-lv="${lvOf(p.award)}">${esc(p.award)}</span>` : ''}</div>
        <p>${esc(p.title)}<small>${esc(p.year ? p.year + ' 年' : '')}</small></p>
      </button>`).join('')}</div>` : `<p class="none">暂无作品</p>`}
    </section>`;
  }
  $('#main').innerHTML = h || `<p class="none">暂无作品</p>`;
}

/* ---------------- 论文阅读器 ----------------
   论文不上传 PDF：每篇在前端按页加载 pages/<编号>/<页码>.webp */
let seq = 0, io = null, total = 1;

function loadPage(el) {
  if (el.dataset.done) return;
  el.dataset.done = '1';
  const src = el.dataset.src;
  const probe = new Image();
  probe.onload = () => {
    const ratio = probe.naturalWidth + '/' + probe.naturalHeight;
    // 第一页出来时，把同一篇所有页的比例一次定好，避免边加载边跳
    if (el.dataset.n === '1') {
      $('#view').querySelectorAll('.pg').forEach(x => { x.style.aspectRatio = ratio; });
    }
    el.style.aspectRatio = ratio;
    el.style.backgroundImage = `url("${src}")`;
    el.classList.add('ok');
  };
  probe.onerror = () => {
    el.classList.add('ok');
    el.style.background = '#f3f4f8';
    el.innerHTML = `<p class="vmsg">第 ${el.dataset.n} 页加载失败</p>`;
  };
  probe.src = src;
}

function open(id) {
  const p = PAPERS.find(x => x.id === id);
  if (!p) return close();
  const my = ++seq;
  const v = $('#view');
  $('#reader').style.setProperty('--c', `var(--${p.comp})`);
  $('#rt').textContent = p.title;
  total = p.pages;
  $('#pageno').textContent = '1 / ' + total;
  v.innerHTML = Array.from({ length: p.pages }, (_, i) => `<div class="pg" data-n="${i + 1}" data-src="pages/${p.id}/${i + 1}.webp"></div>`).join('');
  $('#reader').hidden = false;
  document.body.style.overflow = 'hidden';
  v.scrollTop = 0;
  document.title = p.title + ' · ' + (T.标题 || '数学建模作品集');
  const pgs = v.querySelectorAll('.pg');
  // 先用卡片上已经缓存好的封面把第一页顶上，几秒的空窗就没了
  if (pgs[0]) {
    pgs[0].style.backgroundImage = `url("thumbs/${p.id}.jpg")`;
    pgs[0].classList.add('ok');
  }
  if (io) io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && my === seq) loadPage(e.target); }), { root: v, rootMargin: '900px 0px' });
  pgs.forEach(el => io.observe(el));
  loadPage(pgs[0]);
}

function close() {
  seq++;
  if (io) { io.disconnect(); io = null; }
  $('#reader').hidden = true;
  $('#view').innerHTML = '';
  document.body.style.overflow = '';
  document.title = T.标题 || '数学建模作品集';
}

/* 阅读进度 / 页码 */
let ticking = false;
$('#view').addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const v = $('#view'), kids = v.querySelectorAll('.pg');
    if (!kids.length) return;
    const vTop = v.getBoundingClientRect().top;
    let cur = 1;
    for (const el of kids) { if (el.getBoundingClientRect().top - vTop <= 80) cur = +el.dataset.n; else break; }
    $('#pageno').textContent = cur + ' / ' + total;
  });
}, { passive: true });

/* ---------------- 交互 ---------------- */
$('#nav').onclick = e => {
  const b = e.target.closest('.nav'); if (!b) return;
  filter = b.dataset.k; store.set('sm-filter', filter);
  if (view !== 'list') { location.hash = ''; return; }
  nav(); render(); scrollTo({ top: 0, behavior: 'smooth' });
};
$('#nav2').onclick = e => {
  const b = e.target.closest('.nav'); if (!b) return;
  if (b.dataset.v === 'notice') $('#notice').hidden = false;
  else location.hash = b.dataset.v;
};
$('#main').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (c) return void (location.hash = c.dataset.id);
  const f = e.target.closest('.fb');
  if (f) { $('#light img').src = f.dataset.src; $('#light').hidden = false; }
});
$('#light').onclick = () => { $('#light').hidden = true; };

/* 文案注入 */
document.title = T.标题 || document.title;
$('.brand').innerHTML = `<span class="logo">${esc(T.图标字 || '数')}</span><span class="t">${esc(T.标题 || '')}</span>`;
$('#contact').textContent = T.联系方式 || '联系方式';
$('#ngo').textContent = T.进入 || '进入';
$('#mclose').textContent = T.关闭 || '关闭';
$('#back').textContent = T.返回 || '返回';
$('#modal img').alt = T.二维码说明 || '';

/* 进场通知（地址后加 ?nowelcome=1 可跳过，方便自己预览） */
const NT = String(window.NOTICE_TEXT || '').trim();
if (NT && !/[?&]nowelcome/.test(location.search)) {
  $('#ntitle').textContent = window.NOTICE_TITLE || '通知';
  $('#nbody').innerHTML = NT.split(/\n\s*\n/).map(x => `<p>${esc(x.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  $('#notice').hidden = false;
}

/* 二维码 */
const closeNotice = () => { $('#notice').hidden = true; };
$('#ngo').onclick = closeNotice;
$('#contact').onclick = () => {
  const im = $('#modal img');
  if (im.dataset.fresh != null) { im.src = 'contact.jpg?v=' + Date.now(); delete im.dataset.fresh; }
  $('#modal').hidden = false;
};
$('#mclose').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };

/* 防顺手保存：屏蔽右键 / 拖拽 / Ctrl+S */
document.addEventListener('contextmenu', e => { if (e.target.closest('img,.pg,#view') && !e.target.closest('#modal')) e.preventDefault(); });
document.addEventListener('dragstart', e => { if (e.target.closest('img,.pg')) e.preventDefault(); });
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && /^[sp]$/i.test(e.key)) e.preventDefault(); });

/* 路由 */
$('#back').onclick = () => { location.hash = ''; };
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#light').hidden) $('#light').hidden = true;
  else if (!$('#notice').hidden) closeNotice();
  else if (!$('#modal').hidden) $('#modal').hidden = true;
  else if (!$('#reader').hidden) location.hash = '';
});

function route() {
  const id = location.hash.slice(1);
  if (/^p\d+$/.test(id) && PAPERS.some(p => p.id === id)) return open(id);
  close();
  const v = (id === 'feedback' && (FB.图片 || []).length) ? id : 'list';
  if (v !== view) { view = v; nav(); render(); scrollTo(0, 0); }
}
addEventListener('hashchange', route);

nav(); render(); route();
