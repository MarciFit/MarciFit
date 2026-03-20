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
  goal: { phase: 'bulk', startDate: null, targetWeight: null, notes: '' },
  // ? ?  Integratori ? ? 
  supplements: [
    { id:'creatina', name:'Creatina Creapure', dose:'3 g', when:'mattina', active:true },
    { id:'vitd',     name:'Vitamina D',        dose:'---', when:'mattina', active:false },
  ],
  suppChecked: {},  // {'2026-03-17': ['creatina']}
  water: {},        // {'2026-03-17': 3}  (bicchieri)
  lastCheckin: null,
  foodCache: {},  // {query: [{name,brand,kcal100,p100,c100,f100,src}]}
  customFoods: [], // alimenti aggiunti manualmente dall'utente
  favoriteFoods: [], // cibi preferiti per i suggerimenti smart alert serali
  foodLog:   {},
  extraMealsActive: {},  // { 'dateKey': { merenda: true, spuntino: true } } — per-day, not persistent
  mealPlanner: {
    on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
    off:{ mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
  },
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
    {l:'Nome',              v:'Federico Marci',       n:''},
    {l:'Età',               v:'23 anni',              n:'Giovane adulto, metabolismo reattivo'},
    {l:'Altezza',           v:'163 cm',               n:'Costituzione compatta'},
    {l:'Peso attuale',      v:'64 kg',                n:'BMI 24,1 · normopeso'},
    {l:'Professione',       v:'Aeronautica Italiana', n:'Lavoro sedentario 8 h/giorno'},
    {l:'Sonno',             v:'6–7 h/notte',          n:'Sottoottimale; alloggio condiviso'},
    {l:'Attività fisica',   v:'3–4 allenim./sett.',   n:'Palestra strength training; ~5.800 passi/gg'},
    {l:'Fastidio digestivo',v:'3/10 (baseline)',      n:'Precedente reflusso'},
    {l:'Creatina Creapure', v:'3 g/die · da oggi',    n:'Continuare senza interruzioni'},
    {l:'Vitamina D',        v:'Carente (2 anni fa)',  n:'Rifare le analisi prima di integrare'},
  ],
  anagrafica: {
    nome:            'Federico Marci',
    sesso:           'm',
    eta:             23,
    altezza:         163,
    peso:            64,
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
      {icon:'🍽️ ',name:'Pranzo a mensa', time:'12:30 – 13:00',               items:[
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
      {icon:'🍽️ ',name:'Pranzo a mensa',   time:'12:30 – 13:00',items:[
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
function showDayModal({icon, title, body, onConfirm, danger = false, noButtons = false}) {
  document.getElementById('day-modal-icon').textContent  = icon;
  const titleEl = document.getElementById('day-modal-title');
  titleEl.textContent = title;
  titleEl.style.color = danger ? 'var(--red)' : '';
  document.getElementById('day-modal-body').innerHTML    = body;
  const confirmBtn = document.getElementById('day-modal-confirm');
  confirmBtn.style.background = danger ? 'var(--red)' : 'var(--ink)';
  const footer  = document.getElementById('day-modal-footer');
  const closeX  = document.getElementById('day-modal-close-x');
  footer.style.display  = noButtons ? 'none' : 'flex';
  closeX.style.display  = noButtons ? 'flex' : 'none';
  _modalConfirmFn = onConfirm;
  const ov = document.getElementById('day-modal-ov');
  ov.style.display = 'flex';
  confirmBtn.onclick = () => {
    const fn = _modalConfirmFn; // capture before closeDayModal nulls it
    closeDayModal();
    if (fn) fn();
  };
}
function closeDayModal() {
  document.getElementById('day-modal-ov').style.display = 'none';
  _modalConfirmFn = null;
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
    suppDone: info.suppDone,
    waterCount: info.waterCount,
    activityCount: info.activityCount,
    hasActivity: info.hasActivity,
    hasTypeOverride,
  };
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

function getDefaultPlannerMealIdx(type) {
  const mealState = getCurrentMealState(type, S.selDate || localDate());
  if (typeof mealState?.key === 'number') return mealState.key;
  return 0;
}

function ensureMealPlannerState(type = S.planTab || 'on') {
  if (!S.mealPlanner) {
    S.mealPlanner = {
      on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
      off:{ mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
    };
  }
  if (!S.mealPlanner[type]) {
    S.mealPlanner[type] = { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] };
  }
  const state = S.mealPlanner[type];
  if (typeof state.mealIdx !== 'number' || !S.meals[type]?.[state.mealIdx]) {
    state.mealIdx = getDefaultPlannerMealIdx(type);
  }
  if (typeof state.prompt !== 'string') state.prompt = '';
  if (typeof state.useFavorites !== 'boolean') state.useFavorites = true;
  if (typeof state.useTemplates !== 'boolean') state.useTemplates = true;
  if (!Array.isArray(state.results)) state.results = [];
  return state;
}

function setMealPlannerMeal(type, mealIdx) {
  const state = ensureMealPlannerState(type);
  state.mealIdx = Math.max(0, Math.min((S.meals[type] || []).length - 1, parseInt(mealIdx, 10) || 0));
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
    if (idx>=0) S.templates[idx] = {id:_editingTmplId, name, tag, mealType, items:[..._tmplFormItems]};
  } else {
    S.templates.push({id:'t'+Date.now(), name, tag, mealType, items:[..._tmplFormItems]});
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
  if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
  if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
  const existing = S.foodLog[dateKey][mealIdx];
  if (existing.length && !confirm(`Aggiungere "${t.name}" al log esistente?`)) return;
  S.foodLog[dateKey][mealIdx].push(...t.items.map(it=>({...it})));
  syncLoggedMealState(dateKey, mealIdx, S.day);
  save();
  refreshMealCard(S.day, mealIdx);
  renderMacroStrip(S.day, S.meals[S.day], S.macro[S.day]);
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
  const d = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
  S.weightLog.push({date:d, val:v});
  // update profilo
  const wi = S.profilo.findIndex(r=>r.l==='Peso attuale');
  if (wi >= 0) { profSave('Peso attuale', S.profilo[wi].v); S.profilo[wi].v = v.toFixed(1)+' kg'; }
  document.getElementById('w-in').value = '';
  save(); renderStats();
  toast('✅  Peso registrato');
}
function delWeight(idx) { S.weightLog.splice(idx,1); save(); renderStats(); }
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
    const d = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
    S.weightLog.push({date:d, val:m.peso});
    const wi = S.profilo.findIndex(r=>r.l==='Peso attuale');
    if (wi>=0) { profSave('Peso attuale', S.profilo[wi].v); S.profilo[wi].v=m.peso.toFixed(1)+' kg'; }
  }
  save();
  toast('✅  Misurazioni registrate');
  renderStats();
}
function setGoalPhase(phase) {
  const PHASE_INFO = {
    bulk:     'Surplus calorico (+250 kcal/ON) per massimizzare la crescita muscolare. I carboidrati aumentano nei giorni di allenamento.',
    cut:      'Deficit calorico (−300 kcal ON / −500 kcal OFF) con proteine elevate (2.3 g/kg) per preservare la massa muscolare in fase di dimagrimento.',
    mantieni: 'Intake vicino al TDEE (−100 kcal OFF) per mantenere composizione corporea e performance in palestra.',
  };
  S.goal.phase = phase;
  save();
  document.querySelectorAll('.goal-phase-btn').forEach(b => {
    const pid = b.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
    b.className = 'goal-phase-btn' + (pid === phase ? ' active-' + phase : '');
  });
  const descEl = document.getElementById('goal-phase-desc');
  if (descEl) descEl.textContent = PHASE_INFO[phase] || '';
  // Recalculate directly from S.anagrafica (no DOM read) so it works regardless of view state
  const _r = computeNutrition(S.anagrafica, S.goal);
  if (_r) {
    S.macro.on = _r.macroOn; S.macro.off = _r.macroOff; saveSoon();
    const fabEl = document.getElementById('fab-preview');
    if (fabEl) {
      const { bmr, pal, tdee, formula, macroOn, macroOff } = _r;
      fabEl.innerHTML = `
        <div class="fab-row fab-row-top"><span class="fab-label">BMR</span><span class="fab-value">${bmr} kcal</span><span class="fab-note">${formula}</span></div>
        <div class="fab-row"><span class="fab-label">PAL</span><span class="fab-value">${pal}</span><span class="fab-note">occupazione + allenamento</span></div>
        <div class="fab-row fab-row-tdee"><span class="fab-label">TDEE</span><span class="fab-value">${tdee} kcal</span></div>
        <div class="fab-divider"></div>
        <div class="fab-day-row"><span class="fab-day-label on-lbl">Giorno ON</span><span class="fab-day-kcal">${macroOn.k} kcal</span><span class="fab-day-macros">P ${macroOn.p}g · C ${macroOn.c}g · F ${macroOn.f}g</span></div>
        <div class="fab-day-row"><span class="fab-day-label off-lbl">Giorno OFF</span><span class="fab-day-kcal">${macroOff.k} kcal</span><span class="fab-day-macros">P ${macroOff.p}g · C ${macroOff.c}g · F ${macroOff.f}g</span></div>`;
    }
  }
}
function toggleSupp(id) {
  const key = S.selDate || localDate();
  if (!S.suppChecked[key]) S.suppChecked[key] = [];
  const arr = S.suppChecked[key];
  const idx = arr.indexOf(id);
  if (idx>=0) arr.splice(idx,1); else arr.push(id);
  syncDoneByDate(key, getTrackedDayType(key));
  save();
  renderSupplements();
  renderSuppToday(); // always update today supp section (cheap, no full re-render)
  refreshTodayDerivedViews();
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
  save(); renderSupplements(); renderSuppToday();
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
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
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
  renderCurrentMealFocus(type, mealState, dateKey);
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${completion.done} / ${completion.total} pasti`;
  if (dpFill)  dpFill.style.width  = `${completion.total ? (completion.done/completion.total)*100 : 0}%`;

  refreshTodayDerivedViews({ greeting: true, calendar: true, stats: true });
  pulseTodayElement(`#mc-${domKey}`);
  pulseTodayElement('#macro-strip .ms-kcal-card', 'ui-glow');
}

function removeLogItem(dateKey, mealIdx, itemIdx) {
  S.foodLog[dateKey]?.[mealIdx]?.splice(itemIdx,1);
  if (!S.foodLog[dateKey]?.[mealIdx]?.length) {
    delete S.foodLog[dateKey]?.[mealIdx];
  }
  syncDoneByDate(dateKey, S.day);
  save(); refreshMealCard(S.day, mealIdx);
}

function editLogItem(dateKey, mealIdx, itemIdx) {
  const item = S.foodLog[dateKey]?.[mealIdx]?.[itemIdx];
  if (!item) return;
  const kcal100 = item.kcal100;
  showDayModal({
    icon: '✏️',
    title: item.name.length > 28 ? item.name.slice(0,28)+'…' : item.name,
    body: `<div class="edit-gram-row">
      <label class="edit-gram-label">Grammatura (g)</label>
      <div class="edit-gram-inputs">
        <input id="edit-gram-inp" type="number" class="edit-gram-inp" value="${item.grams}" min="1" max="5000" step="1" style="font-size:16px">
        <span class="edit-gram-unit">g</span>
      </div>
      <div id="edit-gram-calc" class="edit-gram-calc">= ${Math.round(kcal100 * item.grams / 100)} kcal</div>
    </div>
    <script>
      (function(){
        const inp = document.getElementById('edit-gram-inp');
        const calc = document.getElementById('edit-gram-calc');
        inp.addEventListener('input', () => {
          const g = +inp.value || 0;
          calc.textContent = '= ' + Math.round(${kcal100} * g / 100) + ' kcal';
        });
        inp.select();
      })();
    <\/script>`,
    onConfirm: () => {
      const inp = document.getElementById('edit-gram-inp');
      const g = Math.round(+inp?.value || item.grams);
      if (g > 0 && S.foodLog[dateKey]?.[mealIdx]?.[itemIdx]) {
        S.foodLog[dateKey][mealIdx][itemIdx].grams = g;
        save();
        refreshMealCard(S.day, mealIdx);
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
  renderAnagrafica();
}

function removeFavoriteFood(id) {
  if (!S.favoriteFoods) return;
  S.favoriteFoods = S.favoriteFoods.filter(f => f.id !== id);
  save();
  renderAnagrafica();
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
  goView('profilo');
  setTimeout(() => {
    const foodsCard = document.getElementById('prof-foods-card');
    const scrollTarget = foodsCard?.closest('.stat-section') || foodsCard;
    if (scrollTarget) {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 80);
}

function focusTodayNotes() {
  const notes = document.getElementById('notes-input');
  const wrap = notes?.closest('.notes-section') || notes;
  if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => notes?.focus(), 180);
}

function openFoodSuggestion(remK, remP, remC, remF) {
  const suggestion = suggestFood(+remK, +remP, +remC, +remF);
  let bodyHTML = '';
  if (!suggestion || !suggestion.picks.length) {
    bodyHTML = `<div class="sug-empty-state">
      <div class="sug-empty-icon">☆</div>
      <div class="sug-empty-title">Aggiungi cibi preferiti</div>
      <div class="sug-empty-text">
        Inserisci nel Profilo alcuni alimenti che mangi spesso e useremo quelli per suggerirti come chiudere i gap di calorie e macro.
      </div>
      <button class="sug-empty-cta" onclick="openProfileFavoriteFoods()">Apri Profilo</button>
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
  if (S.foodLog[dateKey]) delete S.foodLog[dateKey][mealIdx];
  syncDoneByDate(dateKey, S.day);
  save(); refreshMealCard(S.day, mealIdx);
}

function openMacroDetail(macroKey) {
  const type    = S.day;
  const meals   = S.meals[type];
  const dateKey = S.selDate || localDate();
  const dayLog  = S.foodLog[dateKey] || {};
  const tgt     = S.macro[type];

  const macroMeta = {
    prot: { lbl: 'Proteine', icon: '🥩', field: 'p100', unit: 'g', tgt: tgt.p },
    carb: { lbl: 'Carboidrati', icon: '🍚', field: 'c100', unit: 'g', tgt: tgt.c },
    fat:  { lbl: 'Grassi', icon: '🧈', field: 'f100', unit: 'g', tgt: tgt.f },
  };
  const meta = macroMeta[macroKey];
  if (!meta) return;

  let totalMacro = 0;
  let rows = '';

  meals.forEach((meal, i) => {
    const items = dayLog[i] || [];
    if (!items.length) return;
    const mealTotal = items.reduce((sum, it) => sum + it[meta.field] * it.grams / 100, 0);
    totalMacro += mealTotal;
    rows += `<div class="md-meal-block">
      <div class="md-meal-name">${htmlEsc(meal.name)}</div>`;
    items.forEach(it => {
      const val = Math.round(it[meta.field] * it.grams / 100 * 10) / 10;
      rows += `<div class="md-food-row">
        <span class="md-food-name">${htmlEsc(it.name)}</span>
        <span class="md-food-val">${val}${meta.unit}</span>
      </div>`;
    });
    rows += `<div class="md-meal-total">${meal.name}: ${Math.round(mealTotal*10)/10}${meta.unit}</div>
    </div>`;
  });

  // Pasti extra
  const _activeExtra = S.extraMealsActive?.[dateKey] || {};
  const extraDefs = { merenda: 'Merenda', spuntino: 'Spuntino' };
  Object.keys(_activeExtra).forEach(xKey => {
    const items = dayLog[xKey] || [];
    if (!items.length) return;
    const mealTotal = items.reduce((sum, it) => sum + it[meta.field] * it.grams / 100, 0);
    totalMacro += mealTotal;
    rows += `<div class="md-meal-block">
      <div class="md-meal-name">${extraDefs[xKey] || xKey}</div>`;
    items.forEach(it => {
      const val = Math.round(it[meta.field] * it.grams / 100 * 10) / 10;
      rows += `<div class="md-food-row">
        <span class="md-food-name">${htmlEsc(it.name)}</span>
        <span class="md-food-val">${val}${meta.unit}</span>
      </div>`;
    });
    rows += `<div class="md-meal-total">Totale: ${Math.round(mealTotal*10)/10}${meta.unit}</div>
    </div>`;
  });

  if (!rows) rows = `<div class="md-empty">Nessun alimento loggato oggi.</div>`;

  const rem = meta.tgt - Math.round(totalMacro * 10) / 10;
  const remTxt = rem > 0 ? `–${Math.round(rem*10)/10}g mancanti` : rem < 0 ? `+${Math.round(Math.abs(rem)*10)/10}g in più` : 'Obiettivo raggiunto ✓';
  const remCls = rem < 0 ? 'err' : rem < meta.tgt * 0.15 ? 'warn' : 'ok';

  showDayModal({
    icon: meta.icon,
    title: meta.lbl,
    body: `<div class="md-summary">
        <span class="md-total">${Math.round(totalMacro*10)/10}${meta.unit}</span>
        <span class="md-rem ${remCls}">/ ${meta.tgt}${meta.unit} · ${remTxt}</span>
      </div>
      <div class="md-body">${rows}</div>`,
    noButtons: true
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

function onFfSearch(inp) {
  const q = inp.value.trim();
  const sr = document.getElementById('ff-search-results');
  if (_ffSearchTimer) clearTimeout(_ffSearchTimer);
  if (q.length < 2) { if (sr) sr.style.display = 'none'; return; }
  _ffSearchTimer = setTimeout(() => {
    searchFoods(q, (results) => {
      _ffSearchResults = results.slice(0, 8);
      if (!sr) return;
      if (!_ffSearchResults.length) {
        sr.innerHTML = '<div class="ff-search-empty">Nessun risultato</div>';
        sr.style.display = 'block';
        return;
      }
      sr.innerHTML = _ffSearchResults.map((r, i) => `
        <div class="ff-sr-item" onclick="selectFfFood(${i})">
          <div class="ff-sr-name">${htmlEsc ? htmlEsc(r.name) : r.name}</div>
          ${r.brand ? `<div class="ff-sr-brand">${r.brand}</div>` : ''}
          <div class="ff-sr-macros">${r.kcal100} kcal · P ${r.p100}g · C ${r.c100}g · G ${r.f100}g</div>
        </div>`).join('');
      sr.style.display = 'block';
    });
  }, 400);
}

function selectFfFood(i) {
  const food = _ffSearchResults[i];
  if (!food) return;
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
function toggleSuppForm() {
  const el = document.getElementById('supp-form');
  if (el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
}
function confirmAddSupp() {
  const name = document.getElementById('sf-name')?.value.trim();
  if (!name) { toast('❌  Inserisci il nome'); return; }
  const dose = document.getElementById('sf-dose')?.value.trim() || '---';
  const when = document.getElementById('sf-when')?.value.trim() || 'mattina';
  S.supplements.push({ id:'supp_'+Date.now(), name, dose, when, active:true });
  save(); renderSupplements(); renderSuppToday(); toggleSuppForm();
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
  // Show on Monday if not already shown this week
  const now = new Date();
  if (now.getDay() !== 1) return; // only Monday
  const todayStr = localDate(now);
  if (S.lastCheckin === todayStr) return;

  const streak = calcStreak();
  const lastW  = S.weightLog.length ? S.weightLog[S.weightLog.length-1].val : null;
  const startW = S.weightLog.length ? S.weightLog[0].val : null;
  const delta  = (lastW&&startW) ? (lastW-startW).toFixed(1) : null;

  const phaseLabel = {bulk:'Bulk',cut:'Cut',mantieni:'Mantenimento'}[S.goal?.phase]||'';
  const weeksSince = S.goal?.startDate ? Math.floor((now-new Date(S.goal.startDate+'T12:00:00'))/(7*86400000))+1 : null;

  document.getElementById('checkin-title').textContent = weeksSince
    ? `Settimana ${weeksSince} di ${phaseLabel} completata!`
    : 'Settimana completata!';

  const lines = [];
  if (streak > 0) lines.push(`Streak attuale: <strong>${streak} giorni</strong> consecutivi`);
  if (delta !== null) lines.push(`Peso: <strong>${+delta>0?'+':''}${delta} kg</strong> dall'inizio`);
  lines.push('Vuoi registrare il peso di questa settimana?');

  document.getElementById('checkin-body').innerHTML = lines.join('<br>');
  document.getElementById('checkin-modal').style.display = 'flex';
}

function closeCheckin() {
  document.getElementById('checkin-modal').style.display = 'none';
  S.lastCheckin = localDate();
  save();
}

function checkinGoMeasure() {
  closeCheckin();
  goView('stats');
  setTimeout(()=>{ document.getElementById('w-in')?.focus(); }, 200);
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
}
function restoreProf(label, value) {
  const i = S.profilo.findIndex(r=>r.l===label);
  if (i<0) return;
  S.profilo[i].v = value; profSave(label, value);
  save(); renderProfilo(); closeDrBtn(); toast(`✅  ${label} ripristinato`);
}
function closeDr(e) { if(e.target===document.getElementById('dov')) closeDrBtn(); }
function closeDrBtn() { document.getElementById('dov').classList.remove('open'); }
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
  S.anagrafica.nome           = v('anag-nome');
  S.anagrafica.eta            = parseInt(v('anag-eta'))        || null;
  S.anagrafica.altezza        = parseInt(v('anag-altezza'))    || null;
  S.anagrafica.peso           = parseFloat(v('anag-peso'))     || null;
  S.anagrafica.grassoCorporeo = parseFloat(v('anag-grasso'))   || null;
  // professione managed via setAnagProf — already in S.anagrafica.professione
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
  _updateFabbisognoPreview();
}

function _updateFabbisognoPreview() {
  _readAnagForm();
  const result = computeNutrition(S.anagrafica, S.goal);
  const el = document.getElementById('fab-preview');
  if (!el) return;
  if (!result) {
    el.innerHTML = `<div class="fab-empty">Completa i campi per vedere il fabbisogno calcolato.</div>`;
    return;
  }
  // Auto-sync S.macro ogni volta che il profilo è completo e valido
  S.macro.on  = result.macroOn;
  S.macro.off = result.macroOff;
  saveSoon();
  const { bmr, pal, tdee, formula, macroOn, macroOff } = result;
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
      <span class="fab-label">PAL <button class="fab-info-btn" onmouseenter="showFabPalTip(this)" onmouseleave="hideTip('tip-fab-pal')" onclick="showFabPalTip(this)">${_isvg}</button></span>
      <span class="fab-value">${pal}</span>
      <span class="fab-note">occupazione + allenamento</span>
    </div>
    <div class="fab-row fab-row-tdee">
      <span class="fab-label">TDEE <button class="fab-info-btn" onmouseenter="showFabTdeeTip(this)" onmouseleave="hideTip('tip-fab-tdee')" onclick="showFabTdeeTip(this)">${_isvg}</button></span>
      <span class="fab-value">${tdee} kcal</span>
    </div>
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
  _readAnagForm();
  const result = computeNutrition(S.anagrafica, S.goal);
  if (result) {
    S.macro.on  = result.macroOn;
    S.macro.off = result.macroOff;
    // Sync peso: aggiorna anche S.profilo per retrocompat
    if (S.anagrafica.peso) {
      const pr = S.profilo.find(r => r.l === 'Peso attuale');
      if (pr) pr.v = S.anagrafica.peso + ' kg';
    }
  }
  save();
  rerender();
  toast('✅ Profilo salvato — macro aggiornati');
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
  S.day = type;
  S.planTab = type;
  document.getElementById('ds-on').className  = 'ds-btn' + (type==='on' ?' on':'');
  document.getElementById('ds-off').className = 'ds-btn' + (type==='off'?' off':'');
  // Update doneByDate so the calendar cell reflects the new day type immediately
  syncDoneByDate();
  save();
  renderToday();
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
  picker.innerHTML = `<div class="cal-picker-box">
    <div class="cal-picker-header">
      <button class="cal-picker-arrow" onclick="S._pickerYear--;renderCalPicker()">&#x2039;</button>
      <span class="cal-picker-year">${yr}</span>
      <button class="cal-picker-arrow" onclick="S._pickerYear++;renderCalPicker()">&#x203A;</button>
    </div>
    <div class="cal-picker-months">
      ${MONTHS_SHORT.map((m,i) => {
        const isCur = i === curMonth && yr === curYear;
        return `<button class="cal-picker-month${isCur?' cur':''}" onclick="pickerGoMonth(${yr},${i})">${m}</button>`;
      }).join('')}
    </div>
    <div class="cal-picker-actions">
      <button class="btn btn-ghost" onclick="closeCalPicker()">Annulla</button>
      <button class="btn" style="background:var(--on);color:#fff" onclick="pickerGoToday()">Oggi</button>
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
    const totK = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[S.planTab][i2]);return s+mm.kcal;},0);
  const totP = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[S.planTab][i2]);return s+mm.p;},0);
  const totC = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[S.planTab][i2]);return s+mm.c;},0);
  const totF = meals.reduce((s,_,i2)=>{const mm=mealMacros(S.meals[S.planTab][i2]);return s+mm.f;},0);
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
function initAll() {
  const hadSaved = loadSaved();
  const storageStatus = typeof getMarciFitStorageStatus === 'function' ? getMarciFitStorageStatus() : null;
  sanitizeMealIcons(S);
  ensureBootstrapDefaults(S);
  migrateTemplateMealTypes(S);
  migrateProfiloToAnagrafica(S);
  migrateFlatMealsToItems(S);
  normalizeLegacyMealIcons(S);
  finalizeBootstrapState(S, hadSaved);
  save(); // salva subito con le icone aggiornate

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
}
initAll();
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
