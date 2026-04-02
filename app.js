// app.js — global state S, event handlers, navigation, init
window.onerror = function(msg, src, line, col, err) {
  let box = document.getElementById('_err');
  if (!box) {
    box = document.createElement('div');
    box.id = '_err';
    box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#1e1e1e;color:#f87171;font:11px/1.5 monospace;padding:10px 14px;max-height:140px;overflow:auto;border-top:2px solid #ef4444';
    document.body.appendChild(box);
  }
  box.innerHTML += '<div>⚠️  ' + msg + '<br><span style="color:#94a3b8">L' + line + ':' + col + ' · ' + (src||'').split('/').pop() + '</span>' +
    (err && err.stack ? '<br><span style="color:#fbbf24">' + err.stack.split('\n').slice(0,2).join(' | ') + '</span>' : '') + '</div>';
  return false;
};
// ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 
// STATE ? single source of truth
// ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 
const S = {
  day: 'on',
  planTab: 'on',
  altSel: {},
  weightLog: [],
  notes: {},
  noteSearch: '',
  profHist: {},
  doneByDate: {},
  statsRange: '30d',
  calOffset: 0,
  selDate: null,
  onDays: [1, 3, 5],
  // ? ?  Misurazioni corpo (append-only, non sovrascrivono mai) ? ? 
  measurements: [],
  // ? ?  Obiettivo / fase ? ? 
  goal: { phase: 'bulk', startDate: null, targetWeight: null, notes: '', calibrationOffsetKcal: 0, calibrationMeta: null },
  // ? ?  Integratori ? ? 
  supplements: [],
  cheatMealsByDate: {},
  cheatConfig: {
    enabled: true,
    weeklyMax: 2,
    hardMax: 3,
    defaultMode: 'surplus_pct',
    surplusPct: 12,
    fixedKcal: 350,
  },
  suppChecked: {},  // {'2026-03-17': ['creatina']}
  water: {},        // {'2026-03-17': 3}  (bicchieri)
  lastCheckin: null,
  weeklyCheckinWarmupWeek: null,
  barcodeCache: {}, // { barcode: { barcode,name,brand,quantity,kcal100,p100,c100,f100,cachedAt } }
  foodCache: {},  // {query: [{name,brand,kcal100,p100,c100,f100,src}]}
  foodSearchLearn: {}, // { itemKey: { count, lastPickedAt, queries: { queryKey: count }, contexts: { key: count } } }
  customFoods: [], // alimenti aggiunti manualmente dall'utente
  favoriteFoods: [], // cibi preferiti per i suggerimenti smart alert serali
  foodLog:   {},
  extraMealsActive: {},  // { 'dateKey': { merenda: true, spuntino: true } } — per-day, not persistent
  mealPlanner: {
    on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
    off:{ mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
  },
  pianoUi: {
    activeMealFilter: 'all',
    templateSort: 'useful_now',
    helperExpanded: true,
  },
  authEntryCompleted: null,
  onboardingCompleted: null,
  onboardingVersion: 1,
  templates: [
    {id:'t1',name:'Colazione standard',tag:'colazione',mealType:'colazione',items:[
      {name:'Yogurt greco 0%',brand:'Fage',grams:200,kcal100:57,p100:10,c100:3.5,f100:0.2},
      {name:'Banana',brand:'',grams:120,kcal100:89,p100:1.1,c100:23,f100:0.3},
      {name:'Miele millefiori',brand:'',grams:15,kcal100:304,p100:0.3,c100:82,f100:0},
    ]},
    {id:'t2',name:'Pranzo proteico',tag:'pranzo',mealType:'pranzo',items:[
      {name:'Riso bianco secco',brand:'Scotti',grams:100,kcal100:355,p100:7,c100:79,f100:0.6},
      {name:'Petto di pollo crudo',brand:'',grams:200,kcal100:110,p100:23,c100:0,f100:1.5},
      {name:'Olio EVO',brand:'',grams:10,kcal100:884,p100:0,c100:0,f100:100},
    ]},
    {id:'t3',name:'Cena leggera OFF',tag:'cena',mealType:'cena',items:[
      {name:'Petto di pollo cotto',brand:'Amadori',grams:180,kcal100:165,p100:31,c100:0,f100:3.6},
      {name:'Spinaci freschi',brand:'',grams:200,kcal100:23,p100:2.9,c100:3.6,f100:0.4},
      {name:'Olio EVO',brand:'',grams:10,kcal100:884,p100:0,c100:0,f100:100},
    ]},
  ],
  profilo: [
    {l:'Nome',              v:'Da impostare',         n:''},
    {l:'Età',               v:'Da impostare',         n:''},
    {l:'Altezza',           v:'Da impostare',         n:''},
    {l:'Peso attuale',      v:'Da impostare',         n:''},
    {l:'Professione',       v:'Da impostare',         n:''},
    {l:'Sonno',             v:'Da impostare',         n:''},
    {l:'Attività fisica',   v:'Da impostare',         n:''},
    {l:'Fastidio digestivo',v:'Da impostare',         n:''},
  ],
  anagrafica: {
    nome:            '',
    sesso:           'm',
    eta:             null,
    altezza:         null,
    peso:            null,
    passiGiornalieri: null,
    grassoCorporeo:  null,
    professione:     'desk_sedentary',
    allenamentiSett: '3-4',
  },
  macro: {
    on: {p:130,c:295,f:70,k:2350},
    off:{p:130,c:235,f:70,k:2100},
  },
  // Each meal: {icon, name, time, ingr, kcal, p, c, f}
  meals: {
    on:[
      {icon:'🥣 ',name:'Colazione',        time:'06:30 – 06:45',               items:[
        {name:'Yogurt greco intero',  grams:200, kcal100:61,  p100:10,  c100:3.5, f100:3.3},
        {name:'Banana',               grams:120, kcal100:89,  p100:1.1, c100:23,  f100:0.3},
        {name:'Miele',                grams:15,  kcal100:304, p100:0.3, c100:82,  f100:0},
        {name:'Caffè nero',           grams:0,   kcal100:2,   p100:0.1, c100:0,   f100:0},
      ]},
      {icon:'🍽️ ',name:'Pranzo',         time:'12:30 – 13:00',               items:[
        {name:'Pasta/riso secco',     grams:100, kcal100:355, p100:12,  c100:72,  f100:1.5},
        {name:'Olio EVO',             grams:10,  kcal100:884, p100:0,   c100:0,   f100:100},
        {name:'Parmigiano',           grams:10,  kcal100:392, p100:33,  c100:0,   f100:28},
        {name:'Pollo/tacchino',       grams:220, kcal100:110, p100:23,  c100:0,   f100:1.5},
        {name:'Pane',                 grams:40,  kcal100:265, p100:9,   c100:53,  f100:2},
      ]},
      {icon:'⚡ ',name:'Spuntino pre-wkt',time:'17:15 – 17:30 (90 min prima)',items:[
        {name:'Yogurt greco',         grams:170, kcal100:61,  p100:10,  c100:3.5, f100:3.3},
        {name:'Banana',               grams:120, kcal100:89,  p100:1.1, c100:23,  f100:0.3},
        {name:'Gallette di riso',     grams:20,  kcal100:387, p100:7,   c100:82,  f100:2.5},
      ]},
      {icon:'🍳 ',name:'Cena post-wkt',  time:'20:45 – 21:15',               items:[
        {name:'Petto di pollo crudo', grams:220, kcal100:110, p100:23,  c100:0,   f100:1.5},
        {name:'Riso secco',           grams:120, kcal100:355, p100:7,   c100:79,  f100:0.6},
        {name:'Olio EVO',             grams:15,  kcal100:884, p100:0,   c100:0,   f100:100},
        {name:'Mela',                 grams:150, kcal100:52,  p100:0.3, c100:14,  f100:0.2},
      ]},
    ],
    off:[
      {icon:'🥣 ',name:'Colazione',        time:'06:30 – 06:45',items:[
        {name:'Yogurt greco',         grams:200, kcal100:61,  p100:10,  c100:3.5, f100:3.3},
        {name:'Mela',                 grams:150, kcal100:52,  p100:0.3, c100:14,  f100:0.2},
        {name:'Miele',                grams:10,  kcal100:304, p100:0.3, c100:82,  f100:0},
        {name:'Caffè nero',           grams:0,   kcal100:2,   p100:0.1, c100:0,   f100:0},
      ]},
      {icon:'🍽️ ',name:'Pranzo',           time:'12:30 – 13:00',items:[
        {name:'Pasta/riso secco',     grams:90,  kcal100:355, p100:12,  c100:72,  f100:1.5},
        {name:'Olio EVO',             grams:10,  kcal100:884, p100:0,   c100:0,   f100:100},
        {name:'Parmigiano',           grams:10,  kcal100:392, p100:33,  c100:0,   f100:28},
        {name:'Pollo/tacchino',       grams:220, kcal100:110, p100:23,  c100:0,   f100:1.5},
        {name:'Pane',                 grams:30,  kcal100:265, p100:9,   c100:53,  f100:2},
      ]},
      {icon:'🍎 ',name:'Spuntino pom.',    time:'17:00 – 17:30',items:[
        {name:'Yogurt greco',         grams:170, kcal100:61,  p100:10,  c100:3.5, f100:3.3},
        {name:'Mela',                 grams:150, kcal100:52,  p100:0.3, c100:14,  f100:0.2},
        {name:'Gallette di riso',     grams:10,  kcal100:387, p100:7,   c100:82,  f100:2.5},
      ]},
      {icon:'🍳 ',name:'Cena',             time:'20:00 – 20:30',items:[
        {name:'Petto di pollo crudo', grams:220, kcal100:110, p100:23,  c100:0,   f100:1.5},
        {name:'Riso secco',           grams:85,  kcal100:355, p100:7,   c100:79,  f100:0.6},
        {name:'Olio EVO',             grams:15,  kcal100:884, p100:0,   c100:0,   f100:100},
        {name:'Banana',               grams:120, kcal100:89,  p100:1.1, c100:23,  f100:0.3},
      ]},
    ],
  },
  // Alternatives per meal slot ? keyed by meal index only (shared across ON/OFF)
  // key = string index '0','1','2','3'
  alts: {
    '0':[
      {label:'Standard',    ingr:'Yogurt greco 200 g + banana 120 g + miele 15 g + caffè', kcal:320,p:20,c:45,f:7},
      {label:'Uova',        ingr:'2 uova strapazzate + pane tostato 80 g + caffè',          kcal:300,p:16,c:36,f:12},
      {label:'Pane+ricotta',ingr:'Pane azzimo 75 g + ricotta 50 g + mela 150 g + miele',   kcal:310,p:12,c:48,f:6},
      {label:'Light',       ingr:'Yogurt greco 200 g + caffè (versione leggera)',            kcal:130,p:18,c:8, f:5},
    ],
    '2':[
      {label:'Standard', ingr:'Yogurt greco 170 g + banana 120 g + gallette riso 20 g',    kcal:270,p:18,c:42,f:4},
      {label:'Alt.1',    ingr:'Yogurt greco 170 g + mela 150 g + miele 10 g + gallette',   kcal:250,p:18,c:38,f:4},
      {label:'Alt.2',    ingr:'Gallette riso 20 g + fesa tacchino 60 g + banana 100 g',    kcal:240,p:20,c:35,f:3},
      {label:'Alt.3',    ingr:'Banana 120 g + burro arachidi 10 g + 1 fetta pane tostato', kcal:260,p:8, c:42,f:8},
    ],
  },
};

const ANAG_RULES = {
  nome: { maxLength: 40 },
  eta: { min: 10, max: 99, label: 'Età', unit: 'anni' },
  altezza: { min: 120, max: 250, label: 'Altezza', unit: 'cm' },
  peso: { min: 30, max: 300, label: 'Peso', unit: 'kg' },
  passiGiornalieri: { min: 1000, max: 40000, label: 'Passi medi', unit: 'passi' },
  grassoCorporeo: { min: 3, max: 60, label: 'Grasso corporeo', unit: '%' },
};

let _weeklyCheckinDeferredWeek = null;
const TODAY_GREETING_REFRESH_MS = 30000;
let _todayGreetingTimer = null;

function pulseTodayElement(selector, className = 'ui-bump') {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    setTimeout(() => el.classList.remove(className), 700);
  });
}
function revealTodayElement(selector, className = 'ui-glow') {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pulseTodayElement(selector, className);
  });
}
function performAfterReveal(selector, action, { className = 'ui-glow', delay = 360, fallbackSelector = null } = {}) {
  requestAnimationFrame(() => {
    const el = document.querySelector(selector) || (fallbackSelector ? document.querySelector(fallbackSelector) : null);
    if (!el) {
      action?.();
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      action?.();
      pulseTodayElement(selector, className);
      if (fallbackSelector) pulseTodayElement(fallbackSelector, className);
    }, delay);
  });
}
function addWaterAndReveal(delta = 1) {
  if (delta <= 0) {
    addWater(delta);
    return;
  }
  performAfterReveal('#water-widget .water-widget', () => addWater(delta), { className: 'ui-glow', delay: 430 });
}
function toggleSuppAndReveal(id) {
  performAfterReveal(
    `[data-supp-id="${id}"]`,
    () => toggleSupp(id),
    { className: 'ui-glow', delay: 320, fallbackSelector: '#current-meal-focus .current-meal-focus' }
  );
}
function revealTodaySupplement(id) {
  performAfterReveal(
    `[data-supp-id="${id}"]`,
    null,
    { className: 'ui-glow', delay: 120, fallbackSelector: '#supp-today' }
  );
}
function refreshTodayAlertSurfaces() {
  const active = document.querySelector('.view.active')?.id;
  if (active !== 'view-today') return;
  const dateKey = S.selDate || localDate();
  const mealState = getCurrentMealState(S.day, dateKey);
  const alertModel = splitTodayAlerts(S.day, dateKey);
  renderCurrentMealFocus(S.day, mealState, dateKey, alertModel);
  renderDashboardAlertSummary(S.day, dateKey);
  renderSupportAlerts(S.day, dateKey);
}
function resolveSupportSupplementAlert(id, triggerEl) {
  const alertEl = triggerEl?.closest('.today-context-alert');
  if (!alertEl) {
    toggleSupp(id);
    refreshTodayAlertSurfaces();
    return;
  }
  const h = alertEl.offsetHeight;
  alertEl.style.height = `${h}px`;
  void alertEl.offsetHeight;
  alertEl.classList.add('is-resolving');
  setTimeout(() => {
    toggleSupp(id);
    refreshTodayAlertSurfaces();
  }, 220);
}

function refreshTodayGreetingOnly() {
  const todayView = document.getElementById('view-today');
  if (!todayView || !todayView.classList.contains('active')) return;
  if (typeof renderGreeting !== 'function') return;
  renderGreeting(S.day, new Date());
}
function stopTodayGreetingAutoRefresh() {
  if (_todayGreetingTimer) {
    clearInterval(_todayGreetingTimer);
    _todayGreetingTimer = null;
  }
}
function startTodayGreetingAutoRefresh() {
  stopTodayGreetingAutoRefresh();
  const todayView = document.getElementById('view-today');
  if (!todayView || !todayView.classList.contains('active')) return;
  if (document.visibilityState === 'hidden') return;
  _todayGreetingTimer = setInterval(() => {
    refreshTodayGreetingOnly();
  }, TODAY_GREETING_REFRESH_MS);
}
function syncTodayGreetingAutoRefresh() {
  if (document.visibilityState === 'hidden') {
    stopTodayGreetingAutoRefresh();
    return;
  }
  startTodayGreetingAutoRefresh();
}
function syncLoggedMealState(dateKey, mealIdx, type = S.day) {
  const isMealIndex = typeof mealIdx === 'number' || typeof mealIdx === 'string';
  if (!isMealIndex) return;
  syncDoneByDate(dateKey, type);
}
let _modalConfirmFn = null;
let _uiScrollLockDepth = 0;
let _uiScrollLockY = 0;
let _greetingTransitionTimer = null;

function lockUiScroll() {
  const body = document.body;
  if (!body) return;
  if (_uiScrollLockDepth === 0) {
    _uiScrollLockY = window.scrollY || window.pageYOffset || 0;
    body.style.top = `-${_uiScrollLockY}px`;
    body.classList.add('ui-scroll-locked');
  }
  _uiScrollLockDepth += 1;
}

function unlockUiScroll(force = false) {
  const body = document.body;
  if (!body) return;
  if (force) _uiScrollLockDepth = 0;
  else _uiScrollLockDepth = Math.max(0, _uiScrollLockDepth - 1);
  if (_uiScrollLockDepth > 0) return;
  body.classList.remove('ui-scroll-locked');
  body.style.top = '';
  window.scrollTo(0, _uiScrollLockY || 0);
}

function scrollMealCardIntoView(type, mealIdx, { behavior = 'smooth', focusAdd = false } = {}) {
  if (typeof mealIdx !== 'number' && typeof mealIdx !== 'string') return;
  const domKey = typeof mealIdx === 'string' ? `extra-${mealIdx}` : `${type}-${mealIdx}`;
  const card = document.getElementById(`mc-${domKey}`);
  if (!card) return;
  const target = focusAdd ? card.querySelector('.mc-add-btn') || card : card;
  const rect = target.getBoundingClientRect();
  const navHeight = document.querySelector('.nav')?.offsetHeight || 56;
  const tabsHeight = document.querySelector('.nav-tabs')?.offsetHeight || 56;
  const topOffset = navHeight + tabsHeight + 18;
  const nextTop = window.scrollY + rect.top - topOffset;
  window.scrollTo({ top: Math.max(0, nextTop), behavior });
  pulseTodayElement(`#mc-${domKey}`);
}

function scheduleGreetingStateTransition(prevType, nextType) {
  const greetingEl = document.getElementById('today-greeting');
  if (!greetingEl || !prevType || !nextType || prevType === nextType) return;
  greetingEl.dataset.prevDayState = prevType;
  greetingEl.dataset.dayState = nextType;
  greetingEl.classList.add('is-switching-day', `switching-from-${prevType}`, `switching-to-${nextType}`);
  if (_greetingTransitionTimer) clearTimeout(_greetingTransitionTimer);
  _greetingTransitionTimer = setTimeout(() => {
    greetingEl.classList.remove(
      'is-switching-day',
      `switching-from-${prevType}`,
      `switching-to-${nextType}`
    );
  }, 780);
}

function showDayModal({icon, title, body, onConfirm, danger = false, noButtons = false, eyebrow = '', modalClass = '', confirmText = 'Procedi comunque', cancelText = 'Annulla'}) {
  document.getElementById('day-modal-icon').textContent  = icon;
  const eyebrowEl = document.getElementById('day-modal-kicker');
  if (eyebrowEl) {
    eyebrowEl.textContent = eyebrow;
    eyebrowEl.style.display = eyebrow ? 'block' : 'none';
  }
  const titleEl = document.getElementById('day-modal-title');
  titleEl.textContent = title;
  titleEl.style.color = danger ? 'var(--red)' : '';
  const bodyEl = document.getElementById('day-modal-body');
  bodyEl.innerHTML = body;
  const confirmBtn = document.getElementById('day-modal-confirm');
  const cancelBtn = document.querySelector('#day-modal-footer .day-modal-btn-secondary');
  confirmBtn.textContent = confirmText;
  confirmBtn.style.background = danger ? 'var(--red)' : 'var(--ink)';
  if (cancelBtn) cancelBtn.textContent = cancelText;
  const footer  = document.getElementById('day-modal-footer');
  const closeX  = document.getElementById('day-modal-close-x');
  const card    = document.getElementById('day-modal-card');
  if (card) card.className = `day-modal-card${modalClass ? ` ${modalClass}` : ''}`;
  footer.style.display  = noButtons ? 'none' : 'flex';
  closeX.style.display  = noButtons ? 'flex' : 'none';
  if (card) {
    card.style.maxWidth = noButtons ? '430px' : '340px';
  }
  bodyEl.style.marginBottom = noButtons ? '0' : '20px';
  _modalConfirmFn = onConfirm;
  const ov = document.getElementById('day-modal-ov');
  ov.style.display = 'flex';
  lockUiScroll();
  confirmBtn.onclick = () => {
    const fn = _modalConfirmFn; // capture before closeDayModal nulls it
    closeDayModal();
    if (fn) fn();
  };
}

function formatAuthConflictTime(iso) {
  if (!iso) return 'data non disponibile';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return 'data non disponibile';
  }
}

function getAuthConflictBadge(conflict, source) {
  const localAt = Date.parse(conflict?.localUpdatedAt || 0) || 0;
  const remoteAt = Date.parse(conflict?.remoteUpdatedAt || 0) || 0;
  if (!localAt || !remoteAt || localAt === remoteAt) return '';
  if (source === 'local' && localAt > remoteAt) return '<span class="sync-choice-badge">piu recente</span>';
  if (source === 'remote' && remoteAt > localAt) return '<span class="sync-choice-badge">piu recente</span>';
  return '';
}

function getAuthConflictPresenceChip(conflict, source) {
  const state = source === 'local' ? conflict?.localState : conflict?.remoteState;
  const fallback = { label: 'Stato non chiaro', cls: 'unknown' };
  const presence = typeof authDescribeStatePresence === 'function'
    ? authDescribeStatePresence(state)
    : fallback;
  const label = htmlEsc(presence?.label || fallback.label);
  const cls = presence?.cls ? ` ${presence.cls}` : '';
  return `<span class="sync-choice-presence${cls}">${label}</span>`;
}

function askAuthStateConflictChoice(conflict) {
  return new Promise(resolve => {
    const localTime = htmlEsc(formatAuthConflictTime(conflict.localUpdatedAt));
    const remoteTime = htmlEsc(formatAuthConflictTime(conflict.remoteUpdatedAt));
    showDayModal({
      icon: '🔄',
      eyebrow: 'Accesso account',
      title: 'Abbiamo trovato due versioni dei tuoi dati',
      body: `
        <div class="sync-choice-lead">Scegli da quale versione vuoi ripartire adesso.</div>
        <div class="sync-choice-stack">
          <div class="sync-choice-item">
            <div class="sync-choice-item-top">
              <span class="sync-choice-chip">Questo telefono</span>
              ${getAuthConflictBadge(conflict, 'local')}
              ${getAuthConflictPresenceChip(conflict, 'local')}
            </div>
            <div class="sync-choice-time">${localTime}</div>
            <div class="sync-choice-copy">Mantieni i dati presenti su questo dispositivo e li rimandiamo poi nel cloud.</div>
          </div>
          <div class="sync-choice-sep">oppure</div>
          <div class="sync-choice-item">
            <div class="sync-choice-item-top">
              <span class="sync-choice-chip">Cloud</span>
              ${getAuthConflictBadge(conflict, 'remote')}
              ${getAuthConflictPresenceChip(conflict, 'remote')}
            </div>
            <div class="sync-choice-time">${remoteTime}</div>
            <div class="sync-choice-copy">Carica i dati gia salvati online e usa quelli come base.</div>
          </div>
        </div>
        <div class="sync-choice-foot">Scegli sempre la versione che contiene davvero i tuoi dati. Se una delle due risulta vuota, evita quella.</div>
      `,
      confirmText: 'Riparti dal cloud',
      cancelText: 'Tieni questo telefono',
      onConfirm: () => resolve('remote'),
      modalClass: 'day-modal-detail day-modal-sync-choice',
    });
    const cancelBtn = document.querySelector('#day-modal-footer .day-modal-btn-secondary');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        closeDayModal();
        resolve('local');
      };
    }
  });
}
function closeDayModal() {
  document.getElementById('day-modal-ov').style.display = 'none';
  const card = document.getElementById('day-modal-card');
  if (card) card.className = 'day-modal-card';
  _modalConfirmFn = null;
  unlockUiScroll();
}
function syncDoneByDate(dateKey = (S.selDate || localDate()), type = S.day) {
  const info = getDayCompletion(dateKey, type);
  const scheduledType = getScheduledDayType(dateKey);
  const resolvedType = type || getTrackedDayType(dateKey, scheduledType);
  const hasTypeOverride = resolvedType !== scheduledType;

  if (!info.hasActivity && !hasTypeOverride) {
    delete S.doneByDate[dateKey];
    return;
  }

  S.doneByDate[dateKey] = {
    done: info.done,
    total: info.total,
    type: resolvedType,
    mealDone: info.mealDone,
    extraDone: info.extraDone,
    cheatDone: info.cheatDone,
    suppDone: info.suppDone,
    waterCount: info.waterCount,
    activityCount: info.activityCount,
    hasActivity: info.hasActivity,
    hasTypeOverride,
  };
}
function normalizeCheatConfig(config = S.cheatConfig || {}) {
  const weeklyMax = Number.isInteger(config.weeklyMax) ? config.weeklyMax : 2;
  const hardMax = Number.isInteger(config.hardMax) ? config.hardMax : 3;
  const fixedKcal = Number.isFinite(config.fixedKcal) ? Math.round(config.fixedKcal) : 350;
  const surplusPct = Number.isFinite(config.surplusPct) ? config.surplusPct : 12;
  S.cheatConfig = {
    enabled: config.enabled !== false,
    weeklyMax: Math.max(0, Math.min(3, weeklyMax)),
    hardMax: Math.max(1, Math.min(3, hardMax)),
    defaultMode: config.defaultMode === 'fixed' ? 'fixed' : 'surplus_pct',
    surplusPct: Math.max(5, Math.min(20, surplusPct)),
    fixedKcal: Math.max(150, Math.min(800, fixedKcal)),
  };
  if (S.cheatConfig.weeklyMax > S.cheatConfig.hardMax) {
    S.cheatConfig.weeklyMax = S.cheatConfig.hardMax;
  }
  return S.cheatConfig;
}
function resolveDayTypeForDate(dateKey) {
  const selectedKey = S.selDate || localDate();
  if (dateKey === selectedKey) return S.day;
  return getTrackedDayType(dateKey, getScheduledDayType(dateKey));
}
function getCheatMealForDate(dateKey = (S.selDate || localDate())) {
  return S.cheatMealsByDate?.[dateKey] || null;
}
function hasCheatMeal(dateKey = (S.selDate || localDate())) {
  return !!getCheatMealForDate(dateKey);
}
function getWeekBounds(dateKey = (S.selDate || localDate())) {
  const base = new Date(`${dateKey}T12:00:00`);
  const dow = base.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(base);
  start.setDate(base.getDate() + monOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
function getWeekCheatCount(dateKey = (S.selDate || localDate())) {
  const { start, end } = getWeekBounds(dateKey);
  return Object.keys(S.cheatMealsByDate || {}).filter(key => {
    const current = new Date(`${key}T12:00:00`);
    return current >= start && current <= end;
  }).length;
}
function getCheatWeeklyLimit() {
  const cfg = normalizeCheatConfig();
  return Math.min(cfg.weeklyMax, cfg.hardMax);
}
function calcCheatExtraKcal(dateKey = (S.selDate || localDate()), type = resolveDayTypeForDate(dateKey)) {
  const cfg = normalizeCheatConfig();
  const target = S.macro?.[type]?.k || 0;
  if (cfg.defaultMode === 'fixed') return Math.max(150, Math.min(800, Math.round(cfg.fixedKcal)));
  const raw = target * (cfg.surplusPct / 100);
  const rounded = Math.round(raw / 25) * 25;
  return Math.max(250, Math.min(450, rounded || 0));
}
function getCheatAutoTriggerKcal(dateKey = (S.selDate || localDate()), type = resolveDayTypeForDate(dateKey)) {
  const base = S.macro?.[type]?.k || 0;
  return base + 250;
}
function getEffectiveKcalTarget(dateKey = (S.selDate || localDate()), type = resolveDayTypeForDate(dateKey)) {
  const base = S.macro?.[type]?.k || 0;
  const extra = getCheatMealForDate(dateKey)?.extraKcal || 0;
  return base + extra;
}
function reconcileAutoCheatMeal(dateKey = (S.selDate || localDate()), type = resolveDayTypeForDate(dateKey), eatenKcal = 0) {
  const cfg = normalizeCheatConfig();
  if (!cfg.enabled) return { changed: false, cheat: getCheatMealForDate(dateKey) };

  const current = getCheatMealForDate(dateKey);
  const triggerAt = getCheatAutoTriggerKcal(dateKey, type);
  const shouldAutoActivate = eatenKcal >= triggerAt;

  if (current?.source === 'auto_surplus' && !shouldAutoActivate) {
    delete S.cheatMealsByDate[dateKey];
    syncDoneByDate(dateKey, type);
    save();
    return { changed: true, cheat: null };
  }

  if (current || !shouldAutoActivate) {
    return { changed: false, cheat: current };
  }

  const weekCount = getWeekCheatCount(dateKey);
  const limit = getCheatWeeklyLimit();
  if (weekCount >= limit) return { changed: false, cheat: null };

  const extraKcal = calcCheatExtraKcal(dateKey, type);
  S.cheatMealsByDate[dateKey] = {
    extraKcal,
    label: 'Sgarro controllato',
    source: 'auto_surplus',
    triggerDeltaKcal: eatenKcal - (S.macro?.[type]?.k || 0),
    createdAt: new Date().toISOString(),
  };
  syncDoneByDate(dateKey, type);
  save();
  return { changed: true, cheat: S.cheatMealsByDate[dateKey] };
}
function toggleCheatMeal(dateKey = (S.selDate || localDate())) {
  const cfg = normalizeCheatConfig();
  if (!cfg.enabled) {
    toast('⚠️ Sgarri disattivati');
    return;
  }
  const current = getCheatMealForDate(dateKey);
  const dayType = resolveDayTypeForDate(dateKey);
  if (current) {
    delete S.cheatMealsByDate[dateKey];
    syncDoneByDate(dateKey, dayType);
    save();
    renderTodayLog();
    refreshTodayDerivedViews({ stats: true });
    toast('↩️ Sgarro rimosso');
    return;
  }
  const weekCount = getWeekCheatCount(dateKey);
  const limit = getCheatWeeklyLimit();
  if (weekCount >= limit) {
    toast(`⚠️ Limite sgarri raggiunto: ${weekCount}/${limit}`);
    return;
  }
  const extraKcal = calcCheatExtraKcal(dateKey, dayType);
  S.cheatMealsByDate[dateKey] = {
    extraKcal,
    label: 'Sgarro controllato',
    source: 'manual',
    createdAt: new Date().toISOString(),
  };
  syncDoneByDate(dateKey, dayType);
  save();
  renderTodayLog();
  refreshTodayDerivedViews({ stats: true });
  toast(`🍕 Sgarro segnato: +${extraKcal} kcal`);
}
function refreshTodayDerivedViews({ greeting = true, calendar = true, stats = true } = {}) {
  const active = document.querySelector('.view.active')?.id;
  if (active === 'view-today') {
    if (greeting) renderGreeting(S.day, new Date());
    if (calendar) renderWeekCal(new Date());
  }
  if (stats && active === 'view-stats') renderStats();
}
function toggleExtraMeal(key) {
  const dateKey = S.selDate || localDate();
  if (!S.extraMealsActive[dateKey]) S.extraMealsActive[dateKey] = {};
  const isActive = !!S.extraMealsActive[dateKey][key];
  if (isActive) {
    delete S.extraMealsActive[dateKey][key];
    if (!Object.keys(S.extraMealsActive[dateKey]).length) delete S.extraMealsActive[dateKey];
  } else {
    S.extraMealsActive[dateKey][key] = true;
  }
  syncDoneByDate(dateKey, S.day);
  save();
  renderTodayLog();
  refreshTodayDerivedViews();
}
function toggleAlts(key) { const el = document.getElementById(`alts-${key}`); if(el) el.classList.toggle('open'); }
function selAlt(altKey, idx) {
  if (idx === null || S.altSel[altKey] === idx) delete S.altSel[altKey];
  else S.altSel[altKey] = idx;
  save(); rerender();
}
let _tmplFilter = 'tutti';
let _tmplFormItems = [];
let _editingTmplId = null;
let _tmplMealType = '';

function setTmplFilter(tag) { _tmplFilter = tag; renderPiano(); }
function toggleTmplItems(id) { const el=document.getElementById('ti-'+id); if(el) el.style.display=el.style.display==='none'?'block':'none'; }
function setPlanTab() {}

function ensurePianoUiState() {
  if (!S.pianoUi || typeof S.pianoUi !== 'object') {
    S.pianoUi = { activeMealFilter: 'all', templateSort: 'useful_now', helperExpanded: true };
  }
  if (typeof S.pianoUi.activeMealFilter !== 'string') S.pianoUi.activeMealFilter = 'all';
  if (typeof S.pianoUi.templateSort !== 'string') S.pianoUi.templateSort = 'useful_now';
  if (typeof S.pianoUi.helperExpanded !== 'boolean') S.pianoUi.helperExpanded = true;
  return S.pianoUi;
}

function setPianoMealFilter(mealType) {
  const ui = ensurePianoUiState();
  ui.activeMealFilter = mealType || 'all';
  save();
  renderPiano();
}

function getDefaultPlannerMealIdx(type) {
  const mealState = getCurrentMealState(type, S.selDate || localDate());
  if (typeof mealState?.key === 'number') return mealState.key;
  return 0;
}

function ensureMealPlannerState(type = S.planTab || 'on') {
  if (!S.mealPlanner) {
    S.mealPlanner = {
      on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [], selectedFavoriteFoodIds: [] },
      off:{ mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [], selectedFavoriteFoodIds: [] },
    };
  }
  if (!S.mealPlanner[type]) {
    S.mealPlanner[type] = { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [], selectedFavoriteFoodIds: [] };
  }
  const state = S.mealPlanner[type];
  if (typeof state.mealIdx !== 'number' || !S.meals[type]?.[state.mealIdx]) {
    state.mealIdx = getDefaultPlannerMealIdx(type);
  }
  if (typeof state.prompt !== 'string') state.prompt = '';
  if (typeof state.useFavorites !== 'boolean') state.useFavorites = true;
  if (typeof state.useTemplates !== 'boolean') state.useTemplates = true;
  if (!Array.isArray(state.results)) state.results = [];
  if (!Array.isArray(state.selectedFavoriteFoodIds)) state.selectedFavoriteFoodIds = [];
  const validFavoriteIds = new Set((S.favoriteFoods || []).map(food => food.id));
  state.selectedFavoriteFoodIds = state.selectedFavoriteFoodIds.filter(id => validFavoriteIds.has(id));
  return state;
}

function setMealPlannerMeal(type, mealIdx) {
  const state = ensureMealPlannerState(type);
  state.mealIdx = Math.max(0, Math.min((S.meals[type] || []).length - 1, parseInt(mealIdx, 10) || 0));
  const meal = S.meals[type]?.[state.mealIdx];
  const mealType = getMealTypeFromName(meal?.name || '');
  if (mealType && typeof normalizeFavoriteFoods === 'function' && typeof isFoodCompatibleWithMeal === 'function') {
    const compatibleIds = new Set(
      normalizeFavoriteFoods(S.favoriteFoods || [])
        .filter(food => isFoodCompatibleWithMeal(food, mealType))
        .map(food => food.id)
    );
    state.selectedFavoriteFoodIds = state.selectedFavoriteFoodIds.filter(id => compatibleIds.has(id));
  }
  save();
  renderPiano();
}

function toggleMealPlannerFavoriteFood(type, foodId) {
  const state = ensureMealPlannerState(type);
  const current = Array.isArray(state.selectedFavoriteFoodIds) ? state.selectedFavoriteFoodIds.slice() : [];
  if (current.includes(foodId)) {
    state.selectedFavoriteFoodIds = current.filter(id => id !== foodId);
  } else {
    if (current.length >= 3) {
      toast('⚠️ Seleziona al massimo 3 cibi da forzare nel pasto');
      return;
    }
    state.selectedFavoriteFoodIds = [...current, foodId];
  }
  save();
  renderPiano();
}

function setMealPlannerPrompt(type, value) {
  const state = ensureMealPlannerState(type);
  state.prompt = value;
  saveSoon();
}

function toggleMealPlannerOption(type, key) {
  const state = ensureMealPlannerState(type);
  state[key] = !state[key];
  save();
  renderPiano();
}

function appendMealPlannerPrompt(type, value) {
  const state = ensureMealPlannerState(type);
  const clean = String(value || '').trim();
  if (!clean) return;
  const parts = state.prompt.split(',').map(x => x.trim()).filter(Boolean);
  if (!parts.some(p => p.toLowerCase() === clean.toLowerCase())) parts.push(clean);
  state.prompt = parts.join(', ');
  save();
  renderPiano();
}

function resetMealPlanner(type = S.planTab || 'on') {
  const state = ensureMealPlannerState(type);
  state.prompt = '';
  state.results = [];
  state.mealIdx = getDefaultPlannerMealIdx(type);
  save();
  renderPiano();
}

function generateMealPlanner() {
  const type = S.planTab || 'on';
  const state = ensureMealPlannerState(type);
  state.results = buildMealPlannerSuggestions(type, state.mealIdx, state.prompt, {
    useFavorites: state.useFavorites,
    useTemplates: state.useTemplates,
  });
  save();
  renderPiano();
}

function applyMealPlannerSuggestion(type, resultIdx) {
  const state = ensureMealPlannerState(type);
  const result = state.results?.[resultIdx];
  const meal = S.meals[type]?.[state.mealIdx];
  if (!result || !meal) return;
  meal.items = result.items.map(it => ({ ...it }));
  save();
  renderPiano();
  if ((S.selDate || localDate()) === localDate() && S.day === type) {
    renderTodayLog();
  }
  toast('✅ Pasto aggiornato dal planner');
}

function loadMealPlannerSuggestionToToday(type, resultIdx) {
  const state = ensureMealPlannerState(type);
  const result = state.results?.[resultIdx];
  const mealIdx = state.mealIdx;
  const dateKey = localDate();
  if (!result || typeof mealIdx !== 'number') return;
  if (S.day !== type) {
    toast(`⚠️ Oggi è impostato su ${S.day.toUpperCase()}. Passa a ${type.toUpperCase()} per caricare questo suggerimento.`);
    return;
  }
  if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
  if (S.foodLog[dateKey][mealIdx]?.length && !confirm('Sostituire il log attuale di questo pasto con il suggerimento?')) return;
  S.foodLog[dateKey][mealIdx] = result.items.map(it => ({ ...it }));
  syncLoggedMealState(dateKey, mealIdx, type);
  save();
  goView('today');
  setTimeout(() => refreshMealCard(type, mealIdx), 60);
  toast('✅ Suggerimento caricato in Oggi');
}

function plannerSuggestionToTemplate(type, resultIdx) {
  const state = ensureMealPlannerState(type);
  const result = state.results?.[resultIdx];
  const meal = S.meals[type]?.[state.mealIdx];
  if (!result || !meal?.name) return;
  const mealType = getMealTypeFromName(meal.name) || 'altro';
  S.templates.push({
    id: 't' + Date.now(),
    name: `${meal.name} smart`,
    tag: mealType,
    mealType,
    items: result.items.map(it => ({ ...it })),
    usageCount: 0,
    pinned: false,
    source: 'helper',
  });
  save();
  renderPiano();
  toast('✅ Suggerimento salvato come template');
}

function setTmplMealType(type) {
  _tmplMealType = type;
  document.querySelectorAll('.tmpl-type-pill').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase().includes(type));
  });
  const hidden = document.getElementById('tf-tag');
  if (hidden) hidden.value = type;
}

function _resetTmplMealTypePills(type) {
  _tmplMealType = type || '';
  document.querySelectorAll('.tmpl-type-pill').forEach(b => {
    b.classList.toggle('active', !!type && b.textContent.toLowerCase().includes(type));
  });
  const hidden = document.getElementById('tf-tag');
  if (hidden) hidden.value = type || '';
}

function openNewTemplate() {
  _editingTmplId = null; _tmplFormItems = [];
  document.getElementById('tf-name').value = '';
  _resetTmplMealTypePills('');
  document.getElementById('tmpl-form-title').textContent = 'Nuovo template';
  renderTmplFormItems();
  document.getElementById('tmpl-form').style.display = 'block';
  document.getElementById('tf-name').focus();
}

function editTemplate(id) {
  const t = S.templates.find(t=>t.id===id); if (!t) return;
  _editingTmplId = id;
  _tmplFormItems = t.items.map(it=>({...it}));
  document.getElementById('tf-name').value = t.name;
  _resetTmplMealTypePills(t.mealType || t.tag || '');
  document.getElementById('tmpl-form-title').textContent = 'Modifica template';
  renderTmplFormItems();
  document.getElementById('tmpl-form').style.display = 'block';
  document.getElementById('tmpl-form').scrollIntoView({behavior:'smooth'});
}

function closeTemplateForm() {
  document.getElementById('tmpl-form').style.display = 'none';
  document.getElementById('tf-search-results').innerHTML = '';
  document.getElementById('tf-search').value = '';
  _editingTmplId = null; _tmplFormItems = []; _tmplMealType = '';
}

function renderTmplFormItems() {
  const el = document.getElementById('tf-items-list');
  if (!el) return;
  el.innerHTML = '';
  if (!_tmplFormItems.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:4px 0">Nessun ingrediente — cerca qui sotto</div>';
    return;
  }
  _tmplFormItems.forEach((it, ii) => {
    const k = Math.round(it.kcal100*it.grams/100);
    const row = document.createElement('div');
    row.className = 'food-item-row';
    row.innerHTML = `<div class="fir-dot"></div>
      <div class="fir-name">${htmlEsc(it.name)}</div>
      <div class="fir-grams-wrap">
        <input type="number" class="fir-grams" value="${it.grams}" min="0" max="2000" step="1">
        <span class="fir-unit">g</span>
      </div>
      <div class="fir-kcal">${k} kcal</div>
      <button class="fir-del">\xd7</button>`;
    row.querySelector('.fir-grams').addEventListener('input', function() {
      _tmplFormItems[ii].grams = Math.round(+this.value||0);
      renderTmplFormItems();
    });
    row.querySelector('.fir-del').addEventListener('click', () => {
      _tmplFormItems.splice(ii, 1);
      renderTmplFormItems();
    });
    el.appendChild(row);
  });
}

function saveTemplate() {
  const name = document.getElementById('tf-name').value.trim();
  if (!name) { toast('⚠️ Inserisci un nome'); return; }
  if (!_tmplFormItems.length) { toast('⚠️ Aggiungi almeno un alimento'); return; }
  if (!_tmplMealType) { toast('⚠️ Seleziona il tipo di pasto'); return; }
  const tag = _tmplMealType;
  const mealType = _tmplMealType;
  if (_editingTmplId) {
    const idx = S.templates.findIndex(t=>t.id===_editingTmplId);
    if (idx>=0) S.templates[idx] = {
      id:_editingTmplId, name, tag, mealType, items:[..._tmplFormItems],
      usageCount: Number(S.templates[idx].usageCount || 0) || 0,
      pinned: !!S.templates[idx].pinned,
      source: S.templates[idx].source || 'manual'
    };
  } else {
    S.templates.push({id:'t'+Date.now(), name, tag, mealType, items:[..._tmplFormItems], usageCount: 0, pinned: false, source: 'manual'});
  }
  save(); closeTemplateForm(); renderPiano(); toast('✅ Template salvato');
}

function deleteTemplate(id) {
  if (!confirm('Eliminare questo template?')) return;
  S.templates = S.templates.filter(t=>t.id!==id);
  save(); renderPiano();
}

function loadTemplateToLog(tmplId) {
  const t = S.templates.find(t=>t.id===tmplId); if (!t) return;
  t.usageCount = Number(t.usageCount || 0) + 1;
  const dateKey = S.selDate || localDate();
  const type = S.day;
  const mealNames = S.meals[type].map((m,i) => `${i+1}. ${m.name}`).join('\n');
  const choice = prompt(`Carica "${t.name}" in quale pasto?\n${mealNames}\n\nNumero (1-${S.meals[type].length}):`);
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx<0 || idx>=S.meals[type].length) return;
  if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
  if (S.foodLog[dateKey][idx]?.length && !confirm('Aggiungere al log esistente?')) return;
  if (!S.foodLog[dateKey][idx]) S.foodLog[dateKey][idx] = [];
  S.foodLog[dateKey][idx].push(...t.items.map(it=>({...it})));
  syncLoggedMealState(dateKey, idx, type);
  save(); goView('today'); toast(`✅ ${t.name} caricato`);
}
function loadTemplateToMeal(tmplId, dateKey, mealIdx) {
  const t = S.templates.find(t=>t.id===tmplId); if (!t) return;
  const dayType = resolveDayTypeForDate(dateKey);
  if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
  if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
  const existing = S.foodLog[dateKey][mealIdx];
  if (existing.length && !confirm(`Aggiungere "${t.name}" al log esistente?`)) return;
  S.foodLog[dateKey][mealIdx].push(...t.items.map(it=>({...it})));
  syncLoggedMealState(dateKey, mealIdx, dayType);
  save();
  refreshMealCard(dayType, mealIdx);
  renderMacroStrip(dayType, S.meals[dayType], S.macro[dayType]);
  toast(`✅ ${t.name} caricato`);
}

function toggleOnDay(dow) {
  const idx = S.onDays.indexOf(dow);
  if (idx >= 0) {
    if (S.onDays.length <= 1) { toast('Almeno un giorno ON richiesto'); return; }
    S.onDays.splice(idx, 1);
  } else {
    S.onDays.push(dow);
    S.onDays.sort();
  }
  save();
  renderOnDaysPicker();
  renderToday(); // aggiorna il calendario
  toast('✅  Giorni allenamento aggiornati');
}
function toggleEditor(key) {
  const ed = document.getElementById(`ed-${key}`);
  if (ed) ed.classList.toggle('open');
}

// ? ? ?  ALTS EDITOR ? ? ? 
function toggleAltsEditor(key) {
  const el = document.getElementById(`aed-${key}`);
  if (el) el.classList.toggle('open');
}
function toggleAltEntry(edId) {
  const body = document.getElementById(`aeb-${edId}`);
  const chev = document.querySelector(`#${edId} .alt-entry-chev`);
  if (body) body.classList.toggle('open');
  if (chev) chev.classList.toggle('open');
}

function addAlt(altKey) {
  if (!S.alts[altKey]) S.alts[altKey] = [];
  const n = S.alts[altKey].length + 1;
  S.alts[altKey].push({label:`Variante ${n}`, ingr:'', kcal:0, p:0, c:0, f:0});
  save(); rerender();
  setTimeout(() => {
    const edId = `aentry-${altKey}-${S.alts[altKey].length-1}`;
    toggleAltEntry(edId);
  }, 50);
  toast('✅  Variante aggiunta');
}

function deleteAlt(altKey, j) {
  S.alts[altKey].splice(j, 1);
  if (S.alts[altKey].length === 0) delete S.alts[altKey];
  if (S.altSel[altKey] === j) delete S.altSel[altKey];
  else if (S.altSel[altKey] > j) S.altSel[altKey]--;
  save(); rerender();
  toast('Variante rimossa');
}
function addWeight() {
  const v = parseFloat(document.getElementById('w-in').value);
  if (isNaN(v) || v < 30 || v > 250) { toast('❌  Peso non valido'); return; }
  upsertTodayWeightLog(v);
  syncAnagraficaWeightFromLogs();
  refreshNutritionTargetsFromState();
  // update profilo
  const wi = S.profilo.findIndex(r=>r.l==='Peso attuale');
  if (wi >= 0) { profSave('Peso attuale', S.profilo[wi].v); S.profilo[wi].v = v.toFixed(1)+' kg'; }
  document.getElementById('w-in').value = '';
  save(); renderStats();
  toast('✅  Peso registrato');
}
function editWeight(idx) {
  const entry = S.weightLog?.[idx];
  if (!entry) return;
  const next = prompt(`Modifica il peso del ${entry.date}`, String(entry.val ?? ''));
  if (next == null) return;
  const v = parseFloat(String(next).replace(',', '.'));
  if (isNaN(v) || v < 30 || v > 250) { toast('❌  Peso non valido'); return; }
  S.weightLog[idx] = { ...entry, val: v };
  syncAnagraficaWeightFromLogs();
  refreshNutritionTargetsFromState({ saveDeferred: false });
  save();
  renderStats();
  toast('✅  Peso aggiornato');
}
function delWeight(idx) {
  S.weightLog.splice(idx, 1);
  syncAnagraficaWeightFromLogs();
  refreshNutritionTargetsFromState({ saveDeferred: false });
  save();
  renderStats();
}
function addMeasurement() {
  const get = id => { const v=parseFloat(document.getElementById(id)?.value); return isNaN(v)?null:v; };
  const m = {
    date: localDate(),
    peso:    get('m-peso'),
    vita:    get('m-vita'),
    fianchi: get('m-fianchi'),
    petto:   get('m-petto'),
    braccio: get('m-braccio'),
    coscia:  get('m-coscia'),
  };
  if (Object.values(m).filter(v=>v!==null&&typeof v==='number').length===0) {
    toast('⚠️  Inserisci almeno una misurazione'); return;
  }
  S.measurements.push(m);
  // Sync peso to weightLog if present
  if (m.peso) {
    upsertTodayWeightLog(m.peso);
    syncAnagraficaWeightFromLogs();
    refreshNutritionTargetsFromState();
    const wi = S.profilo.findIndex(r=>r.l==='Peso attuale');
    if (wi>=0) { profSave('Peso attuale', S.profilo[wi].v); S.profilo[wi].v=m.peso.toFixed(1)+' kg'; }
  }
  save();
  toast('✅  Misurazioni registrate');
  renderStats();
}
function editMeasurement(idx) {
  const entry = S.measurements?.[idx];
  if (!entry) return;
  const fields = [
    ['peso', 'Peso (kg)'],
    ['vita', 'Vita (cm)'],
    ['fianchi', 'Fianchi (cm)'],
    ['petto', 'Petto (cm)'],
    ['braccio', 'Braccio dx (cm)'],
    ['coscia', 'Coscia (cm)'],
  ];
  const next = { ...entry };
  for (const [key, label] of fields) {
    const current = entry[key] == null ? '' : String(entry[key]);
    const raw = prompt(`${label} · lascia vuoto per cancellare`, current);
    if (raw == null) return;
    const clean = String(raw).trim().replace(',', '.');
    next[key] = clean === '' ? null : parseFloat(clean);
    if (clean !== '' && !Number.isFinite(next[key])) {
      toast(`❌  Valore non valido per ${label}`);
      return;
    }
  }
  if (fields.every(([key]) => next[key] == null)) {
    toast('⚠️  Serve almeno una misura');
    return;
  }
  S.measurements[idx] = next;
  if (Number.isFinite(next.peso) && next.peso > 0) {
    upsertWeightLogByDate(next.peso, entry.date || getTodayWeightLogDateLabel());
    syncAnagraficaWeightFromLogs();
    refreshNutritionTargetsFromState({ saveDeferred: false });
  }
  save();
  renderStats();
  toast('✅  Misure aggiornate');
}
function delMeasurement(idx) {
  if (idx == null || idx < 0 || idx >= (S.measurements || []).length) return;
  S.measurements.splice(idx, 1);
  syncAnagraficaWeightFromLogs();
  refreshNutritionTargetsFromState({ saveDeferred: false });
  save();
  renderStats();
  toast('✅  Rilevazione rimossa');
}
function setGoalPhase(phase, persist = true) {
  const PHASE_INFO = {
    bulk:     'Surplus moderato, proteine solide e grassi adeguati: i carboidrati assorbono la maggior parte dell energia extra nei giorni ON.',
    cut:      'Deficit moderato con proteine piu alte e grassi essenziali stabili, per proteggere meglio massa magra e aderenza.',
    mantieni: 'Intake vicino al mantenimento, con proteine a 1.6 g/kg e carboidrati come variabile residua.',
  };
  document.querySelectorAll('.goal-phase-btn').forEach(b => {
    const pid = b.dataset.phase;
    b.className = 'goal-phase-btn' + (pid === phase ? ' active-' + phase : '');
  });
  const descEl = document.getElementById('goal-phase-desc');
  if (descEl) descEl.textContent = PHASE_INFO[phase] || '';
  if (!persist) return;
  S.goal.phase = phase;
  save();
  // Recalculate directly from S.anagrafica (no DOM read) so it works regardless of view state
  const _r = refreshNutritionTargetsFromState();
  if (_r) {
    const fabEl = document.getElementById('fab-preview');
    if (fabEl) {
      const { bmr, pal, tdee, tdeeRange, formula, components, macroOn, macroOff, calibration } = _r;
      fabEl.innerHTML = `
        <div class="fab-row fab-row-top"><span class="fab-label">BMR</span><span class="fab-value">${bmr} kcal</span><span class="fab-note">${formula}</span></div>
        <div class="fab-row"><span class="fab-label">NEAT</span><span class="fab-value">${components.neat.base} kcal</span><span class="fab-note">${components.neat.label}</span></div>
        <div class="fab-row"><span class="fab-label">EAT</span><span class="fab-value">${components.eat.base} kcal</span><span class="fab-note">media da allenamento</span></div>
        <div class="fab-row"><span class="fab-label">TEF</span><span class="fab-value">${Math.round(components.tefPct * 100)}%</span><span class="fab-note">termogenesi del cibo</span></div>
        <div class="fab-row fab-row-tdee"><span class="fab-label">TDEE</span><span class="fab-value">${tdee} kcal</span><span class="fab-note">${tdeeRange ? `${tdeeRange.low}–${tdeeRange.high} kcal · eq. PAL ${pal}` : `eq. PAL ${pal}`}</span></div>
        ${calibration?.offsetKcal ? `<div class="fab-row"><span class="fab-label">Calibrazione 14g</span><span class="fab-value">${calibration.offsetKcal > 0 ? '+' : ''}${calibration.offsetKcal} kcal</span><span class="fab-note">${calibration.reason}</span></div>` : ''}
        <div class="fab-divider"></div>
        <div class="fab-day-row"><span class="fab-day-label on-lbl">Giorno ON</span><span class="fab-day-kcal">${macroOn.k} kcal</span><span class="fab-day-macros">P ${macroOn.p}g · C ${macroOn.c}g · F ${macroOn.f}g</span></div>
        <div class="fab-day-row"><span class="fab-day-label off-lbl">Giorno OFF</span><span class="fab-day-kcal">${macroOff.k} kcal</span><span class="fab-day-macros">P ${macroOff.p}g · C ${macroOff.c}g · F ${macroOff.f}g</span></div>`;
    }
  }
}

function saveGoalDetails() {
  const startDate = document.getElementById('goal-start-date')?.value || null;
  const rawTargetWeight = document.getElementById('goal-target-weight')?.value;
  const targetWeight = rawTargetWeight === '' ? null : _parseNullableAnagNumber(rawTargetWeight);
  const notes = String(document.getElementById('goal-notes')?.value || '').trim();
  S.goal.startDate = startDate;
  S.goal.targetWeight = targetWeight;
  S.goal.notes = notes;
  save();
  renderGoalCard();
  toast('✅ Obiettivo salvato');
}
function toggleSupp(id) {
  const key = S.selDate || localDate();
  if (!S.suppChecked[key]) S.suppChecked[key] = [];
  const arr = S.suppChecked[key];
  const idx = arr.indexOf(id);
  if (idx>=0) arr.splice(idx,1); else arr.push(id);
  syncDoneByDate(key, getTrackedDayType(key));
  save();
  renderSuppToday(); // always update today supp section (cheap, no full re-render)
  refreshTodayDerivedViews();
  refreshTodayAlertSurfaces();
}
function addWater(delta) {
  const key = S.selDate || localDate();
  if (!S.water) S.water = {};
  const cur = S.water[key] || 0;
  const next = Math.max(0, Math.min(12, cur + delta));
  S.water[key] = next;
  syncDoneByDate(key, getTrackedDayType(key));
  save();
  renderWater();
  if (delta !== 0) {
    const dayType = getTrackedDayType(key, getScheduledDayType(key));
    const peso = S.anagrafica?.peso || 0;
    const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
    const totalMl = baseMl + (dayType === 'on' ? 350 : 0);
    const target = Math.max(6, Math.round(totalMl / 250));
    const prevPct = Math.min(cur / target, 1) * 100;
    const nextPct = Math.min(next / target, 1) * 100;
    requestAnimationFrame(() => {
      const fill = document.querySelector('#water-widget .water-bar-fill');
      if (!fill) return;
      fill.style.width = `${prevPct}%`;
      fill.classList.remove('is-animating');
      void fill.offsetWidth;
      requestAnimationFrame(() => {
        fill.style.width = `${nextPct}%`;
        if (delta > 0) fill.classList.add('is-animating');
        setTimeout(() => fill.classList.remove('is-animating'), 720);
      });
    });
  }
  refreshTodayDerivedViews();
}
function toggleSuppActive(i) {
  S.supplements[i].active = !S.supplements[i].active;
  save();
  renderSuppToday();
  refreshTodayDerivedViews();
  refreshTodayAlertSurfaces();
}
function updateItemGrams(type, mealIdx, itemIdx, val) {
  const g = Math.round(parseFloat(val)||0);
  const it = S.meals[type]?.[mealIdx]?.items?.[itemIdx];
  if (!it) return;
  it.grams = g;
  saveSoon();
  const domKey = type+'-'+mealIdx;
  const kcalEl = document.querySelector('#fir-'+domKey+'-'+itemIdx+' .fir-kcal');
  if (kcalEl) kcalEl.textContent = Math.round(it.kcal100*g/100)+' kcal';
  const m = effMeal(type, mealIdx);
  const mm2 = mealMacros(S.meals[type][mealIdx]);
  const pillsEl = document.querySelector('#mc-'+domKey+' .mc-pills');
  if (pillsEl) pillsEl.innerHTML =
    '<span class="pill pk">'+mm2.kcal+' kcal</span>'+
    '<span class="pill pp">P '+mm2.p+'g</span>'+
    '<span class="pill pc">C '+mm2.c+'g</span>'+
    '<span class="pill pf">F '+mm2.f+'g</span>';
}

function removeItem(type, mealIdx, itemIdx) {
  S.meals[type]?.[mealIdx]?.items?.splice(itemIdx,1);
  save(); renderPiano();
}
function toggleLogSearch(domKey) {
  const el = document.getElementById('mls-'+domKey);
  const panel = document.getElementById('mlp-'+domKey);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (panel) panel.classList.toggle('is-open', !isOpen);
  if (!isOpen) {
    const inp = document.getElementById('mlsi-'+domKey);
    if (inp) { inp.value=''; inp.focus(); }
    const res = document.getElementById('mlsr-'+domKey);
    if (res) res.innerHTML='';
    const gram = document.getElementById('mlsg-'+domKey);
    if (gram) gram.remove();
  }
}

let _logSearchTimer=null, _logSearchSel=null;

function updateLogGramPreview(domKey) {
  if (!_logSearchSel || _logSearchSel.domKey!==domKey) return;
  const g = parseFloat(document.getElementById('mlsgram-'+domKey)?.value)||0;
  const calc = document.getElementById('mlsgc-'+domKey);
  if (calc) calc.textContent='= '+Math.round(_logSearchSel.item.kcal100*g/100)+' kcal';
}

// Partial update: refresh only a single meal card + macro strip (no full re-render)
function refreshMealCard(type, mealIdx) {
  if (typeof mealIdx !== 'number' && typeof mealIdx !== 'string') { renderTodayLog(); return; }
  const domKey = typeof mealIdx === 'string' ? `extra-${mealIdx}` : `${type}-${mealIdx}`;
  const card   = document.getElementById(`mc-${domKey}`);
  if (!card) {
    renderTodayLog();
    pulseTodayElement(`#mc-${domKey}`);
    pulseTodayElement('#macro-strip .ms-kcal-card', 'ui-glow');
    return;
  }

  const tmp = document.createElement('div');
  tmp.innerHTML = typeof mealIdx === 'string'
    ? extraMealCardHTML(mealIdx, S.selDate || localDate())
    : mealCardHTML(type, mealIdx, 'today');
  card.replaceWith(tmp.firstElementChild);

  // Update macro strip + progress
  const meals   = S.meals[type];
  const tgt     = S.macro[type];
  renderMacroStrip(type, meals, tgt);

  const dateKey = S.selDate || localDate();
  const completion = getDayCompletion(dateKey, type);
  const mealState = getCurrentMealState(type, dateKey);
  const alertModel = splitTodayAlerts(type, dateKey);
  renderCurrentMealFocus(type, mealState, dateKey, alertModel);
  if (typeof renderCheatWidget === 'function') renderCheatWidget();
  if (typeof renderTodaySignals === 'function') renderTodaySignals(type, dateKey);
  if (typeof renderDashboardAlertSummary === 'function') renderDashboardAlertSummary(type, dateKey);
  if (typeof renderSupportAlerts === 'function') renderSupportAlerts(type, dateKey);
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${completion.done} su ${completion.total} completati`;
  if (dpFill)  dpFill.style.width  = `${completion.total ? (completion.done/completion.total)*100 : 0}%`;

  refreshTodayDerivedViews({ greeting: true, calendar: true, stats: true });
  pulseTodayElement(`#mc-${domKey}`);
  pulseTodayElement('#macro-strip .ms-kcal-card', 'ui-glow');
}

function removeLogItem(dateKey, mealIdx, itemIdx) {
  const dayType = resolveDayTypeForDate(dateKey);
  S.foodLog[dateKey]?.[mealIdx]?.splice(itemIdx,1);
  if (!S.foodLog[dateKey]?.[mealIdx]?.length) {
    delete S.foodLog[dateKey]?.[mealIdx];
  }
  syncDoneByDate(dateKey, dayType);
  save(); refreshMealCard(dayType, mealIdx);
}

function getLoggedFoodNutrition(item, gramsOverride = null) {
  const grams = Math.max(0, Number(gramsOverride ?? item?.grams ?? 0) || 0);
  const factor = grams / 100;
  return {
    grams,
    kcal: Math.round((Number(item?.kcal100 || 0) * factor)),
    p: Number(item?.p100 || 0) * factor,
    c: Number(item?.c100 || 0) * factor,
    f: Number(item?.f100 || 0) * factor,
  };
}

function formatFoodMetric(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function foodNutritionRecapHTML(item, { grams = null, kicker = 'Recap nutrizionale', subtitle = 'Per la porzione registrata', showPer100 = true } = {}) {
  const nutrition = getLoggedFoodNutrition(item, grams);
  const brand = String(item?.brand || '').trim();
  return `<div class="food-nutrition-recap fsr-gp-info">
    <div class="fsr-gp-head">
      <div class="fsr-gp-copy">
        <div class="edit-gram-label">${kicker}</div>
        <div class="food-nutrition-title">${subtitle}</div>
        <div class="food-nutrition-meta">${nutrition.grams} g registrati${brand ? ` · ${htmlEsc(brand)}` : ''}</div>
      </div>
      <div class="fsr-gp-badges">
        <span class="fsr-gp-badge">${nutrition.kcal} kcal</span>
      </div>
    </div>
    ${typeof macroVisualCardsHTML === 'function'
      ? macroVisualCardsHTML({ k: nutrition.kcal, p: nutrition.p, c: nutrition.c, f: nutrition.f }, { size: 'compact' })
      : ''}
    ${showPer100 ? `<div class="food-nutrition-per100">Per 100 g · ${Math.round(Number(item?.kcal100 || 0))} kcal · P ${formatFoodMetric(Number(item?.p100 || 0))}g · C ${formatFoodMetric(Number(item?.c100 || 0))}g · G ${formatFoodMetric(Number(item?.f100 || 0))}g</div>` : '' }
  </div>`;
}

function renderEditGramRecapFromInput(inputEl) {
  const recap = document.getElementById('edit-gram-recap');
  if (!recap || !inputEl) return;
  recap.innerHTML = foodNutritionRecapHTML({
    name: inputEl.dataset.name || '',
    brand: inputEl.dataset.brand || '',
    kcal100: parseFloat(inputEl.dataset.kcal100 || '0') || 0,
    p100: parseFloat(inputEl.dataset.p100 || '0') || 0,
    c100: parseFloat(inputEl.dataset.c100 || '0') || 0,
    f100: parseFloat(inputEl.dataset.f100 || '0') || 0,
    grams: +inputEl.value || 0,
  }, {
    subtitle: 'Recap della porzione attuale',
    showPer100: true,
  });
}

function openLoggedFoodInfo(dateKey, mealIdx, itemIdx) {
  const item = S.foodLog[dateKey]?.[mealIdx]?.[itemIdx];
  if (!item) return;
  showDayModal({
    icon: 'ℹ️',
    title: item.name.length > 34 ? item.name.slice(0, 34) + '…' : item.name,
    eyebrow: 'Valori nutrizionali',
    modalClass: 'day-modal-detail',
    noButtons: true,
    body: `${foodNutritionRecapHTML(item, {
      subtitle: 'Recap della porzione che hai registrato',
      showPer100: true,
    })}`,
  });
}

function editLogItem(dateKey, mealIdx, itemIdx) {
  const item = S.foodLog[dateKey]?.[mealIdx]?.[itemIdx];
  if (!item) return;
  const kcal100 = item.kcal100;
  const dayType = resolveDayTypeForDate(dateKey);
  showDayModal({
    icon: '✏️',
    title: item.name.length > 28 ? item.name.slice(0,28)+'…' : item.name,
    body: `<div id="edit-gram-recap">${foodNutritionRecapHTML(item, {
      subtitle: 'Recap della porzione attuale',
      showPer100: true,
    })}</div>
    <div class="edit-gram-row">
      <label class="edit-gram-label">Grammatura (g)</label>
      <div class="edit-gram-inputs">
        <input id="edit-gram-inp" type="number" class="edit-gram-inp" value="${item.grams}" min="1" max="5000" step="1" data-name="${htmlEsc(item.name || '')}" data-brand="${htmlEsc(item.brand || '')}" data-kcal100="${kcal100}" data-p100="${Number(item.p100 || 0)}" data-c100="${Number(item.c100 || 0)}" data-f100="${Number(item.f100 || 0)}" style="font-size:16px">
        <span class="edit-gram-unit">g</span>
      </div>
      <div id="edit-gram-calc" class="edit-gram-calc">= ${Math.round(kcal100 * item.grams / 100)} kcal</div>
    </div>`,
    onConfirm: () => {
      const inp = document.getElementById('edit-gram-inp');
      const g = Math.round(+inp?.value || item.grams);
      if (g > 0 && S.foodLog[dateKey]?.[mealIdx]?.[itemIdx]) {
        S.foodLog[dateKey][mealIdx][itemIdx].grams = g;
        save();
        refreshMealCard(dayType, mealIdx);
      }
    }
  });
  // Focus input after modal renders
  setTimeout(() => {
    const inp = document.getElementById('edit-gram-inp');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

function renameMeal(type, mealIdx) {
  const meal = S.meals[type]?.[mealIdx];
  if (!meal) return;
  const _pencilSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;
  showDayModal({
    icon: '✏️',
    title: 'Rinomina pasto',
    body: `<input id="rename-meal-inp" type="text" class="rename-meal-inp" value="${meal.name}" maxlength="30" style="font-size:16px;width:100%;padding:8px 10px;border:1.5px solid var(--b1);border-radius:8px;font-family:'Manrope',sans-serif;color:var(--ink)">`,
    onConfirm: () => {
      const val = document.getElementById('rename-meal-inp')?.value?.trim();
      if (val) {
        S.meals[type][mealIdx].name = val;
        save();
        renderTodayLog();
      }
    }
  });
  setTimeout(() => {
    const inp = document.getElementById('rename-meal-inp');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

// ─── Cibi Preferiti ──────────────────────────────────────────────────────────
function addFavoriteFood() {
  const name       = (document.getElementById('ff-nome')?.value    || '').trim();
  const kcal100    = parseFloat(document.getElementById('ff-kcal')?.value    || '0');
  const p100       = parseFloat(document.getElementById('ff-prot')?.value    || '0');
  const c100       = parseFloat(document.getElementById('ff-carb')?.value    || '0');
  const f100       = parseFloat(document.getElementById('ff-fat')?.value     || '0');
  const typGrams   = parseInt(document.getElementById('ff-portion')?.value   || '100');

  if (!name || isNaN(kcal100) || kcal100 <= 0) return;
  if (!S.favoriteFoods) S.favoriteFoods = [];
  S.favoriteFoods.push({
    id: 'ff-' + Date.now(),
    name,
    kcal100,
    p100:  isNaN(p100) ? 0 : p100,
    c100:  isNaN(c100) ? 0 : c100,
    f100:  isNaN(f100) ? 0 : f100,
    typicalGrams: (isNaN(typGrams) || typGrams <= 0) ? 100 : typGrams,
  });
  save();
  refreshFavoriteFoodsUi();
  toast('✅  Cibo salvato');
}

function removeFavoriteFood(id) {
  if (!S.favoriteFoods) return;
  S.favoriteFoods = S.favoriteFoods.filter(f => f.id !== id);
  save();
  refreshFavoriteFoodsUi();
  toast('✅  Cibo rimosso');
}

function toggleFavoriteFoodMealTag(id, mealTag, sourceEl = null) {
  if (!S.favoriteFoods || !id || !mealTag) return;
  const validTags = ['colazione', 'pranzo', 'cena', 'spuntino'];
  if (!validTags.includes(mealTag)) return;
  const food = S.favoriteFoods.find(item => item.id === id);
  if (!food) return;
  const listEl = sourceEl?.closest?.('.ff-list') || document.getElementById('ff-list');
  const anchorCard = sourceEl?.closest?.('.ff-item') || document.querySelector(`.ff-item[data-food-id="${id}"]`);
  const preserveListScrollTop = listEl ? listEl.scrollTop : null;
  const preserveAnchorOffset = anchorCard && listEl
    ? (anchorCard.getBoundingClientRect().top - listEl.getBoundingClientRect().top)
    : null;
  const current = Array.isArray(food.manualMealTags)
    ? food.manualMealTags.filter(tag => validTags.includes(tag))
    : [];
  const next = current.includes(mealTag)
    ? current.filter(tag => tag !== mealTag)
    : [...current, mealTag];
  food.manualMealTags = next;
  food.mealTags = next.length ? next.slice() : [];
  save();
  refreshFavoriteFoodsUi({
    preserveFoodId: id,
    preserveListScrollTop,
    preserveAnchorOffset,
  });
}

function toggleFavoriteFoodRole(id, roleKey, sourceEl = null) {
  if (!S.favoriteFoods || !id || !roleKey) return;
  const validRoles = ['base', 'proteina', 'latticino', 'frutta', 'contorno', 'condimento'];
  if (!validRoles.includes(roleKey)) return;
  const food = S.favoriteFoods.find(item => item.id === id);
  if (!food) return;
  const listEl = sourceEl?.closest?.('.ff-list') || document.getElementById('ff-list');
  const anchorCard = sourceEl?.closest?.('.ff-item') || document.querySelector(`.ff-item[data-food-id="${id}"]`);
  const preserveListScrollTop = listEl ? listEl.scrollTop : null;
  const preserveAnchorOffset = anchorCard && listEl
    ? (anchorCard.getBoundingClientRect().top - listEl.getBoundingClientRect().top)
    : null;
  const current = Array.isArray(food.manualFoodRoles)
    ? food.manualFoodRoles.filter(role => validRoles.includes(role))
    : [];
  const next = current.includes(roleKey)
    ? current.filter(role => role !== roleKey)
    : [...current, roleKey];
  food.manualFoodRoles = next;
  save();
  refreshFavoriteFoodsUi({
    preserveFoodId: id,
    preserveListScrollTop,
    preserveAnchorOffset,
  });
}

function refreshFavoriteFoodsUi({
  preserveScrollY = null,
  preserveFoodId = '',
  preserveListScrollTop = null,
  preserveAnchorOffset = null,
} = {}) {
  const activeView = document.querySelector('.view.active')?.id || '';
  if (activeView === 'view-piano') {
    if (typeof renderPiano === 'function') renderPiano();
  } else if (activeView === 'view-profilo') {
    if (typeof renderProfile === 'function') renderProfile();
  } else {
    if (typeof renderPiano === 'function') renderPiano();
    if (typeof renderProfile === 'function') renderProfile();
  }
  if (Number.isFinite(preserveScrollY)) {
    requestAnimationFrame(() => window.scrollTo(0, preserveScrollY));
  }
  if (preserveFoodId && (Number.isFinite(preserveListScrollTop) || Number.isFinite(preserveAnchorOffset))) {
    requestAnimationFrame(() => {
      const nextList = document.getElementById('ff-list');
      if (!nextList) return;
      if (Number.isFinite(preserveListScrollTop)) {
        nextList.scrollTop = preserveListScrollTop;
      }
      requestAnimationFrame(() => {
        if (!Number.isFinite(preserveAnchorOffset)) return;
        const nextCard = nextList.querySelector(`.ff-item[data-food-id="${preserveFoodId}"]`);
        if (!nextCard) return;
        const nextOffset = nextCard.getBoundingClientRect().top - nextList.getBoundingClientRect().top;
        const delta = nextOffset - preserveAnchorOffset;
        if (Math.abs(delta) > 1) {
          nextList.scrollTop += delta;
        }
      });
    });
  }
}

function _toggleFfForm() {
  const form = document.getElementById('ff-add-form');
  const btn  = document.getElementById('ff-add-toggle');
  if (!form) return;
  const hidden = form.style.display === 'none' || form.style.display === '';
  form.style.display = hidden ? 'block' : 'none';
  if (btn) btn.style.display = hidden ? 'none' : '';
}
function openProfileFavoriteFoods() {
  closeDayModal();
  goView('piano');
  setTimeout(() => {
    const foodsCard = document.getElementById('piano-favorite-foods');
    const scrollTarget = foodsCard?.closest('.piano-section') || foodsCard;
    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    pulseTodayElement('#piano-favorite-foods .piano-coming-soon-card', 'ui-glow');
  }, 80);
}

function openPianoTemplates() {
  closeDayModal();
  goView('piano');
  setTimeout(() => {
    const templateSection = document.querySelector('#view-piano .piano-section-library');
    if (templateSection) {
      templateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    pulseTodayElement('#view-piano .piano-section-library', 'ui-glow');
  }, 80);
}

function focusTodayNotes() {
  const notes = document.getElementById('notes-input');
  const wrap = notes?.closest('.notes-section') || notes;
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => notes?.focus(), 180);
}
function focusTodayCheat() {
  if (typeof renderCheatWidget === 'function') renderCheatWidget();
  const cheatCard = document.getElementById('today-cheat-card');
  const cheatWrap = document.getElementById('cheat-widget');
  const target = cheatCard || cheatWrap || document.querySelector('.today-support-panel');
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    pulseTodayElement('#today-cheat-card', 'ui-glow');
    pulseTodayElement('#cheat-widget', 'ui-glow');
  }, 150);
}

function openFoodSuggestion(remK, remP, remC, remF) {
  const suggestion = suggestFood(+remK, +remP, +remC, +remF);
  let bodyHTML = '';
  if (!suggestion || !suggestion.picks.length) {
    bodyHTML = `<div class="sug-empty-state">
      <div class="sug-empty-icon">☆</div>
      <div class="sug-empty-title">Suggerimenti smart in arrivo</div>
      <div class="sug-empty-text">
        I cibi abituali restano in pausa finche questa parte non sara davvero pronta. Per ora in Piano teniamo attivi solo i template, che sono la base piu affidabile da usare.
      </div>
      <button class="sug-empty-cta" onclick="openPianoTemplates()">Apri template</button>
    </div>`;
  } else {
    const { picks, totalK, totalP, totalC } = suggestion;
    bodyHTML = `
      <div class="sug-intro">
        Ti mancano circa <strong>${Math.round(+remK)} kcal</strong>${+remP > 10 ? ` e <strong>${(+remP).toFixed(0)}g di proteine</strong>` : ''}.
      </div>
      ${picks.map(p => `
        <div class="sug-food-card">
          <div class="sug-food-top">
            <div class="sug-food-name">${htmlEsc(p.name)}</div>
            <div class="sug-food-chip">${p.grams}g</div>
          </div>
          <div class="sug-food-amount">Porzione suggerita</div>
          <div class="sug-food-macros">${p.k} kcal &nbsp;·&nbsp; P ${p.p}g &nbsp;·&nbsp; C ${p.c}g</div>
        </div>`).join('')}
      <div class="sug-total">Totale: ${totalK} kcal &nbsp;·&nbsp; P ${totalP}g &nbsp;·&nbsp; C ${totalC}g</div>`;
  }
  showDayModal({ icon: '💡', title: 'Cosa mangiare adesso', body: bodyHTML, noButtons: true });
}

function clearLogMeal(dateKey, mealIdx) {
  const dayType = resolveDayTypeForDate(dateKey);
  const hasItems = !!S.foodLog[dateKey]?.[mealIdx]?.length;
  if (!hasItems) return;
  if (!confirm('Vuoi davvero azzerare tutti gli alimenti di questo pasto?')) return;
  if (S.foodLog[dateKey]) delete S.foodLog[dateKey][mealIdx];
  syncDoneByDate(dateKey, dayType);
  save(); refreshMealCard(dayType, mealIdx);
}

function normalizeMacroDetailMetric(value, unit) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return unit === 'kcal'
    ? Math.round(safeValue)
    : Math.round(safeValue * 10) / 10;
}

function formatMacroDetailMetric(value, unit) {
  const normalized = normalizeMacroDetailMetric(value, unit);
  return `${normalized.toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: unit === 'kcal' ? 0 : 1
  })} ${unit}`;
}

function openMacroDetail(macroKey) {
  const type    = S.day;
  const meals   = S.meals[type] || [];
  const dateKey = S.selDate || localDate();
  const dayLog  = S.foodLog[dateKey] || {};
  const tgt     = S.macro[type] || {};
  const effectiveTargetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(dateKey, type)
    : tgt.k;
  const kcalExtra = Math.max(0, (effectiveTargetK || 0) - (tgt.k || 0));

  const macroMeta = {
    kcal: {
      lbl: 'Calorie',
      icon: '🔥',
      field: 'kcal100',
      unit: 'kcal',
      tgt: effectiveTargetK || 0,
      minValue: 1,
      roundEach: true,
      targetLabel: 'Obiettivo oggi',
      targetNote: kcalExtra > 0
        ? `${formatMacroDetailMetric(tgt.k || 0, 'kcal')} base + ${formatMacroDetailMetric(kcalExtra, 'kcal')} sgarro`
        : ''
    },
    prot: {
      lbl: 'Proteine',
      icon: '🥩',
      field: 'p100',
      unit: 'g',
      tgt: tgt.p || 0,
      minValue: 0.05,
      roundEach: false,
      targetLabel: 'Target giorno'
    },
    carb: {
      lbl: 'Carboidrati',
      icon: '🍚',
      field: 'c100',
      unit: 'g',
      tgt: tgt.c || 0,
      minValue: 0.05,
      roundEach: false,
      targetLabel: 'Target giorno'
    },
    fat: {
      lbl: 'Grassi',
      icon: '🧈',
      field: 'f100',
      unit: 'g',
      tgt: tgt.f || 0,
      minValue: 0.05,
      roundEach: false,
      targetLabel: 'Target giorno'
    },
  };
  const meta = macroMeta[macroKey];
  if (!meta) return;

  const sections = [];
  let totalMacro = 0;

  const buildSection = (mealName, items) => {
    const foodRows = (items || []).map(it => {
      const grams = Number(it?.grams || 0);
      const rawValue = Number(it?.[meta.field] || 0) * grams / 100;
      const value = meta.roundEach ? normalizeMacroDetailMetric(rawValue, meta.unit) : rawValue;
      return {
        name: it?.name || 'Alimento',
        grams,
        value,
      };
    }).filter(row => row.grams > 0 && row.value >= meta.minValue)
      .sort((a, b) => b.value - a.value);

    if (!foodRows.length) return;

    const mealTotal = foodRows.reduce((sum, row) => sum + row.value, 0);
    totalMacro += mealTotal;
    sections.push({
      mealName,
      mealTotal,
      foodRows,
    });
  };

  meals.forEach((meal, i) => {
    buildSection(meal.name, dayLog[i] || []);
  });

  // Pasti extra
  const _activeExtra = S.extraMealsActive?.[dateKey] || {};
  const extraDefs = { merenda: 'Merenda', spuntino: 'Spuntino' };
  Object.keys(_activeExtra).forEach(xKey => {
    buildSection(extraDefs[xKey] || xKey, dayLog[xKey] || []);
  });

  let rows = sections.map(section => `
    <div class="md-meal-block">
      <div class="md-meal-head">
        <div class="md-meal-name">${htmlEsc(section.mealName)}</div>
        <div class="md-meal-total">${formatMacroDetailMetric(section.mealTotal, meta.unit)}</div>
      </div>
      <div class="md-food-list">
        ${section.foodRows.map(row => `
          <div class="md-food-row">
            <div class="md-food-copy">
              <span class="md-food-name">${htmlEsc(row.name)}</span>
              <span class="md-food-meta">${formatMacroDetailMetric(row.grams, 'g')} loggati</span>
            </div>
            <span class="md-food-val">${formatMacroDetailMetric(row.value, meta.unit)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  if (!rows) rows = `<div class="md-empty">Nessun alimento loggato oggi per questo riepilogo.</div>`;

  const rem = (meta.tgt || 0) - totalMacro;
  const remCls = rem < 0 ? 'err' : rem < (meta.tgt || 0) * 0.15 ? 'warn' : 'ok';
  const remTxt = rem > 0
    ? `${formatMacroDetailMetric(rem, meta.unit)} mancanti`
    : rem < 0
      ? `${formatMacroDetailMetric(Math.abs(rem), meta.unit)} in più`
      : 'Obiettivo raggiunto';

  showDayModal({
    icon: meta.icon,
    title: meta.lbl,
    body: `<div class="md-shell ${macroKey}">
        <div class="md-summary">
          <div class="md-summary-copy">
            <div class="md-summary-kicker">Totale oggi</div>
            <div class="md-total-row">
              <span class="md-total">${formatMacroDetailMetric(totalMacro, meta.unit)}</span>
            </div>
          </div>
          <div class="md-balance ${remCls}">
            <span class="md-balance-lbl">${meta.targetLabel}</span>
            <span class="md-balance-val">${formatMacroDetailMetric(meta.tgt || 0, meta.unit)}</span>
            ${meta.targetNote ? `<span class="md-balance-note">${meta.targetNote}</span>` : ''}
            <span class="md-rem ${remCls}">${remTxt}</span>
          </div>
        </div>
        <div class="md-body-head">
          <div class="md-body-copy">
            <div class="md-body-kicker">Dettaglio per pasto</div>
            <div class="md-body-note">Alimenti ordinati dal contributo piu alto al piu basso.</div>
          </div>
        </div>
        <div class="md-body">${rows}</div>
      </div>`,
    noButtons: true,
    eyebrow: 'Recap alimenti',
    modalClass: 'day-modal-detail'
  });
}

function loadPlanToLog(dateKey, mealIdx, type) {
  const meal = S.meals[type][mealIdx];
  const items = (meal.items||[]).filter(it=>it.grams>0);
  if (!items.length) { toast('⚠️  Piano vuoto'); return; }
  if (!S.foodLog[dateKey]) S.foodLog[dateKey]={};
  S.foodLog[dateKey][mealIdx] = items.map(it=>({...it}));
  syncLoggedMealState(dateKey, mealIdx, type);
  save(); refreshMealCard(type, mealIdx);
  toast('✅  Piano caricato');
}
let _ffSearchResults = [];
let _ffSearchTimer = null;
let _editGramPreviewBound = false;

function bindEditGramPreview() {
  if (_editGramPreviewBound) return;
  document.addEventListener('input', (event) => {
    if (event.target?.id !== 'edit-gram-inp') return;
    const calc = document.getElementById('edit-gram-calc');
    if (!calc) return;
    const kcal100 = parseFloat(event.target.dataset.kcal100 || '0') || 0;
    const grams = +event.target.value || 0;
    calc.textContent = '= ' + Math.round(kcal100 * grams / 100) + ' kcal';
    renderEditGramRecapFromInput(event.target);
  });
  _editGramPreviewBound = true;
}

function onFfSearch(inp) {
  const q = inp.value.trim();
  const sr = document.getElementById('ff-search-results');
  if (_ffSearchTimer) clearTimeout(_ffSearchTimer);
  if (q.length < 2) { if (sr) sr.style.display = 'none'; return; }
  _ffSearchTimer = setTimeout(() => {
    searchFoods(q, (results, apiStatus) => {
      _ffSearchResults = results.slice(0, 8);
      if (!sr) return;
      if (!_ffSearchResults.length) {
        const emptyMsg = apiStatus?.off === 'loading'
          ? 'Sto ampliando la ricerca...'
          : 'Nessun risultato';
        sr.innerHTML = `<div class="ff-search-empty">${emptyMsg}</div>`;
        sr.style.display = 'block';
        return;
      }
      const statusHtml = apiStatus?.off === 'loading'
        ? `<div class="ff-search-state"><span class="fsr-spinner"></span>Ricerca ampliata su Open Food Facts...</div>`
        : apiStatus?.off === 'timeout'
          ? `<div class="ff-search-state is-warn">OFF lento: continuo con i risultati locali</div>`
          : apiStatus?.off === 'offline'
            ? `<div class="ff-search-state is-warn">Offline: uso solo risultati locali</div>`
            : apiStatus?.off === 'provider_error'
              ? `<div class="ff-search-state is-warn">Open Food Facts non raggiungibile</div>`
              : '';
      sr.innerHTML = statusHtml + _ffSearchResults.map((r, i) => `
        <div class="ff-sr-item" onclick="selectFfFood(${i})">
          <div class="ff-sr-name">${htmlEsc ? htmlEsc(r.name) : r.name}</div>
          ${r.brand ? `<div class="ff-sr-brand">${r.brand}</div>` : ''}
          <div class="ff-sr-macros">${r.kcal100} kcal · P ${r.p100}g · C ${r.c100}g · G ${r.f100}g</div>
        </div>`).join('');
      sr.style.display = 'block';
    }, { contextKey: 'favorite-foods' });
  }, 400);
}

function selectFfFood(i) {
  const food = _ffSearchResults[i];
  if (!food) return;
  if (typeof rememberFoodSelection === 'function') {
    const q = document.getElementById('ff-search-inp')?.value || food.name || '';
    rememberFoodSelection(food, typeof buildFoodQueryContext === 'function' ? buildFoodQueryContext(q) : { key: q }, 'favorite-foods');
  }
  fillFfFromProduct(food);
}

function addNoteTag(tag) {
  const inp = document.getElementById('notes-input');
  if (!inp) return;
  const val = inp.value.trim();
  inp.value = val ? val + ' ' + tag : tag;
  inp.focus();
  onNoteInput(inp);
}
function toggleSuppForm(scope = 'today') {
  const el = document.getElementById(`supp-form-${scope}`);
  if (!el) return;
  const willOpen = el.style.display === 'none';
  el.style.display = willOpen ? 'block' : 'none';
  if (willOpen) {
    setTimeout(() => document.getElementById(`sf-name-${scope}`)?.focus(), 40);
  }
}
function confirmAddSupp(scope = 'today') {
  const name = document.getElementById(`sf-name-${scope}`)?.value.trim();
  if (!name) { toast('❌  Inserisci il nome'); return; }
  const dose = document.getElementById(`sf-dose-${scope}`)?.value.trim() || '---';
  const when = document.getElementById(`sf-when-${scope}`)?.value.trim() || 'mattina';
  S.supplements.push({ id:'supp_'+Date.now(), name, dose, when, active:true });
  save();
  renderSuppToday();
  refreshTodayDerivedViews();
  refreshTodayAlertSurfaces();
  toast('✅  Integratore aggiunto');
}
function renderMeasCompare() {
  const sec = document.getElementById('meas-compare-section');
  const el  = document.getElementById('meas-compare');
  if (!sec || !el) return;
  const log = S.measurements.filter(m=>Object.values(m).some(v=>typeof v==='number'&&v!==null));
  if (log.length < 2) { sec.style.display='none'; return; }
  sec.style.display='block';
  const first = log[0], last = log[log.length-1];
  const KEYS = ['peso','vita','fianchi','petto','braccio','coscia'];
  const LABELS = {peso:'Peso',vita:'Vita',fianchi:'Fianchi',petto:'Petto',braccio:'Braccio',coscia:'Coscia'};
  const UNITS  = {peso:'kg',vita:'cm',fianchi:'cm',petto:'cm',braccio:'cm',coscia:'cm'};
  const rows = KEYS.filter(k=>first[k]!=null||last[k]!=null).map(k=>{
    const f=first[k], l=last[k];
    if(f==null&&l==null) return '';
    const d = (f!=null&&l!=null) ? (l-f).toFixed(1) : null;
    const isGood = k==='peso' ? (d>0) : (d<0); // bulk: peso su; misure: gi? o su dipende
    const dColor = d!=null ? (Math.abs(d)<0.1?'var(--muted)':isGood?'var(--on)':'var(--amber)') : 'var(--muted)';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--b1)">
      <span style="font-size:11px;font-weight:600;color:var(--muted);width:60px">${LABELS[k]}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)">${f!=null?f+' '+UNITS[k]:'?'}</span>
      <span style="color:var(--b2);font-size:11px">? </span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;color:var(--ink)">${l!=null?l+' '+UNITS[k]:'?'}</span>
      ${d!=null?`<span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${dColor};margin-left:auto">${+d>0?'+':''}${d} ${UNITS[k]}</span>`:''}
    </div>`;
  }).join('');
  const days = first.date&&last.date ? Math.round((new Date(last.date+'T12:00:00')-new Date(first.date+'T12:00:00'))/(86400000)) : null;
  el.innerHTML = `<div style="background:var(--surf);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;box-shadow:var(--sh)">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em">
      <span>Prima: ${first.date?.split('-').reverse().join('/')||'–'}</span>
      ${days?`<span>${days} giorni</span>`:''}
      <span>Ultima: ${last.date?.split('-').reverse().join('/')||'–'}</span>
    </div>
    ${rows}
  </div>`;
}
// ? ? ?  CHECK-IN SETTIMANALE ? ? ? 
function checkWeeklyCheckin() {
  const now = new Date();
  if (now.getDay() !== 1) return; // only Monday
  const todayStr = localDate(now);
  if (S.lastCheckin === todayStr) return;
  const weekKey = getWeekStartKey(now);
  if (!hasWeeklyCheckinContext()) {
    S.weeklyCheckinWarmupWeek = weekKey;
    saveSoon();
    return;
  }
  if (S.weeklyCheckinWarmupWeek !== weekKey) {
    S.weeklyCheckinWarmupWeek = weekKey;
    _weeklyCheckinDeferredWeek = weekKey;
    saveSoon();
    return;
  }
  if (_weeklyCheckinDeferredWeek === weekKey) return;

  const streak = calcStreak();
  const lastW  = S.weightLog.length ? S.weightLog[S.weightLog.length-1].val : null;
  const startW = S.weightLog.length ? S.weightLog[0].val : null;
  const delta  = (lastW&&startW) ? (lastW-startW).toFixed(1) : null;

  const phaseLabel = {bulk:'Bulk',cut:'Cut',mantieni:'Mantenimento'}[S.goal?.phase]||'';
  const weeksSince = S.goal?.startDate ? Math.floor((now-new Date(S.goal.startDate+'T12:00:00'))/(7*86400000))+1 : null;

  const kicker = document.getElementById('checkin-kicker');
  const title = document.getElementById('checkin-title');
  const body = document.getElementById('checkin-body');
  const stats = document.getElementById('checkin-stats');
  if (!kicker || !title || !body || !stats) return;

  kicker.textContent = weeksSince && phaseLabel
    ? `Settimana ${weeksSince} · ${phaseLabel}`
    : 'Check-in settimanale';
  title.textContent = 'Nuova settimana, facciamo il punto?';

  const statItems = [];
  if (streak > 0) statItems.push(`<div class="checkin-stat"><span class="checkin-stat-label">Streak</span><strong>${streak} giorni</strong></div>`);
  if (lastW != null) statItems.push(`<div class="checkin-stat"><span class="checkin-stat-label">Ultimo peso</span><strong>${lastW} kg</strong></div>`);
  if (delta !== null) statItems.push(`<div class="checkin-stat"><span class="checkin-stat-label">Trend</span><strong>${+delta>0?'+':''}${delta} kg</strong></div>`);
  stats.innerHTML = statItems.join('');

  const lines = [];
  lines.push('La settimana scorsa è chiusa: registrare il peso ora rende più puliti i grafici e più coerente il riepilogo.');
  if (streak > 0) lines.push(`Stai portando avanti una continuità di <strong>${streak} giorni</strong>.`);
  body.innerHTML = lines.join(' ');
  document.getElementById('checkin-modal').style.display = 'flex';
  lockUiScroll();
}

function closeCheckin() {
  document.getElementById('checkin-modal').style.display = 'none';
  unlockUiScroll();
  S.lastCheckin = localDate();
  save();
}

function checkinGoMeasure() {
  closeCheckin();
  goView('stats');
  setTimeout(()=>{ document.getElementById('w-in')?.focus(); }, 200);
}

function getWeekStartKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return localDate(d);
}

function hasWeeklyCheckinContext() {
  if ((S.weightLog || []).length > 0) return true;
  return Object.values(S.doneByDate || {}).some(entry => (entry?.activityCount || 0) > 0);
}
function onProf(i, v) {
  const lbl = S.profilo[i].l, old = S.profilo[i].v;
  if (v === old) return;
  if (!(S.profHist[lbl]||[]).length) profSave(lbl, old);
  S.profilo[i].v = v;
  profSave(lbl, v);
  // Sync Peso attuale ?  weightLog
  if (lbl === 'Peso attuale') {
    const num = parseFloat(v.replace(',','.'));
    if (!isNaN(num)) {
      const d = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
      // Only add if different from last entry
      const last = S.weightLog[S.weightLog.length-1];
      if (!last || last.val !== num) S.weightLog.push({date:d, val:num});
      syncAnagraficaWeightFromLogs();
      refreshNutritionTargetsFromState();
    }
  }
  save();
  renderProfilo();
  toast(`✅  ${lbl} aggiornato`);
}

function profSave(label, value) {
  if (!S.profHist[label]) S.profHist[label] = [];
  const h = S.profHist[label];
  if (h.length && h[h.length-1].value === value) return;
  const d = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' +
            new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  h.push({date:d, value});
  if (h.length > 50) h.shift();
}

function openDr(label) {
  const hist = S.profHist[label] || [];
  document.getElementById('dr-title').textContent = `📋  ${label}`;
  const body = document.getElementById('dr-body');
  if (!hist.length) {
    body.innerHTML = `<div style="text-align:center;padding:28px;color:var(--muted);font-size:13px">Nessuna modifica ancora.</div>`;
  } else {
    const rev = [...hist].reverse();
    body.innerHTML = rev.map((h,ri) => {
      const prev = rev[ri+1];
      let delta = '';
      if (prev) {
        const vn=parseFloat(h.value.replace(',','.')), vo=parseFloat(prev.value.replace(',','.'));
        if (!isNaN(vn)&&!isNaN(vo)) { const d=(vn-vo).toFixed(1); const cls=+d>0?'d-pos':+d<0?'d-neg':'d-neu'; delta=`<span class="w-delta ${cls}">${+d>0?'+':''}${d}</span>`; }
      }
      return `<div class="hi" style="${ri===0?'background:var(--on-l);border-radius:7px;padding:8px 10px;margin:-2px':''}">
        <span class="hi-date">${h.date}</span>
        <span class="hi-val">${h.value}${ri===0?' <span style="font-size:9px;color:var(--on);font-weight:800">✓ </span>':''}</span>
        ${delta}
        ${ri>0?`<button class="hi-restore" onclick="restoreProf('${esc(label)}','${esc(h.value)}')">? </button>`:''}
      </div>`;
    }).join('');
  }
  document.getElementById('dov').classList.add('open');
  lockUiScroll();
}
function restoreProf(label, value) {
  const i = S.profilo.findIndex(r=>r.l===label);
  if (i<0) return;
  S.profilo[i].v = value; profSave(label, value);
  save(); renderProfilo(); closeDrBtn(); toast(`✅  ${label} ripristinato`);
}
function closeDr(e) { if(e.target===document.getElementById('dov')) closeDrBtn(); }
function closeDrBtn() {
  document.getElementById('dov').classList.remove('open');
  unlockUiScroll();
}
function goView(name) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`.nav-tab[data-view="${name}"]`)?.classList.add('active');
  window.scrollTo(0, 0); // scroll to top on tab change
  if (name==='piano')   renderPiano();
  if (name==='stats')   renderStats();
  if (name==='profilo') renderProfile();
  if (name==='today')   renderToday();
  if (typeof renderAuthNav === 'function') renderAuthNav();
  syncTodayGreetingAutoRefresh();
}

function setPianoDay(type) {
  setDay(type);
  const active = document.querySelector('.view.active')?.id;
  if (active === 'view-piano') renderPiano();
}

function setStatsRange(range) {
  const allowed = new Set(['7d', '30d', '8w', 'all']);
  S.statsRange = allowed.has(range) ? range : '30d';
  save();
  if (document.querySelector('.view.active')?.id === 'view-stats') renderStats();
}

// ─────────────────────────────────────────────────────────────────────────────
// Anagrafica / TDEE handlers
// ─────────────────────────────────────────────────────────────────────────────

function setAnagSesso(s) {
  S.anagrafica.sesso = s;
  document.querySelectorAll('.sesso-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.s === s);
  });
  _updateFabbisognoPreview();
}

function setAnagFreq(k) {
  S.anagrafica.allenamentiSett = k;
  document.querySelectorAll('.freq-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.k === k);
  });
  _updateFabbisognoPreview();
}

function setAnagProf(key) {
  S.anagrafica.professione = key;
  // Update trigger label
  const label = PROFESSIONI.find(p => p.key === key)?.label || key;
  const cur = document.getElementById('pdrop-cur');
  if (cur) cur.textContent = label;
  // Update selected state on items
  document.querySelectorAll('.pdrop-item').forEach(b => {
    b.classList.toggle('sel', b.getAttribute('onclick')?.includes(`'${key}'`));
  });
  // Close dropdown
  document.getElementById('pdrop')?.classList.remove('open');
  _updateFabbisognoPreview();
}

function parseWeightLogDateLocal(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3], 12);
  const itMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (itMatch) return new Date(+itMatch[3], +itMatch[2] - 1, +itMatch[1], 12);
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLatestLoggedWeightEntry() {
  return (S.weightLog || [])
    .map(entry => {
      const dt = parseWeightLogDateLocal(entry.date);
      const val = Number(entry.val);
      return dt && Number.isFinite(val) ? { dt, val } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dt - b.dt)
    .pop() || null;
}

function syncAnagraficaWeightFromLogs(options = {}) {
  const { preserveIfEmpty = true } = options;
  if (!S.anagrafica) return null;
  const latest = getLatestLoggedWeightEntry();
  if (latest) {
    S.anagrafica.peso = latest.val;
    return latest.val;
  }
  if (!preserveIfEmpty) S.anagrafica.peso = null;
  return S.anagrafica.peso ?? null;
}

function getTodayWeightLogDateLabel() {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function upsertWeightLogByDate(value, date = getTodayWeightLogDateLabel()) {
  if (value == null || String(value).trim() === '') return false;
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  const existingIdx = (S.weightLog || []).findIndex(entry => entry?.date === date);
  if (existingIdx >= 0) {
    if (Number(S.weightLog[existingIdx]?.val) === num) return false;
    S.weightLog[existingIdx] = { ...S.weightLog[existingIdx], date, val: num };
    return true;
  }
  S.weightLog.push({ date, val: num });
  return true;
}

function upsertTodayWeightLog(value) {
  return upsertWeightLogByDate(value, getTodayWeightLogDateLabel());
}

function averageNumbers(values = []) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getAutoCalibrationSummary(baseGoal = S.goal, currentWeight = S.anagrafica?.peso) {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 13);
  start.setHours(12, 0, 0, 0);

  const entries = (S.weightLog || [])
    .map(entry => {
      const dt = parseWeightLogDateLocal(entry.date);
      return dt && Number.isFinite(entry.val) ? { dt, val: Number(entry.val) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dt - b.dt)
    .filter(entry => entry.dt >= start && entry.dt <= end);
  const goalStart = baseGoal?.startDate ? new Date(`${baseGoal.startDate}T12:00:00`) : null;
  const phaseEntries = goalStart instanceof Date && !Number.isNaN(goalStart.getTime())
    ? entries.filter(entry => entry.dt >= goalStart)
    : entries;

  const phase = baseGoal?.phase || 'mantieni';
  const fallback = {
    eligible: false,
    offsetKcal: 0,
    reason: 'Servono almeno 14 giorni con piu pesate per auto-calibrare.',
    deltaKg: null,
    weeklyRatePct: null,
    entries: phaseEntries.length,
  };

  if (phaseEntries.length < 4) return fallback;
  const spanDays = Math.round((phaseEntries[phaseEntries.length - 1].dt - phaseEntries[0].dt) / 86400000);
  if (spanDays < 10) return fallback;

  const phaseWindowStart = goalStart instanceof Date && !Number.isNaN(goalStart.getTime()) && goalStart > start ? goalStart : start;
  const split = new Date(phaseWindowStart);
  split.setDate(phaseWindowStart.getDate() + 6);
  const firstWeek = phaseEntries.filter(entry => entry.dt <= split).map(entry => entry.val);
  const secondWeek = phaseEntries.filter(entry => entry.dt > split).map(entry => entry.val);
  if (!firstWeek.length || !secondWeek.length) return fallback;

  const avgStart = averageNumbers(firstWeek);
  const avgEnd = averageNumbers(secondWeek);
  const deltaKg = Number((avgEnd - avgStart).toFixed(2));
  const refWeight = phaseEntries[phaseEntries.length - 1]?.val || Number(currentWeight) || 0;
  const weeklyRatePct = refWeight > 0 ? Number(((deltaKg / refWeight) * 100).toFixed(2)) : null;

  let offsetKcal = 0;
  let reason = 'Trend coerente: nessun aggiustamento automatico.';
  if (phase === 'cut') {
    if (weeklyRatePct != null && weeklyRatePct <= -0.9) {
      offsetKcal = 125;
      reason = 'Cut troppo rapido nelle ultime 2 settimane: alzo di 125 kcal.';
    } else if (weeklyRatePct != null && weeklyRatePct >= -0.2) {
      offsetKcal = -125;
      reason = 'Cut troppo lento o stabile nelle ultime 2 settimane: abbasso di 125 kcal.';
    }
  } else if (phase === 'bulk') {
    if (weeklyRatePct != null && weeklyRatePct >= 0.4) {
      offsetKcal = -125;
      reason = 'Bulk troppo veloce nelle ultime 2 settimane: riduco di 125 kcal.';
    } else if (weeklyRatePct != null && weeklyRatePct <= 0.05) {
      offsetKcal = 125;
      reason = 'Bulk troppo lento o fermo nelle ultime 2 settimane: alzo di 125 kcal.';
    }
  } else {
    if (weeklyRatePct != null && weeklyRatePct <= -0.2) {
      offsetKcal = 125;
      reason = 'Peso in discesa in mantenimento: alzo di 125 kcal.';
    } else if (weeklyRatePct != null && weeklyRatePct >= 0.2) {
      offsetKcal = -125;
      reason = 'Peso in salita in mantenimento: riduco di 125 kcal.';
    }
  }

  return {
    eligible: true,
    offsetKcal,
    reason,
    deltaKg,
    weeklyRatePct,
    entries: phaseEntries.length,
    windowDays: 14,
  };
}

function getGoalWithAutoCalibration(baseGoal = S.goal, currentWeight = S.anagrafica?.peso) {
  const calibration = getAutoCalibrationSummary(baseGoal, currentWeight);
  return {
    ...(baseGoal || {}),
    calibrationOffsetKcal: calibration.eligible ? calibration.offsetKcal : 0,
    calibrationMeta: calibration,
  };
}

function refreshNutritionTargetsFromState(options = {}) {
  const { saveDeferred = true } = options;
  const calibratedGoal = getGoalWithAutoCalibration(S.goal, S.anagrafica?.peso);
  S.goal = { ...S.goal, calibrationOffsetKcal: calibratedGoal.calibrationOffsetKcal, calibrationMeta: calibratedGoal.calibrationMeta };
  const result = computeNutrition(S.anagrafica, S.goal);
  if (!result) return null;
  S.macro.on = result.macroOn;
  S.macro.off = result.macroOff;
  if (saveDeferred) saveSoon();
  return result;
}

function toggleProfDropdown(e) {
  e.stopPropagation();
  const el = document.getElementById('pdrop');
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  // Close all dropdowns first
  document.querySelectorAll('.pdrop.open').forEach(d => d.classList.remove('open'));
  if (!wasOpen) el.classList.add('open');
}

// Close profession dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.pdrop.open').forEach(d => d.classList.remove('open'));
});

function _readAnagForm() {
  const v = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  return {
    ...S.anagrafica,
    nome: v('anag-nome'),
    eta: v('anag-eta'),
    altezza: v('anag-altezza'),
    peso: v('anag-peso'),
    passiGiornalieri: v('anag-passi'),
    grassoCorporeo: v('anag-grasso'),
  };
}

function getPendingGoalPhase() {
  const activeBtn = document.querySelector('.goal-phase-btn[data-phase][class*="active-"]');
  return activeBtn?.dataset.phase || S.goal?.phase || 'mantieni';
}

function _stepAnagField(id, dir) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const min  = inp.min  !== '' ? parseFloat(inp.min)  : -Infinity;
  const max  = inp.max  !== '' ? parseFloat(inp.max)  : Infinity;
  const step = inp.step !== '' ? parseFloat(inp.step) : 1;
  const val  = parseFloat(inp.value) || 0;
  const next = Math.min(max, Math.max(min, +(val + dir * step).toFixed(2)));
  inp.value  = next;
  _handleAnagInput(id, { forceValidate: true });
  _updateFabbisognoPreview();
}

function _normalizeAnagName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, ANAG_RULES.nome.maxLength);
}

function _parseNullableAnagNumber(value) {
  if (value == null) return null;
  const raw = String(value).replace(',', '.').trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function validateAnagraficaDraft(rawDraft = {}, options = {}) {
  const requireFields = new Set(options.requireFields || []);
  const normalized = {
    ...S.anagrafica,
    ...rawDraft,
    nome: _normalizeAnagName(rawDraft.nome),
    eta: _parseNullableAnagNumber(rawDraft.eta),
    altezza: _parseNullableAnagNumber(rawDraft.altezza),
    peso: _parseNullableAnagNumber(rawDraft.peso),
    passiGiornalieri: _parseNullableAnagNumber(rawDraft.passiGiornalieri),
    grassoCorporeo: _parseNullableAnagNumber(rawDraft.grassoCorporeo),
  };
  const fieldErrors = {};

  if (requireFields.has('nome') && !normalized.nome) {
    fieldErrors.nome = 'Inserisci il tuo nome.';
  } else if (String(rawDraft.nome || '').trim() && !normalized.nome) {
    fieldErrors.nome = 'Inserisci un nome valido.';
  }

  [['eta', true], ['altezza', true], ['peso', false], ['passiGiornalieri', true], ['grassoCorporeo', false]].forEach(([key, integerOnly]) => {
    const rules = ANAG_RULES[key];
    const raw = rawDraft[key];
    const hasValue = String(raw ?? '').trim() !== '';
    const isRequired = requireFields.has(key);
    const value = normalized[key];
    if (!hasValue) {
      if (isRequired) fieldErrors[key] = `Inserisci ${rules.label.toLowerCase()}.`;
      return;
    }
    if (value == null) {
      fieldErrors[key] = `${rules.label} non valida.`;
      return;
    }
    if (integerOnly && !Number.isInteger(value)) {
      fieldErrors[key] = `${rules.label} deve essere un numero intero.`;
      return;
    }
    if (value < rules.min || value > rules.max) {
      fieldErrors[key] = `${rules.label} deve essere tra ${rules.min} e ${rules.max} ${rules.unit}.`;
    }
  });

  return {
    ok: Object.keys(fieldErrors).length === 0,
    normalized,
    fieldErrors,
    firstError: Object.values(fieldErrors)[0] || '',
  };
}

function _getAnagFieldMeta(fieldKey) {
  const map = {
    nome: { inputId: 'anag-nome', errorId: 'anag-error-nome' },
    eta: { inputId: 'anag-eta', errorId: 'anag-error-eta' },
    altezza: { inputId: 'anag-altezza', errorId: 'anag-error-altezza' },
    peso: { inputId: 'anag-peso', errorId: 'anag-error-peso' },
    passiGiornalieri: { inputId: 'anag-passi', errorId: 'anag-error-passi' },
    grassoCorporeo: { inputId: 'anag-grasso', errorId: 'anag-error-grasso' },
  };
  return map[fieldKey] || null;
}

function _setAnagFieldError(fieldKey, message = '') {
  const meta = _getAnagFieldMeta(fieldKey);
  if (!meta) return;
  const input = document.getElementById(meta.inputId);
  const error = document.getElementById(meta.errorId);
  const field = input?.closest('.anag-field');
  const hasError = !!message;
  if (input) input.classList.toggle('is-invalid', hasError);
  if (field) field.classList.toggle('is-invalid', hasError);
  if (error) error.textContent = message;
}

function _syncNameCounterByIds(inputId, counterId) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(counterId);
  if (!input || !counter) return;
  const length = Math.min(String(input.value || '').length, ANAG_RULES.nome.maxLength);
  counter.textContent = `${length}/${ANAG_RULES.nome.maxLength}`;
  counter.classList.toggle('is-near-limit', length >= ANAG_RULES.nome.maxLength - 8);
}

function _renderAnagFieldErrors(fieldErrors = {}) {
  ['nome', 'eta', 'altezza', 'peso', 'passiGiornalieri', 'grassoCorporeo'].forEach(key => {
    _setAnagFieldError(key, fieldErrors[key] || '');
  });
}

function _handleAnagInput(inputId, options = {}) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (inputId === 'anag-nome') {
    const normalized = _normalizeAnagName(input.value);
    if (input.value !== normalized) input.value = normalized;
    _syncNameCounterByIds('anag-nome', 'anag-nome-count');
  }
  const fieldKey = {
    'anag-nome': 'nome',
    'anag-eta': 'eta',
    'anag-altezza': 'altezza',
    'anag-peso': 'peso',
    'anag-passi': 'passiGiornalieri',
    'anag-grasso': 'grassoCorporeo',
  }[inputId];
  if (!fieldKey) return;
  if (options.forceValidate && ANAG_RULES[fieldKey] && fieldKey !== 'nome' && String(input.value || '').trim()) {
    const parsed = _parseNullableAnagNumber(input.value);
    if (parsed != null) {
      const rules = ANAG_RULES[fieldKey];
      const next = Math.min(rules.max, Math.max(rules.min, parsed));
      input.value = ['eta', 'altezza'].includes(fieldKey) ? String(Math.round(next)) : String(next);
    }
  }
  if (!options.forceValidate && !String(input.value || '').trim()) {
    _setAnagFieldError(fieldKey, '');
    return;
  }
  const validation = validateAnagraficaDraft(_readAnagForm());
  _setAnagFieldError(fieldKey, validation.fieldErrors[fieldKey] || '');
}

function _updateFabbisognoPreview() {
  const validation = validateAnagraficaDraft(_readAnagForm());
  const draft = validation.normalized;
  const el = document.getElementById('fab-preview');
  if (!el) return;
  _renderAnagFieldErrors(validation.fieldErrors);
  const draftGoal = { ...S.goal, phase: getPendingGoalPhase() };
  const result = validation.ok ? computeNutrition(draft, getGoalWithAutoCalibration(draftGoal, draft.peso)) : null;
  if (!result) {
    el.innerHTML = `<div class="fab-empty">Completa i campi per vedere il fabbisogno calcolato.</div>`;
    return;
  }
  const { bmr, pal, tdee, tdeeRange, formula, components, macroOn, macroOff, calibration } = result;
  const _isvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
  const phaseLabels = { bulk: 'Bulk — Massa', cut: 'Cut — Definizione', mantieni: 'Mantenimento' };
  const phaseLabel = phaseLabels[S.goal?.phase] || 'Mantenimento';
  el.innerHTML = `
    <div class="fab-row fab-row-top">
      <span class="fab-label">BMR <button class="fab-info-btn" onmouseenter="showFabBmrTip(this)" onmouseleave="hideTip('tip-fab-bmr')" onclick="showFabBmrTip(this)">${_isvg}</button></span>
      <span class="fab-value">${bmr} kcal</span>
      <span class="fab-note">${formula}</span>
    </div>
    <div class="fab-row">
      <span class="fab-label">NEAT <button class="fab-info-btn" onmouseenter="showFabPalTip(this)" onmouseleave="hideTip('tip-fab-pal')" onclick="showFabPalTip(this)">${_isvg}</button></span>
      <span class="fab-value">${components.neat.base} kcal</span>
      <span class="fab-note">${components.neat.label}</span>
    </div>
    <div class="fab-row">
      <span class="fab-label">EAT <button class="fab-info-btn" onmouseenter="showFabPalTip(this)" onmouseleave="hideTip('tip-fab-pal')" onclick="showFabPalTip(this)">${_isvg}</button></span>
      <span class="fab-value">${components.eat.base} kcal</span>
      <span class="fab-note">media allenamento</span>
    </div>
    <div class="fab-row">
      <span class="fab-label">TEF <button class="fab-info-btn" onmouseenter="showFabPalTip(this)" onmouseleave="hideTip('tip-fab-pal')" onclick="showFabPalTip(this)">${_isvg}</button></span>
      <span class="fab-value">${Math.round(components.tefPct * 100)}%</span>
      <span class="fab-note">termogenesi del cibo</span>
    </div>
    <div class="fab-row fab-row-tdee">
      <span class="fab-label">TDEE <button class="fab-info-btn" onmouseenter="showFabTdeeTip(this)" onmouseleave="hideTip('tip-fab-tdee')" onclick="showFabTdeeTip(this)">${_isvg}</button></span>
      <span class="fab-value">${tdee} kcal</span>
      <span class="fab-note">${tdeeRange ? `${tdeeRange.low}–${tdeeRange.high} kcal · eq. PAL ${pal}` : `eq. PAL ${pal}`}</span>
    </div>
    ${calibration?.offsetKcal ? `<div class="fab-row"><span class="fab-label">Calibrazione 14g</span><span class="fab-value">${calibration.offsetKcal > 0 ? '+' : ''}${calibration.offsetKcal} kcal</span><span class="fab-note">${calibration.reason}</span></div>` : ''}
    <div class="fab-divider"></div>
    <div class="fab-goal-header">
      <span class="fab-goal-phase">${phaseLabel}</span>
      <button class="fab-info-btn fab-info-btn--goal" onmouseenter="showFabGoalTip(this)" onmouseleave="hideTip('tip-fab-goal')" onclick="showFabGoalTip(this)">${_isvg} perché questi valori?</button>
    </div>
    <div class="fab-day-row">
      <span class="fab-day-label on-lbl">Giorno ON</span>
      <span class="fab-day-kcal">${macroOn.k} kcal</span>
      <span class="fab-day-macros">P ${macroOn.p}g · C ${macroOn.c}g · F ${macroOn.f}g</span>
    </div>
    <div class="fab-day-row">
      <span class="fab-day-label off-lbl">Giorno OFF</span>
      <span class="fab-day-kcal">${macroOff.k} kcal</span>
      <span class="fab-day-macros">P ${macroOff.p}g · C ${macroOff.c}g · F ${macroOff.f}g</span>
    </div>`;
}

function saveAnagrafica() {
  const validation = validateAnagraficaDraft(_readAnagForm());
  _renderAnagFieldErrors(validation.fieldErrors);
  if (!validation.ok) {
    toast(`⚠️ ${validation.firstError}`);
    return;
  }
  S.anagrafica = validation.normalized;
  S.goal.phase = getPendingGoalPhase();
  upsertTodayWeightLog(S.anagrafica.peso);
  const result = refreshNutritionTargetsFromState({ saveDeferred: false });
  if (result) {
    // Sync peso: aggiorna anche S.profilo per retrocompat
    if (S.anagrafica.peso) {
      const pr = S.profilo.find(r => r.l === 'Peso attuale');
      if (pr) pr.v = S.anagrafica.peso + ' kg';
    }
  }
  syncProfileRowsFromAnagrafica();
  save();
  if (typeof authEnsureRemoteProfile === 'function') authEnsureRemoteProfile().catch(() => {});
  if (typeof authQueueStateSync === 'function') authQueueStateSync();
  rerender();
  toast('✅ Profilo salvato — macro aggiornati');
}

let _welcomeState = null;
let _authEntryState = null;

function syncProfileRowsFromAnagrafica() {
  const setRow = (label, value) => {
    const row = S.profilo.find(r => r.l === label);
    if (row) row.v = value;
  };
  const professionLabel = PROFESSIONI.find(p => p.key === S.anagrafica.professione)?.label || 'Da definire';
  const allenamentiLabel = ALLENAMENTI.find(a => a.key === S.anagrafica.allenamentiSett)?.desc || 'Da definire';
  setRow('Nome', S.anagrafica.nome || 'Da impostare');
  setRow('Età', S.anagrafica.eta ? `${S.anagrafica.eta} anni` : 'Da impostare');
  setRow('Altezza', S.anagrafica.altezza ? `${S.anagrafica.altezza} cm` : 'Da impostare');
  setRow('Peso attuale', S.anagrafica.peso ? `${S.anagrafica.peso} kg` : 'Da impostare');
  setRow('Professione', S.anagrafica.passiGiornalieri ? `${professionLabel} · ~${S.anagrafica.passiGiornalieri} passi/die` : professionLabel);
  setRow('Attività fisica', allenamentiLabel);
}

function onboardingFreqFromDays(days) {
  const count = Array.isArray(days) ? days.length : 0;
  if (count <= 0) return '0';
  if (count <= 2) return '1-2';
  if (count <= 4) return '3-4';
  if (count <= 6) return '5-6';
  return '7+';
}

function getWelcomeDraft() {
  const days = Array.isArray(S.onDays) && S.onDays.length ? [...S.onDays] : [1, 3, 5];
  return {
    nome: S.anagrafica?.nome || '',
    sesso: S.anagrafica?.sesso || 'm',
    eta: S.anagrafica?.eta || '',
    altezza: S.anagrafica?.altezza || '',
    peso: S.anagrafica?.peso || '',
    passiGiornalieri: S.anagrafica?.passiGiornalieri || '',
    grassoCorporeo: S.anagrafica?.grassoCorporeo ?? '',
    professione: S.anagrafica?.professione || 'desk_sedentary',
    onDays: days,
    phase: S.goal?.phase || 'mantieni',
  };
}

function getWelcomePreview(data = getWelcomeDraft()) {
  const ana = {
    nome: data.nome || '',
    sesso: data.sesso || 'm',
    eta: parseInt(data.eta, 10) || null,
    altezza: parseInt(data.altezza, 10) || null,
    peso: parseFloat(data.peso) || null,
    passiGiornalieri: parseInt(data.passiGiornalieri, 10) || null,
    grassoCorporeo: data.grassoCorporeo === '' ? null : (parseFloat(data.grassoCorporeo) || null),
    professione: data.professione || 'desk_sedentary',
    allenamentiSett: onboardingFreqFromDays(data.onDays || []),
  };
  return computeNutrition(ana, { phase: data.phase || 'mantieni', calibrationOffsetKcal: 0, calibrationMeta: null });
}

function renderAuthEntry() {
  const el = document.getElementById('auth-entry');
  if (!el) return;
  const forceOpen = !!_authEntryState?.forceOpen;
  if (!forceOpen && (S.authEntryCompleted || S.onboardingCompleted)) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  if (!_authEntryState) _authEntryState = { mode: 'gateway', email: '', password: '', confirmPassword: '' };
  const mode = _authEntryState.mode || 'gateway';

  let body = '';
  if (mode === 'gateway') {
    body = `
      <div class="auth-entry-kicker">Ingresso</div>
      <div class="auth-entry-title">Scegli come entrare in MarciFit</div>
      <div class="auth-entry-sub">Puoi iniziare subito in locale oppure attivare un account per tenere profilo, pasti e progressi sempre con te.</div>
      <div class="auth-entry-stack">
        <div class="auth-entry-hero">
          <div class="auth-entry-hero-badge">Pronto in meno di 2 minuti</div>
          <div class="auth-entry-hero-title">Una base chiara oggi, continuità domani</div>
          <div class="auth-entry-hero-copy">Allenamento, pasti e progressi partono subito. Se vuoi, il cloud entra dopo senza cambiare esperienza.</div>
        </div>
        <div class="auth-entry-benefits">
          <span class="auth-entry-benefit">☁️ Backup sicuro</span>
          <span class="auth-entry-benefit">🔄 Sync multi-device</span>
          <span class="auth-entry-benefit">⚡ Guest supportato</span>
        </div>
        <button class="auth-entry-choice primary" onclick="openAuthMode('signup')">
          <div class="auth-entry-choice-top">
            <span class="auth-entry-choice-icon">✨</span>
            <span class="auth-entry-choice-tag">Consigliato</span>
          </div>
          <div class="auth-entry-choice-title">Crea account</div>
          <div class="auth-entry-choice-body">Per salvare profilo, pasti e progressi nel cloud e ritrovarli su altri dispositivi.</div>
        </button>
        <button class="auth-entry-choice secondary" onclick="openAuthMode('login')">
          <div class="auth-entry-choice-top">
            <span class="auth-entry-choice-icon">🔐</span>
            <span class="auth-entry-choice-tag">Rientra</span>
          </div>
          <div class="auth-entry-choice-title">Accedi</div>
          <div class="auth-entry-choice-body">Se hai già un account, riparti subito dai tuoi dati.</div>
        </button>
        <button class="auth-entry-choice guest" onclick="continueAsGuest()">
          <div class="auth-entry-choice-top">
            <span class="auth-entry-choice-icon">🚀</span>
            <span class="auth-entry-choice-tag">Subito</span>
          </div>
          <div class="auth-entry-choice-title">Continua senza account</div>
          <div class="auth-entry-choice-body">Usa l’app subito in locale. Potrai creare un account più avanti.</div>
        </button>
      </div>`;
  } else if (mode === 'signup') {
    body = `
      <div class="auth-entry-kicker">Crea account</div>
      <div class="auth-entry-title">Salva i tuoi dati</div>
      <div class="auth-entry-sub">${typeof authCanUseSupabase === 'function' && authCanUseSupabase() ? 'Registrazione reale attiva con Supabase.' : 'Registrazione pronta in locale. Se configuri Supabase, questo stesso flow userà il cloud.'}</div>
      <div class="auth-entry-form">
        <div class="auth-entry-field">
          <label class="auth-entry-label">Email</label>
          <input class="auth-entry-input" type="email" value="${htmlEsc(_authEntryState.email)}" oninput="setAuthField('email', this.value)" placeholder="nome@email.com">
        </div>
        <div class="auth-entry-field">
          <label class="auth-entry-label">Password</label>
          <input class="auth-entry-input" type="password" value="${htmlEsc(_authEntryState.password)}" oninput="setAuthField('password', this.value)" placeholder="Almeno 8 caratteri">
        </div>
        <div class="auth-entry-field">
          <label class="auth-entry-label">Conferma password</label>
          <input class="auth-entry-input" type="password" value="${htmlEsc(_authEntryState.confirmPassword)}" oninput="setAuthField('confirmPassword', this.value)" placeholder="Ripeti la password">
        </div>
        <div class="auth-entry-callout">${typeof authCanUseSupabase === 'function' && authCanUseSupabase() ? 'L’account verrà creato nel cloud e i dati potranno sincronizzarsi tra dispositivi.' : 'Per ora l’account viene creato in locale su questo dispositivo. Puoi attivare Supabase dalla card Account in Profilo.'}</div>
      </div>`;
  } else {
    body = `
      <div class="auth-entry-kicker">Accedi</div>
      <div class="auth-entry-title">Rientra nel tuo profilo</div>
      <div class="auth-entry-sub">${typeof authCanUseSupabase === 'function' && authCanUseSupabase() ? 'Accesso reale attivo con Supabase.' : 'Accesso locale attivo. Se configuri Supabase, da qui userai il cloud senza cambiare flusso.'}</div>
      <div class="auth-entry-form">
        <div class="auth-entry-field">
          <label class="auth-entry-label">Email</label>
          <input class="auth-entry-input" type="email" value="${htmlEsc(_authEntryState.email)}" oninput="setAuthField('email', this.value)" placeholder="nome@email.com">
        </div>
        <div class="auth-entry-field">
          <label class="auth-entry-label">Password</label>
          <input class="auth-entry-input" type="password" value="${htmlEsc(_authEntryState.password)}" oninput="setAuthField('password', this.value)" placeholder="La tua password">
        </div>
        <button class="auth-entry-inline-link" type="button" onclick="requestPasswordReset()">Password dimenticata?</button>
        <div class="auth-entry-callout">${typeof authCanUseSupabase === 'function' && authCanUseSupabase() ? 'Se il cloud contiene già un profilo, MarciFit lo userà come base e manterrà anche la cache locale del dispositivo.' : 'Ogni account usa un salvataggio locale separato. Puoi attivare Supabase dalla card Account in Profilo per usare il cloud.'}</div>
      </div>`;
  }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="auth-entry-shell">
      <div class="auth-entry-top">
        <div class="auth-entry-mark">${mode === 'gateway' ? 'Ingresso' : mode === 'signup' ? 'Registrazione' : 'Accesso'}</div>
        ${mode !== 'gateway' ? `<button class="auth-entry-back" onclick="openAuthMode('gateway')">Indietro</button>` : ''}
      </div>
      <div class="auth-entry-card">
        ${body}
      </div>
      <div class="auth-entry-foot">
        ${mode === 'gateway' ? '' : `<button class="auth-entry-btn primary" onclick="submitAuthPlaceholder('${mode}')">${mode === 'signup' ? 'Crea account' : 'Accedi'}</button>`}
        ${mode !== 'gateway' ? `<button class="auth-entry-btn secondary" onclick="continueAsGuest()">Continua senza account</button>` : ''}
      </div>
      ${mode === 'gateway' ? `<div class="auth-entry-note">Potrai sempre creare un account più avanti senza perdere il lavoro fatto in locale.</div>` : ''}
    </div>`;
  lockUiScroll();
}

function openAuthEntry(forceOpen = true) {
  if (!_authEntryState) _authEntryState = { mode: 'gateway', email: '', password: '', confirmPassword: '' };
  _authEntryState.forceOpen = !!forceOpen;
  renderAuthEntry();
}

function closeAuthEntry() {
  const el = document.getElementById('auth-entry');
  if (el) {
    el.style.display = 'none';
    el.innerHTML = '';
  }
  if (_authEntryState) _authEntryState.forceOpen = false;
  unlockUiScroll(true);
}

function openAuthMode(mode) {
  if (!_authEntryState) _authEntryState = { mode: 'gateway', email: '', password: '', confirmPassword: '' };
  _authEntryState.mode = mode;
  renderAuthEntry();
}

function setAuthField(key, value) {
  if (!_authEntryState) _authEntryState = { mode: 'gateway', email: '', password: '', confirmPassword: '' };
  _authEntryState[key] = value;
}

function continueAsGuest() {
  S.authEntryCompleted = true;
  save();
  closeAuthEntry();
  if (typeof renderAuthNav === 'function') renderAuthNav();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  openWelcomeOnboarding();
}

async function requestPasswordReset() {
  const email = String(_authEntryState?.email || '').trim();
  if (!email) {
    toast('⚠️ Inserisci prima l’email');
    return;
  }
  const result = typeof authSendPasswordReset === 'function'
    ? await authSendPasswordReset(email)
    : { ok: false, message: 'Reset password non disponibile' };
  toast(`${result.ok ? '✉️' : '⚠️'} ${result.message}`);
}

async function submitAuthPlaceholder(mode) {
  const email = String(_authEntryState?.email || '').trim();
  const password = String(_authEntryState?.password || '');
  if (!email) { toast('⚠️ Inserisci l’email'); return; }
  if (!password) { toast('⚠️ Inserisci la password'); return; }
  if (mode === 'signup') {
    const confirmPassword = String(_authEntryState?.confirmPassword || '');
    if (password !== confirmPassword) {
      toast('⚠️ Le password non coincidono');
      return;
    }
    const result = typeof signUpWithEmail === 'function'
      ? await signUpWithEmail(email, password)
      : { ok: false, message: 'Auth non disponibile' };
    if (!result.ok) {
      toast(`⚠️ ${result.message}`);
      return;
    }
    if (result.pendingConfirmation) {
      if (typeof renderAuthNav === 'function') renderAuthNav();
      if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
      toast(`✉️ ${result.message}`);
      openAuthMode('login');
      return;
    }
    S.authEntryCompleted = true;
    save();
    if (typeof authSyncStateToCloud === 'function') await authSyncStateToCloud(true);
    toast('✅ Account creato');
    location.reload();
    return;
  }
  const result = typeof signInWithEmail === 'function'
    ? await signInWithEmail(email, password)
    : { ok: false, message: 'Auth non disponibile' };
  if (!result.ok) {
    toast(`⚠️ ${result.message}`);
    return;
  }
  toast('✅ Accesso effettuato');
  location.reload();
}

function renderWelcomeOnboarding() {
  const el = document.getElementById('welcome-onboarding');
  if (!el) return;
  if (S.onboardingCompleted || !S.authEntryCompleted) {
    el.style.display = 'none';
    return;
  }
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };

  const step = _welcomeState.step;
  const data = _welcomeState.data;
  const direction = _welcomeState.direction || 'forward';
  const preview = getWelcomePreview(data);
  const DOW = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const professionChoices = [
    { key: 'desk_sedentary', icon: '🪑', title: 'Poco', body: 'Lavoro sedentario e pochi spostamenti', meta: 'Routine più statica' },
    { key: 'standing', icon: '🚶', title: 'Abbastanza', body: 'Ti muovi spesso durante la giornata', meta: 'Attività distribuita' },
    { key: 'physical_light', icon: '⚡', title: 'Molto', body: 'Giornate attive o lavoro fisico', meta: 'Dispendio più alto' },
  ];
  const goalChoices = [
    { key: 'bulk', icon: '📈', title: 'Bulk', body: 'Per spingere la crescita muscolare', cls: 'goal-bulk', meta: 'Più spinta in allenamento' },
    { key: 'cut', icon: '✂️', title: 'Cut', body: 'Per perdere grasso mantenendo più massa possibile', cls: 'goal-cut', meta: 'Definizione controllata' },
    { key: 'mantieni', icon: '⚖️', title: 'Mantieni', body: 'Per restare stabile e performante', cls: 'goal-maintain', meta: 'Equilibrio e costanza' },
  ];
  const progress = `Passo ${step + 1} di 6`;

  let body = '';
  if (step === 0) {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Più di una dieta</div>
        <div class="welcome-title">MarciFit costruisce la tua giornata fitness, non solo i macro</div>
        <div class="welcome-sub">Allenamento, pasti, scanner, check-in e supporto quotidiano dentro un unico flusso pensato per farti restare costante.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-hero">
          <div class="welcome-hero-copy">
            <div class="welcome-hero-badge">Esclusive MarciFit</div>
            <div class="welcome-hero-title">Tutto quello che ti serve per seguire il piano senza attrito</div>
            <div class="welcome-hero-text">Ogni giornata si adatta al tuo ritmo: target diversi nei giorni Workout e Rest, supporto pratico quando devi scegliere cosa mangiare e uno storico che ti aiuta a non perdere il filo.</div>
          </div>
          <div class="welcome-hero-shot">
            <div class="welcome-hero-card hero-primary">
              <div class="welcome-hero-card-top">
                <span class="welcome-hero-chip on">Workout Day</span>
                <span class="welcome-hero-chip soft">live</span>
              </div>
              <div class="welcome-hero-kcal">${preview ? preview.macroOn.k : 2350} kcal</div>
              <div class="welcome-hero-macros">P ${preview ? preview.macroOn.p : 130} · C ${preview ? preview.macroOn.c : 295} · F ${preview ? preview.macroOn.f : 70}</div>
              <div class="welcome-hero-bars">
                <span style="width:82%"></span>
                <span style="width:64%"></span>
                <span style="width:46%"></span>
              </div>
            </div>
          </div>
          <div class="welcome-feature-rail" aria-label="Feature esclusive">
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">🔥</div>
              <div class="welcome-feature-title">Workout/Rest reali</div>
              <div class="welcome-feature-text">Target diversi in base a come si muove davvero la tua settimana.</div>
            </div>
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">🍽️</div>
              <div class="welcome-feature-title">Planner guidato</div>
              <div class="welcome-feature-text">Template, preferiti e suggerimenti rapidi per decidere prima.</div>
            </div>
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">📷</div>
              <div class="welcome-feature-title">Barcode veloce</div>
              <div class="welcome-feature-text">Scansioni, confermi e registri senza interrompere la giornata.</div>
            </div>
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">📈</div>
              <div class="welcome-feature-title">Check-in smart</div>
              <div class="welcome-feature-text">Peso, trend e riepilogo settimana sempre leggibili e utili.</div>
            </div>
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">⚡</div>
              <div class="welcome-feature-title">Log veloce</div>
              <div class="welcome-feature-text">Confermi i pasti e tieni il ritmo senza rallentare la giornata.</div>
            </div>
            <div class="welcome-feature-card">
              <div class="welcome-feature-icon">🎯</div>
              <div class="welcome-feature-title">Routine chiara</div>
              <div class="welcome-feature-text">Supporto visivo continuo per capire subito cosa fare adesso.</div>
            </div>
          </div>
        </div>
      </div>`;
  } else if (step === 1) {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Partiamo da te</div>
        <div class="welcome-title">I tuoi dati base</div>
        <div class="welcome-sub">Servono per stimare il tuo fabbisogno iniziale in modo sensato.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-grid">
          <div class="welcome-field welcome-validate-field wide" data-welcome-field="nome">
            <div class="field-label-row">
              <label class="welcome-label">Nome</label>
              <div class="name-char-count name-char-count-welcome" id="welcome-nome-count">${Math.min(String(data.nome || '').length, 40)}/40</div>
            </div>
            <input id="welcome-nome-input" class="welcome-input" maxlength="40" autocomplete="name" value="${htmlEsc(data.nome)}" oninput="welcomeSetField('nome', this.value)" onblur="welcomeValidateBaseField('nome', true)" placeholder="Come ti chiami?">
            <div class="welcome-field-error" id="welcome-error-nome"></div>
          </div>
          <div class="welcome-field">
            <label class="welcome-label">Sesso</label>
            <select class="welcome-select" onchange="welcomeSetField('sesso', this.value)">
              <option value="m"${data.sesso === 'm' ? ' selected' : ''}>Uomo</option>
              <option value="f"${data.sesso === 'f' ? ' selected' : ''}>Donna</option>
            </select>
          </div>
          <div class="welcome-field welcome-validate-field" data-welcome-field="eta">
            <label class="welcome-label">Età</label>
            <div class="welcome-inline">
              <input class="welcome-input" type="number" min="10" max="99" inputmode="numeric" value="${htmlEsc(data.eta)}" oninput="welcomeSetField('eta', this.value)" onblur="welcomeValidateBaseField('eta', true)">
              <span class="welcome-unit">anni</span>
            </div>
            <div class="welcome-field-error" id="welcome-error-eta"></div>
          </div>
          <div class="welcome-field welcome-validate-field" data-welcome-field="altezza">
            <label class="welcome-label">Altezza</label>
            <div class="welcome-inline">
              <input class="welcome-input" type="number" min="120" max="250" inputmode="numeric" value="${htmlEsc(data.altezza)}" oninput="welcomeSetField('altezza', this.value)" onblur="welcomeValidateBaseField('altezza', true)">
              <span class="welcome-unit">cm</span>
            </div>
            <div class="welcome-field-error" id="welcome-error-altezza"></div>
          </div>
          <div class="welcome-field welcome-validate-field" data-welcome-field="peso">
            <label class="welcome-label">Peso</label>
            <div class="welcome-inline">
              <input class="welcome-input" type="number" min="30" max="300" step="0.1" inputmode="decimal" value="${htmlEsc(data.peso)}" oninput="welcomeSetField('peso', this.value)" onblur="welcomeValidateBaseField('peso', true)">
              <span class="welcome-unit">kg</span>
            </div>
            <div class="welcome-field-error" id="welcome-error-peso"></div>
          </div>
          <div class="welcome-field welcome-validate-field wide" data-welcome-field="grassoCorporeo">
            <label class="welcome-label">% Grasso corporeo <span style="font-weight:500;text-transform:none;letter-spacing:0">(opz.)</span></label>
            <div class="welcome-inline">
              <input class="welcome-input" type="number" min="3" max="60" step="0.1" inputmode="decimal" value="${htmlEsc(data.grassoCorporeo)}" oninput="welcomeSetField('grassoCorporeo', this.value)" onblur="welcomeValidateBaseField('grassoCorporeo', true)" placeholder="Se la conosci">
              <span class="welcome-unit">%</span>
            </div>
            <div class="welcome-field-error" id="welcome-error-grassoCorporeo"></div>
          </div>
        </div>
      </div>`;
  } else if (step === 2) {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Stile di vita</div>
        <div class="welcome-title">Quanto ti muovi davvero fuori dalla palestra?</div>
        <div class="welcome-sub">Bastano tre profili chiari per calibrare meglio consumo calorico, fame e distribuzione dei target.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-insight-card">
          <div class="welcome-insight-kicker">Perché conta</div>
          <div class="welcome-insight-title">Una giornata più attiva cambia davvero il tuo fabbisogno</div>
          <div class="welcome-insight-text">Scegli il profilo che ti somiglia di più: MarciFit aggiusterà il punto di partenza senza farti sovrastimare o sottostimare le calorie.</div>
        </div>
      <div class="welcome-grid" style="margin-bottom:14px">
        <div class="welcome-field welcome-validate-field wide" data-welcome-field="passiGiornalieri">
          <label class="welcome-label">Passi medi al giorno <span style="font-weight:500;text-transform:none;letter-spacing:0">(opz.)</span></label>
          <div class="welcome-inline">
            <input class="welcome-input" type="number" min="1000" max="40000" step="100" inputmode="numeric" value="${htmlEsc(data.passiGiornalieri || '')}" oninput="welcomeSetField('passiGiornalieri', this.value)" onblur="welcomeValidateBaseField('passiGiornalieri', true)" placeholder="Es. 8000">
            <span class="welcome-unit">passi</span>
          </div>
          <div class="welcome-field-error" id="welcome-error-passiGiornalieri"></div>
        </div>
      </div>
      <div class="welcome-choice-grid">
        ${professionChoices.map(choice => `
          <button class="welcome-choice${data.professione === choice.key ? ' active' : ''}" data-welcome-choice-field="professione" data-value="${choice.key}" onclick="welcomeSetField('professione','${choice.key}')">
            <div class="welcome-choice-top">
              <span class="welcome-choice-icon">${choice.icon}</span>
              <span class="welcome-choice-pill">${choice.meta}</span>
            </div>
            <div class="welcome-choice-title">${choice.title}</div>
            <div class="welcome-choice-body">${choice.body}</div>
          </button>
        `).join('')}
      </div>
      </div>`;
  } else if (step === 3) {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Allenamento</div>
        <div class="welcome-title">Quali giorni vuoi far contare come Workout?</div>
        <div class="welcome-sub">Segna la tua settimana tipo: poi potrai sempre correggere al volo dalla dashboard se qualcosa cambia.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-insight-card">
          <div class="welcome-insight-kicker">Setup calendario</div>
          <div class="welcome-insight-title">Allenamento e riposo guidano tutta l’app</div>
          <div class="welcome-insight-text">Da qui partono macro giornalieri, planner e ritmo settimanale. Ti basta disegnare la tua base.</div>
        </div>
        <div class="welcome-days-shell">
        <div class="welcome-days">
          ${DOW.map((label, idx) => `
            <button class="welcome-day-btn${data.onDays.includes(idx) ? ' active' : ''}" data-welcome-day="${idx}" onclick="welcomeToggleDay(${idx})">${label}</button>
          `).join('')}
        </div>
        <div class="welcome-days-summary">
          <span class="welcome-days-summary-kicker">Workout stimati</span>
          <strong id="welcome-days-summary-value">${ALLENAMENTI.find(a => a.key === onboardingFreqFromDays(data.onDays))?.desc || 'Da definire'}</strong>
        </div>
        </div>
      </div>`;
  } else if (step === 4) {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Obiettivo</div>
        <div class="welcome-title">Su cosa vuoi spingere in questa fase?</div>
        <div class="welcome-sub">Scegli il focus del momento: MarciFit adatterà calorie, macro e tono delle giornate in quella direzione.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-insight-card">
          <div class="welcome-insight-kicker">Direzione chiara</div>
          <div class="welcome-insight-title">Un obiettivo netto rende tutto più coerente</div>
          <div class="welcome-insight-text">Non è una scelta definitiva: è il modo più semplice per far partire l’app con numeri già sensati per te.</div>
        </div>
      <div class="welcome-choice-grid">
        ${goalChoices.map(choice => `
          <button class="welcome-choice ${choice.cls}${data.phase === choice.key ? ' active' : ''}" data-welcome-choice-field="phase" data-value="${choice.key}" onclick="welcomeSetField('phase','${choice.key}')">
            <div class="welcome-choice-top">
              <span class="welcome-choice-icon">${choice.icon}</span>
              <span class="welcome-choice-pill">${choice.meta}</span>
            </div>
            <div class="welcome-choice-title">${choice.title}</div>
            <div class="welcome-choice-body">${choice.body}</div>
          </button>
        `).join('')}
      </div>
      </div>`;
  } else {
    body = `
      <div class="welcome-step-head">
        <div class="welcome-kicker">Setup iniziale</div>
        <div class="welcome-title">Pronto: il tuo profilo iniziale è costruito</div>
        <div class="welcome-sub">Da qui MarciFit inizierà a darti giornate, macro e ritmo settimanale coerenti con quello che hai scelto.</div>
      </div>
      <div class="welcome-stack">
        <div class="welcome-final-banner">
          <div class="welcome-final-badge">Sblocco iniziale</div>
          <div class="welcome-final-title">Entri con una base già pronta da usare</div>
          <div class="welcome-final-copy">Niente setup manuale a freddo: trovi subito giorni Workout/Rest, target iniziali e una struttura più chiara da seguire.</div>
        </div>
        <div class="welcome-summary">
          <div class="welcome-summary-row">
            <div class="welcome-summary-label">Nome</div>
            <div class="welcome-summary-value">${htmlEsc(data.nome || '—')}</div>
          </div>
          <div class="welcome-summary-row">
            <div class="welcome-summary-label">Movimento</div>
            <div class="welcome-summary-value">${htmlEsc(PROFESSIONI.find(p => p.key === data.professione)?.label || '—')}${data.passiGiornalieri ? ` · ~${htmlEsc(data.passiGiornalieri)} passi` : ''}</div>
          </div>
          <div class="welcome-summary-row">
            <div class="welcome-summary-label">Obiettivo</div>
            <div class="welcome-summary-value">${htmlEsc(goalChoices.find(g => g.key === data.phase)?.title || '—')}</div>
          </div>
          <div class="welcome-summary-row">
            <div class="welcome-summary-label">Workout</div>
            <div class="welcome-summary-value">${data.onDays.length ? data.onDays.map(d => DOW[d]).join(' · ') : 'Nessuno'}</div>
          </div>
        </div>
        ${preview ? `
          <div class="welcome-preview">
            <div class="welcome-preview-card workout">
              <div class="welcome-preview-kicker">Giorno Workout</div>
              <div class="welcome-preview-kcal">${preview.macroOn.k} kcal</div>
              <div class="welcome-preview-macros">P ${preview.macroOn.p}g · C ${preview.macroOn.c}g · F ${preview.macroOn.f}g</div>
            </div>
            <div class="welcome-preview-card rest">
              <div class="welcome-preview-kicker">Giorno Rest</div>
              <div class="welcome-preview-kcal">${preview.macroOff.k} kcal</div>
              <div class="welcome-preview-macros">P ${preview.macroOff.p}g · C ${preview.macroOff.c}g · F ${preview.macroOff.f}g</div>
            </div>
          </div>` : ''}
      </div>`;
  }

  el.style.display = 'block';
  el.innerHTML = `
    <div class="welcome-shell is-${direction}">
      <div class="welcome-top">
        <div class="welcome-progress">${progress}</div>
        ${step === 0 ? `<button class="welcome-top-action" type="button" onclick="backToAuthEntry()">Indietro</button>` : ''}
      </div>
      <div class="welcome-card welcome-card-step-${step === 5 ? 'final' : 'form'}">
        ${body}
      </div>
      <div class="welcome-foot">
        ${step > 0 ? `<button class="welcome-btn secondary" onclick="welcomePrevStep()">Indietro</button>` : ''}
        <button class="welcome-btn primary" onclick="${step === 5 ? 'completeWelcomeOnboarding()' : 'welcomeNextStep()'}">${step === 5 ? 'Entra in MarciFit' : 'Continua'}</button>
      </div>
      ${step === 0 ? `<div class="welcome-note">Ci vogliono meno di 2 minuti.</div>` : ''}
    </div>`;
  if (step === 1) syncWelcomeBaseFieldErrors();
  _welcomeState.direction = 'forward';
  lockUiScroll();
}

function backToAuthEntry() {
  closeWelcomeOnboarding();
  openAuthEntry(true);
}

function openWelcomeOnboarding() {
  if (S.onboardingCompleted || !S.authEntryCompleted) return;
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };
  renderWelcomeOnboarding();
}

function closeWelcomeOnboarding() {
  const el = document.getElementById('welcome-onboarding');
  if (el) {
    el.style.display = 'none';
    el.innerHTML = '';
  }
  unlockUiScroll(true);
}

function welcomeSetField(key, value, rerender = false) {
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };
  _welcomeState.data[key] = key === 'nome' ? _normalizeAnagName(value) : value;
  if (key === 'nome') _syncNameCounterByIds('welcome-nome-input', 'welcome-nome-count');
  if (rerender) renderWelcomeOnboarding();
  else if (_welcomeState.step === 1 && ['nome', 'eta', 'altezza', 'peso', 'grassoCorporeo'].includes(key)) {
    welcomeValidateBaseField(key);
  } else if (_welcomeState.step === 2 && key === 'passiGiornalieri') {
    welcomeValidateBaseField('passiGiornalieri');
  } else if (_welcomeState.step === 2 && key === 'professione') {
    syncWelcomeChoiceSelection('professione');
  } else if (_welcomeState.step === 4 && key === 'phase') {
    syncWelcomeChoiceSelection('phase');
  }
}

function syncWelcomeChoiceSelection(fieldKey) {
  const current = String(_welcomeState?.data?.[fieldKey] || '');
  document.querySelectorAll(`[data-welcome-choice-field="${fieldKey}"]`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === current);
  });
}

function syncWelcomeDaySelection() {
  const days = new Set(_welcomeState?.data?.onDays || []);
  document.querySelectorAll('[data-welcome-day]').forEach(btn => {
    const dow = Number(btn.dataset.welcomeDay);
    btn.classList.toggle('active', days.has(dow));
  });
  const summary = document.getElementById('welcome-days-summary-value');
  if (summary) {
    summary.textContent = ALLENAMENTI.find(a => a.key === onboardingFreqFromDays(_welcomeState?.data?.onDays || []))?.desc || 'Da definire';
  }
}

function getWelcomeBaseValidation(strict = false) {
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };
  return validateAnagraficaDraft(
    _welcomeState.data,
    strict ? { requireFields: ['nome', 'eta', 'altezza', 'peso'] } : {}
  );
}

function setWelcomeFieldError(fieldKey, message = '') {
  const field = document.querySelector(`[data-welcome-field="${fieldKey}"]`);
  const error = document.getElementById(`welcome-error-${fieldKey}`);
  const input = field?.querySelector('.welcome-input');
  const hasError = !!message;
  if (field) field.classList.toggle('is-invalid', hasError);
  if (input) input.classList.toggle('is-invalid', hasError);
  if (error) error.textContent = message;
}

function welcomeValidateBaseField(fieldKey, strict = false) {
  const validation = getWelcomeBaseValidation(strict);
  const value = _welcomeState?.data?.[fieldKey];
  const hasValue = String(value ?? '').trim() !== '';
  const message = validation.fieldErrors[fieldKey] || '';
  setWelcomeFieldError(fieldKey, !strict && !hasValue ? '' : message);
}

function syncWelcomeBaseFieldErrors(strict = false) {
  ['nome', 'eta', 'altezza', 'peso', 'passiGiornalieri', 'grassoCorporeo'].forEach(fieldKey => {
    welcomeValidateBaseField(fieldKey, strict);
  });
}

function welcomeToggleDay(dow) {
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };
  const days = new Set(_welcomeState.data.onDays || []);
  if (days.has(dow)) {
    if (days.size === 1) {
      toast('Seleziona almeno un giorno Workout');
      return;
    }
    days.delete(dow);
  } else {
    days.add(dow);
  }
  _welcomeState.data.onDays = [...days].sort((a, b) => a - b);
  if (_welcomeState.step === 3) syncWelcomeDaySelection();
  else renderWelcomeOnboarding();
}

function validateWelcomeStep(step, data) {
  if (step === 1) {
    const validation = validateAnagraficaDraft(data, { requireFields: ['nome', 'eta', 'altezza', 'peso'] });
    if (!validation.ok) return validation.firstError;
  }
  if (step === 2) {
    const validation = validateAnagraficaDraft(data, { requireFields: ['nome', 'eta', 'altezza', 'peso'] });
    if (validation.fieldErrors.passiGiornalieri) return validation.fieldErrors.passiGiornalieri;
  }
  if (step === 3 && (!Array.isArray(data.onDays) || !data.onDays.length)) {
    return 'Seleziona almeno un giorno Workout';
  }
  return '';
}

function welcomeNextStep() {
  if (!_welcomeState) _welcomeState = { step: 0, data: getWelcomeDraft() };
  const err = validateWelcomeStep(_welcomeState.step, _welcomeState.data);
  if (err) {
    if (_welcomeState.step === 1) syncWelcomeBaseFieldErrors(true);
    if (_welcomeState.step === 2) welcomeValidateBaseField('passiGiornalieri');
    toast(`⚠️ ${err}`);
    return;
  }
  _welcomeState.direction = 'forward';
  _welcomeState.step = Math.min(5, _welcomeState.step + 1);
  renderWelcomeOnboarding();
}

function welcomePrevStep() {
  if (!_welcomeState) return;
  _welcomeState.direction = 'backward';
  _welcomeState.step = Math.max(0, _welcomeState.step - 1);
  renderWelcomeOnboarding();
}

async function completeWelcomeOnboarding() {
  if (!_welcomeState) return;
  const data = _welcomeState.data;
  const validation = validateAnagraficaDraft(data, { requireFields: ['nome', 'eta', 'altezza', 'peso'] });
  if (!validation.ok) {
    toast(`⚠️ ${validation.firstError}`);
    return;
  }
  const profile = validation.normalized;
  const preview = getWelcomePreview(data);
  S.anagrafica.nome = profile.nome;
  S.anagrafica.sesso = data.sesso || 'm';
  S.anagrafica.eta = profile.eta;
  S.anagrafica.altezza = profile.altezza;
  S.anagrafica.peso = profile.peso;
  S.anagrafica.passiGiornalieri = profile.passiGiornalieri;
  S.anagrafica.grassoCorporeo = profile.grassoCorporeo;
  S.anagrafica.professione = data.professione || 'desk_sedentary';
  S.anagrafica.allenamentiSett = onboardingFreqFromDays(data.onDays || []);
  S.goal.phase = data.phase || 'mantieni';
  if (!S.goal.startDate) S.goal.startDate = localDate();
  S.onDays = [...(data.onDays || [1, 3, 5])].sort((a, b) => a - b);
  if (preview) {
    S.macro.on = preview.macroOn;
    S.macro.off = preview.macroOff;
  }
  refreshNutritionTargetsFromState({ saveDeferred: false });
  syncProfileRowsFromAnagrafica();
  S.onboardingCompleted = true;
  S.onboardingVersion = 1;
  const todayType = getScheduledDayType(localDate());
  S.day = todayType;
  S.planTab = todayType;
  save();
  if (typeof authEnsureRemoteProfile === 'function') await authEnsureRemoteProfile();
  if (typeof authSyncStateToCloud === 'function') await authSyncStateToCloud(true);
  closeWelcomeOnboarding();
  _welcomeState = null;
  goView('today');
  renderProfile();
  toast('✅ Profilo iniziale creato');
}
function updateMealTime(idx) {
  const startEl = document.getElementById(`mt-start-${idx}`);
  const endEl   = document.getElementById(`mt-end-${idx}`);
  if (!startEl || !endEl) return;
  const start = startEl.value;
  const end   = endEl.value;
  if (!start || !end) return;
  const newTime = `${start} \u2013 ${end}`;
  ['on', 'off'].forEach(type => {
    if (S.meals[type]?.[idx]) S.meals[type][idx].time = newTime;
  });
  saveSoon();
  const active = document.querySelector('.view.active')?.id;
  if (active === 'view-today') refreshMealCard(S.day, idx);
}

function setDay(type) {
  const prevType = S.day;
  S.day = type;
  S.planTab = type;
  document.getElementById('ds-on').className  = 'ds-btn' + (type==='on' ?' on':'');
  document.getElementById('ds-off').className = 'ds-btn' + (type==='off'?' off':'');
  // Update doneByDate so the calendar cell reflects the new day type immediately
  syncDoneByDate();
  save();
  renderToday();
  requestAnimationFrame(() => scheduleGreetingStateTransition(prevType, type));
}

// Single rerender ? updates whatever is currently visible + debounced save
function rerender() {
  saveSoon();
  const active = document.querySelector('.view.active')?.id;
  if (active==='view-today')   renderToday();
  if (active==='view-piano')   renderPiano();
  if (active==='view-stats')   renderStats();
  if (active==='view-profilo') renderProfile();
}
function calMove(delta) {
  S.calOffset = S.calOffset + delta;
  save();
  renderWeekCal(new Date());
}

function calGoToday() {
  S.calOffset = 0;
  S.selDate = localDate();
  save();
  renderToday();
}

function openCalPicker() {
  const now = new Date();
  // Find displayed Monday to pre-select the right month
  const todayDow = now.getDay();
  const todayMonOff = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + todayMonOff);
  thisMonday.setHours(0,0,0,0);
  const displayedMonday = new Date(thisMonday);
  displayedMonday.setDate(thisMonday.getDate() + S.calOffset * 7);
  S._pickerYear = displayedMonday.getFullYear();
  renderCalPicker();
  const picker = document.getElementById('cal-picker');
  if (picker) picker.style.display = 'flex';
}

function closeCalPicker() {
  const picker = document.getElementById('cal-picker');
  if (picker) picker.style.display = 'none';
}

function renderCalPicker() {
  const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const picker = document.getElementById('cal-picker');
  if (!picker) return;
  const yr = S._pickerYear;
  const now = new Date();
  const curMonth = now.getMonth(), curYear = now.getFullYear();
  const todayDow = now.getDay();
  const todayMonOff = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + todayMonOff);
  thisMonday.setHours(0,0,0,0);
  const displayedMonday = new Date(thisMonday);
  displayedMonday.setDate(thisMonday.getDate() + S.calOffset * 7);
  const displayedMonth = displayedMonday.getMonth();
  const displayedYear = displayedMonday.getFullYear();
  picker.innerHTML = `<div class="cal-picker-box">
    <div class="cal-picker-top">
      <div class="cal-picker-kicker">Calendario</div>
      <div class="cal-picker-title-row">
        <div class="cal-picker-title">${MONTHS[displayedMonth]}</div>
        <span class="cal-picker-chip">${displayedYear === curYear && displayedMonth === curMonth ? 'oggi' : 'in vista'}</span>
      </div>
      <div class="cal-picker-sub">Scegli il mese da mostrare nel calendario settimanale e aggiorna subito la griglia sopra.</div>
    </div>
    <div class="cal-picker-header">
      <button class="cal-picker-arrow" onclick="S._pickerYear--;renderCalPicker()">&#x2039;</button>
      <span class="cal-picker-year">${yr}</span>
      <button class="cal-picker-arrow" onclick="S._pickerYear++;renderCalPicker()">&#x203A;</button>
    </div>
    <div class="cal-picker-months">
      ${MONTHS_SHORT.map((m,i) => {
        const isCur = i === curMonth && yr === curYear;
        const isActive = i === displayedMonth && yr === displayedYear;
        const note = isActive ? 'in vista' : (isCur ? 'oggi' : '');
        return `<button class="cal-picker-month${isCur?' cur':''}${isActive?' active':''}" onclick="pickerGoMonth(${yr},${i})">
          <span class="cal-picker-month-label">${m}</span>
          <span class="cal-picker-month-note">${note}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="cal-picker-actions">
      <button class="cal-picker-action is-secondary" onclick="closeCalPicker()">Chiudi</button>
      <button class="cal-picker-action is-primary" onclick="pickerGoToday()">Vai a oggi</button>
    </div>
  </div>`;
}

function pickerGoMonth(year, month) {
  const target = new Date(year, month, 1);
  const dow = target.getDay();
  const monOff = dow === 0 ? -6 : 1 - dow;
  const targetMonday = new Date(target);
  targetMonday.setDate(target.getDate() + monOff);
  targetMonday.setHours(0,0,0,0);
  const now = new Date();
  const todayDow = now.getDay();
  const todayMonOff = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + todayMonOff);
  thisMonday.setHours(0,0,0,0);
  const diffMs = targetMonday - thisMonday;
  S.calOffset = Math.round(diffMs / (7 * 24 * 3600 * 1000));
  save();
  closeCalPicker();
  renderWeekCal(new Date());
}

function pickerGoToday() {
  S.calOffset = 0;
  S.selDate = localDate();
  save();
  closeCalPicker();
  renderToday();
}

function calSelectDay(dateStr, dayType) {
  S.selDate = dateStr;
  S.day     = dayType;
  S.planTab = dayType;
  // Update switch buttons visually
  document.getElementById('ds-on').className  = 'ds-btn' + (dayType==='on' ?' on':'');
  document.getElementById('ds-off').className = 'ds-btn' + (dayType==='off'?' off':'');
  // Reset notes-input for the selected date
  const ni = document.getElementById('notes-input');
  if (ni) {
    delete ni.dataset.loaded;
    ni.dataset.key = dateStr;
    ni.value = S.notes[dateStr] || '';
  }
  save();
  renderToday();
  renderNotes();
}
let _noteTimer;
function onNoteInput(el) {
  const key = el.dataset.key || localDate();
  const val = el.value.trim();
  clearTimeout(_noteTimer);
  _noteTimer = setTimeout(() => {
    if (val) S.notes[key] = val;
    else delete S.notes[key];
    save();
    renderNotes();
    // show autosave indicator
    const ind = document.getElementById('notes-autosave');
    if (ind) {
      ind.textContent = '✅  Salvato';
      ind.classList.add('show');
      setTimeout(() => ind.classList.remove('show'), 1800);
    }
  }, 700);
}

function saveNote() {
  const inp = document.getElementById('notes-input');
  if (inp) onNoteInput(inp);
}

function renderNotes() {
  const q = S.noteSearch || '';
  const entries = Object.entries(S.notes)
    .filter(([,v]) => !q || v.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b)=>b[0].localeCompare(a[0])).slice(0,20);
  document.getElementById('notes-prev').innerHTML = entries.length ? entries.map(([k,v])=>`
    <div class="note-item">
      <span class="note-date">${k.split('-').reverse().join('/')}</span>
      <span class="note-text">${esc(v)}</span>
      <button class="note-del" onclick="deleteNote('${k}')">✕</button>
    </div>`).join('') : (q ? `<div style="font-size:12px;color:var(--muted);padding:8px 0">Nessuna nota per "${esc(q)}"</div>` : '');
}

function deleteNote(key) { delete S.notes[key]; save(); renderNotes(); }

function printDay() { window.print(); }
function macroAlerts() {
  const mo = S.macro.on, mf = S.macro.off;
  const a = [];

  // ? ?  1. Coerenza target ? ? 
  if (mo.p < 110 || mf.p < 110)
    a.push({cls:'err', ico:'🚨 ', msg:`<strong>Target proteine basso:</strong> rischio perdita muscolare. Consigliato ≥  130 g/die.`});
  else if (mo.p > 180)
    a.push({cls:'warn', ico:'⚠️ ', msg:`Target proteine ON molto alto (${mo.p} g). Oltre 180 g raramente migliora i risultati.`});
  if (mo.c < 150)
    a.push({cls:'warn', ico:'ℹ️ ', msg:`Target carb ON basso (${mo.c} g): rischio calo performance in allenamento.`});
  if (mf.c > mo.c)
    a.push({cls:'warn', ico:'⚠️ ', msg:`Target carb OFF (${mf.c} g) > ON (${mo.c} g) · solitamente dovrebbe essere il contrario.`});
  if (mo.f < 50)
    a.push({cls:'err', ico:'🚨 ', msg:`Target grassi troppo basso (${mo.f} g): minimo fisiologico ~50 g.`});
  if (mo.k - mf.k < 0)
    a.push({cls:'warn', ico:'⚠️ ', msg:`Target kcal OFF (${mf.k}) > ON (${mo.k}) · il surplus dovrebbe essere nei giorni di allenamento.`});

  // ? ?  2. Totali pasti vs target ? ? 
  ['on','off'].forEach(type => {
    const meals = S.meals[type];
    const tgt   = S.macro[type];
    const label = type === 'on' ? 'ON' : 'OFF';
    const totK = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[type][i2]);return s+mm.kcal;},0);
  const totP = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[type][i2]);return s+mm.p;},0);
  const totC = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[type][i2]);return s+mm.c;},0);
  const totF = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[type][i2]);return s+mm.f;},0);
    const dK = totK - tgt.k;
    const dP = totP - tgt.p;
    const dC = totC - tgt.c;
    const dF = totF - tgt.f;

    if (Math.abs(dK) > 300)
      a.push({cls:'err',  ico:'⚠️ ', msg:`<strong>Giorni ${label} ? scarto calorico alto:</strong> i pasti sommano <strong>${totK} kcal</strong> vs target <strong>${tgt.k} kcal</strong> (${dK>0?'+':''}${dK} kcal). Aggiusta le porzioni.`});
    else if (Math.abs(dK) > 100)
      a.push({cls:'warn', ico:'ℹ️ ', msg:`Giorni ${label} ? scarto calorico: ${totK} kcal vs ${tgt.k} target (<strong>${dK>0?'+':''}${dK} kcal</strong>).`});

    if (Math.abs(dP) > 20)
      a.push({cls:'warn', ico:'⚠️ ', msg:`Giorni ${label} ? proteine pasti: <strong>${totP} g</strong> vs target <strong>${tgt.p} g</strong> (${dP>0?'+':''}${dP} g).`});
    if (Math.abs(dC) > 40)
      a.push({cls:'warn', ico:'⚠️ ', msg:`Giorni ${label} ? carb pasti: <strong>${totC} g</strong> vs target <strong>${tgt.c} g</strong> (${dC>0?'+':''}${dC} g).`});
    if (Math.abs(dF) > 20)
      a.push({cls:'warn', ico:'⚠️ ', msg:`Giorni ${label} ? grassi pasti: <strong>${totF} g</strong> vs target <strong>${tgt.f} g</strong> (${dF>0?'+':''}${dF} g).`});
  });

  // ? ?  Ok se nessun alert ? ? 
  if (!a.length)
    a.push({cls:'ok', ico:'ℹ️ ', msg:'Target e pasti nella norma per entrambi i giorni.'});

  return a;
}
async function initAll() {
  if (typeof authSetBootstrapReady === 'function') authSetBootstrapReady(false);
  let postLogoutMode = null;
  try {
    postLogoutMode = sessionStorage.getItem('marcifit_post_logout_mode_v1');
  } catch (_) {
    postLogoutMode = null;
  }
  if (typeof authInit === 'function') await authInit();
  let authConflictChoice = null;
  let authConflictData = null;
  if (typeof authHydrateLocalCacheFromRemote === 'function') {
    const hydrateResult = await authHydrateLocalCacheFromRemote();
    if (hydrateResult?.conflict) {
      authConflictData = hydrateResult;
      authConflictChoice = await askAuthStateConflictChoice(hydrateResult);
      if (authConflictChoice === 'remote' && typeof authStoreRemoteStateLocally === 'function') {
        authStoreRemoteStateLocally(hydrateResult.remoteState, hydrateResult.remoteUpdatedAt);
      } else if (authConflictChoice === 'local' && typeof authMarkLocalStatePreferred === 'function') {
        authMarkLocalStatePreferred(hydrateResult.remoteUpdatedAt);
      }
    }
  }
  const hadSaved = loadSaved();
  const storageStatus = typeof getMarciFitStorageStatus === 'function' ? getMarciFitStorageStatus() : null;
  sanitizeMealIcons(S);
  ensureBootstrapDefaults(S);
  migrateTemplateMealTypes(S);
  migrateProfiloToAnagrafica(S);
  migrateFlatMealsToItems(S);
  normalizeLegacyMealIcons(S);
  finalizeBootstrapState(S, hadSaved);
  normalizeCheatConfig(S.cheatConfig);
  syncAnagraficaWeightFromLogs({ preserveIfEmpty: true });
  refreshNutritionTargetsFromState({ saveDeferred: false });
  if (!S.cheatMealsByDate || typeof S.cheatMealsByDate !== 'object' || Array.isArray(S.cheatMealsByDate)) {
    S.cheatMealsByDate = {};
  }
  save({ skipCloudSync: true }); // salva subito con le icone aggiornate senza forzare sync al bootstrap
  if (authIsAuthenticated && authIsAuthenticated()) {
    S.authEntryCompleted = true;
  }

  ensureMealPlannerState('on');
  ensureMealPlannerState('off');
  setDay(S.day);
  resetBootstrapUiState();
  if (storageStatus?.loadError && storageStatus.hadSavedState) {
    showDayModal({
      icon: '⚠️',
      title: 'Dati salvati non leggibili',
      body: `Abbiamo trovato uno stato salvato, ma non e stato possibile ripristinarlo in modo sicuro.<br><br><strong>Motivo:</strong> ${htmlEsc(storageStatus.loadError.detail || 'formato non valido')}.<br><br>L'app e partita con i dati di base. Se vuoi, puoi usare <strong>Reset dati</strong> dalla sezione backup oppure importare un JSON valido.`,
      noButtons: true,
    });
    toast('⚠️  Ripristino dati non riuscito');
  } else if (hadSaved) {
    toast('✅  Dati ripristinati');
  }
  if (typeof renderAuthNav === 'function') renderAuthNav();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  if (authConflictChoice === 'local' && authConflictData && typeof authSyncStateToCloud === 'function') {
    await authSyncStateToCloud(true);
    toast('☁️ Dati del dispositivo sincronizzati sul cloud');
  } else if (authConflictChoice === 'remote') {
    toast('☁️ Dati cloud caricati');
  }
  if (postLogoutMode === 'login') {
    try {
      sessionStorage.removeItem('marcifit_post_logout_mode_v1');
    } catch (_) {}
    S.authEntryCompleted = false;
    if (typeof closeWelcomeOnboarding === 'function') closeWelcomeOnboarding();
    openAuthEntry(true);
    openAuthMode('login');
  } else if (!S.onboardingCompleted) {
    if (!S.authEntryCompleted) openAuthEntry(false);
    else openWelcomeOnboarding();
  }
  if (typeof authSetBootstrapReady === 'function') authSetBootstrapReady(true);
}
initAll();
bindEditGramPreview();
syncTodayGreetingAutoRefresh();
document.addEventListener('visibilitychange', syncTodayGreetingAutoRefresh);

// ── Keyboard detection: nasconde la bottom tab bar quando la tastiera è aperta ──
// Usa visualViewport (più affidabile su iOS Safari rispetto a focusin/focusout)
(function() {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const kbOpen = window.visualViewport.height < window.innerHeight - 100;
      document.body.classList.toggle('kb-open', kbOpen);
    });
  } else {
    // Fallback per browser senza visualViewport
    const INPUT_SEL = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select';
    document.addEventListener('focusin', e => {
      if (e.target.matches(INPUT_SEL)) document.body.classList.add('kb-open');
    });
    document.addEventListener('focusout', e => {
      if (e.target.matches(INPUT_SEL)) {
        setTimeout(() => {
          if (!document.activeElement.matches(INPUT_SEL)) {
            document.body.classList.remove('kb-open');
          }
        }, 100);
      }
    });
  }
})();
