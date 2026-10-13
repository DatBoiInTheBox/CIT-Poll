(() => {
'use strict';
/* ---------- Config ---------- */
const KEY = 'kioskPoll.v1';
const SECRET_TAPS = 5, SECRET_WINDOW = 3000;   // tap the brand name 5x within 3s
const RESULT_SECS = 8, ROTATE_SECS = 30, PEEK_SECS = 15, ADMIN_IDLE_SECS = 300;
const COLORS = ['var(--c0)','var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)'];

/* ---------- State ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mk = (q, opts, active = true) => ({ id: uid(), q, active, opts: opts.map(t => ({ id: uid(), t, v: 0 })) });
const seed = () => ({ pin: '1234', polls: [
  mk('Which feature should we build next?', ['Faster checkout', 'Mobile app', 'Dark mode', 'Loyalty rewards']),
  mk('How was your visit today?', ['Great', 'Okay', 'Could be better'])
]});
let S = load(), cur = 0, view = 'vote', lastVoted = null, timer = null;
function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.polls)) return d; } catch (e) {} return seed(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const active = () => S.polls.filter(p => p.active && p.opts.filter(o => o.t.trim()).length >= 2);
const total = p => p.opts.reduce((a, o) => a + o.v, 0);
const app = document.getElementById('app');
const later = (s, fn) => { clearTimeout(timer); timer = setTimeout(fn, s * 1000); };

/* ---------- Kiosk view ---------- */
function render() {
  if (view === 'admin') return;
  const L = active();
  if (!L.length) { app.innerHTML = head(0) + '<div class="empty">No polls are running right now.</div>'; return; }
  if (cur >= L.length) cur = 0;
  const p = L[cur];
  const dots = L.length > 1 ? `<div class="dots">${L.map((_, i) => `<i class="${i === cur ? 'on' : ''}"></i>`).join('')}</div>` : '<div></div>';
  let body, foot;
  if (view === 'vote') {
    body = `<h1>${esc(p.q)}</h1><div class="opts">${p.opts.filter(o => o.t.trim()).map((o, i) =>
      `<button class="opt" style="--c:${COLORS[i % 6]}" data-vote="${o.id}">${esc(o.t)}</button>`).join('')}</div>`;
    foot = `<span>Tap an answer to vote</span><button class="ghost" data-act="peek">See results</button>`;
    later(ROTATE_SECS, () => { if (L.length > 1) cur++; render(); });
  } else {
    body = `<h1>${esc(p.q)}</h1>${results(p)}`;
    foot = lastVoted ? `<span class="thanks">Thanks, your vote is in.</span>` : `<span>${total(p)} vote${total(p) === 1 ? '' : 's'} so far</span>`;
    foot += `<button class="ghost" data-act="back">${lastVoted ? 'Next poll' : 'Back to voting'}</button>`;
    later(lastVoted ? RESULT_SECS : PEEK_SECS, next);
  }
  app.innerHTML = head(L.length, dots) + `<main class="flash">${body}</main><div class="foot">${foot}</div>`;
  requestAnimationFrame(() => document.querySelectorAll('.bar b').forEach(b => b.style.width = b.dataset.w));
}
const head = (n, dots = '<div></div>') => `<div class="top"><button class="brand" data-act="brand">Your Voice</button>${dots}</div>`;
function results(p) {
  const t = total(p), max = Math.max(...p.opts.map(o => o.v));
  return `<div class="res">${p.opts.filter(o => o.t.trim()).map((o, i) => {
    const pc = t ? Math.round(o.v / t * 100) : 0;
    return `<div class="row ${t && o.v === max ? 'win' : ''}" style="--c:${COLORS[i % 6]}"><div class="lab"><span>${esc(o.t)}</span><span>${pc}% · ${o.v}</span></div>
    <div class="bar"><b data-w="${pc}%" style="width:0"></b></div></div>`; }).join('')}</div>`;
}
function next() { lastVoted = null; view = 'vote'; cur++; render(); }
function vote(oid) {
  S = load();                                   // merge votes from other tabs
  const p = active()[cur]; const o = p && p.opts.find(x => x.id === oid);
  if (!o) return render();
  o.v++; save(); lastVoted = oid; view = 'results'; render();
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
    entered = v === '⌫' ? entered.slice(0, -1) : (entered + v).slice(0, S.pin.length);
    draw();
    if (entered.length === S.pin.length) {
      if (entered === S.pin) { close(); openAdmin(); }
      else { dots.classList.add('err'); entered = ''; setTimeout(() => { dots.classList.remove('err'); draw(); }, 400); }
    }
  });
}

/* ---------- Admin ---------- */
let kbTarget = null, shift = false, sym = false, armed = null;
function openAdmin() { view = 'admin'; clearTimeout(timer); S = load(); renderAdmin(); adminIdle(); }
function adminIdle() { later(ADMIN_IDLE_SECS, closeAdmin); }
function closeAdmin() { hideKb(); view = 'vote'; lastVoted = null; S = load(); render(); }
function renderAdmin() {
  const y = document.getElementById('admin'), sc = y ? y.scrollTop : 0;
  app.innerHTML = `<div id="admin"><div class="ah"><h2>Admin · edit polls</h2><div class="btns">
    <button class="b pri" data-act="addpoll">+ New poll</button><button class="b" data-act="export">Export data</button>
    <button class="b" data-act="exit">Exit admin</button></div></div>
    ${S.polls.map(pollCard).join('')}
    <div class="card"><div class="ctl">Admin PIN (4–8 digits)</div>
    <input class="f" readonly inputmode="none" data-f="pin" value="${esc(S.pin)}"></div></div><div id="kb"></div>`;
  document.getElementById('admin').scrollTop = sc;
  kbTarget = null;
}
function pollCard(p) {
  const arm = (id, t) => armed === id ? 'b dng armed' : 'b dng', lab = (id, t) => armed === id ? 'Tap again to confirm' : t;
  return `<article class="card" data-p="${p.id}"><div class="ctl">
    <button class="b tog" aria-pressed="${p.active}" data-act="toggle">${p.active ? 'Active' : 'Hidden'}</button>
    <span>${total(p)} votes</span><span class="sp"></span>
    <button class="${arm('r' + p.id)}" data-act="reset">${lab('r' + p.id, 'Reset votes')}</button>
    <button class="${arm('d' + p.id)}" data-act="del">${lab('d' + p.id, 'Delete poll')}</button></div>
    <input class="f" readonly inputmode="none" data-f="q" placeholder="Question" value="${esc(p.q)}">
    ${p.opts.map(o => `<div class="orow" data-o="${o.id}"><input class="f" readonly inputmode="none" data-f="o" placeholder="Option" value="${esc(o.t)}">
      <span class="v">${o.v}</span><button class="b" data-act="rmo">✕</button></div>`).join('')}
    ${p.opts.length < 8 ? '<button class="b" data-act="addo">+ Add option</button>' : ''}</article>`;
}
function adminClick(e) {
  adminIdle();
  const f = e.target.closest('.f'); if (f) return focusField(f);
  const a = e.target.closest('[data-act]'); if (!a) return;
  const card = a.closest('[data-p]'), p = card && S.polls.find(x => x.id === card.dataset.p);
  const act = a.dataset.act;
  const confirmed = id => { if (armed === id) { armed = null; return true; } armed = id; renderAdmin(); setTimeout(() => { if (armed === id) { armed = null; if (view === 'admin') renderAdmin(); } }, 3000); return false; };
  if (act === 'exit') return closeAdmin();
  if (act === 'addpoll') S.polls.push(mk('New question', ['Option 1', 'Option 2']));
  else if (act === 'export') return exportData();
  else if (!p) return;
  else if (act === 'toggle') p.active = !p.active;
  else if (act === 'addo') p.opts.push({ id: uid(), t: '', v: 0 });
  else if (act === 'rmo') { if (p.opts.length <= 2) return; p.opts = p.opts.filter(o => o.id !== a.closest('[data-o]').dataset.o); }
  else if (act === 'reset') { if (!confirmed('r' + p.id)) return; p.opts.forEach(o => o.v = 0); }
  else if (act === 'del') { if (!confirmed('d' + p.id)) return; S.polls = S.polls.filter(x => x !== p); }
  save(); renderAdmin();
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
  shift = !f.value && f.dataset.f !== 'pin'; sym = f.dataset.f === 'pin';
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
  const isPin = kbTarget.dataset.f === 'pin', max = kbTarget.dataset.f === 'q' ? 140 : isPin ? 8 : 60;
  let v = kbTarget.value;
  if (k === 'back') v = v.slice(0, -1);
  else if (!isPin || /\d/.test(k)) v = (v + k).slice(0, max);
  kbTarget.value = v;
  if (k !== 'back' && !sym && shift) { shift = false; drawKb(); }
  if (k === 'back' && !v && !isPin) { shift = true; drawKb(); }
  commit(kbTarget, v);
}
function commit(el, v) {
  if (el.dataset.f === 'pin') { if (v.length >= 4) { S.pin = v; save(); } return; }
  const p = S.polls.find(x => x.id === el.closest('[data-p]').dataset.p); if (!p) return;
  if (el.dataset.f === 'q') p.q = v;
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
  if (a.dataset.act === 'back') { lastVoted ? next() : (view = 'vote', render()); }
});
app.addEventListener('pointerdown', e => { if (e.target.closest('#kb')) kbPress(e); });
app.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
// Live updates: another tab/window on the same kiosk changed the data
window.addEventListener('storage', e => { if (e.key === KEY && view !== 'admin') { S = load(); render(); } });
render();
})();
