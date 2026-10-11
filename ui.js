import * as G from './logic.js';

const app = document.getElementById('app');
const LETTERS = ['א', 'ב', 'ג', 'ד'];
const ICON = { win: '✅', lose: '❌', jail: '🔒' };
const STAT = { respect: ['כבוד', 1], cash: ['כסף', 1], heat: ['חום', -1] }; // [label, +1 if going up is good]

let s = null; // game state (logic.js)
let ui = {};  // what's on screen
let lastView;

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem('mafioner:' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('mafioner:' + k, JSON.stringify(v)); } catch {} },
};

const esc = str => String(str).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const t = str => G.gender(str, s ? s.female : ui.female);
const years = n => (n === 1 ? 'שנה' : n === 2 ? 'שנתיים' : `${n} שנים`);
const money = k => {
  const a = Math.abs(k), v = a >= 1000 ? +(a / 1000).toFixed(1) + 'M' : a + 'K';
  return `<span class="num">${k < 0 ? '-' : ''}₪${v}</span>`;
};
const delta = (v, good = 1, fmt = String) => (v ? `<small class="${v * good > 0 ? 'good' : 'bad'}"><bdi>${v > 0 ? '+' : ''}${fmt(v)}</bdi></small>` : '<small>&nbsp;</small>');
const tier = v => (v >= 95 ? '#2563eb' : v >= 80 ? '#d97706' : v >= 60 ? '#94a3b8' : '#b0703c');

function ring(v, size) {
  const c = 2 * Math.PI * 26;
  return `<div class="ring" style="--w:${size}px">
    <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" class="track"/><circle cx="32" cy="32" r="26" class="bar" stroke="${tier(v)}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}"/></svg>
    <div><b>${v}</b>${size > 50 ? '<small>כבוד</small>' : ''}</div></div>`;
}

function chips(fx = {}) {
  const out = [];
  for (const [k, [name, good]] of Object.entries(STAT)) {
    const v = fx[k];
    if (!v) continue;
    const a = Math.abs(v), big = k === 'cash' ? [40, 150] : [6, 14];
    const n = a <= big[0] ? 1 : a <= big[1] ? 2 : 3;
    out.push(`<span class="chip ${v * good > 0 ? 'good' : 'bad'}">${name} ${(v > 0 ? '▲' : '▼').repeat(n)}</span>`);
  }
  if (fx.jail) out.push(`<span class="chip jail">🔒 ${years(fx.jail)}</span>`);
  if ('mul' in fx) {
    out.push(fx.mul === 0 ? '<span class="chip good">🔓 יוצא חופשי</span>'
      : `<span class="chip ${fx.mul < 1 ? 'good' : 'bad'}">עונש ×${fx.mul}</span>`);
  }
  return out.join('');
}

// ── views ──

function homeView() {
  const day = G.dayNumber(), done = store.get('daily-' + day), best = store.get('best', [])[0];
  return `<main class="home">
    <div class="logo">מאפיונר</div>
    <h1>משליח לסנדק</h1>
    <div class="tagline">או ישר לכלא</div>
    <p><b>5 דקות של החלטות מפוקפקות:</b><br>תבנו אימפריה, או תחטפו 8 שנים באגף ההפרדה?</p>
    <div class="modes">
      <button class="card mode dark" data-act="setup">
        <span class="icon">🎩</span><h3>קריירה</h3><p>מהשכונה ועד הצמרת</p><span class="go">קריירה חדשה ←</span>
      </button>
      <button class="card mode" data-act="${done ? 'show-daily' : 'setup'}" data-arg="daily">
        <span class="mode-top"><span class="icon">📅</span><b class="daynum">#${day}</b></span>
        <h3>האתגר היומי</h3><p>אותם הימורים לכולם, יום אחד</p>
        <span class="go">${done ? `שיחקת היום · ציון ${done.score}` : 'לשחק'} ←</span>
      </button>
    </div>
    <button class="card banner" data-act="records">
      <span class="icon">🏆</span>
      <span><b>השיאים שלך</b><small>${best ? `הכי רחוק: ${G.ENDINGS[best.end].title} · ציון ${best.score}` : 'עוד לא שיחקת אף קריירה'}</small></span>
      <span class="go">←</span>
    </button>
  </main>`;
}

function setupView() {
  const f = ui.female, name = ui.name || '';
  return `<main class="card setup">
    <h2 class="setup-title">${ui.daily ? `האתגר היומי #${ui.daily}` : 'יום ראשון בשכונה'}</h2>
    <div class="setup-grid">
      <div class="form">
        <div class="stamp">תיק פלילי · נפתח היום</div>
        <h1>משליח <em>לסנדק.</em></h1>
        <p class="muted">${t('{חתום|חתמי}')} על התיק ונתחיל.</p>
        <label for="name">השם שלך</label>
        <div class="row">
          <input id="name" maxlength="14" placeholder="שם" value="${esc(name)}" autocomplete="off">
          <div class="seg">
            <button data-act="gender" data-arg="0" class="${f ? '' : 'on'}">גבר</button>
            <button data-act="gender" data-arg="1" class="${f ? 'on' : ''}">אישה</button>
          </div>
        </div>
        <p class="hint"><b>איך זה עובד:</b> כל סיבוב הוא שנתיים. דילמה, הימור, ודוח. מגיל 18 ועד 60, אם לא ${t('{תיעצר|תיעצרי}')} קודם.</p>
      </div>
      <div class="mugshot">
        <div class="heights">${[200, 190, 180, 170, 160, 150].map(h => `<span>${h}</span>`).join('')}</div>
        <svg class="who" viewBox="0 0 100 100"><circle cx="50" cy="36" r="18"/><path d="M14 100c0-24 16-38 36-38s36 14 36 38z"/></svg>
        <div class="placard"><small>תיק מס׳ ${String(G.dayNumber()).padStart(4, '0')}-${Math.abs(hash(name)) % 1000}</small><b id="placard-name">${esc(name) || 'שם'}</b><small>${new Date().toLocaleDateString('he-IL')}</small></div>
      </div>
    </div>
    <div class="footer">
      <button class="btn ghost" data-act="home">חזרה</button>
      <button class="btn primary" id="start" data-act="start" ${name.trim() ? '' : 'disabled'}>${t('{בחר|בחרי}')} גורל ←</button>
    </div>
  </main>`;
}
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function gameView() {
  const rank = G.RANKS[G.rankOf(s.respect)][1];
  return `<header class="card topbar">
      <div class="who-bar">${ring(s.respect, 44)}<div><b>${esc(s.name)}</b><small>${rank} · גיל ${s.age}</small></div></div>
      <div class="cash-bar"><div><b>${money(s.cash)}</b><small>🔥 חום ${s.heat}</small></div><button class="x" data-act="quit" aria-label="יציאה">✕</button></div>
    </header>
    <div class="board">
      <section class="card panel">${{ dilemma: dilemmaView, roll: rollView, report: reportView }[ui.view]()}</section>
      <aside class="card panel sidebar">${sideView()}</aside>
    </div>`;
}

function dilemmaView() {
  const e = ui.event;
  return `<div class="kicker"><span>${e.jail ? 'בית המעצר' : 'דילמה'}</span><hr></div>
    ${ui.raid ? '<div class="alert">🚨 החום הגיע ל-100. פשיטה בשש בבוקר.</div>' : ''}
    <h2>${t(e.title.replace('{n}', years(s.pending)))}</h2>
    <p class="sub">${t(e.sub)}</p>
    ${s.heat && !e.jail ? `<p class="heat-note">🔥 חום ${s.heat}: כל הימור קשה יותר ב-${Math.round(s.heat / 3)}%</p>` : ''}
    <div class="options">${e.options.map(optionView).join('')}</div>`;
}

function optionView(o, i) {
  const c = G.chanceOf(s, o), risky = c < 100;
  return `<button class="option" data-act="choose" data-arg="${i}">
    <div class="opt-head"><span class="letter">${LETTERS[i]}</span><b>${t(o.label)}</b><span class="tag ${risky ? '' : 'safe'}">${risky ? 'הימור' : 'בטוח'}</span></div>
    ${risky ? `<div class="split"><i style="width:${c}%"></i></div>` : ''}
    <div class="sides">
      <div class="side">${risky ? `<b class="good">● ${c}%</b>` : ''}<div>${chips(o.win)}</div></div>
      ${risky ? `<div class="side lose"><b class="bad">${100 - c}% ●</b><div>${chips(o.lose)}</div></div>` : ''}
    </div>
  </button>`;
}

function rollView() {
  const { o, res } = ui, L = Math.PI * 86, fail = 100 - res.chance;
  return `<div class="roll">
    <small class="muted">הרחוב החליט</small>
    <h3>${t(o.label)}</h3>
    <svg class="gauge" viewBox="0 0 200 112">
      <path d="M14 100 A86 86 0 0 1 186 100" class="g-good"/>
      <path d="M14 100 A86 86 0 0 1 186 100" class="g-bad" stroke-dasharray="${L * fail / 100} ${L}"/>
      <line id="needle" x1="100" y1="100" x2="100" y2="26"/>
      <circle cx="100" cy="100" r="8"/>
    </svg>
    <div class="sides">
      <div class="side"><b class="good">● ${res.chance}%</b><div>${chips(o.win)}</div></div>
      ${fail ? `<div class="side lose"><b class="bad">${fail}% ●</b><div>${chips(o.lose)}</div></div>` : ''}
    </div>
    <div id="verdict" class="verdict ${res.win ? 'good' : 'bad'}" hidden>
      <small>המחוג נעצר על ה-${res.win ? res.chance : fail}%</small>
      <p>${t(res.text)}</p>
    </div>
    <button class="btn primary wide" id="cont" data-act="next" hidden>המשך ←</button>
  </div>`;
}

function reportView() {
  const b = ui.before, r = ui.report, rb = G.rankOf(b.respect), ra = G.rankOf(s.respect);
  const title = 'served' in r ? (r.served ? `${years(r.served)} מאחורי סורג ובריח` : 'בחוץ, בלי לשבת יום') : `סיבוב ${s.history.length} נגמר`;
  return `<div class="kicker"><span>${'served' in r ? 'שחרור' : 'הדוח הדו-שנתי'}</span><hr></div>
    <div class="report-head"><h2>${title}</h2><span class="pill">גיל ${b.age} ← ${s.age}</span></div>
    <div class="tiles">
      <div class="tile"><small>כבוד</small><b>${s.respect}</b>${delta(s.respect - b.respect)}</div>
      <div class="tile"><small>כסף</small><b class="${s.cash < 0 ? 'bad' : 'good'}">${money(s.cash)}</b>${delta(s.cash - b.cash, 1, money)}</div>
      <div class="tile"><small>חום</small><b>${s.heat}</b>${delta(s.heat - b.heat, -1)}</div>
      <div class="tile"><small>${r.income ? 'הכנסה' : 'שנים בכלא'}</small><b>${r.income ? money(r.income) : s.jailYears}</b><small>${r.income ? 'לשנתיים' : 'סה״כ'}</small></div>
    </div>
    ${ra !== rb ? `<div class="rankup ${ra > rb ? '' : 'down'}">${ra > rb ? '🎖️ עלית בדרגה' : '⬇️ ירדת בדרגה'}: <b>${G.RANKS[ra][1]}</b></div>` : ''}
    <div class="headline"><small>הכותרת של הסיבוב</small>${ui.lines.map(l => `<p>${l}</p>`).join('')}</div>
    <button class="btn primary wide" data-act="after-report">${G.checkEnd(s) ? 'לסיכום הקריירה' : 'לסיבוב הבא'} ←</button>`;
}

function sideView() {
  const rk = G.rankOf(s.respect);
  return `<div class="profile">${ring(s.respect, 76)}<div><h2>${esc(s.name)}</h2><p>${G.RANKS[rk][1]}</p><small>סיבוב ${s.history.length + 1} · גיל ${s.age}</small></div></div>
    <div class="stats">
      <div class="stat"><small>הכנסה</small><b>${money(G.INCOME[rk])}</b><small>לשנה</small></div>
      <div class="stat"><small>מזומן</small><b class="${s.cash < 0 ? 'bad' : 'good'}">${money(s.cash)}</b></div>
      <div class="stat"><small>חום</small><b>${s.heat}</b><div class="meter"><i style="width:${s.heat}%"></i></div></div>
      <div class="stat"><small>שנים בכלא</small><b>${s.jailYears}</b></div>
    </div>
    <h3>הקריירה עד עכשיו</h3>
    <table><thead><tr><th>גיל</th><th>אירוע</th><th>תוצאה</th><th>כבוד</th></tr></thead><tbody>
    ${s.history.length ? s.history.slice().reverse().map(h => `<tr><td><span class="age">${h.age}</span></td><td>${h.tag}</td><td>${ICON[h.result]}${h.years ? ' ' + years(h.years) : ''}</td><td>${h.respect}</td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">הקריירה עוד לא התחילה</td></tr>'}
    </tbody></table>`;
}

function endView(r) {
  const E = G.ENDINGS[r.end];
  return `<main class="card end">
    <div class="end-emoji">${E.emoji}</div>
    <small class="muted">${r.daily ? `האתגר היומי #${r.daily}` : 'סוף הקריירה'} · ${esc(r.name)}</small>
    <h1>${E.title}</h1>
    <p>${G.gender(E.text, r.female)}</p>
    <div class="tiles four">
      <div class="tile"><small>ציון</small><b>${r.score}</b></div>
      <div class="tile"><small>כבוד</small><b>${r.respect}</b></div>
      <div class="tile"><small>כסף</small><b>${money(r.cash)}</b></div>
      <div class="tile"><small>שנים בכלא</small><b>${r.jailYears}</b></div>
    </div>
    <div class="trail">${r.trail}</div>
    <div class="footer">
      <button class="btn ghost" data-act="home">לדף הבית</button>
      <button class="btn ghost" data-act="share">שיתוף</button>
      <button class="btn primary" data-act="setup">קריירה חדשה ←</button>
    </div>
  </main>`;
}

function introSheet() {
  return `<h3>ארבעה דברים שכדאי לדעת</h3>
    <ul class="legend">
      <li><i style="background:var(--brand)"></i><b>כבוד:</b> הציון שלך ברחוב. ב-100 ${t('{אתה|את}')} סנדק. ב-0 אף אחד לא עונה לך לטלפון.</li>
      <li><i style="background:var(--amber)"></i><b>חום:</b> כמה המשטרה מסתכלת עליך. כל נקודה מקשה על ההימורים, וב-100 יש פשיטה.</li>
      <li><i style="background:var(--green)"></i><b>כסף:</b> הכנסה קבועה לפי הדרגה, ועוד מה שתרוויח${t('{|י}')} בהימורים.</li>
      <li><i style="background:var(--ink)"></i><b>כלא:</b> חלק מההימורים נגמרים בגזר דין 🔒. השנים רצות, ובגיל 60 המשחק נגמר.</li>
    </ul>
    <div class="note">מתחת לכל תשובה: ▲ עולה, ▼ יורד, וכמה שיותר חצים, יותר. <b class="good">ירוק</b> טוב לך, <b class="bad">אדום</b> פחות.</div>
    <button class="btn primary wide" data-act="close-sheet">${t('הבנתי, {יוצא|יוצאת} לרחוב')}</button>`;
}

function recordsSheet() {
  const best = store.get('best', []);
  return `<h3>השיאים שלך</h3>
    ${best.length ? `<table><thead><tr><th>ציון</th><th>שם</th><th>סוף</th><th>גיל</th></tr></thead><tbody>
      ${best.map(r => `<tr><td><b>${r.score}</b></td><td>${esc(r.name)}</td><td>${G.ENDINGS[r.end].emoji} ${G.ENDINGS[r.end].title}</td><td>${r.age}</td></tr>`).join('')}
    </tbody></table>` : '<p class="muted">עוד אין שיאים. הרחוב מחכה.</p>'}
    <button class="btn primary wide" data-act="close-sheet">סגירה</button>`;
}

function render() {
  const v = ui.view;
  app.innerHTML = (!v ? homeView() : v === 'setup' ? setupView() : v === 'end' ? endView(ui.result) : gameView())
    + (ui.sheet ? `<div class="overlay" data-act="close-sheet"></div><div class="sheet">${ui.sheet}</div>` : '');
  if (v !== lastView) scrollTo(0, 0);
  lastView = v;
}

// ── flow ──

function nextRound() {
  ui.before = { respect: s.respect, cash: s.cash, heat: s.heat, age: s.age };
  ui.event = G.nextEvent(s);
  ui.view = 'dilemma';
  ui.raid = false;
  render();
}

function animateRoll() {
  const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id) || {}; // player may have quit mid-spin
  const turn = `rotate(${-90 + ui.res.roll * 1.8}deg)`;
  requestAnimationFrame(() => requestAnimationFrame(() => { ($('needle').style || {}).transform = turn; }));
  setTimeout(() => { $('verdict').hidden = $('cont').hidden = false; }, fast ? 100 : 1700);
}

function finish(end) {
  const r = {
    end, name: s.name, female: s.female, daily: s.daily, score: G.score(s),
    age: s.age, respect: s.respect, cash: s.cash, jailYears: s.jailYears,
    trail: s.history.map(h => ICON[h.result]).join(''),
  };
  if (s.daily) store.set('daily-' + s.daily, r);
  store.set('best', [...store.get('best', []), r].sort((a, b) => b.score - a.score).slice(0, 5));
  s = null;
  ui = { view: 'end', result: r };
  render();
}

async function share(r, btn) {
  const E = G.ENDINGS[r.end];
  const text = `מאפיונר${r.daily ? ' #' + r.daily : ''}\n${E.emoji} ${E.title} · ציון ${r.score} · גיל ${r.age}\n${r.trail}\n${location.origin + location.pathname}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); btn.textContent = 'הועתק ✓'; }
  } catch {}
}

const ACT = {
  home() { s = null; ui = {}; render(); },
  setup(arg) {
    ui = { view: 'setup', daily: arg === 'daily' ? G.dayNumber() : 0, name: store.get('name', ''), female: store.get('female', false) };
    render();
    document.getElementById('name').focus();
  },
  gender(arg) { ui.female = arg === '1'; render(); },
  start() {
    const name = ui.name.trim();
    if (!name) return;
    store.set('name', name);
    store.set('female', ui.female);
    s = G.newGame({ name, female: ui.female, daily: ui.daily });
    ui = { sheet: introSheet() };
    nextRound();
  },
  choose(i) {
    ui.o = ui.event.options[i];
    ui.res = G.play(s, ui.o);
    ui.view = 'roll';
    render();
    animateRoll();
  },
  next() {
    const line = `<b>${t(ui.o.label)}:</b> ${t(ui.res.text)}`;
    const wasJail = ui.event.jail;
    const n = G.advance(s, ui.event, ui.res);
    ui.lines = wasJail ? [...ui.lines, line] : [line];
    if (n.jail) Object.assign(ui, { event: n.jail, raid: n.raid, view: 'dilemma' });
    else Object.assign(ui, { report: n, view: 'report' });
    render();
  },
  'after-report'() {
    const end = G.checkEnd(s);
    end ? finish(end) : nextRound();
  },
  'close-sheet'() { ui.sheet = null; render(); },
  records() { ui.sheet = recordsSheet(); render(); },
  quit() { if (confirm('לעזוב את המשחק? הקריירה הזאת תימחק.')) ACT.home(); },
  share(_, btn) { share(ui.result, btn); },
  'show-daily'() { ui = { view: 'end', result: store.get('daily-' + G.dayNumber()) }; render(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) ACT[el.dataset.act](el.dataset.arg, el);
});
document.addEventListener('input', e => {
  if (e.target.id !== 'name') return;
  ui.name = e.target.value;
  document.getElementById('placard-name').textContent = ui.name || 'שם';
  document.getElementById('start').disabled = !ui.name.trim();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'name') ACT.start();
});

render();
