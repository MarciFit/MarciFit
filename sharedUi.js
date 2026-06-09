/* MarciFit shared UI helpers. Loaded before view-specific renderers. */

// uiComponents.js — rendering & UI helpers

const EXTRA_MEALS = {
  merenda:  { key: 'merenda',  name: 'Merenda',  icon: '🍎 ', time: '10:00 – 10:30' },
  spuntino: { key: 'spuntino', name: 'Spuntino', icon: '🫐 ', time: '21:30 – 22:00' },
};

function getVisibleExtraMealKeys(dateKey) {
  const activeExtra = S.extraMealsActive?.[dateKey] || {};
  const loggedExtra = Object.keys(S.foodLog?.[dateKey] || {}).filter(key => Number.isNaN(Number(key)));
  return new Set([...Object.keys(activeExtra), ...loggedExtra]);
}

function getPendingSupplementForDate(dateKey) {
  const checked = Array.isArray(S.suppChecked?.[dateKey]) ? S.suppChecked[dateKey] : [];
  const supplements = Array.isArray(S.supplements) ? S.supplements : [];
  return supplements.find(s => s && s.active && !checked.includes(s.id)) || null;
}

function actionCtaIconHTML(icon) {
  return `<span class="action-cta-mark"><span class="action-cta-circle">${icon}</span><span class="action-cta-plus">+</span></span>`;
}

function getMealTimelineCandidates(type, dateKey) {
  const meals = S.meals[type] || [];
  const extraKeys = getVisibleExtraMealKeys(dateKey);
  const candidates = [];
  meals.forEach((meal, i) => {
    candidates.push({ key: i, isExtra: false, name: meal.name, time: meal.time });
    if (i === 0 && extraKeys.has('merenda')) {
      candidates.push({ key: 'merenda', isExtra: true, name: EXTRA_MEALS.merenda.name, time: EXTRA_MEALS.merenda.time });
    }
    if (i === meals.length - 1 && extraKeys.has('spuntino')) {
      candidates.push({ key: 'spuntino', isExtra: true, name: EXTRA_MEALS.spuntino.name, time: EXTRA_MEALS.spuntino.time });
    }
  });
  return candidates;
}

function extraMealAddBtnHTML(key, label) {
  return `<button class="extra-meal-add-row" onclick="toggleExtraMeal('${key}')">
    <span class="extra-meal-line"></span>
    <span class="extra-meal-label">+ ${label}</span>
    <span class="extra-meal-line"></span>
  </button>`;
}

function extraMealCardHTML(key, dateKey) {
  const def = EXTRA_MEALS[key];
  const domKey = `extra-${key}`;
  const logItems = (S.foodLog[dateKey]?.[key] || []);
  const hasLog = logItems.length > 0;
  const clockSVG = `<svg class="mc-clock-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/></svg>`;

  const logMacros = logItems.reduce((acc, it) => {
    const g = it.grams / 100;
    return { kcal: acc.kcal + Math.round(it.kcal100*g), p: acc.p + it.p100*g, c: acc.c + it.c100*g, f: acc.f + it.f100*g };
  }, {kcal:0, p:0, c:0, f:0});

  const logRows = logItems.map((it, ii) => {
    const itK = Math.round(it.kcal100 * it.grams / 100);
    return `<div class="mc-log-row">
      <span class="mc-item-dot"></span>
      <span class="mc-item-name">${htmlEsc(it.name)}</span>
      <button class="mc-item-info" onclick="openLoggedFoodInfo('${dateKey}','${key}',${ii});event.stopPropagation()" title="Valori nutrizionali" aria-label="Apri valori nutrizionali di ${htmlEsc(it.name)}">i</button>
      <span class="mc-item-grams">${it.grams} g</span>
      <span class="mc-item-kcal">${itK} kcal</span>
      <button class="fir-del" onclick="removeLogItem('${dateKey}','${key}',${ii});event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><polyline points="2,3.5 11,3.5"/><path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M10 3.5L9.3 10.5a1 1 0 01-1 .9H4.7a1 1 0 01-1-.9L3 3.5"/><line x1="5.5" y1="6" x2="5.5" y2="9"/><line x1="7.5" y1="6" x2="7.5" y2="9"/></svg></button>
    </div>`;
  }).join('');

  const logSummary = hasLog ? `<div class="mc-log-clear-row">
    <button class="mc-log-clear" onclick="clearLogMeal('${dateKey}','${key}');event.stopPropagation()" title="Azzera tutti gli alimenti del pasto" aria-label="Azzera tutti gli alimenti del pasto">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      <span>Azzera</span>
    </button>
  </div>` : '';

  const addBtn = `<button class="mc-add-btn" onclick="toggleLogSearch('${domKey}');event.stopPropagation()" title="Aggiungi alimento"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;
  return `<div class="mc mc-extra" id="mc-${domKey}">
    <div class="mc-row">
      <div class="mc-body" style="cursor:default">
        <div class="mc-top">
          <span class="mc-icon">${def.icon}</span>
          <span class="mc-name">${def.name}</span>
          <span class="mc-time">${clockSVG}${def.time}</span>
          <button class="mc-extra-deactivate" onclick="toggleExtraMeal('${key}');event.stopPropagation()" title="Rimuovi">✕</button>
        </div>
        <div class="mc-badge-row" style="justify-content:flex-end">${addBtn}</div>
      </div>
    </div>
    <div class="mc-log-panel" id="mlp-${domKey}">
      ${hasLog ? `<div class="mc-log-items">${logRows}</div>${logSummary}` : ''}
    </div>
  </div>`;
}

function getMealTypeFromName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('colazione')) return 'colazione';
  if (n.includes('pranzo'))    return 'pranzo';
  if (n.includes('cena'))      return 'cena';
  if (n.includes('merenda'))   return 'spuntino';
  if (n.includes('spuntino'))  return 'spuntino';
  return null;
}

function getMealTemplateMatches(mealType) {
  const type = String(mealType || '').toLowerCase();
  if (!type) return [];
  return (S.templates || []).filter(t => (
    typeof templateMatchesMealType === 'function'
      ? templateMatchesMealType(t, type)
      : String(t?.mealType || t?.tag || '').toLowerCase().includes(type)
  ));
}

function encInlineArg(value) {
  return encodeURIComponent(String(value ?? ''));
}

function mealTemplateButtonHTML(dateKey, mealIdx, mealType, mealName) {
  const matches = getMealTemplateMatches(mealType);
  if (!matches.length) return '';
  const label = matches.length === 1 ? '1 template disponibile' : `${matches.length} template disponibili`;
  return `<button class="mc-template-open-btn" onclick="openMealTemplatePicker('${encInlineArg(dateKey)}','${encInlineArg(mealIdx)}','${encInlineArg(mealType)}','${encInlineArg(mealName)}');event.stopPropagation()">
    <span class="mc-template-open-copy">
      <span class="mc-template-open-title">Aggiungi template</span>
      <span class="mc-template-open-meta">${label}</span>
    </span>
    <span class="mc-template-open-arrow">›</span>
  </button>`;
}

function getMealDeltaTone(delta, target) {
  const safeTarget = Math.max(1, Number(target) || 0);
  const absDelta = Math.abs(Number(delta) || 0);
  const okWindow = Math.max(80, Math.round(safeTarget * 0.08));
  if (absDelta <= okWindow) return 'is-even';
  if (delta < 0) return 'is-under';
  const criticalOver = Math.max(160, Math.round(safeTarget * 0.15));
  return delta > criticalOver ? 'is-over' : 'is-warn';
}

function mealCardHTML(type, i, mode, isCurrent=false, currentKind='now') {
  const base  = S.meals[type][i];
  const domKey = `${type}-${i}`;   // unique per DOM (avoids ON/OFF collision)
  const altKey = String(i);
  const m     = effMeal(type, i);
  const alts  = S.alts[altKey] || [];
  const ai    = S.altSel[altKey];

  // Log items for this meal (needed both by targetBadge and by todayLogHTML)
  const _logKey = S.selDate || localDate();
  const _logItems = mode === 'today' ? (S.foodLog[_logKey]?.[i] || []) : [];
  const _logMac = _logItems.reduce((acc,it) => {
    const g=it.grams/100;
    return {k:acc.k+Math.round(it.kcal100*g), p:acc.p+it.p100*g, c:acc.c+it.c100*g, f:acc.f+it.f100*g};
  }, {k:0,p:0,c:0,f:0});
  const _hasLog = _logItems.length > 0;
  const _laterMealHasLog = (() => {
    if (mode !== 'today' || !_hasLog) return false;
    const timeline = getMealTimelineCandidates(type, _logKey);
    const currentIdx = timeline.findIndex(entry => !entry.isExtra && entry.key === i);
    if (currentIdx === -1) return false;
    const dayLog = S.foodLog[_logKey] || {};
    return timeline.slice(currentIdx + 1).some(entry => Array.isArray(dayLog[entry.key]) && dayLog[entry.key].length > 0);
  })();
  const loggedNames = _logItems
    .map(it => String(it?.name || '').trim())
    .filter(Boolean);
  const done  = _hasLog;
  const getMealProgressState = () => {
    if (mode !== 'today') return { label: '', cls: '' };
    if (!_hasLog) return { label: 'Vuoto', cls: 'is-empty' };
    const targetK = Math.max(1, Math.round(m.kcal * (((S.macro?.[type]?.k || 0) > 0 && (S.meals[type] || []).reduce((s, meal) => s + (mealMacros(meal).kcal || 0), 0) > 0)
      ? (S.macro[type].k / (S.meals[type] || []).reduce((s, meal) => s + (mealMacros(meal).kcal || 0), 0))
      : 1)));
    const ratio = _logMac.k / targetK;
    if (ratio >= 1.02) return { label: 'Oltre', cls: 'is-over' };
    if (ratio >= 0.9) return { label: 'Completo', cls: 'is-complete' };
    if (_laterMealHasLog) return { label: 'Completo', cls: 'is-complete' };
    if (ratio >= 0.45) return { label: 'In corso', cls: 'is-progress' };
    return { label: 'Avviato', cls: 'is-started' };
  };
  const mealProgress = getMealProgressState();
  const condimentPrompt = mode === 'today' && typeof getMealCondimentPromptState === 'function'
    ? getMealCondimentPromptState(type, i, _logKey)
    : { show: false };
  const condimentPromptHTML = condimentPrompt.show ? `
    <div class="mc-condiment-prompt">
      <div class="mc-condiment-copy">
        <div class="mc-condiment-title">Hai usato condimenti?</div>
        <div class="mc-condiment-text">Questo ${condimentPrompt.mealType || 'pasto'} sembra completo ma non vedo olio o altri condimenti.</div>
      </div>
      <div class="mc-condiment-actions">
        <button class="mc-condiment-btn primary" onclick="addQuickCondiment('${_logKey}',${i},10);event.stopPropagation()">+ Olio EVO 10g</button>
        <button class="mc-condiment-btn" onclick="addQuickCondiment('${_logKey}',${i},5);event.stopPropagation()">+ 5g</button>
        <button class="mc-condiment-btn" onclick="searchCondimentForMeal('${_logKey}',${i});event.stopPropagation()">Cerca altro</button>
        <button class="mc-condiment-btn ghost" onclick="confirmNoCondiment('${_logKey}',${i});event.stopPropagation()">No</button>
      </div>
    </div>` : '';

  // Target badge (shown in today mode next to meal name)
  // Scale plan kcal proportionally to S.macro[type].k (TDEE-derived target)
  let targetBadge = '';
  if (mode === 'today') {
    const tgtK = S.macro?.[type]?.k || 0;
    const totalPlanK = (S.meals[type] || []).reduce((s, meal) => s + (mealMacros(meal).kcal || 0), 0);
    const scale = (tgtK > 0 && totalPlanK > 0) ? tgtK / totalPlanK : 1;
    const dispK = Math.round(m.kcal * scale);
    const dispP = Math.round(m.p * scale);
    const dispC = Math.round(m.c * scale);
    const dispF = Math.round(m.f * scale);
    // Current logged values — integers to keep the macro line on one row
    const curK = _logMac.k;
    const curP = Math.round(_logMac.p);
    const curC = Math.round(_logMac.c);
    const curF = Math.round(_logMac.f);
    const kcalDelta = curK - dispK;
    const kcalDeltaAbs = Math.abs(kcalDelta);
    const kcalDeltaCls = getMealDeltaTone(kcalDelta, dispK);
    const kcalDeltaLabel = kcalDeltaCls === 'is-even'
      ? 'in target'
      : `${kcalDelta > 0 ? '+' : '-'}${kcalDeltaAbs} kcal`;
    // Always show cur / tgt so every meal card has the same format
    const kcalHTML = `<span class="mc-badge-kcal-cur">${curK}</span><span class="mc-badge-kcal-sep">/</span><span class="mc-badge-kcal-tgt">${dispK} kcal</span>`;
    const macHTML  = `P <span class="mc-badge-mac-cur">${curP}</span><span class="mc-badge-mac-sep">/</span>${dispP}g&thinsp;·&thinsp;C <span class="mc-badge-mac-cur">${curC}</span><span class="mc-badge-mac-sep">/</span>${dispC}g&thinsp;·&thinsp;G <span class="mc-badge-mac-cur">${curF}</span><span class="mc-badge-mac-sep">/</span>${dispF}g`;
    targetBadge = `<button class="mc-target-badge" onclick="toggleLogSearch('${domKey}');event.stopPropagation()" title="Aggiungi alimento a ${htmlEsc(base.name)}" aria-label="Aggiungi alimento a ${htmlEsc(base.name)}">
        <div class="mc-badge-top">
          <div class="mc-badge-label">Registrato vs target</div>
          <div class="mc-badge-kicker">+ alimento</div>
        </div>
        <div class="mc-badge-main">
          <div class="mc-badge-kcal-row">
            <div class="mc-badge-kcal">${kcalHTML}</div>
            <div class="mc-badge-delta ${kcalDeltaCls}">${kcalDeltaLabel}</div>
          </div>
          <div class="mc-badge-macros">${macHTML}</div>
        </div>
        <span class="mc-badge-cta">Tocca per aggiungere cibo</span>
      </button>`;
  }
  const mealHint = mode === 'today'
    ? (_hasLog
      ? `Registrati: ${htmlEsc(loggedNames.slice(0, 2).join(' · '))}${loggedNames.length > 2 ? ` · +${loggedNames.length - 2}` : ''}`
      : htmlEsc(m.ingr || 'Apri il pasto e aggiungi il primo alimento'))
    : '';

  const pills = mode !== 'today' ? `
    <span class="pill pk">${m.kcal} kcal</span>
    <span class="pill pp">P ${m.p}g</span>
    <span class="pill pc">C ${m.c}g</span>
    <span class="pill pf">F ${m.f}g</span>` :
    _hasLog ? `
    <span class="pill pk" title="Calorie effettivamente loggati">🥗  ${_logMac.k} kcal</span>
    <span class="pill pp">P ${Math.round(_logMac.p*10)/10}g</span>
    <span class="pill pc">C ${Math.round(_logMac.c*10)/10}g</span>
    <span class="pill pf">F ${Math.round(_logMac.f*10)/10}g</span>` : '';

  // ? ?  Alt chips ? TODAY: shown when card is tapped, shows current alts from S.alts
  const altsChipsHTML = (() => {
    if (!alts.length) return '';
    const chips = alts.map((a, j) =>
      `<span class="alt-chip${ai===j?' sel':''}" onclick="selAlt('${altKey}',${j})">${htmlEsc(a.label)}</span>`
    ).join('');
    return `<div class="mc-alts${ai!==undefined?' open':''}" id="alts-${domKey}">
      <div class="mc-alts-label">Scegli variante</div>
      <div class="mc-alts-row">
        <span class="alt-chip${ai===undefined?' sel':''}" onclick="selAlt('${altKey}',null)">Base</span>
        ${chips}
      </div>
    </div>`;
  })();

  // ? ?  Inline field editor (edit mode) ? ora basato su items[]
  const fieldEditorHTML = mode !== 'edit' ? '' : (() => {
    const items = base.items || [];
    const itemsHTML = items.length === 0
      ? `<div style="font-size:11px;color:var(--muted);padding:8px 0">Nessun ingrediente — aggiungi dalla ricerca</div>`
      : items.map((it, ii) => {
          const itMacros = mealMacros({items:[it]});
          return `<div class="food-item-row" id="fir-${domKey}-${ii}">
            <div class="fir-dot"></div>
            <div class="fir-name">${htmlEsc(it.name)}</div>
            <div class="fir-grams-wrap">
              <input type="number" class="fir-grams" value="${it.grams}" min="0" max="2000" step="1"
                oninput="updateItemGrams('${type}',${i},${ii},this.value)">
              <span class="fir-unit">g</span>
            </div>
            <div class="fir-kcal">${itMacros.kcal} kcal</div>
            <button class="fir-del" onclick="removeItem('${type}',${i},${ii})"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><polyline points="2,3.5 11,3.5"/><path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M10 3.5L9.3 10.5a1 1 0 01-1 .9H4.7a1 1 0 01-1-.9L3 3.5"/><line x1="5.5" y1="6" x2="5.5" y2="9"/><line x1="7.5" y1="6" x2="7.5" y2="9"/></svg></button>
          </div>`;
        }).join('');

    return `<div class="mc-editor items-editor" id="ed-${domKey}">
      <div class="ed-grid" style="margin-bottom:10px">
        <div class="ed-field">
          <label>Nome pasto</label>
          <input value="${esc(base.name)}" oninput="S.meals['${type}'][${i}].name=this.value;rerender()">
        </div>
        <div class="ed-field">
          <label>Orario</label>
          <input value="${esc(base.time)}" oninput="S.meals['${type}'][${i}].time=this.value;rerender()">
        </div>
      </div>
      <div class="items-list-editor" id="il-${domKey}">${itemsHTML}</div>
      <div class="food-search-wrap" id="fsw-${domKey}">
        <div class="food-search-input-row">
          <span class="food-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
          <input type="text" class="food-search-input" id="fsi-${domKey}"
            placeholder="Cerca alimento... (es. yogurt greco Fage)"
            oninput="onFoodSearch(this,'${type}',${i},'${domKey}')"
            autocomplete="off">
        </div>
        <div class="food-search-results" id="fsr-${domKey}"></div>
      </div>
    </div>`;
  })();

  // ? ?  Alts manager embedded in card (edit mode only)
  const altsMgrHTML = mode !== 'edit' ? '' : (() => {
    const altsListHTML = alts.length === 0
      ? `<div class="no-alts">Nessuna variante — aggiungine una qui sotto</div>`
      : alts.map((a, j) => altEntryHTML(altKey, j, a)).join('');

    return `<div class="alts-editor" id="aed-${domKey}">
      <div class="alts-editor-head">
        <span class="alts-editor-title">🔄  Varianti</span>
        <button class="add-alt-btn" onclick="addAlt('${altKey}')">+ Aggiungi</button>
      </div>
      <div id="alts-list-${domKey}">${altsListHTML}</div>
    </div>`;
  })();

  // ? ?  Food log panel (today mode only) ? ? 
  const todayLogHTML = mode !== 'today' ? '' : (() => {
    const dateKey = S.selDate || localDate();
    const logItems = S.foodLog[dateKey]?.[i] || [];
    const hasLog = logItems.length > 0;

    const logRows = logItems.map((it, ii) => {
      const itK = Math.round(it.kcal100 * it.grams / 100);
      return `<div class="mc-log-row">
        <span class="mc-item-dot"></span>
        <span class="mc-item-name">${htmlEsc(it.name)}</span>
        <button class="mc-item-info" onclick="openLoggedFoodInfo('${dateKey}',${i},${ii});event.stopPropagation()" title="Valori nutrizionali" aria-label="Apri valori nutrizionali di ${htmlEsc(it.name)}">i</button>
        <span class="mc-item-grams">${it.grams} g</span>
        <span class="mc-item-kcal">${itK} kcal</span>
        <button class="fir-edit" onclick="editLogItem('${dateKey}',${i},${ii});event.stopPropagation()" title="Modifica grammatura"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="fir-del" onclick="removeLogItem('${dateKey}',${i},${ii});event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><polyline points="2,3.5 11,3.5"/><path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M10 3.5L9.3 10.5a1 1 0 01-1 .9H4.7a1 1 0 01-1-.9L3 3.5"/><line x1="5.5" y1="6" x2="5.5" y2="9"/><line x1="7.5" y1="6" x2="7.5" y2="9"/></svg></button>
      </div>`;
    }).join('');

    const logSummary = hasLog
      ? `<div class="mc-log-clear-row">
          <button class="mc-log-clear" onclick="clearLogMeal('${dateKey}',${i});event.stopPropagation()" title="Azzera tutti gli alimenti del pasto" aria-label="Azzera tutti gli alimenti del pasto">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            <span>Azzera</span>
          </button>
        </div>` : '';
    return `<div class="mc-log-panel${hasLog ? '' : ' mc-log-panel-empty'}" id="mlp-${domKey}">
      ${hasLog ? `<div class="mc-log-items">${logRows}</div>${logSummary}` : ''}
    </div>`;
  })();

  // checkZone removed from today view ? spunta rimossa per semplicit?
  const checkZone = mode !== 'today' ? '' : '';


  const ingrCls = mode === 'today' ? 'mc-ingr clamp' : 'mc-ingr';

  const editBtn = mode !== 'edit' ? '' :
    `<div class="mc-edit-btn" onclick="toggleEditor('${domKey}')" title="Modifica campi">✏️ </div>`;

  const clockSVG = `<svg class="mc-clock-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/></svg>`;

  const currentBadge = isCurrent && mode === 'today'
    ? `<span class="mc-now-badge">${currentKind === 'next' ? 'PROSSIMO' : 'ORA'}</span>`
    : '';
  const currentClass = isCurrent && mode === 'today'
    ? ` mc-current mc-current-${currentKind === 'next' ? 'next' : 'now'}`
    : '';

  return `
    <div class="mc${done && mode==='today' ? ' checked' : ''}${currentClass}" id="mc-${domKey}">
      <div class="mc-row">
        ${checkZone}
        <div class="mc-body" style="cursor:default">
          <div class="mc-top">
            <div class="mc-head-main">
              <span class="mc-icon">${base.icon}</span>
              <div class="mc-head-copy">
                <span class="mc-name-group">
                  <span class="mc-name">${htmlEsc(base.name)}</span>
                  ${mode === 'today' ? `<button class="mc-rename-btn" onclick="renameMeal('${type}',${i});event.stopPropagation()" title="Rinomina pasto"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>` : ''}
                </span>
                ${mode === 'today' ? `<div class="mc-meta-row">
                  <span class="mc-status-chip ${mealProgress.cls}">${mealProgress.label}</span>
                  ${currentBadge}
                  <span class="mc-time">${clockSVG}${base.time}</span>
                  ${ai !== undefined && alts[ai] ? `<span class="mc-alt-badge">${alts[ai].label}</span>` : ''}
                </div>` : ''}
              </div>
            </div>
            ${mode === 'today' ? '' : `<span class="mc-time-wrap">${currentBadge}<span class="mc-time">${clockSVG}${base.time}</span></span>`}
          </div>
          ${mode === 'today' ? `<div class="mc-badge-row">${targetBadge}</div>` : targetBadge}
          ${mode !== 'today' ? `<div class="${ingrCls}">${m.ingr}</div>` : ''}
        </div>
        ${editBtn}
      </div>
      ${mode !== 'today' ? `<div class="mc-pills">${pills}</div>` : ''}
      ${todayLogHTML}
      ${mode === 'edit' ? altsChipsHTML : ''}
      ${condimentPromptHTML}
      ${fieldEditorHTML}
      ${altsMgrHTML}
    </div>`;
}

// ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 
// TODAY VIEW
// ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 
// ? ?  Helpers estratti da renderToday ? ?
