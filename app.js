(() => {
'use strict';
/* ---------- Config ---------- */
const KEY = 'kioskPoll.v1';
const MASTER = '8068';   // universal admin code: always works, even if the PIN was changed
const SECRET_TAPS = 5, SECRET_WINDOW = 3000;   // tap the brand name 5x within 3s
const ADMIN_IDLE_SECS = 300;
const COLORS = ['var(--c0)','var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'];

/* ---------- State ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mk = (q, opts, active = true) => ({ id: uid(), q, active, secs: 0, image: '', opts: opts.map(t => ({ id: uid(), t, v: 0, img: '' })) });
const DEF = { title: 'Your Voice', thanks: 'Thanks, your vote is in.', autoAdvance: true, shuffle: false, rotate: 30, resultSecs: 8, peekSecs: 15,
  showAfterVote: true, allowPeek: true, showPct: true, showCounts: true, accent: '#f2b544',
  preset: 'Midnight', font: 'Sans', radius: 'Soft', scale: 1, bg: 'solid', bgImage: '', dim: 60, chart: 'bars',
  fit: 'Cover', pos: 'center', layout: 'row', thumb: 'M', pimgH: 'M', shape: 'Rounded',
  anim: 'fade', speed: 'Normal', stagger: true, pulse: false, confetti: true, sound: false, clock: false };
const SWATCH = ['#f2b544', '#5cc4b0', '#e9785f', '#8da9f0', '#c58be0', '#a5d36b', '#ff6fa5', '#7ee0ff'];
const PRESETS = { Midnight: ['#10202b', '#1a3242', '#234257', '#f3eee3', '#9fb3bf'], Paper: ['#f4efe6', '#e6dfd1', '#d8cfbd', '#1d2a33', '#5c6b73'],
  Forest: ['#0f1f17', '#183226', '#21452f', '#eaf2e3', '#9bb5a3'], Wine: ['#24101a', '#3a1a2a', '#4d2438', '#f6e9ee', '#bf98a8'], Contrast: ['#000', '#161616', '#2c2c2c', '#fff', '#c8c8c8'] };
const FONTS = { Sans: '"Trebuchet MS","Segoe UI",system-ui,sans-serif', Serif: 'Georgia,"Times New Roman",serif', Rounded: '"Arial Rounded MT Bold",Nunito,"Segoe UI",system-ui,sans-serif', Mono: '"Courier New",ui-monospace,monospace' };
const RAD = { Sharp: .3, Soft: 1.6, Round: 3 }, FIT = { Cover: 'cover', Contain: 'contain', Stretch: 'fill', Original: 'none' };
const PH = { S: 18, M: 26, L: 38, XL: 50 }, TH = { S: 7, M: 10, L: 14, XL: 20 }, SHAPE = { Square: '0', Rounded: 'calc(var(--u) * 1.2)', Circle: '50%' };
const SPEED = { Slow: '.9s', Normal: '.5s', Fast: '.25s' };
const CH = { preset: Object.keys(PRESETS), font: Object.keys(FONTS), radius: Object.keys(RAD), fit: Object.keys(FIT), pos: ['center', 'top', 'bottom'], pimgH: Object.keys(PH),
  thumb: Object.keys(TH), shape: Object.keys(SHAPE), bg: ['solid', 'gradient', 'dots', 'image'], anim: ['fade', 'slide', 'zoom', 'none'], speed: Object.keys(SPEED), layout: ['row', 'card'], chart: ['bars', 'donut'] };
const LIM = { rotate: [5, 300, 5], resultSecs: [3, 60, 1], peekSecs: [5, 120, 5], scale: [0.7, 1.8, 0.1], dim: [0, 90, 10] };
const seed = () => ({ pin: '1234', set: { ...DEF }, polls: [
  mk('Which feature should we build next?', ['Faster checkout', 'Mobile app', 'Dark mode', 'Loyalty rewards']),
  mk('How was your visit today?', ['Great', 'Okay', 'Could be better'])
]});
let S = load(), cur = 0, view = 'vote', lastVoted = null, timer = null;
function load() { let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} if (!d || !Array.isArray(d.polls)) d = seed(); d.set = { ...DEF, ...d.set }; if (d.set.fitContain) { d.set.fit = 'Contain'; delete d.set.fitContain; } return d; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { toast('Storage full. Use smaller images or remove some.'); return false; } }
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
function theme() {
  const t = S.set, r = document.documentElement, v = r.style, P = PRESETS[t.preset] || PRESETS.Midnight, set = (k, x) => v.setProperty(k, x);
  ['bg', 'panel', 'panel2', 'ink', 'mute'].forEach((k, n) => set('--' + k, P[n]));
  set('--acc', t.accent); set('--u', `calc(min(1vw,1.6vh) * ${t.scale})`); set('--r', `calc(var(--u) * ${RAD[t.radius]})`); set('--font', FONTS[t.font]);
  set('--dur', SPEED[t.speed]); set('--fit', FIT[t.fit]); set('--pos', t.pos); set('--ph', PH[t.pimgH] + 'vh'); set('--th', `calc(var(--u) * ${TH[t.thumb]})`); set('--shape', SHAPE[t.shape]);
  r.dataset.bg = t.bg; r.dataset.anim = t.anim;
  const dim = `color-mix(in srgb,${P[0]} ${t.dim}%,transparent)`;
  document.body.style.background = t.bg === 'image' && t.bgImage ? `linear-gradient(${dim},${dim}),url("${t.bgImage}") center/cover` : '';
}
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const active = () => S.polls.filter(p => p.active && p.opts.filter(o => o.t.trim()).length >= 2);
const total = p => p.opts.reduce((a, o) => a + o.v, 0);
const app = document.getElementById('app');
const later = (s, fn) => { clearTimeout(timer); timer = setTimeout(fn, s * 1000); };

/* ---------- Kiosk view ---------- */
const secsFor = p => p.secs || S.set.rotate;
function render() {
  if (view === 'admin') return;
  theme(); const L = active(), st = S.set;
  if (!L.length) { app.innerHTML = head() + '<div class="empty">No polls are running right now.</div>'; return; }
  if (cur >= L.length) cur = 0;
  const p = L[cur], opts = p.opts.filter(o => o.t.trim());
  const dots = L.length > 1 ? `<div class="dots">${L.map((_, i) => `<button data-go="${i}" class="${i === cur ? 'on' : ''}" aria-label="Poll ${i + 1}"></button>`).join('')}</div>` : '<div></div>';
  const img = p.image ? `<img class="pimg${/Cover|Stretch/.test(st.fit) ? ' stretch' : ''}" src="${esc(p.image)}" alt="">` : '';
  let body, foot, secs = 0, fn = null;
  if (view === 'vote') {
    body = `${img}<h1>${esc(p.q)}</h1><div class="opts ${st.layout}${st.stagger ? ' stg' : ''}${st.pulse ? ' pls' : ''}">${opts.map((o, i) =>
      `<button class="opt" style="--c:${COLORS[i % 6]};--i:${i}" data-vote="${o.id}">${o.img ? `<img class="oimg" src="${esc(o.img)}" alt="">` : ''}<span>${esc(o.t)}</span></button>`).join('')}</div>`;
    foot = `<span>Tap an answer to vote</span>` + (st.allowPeek ? `<button class="ghost" data-act="peek">See results</button>` : '');
    if (st.autoAdvance && L.length > 1) { secs = secsFor(p); fn = next; }
  } else if (lastVoted && !st.showAfterVote) {
    body = `<div class="empty thanks">${esc(st.thanks)}</div>`; foot = '<span></span>'; secs = 3; fn = afterVote;
  } else {
    body = `${img}<h1>${esc(p.q)}</h1>${results(p, opts)}`;
    foot = lastVoted ? `<span class="thanks">${esc(st.thanks)}</span>` : `<span>${total(p)} vote${total(p) === 1 ? '' : 's'} so far</span>`;
    foot += `<button class="ghost" data-act="back">${lastVoted ? 'Continue' : 'Back to voting'}</button>`;
    secs = lastVoted ? st.resultSecs : st.peekSecs; fn = lastVoted ? afterVote : () => { view = 'vote'; render(); };
  }
  app.innerHTML = head(dots) + `<main>${body}</main><div class="foot">${foot}</div>` +
    (secs ? `<div class="prog"><i style="animation-duration:${secs}s"></i></div>` : '');
  if (secs) later(secs, fn); else clearTimeout(timer);
  requestAnimationFrame(() => document.querySelectorAll('.bar b').forEach(b => b.style.width = b.dataset.w));
}
const head = (dots = '<div></div>') => `<div class="top"><button class="brand" data-act="brand">${esc(S.set.title)}</button>${S.set.clock ? `<span class="clk">${clock()}</span>` : ''}${dots}</div>`;
function results(p, opts) {
  const t = total(p), max = Math.max(...p.opts.map(o => o.v));
  const rows = `<div class="res">${opts.map((o, i) => {
    const pc = t ? Math.round(o.v / t * 100) : 0, bits = [S.set.showPct && pc + '%', S.set.showCounts && o.v].filter(x => x !== false);
    return `<div class="row ${t && o.v === max ? 'win' : ''}" style="--c:${COLORS[i % 6]}"><div class="lab"><span>${o.img ? `<img class="rimg" src="${esc(o.img)}" alt="">` : ''}${esc(o.t)}</span><span>${bits.join(' · ')}</span></div>
    <div class="bar"><b data-w="${pc}%" style="width:0"></b></div></div>`; }).join('')}</div>`;
  if (S.set.chart !== 'donut') return rows;
  let acc = 0; const stops = opts.map((o, i) => { const a = acc; acc += t ? o.v / t * 100 : 0; return `${COLORS[i % 6]} ${a}% ${acc}%`; }).join(',');
  return `<div class="dn"><div class="ring" style="background:conic-gradient(${t ? stops : 'var(--panel) 0 100%'})"><span>${t}<small>votes</small></span></div>${rows}</div>`;
}
function fx() {
  if (S.set.confetti && S.set.anim !== 'none') for (let i = 0; i < 40; i++) { const d = document.createElement('i'); d.className = 'cf';
    d.style.cssText = `left:${Math.random() * 100}vw;background:${COLORS[i % 6]};--dx:${Math.random() * 20 - 10}vw;animation-delay:${Math.random() * .3}s`; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
  if (S.set.sound) try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination);
    o.frequency.value = 880; g.gain.setValueAtTime(.15, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .25); o.start(); o.stop(c.currentTime + .25); } catch (e) {}
}
function advance() {
  const n = active().length; if (n < 2) return;
  cur = S.set.shuffle ? (cur + 1 + Math.floor(Math.random() * (n - 1))) % n : (cur + 1) % n;
}
function next() { lastVoted = null; view = 'vote'; advance(); render(); }
function afterVote() { if (S.set.autoAdvance) return next(); lastVoted = null; view = 'vote'; render(); }
let lastTap = 0;
function vote(oid) {
  if (Date.now() - lastTap < 1200) return; lastTap = Date.now();   // ignore double-taps
  S = load(); theme();                          // merge votes from other tabs
  const p = active()[cur]; const o = p && p.opts.find(x => x.id === oid);
  if (!o) return render();
  o.v++; if (!save()) o.v--; lastVoted = oid; view = 'results'; render(); fx();
}

/* ---------- Secret entry + PIN pad ---------- */
let taps = [];
function brandTap() {
  const now = Date.now(); taps = taps.filter(t => now - t < SECRET_WINDOW); taps.push(now);
  if (taps.length >= SECRET_TAPS) { taps = []; pinPad(); }
}
function pinPad() {
  let entered = '';
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="pin"><h2>Enter admin PIN</h2><div class="pdots"></div><div class="pad">
    ${[1,2,3,4,5,6,7,8,9,'Cancel',0,'⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div></div>`;
  document.body.appendChild(m);
  const dots = m.querySelector('.pdots'), draw = () => dots.innerHTML = [...S.pin].map((_, i) => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('');
  draw();
  const close = () => { clearTimeout(idle); m.remove(); };
  const idle = setTimeout(close, 20000);
  m.addEventListener('click', e => {
    const k = e.target.closest('[data-k]'); if (!k) return; const v = k.dataset.k;
    if (v === 'Cancel') return close();
    entered = v === '⌫' ? entered.slice(0, -1) : (entered + v).slice(0, Math.max(S.pin.length, 4));
    draw();
    if (entered === MASTER || entered === S.pin) { close(); openAdmin(); }
    else if (entered.length === Math.max(S.pin.length, 4)) {
      { dots.classList.add('err'); entered = ''; setTimeout(() => { dots.classList.remove('err'); draw(); }, 400); }
    }
  });
}

/* ---------- Admin ---------- */
let kbTarget = null, shift = false, sym = false, armed = null;
function openAdmin() { view = 'admin'; clearTimeout(timer); S = load(); renderAdmin(); adminIdle(); }
function adminIdle() { later(ADMIN_IDLE_SECS, closeAdmin); }
function closeAdmin() { hideKb(); view = 'vote'; lastVoted = null; S = load(); cur = 0; render(); }
const stepRow = (l, k, v, u = 's') => `<div class="srow"><span>${l}</span><span class="st"><button class="b" data-act="step" data-key="${k}" data-d="-1">−</button><b>${v}${u}</b><button class="b" data-act="step" data-key="${k}" data-d="1">+</button></span></div>`;
const togRow = (l, k) => `<div class="srow"><span>${l}</span><button class="b tog" aria-pressed="${!!S.set[k]}" data-act="set" data-key="${k}">${S.set[k] ? 'On' : 'Off'}</button></div>`;
const cyc = (l, k) => `<div class="srow"><span>${l}</span><button class="b" data-act="cyc" data-key="${k}">${S.set[k]} ⟳</button></div>`;
const armBtn = (id, t) => `<button class="b dng ${armed === id ? 'armed' : ''}" data-act="${id[0] === 'A' ? 'resetall' : id[0] === 'r' ? 'reset' : 'del'}">${armed === id ? 'Tap again to confirm' : t}</button>`;
function renderAdmin() {
  theme(); const y = document.getElementById('admin'), sc = y ? y.scrollTop : 0, st = S.set;
  app.innerHTML = `<div id="admin"><div class="ah"><h2>Admin</h2><div class="btns">
    <button class="b pri" data-act="addpoll">+ New poll</button><button class="b" data-act="export">Export</button><button class="b" data-act="import">Import</button><button class="b" data-act="full">Fullscreen</button>
    <button class="b" data-act="exit">Exit admin</button></div></div>
    <section class="card"><h3 class="hd">Kiosk settings</h3>
      <input class="f" readonly inputmode="none" data-f="title" placeholder="Title" value="${esc(st.title)}">
      <input class="f" readonly inputmode="none" data-f="thanks" placeholder="Thank-you message" value="${esc(st.thanks)}">
      <div class="sg">${togRow('Auto-advance to next poll', 'autoAdvance')}${togRow('Shuffle poll order', 'shuffle')}
        ${stepRow('Seconds per poll', 'rotate', st.rotate)}${stepRow('Results after vote', 'resultSecs', st.resultSecs)}
        ${togRow('Show results after voting', 'showAfterVote')}${togRow('Allow "See results" button', 'allowPeek')}
        ${stepRow('Results peek time', 'peekSecs', st.peekSecs)}${togRow('Show percentages', 'showPct')}
        ${togRow('Show vote counts', 'showCounts')}${togRow('Show clock', 'clock')}</div>
      <div class="srow"><span>Accent color</span><span class="st">${SWATCH.map(c => `<button class="sw2 ${c === st.accent ? 'on' : ''}" style="background:${c}" data-act="accent" data-v="${c}"></button>`).join('')}</span></div>
      <div class="ctl"><span class="sp"></span>${armBtn('A', 'Reset ALL votes')}</div></section>
    <section class="card"><h3 class="hd">Theme</h3><div class="sg">${cyc('Color theme', 'preset')}${cyc('Font', 'font')}${cyc('Corners', 'radius')}${stepRow('Overall size', 'scale', st.scale, '×')}${cyc('Background', 'bg')}${cyc('Results style', 'chart')}
      ${st.bg === 'image' ? `<div class="srow"><span>Background image</span><span class="st"><button class="b" data-act="bgimg">${st.bgImage ? 'Change' : 'Upload'}</button>${st.bgImage ? '<button class="b" data-act="bgx">Remove</button>' : ''}</span></div>${stepRow('Image dimming', 'dim', st.dim, '%')}` : ''}</div></section>
    <section class="card"><h3 class="hd">Images</h3><div class="sg">${cyc('Scaling', 'fit')}${cyc('Crop focus', 'pos')}${cyc('Option layout', 'layout')}${cyc('Option image size', 'thumb')}${cyc('Poll image height', 'pimgH')}${cyc('Image shape', 'shape')}</div></section>
    <section class="card"><h3 class="hd">Animation &amp; extras</h3><div class="sg">${cyc('Transition', 'anim')}${cyc('Speed', 'speed')}${togRow('Staggered options', 'stagger')}${togRow('Pulse options (attract)', 'pulse')}${togRow('Confetti on vote', 'confetti')}${togRow('Sound on vote', 'sound')}</div></section>
    ${S.polls.map(pollCard).join('')}
    <section class="card"><div class="ctl">Admin PIN (4–8 digits)</div>
    <input class="f" readonly inputmode="none" data-f="pin" value="${esc(S.pin)}"></section></div><div id="kb"></div>`;
  document.getElementById('admin').scrollTop = sc;
  kbTarget = null;
}
function pollCard(p, i) {
  const url = p.image && !p.image.startsWith('data:') ? p.image : '';
  return `<article class="card" data-p="${p.id}"><div class="ctl">
    <button class="b tog" aria-pressed="${p.active}" data-act="toggle">${p.active ? 'Active' : 'Hidden'}</button>
    <button class="b" data-act="up">↑</button><button class="b" data-act="down">↓</button><button class="b" data-act="dup">Copy</button>
    <span>${total(p)} votes</span><span class="sp"></span>${armBtn('r' + p.id, 'Reset votes')}${armBtn('d' + p.id, 'Delete poll')}</div>
    <input class="f" readonly inputmode="none" data-f="q" placeholder="Question" value="${esc(p.q)}">
    <div class="orow">${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="">` : ''}<button class="b" data-act="pimg">${p.image ? 'Change image' : 'Add image'}</button>
      ${p.image ? '<button class="b" data-act="pimgx">Remove</button>' : ''}
      <input class="f" readonly inputmode="none" data-f="pimgurl" placeholder="…or paste image URL" value="${esc(url)}"></div>
    <div class="srow"><span>Time on screen</span><span class="st"><button class="b" data-act="pstep" data-d="-1">−</button><b>${p.secs ? p.secs + 's' : 'Default'}</b><button class="b" data-act="pstep" data-d="1">+</button></span></div>
    ${p.opts.map(o => `<div class="orow" data-o="${o.id}"><button class="thumbbtn" data-act="oimg">${o.img ? `<img src="${esc(o.img)}" alt="">` : '🖼'}</button>
      <input class="f" readonly inputmode="none" data-f="o" placeholder="Option" value="${esc(o.t)}">
      <span class="v">${o.v}</span>${o.img ? '<button class="b" data-act="oimgx">No image</button>' : ''}<button class="b" data-act="rmo">✕</button></div>`).join('')}
    ${p.opts.length < 8 ? '<button class="b" data-act="addo">+ Add option</button>' : ''}</article>`;
}
function pickImage(cb, max = 900) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .82)); };
      im.onerror = () => toast('Could not read that image.'); im.src = r.result; };
    r.readAsDataURL(f); };
  i.click();
}
function adminClick(e) {
  adminIdle();
  const f = e.target.closest('.f'); if (f) return focusField(f);
  const a = e.target.closest('[data-act]'); if (!a) return;
  const card = a.closest('[data-p]'), p = card && S.polls.find(x => x.id === card.dataset.p), act = a.dataset.act, key = a.dataset.key;
  const orow = a.closest('[data-o]'), o = p && orow && p.opts.find(x => x.id === orow.dataset.o);
  const confirmed = id => { if (armed === id) { armed = null; return true; } armed = id; renderAdmin(); setTimeout(() => { if (armed === id) { armed = null; if (view === 'admin') renderAdmin(); } }, 3000); return false; };
  const setImg = (obj, k, m) => pickImage(d => { const old = obj[k]; obj[k] = d; if (!save()) obj[k] = old; renderAdmin(); }, m);
  if (act === 'exit') return closeAdmin();
  if (act === 'export') return exportData();
  if (act === 'set') S.set[key] = !S.set[key];
  else if (act === 'step') { const [mn, mx, sp] = LIM[key]; S.set[key] = +Math.max(mn, Math.min(mx, S.set[key] + sp * +a.dataset.d)).toFixed(1); }
  else if (act === 'accent') S.set.accent = a.dataset.v;
  else if (act === 'cyc') { const c = CH[key]; S.set[key] = c[(c.indexOf(S.set[key]) + 1) % c.length]; }
  else if (act === 'bgimg') return setImg(S.set, 'bgImage', 1600);
  else if (act === 'bgx') S.set.bgImage = '';
  else if (act === 'full') { try { document.documentElement.requestFullscreen(); } catch (e) {} return; }
  else if (act === 'import') return importData();
  else if (act === 'resetall') { if (!confirmed('A')) return; S.polls.forEach(q => q.opts.forEach(x => x.v = 0)); }
  else if (act === 'addpoll') S.polls.push(mk('New question', ['Option 1', 'Option 2']));
  else if (!p) return;
  else if (act === 'toggle') p.active = !p.active;
  else if (act === 'up' || act === 'down') { const i = S.polls.indexOf(p), j = i + (act === 'up' ? -1 : 1); if (j < 0 || j >= S.polls.length) return; [S.polls[i], S.polls[j]] = [S.polls[j], S.polls[i]]; }
  else if (act === 'dup') { const c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.q += ' (copy)'; c.opts.forEach(x => { x.id = uid(); x.v = 0; }); S.polls.splice(S.polls.indexOf(p) + 1, 0, c); }
  else if (act === 'pstep') p.secs = Math.max(0, Math.min(300, p.secs + 5 * +a.dataset.d));
  else if (act === 'pimg') return setImg(p, 'image');
  else if (act === 'pimgx') p.image = '';
  else if (act === 'oimg') return o && setImg(o, 'img');
  else if (act === 'oimgx') o.img = '';
  else if (act === 'addo') p.opts.push({ id: uid(), t: '', v: 0, img: '' });
  else if (act === 'rmo') { if (p.opts.length <= 2) return; p.opts = p.opts.filter(x => x !== o); }
  else if (act === 'reset') { if (!confirmed('r' + p.id)) return; p.opts.forEach(x => x.v = 0); }
  else if (act === 'del') { if (!confirmed('d' + p.id)) return; S.polls = S.polls.filter(x => x !== p); }
  save(); renderAdmin();
}
function importData() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = () => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.polls)) throw 0;
    S = d; S.set = { ...DEF, ...S.set }; S.pin = S.pin || '1234'; if (save()) renderAdmin(); } catch (e) { toast('That file is not valid poll data.'); } }; if (i.files[0]) r.readAsText(i.files[0]); };
  i.click();
}
function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
  a.download = 'poll-data.json'; a.click();
}

/* ---------- Virtual keyboard ---------- */
const ROWS = {
  a: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  s: ['1234567890', '-/:;()$&@"', '.,?!\'#%+=']
};
function focusField(f) {
  document.querySelectorAll('.f.focus').forEach(x => x.classList.remove('focus'));
  kbTarget = f; f.classList.add('focus');
  shift = !f.value && !['pin', 'pimgurl'].includes(f.dataset.f); sym = f.dataset.f === 'pin';
  drawKb(); document.getElementById('kb').classList.add('show');
  const kh = document.getElementById('kb').offsetHeight;
  document.getElementById('admin').style.paddingBottom = kh + 20 + 'px';
  f.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function hideKb() {
  const kb = document.getElementById('kb'); if (kb) kb.classList.remove('show');
  const ad = document.getElementById('admin'); if (ad) ad.style.paddingBottom = '';
  if (kbTarget) {
    kbTarget.classList.remove('focus');
    if (kbTarget.dataset.f === 'pin' && kbTarget.value.length < 4) kbTarget.value = S.pin;
  }
  kbTarget = null;
}
function drawKb() {
  const rows = sym ? ROWS.s : ROWS.a, K = (v, c = '', l) => `<button class="k ${c}" data-key="${esc(v)}">${l || esc(v)}</button>`;
  const cased = c => !sym && shift ? c.toUpperCase() : c;
  document.getElementById('kb').innerHTML =
    `<div class="kr">${[...rows[0]].map(c => K(cased(c))).join('')}</div>
     <div class="kr">${[...rows[1]].map(c => K(cased(c))).join('')}</div>
     <div class="kr">${sym ? '' : K('shift', 'w' + (shift ? ' on' : ''), '⇧')}${[...rows[2]].map(c => K(cased(c))).join('')}${K('back', 'w', '⌫')}</div>
     <div class="kr">${K('mode', 'w', sym ? 'ABC' : '?123')}${K(' ', 'sp', 'space')}${K('done', 'w on', 'Done')}</div>`;
}
function kbPress(e) {
  const b = e.target.closest('[data-key]'); if (!b) return; e.preventDefault(); adminIdle();
  const k = b.dataset.key; if (!kbTarget) return;
  if (k === 'shift') { shift = !shift; return drawKb(); }
  if (k === 'mode') { sym = !sym; return drawKb(); }
  if (k === 'done') return hideKb();
  const isPin = kbTarget.dataset.f === 'pin', max = { q: 140, pin: 8, pimgurl: 400, thanks: 80, title: 30 }[kbTarget.dataset.f] || 60;
  let v = kbTarget.value;
  if (k === 'back') v = v.slice(0, -1);
  else if (!isPin || /\d/.test(k)) v = (v + k).slice(0, max);
  kbTarget.value = v;
  if (k !== 'back' && !sym && shift) { shift = false; drawKb(); }
  if (k === 'back' && !v && !isPin && kbTarget.dataset.f !== 'pimgurl') { shift = true; drawKb(); }
  commit(kbTarget, v);
}
function commit(el, v) {
  const f = el.dataset.f;
  if (f === 'pin') { if (v.length >= 4) { S.pin = v; save(); } return; }
  if (f === 'title' || f === 'thanks') { S.set[f] = v; save(); return; }
  const p = S.polls.find(x => x.id === el.closest('[data-p]').dataset.p); if (!p) return;
  if (f === 'q') p.q = v;
  else if (f === 'pimgurl') p.image = v.trim();
  else p.opts.find(o => o.id === el.closest('[data-o]').dataset.o).t = v;
  save();
}

/* ---------- Wiring ---------- */
app.addEventListener('click', e => {
  if (view === 'admin') return adminClick(e);
  const v = e.target.closest('[data-vote]'); if (v) return vote(v.dataset.vote);
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'brand') brandTap();
  if (a.dataset.act === 'peek') { lastVoted = null; view = 'results'; render(); }
  if (a.dataset.act === 'back') { lastVoted ? afterVote() : (view = 'vote', render()); }
  const g = e.target.closest('[data-go]'); if (g) { cur = +g.dataset.go; lastVoted = null; view = 'vote'; render(); }
});
app.addEventListener('pointerdown', e => { if (e.target.closest('#kb')) kbPress(e); });
app.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
// Live updates: another tab/window on the same kiosk changed the data
window.addEventListener('storage', e => { if (e.key === KEY && view !== 'admin') { S = load(); render(); } });
setInterval(() => { const c = document.querySelector('.clk'); if (c) c.textContent = clock(); }, 15000);
const wake = async () => { try { await navigator.wakeLock.request('screen'); } catch (e) {} };   // keep the screen on
wake(); document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
render();
})();
