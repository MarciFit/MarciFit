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
  const extraMealType = getMealTypeFromName(def.name);
  const matchingTmpls = (S.templates || []).filter(t => (
    typeof templateMatchesMealType === 'function'
      ? templateMatchesMealType(t, extraMealType || key)
      : String(t?.mealType || t?.tag || '').toLowerCase().includes(extraMealType || key)
  ));
  const tmplPickerHTML = matchingTmpls.length ? `
    <div class="mc-tmpl-picker">
      <div class="mc-tmpl-title">Template consigliati</div>
      ${matchingTmpls.map(t => {
        const mk = (typeof computeTemplateMacros === 'function'
          ? computeTemplateMacros(t.items || []).k
          : (t.items || []).reduce((s, it) => s + Math.round(it.kcal100 * it.grams / 100), 0));
        const mp = (t.items || []).reduce((s, it) => s + ((it.p100 || 0) * (it.grams || 0) / 100), 0);
        return `<div class="mc-tmpl-row">
          <div class="mc-tmpl-info">
            <div class="mc-tmpl-name">${htmlEsc(t.name)}</div>
            <div class="mc-tmpl-macros">${mk} kcal · P ${mp.toFixed(1)}g</div>
          </div>
          <button class="mc-tmpl-load" onclick="loadTemplateToMeal('${t.id}','${dateKey}','${key}');event.stopPropagation()">Usa</button>
        </div>`;
      }).join('')}
    </div>
    <div class="mc-tmpl-sep">oppure cerca un alimento</div>` : '';

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
      <div class="mc-log-search" id="mls-${domKey}" style="display:none">
        ${tmplPickerHTML}
        <div class="food-search-input-row">
          <span class="food-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
          <input type="text" class="food-search-input" id="mlsi-${domKey}"
            placeholder="Cerca alimento..."
            oninput="onLogFoodSearch(this,'${dateKey}','${key}','${domKey}')"
            autocomplete="off">
        </div>
        <div class="food-search-results" id="mlsr-${domKey}"></div>
      </div>
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
    const kcalDeltaLabel = kcalDelta === 0
      ? 'in target'
      : `${kcalDelta > 0 ? '+' : '-'}${kcalDeltaAbs} kcal`;
    const kcalDeltaCls = kcalDelta > 0 ? 'is-over' : kcalDelta < 0 ? 'is-under' : 'is-even';
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
    // Template picker: filter templates matching this meal type
    const mealType = getMealTypeFromName(base.name);
    const matchingTmpls = (S.templates || []).filter(t => mealType && (
      typeof templateMatchesMealType === 'function'
        ? templateMatchesMealType(t, mealType)
        : String(t?.mealType || t?.tag || '').toLowerCase().includes(mealType)
    ));
    const tmplPickerHTML = matchingTmpls.length ? `
      <div class="mc-tmpl-picker">
        <div class="mc-tmpl-title">Template consigliati</div>
        ${matchingTmpls.map(t => {
          const mk = t.items.reduce((s,it) => s + Math.round(it.kcal100*it.grams/100), 0);
          const mp = t.items.reduce((s,it) => s + it.p100*it.grams/100, 0);
          return `<div class="mc-tmpl-row">
            <div class="mc-tmpl-info">
              <div class="mc-tmpl-name">${htmlEsc(t.name)}</div>
              <div class="mc-tmpl-macros">${mk} kcal · P ${mp.toFixed(1)}g</div>
            </div>
            <button class="mc-tmpl-load" onclick="loadTemplateToMeal('${t.id}','${dateKey}',${i});event.stopPropagation()">Usa</button>
          </div>`;
        }).join('')}
      </div>
      <div class="mc-tmpl-sep">oppure cerca un alimento</div>` : '';

    return `<div class="mc-log-panel${hasLog ? '' : ' mc-log-panel-empty'}" id="mlp-${domKey}">
      ${hasLog ? `<div class="mc-log-items">${logRows}</div>${logSummary}` : ''}
      <div class="mc-log-search" id="mls-${domKey}" style="display:none">
        ${tmplPickerHTML}
        <div class="food-search-input-row">
          <span class="food-search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span>
          <input type="text" class="food-search-input" id="mlsi-${domKey}"
            placeholder="Cerca alimento..."
            oninput="onLogFoodSearch(this,'${dateKey}',${i},'${domKey}')"
            autocomplete="off">
          <button class="bc-btn" onclick="openBarcode('${dateKey}',${i});event.stopPropagation()" title="Scansiona barcode" aria-label="Scansiona barcode">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5v14"></path><path d="M7 5v14"></path><path d="M10 5v14"></path><path d="M14 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path>
            </svg>
          </button>
        </div>
        <div class="food-search-results" id="mlsr-${domKey}"></div>
      </div>
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

function getGreetingSubtext(h, type, streak) {
  // Streak milestones hanno priorità massima
  const milestones = [100, 60, 30, 14, 7];
  for (const m of milestones) {
    if (streak === m) {
      if (m === 100) return '🏆 100 giorni di streak · leggendario!';
      if (m === 60)  return '🌟 60 giorni di streak · straordinario!';
      if (m === 30)  return '🎉 Un mese intero di streak · ottimo!';
      if (m === 14)  return '🎉 Due settimane di fila · continua così!';
      if (m === 7)   return '🎉 Una settimana di streak · inizia bene!';
    }
  }
  if (h < 12) {
    // Mattina
    if (type === 'on') {
      return streak > 5 ? '🔥 Tienila accesa · allenamento oggi' : 'Buona giornata di allenamento 💪';
    } else {
      return 'Riposa bene · il recupero è parte del piano';
    }
  } else if (h < 18) {
    // Pomeriggio
    if (type === 'on') return 'Hai ancora tempo per portare a casa la giornata';
    return streak >= 5 ? 'Streak positiva · continua così' : 'Giorno Rest · ricarica le energie';
  } else {
    // Sera
    if (streak >= 5) return 'Ottima continuità · si vede nel tempo';
    return type === 'on' ? 'Giornata di allenamento quasi conclusa' : 'Buon recupero · a domani';
  }
}

// ─── Spunto scientifico giornaliero ──────────────────────────────────────────
function getDailyScienceTip(dateKey, dayType='on', phase='mantieni') {
  const SCIENCE_TIPS = [
    {
      topic: 'Bulk intelligente',
      phases: ['bulk'],
      contexts: ['on'],
      text: 'In bulk non serve esagerare: un surplus moderato tende a sostenere meglio la crescita limitando il grasso in eccesso.',
      source: '',
    },
    {
      topic: 'Bulk + carboidrati',
      phases: ['bulk'],
      contexts: ['on'],
      text: 'In fase di bulk, tenere i carboidrati adeguati nelle giornate di allenamento aiuta volume, performance e recupero tra sedute ravvicinate.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Recupero in bulk',
      phases: ['bulk'],
      contexts: ['off'],
      text: 'Nel giorno OFF di bulk non conviene tagliare troppo: proteine e calorie coerenti aiutano a trasformare il lavoro accumulato in recupero e adattamento.',
      source: '',
    },
    {
      topic: 'Cut e proteine',
      phases: ['cut'],
      contexts: ['on', 'off'],
      text: 'In cut, tenere le proteine alte e il deficit moderato aiuta a difendere meglio la massa magra e rende la dieta piu sostenibile.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Cut e training',
      phases: ['cut'],
      contexts: ['on'],
      text: 'In fase di cut, concentrare una quota utile di carboidrati vicino all allenamento puo aiutare a salvare qualita della seduta e percezione di energia.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Cut e fame',
      phases: ['cut'],
      contexts: ['off'],
      text: 'Nei giorni OFF di cut, fibra, proteine e cibi sazianti aiutano piu della restrizione estrema: l obiettivo e restare aderente per settimane.',
      source: 'Rebello et al., 2016',
      learnMore: { label: 'Scopri di piu', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4757923/' },
    },
    {
      topic: 'Mantenimento',
      phases: ['mantieni'],
      contexts: ['on', 'off'],
      text: 'Mantenere non significa mangiare a caso: vuol dire tenere performance, recupero e peso abbastanza stabili nel tempo con intake coerente.',
      source: '',
    },
    {
      topic: 'Mantenimento attivo',
      phases: ['mantieni'],
      contexts: ['on'],
      text: 'Anche in mantenimento, proteine adeguate e carboidrati ben distribuiti aiutano a sostenere sedute buone e una composizione corporea piu stabile.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Mantenimento e recupero',
      phases: ['mantieni'],
      contexts: ['off'],
      text: 'Nel giorno OFF di mantenimento non serve inseguire il minimo calorico: meglio restare regolari e dare spazio a recupero, sonno e aderenza.',
      source: '',
    },
    {
      topic: 'Proteine',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Per chi si allena con costanza, circa 1.4–2.0 g/kg/die di proteine coprono gia la maggior parte dei bisogni per mantenimento e crescita muscolare.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Distribuzione',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Una quota di proteine di alta qualita da circa 20-40 g per pasto, distribuita ogni 3-4 ore, e una strategia pratica per stimolare piu volte la sintesi proteica nella giornata.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Timing',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Allenamento di forza e proteine sono sinergici: mangiarle prima o dopo la seduta va bene, ma conta di piu la qualita dell intera giornata rispetto al minuto esatto.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Carboidrati',
      phases: ['bulk', 'mantieni'],
      contexts: ['on'],
      text: 'Nelle giornate con allenamenti intensi o voluminosi, carboidrati adeguati aiutano a sostenere glicogeno, qualita della seduta e recupero tra le serie.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Creatina',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'La creatina monoidrato resta uno dei supplementi con evidenza piu solida: migliora la capacita di lavoro ad alta intensita e puo aumentare gli adattamenti nel tempo.',
      source: 'Kreider et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0173-z' },
    },
    {
      topic: 'Sonno',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Dormire poco non pesa solo sulla testa: puo ridurre la sintesi proteica muscolare e peggiorare il contesto ormonale del giorno dopo.',
      source: 'Lamon et al., 2021',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/33400856/' },
    },
    {
      topic: 'Proteine serali',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Una quota di proteine prima di dormire puo aumentare la sintesi proteica notturna e sostenere meglio il recupero se ti alleni con regolarita.',
      source: 'Snijders et al., 2015',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/25926415/' },
    },
    {
      topic: 'Fibra e fame',
      phases: ['cut', 'mantieni'],
      contexts: ['off'],
      text: 'La fibra, soprattutto quella solubile, tende a rallentare lo svuotamento gastrico e ad aumentare la sazieta: utile quando vuoi controllare meglio fame e aderenza.',
      source: 'Rebello et al., 2016',
      learnMore: { label: 'Scopri di piu', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4757923/' },
    },
    {
      topic: 'Idratazione',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Anche una disidratazione intorno al 2-3% del peso corporeo puo abbassare potenza e qualita della prestazione, soprattutto negli sforzi intensi.',
      source: 'Judelson et al., 2008',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/18550960/' },
    },
    {
      topic: 'Cut intelligente',
      phases: ['cut'],
      contexts: ['on', 'off'],
      text: 'Quando sei in deficit, piu e aggressivo piu diventa difficile tenere alta la performance e preservare massa magra: meglio un taglio moderato e sostenibile.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0174-y' },
    },
    {
      topic: 'Recupero',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['off'],
      text: 'Il giorno OFF non e una pausa dal progresso: e il momento in cui sonno, calorie e proteine trasformano lo stimolo dell allenamento in adattamento.',
      source: '',
    },
    {
      topic: 'Finestra anabolica',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'La finestra post workout non si chiude in pochi minuti: il muscolo resta piu sensibile alle proteine per molte ore dopo la seduta.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Resistenza',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Se fai endurance o sessioni molto lunghe, i carboidrati restano la priorita per la performance; una quota di proteine aiuta piu sul recupero che sul cronometro.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Stimolo + cibo',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'L allenamento fornisce il segnale, ma senza energia e proteine adeguate l ipertrofia resta limitata: stimolo, nutrizione e recupero devono viaggiare insieme.',
      source: '',
    },
  ];

  const d = dateKey || localDate(new Date());
  const targetDate = new Date(`${d}T12:00:00`);
  const base = new Date(`${d.slice(0,4)}-01-01T12:00:00`);
  const dayOfYear = Math.round((targetDate - base) / 86400000);
  const normalizedPhase = ['bulk', 'cut', 'mantieni'].includes(phase) ? phase : 'mantieni';
  const matchesContext = tip => !tip.contexts || tip.contexts.includes(dayType);
  const matchesPhase = tip => !tip.phases || tip.phases.includes(normalizedPhase);

  const phaseSpecificPool = SCIENCE_TIPS.filter(tip =>
    matchesContext(tip) && matchesPhase(tip) && Array.isArray(tip.phases) && tip.phases.length === 1
  );
  const phaseAwarePool = SCIENCE_TIPS.filter(tip =>
    matchesContext(tip) && matchesPhase(tip) && Array.isArray(tip.phases)
  );
  const contextPool = SCIENCE_TIPS.filter(tip => matchesContext(tip) && !Array.isArray(tip.phases));
  const genericPool = SCIENCE_TIPS.filter(tip => matchesContext(tip) && matchesPhase(tip));
  const pool = phaseSpecificPool.length
    ? phaseSpecificPool
    : (phaseAwarePool.length ? phaseAwarePool : (contextPool.length ? contextPool : genericPool));
  const phaseOffset = { bulk: 0, cut: 5, mantieni: 9 }[normalizedPhase] || 0;
  const dayOffset = dayType === 'off' ? 2 : 0;
  return pool[(dayOfYear + phaseOffset + dayOffset) % pool.length];
}

function getGreetingSummaryWaterTarget(type) {
  const info = typeof getWaterTargetInfo === 'function'
    ? getWaterTargetInfo(S.selDate || localDate(), type)
    : null;
  if (info) return info.glasses;
  const peso = S.anagrafica?.peso || 0;
  const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
  const totalMl = baseMl + (type === 'on' ? 350 : 0);
  return Math.max(6, Math.round(totalMl / 250));
}

function getWaterTargetInfo(dateKey = null, type = null) {
  const key = dateKey || S.selDate || localDate();
  const dayType = type || getTrackedDayType(key, getScheduledDayType(key));
  const peso = S.anagrafica?.peso || 0;
  const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = dayType === 'on' ? 350 : 0;
  const autoMl = baseMl + bonusMl;
  const override = Number(S.waterTargetOverrides?.[key]);
  const isManual = Number.isFinite(override) && override >= 1000 && override <= 6000;
  const totalMl = isManual ? Math.round(override) : autoMl;
  return {
    key,
    dayType,
    baseMl,
    bonusMl,
    autoMl,
    totalMl,
    isManual,
    glasses: Math.max(6, Math.round(totalMl / 250)),
  };
}

function formatGreetingSummaryDelta(delta, unit = '', okThreshold = 0) {
  const rounded = unit === 'kcal'
    ? Math.round(delta)
    : Math.round(delta * 10) / 10;
  if (Math.abs(rounded) <= okThreshold) return 'In linea';
  const sign = rounded > 0 ? '+' : '';
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${value}${unit}`;
}

function getGreetingSummaryToneLabel(tone) {
  if (tone === 'ok') return 'In linea';
  if (tone === 'warn') return 'Da rifinire';
  return 'Focus';
}

function getGreetingSummaryMetricTone(metric, values = {}) {
  const { delta = 0, target = 0, eaten = 0, type = 'off', total = 0, done = 0 } = values;
  const safeTarget = Math.max(0, Number(target) || 0);
  const ratio = safeTarget > 0 ? eaten / safeTarget : 1;
  const absRatio = safeTarget > 0 ? Math.abs(delta) / safeTarget : 0;

  switch (metric) {
    case 'kcal':
      if (Math.abs(delta) <= 200 || absRatio <= 0.08) return 'ok';
      if (Math.abs(delta) <= 320 || absRatio <= 0.14) return 'warn';
      return 'err';
    case 'protein':
      if (delta >= -35 || ratio >= 0.95) return 'ok';
      if (delta >= -45 || ratio >= 0.85) return 'warn';
      return 'err';
    case 'carbs':
      if (delta >= -40 || ratio >= 0.95) return 'ok';
      if (type === 'on') return (delta >= -65 || ratio >= 0.82) ? 'warn' : 'err';
      return (delta >= -70 || ratio >= 0.72) ? 'warn' : 'err';
    case 'fat':
      if (Math.abs(delta) <= 15 || (ratio >= 0.85 && ratio <= 1.25)) return 'ok';
      if (Math.abs(delta) <= 25 || (ratio >= 0.7 && ratio <= 1.4)) return 'warn';
      return 'err';
    case 'water':
      if (ratio >= 1) return 'ok';
      if (target - eaten <= 2 || ratio >= 0.75) return 'warn';
      return 'err';
    case 'supplements':
      if (!total) return 'soft';
      if (done >= total) return 'ok';
      if (done / total >= 0.5) return 'warn';
      return 'err';
    default:
      return 'soft';
  }
}

function getGreetingSummaryHeadline(tone, issues) {
  const topIssue = issues[0] || null;
  if (!topIssue) return 'Giornata centrata';
  if (topIssue.key === 'kcal-high') return 'Surplus sopra il previsto';
  if (tone === 'warn') return 'Quasi in target';
  if (topIssue.key === 'hydration') return 'Idratazione indietro';
  if (topIssue.key === 'supplements') return 'Routine da completare';
  return 'Sei sotto target su punti chiave';
}

function getGreetingSummaryCoaching(summary) {
  const topIssue = summary.issues[0] || null;
  if (!topIssue) return '';

  if (topIssue.key === 'protein') {
    if (summary.deltaP <= -25 && summary.waterTone !== 'ok') {
      const waterNeed = Math.max(0, summary.waterTarget - summary.waterCount);
      const closingGlasses = Math.min(waterNeed, 2);
      return `Chiudi con una quota proteica semplice${closingGlasses > 0 ? ` e ${closingGlasses} ${closingGlasses === 1 ? 'bicchiere' : 'bicchieri'} d acqua` : ''} per avvicinarti meglio al target.`;
    }
    return 'Buona base oggi: ti manca soprattutto la quota proteica finale.';
  }
  if (topIssue.key === 'carbs') {
    return summary.type === 'on'
      ? 'Workout day discreto, ma i carboidrati sono rimasti bassi per sostenere meglio recupero e performance.'
      : 'Carbo ancora un po indietro: domani possiamo distribuirli meglio senza forzare la chiusura della sera.';
  }
  if (topIssue.key === 'hydration') {
    const waterNeed = Math.max(0, summary.waterTarget - summary.waterCount);
    const closingGlasses = Math.min(waterNeed, 2);
    return closingGlasses > 0
      ? `Mancano ${closingGlasses} ${closingGlasses === 1 ? 'bicchiere' : 'bicchieri'} per chiudere l acqua.`
      : 'Acqua ancora da chiudere.';
  }
  if (topIssue.key === 'supplements') {
    if (summary.pendingSuppNames.length === 1) {
      return `Routine quasi completa: ti manca ancora ${summary.pendingSuppNames[0]}.`;
    }
    return `Routine quasi completa: restano ${summary.pendingSuppCount} integratori attivi da segnare.`;
  }
  if (topIssue.key === 'kcal-high') {
    return 'Energia sopra il previsto: se succede spesso, controlliamo meglio densita calorica e extras.';
  }
  if (topIssue.key === 'kcal-low') {
    if (summary.proteinTone !== 'ok') {
      return 'Se vuoi chiuderla meglio, punta su una quota proteica semplice con un po di energia facile da completare.';
    }
    return 'Sei ancora sotto target: una chiusura semplice e digeribile puo aiutarti a non restare troppo indietro.';
  }
  if (topIssue.key === 'fat') {
    return summary.deltaF < 0
      ? 'I grassi sono rimasti bassi: basta un piccolo extra di grassi buoni per riequilibrare senza appesantire.'
      : 'Grassi un po sopra il solito: domani possiamo alleggerire condimenti ed extras senza irrigidire la giornata.';
  }
  return '';
}

function getGreetingSummaryHighlight(label, value, tone = 'soft') {
  return { label, value, tone };
}

function getGreetingSummaryPrimaryInsight(summary) {
  const topIssue = summary.issues[0] || null;
  if (!topIssue) {
    return {
      key: 'centered',
      eyebrow: 'Segnale chiave',
      title: 'Hai chiuso una giornata ben centrata.',
      body: summary.cheat?.extraKcal
        ? 'Nonostante il margine extra, il quadro finale resta leggibile e sotto controllo.'
        : 'Target, ritmo e chiusura serale raccontano una giornata pulita e coerente.',
    };
  }
  if (topIssue.key === 'kcal-high') {
    return {
      key: 'kcal-high',
      eyebrow: 'Segnale chiave',
      title: 'Sei finito sopra il previsto.',
      body: summary.cheat?.extraKcal
        ? 'Il margine extra spiega parte dello scarto, ma conviene tenere d occhio extras e densita calorica.'
        : 'Il punto da leggere non e il caos della giornata, ma l energia finale salita oltre il ritmo giusto.',
    };
  }
  if (topIssue.key === 'kcal-low') {
    return {
      key: 'kcal-low',
      eyebrow: 'Segnale chiave',
      title: 'La giornata e rimasta corta.',
      body: summary.proteinTone !== 'ok'
        ? 'Non manca tutto: manca soprattutto una chiusura piu completa tra energia e quota proteica.'
        : 'Il quadro e ordinato, ma l energia finale e rimasta sotto il livello che volevamo davvero.',
    };
  }
  if (topIssue.key === 'protein') {
    return {
      key: 'protein',
      eyebrow: 'Segnale chiave',
      title: 'Ti manca soprattutto la quota proteica.',
      body: 'La giornata non e da rifare: il punto vero da leggere e la proteina finale rimasta indietro.',
    };
  }
  if (topIssue.key === 'carbs') {
    return {
      key: 'carbs',
      eyebrow: 'Segnale chiave',
      title: 'I carboidrati sono rimasti indietro.',
      body: summary.type === 'on'
        ? 'In un workout day questo pesa di piu su recupero e feeling generale della chiusura.'
        : 'Il resto puo essere anche pulito, ma il carburante della giornata e rimasto sotto ritmo.',
    };
  }
  if (topIssue.key === 'hydration') {
    return {
      key: 'hydration',
      eyebrow: 'Segnale chiave',
      title: 'Acqua da chiudere.',
      body: 'La giornata resta buona: manca solo qualche bicchiere.',
    };
  }
  if (topIssue.key === 'supplements') {
    return {
      key: 'supplements',
      eyebrow: 'Segnale chiave',
      title: 'Resta da chiudere la routine.',
      body: 'Il quadro della giornata e quasi completo: il dettaglio mancante e soprattutto organizzativo.',
    };
  }
  if (topIssue.key === 'fat') {
    return {
      key: 'fat',
      eyebrow: 'Segnale chiave',
      title: 'I grassi sono usciti un po dal ritmo.',
      body: summary.deltaF < 0
        ? 'Non serve stravolgere la lettura: basta notare che i grassi sono rimasti troppo bassi.'
        : 'Il resto puo anche essere ordinato, ma i grassi hanno spinto piu del necessario.',
    };
  }
  return {
    key: 'general',
    eyebrow: 'Segnale chiave',
    title: summary.headline || 'Riepilogo giornata',
    body: summary.coaching || 'Il recap serale mette a fuoco il punto davvero importante della giornata.',
  };
}

function getGreetingSummarySecondaryHighlights(summary) {
  const highlights = [];
  const push = item => {
    if (!item || highlights.some(existing => existing.label === item.label)) return;
    highlights.push(item);
  };
  const energyDelta = formatGreetingSummaryDelta(summary.deltaK, ' kcal', 200);
  const proteinDelta = formatGreetingSummaryDelta(summary.deltaP, 'g', 35);
  const carbDelta = formatGreetingSummaryDelta(summary.deltaC, 'g', 40);
  const fatDelta = formatGreetingSummaryDelta(summary.deltaF, 'g', 15);
  const routineValue = summary.activeSuppCount ? `${summary.doneSuppCount}/${summary.activeSuppCount}` : 'Nessuna';

  switch (summary.primaryInsight?.key) {
    case 'centered':
      push(getGreetingSummaryHighlight('Energia', energyDelta, 'ok'));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
    case 'kcal-high':
    case 'kcal-low':
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      if (summary.cheat?.extraKcal) push(getGreetingSummaryHighlight('Extra', `+${Math.round(summary.cheat.extraKcal)} kcal`, 'warn'));
      else push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      break;
    case 'protein':
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      break;
    case 'carbs':
      push(getGreetingSummaryHighlight('Carbo', carbDelta, summary.carbTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      break;
    case 'hydration':
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
    case 'supplements':
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      break;
    case 'fat':
      push(getGreetingSummaryHighlight('Grassi', fatDelta, summary.fatTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      break;
    default:
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
  }

  return highlights.slice(0, 3);
}

function buildGreetingDailySummary(dateKey, type, now = new Date()) {
  const key = dateKey || S.selDate || localDate(now);
  const resolvedType = getTrackedDayType(key, type || getScheduledDayType(key));
  const ctx = buildAlertContext(resolvedType, now.getHours(), key);
  const completion = getDayCompletion(key, resolvedType);
  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(key) : null;
  const effectiveTargetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(key, resolvedType)
    : ctx.tgtK;
  const dayLog = ctx.dayLog || {};
  const mealSlots = alertMealSlots(resolvedType, dayLog);
  const waterTarget = getGreetingSummaryWaterTarget(resolvedType);
  const waterCount = completion.waterCount || 0;
  const supplements = Array.isArray(S.supplements)
    ? S.supplements.filter(s => s && typeof s === 'object')
    : [];
  const checkedSuppValues = Array.isArray(S.suppChecked?.[key]) ? S.suppChecked[key] : [];
  const activeSupps = supplements.filter(s => s.active);
  const checkedSupps = new Set(checkedSuppValues);
  const doneSuppCount = activeSupps.filter(s => checkedSupps.has(s.id)).length;
  const pendingSupps = activeSupps.filter(s => !checkedSupps.has(s.id));
  const targetK = Math.max(0, Number(effectiveTargetK) || 0);
  const targetP = Math.max(0, Number(ctx.tgtP) || 0);
  const targetC = Math.max(0, Number(ctx.tgtC) || 0);
  const targetF = Math.max(0, Number(ctx.tgtF) || 0);
  const deltaK = Math.round(ctx.eK - targetK);
  const deltaP = Math.round((ctx.eP - targetP) * 10) / 10;
  const deltaC = Math.round((ctx.eC - targetC) * 10) / 10;
  const deltaF = Math.round((ctx.eF - targetF) * 10) / 10;
  const todayKey = localDate(now);
  const isToday = key === todayKey;
  const isPast = key < todayKey;
  const isFuture = key > todayKey;
  const dinnerLogged = mealSlots.hasDinnerSlot ? mealSlots.hasDinner : false;
  const afterEveningWindow = isToday && ((now.getHours() * 60) + now.getMinutes() >= ((19 * 60) + 30));
  const hasEnoughData = completion.done > 0 || !!cheat;
  const phaseLabel = { bulk: 'Bulk', cut: 'Cut', mantieni: 'Mantenimento' }[S.goal?.phase || 'mantieni'] || 'Mantenimento';
  const dayTypeLabel = resolvedType === 'on' ? 'Giorno di allenamento' : 'Giorno di recupero';

  const kcalTone = getGreetingSummaryMetricTone('kcal', {
    delta: deltaK,
    eaten: ctx.eK,
    target: targetK,
  });
  const proteinTone = getGreetingSummaryMetricTone('protein', {
    delta: deltaP,
    eaten: ctx.eP,
    target: targetP,
  });
  const carbTone = getGreetingSummaryMetricTone('carbs', {
    delta: deltaC,
    eaten: ctx.eC,
    target: targetC,
    type: resolvedType,
  });
  const fatTone = getGreetingSummaryMetricTone('fat', {
    delta: deltaF,
    eaten: ctx.eF,
    target: targetF,
  });
  const waterTone = getGreetingSummaryMetricTone('water', {
    delta: waterCount - waterTarget,
    eaten: waterCount,
    target: waterTarget,
  });
  const suppTone = getGreetingSummaryMetricTone('supplements', {
    total: activeSupps.length,
    done: doneSuppCount,
  });

  const issues = [];
  if (kcalTone !== 'ok') {
    issues.push({
      key: deltaK > 0 ? 'kcal-high' : 'kcal-low',
      tone: kcalTone,
      score: deltaK > 0 ? (kcalTone === 'err' ? 96 : 72) : (kcalTone === 'err' ? 88 : 60),
    });
  }
  if (proteinTone !== 'ok' && deltaP < 0) {
    issues.push({ key: 'protein', tone: proteinTone, score: proteinTone === 'err' ? 94 : 78 });
  }
  if (carbTone !== 'ok' && deltaC < 0) {
    issues.push({ key: 'carbs', tone: carbTone, score: resolvedType === 'on' ? (carbTone === 'err' ? 90 : 74) : (carbTone === 'err' ? 58 : 42) });
  }
  if (waterTone !== 'ok') {
    issues.push({ key: 'hydration', tone: waterTone, score: waterTone === 'err' ? 82 : 54 });
  }
  if (suppTone !== 'ok' && suppTone !== 'soft') {
    issues.push({ key: 'supplements', tone: suppTone, score: suppTone === 'err' ? 68 : 48 });
  }
  if (fatTone !== 'ok') {
    issues.push({ key: 'fat', tone: fatTone, score: fatTone === 'err' ? 40 : 18 });
  }
  issues.sort((a, b) => b.score - a.score);

  const tone = issues.length
    ? (issues.some(issue => issue.tone === 'err') ? 'err' : 'warn')
    : 'ok';
  const headline = getGreetingSummaryHeadline(tone, issues);
  const coaching = tone === 'ok' ? '' : getGreetingSummaryCoaching({
    issues,
    type: resolvedType,
    deltaP,
    deltaF,
    proteinTone,
    waterTone,
    waterTarget,
    waterCount,
    pendingSuppCount: pendingSupps.length,
    pendingSuppNames: pendingSupps.map(s => s.name),
  });
  const primaryInsight = getGreetingSummaryPrimaryInsight({
    type: resolvedType,
    headline,
    coaching,
    cheat,
    issues,
    deltaF,
    proteinTone,
  });
  const secondaryHighlights = getGreetingSummarySecondaryHighlights({
    type: resolvedType,
    cheat,
    primaryInsight,
    waterCount,
    waterTarget,
    activeSuppCount: activeSupps.length,
    doneSuppCount,
    deltaK,
    deltaP,
    deltaC,
    deltaF,
    targetK,
    kcalTone,
    proteinTone,
    carbTone,
    fatTone,
    waterTone,
    suppTone,
  });
  const closingMessage = tone === 'ok'
    ? (cheat?.extraKcal
        ? 'Hai margine per leggere la giornata senza allarmismi: domani basta tornare al ritmo normale.'
        : 'Una chiusura cosi rende piu semplice anche il giorno dopo.')
    : coaching;

  return {
    key,
    type: resolvedType,
    phaseLabel,
    dayTypeLabel,
    tone,
    toneLabel: getGreetingSummaryToneLabel(tone),
    headline,
    coaching,
    primaryInsight,
    secondaryHighlights,
    closingMessage,
    cheat,
    waterCount,
    waterTarget,
    pendingSuppCount: pendingSupps.length,
    pendingSuppNames: pendingSupps.map(s => s.name),
    doneSuppCount,
    activeSuppCount: activeSupps.length,
    deltaK,
    deltaP,
    deltaC,
    deltaF,
    kcalTone,
    proteinTone,
    carbTone,
    fatTone,
    waterTone,
    suppTone,
    issues,
    dinnerLogged,
    afterEveningWindow,
    isToday,
    isPast,
    isFuture,
    hasEnoughData,
    metrics: [
      { label: 'Kcal', value: formatGreetingSummaryDelta(deltaK, ' kcal', 200), tone: kcalTone },
      { label: 'Proteine', value: formatGreetingSummaryDelta(deltaP, 'g', 35), tone: proteinTone },
      { label: 'Carbo', value: formatGreetingSummaryDelta(deltaC, 'g', 40), tone: carbTone },
      { label: 'Grassi', value: formatGreetingSummaryDelta(deltaF, 'g', 15), tone: fatTone },
      { label: 'Acqua', value: `${waterCount}/${waterTarget}`, tone: waterTone },
      { label: 'Integratori', value: activeSupps.length ? `${doneSuppCount}/${activeSupps.length}` : 'Nessuno', tone: suppTone },
    ],
  };
}

function shouldShowGreetingDailySummary(dateKey, type, now = new Date(), summaryModel = null) {
  const summary = summaryModel || buildGreetingDailySummary(dateKey, type, now);
  if (!summary.hasEnoughData || summary.isFuture) return false;
  if (summary.isPast) return true;
  return summary.dinnerLogged || summary.afterEveningWindow;
}

function renderGreetingDailySummaryCard(summary) {
  const toneClass = summary.tone || 'ok';
  const pills = [
    `<span class="tg-summary-pill is-${toneClass}">${htmlEsc(summary.toneLabel)}</span>`,
  ];
  if (summary.cheat?.extraKcal) {
    pills.push(`<span class="tg-summary-pill is-cheat">Extra +${Math.round(summary.cheat.extraKcal)} kcal</span>`);
  }

  return `<div class="tg-summary tg-summary-compact is-${toneClass}">
    <div class="tg-summary-top">
      <div class="tg-summary-head">
        <div class="tg-summary-kicker">Riepilogo giornata</div>
        <div class="tg-summary-title">${htmlEsc(summary.headline)}</div>
      </div>
      <div class="tg-summary-pill-row">${pills.join('')}</div>
    </div>
    <div class="tg-summary-highlights">
      ${(summary.secondaryHighlights || []).map(item => `<div class="tg-summary-highlight is-${item.tone || 'soft'}">
        <span class="tg-summary-highlight-label">${htmlEsc(item.label)}</span>
        <span class="tg-summary-highlight-value">${htmlEsc(item.value)}</span>
      </div>`).join('')}
    </div>
    ${summary.closingMessage ? `<div class="tg-summary-note">${htmlEsc(summary.closingMessage)}</div>` : ''}
  </div>`;
}

// ─── Alert engine ─────────────────────────────────────────────────────────────
function supplementWindow(when) {
  const slot = String(when || '').toLowerCase();
  if (slot.includes('matt')) return { start: 8, end: 12 };
  if (slot.includes('pranzo') || slot.includes('mezz')) return { start: 12, end: 15 };
  if (slot.includes('pomer')) return { start: 15, end: 18 };
  if (slot.includes('sera') || slot.includes('notte')) return { start: 19, end: 22 };
  return { start: 8, end: 22 };
}
function supplementLabel(when) {
  const slot = String(when || '').toLowerCase();
  if (slot.includes('matt')) return 'stamattina';
  if (slot.includes('pranzo') || slot.includes('mezz')) return 'a pranzo';
  if (slot.includes('pomer')) return 'nel pomeriggio';
  if (slot.includes('sera') || slot.includes('notte')) return 'stasera';
  return 'oggi';
}
function phaseFromHour(h) {
  if (h < 8) return 'early';
  if (h < 12) return 'morning';
  if (h < 17) return 'midday';
  if (h < 20) return 'late';
  return 'end';
}
function parseMealTimeRange(timeText) {
  const text = String(timeText || '').trim();
  if (!text) return null;

  const hmMatches = [...text.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (!hmMatches.length) return null;

  const toMinutes = match => (parseInt(match[1], 10) * 60) + parseInt(match[2], 10);
  const start = toMinutes(hmMatches[0]);
  const end = hmMatches[1] ? toMinutes(hmMatches[1]) : start;

  return { start, end };
}
function mealStatus(h, dueHour, overdueHour) {
  if (h < dueHour) return 'upcoming';
  if (h < overdueHour) return 'due';
  return 'overdue';
}
function alertMealSlots(type, dayLog) {
  const meals = S.meals[type] || [];
  const slots = { breakfast: -1, lunch: -1, dinner: -1 };
  meals.forEach((meal, i) => {
    const name = String(meal?.name || '').toLowerCase();
    if (slots.breakfast === -1 && (name.includes('colazione') || name.includes('breakfast'))) slots.breakfast = i;
    if (slots.lunch === -1 && (name.includes('pranzo') || name.includes('mensa'))) slots.lunch = i;
    if (slots.dinner === -1 && name.includes('cena')) slots.dinner = i;
  });
  const hasLogForIndex = idx => idx >= 0 && Array.isArray(dayLog[idx]) && dayLog[idx].length > 0;
  return {
    loggedMealsCount: Object.values(dayLog).filter(items => Array.isArray(items) && items.length > 0).length,
    breakfastIndex: slots.breakfast,
    lunchIndex: slots.lunch,
    dinnerIndex: slots.dinner,
    hasBreakfastSlot: slots.breakfast >= 0,
    hasLunchSlot: slots.lunch >= 0,
    hasDinnerSlot: slots.dinner >= 0,
    hasBreakfast: hasLogForIndex(slots.breakfast),
    hasLunch: hasLogForIndex(slots.lunch),
    hasDinner: hasLogForIndex(slots.dinner),
  };
}
function buildAlertContext(type, h, dateKey) {
  const tgt = S.macro[type] || {};
  const tgtK = tgt.k || 0, tgtP = tgt.p || 0, tgtC = tgt.c || 0, tgtF = tgt.f || 0;
  const dayLog = S.foodLog[dateKey] || {};
  let eK = 0, eP = 0, eC = 0, eF = 0;
  Object.values(dayLog).forEach(items => {
    if (!Array.isArray(items)) return;
    items.forEach(it => {
      const g = it.grams / 100;
      eK += Math.round(it.kcal100 * g);
      eP += it.p100 * g;
      eC += it.c100 * g;
      eF += it.f100 * g;
    });
  });
  eP = Math.round(eP * 10) / 10;
  eC = Math.round(eC * 10) / 10;
  eF = Math.round(eF * 10) / 10;

  const remK = Math.round(tgtK - eK);
  const remP = Math.round((tgtP - eP) * 10) / 10;
  const remC = Math.round((tgtC - eC) * 10) / 10;
  const remF = Math.round((tgtF - eF) * 10) / 10;
  const pct = tgtK > 0 ? Math.round(eK / tgtK * 100) : 0;
  const todayStr = localDate(new Date());
  const isToday = !dateKey || dateKey === todayStr;
  const isPast = !!dateKey && dateKey < todayStr;
  const meals = alertMealSlots(type, dayLog);
  const suppChecked = (S.suppChecked && S.suppChecked[dateKey]) || [];
  const pendingSupps = (S.supplements || [])
    .filter(s => s.active)
    .filter(s => !suppChecked.includes(s.id));
  const suppDueNow = pendingSupps.filter(s => {
    const window = supplementWindow(s.when);
    return isToday && h >= window.start && h < window.end;
  });
  const suppOverdue = pendingSupps.filter(s => {
    const window = supplementWindow(s.when);
    return isToday && h >= window.end && h < 24;
  });
  const timePhase = isPast ? 'past' : phaseFromHour(h);
  const breakfastStatus = meals.hasBreakfastSlot ? mealStatus(h, 8, 11) : null;
  const lunchStatus = meals.hasLunchSlot ? mealStatus(h, 12, 15) : null;
  const dinnerStatus = meals.hasDinnerSlot ? mealStatus(h, 19, 21) : null;

  return {
    type, h, dateKey, dayLog, isToday, isPast,
    tgtK, tgtP, tgtC, tgtF,
    eK, eP, eC, eF,
    remK, remP, remC, remF, pct,
    loggedMealsCount: meals.loggedMealsCount,
    breakfastIndex: meals.breakfastIndex,
    lunchIndex: meals.lunchIndex,
    dinnerIndex: meals.dinnerIndex,
    hasBreakfastSlot: meals.hasBreakfastSlot,
    hasLunchSlot: meals.hasLunchSlot,
    hasDinnerSlot: meals.hasDinnerSlot,
    breakfastStatus,
    lunchStatus,
    dinnerStatus,
    timePhase,
    hasBreakfast: meals.hasBreakfast,
    hasLunch: meals.hasLunch,
    hasDinner: meals.hasDinner,
    suppDueNow,
    suppOverdue,
    hasFavoriteFoods: (S.favoriteFoods || []).length > 0,
  };
}
function finalizeAlerts(alerts, maxAlerts = 2) {
  const sorted = alerts.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const seenGroups = new Set();
  const out = [];
  for (const alert of sorted) {
    const group = alert.dedupeGroup || alert.id || `${alert.type}-${alert.text}`;
    if (seenGroups.has(group)) continue;
    if (alert.type === 'ok' && sorted.some(a => a !== alert && (a.type === 'warn' || a.type === 'err'))) continue;
    seenGroups.add(group);
    out.push(alert);
    if (out.length >= maxAlerts) break;
  }
  return out;
}
function buildCombinedDeficitAlert(ctx) {
  const deficits = [];
  if (ctx.remK > 200) deficits.push({ key: 'k', label: `${ctx.remK} kcal`, severity: ctx.remK > 350 ? 2 : 1 });
  if (ctx.remP > 25) deficits.push({ key: 'p', label: `${ctx.remP}g proteine`, severity: ctx.remP > 40 ? 2 : 1 });
  if (ctx.type === 'on' ? ctx.remC > 70 : ctx.remC > 55) {
    deficits.push({ key: 'c', label: `${ctx.remC}g carbo`, severity: ctx.remC > 100 ? 2 : 1 });
  }
  if (ctx.remF > 12) deficits.push({ key: 'f', label: `${ctx.remF}g grassi`, severity: ctx.remF > 20 ? 2 : 1 });
  if (deficits.length < 2) return null;

  const topDeficits = deficits.slice(0, 3);
  const type = topDeficits.some(d => d.severity >= 2) ? 'err' : 'warn';
  const intro = 'Sei sotto target su piu fronti';
  return {
    id: 'combined-deficit',
    type,
    icon: '📉',
    priority: 72,
    dedupeGroup: 'macro-recovery',
    text: `${intro}: ${topDeficits.map(d => d.label).join(' · ')}`,
    hasSuggest: true,
    remK: Math.max(0, ctx.remK),
    remP: Math.max(0, ctx.remP),
    remC: Math.max(0, ctx.remC),
    remF: Math.max(0, ctx.remF),
  };
}
function generateAlerts(type, h, dateKey, maxAlerts = 2) {
  const ctx = buildAlertContext(type, h, dateKey);
  if (!ctx.tgtK) return [];

  const alerts = [];

  const suppAlert = ctx.suppOverdue[0] || ctx.suppDueNow[0];
  if (suppAlert) {
    const doseStr = suppAlert.dose && suppAlert.dose !== '---' ? ` · ${suppAlert.dose}` : '';
    const isOverdue = ctx.suppOverdue.some(s => s.id === suppAlert.id);
    alerts.push({
      id: `supp-${suppAlert.id}`,
      type: 'supp',
      icon: '💊',
      priority: isOverdue ? 100 : 95,
      dedupeGroup: 'supp',
      text: isOverdue
        ? `${suppAlert.name}${doseStr} non ancora presa ${supplementLabel(suppAlert.when)}`
        : `${suppAlert.name}${doseStr} da prendere ${supplementLabel(suppAlert.when)}`,
      ctaLabel: 'Segna come presa',
      ctaAction: `toggleSuppAndReveal('${suppAlert.id}')`,
    });
  }

  if (ctx.isToday && ctx.timePhase === 'midday' && ctx.loggedMealsCount === 0) {
    alerts.push({
      id: 'no-meals',
      type: 'warn',
      icon: '🕒',
      priority: 90,
      dedupeGroup: 'meal-intake',
      text: 'Non hai ancora loggato pasti oggi',
      ctaLabel: 'Apri il primo pasto',
      ctaAction: `document.getElementById('mc-${type}-0')?.scrollIntoView({behavior:'smooth',block:'center'})`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'late' && ctx.loggedMealsCount === 0) {
    alerts.push({
      id: 'too-few-meals-evening',
      type: 'err',
      icon: '🍽️',
      priority: 88,
      dedupeGroup: 'meal-intake',
      text: 'Oggi non hai ancora registrato pasti',
      ctaLabel: 'Vai ai pasti',
      ctaAction: `document.getElementById('meals-today')?.scrollIntoView({behavior:'smooth',block:'start'})`,
    });
  } else if (ctx.isToday && ctx.hasLunchSlot && ctx.lunchStatus === 'overdue' && !ctx.hasLunch && ctx.loggedMealsCount > 0 && ctx.timePhase !== 'late' && ctx.timePhase !== 'end') {
    alerts.push({
      id: 'missing-lunch',
      type: 'warn',
      icon: '🍽️',
      priority: 82,
      dedupeGroup: 'meal-intake',
      text: 'Pranzo non ancora registrato',
      ctaLabel: 'Vai al pranzo',
      ctaAction: `document.getElementById('mc-${type}-${ctx.lunchIndex}')?.scrollIntoView({behavior:'smooth',block:'center'})`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'midday' && ctx.loggedMealsCount > 0 && ctx.pct < 25) {
    alerts.push({
      id: 'low-intake-midday',
      type: 'warn',
      icon: '⚠️',
      priority: 75,
      dedupeGroup: 'meal-intake',
      text: `Apporto ancora basso per quest'ora: ${ctx.eK} kcal finora`,
      ctaLabel: 'Vai al prossimo pasto',
      ctaAction: `document.getElementById('meals-today')?.scrollIntoView({behavior:'smooth',block:'start'})`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'late' && ctx.loggedMealsCount <= 1 && ctx.pct < 45) {
    alerts.push({
      id: 'low-intake-late',
      type: 'warn',
      icon: '⚠️',
      priority: 78,
      dedupeGroup: 'meal-intake',
      text: `Giornata ancora indietro: ${ctx.eK} kcal e ${ctx.loggedMealsCount} past${ctx.loggedMealsCount === 1 ? 'o' : 'i'} loggati`,
      ctaLabel: 'Completa il prossimo pasto',
      ctaAction: `document.getElementById('meals-today')?.scrollIntoView({behavior:'smooth',block:'start'})`,
    });
  }

  if (ctx.isPast || ctx.timePhase === 'end') {
    if (ctx.loggedMealsCount <= 1 && ctx.remK > 250) {
      alerts.push({
        id: 'too-few-meals-evening',
        type: ctx.loggedMealsCount === 0 ? 'err' : 'warn',
        icon: '🍽️',
        priority: 85,
        dedupeGroup: 'evening-intake',
        text: ctx.loggedMealsCount === 0
          ? 'Fine giornata senza pasti loggati'
          : `Hai loggato solo ${ctx.loggedMealsCount} pasto oggi`,
      });
    }

    const combinedDeficitAlert = buildCombinedDeficitAlert(ctx);
    if (combinedDeficitAlert) {
      alerts.push(combinedDeficitAlert);
    } else if (ctx.remP > 25) {
      alerts.push({
        id: 'low-protein',
        type: ctx.remP > 40 ? 'err' : 'warn',
        icon: '🥩',
        priority: 70,
        dedupeGroup: 'macro-recovery',
        text: `Proteine basse: mancano ${ctx.remP}g`,
        hasSuggest: true,
        remK: Math.max(0, ctx.remK),
        remP: ctx.remP,
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    }
    if (ctx.type === 'on' && ctx.remC > 70 && ctx.remP <= 25) {
      alerts.push({
        id: 'low-carbs-on',
        type: 'warn',
        icon: '🍚',
        priority: 65,
        dedupeGroup: 'macro-recovery',
        text: `Carboidrati bassi per un giorno ON: mancano ${ctx.remC}g`,
        hasSuggest: true,
        remK: Math.max(0, ctx.remK),
        remP: Math.max(0, ctx.remP),
        remC: ctx.remC,
        remF: Math.max(0, ctx.remF),
      });
    }
    if (!combinedDeficitAlert && ctx.remK > 350) {
      alerts.push({
        id: 'low-kcal-err',
        type: 'err',
        icon: '🔥',
        priority: 55,
        dedupeGroup: 'energy-recovery',
        text: `Sei sotto target di ${ctx.remK} kcal`,
        hasSuggest: true,
        remK: ctx.remK,
        remP: Math.max(0, ctx.remP),
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    } else if (!combinedDeficitAlert && ctx.remK > 200) {
      alerts.push({
        id: 'low-kcal-warn',
        type: 'warn',
        icon: '🔥',
        priority: 50,
        dedupeGroup: 'energy-recovery',
        text: `Sei ancora sotto target di ${ctx.remK} kcal`,
        hasSuggest: true,
        remK: ctx.remK,
        remP: Math.max(0, ctx.remP),
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    }

    if (ctx.remK < -450) {
      alerts.push({
        id: 'surplus-err',
        type: 'err',
        icon: '⚠️',
        priority: 52,
        dedupeGroup: 'surplus',
        text: `Sei sopra target di ${Math.abs(ctx.remK)} kcal`,
      });
    } else if (ctx.remK < -250) {
      alerts.push({
        id: 'surplus-warn',
        type: 'warn',
        icon: '⚠️',
        priority: 48,
        dedupeGroup: 'surplus',
        text: `Leggero surplus: +${Math.abs(ctx.remK)} kcal`,
      });
    }

    if (ctx.pct >= 93 && Math.abs(ctx.remP) <= 15 && Math.abs(ctx.remK) <= 150) {
      alerts.push({
        id: 'day-centered',
        type: 'ok',
        icon: '✅',
        priority: 10,
        dedupeGroup: 'success',
        text: 'Giornata centrata: target quasi perfetto',
      });
    }
  }

  return finalizeAlerts(alerts, maxAlerts);
}

function summarizeAlertNames(items, max = 2) {
  const names = [];
  const seen = new Set();
  items.forEach(item => {
    const name = String(item?.name || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  });
  if (!names.length) return '';
  if (names.length <= max) return names.join(' · ');
  return `${names.slice(0, max).join(' · ')} · +${names.length - max}`;
}

function buildSupportAlertGroups(type, dateKey) {
  const hour = new Date().getHours();
  const ctx = buildAlertContext(type, hour, dateKey);
  const rawAlerts = generateAlerts(type, hour, dateKey, Infinity);
  const groups = [];

  const supplementMap = new Map();
  [...ctx.suppOverdue, ...ctx.suppDueNow].forEach(supp => {
    if (!supplementMap.has(supp.id)) supplementMap.set(supp.id, supp);
  });
  const supplementItems = Array.from(supplementMap.values());
  if (supplementItems.length) {
    const firstSupp = supplementItems[0];
    const suppText = supplementItems.length === 1
      ? `${firstSupp.name}${firstSupp.dose && firstSupp.dose !== '---' ? ` · ${firstSupp.dose}` : ''} da segnare`
      : `${supplementItems.length} integratori da segnare: ${summarizeAlertNames(supplementItems, 2)}`;
    groups.push({
      id: 'support-supp',
      type: 'supp',
      icon: '💊',
      priority: ctx.suppOverdue.length ? 100 : 95,
      text: suppText,
      ctaLabel: 'Segna ora',
      ctaAction: `revealTodaySupplement('${firstSupp.id}')`,
    });
  }

  const trackingIds = new Set(['no-meals', 'missing-lunch', 'low-intake-midday', 'low-intake-late', 'too-few-meals-evening']);
  const trackingAlerts = rawAlerts.filter(alert => trackingIds.has(alert.id));
  if (trackingAlerts.length) {
    const trackingType = trackingAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn';
    let trackingText = 'Sei indietro con i pasti di oggi';
    if (trackingAlerts.some(alert => alert.id === 'no-meals')) {
      trackingText = 'Non hai ancora registrato pasti oggi';
    } else if (trackingAlerts.some(alert => alert.id === 'missing-lunch')) {
      trackingText = 'Ti manca ancora il pranzo';
    } else if (trackingAlerts.some(alert => alert.id === 'too-few-meals-evening')) {
      trackingText = ctx.loggedMealsCount === 0
        ? 'Oggi non hai ancora registrato pasti'
        : `Hai registrato solo ${ctx.loggedMealsCount} ${ctx.loggedMealsCount === 1 ? 'pasto' : 'pasti'}`;
    } else if (trackingAlerts.some(alert => alert.id === 'low-intake-late')) {
      trackingText = `Per quest'ora hai registrato poco: ${ctx.eK} kcal`;
    } else if (trackingAlerts.some(alert => alert.id === 'low-intake-midday')) {
      trackingText = `Per ora hai registrato solo ${ctx.eK} kcal`;
    }
    groups.push({
      id: 'support-tracking',
      type: trackingType,
      icon: trackingAlerts[0]?.icon || '🍽️',
      priority: Math.max(...trackingAlerts.map(alert => alert.priority || 0), 80),
      text: trackingText,
      ctaLabel: 'Vai ai pasti',
      ctaAction: `document.getElementById('meals-today')?.scrollIntoView({behavior:'smooth',block:'start'})`,
    });
  }

  const macroIds = new Set(['combined-deficit', 'low-protein', 'low-carbs-on', 'low-kcal-err', 'low-kcal-warn']);
  const macroAlerts = rawAlerts.filter(alert => macroIds.has(alert.id));
  if (macroAlerts.length) {
    const macroParts = [];
    if (ctx.remK > 200) macroParts.push(`-${ctx.remK} kcal`);
    if (ctx.remP > 20) macroParts.push(`-${ctx.remP}g proteine`);
    if ((ctx.type === 'on' && ctx.remC > 45) || (ctx.type !== 'on' && ctx.remC > 55)) macroParts.push(`-${ctx.remC}g carbo`);
    if (ctx.remF > 12) macroParts.push(`-${ctx.remF}g grassi`);
    groups.push({
      id: 'combined-deficit',
      type: macroAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn',
      icon: '📉',
      priority: Math.max(...macroAlerts.map(alert => alert.priority || 0), 72),
      text: macroParts.length ? `Ti mancano ancora ${macroParts.slice(0, 3).join(' · ')}` : 'Sei ancora sotto target su piu macro',
      hasSuggest: true,
      remK: Math.max(0, ctx.remK),
      remP: Math.max(0, ctx.remP),
      remC: Math.max(0, ctx.remC),
      remF: Math.max(0, ctx.remF),
    });
  }

  const surplusAlerts = rawAlerts.filter(alert => alert.id === 'surplus-err' || alert.id === 'surplus-warn');
  if (surplusAlerts.length) {
    groups.push({
      id: surplusAlerts[0].id,
      type: surplusAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn',
      icon: '⚠️',
      priority: Math.max(...surplusAlerts.map(alert => alert.priority || 0), 48),
      text: `Sei sopra il target di ${Math.abs(ctx.remK)} kcal`,
    });
  }

  if (!groups.length) {
    const okAlert = rawAlerts.find(alert => alert.id === 'day-centered');
    if (okAlert) groups.push(okAlert);
  }

  return groups.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function splitTodayAlerts(type, dateKey) {
  const hour = new Date().getHours();
  const alerts = generateAlerts(type, hour, dateKey, Infinity);
  const orderedAlerts = buildSupportAlertGroups(type, dateKey);
  const resolveAction = alert => {
    if (!alert) return '';
    if (String(alert.id || '').startsWith('supp-')) {
      const suppId = alert.id.replace(/^supp-/, '');
      return `revealTodaySupplement('${suppId}')`;
    }
    if (alert.ctaAction) return alert.ctaAction;
    if (alert.hasSuggest) {
      return `openFoodSuggestion(${alert.remK||0},${alert.remP||0},${alert.remC||0},${alert.remF||0})`;
    }
    return '';
  };
  const supportAlerts = orderedAlerts.filter(a => a.type === 'supp' || String(a.id || '').startsWith('supp-'));
  const focusIds = new Set(['no-meals', 'missing-lunch', 'low-intake-midday', 'low-intake-late', 'too-few-meals-evening']);
  const focusAlerts = alerts.filter(a => focusIds.has(a.id));
  const statusAlerts = alerts.filter(a => a.type === 'ok');
  const signals = [...orderedAlerts, ...statusAlerts].slice(0, 2).map(alert => ({
    tone: alert.type === 'err' || alert.type === 'supp' ? 'err' : alert.type === 'warn' ? 'warn' : 'ok',
    text: alert.type === 'supp'
      ? 'Integratore da segnare'
      : alert.id === 'day-centered'
        ? 'Giornata in linea'
        : alert.text,
    action: resolveAction(alert),
  }));

  return {
    orderedAlerts,
    signals,
    focusAlert: focusAlerts[0] || null,
    supportAlert: supportAlerts[0] || null,
  };
}

// ─── Suggerimento cibo intelligente ──────────────────────────────────────────
function suggestFood(remK, remP, remC, remF) {
  const foods = S.favoriteFoods || [];
  if (!foods.length) return null;

  const protPriority = remP > 20;
  const carbPriority = remC > 50 && !protPriority;

  const scored = foods.map(f => {
    const typK = Math.round(f.kcal100 * f.typicalGrams / 100);
    let score = 0;
    if (protPriority)      score = (f.p100 / Math.max(f.kcal100, 1)) * 100;
    else if (carbPriority) score = (f.c100 / Math.max(f.kcal100, 1)) * 100;
    else                   score = 100 - Math.abs(typK - remK / 2) / Math.max(remK, 1) * 100;
    return { ...f, score, typK };
  }).sort((a, b) => b.score - a.score);

  const picks = [];
  let cumK = 0;
  for (const f of scored) {
    if (picks.length >= 2) break;
    let grams = f.typicalGrams;
    // Scala la porzione se serve per non sforare troppo
    if (f.typK > 0 && remK > 0 && cumK + f.typK > remK * 1.2) {
      grams = Math.max(20, Math.round((remK - cumK) * 100 / f.kcal100 / 10) * 10);
    }
    const k = Math.round(f.kcal100 * grams / 100);
    const p = Math.round(f.p100 * grams / 100 * 10) / 10;
    const c = Math.round(f.c100 * grams / 100 * 10) / 10;
    if (k <= 0) continue;
    picks.push({ ...f, grams, k, p, c });
    cumK += k;
    if (cumK >= remK * 0.8 && remK > 0) break;
  }

  if (!picks.length) return null;
  const totalK = picks.reduce((s, p) => s + p.k, 0);
  const totalP = Math.round(picks.reduce((s, p) => s + p.p, 0) * 10) / 10;
  const totalC = Math.round(picks.reduce((s, p) => s + p.c, 0) * 10) / 10;
  return { picks, totalK, totalP, totalC };
}

function streakBadgeStyle(streak) {
  if (streak >= 100) return { emoji: '🏆', tier: 'legend' };
  if (streak >= 30)  return { emoji: '🌟', tier: 'elite' };
  if (streak >= 7)   return { emoji: '🔥', tier: 'hot' };
  if (streak > 0)    return { emoji: '🔥', tier: 'warm' };
  return { emoji: '🔥', tier: 'idle' };
}

function renderGreetingAlerts(type, dateKey) {
  const model = splitTodayAlerts(type, dateKey);
  const alerts = model.orderedAlerts || [];
  if (!alerts.length) return '';
  return `<div class="tg-alerts-list">
    ${alerts.map((alert, idx) => renderTodayAlertHTML(alert, {
      compact: true,
      idx,
      supportMode: true,
      eyebrow: idx === 0 ? 'Da gestire ora' : 'Da controllare',
      className: 'today-context-alert-hero'
    })).join('')}
  </div>`;
}

function renderGreeting(type, now) {
  const DAYS   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const dateKey = S.selDate || localDate(now);
  const resolvedType = getTrackedDayType(dateKey, type || getScheduledDayType(dateKey));
  const viewDate = new Date(`${dateKey}T12:00:00`);
  const isTodayView = dateKey === localDate(now);
  const h = now.getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const profiloRows = Array.isArray(S.profilo) ? S.profilo : [];
  const nomeCompleto = S.anagrafica?.nome || profiloRows.find(r=>r.l==='Nome')?.v || 'Atleta';
  const nome = nomeCompleto.split(' ')[0];

  // Aggiorna nav-sub con il nome
  const navSub = document.getElementById('nav-sub');
  if (navSub) navSub.textContent = nomeCompleto;

  // Aggiorna i tooltip BMI/BMR/TDEE (tooltip DOM rimane, non mostrato nel greeting)
  const peso = S.anagrafica?.peso || 0;
  const alt  = S.anagrafica?.altezza || 0;
  const eta  = S.anagrafica?.eta || 0;
  if (peso > 0 && alt > 0) {
    const bmi  = (peso / (alt/100)**2).toFixed(1);
    const bmiN = parseFloat(bmi);
    const bmiLbl = bmiN < 18.5 ? 'sottopeso' : bmiN < 25 ? 'normopeso' : bmiN < 30 ? 'sovrappeso' : 'obeso';
    const bmr  = S.anagrafica ? calcBMR(S.anagrafica) : null;
    const nutrition = S.anagrafica ? computeNutrition(S.anagrafica, S.goal) : null;
    const tdee = nutrition?.tdee || null;
    const bmiPct = Math.min(Math.max(((bmiN-15)/25)*100, 1), 99).toFixed(1);
    setTimeout(() => {
      const tipBmi = document.getElementById('tip-bmi');
      if (tipBmi) tipBmi.innerHTML = `<div class="tip-title">BMI · Indice di Massa Corporea</div>
        <div class="tip-desc">Rapporto peso/altezza²: <strong>${peso} / (${(alt/100).toFixed(2)})² = ${bmi}</strong> · ${bmiLbl}.<br>
        Indicatore generale, non distingue muscolo da grasso.</div>
        ${bmr ? `<div class="tip-desc" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--b1)"><strong>BMR</strong> ${bmr} kcal/die &nbsp;·&nbsp; <strong>TDEE</strong> ~${tdee} kcal/die</div>` : ''}
        <div class="bmi-ruler">
          <div class="bmi-track"><div class="bmi-needle" style="left:${bmiPct}%"></div></div>
          <div class="bmi-labels">
            <span class="bmi-label" style="left:0%">15</span><span class="bmi-label" style="left:14%">18.5</span>
            <span class="bmi-label" style="left:40%">25</span><span class="bmi-label" style="left:60%">30</span>
            <span class="bmi-label" style="left:100%">40</span>
          </div>
          <div class="bmi-zones">
            <span class="bmi-zone z-low">Sottopeso &lt;18.5</span><span class="bmi-zone z-ok">Normopeso 18.5–24.9</span>
            <span class="bmi-zone z-mid">Sovrappeso 25–29.9</span><span class="bmi-zone z-hi">Obeso ≥ 30</span>
          </div>
        </div>`;
      const tipBmr = document.getElementById('tip-bmr');
      if (tipBmr && bmr) {
        const bf = S.anagrafica?.grassoCorporeo;
        const usesKatch = bf != null && bf >= 3 && bf <= 60;
        tipBmr.innerHTML = `<div class="tip-title">BMR · Metabolismo Basale</div>
        <div class="tip-desc">Calorie bruciate a <strong>completo riposo</strong>.<br>
        ${usesKatch
          ? `Formula Katch-McArdle: <strong>370 + 21.6 × massa magra = ${bmr} kcal</strong>`
          : `Formula Mifflin-St Jeor: <strong>${S.anagrafica?.sesso === 'f' ? `10×${peso} + 6.25×${alt} − 5×${eta} − 161` : `10×${peso} + 6.25×${alt} − 5×${eta} + 5`} = ${bmr} kcal</strong>`}</div>`;
      }
      const tipTdee = document.getElementById('tip-tdee');
      if (tipTdee && tdee && nutrition) {
        const surplus = S.macro.on.k - tdee;
        const range = nutrition.tdeeRange ? `${nutrition.tdeeRange.low}–${nutrition.tdeeRange.high}` : `${tdee}`;
        tipTdee.innerHTML = `<div class="tip-title">TDEE · Fabbisogno Calorico Totale</div>
          <div class="tip-desc">(BMR + NEAT + EAT) / (1 − TEF) = <strong>~${tdee} kcal/die</strong>.<br>
          Stima iniziale realistica: <strong>${range} kcal/die</strong>.<br>
          ${nutrition.calibration?.offsetKcal ? `Auto-calibrazione 14 giorni: <strong>${nutrition.calibration.offsetKcal > 0 ? '+' : ''}${nutrition.calibration.offsetKcal} kcal</strong>.<br>` : ''}
          Il tuo piano ON (<strong>${S.macro.on.k} kcal</strong>) prevede un surplus di <strong style="color:${surplus>0?'var(--on)':'var(--red)'}"> ${surplus>0?'+':''}${surplus} kcal</strong>.</div>`;
      }
    }, 0);
  }

  // Streak badge
  const streak = calcStreak();
  const sbs = streakBadgeStyle(streak);
  const streakBadge = `<span class="tg-streak tg-streak-${sbs.tier}${streak === 0 ? ' is-zero' : ''}" onmouseenter="showTip('tip-streak',this)" onmouseleave="hideTip('tip-streak')">
    <span class="tg-streak-icon" aria-hidden="true">${sbs.emoji}</span>
    <span class="tg-streak-copy">
      <span class="tg-streak-label">${streak > 0 ? 'Streak attiva' : 'Streak pronta'}</span>
      <span class="tg-streak-val">${streak} ${streak === 1 ? 'giorno' : 'giorni'}</span>
    </span>
  </span>`;
  setTimeout(() => {
    const tipStreak = document.getElementById('tip-streak');
    if (!tipStreak) return;
    if (streak > 0) {
      tipStreak.innerHTML = `<div class="tip-title">${sbs.emoji} Streak · ${streak} ${streak===1?'giorno':'giorni'} consecutivi</div>
        <div class="tip-desc">Hai registrato almeno un'attivita per <strong>${streak} ${streak===1?'giorno':'giorni'} di fila</strong>. Continua cosi!</div>`;
    } else {
      tipStreak.innerHTML = `<div class="tip-title">${sbs.emoji} Streak · pronta a partire</div>
        <div class="tip-desc">Aggiungi un cibo, segna un integratore o registra acqua oggi per accendere la tua streak.</div>`;
    }
  }, 0);

  // Chip giorno Workout/Rest
  const isOn = resolvedType === 'on';
  const chipTxt = isOn ? 'Giorno Workout' : 'Giorno Rest';
  const chipIcon = isOn ? '●' : '◐';
  const dayChip = `<span class="tg-day-chip-wrap">
    <button class="tg-day-chip tg-day-chip-${isOn ? 'on' : 'off'}" onclick="setDay('${isOn?'off':'on'}')">
      <span class="tg-day-chip-dot">${chipIcon}</span>
      <span class="tg-day-chip-text">${chipTxt}</span>
    </button>
    <button class="tg-day-chip-help" onmouseenter="showDayModeTip(this)" onmouseleave="hideTip('tip-day-mode')" onclick="showDayModeTip(this);event.stopPropagation()" aria-label="Spiega il cambio tra giorno Workout e giorno Rest" title="Come funziona Workout/Rest">i</button>
  </span>`;

  // Badge fase obiettivo rimosso (tracking settimane rimandato a implementazione futura)
  let goalBadge = '';

  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  let greetingSummary = null;
  let showDailySummary = false;
  let greetingBodyHTML = renderGreetingAlerts(resolvedType, dateKey);
  try {
    greetingSummary = buildGreetingDailySummary(dateKey, resolvedType, now);
    showDailySummary = shouldShowGreetingDailySummary(dateKey, resolvedType, now, greetingSummary);
    if (showDailySummary) greetingBodyHTML = renderGreetingDailySummaryCard(greetingSummary);
  } catch (err) {
    console.error('Greeting daily summary fallback', err);
  }

  const greetingEl = document.getElementById('today-greeting');
  if (greetingEl) {
    greetingEl.dataset.dayState = resolvedType;
    greetingEl.classList.remove('is-on', 'is-off', 'has-cheat', 'is-on-cheat', 'is-off-cheat');
    greetingEl.classList.add(isOn ? 'is-on' : 'is-off');
    if (cheat) {
      greetingEl.classList.add('has-cheat', isOn ? 'is-on-cheat' : 'is-off-cheat');
    }
  }
  const cheatBadge = cheat
    ? `<button class="tg-cheat-chip" onclick="focusTodayCheat()" title="Apri dettaglio sgarro">
        <span class="tg-cheat-chip-dot"></span>
        <span class="tg-cheat-chip-text">Sgarro attivo</span>
      </button>`
    : '';
  const greetingBodyBlock = greetingBodyHTML
    ? `<div class="tg-hero-body">
        <div class="tg-hero-block tg-hero-block-quote${showDailySummary ? ' has-summary' : ''}">${greetingBodyHTML}</div>
      </div>`
    : '';

  document.getElementById('today-greeting').innerHTML = `
    <div class="tg-hero-main">
      <div class="tg-hero-copy">
        <div class="tg-date-row">
          <div class="tg-date">${isTodayView ? 'Oggi' : 'Selezionato'} · ${DAYS[viewDate.getDay()]} ${viewDate.getDate()} ${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}</div>
        </div>
        <div class="tg-mobile-meta">
          ${dayChip}
          ${cheatBadge}
        </div>
        <div class="tg-hello">${saluto}, <em>${nome}.</em></div>
        <div class="tg-subtext">${getGreetingSubtext(h, resolvedType, streak)}</div>
        <div class="tg-streak-row">${streakBadge}</div>
      </div>
    </div>
    ${greetingBodyBlock}`;
}

function renderTodaySignals(type, dateKey) {
  const el = document.getElementById('today-signal-row');
  if (!el) return;
  const scheduledType = getScheduledDayType(dateKey);
  const trackedType = getTrackedDayType(dateKey, type);
  const dayModeLabel = value => value === 'on' ? 'Workout' : 'Rest';
  const dayModeIcon = value => value === 'on' ? '🏃' : '🧍';
  const scheduledKcal = S.macro?.[scheduledType]?.k || 0;
  const trackedKcal = S.macro?.[trackedType]?.k || 0;
  const hasOverride = scheduledType !== trackedType;
  const overrideMeta = hasOverride
    ? `<div class="today-signal-note">
        <div class="today-signal-primary">
          <div class="today-signal-title">Hai cambiato ritmo</div>
          <div class="today-signal-main">
            <span class="today-signal-mode is-scheduled"><span class="today-signal-mode-icon">${dayModeIcon(scheduledType)}</span><span>${dayModeLabel(scheduledType)}</span></span>
            <span class="today-signal-arrow" aria-hidden="true">→</span>
            <span class="today-signal-mode is-tracked"><span class="today-signal-mode-icon">${dayModeIcon(trackedType)}</span><span>${dayModeLabel(trackedType)}</span></span>
          </div>
          <div class="today-signal-copy">Da ${dayModeLabel(scheduledType)} a ${dayModeLabel(trackedType)}.</div>
        </div>
        <div class="today-signal-aside">
          <div>Target di oggi aggiornati di conseguenza.</div>
          <div class="today-signal-kcal">${scheduledKcal} kcal <span aria-hidden="true">→</span> ${trackedKcal} kcal</div>
        </div>
      </div>`
    : '';

  if (!hasOverride) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `<div class="today-signal-actions">
    <div class="today-signal-status">${overrideMeta}</div>
  </div>`;
}

function renderDashboardAlertSummary(type, dateKey) {
  const el = document.getElementById('today-alerts-summary');
  if (!el) return;
  el.innerHTML = '';
}

function renderTodayQuickActions(type, dateKey) {
  const el = document.getElementById('today-quick-actions');
  if (!el) return;
  const mealState = getCurrentMealState(type, dateKey);
  const hasMealFocus = mealState.index !== -1;
  const mealLabel = hasMealFocus
    ? (mealState.kind === 'now' ? 'Pasto attuale' : 'Prossimo pasto')
    : 'Apri pasti';
  const mealMeta = hasMealFocus
    ? htmlEsc(mealState.name || '')
    : 'Vai alla timeline';
  const firstActiveSupp = (S.supplements || []).find(s => s.active)?.id || null;
  const suppAction = firstActiveSupp
    ? `revealTodaySupplement('${firstActiveSupp}')`
    : `document.querySelector('.today-support-panel')?.scrollIntoView({behavior:'smooth',block:'start'})`;
  const checkedSupps = new Set((S.suppChecked?.[dateKey]) || []);
  const pendingSupps = (S.supplements || []).filter(s => s.active && !checkedSupps.has(s.id)).length;
  const mealAction = hasMealFocus
    ? `document.getElementById('${mealState.isExtra ? `mc-extra-${mealState.key}` : `mc-${type}-${mealState.key}`}')?.scrollIntoView({behavior:'smooth',block:'center'})`
    : `document.getElementById('meals-today')?.scrollIntoView({behavior:'smooth',block:'start'})`;
  const waterCount = (S.water?.[dateKey]) || 0;
  const waterTarget = getWaterTargetInfo(dateKey).glasses;
  const noteValue = (S.notes?.[dateKey] || '').trim();
  el.innerHTML = `
    <div class="today-quick-actions-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Dashboard</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Vai dritto al punto</div>
        </div>
        <div class="support-mini-sub today-quick-actions-sub">Pasto, acqua, routine e note sempre a un tocco.</div>
      </div>
    </div>
    <div class="today-quick-actions">
      <button class="today-quick-btn is-primary" onclick="${mealAction}">
        <span class="today-quick-ico">🍽️</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">${mealLabel}</span>
          <span class="today-quick-meta">${mealMeta}</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="addWaterAndReveal(1)">
        <span class="today-quick-ico">💧</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">+ Acqua</span>
          <span class="today-quick-meta">${waterCount}/${waterTarget} bicchieri</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="${suppAction}">
        <span class="today-quick-ico">💊</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">Routine</span>
          <span class="today-quick-meta">${pendingSupps > 0 ? `${pendingSupps} da segnare` : 'Tutto in ordine'}</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="focusTodayNotes()">
        <span class="today-quick-ico">📝</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">Note</span>
          <span class="today-quick-meta">${noteValue ? 'Apri nota del giorno' : 'Scrivi promemoria'}</span>
        </span>
      </button>
    </div>`;
}

function renderSupportAlerts(type, dateKey) {
  const el = document.getElementById('today-support-alerts');
  if (!el) return;
  el.innerHTML = '';
}

function getTodayAlertTitle(alert) {
  if (!alert) return 'Supporto giornata';
  if (alert.id === 'support-supp') return 'Integratori da segnare';
  if (alert.id === 'support-tracking') return 'Pasti da registrare';
  if (alert.type === 'supp' || String(alert.id || '').startsWith('supp-')) return 'Integratore da segnare';
  switch (alert.id) {
    case 'no-meals':
      return 'Pasti non registrati';
    case 'missing-lunch':
      return 'Pranzo da registrare';
    case 'low-intake-midday':
    case 'low-intake-late':
    case 'too-few-meals-evening':
      return 'Tracking in ritardo';
    case 'combined-deficit':
      return 'Macro da recuperare';
    case 'low-protein':
      return 'Proteine da recuperare';
    case 'low-carbs-on':
      return 'Carbo da recuperare';
    case 'low-kcal-err':
    case 'low-kcal-warn':
      return 'Calorie da recuperare';
    case 'surplus-err':
    case 'surplus-warn':
      return 'Apporto sopra target';
    case 'day-centered':
      return 'Giornata in linea';
    default:
      if (alert.type === 'err') return 'Attenzione';
      if (alert.type === 'warn') return 'Da monitorare';
      return 'Supporto giornata';
  }
}

function buildTodayAlertButtons(alert, { supportMode = false, hasFavFoods = (S.favoriteFoods || []).length > 0 } = {}) {
  const buttons = [];
  if (alert?.ctaLabel && alert?.ctaAction) {
    const action = supportMode && String(alert.id || '').startsWith('supp-')
      ? `resolveSupportSupplementAlert('${String(alert.id || '').replace(/^supp-/, '')}', this)`
      : alert.ctaAction;
    buttons.push(`<button class="today-context-alert-btn" onclick="${action}">${alert.ctaLabel}</button>`);
  }
  if (alert?.hasSuggest && hasFavFoods) {
    buttons.push(`<button class="today-context-alert-btn is-secondary" onclick="openFoodSuggestion(${alert.remK||0},${alert.remP||0},${alert.remC||0},${alert.remF||0})">Vedi cosa mangiare</button>`);
  }
  return buttons;
}

function renderTodayAlertHTML(alert, { compact = false, idx = 0, supportMode = false, eyebrow, hasFavFoods = (S.favoriteFoods || []).length > 0, extraButtons = [], className = '' } = {}) {
  const buttons = [...buildTodayAlertButtons(alert, { supportMode, hasFavFoods }), ...extraButtons];
  const title = getTodayAlertTitle(alert);
  const eyebrowText = eyebrow || (compact ? (idx === 0 ? 'Priorita di oggi' : 'Da controllare') : 'Segnale del momento');
  const hasInlineAction = buttons.length === 1;
  const icon = alert?.icon || '!';
  return `
    <div class="today-context-alert${compact ? ' today-context-alert-support today-context-alert-support-compact' : ''}${className ? ` ${className}` : ''}">
      <div class="today-context-alert-shell">
        <div class="today-context-alert-icon" aria-hidden="true">${icon}</div>
        <div class="today-context-alert-content${hasInlineAction ? ' has-inline-action' : ''}">
          <div class="today-context-alert-body">
            <div class="today-context-alert-head">
              <div class="today-context-alert-kicker">${eyebrowText}</div>
              <div class="today-context-alert-title">${title}</div>
            </div>
            <div class="today-context-alert-main">${alert.text}</div>
          </div>
          ${hasInlineAction ? `<div class="today-context-alert-inline-action">${buttons[0]}</div>` : ''}
          ${buttons.length > 1 ? `<div class="today-context-alert-actions">${buttons.join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderWeekCal(now) {
  const DOW_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const ON_SET = new Set(S.onDays);

  // Monday of *current real* week
  const todayDow = now.getDay();
  const todayMonOff = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + todayMonOff);
  thisMonday.setHours(0,0,0,0);

  // Monday of *displayed* week (offset by S.calOffset weeks)
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() + S.calOffset * 7);

  // Title: "17?23 Mar 2025" or "31 Mar ? 6 Apr"
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
  const mM = MONTHS_SHORT[monday.getMonth()], sM = MONTHS_SHORT[sun.getMonth()];
  const titleStr = monday.getMonth() === sun.getMonth()
    ? `${monday.getDate()}–${sun.getDate()} ${mM} ${sun.getFullYear()}`
    : `${monday.getDate()} ${mM} – ${sun.getDate()} ${sM} ${sun.getFullYear()}`;
  const titleEl = document.getElementById('cal-title');
  if (titleEl) {
    titleEl.textContent = titleStr;
    titleEl.title = 'Scegli mese e anno';
  }

  // Prev/next buttons always enabled (no week limit)
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  if (prevBtn) prevBtn.classList.remove('disabled');
  if (nextBtn) nextBtn.classList.remove('disabled');

  const todayStr = localDate(now);
  // init selDate to today if not set
  if (!S.selDate) S.selDate = todayStr;
  const dayModels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dow    = d.getDay();
    const dStr   = localDate(d);
    const isTod  = dStr === todayStr;
    const isSel  = dStr === S.selDate;
    const isPast = d < now && !isTod;
    const dayInfo = S.doneByDate[dStr];
    const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dStr) : null;
    const isFull  = !!dayInfo && dayInfo.done > 0 && dayInfo.total > 0 && dayInfo.done >= dayInfo.total;
    const hasDone = !!dayInfo && (dayInfo.activityCount || 0) > 0;
    const isPartial = hasDone && !isFull;

    // Visual type: if meals were logged for this day, use that type.
    // If no dayInfo but this is the currently viewed date, use S.day (reflects manual ON/OFF toggle).
    // Otherwise fall back to the scheduled ON/OFF from onDays.
    const scheduledOn = ON_SET.has(dow);
    const isViewedDate = dStr === (S.selDate || todayStr);
    const visualOn = dayInfo ? dayInfo.type === 'on' : (isViewedDate ? S.day === 'on' : scheduledOn);
    // Type to pass when clicking (what plan to show)
    const clickType = visualOn ? 'on' : 'off';
    const hasOverride = !!(dayInfo && dayInfo.hasTypeOverride);
    const typeLabel = visualOn ? 'Workout' : 'Rest';
    const typeLabelCompact = visualOn ? 'Work' : 'Rest';
    const overrideTitle = hasOverride
      ? `${typeLabel} scelto al posto di ${scheduledOn ? 'Workout' : 'Rest'}`
      : '';

    const cls = [
      'wc-day',
      visualOn ? 'wc-on' : 'wc-off',
      hasOverride ? 'has-override' : '',
      cheat ? 'has-cheat' : '',
      isFull ? 'is-full' : '',
      isPartial ? 'is-partial' : '',
      isTod  ? 'today' : '',
      isSel  ? 'sel'   : '',
      isPast ? 'past'  : '',
    ].filter(Boolean).join(' ');

    const doneTitle = [
      dayInfo?.total > 0 ? `${dayInfo.done}/${dayInfo.total} pasti` : '',
      dayInfo?.cheatDone > 0 ? `sgarro +${cheat?.extraKcal || 0} kcal` : '',
      dayInfo?.suppDone > 0 ? `${dayInfo.suppDone} integratori` : '',
      dayInfo?.waterCount > 0 ? `${dayInfo.waterCount} bicchieri` : '',
    ].filter(Boolean).join(' · ');

    const cellTitle = [
      d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
      typeLabel,
      hasOverride ? overrideTitle : '',
      cheat ? `Sgarro +${cheat.extraKcal || 0} kcal` : '',
      doneTitle,
    ].filter(Boolean).join(' · ');

    return {
      d,
      dStr,
      clickType,
      cls,
      isTod,
      visualOn,
      hasOverride,
      cheat,
      hasDone,
      isFull,
      isPartial,
      typeLabel,
      typeLabelCompact,
      overrideTitle,
      doneTitle,
      cellTitle,
      dowLabel: DOW_NAMES[i],
      dateNum: d.getDate(),
    };
  });

  const weekMetaEl = document.getElementById('week-cal-meta');
  if (weekMetaEl) {
    const overrideCount = dayModels.filter(day => day.hasOverride).length;
    const cheatCount = dayModels.filter(day => day.cheat).length;
    const fullCount = dayModels.filter(day => day.isFull).length;
    const chips = [
      dayModels.filter(day => day.visualOn).length
        ? `<span class="week-meta-chip workout"><strong>${dayModels.filter(day => day.visualOn).length}</strong> ${dayModels.filter(day => day.visualOn).length === 1 ? 'allenamento' : 'allenamenti'}</span>`
        : '',
      cheatCount
        ? `<span class="week-meta-chip cheat"><strong>${cheatCount}</strong> ${cheatCount === 1 ? 'sgarro' : 'sgarri'} <span class="week-meta-dot" aria-hidden="true"></span></span>`
        : '',
    ].filter(Boolean);
    weekMetaEl.innerHTML = chips.join('');
  }

  document.getElementById('week-cal').innerHTML = dayModels.map(day => {
    const doneBadge = day.hasDone
      ? `<div class="wc-done ${day.isFull ? 'full' : 'partial'}${day.cheat ? ' cheat' : ''}" title="${day.doneTitle || ''}"></div>`
      : '';
    const eventDots = [
      day.hasOverride ? `<span class="wc-marker wc-marker-override" title="${day.overrideTitle}"></span>` : '',
      day.cheat ? `<span class="wc-marker wc-marker-cheat" title="Sgarro +${day.cheat.extraKcal || 0} kcal"></span>` : '',
    ].filter(Boolean).join('');
    return `<div class="${day.cls}" onclick="calSelectDay('${day.dStr}','${day.clickType}')" title="${day.cellTitle}">
      ${doneBadge}
      <div class="wc-top">
        <div class="wc-name">${day.dowLabel}</div>
      </div>
      <div class="wc-markers">${eventDots}</div>
      <div class="wc-num-wrap">
        <div class="wc-num">${day.dateNum}</div>
      </div>
      <div class="wc-type ${day.visualOn ? 'workout' : 'rest'}">
        <span class="wc-type-full">${day.typeLabel}</span>
        <span class="wc-type-compact">${day.typeLabelCompact}</span>
      </div>
    </div>`;
  }).join('');
  if (typeof attachWeekCalendarSwipe === 'function') attachWeekCalendarSwipe();
}
function renderMacroStrip(type, meals, tgt) {
  const dateKey = S.selDate || localDate();
  const dayLog  = S.foodLog[dateKey] || {};
  let eK=0, eP=0, eC=0, eF=0;

  meals.forEach((_,i) => {
    const logItems = dayLog[i] || [];
    if (logItems.length) {
      logItems.forEach(it => {
        const g = it.grams/100;
        eK += Math.round(it.kcal100*g);
        eP += it.p100*g;
        eC += it.c100*g;
        eF += it.f100*g;
      });
    }
  });

  // Pasti extra opzionali
  const _activeExtra = S.extraMealsActive?.[dateKey] || {};
  Object.keys(_activeExtra).forEach(xKey => {
    (dayLog[xKey] || []).forEach(it => {
      const g = it.grams / 100;
      eK += Math.round(it.kcal100 * g);
      eP += it.p100 * g;
      eC += it.c100 * g;
      eF += it.f100 * g;
    });
  });

  eP=Math.round(eP*10)/10;
  eC=Math.round(eC*10)/10;
  eF=Math.round(eF*10)/10;

  let cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  let cheatChanged = false;
  if (typeof reconcileAutoCheatMeal === 'function') {
    const reconciliation = reconcileAutoCheatMeal(dateKey, type, eK);
    if (reconciliation) {
      cheatChanged = !!reconciliation.changed;
      cheat = reconciliation.cheat || null;
    }
  }
  const effectiveTargetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(dateKey, type)
    : tgt.k;
  const cheatExtraK = cheat?.extraKcal || 0;
  const baseTargetK = Math.max(0, tgt.k || 0);

  const el = document.getElementById('macro-strip');
  if (!el) return {eK,eP,eC,eF, cheatChanged};

  // --- Kcal hero ---
  const kPct = effectiveTargetK > 0 ? Math.min(eK / effectiveTargetK, 1) * 100 : 0;
  const kRem = effectiveTargetK - eK;
  const kRc  = kRem <= 0 ? (eK > effectiveTargetK * 1.08 ? 'err' : 'ok') : 'missing';
  const kRt  = kRem <= 0
    ? (eK > effectiveTargetK ? `+${Math.round(eK - effectiveTargetK)} kcal oltre` : 'In linea con il target')
    : `${Math.abs(Math.round(kRem))} kcal mancanti`;
  const basePct = effectiveTargetK > 0 ? Math.min(baseTargetK / effectiveTargetK, 1) * 100 : 0;
  const extraPct = effectiveTargetK > 0 ? Math.min(cheatExtraK / effectiveTargetK, 1) * 100 : 0;
  const eatenPct = effectiveTargetK > 0 ? Math.min(eK / effectiveTargetK, 1) * 100 : 0;
  const redStartPct = Math.max(0, 100 - extraPct);
  const fillStyle = cheatExtraK > 0
    ? `background:
        linear-gradient(90deg,
          var(--${kRc === 'err' ? 'red' : kRc === 'warn' ? 'amber' : 'on'}) 0%,
          var(--${kRc === 'err' ? 'red' : kRc === 'warn' ? 'amber' : 'on'}) ${Math.min(eatenPct, redStartPct)}%,
          ${eK > baseTargetK ? (kRc === 'err' ? 'var(--red)' : 'var(--amber)') : 'var(--on)'} ${Math.min(eatenPct, redStartPct)}%,
          ${eK > baseTargetK ? (kRc === 'err' ? 'var(--red)' : 'var(--amber)') : 'var(--on)'} ${eatenPct}%,
          transparent ${eatenPct}%,
          transparent 100%)`
    : '';
  const cheatTailHTML = cheatExtraK > 0
    ? `<div class="ms-kcal-cheat-tail" style="left:${basePct}%;width:${extraPct}%"></div>`
    : '';

  // --- Macro 3 card ---
  const macros = [
    { cls:'prot', icon:'🥩', lbl:'Proteine', eaten:eP, tgt:tgt.p, unit:'g' },
    { cls:'carb', icon:'🍚', lbl:'Carb',     eaten:eC, tgt:tgt.c, unit:'g' },
    { cls:'fat',  icon:'🧈', lbl:'Grassi',   eaten:eF, tgt:tgt.f, unit:'g' },
  ];
  const hasLoggedFood = eK > 0 || eP > 0 || eC > 0 || eF > 0;

  const macroCards = macros.map(m => {
    const pct = m.tgt > 0 ? Math.min(m.eaten / m.tgt, 1) * 100 : 0;
    const rem = m.tgt - m.eaten;
    const rc  = rem <= 0 ? (m.eaten > m.tgt * 1.15 ? 'err' : 'ok') : 'missing';
    const diff = Math.abs(Math.round(rem));
    const rt  = rem <= 0
      ? (m.eaten > m.tgt ? `+${Math.round(m.eaten - m.tgt)}g oltre` : 'Target centrato')
      : `${diff}g mancanti`;
    return `<div class="ms-macro-card ${m.cls}" onclick="openMacroDetail('${m.cls}')" title="Vedi dettaglio ${m.lbl.toLowerCase()}">
      <div class="ms-macro-top">
        <div class="ms-macro-icon">${m.icon}</div>
        <div class="ms-macro-lbl">${m.lbl}</div>
      </div>
      <div class="ms-macro-val">${m.eaten}<span class="ms-macro-unit">${m.unit}</span></div>
      <div class="ms-macro-bar"><div class="ms-macro-fill" style="width:${pct}%"></div></div>
      <div class="ms-macro-meta">
        <div class="ms-macro-target">Target ${m.tgt}${m.unit}</div>
        <div class="ms-macro-rem ${rc}">${rt}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="ms-kcal-card" onclick="openMacroDetail('kcal')" title="Vedi dettaglio calorie">
      <div class="ms-kcal-head">
        <div class="ms-kcal-kicker">Energia di oggi</div>
        <div class="ms-kcal-target-chip">Target ${effectiveTargetK.toLocaleString('it-IT')} kcal</div>
      </div>
      <div class="ms-kcal-top">
        <div class="ms-kcal-eaten">
          <span class="ms-kcal-icon">🔥</span>
          <span class="ms-kcal-val">${eK.toLocaleString('it-IT')}</span>
          <span class="ms-kcal-unit">kcal</span>
        </div>
        <div class="ms-kcal-rem ${kRc}">${kRt}</div>
      </div>
      <div class="ms-kcal-bar">
        ${cheatTailHTML}
        <div class="ms-kcal-fill ${kRc}" style="width:${kPct}%;${fillStyle}"></div>
      </div>
      <div class="ms-kcal-target">${cheat ? `Target aggiornato: <span class="ms-kcal-boost">${tgt.k.toLocaleString('it-IT')} base + ${cheat.extraKcal} sgarro</span>` : 'Il target si aggiorna in tempo reale sulla giornata attiva.'}</div>
    </div>
    ${hasLoggedFood ? `<div class="ms-macros-row">${macroCards}</div>` : ''}`;

  return {eK, eP, eC, eF, cheatChanged};
}
function renderCheatWidget() {
  const el = document.getElementById('cheat-widget');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const dayType = getTrackedDayType(dateKey, getScheduledDayType(dateKey));
  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  const weeklyCount = typeof getWeekCheatCount === 'function' ? getWeekCheatCount(dateKey) : 0;
  const weeklyLimit = typeof getCheatWeeklyLimit === 'function' ? getCheatWeeklyLimit() : 2;
  const targetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(dateKey, dayType)
    : (S.macro?.[dayType]?.k || 0);
  const dayTypeLabel = dayType === 'on' ? 'Workout' : 'Rest';

  if (!cheat) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  el.innerHTML = `<div class="cheat-widget support-mini-card${cheat ? ' active' : ''}" id="today-cheat-card">
    <div class="cheat-top support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Supporto aderenza</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">🔥 Margine extra</div>
          <span class="support-mini-state danger${weeklyCount >= weeklyLimit ? ' is-limit' : ''}">${weeklyCount}/${weeklyLimit} sett.</span>
        </div>
        <div class="support-mini-sub">Oggi hai superato il target base, quindi allarghiamo il margine della giornata.</div>
      </div>
    </div>
    <div class="cheat-meta">
      <span class="support-mini-chip danger">${dayTypeLabel}</span>
      <span class="cheat-meta-text">Nuovo riferimento di oggi: ${targetK.toLocaleString('it-IT')} kcal</span>
    </div>
    <div class="cheat-copy">Cosi il riepilogo resta piu realistico e semplice da leggere.</div>
    <div class="cheat-auto-note">E gia tutto salvato: tu pensa solo al resto della giornata.</div>
  </div>`;
}
function renderToday() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const now   = new Date();

  updateTodayDashboardHeading(now);
  renderGreeting(type, now);
  renderWeekCal(now);
  if (typeof attachTodaySwipe === 'function') attachTodaySwipe();
  renderTodayLog(); // cards + macro + alerts + progress
  // Notes
  const noteKey   = S.selDate || localDate(now);
  const noteInput = document.getElementById('notes-input');
  if (noteInput && !noteInput.dataset.loaded) {
    noteInput.value = S.notes[noteKey] || '';
    noteInput.dataset.loaded = '1';
    noteInput.dataset.key = noteKey;
  }
  renderNotes();
  renderCheatWidget();
  renderSuppToday();
  checkWeeklyCheckin();
}

function updateTodayDashboardHeading(now = new Date()) {
  const titleEl = document.getElementById('today-recap-title');
  const subEl = document.getElementById('today-dashboard-sub');
  if (!titleEl && !subEl) return;
  const dateKey = S.selDate || localDate(now);
  const isTodayView = dateKey === localDate(now);
  const viewDate = new Date(`${dateKey}T12:00:00`);
  const label = viewDate.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const niceLabel = label.charAt(0).toUpperCase() + label.slice(1);
  if (titleEl) titleEl.textContent = isTodayView ? 'Oggi in breve' : `${niceLabel} in breve`;
  if (subEl) subEl.textContent = isTodayView
    ? 'Il quadro giusto per capire subito il prossimo passo.'
    : 'Il quadro giusto per leggere questa giornata e capire il prossimo passo.';
}

function getCurrentMealState(type, dateKey) {
  const isTodayView = !S.selDate || S.selDate === localDate();
  if (!isTodayView) return { index: -1, kind: 'none' };

  const candidates = getMealTimelineCandidates(type, dateKey);

  const nowMins = new Date().getHours()*60 + new Date().getMinutes();
  for (const candidate of candidates) {
    const range = parseMealTimeRange(candidate.time);
    if (!range) continue;
    if (nowMins >= range.start - 15 && nowMins <= range.end + 90) return { ...candidate, kind: 'now' };
  }

  let nextCandidate = null;
  let minDiff = Infinity;
  for (const candidate of candidates) {
    const range = parseMealTimeRange(candidate.time);
    if (!range) continue;
    if (range.start > nowMins && range.start - nowMins < minDiff) {
      minDiff = range.start - nowMins;
      nextCandidate = candidate;
    }
  }
  return nextCandidate ? { ...nextCandidate, kind: 'next' } : { index: -1, kind: 'none' };
}

function renderCurrentMealFocus(type, mealState, dateKey, alertModel = null) {
  const el = document.getElementById('current-meal-focus');
  if (!el) return;
  el.innerHTML = '';
}

// Partial render ? only what changes when log items are added/removed
// Skips greeting and calendar (expensive, unnecessary for log changes)
function renderTodayLog() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const dateKey = S.selDate || localDate();
  const {eK, eP, eC, eF, cheatChanged} = renderMacroStrip(type, meals, tgt);
  renderCheatWidget();
  renderWater();

  // Determine current meal index based on time (only for today's view)
  const mealState = getCurrentMealState(type, dateKey);
  const currentMealIdx = mealState.isExtra ? -1 : mealState.key;
  const alertModel = splitTodayAlerts(type, dateKey);

  const _visibleExtra = getVisibleExtraMealKeys(dateKey);
  let _mealsHTML = '';
  meals.forEach((_, i) => {
    _mealsHTML += mealCardHTML(type, i, 'today', i === currentMealIdx, mealState.kind);
    if (i === 0) {
      _mealsHTML += _visibleExtra.has('merenda')
        ? extraMealCardHTML('merenda', dateKey)
        : extraMealAddBtnHTML('merenda', 'Merenda');
    }
    if (i === meals.length - 1) {
      _mealsHTML += _visibleExtra.has('spuntino')
        ? extraMealCardHTML('spuntino', dateKey)
        : extraMealAddBtnHTML('spuntino', 'Spuntino');
    }
  });
  document.getElementById('meals-today').innerHTML = _mealsHTML;
  renderCurrentMealFocus(type, mealState, dateKey, alertModel);
  renderDashboardAlertSummary(type, dateKey);
  renderTodaySignals(type, dateKey);
  renderSupportAlerts(type, dateKey);

  // Progress: count meals with at least one logged item
  const completion = getDayCompletion(dateKey, type);
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${completion.done} su ${completion.total} completati`;
  if (dpFill)  dpFill.style.width  = `${completion.total ? (completion.done/completion.total)*100 : 0}%`;
  if (cheatChanged) refreshTodayDerivedViews({ greeting: true, calendar: true, stats: true });
}
function renderNotes() {
  const entries = Object.entries(S.notes)
    .filter(([,v]) => v && v.trim())
    .sort((a,b) => b[0].localeCompare(a[0])).slice(0, 20);
  const el = document.getElementById('notes-prev');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = `<div class="notes-empty-state">Ancora nessuna nota. Scrivi qui quello che vuoi ritrovare piu tardi.</div>`;
    return;
  }
  el.innerHTML = `<button class="notes-diary-btn" onclick="openNotesDiary()">Apri diario note<span>${entries.length}</span></button>`;
}
function macroVisualCardsHTML(macros, opts = {}) {
  const sizeClass = opts.size === 'compact' ? ' compact' : '';
  const items = [
    { cls: 'kcal', icon: '🔥', label: 'Kcal', value: `${Math.round(macros.k || macros.kcal || 0)}`, unit: 'kcal' },
    { cls: 'prot', icon: '🥩', label: 'Proteine', value: `${Math.round(macros.p || 0)}`, unit: 'g' },
    { cls: 'carb', icon: '🍚', label: 'Carb', value: `${Math.round(macros.c || 0)}`, unit: 'g' },
    { cls: 'fat', icon: '🧈', label: 'Grassi', value: `${Math.round(macros.f || 0)}`, unit: 'g' },
  ];
  return `<div class="macro-visual-grid${sizeClass}">
    ${items.map(item => `<div class="macro-visual-card ${item.cls}">
      <span class="macro-visual-icon">${item.icon}</span>
      <span class="macro-visual-label">${item.label}</span>
      <span class="macro-visual-value">${item.value}<span class="macro-visual-unit">${item.unit}</span></span>
    </div>`).join('')}
  </div>`;
}
function favoriteFoodsManagerHTML(context = 'piano') {
  const favoriteFoods = typeof normalizeFavoriteFoods === 'function'
    ? normalizeFavoriteFoods(S.favoriteFoods || [])
    : (S.favoriteFoods || []);
  const favoriteFoodsCount = favoriteFoods.length;
  const MEAL_LABELS = { colazione: 'Colazione', pranzo: 'Pranzo', cena: 'Cena', spuntino: 'Snack' };
  const ROLE_LABELS = {
    base: 'Base',
    proteina: 'Prot',
    latticino: 'Latte',
    frutta: 'Frutta',
    contorno: 'Cont',
    condimento: 'Cond',
  };
  const mealCoverage = Object.keys(MEAL_LABELS).map(mealType => ({
    mealType,
    label: MEAL_LABELS[mealType],
    count: favoriteFoods.filter(food => isFoodCompatibleWithMeal(food, mealType)).length,
  }));
  const listHtml = favoriteFoodsCount
    ? favoriteFoods.map(food => {
        const grams = Number(food.typicalGrams || food.portionGrams || 100) || 100;
        const typK = Math.round((Number(food.kcal100 || 0) * grams) / 100);
        const typP = ((Number(food.p100 || 0) * grams) / 100).toFixed(0);
        const typC = ((Number(food.c100 || 0) * grams) / 100).toFixed(0);
        const activeMealTags = (food.mealTags || []).filter(tag => MEAL_LABELS[tag]);
        const isManual = Array.isArray(food.manualMealTags) && food.manualMealTags.length > 0;
        const manualRoles = Array.isArray(food.manualFoodRoles) ? food.manualFoodRoles : [];
        const isManualRole = manualRoles.length > 0;
        const tagControls = ['colazione', 'pranzo', 'cena', 'spuntino']
          .map(tag => `<button class="ff-tag-toggle${activeMealTags.includes(tag) ? ' active' : ''}" onclick="toggleFavoriteFoodMealTag('${food.id}','${tag}', this)">${MEAL_LABELS[tag]}</button>`)
          .join('');
        const roleControls = Object.entries(ROLE_LABELS)
          .map(([roleKey, roleLabel]) => `<button class="ff-role-toggle${manualRoles.includes(roleKey) ? ' active' : ''}" onclick="toggleFavoriteFoodRole('${food.id}','${roleKey}', this)">${roleLabel}</button>`)
          .join('');
        return `<div class="ff-item" data-food-id="${food.id}">
          <div class="ff-info">
            <div class="ff-name">${htmlEsc(food.name)}</div>
            <div class="ff-meta-row">
              <div class="ff-macros">${grams}g · ${typK} kcal · P ${typP}g · C ${typC}g</div>
              <div class="ff-tag-editor">
                <div class="ff-tag-editor-inline">
                  <span class="ff-tag-editor-label">Pasti</span>
                  <span class="ff-tag-editor-mode${isManual ? ' manual' : ''}">${isManual ? 'Manuali' : 'Auto'}</span>
                </div>
                <div class="ff-tag-toggle-row">${tagControls}</div>
                <div class="ff-role-editor-inline">
                  <span class="ff-tag-editor-label">Ruolo</span>
                  <span class="ff-tag-editor-mode${isManualRole ? ' manual' : ''}">${isManualRole ? 'Manuale' : 'Auto'}</span>
                </div>
                <div class="ff-role-toggle-row">${roleControls}</div>
              </div>
            </div>
          </div>
          <button class="ff-del" onclick="removeFavoriteFood('${food.id}')" title="Rimuovi">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="2" x2="11" y2="11"/><line x1="11" y1="2" x2="2" y2="11"/></svg>
          </button>
        </div>`;
      }).join('')
    : `<div class="ff-empty">Parti da 4-6 cibi che mangi davvero spesso. L helper usera solo questi per costruire proposte sensate.</div>`;

  return `<div class="ff-card support-mini-card">
    <div class="profile-card-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">${context === 'piano' ? 'Piano' : 'Profilo'}</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Cibi abituali</div>
          <span class="support-mini-state ${favoriteFoodsCount ? 'progress' : 'idle'}">${favoriteFoodsCount ? `${favoriteFoodsCount} salvati` : 'Ancora vuoto'}</span>
        </div>
        <div class="support-mini-sub">Aggiungi qui i cibi che compri spesso. Il planner usera questi per creare pasti realistici e per dirti quando i dati non bastano.</div>
      </div>
    </div>
    <div class="ff-inline-note">${favoriteFoodsCount
      ? 'Meglio pochi cibi ma davvero abituali. Se copri colazione, pranzo, cena e snack, l helper lavora molto meglio.'
      : 'Aggiungi almeno una base da colazione, una proteina, una base carbo e uno snack semplice per sbloccare l helper.'}</div>
    <div class="ff-coverage-row">
      ${mealCoverage.map(item => `<div class="ff-coverage-chip${item.count ? ' ready' : ''}">
        <strong>${item.count}</strong>
        <span>${item.label}</span>
      </div>`).join('')}
    </div>
    <div class="ff-list" id="ff-list">${listHtml}</div>
    <button class="ff-open-add-btn" id="ff-add-toggle" onclick="_toggleFfForm()">${favoriteFoodsCount ? '+ Aggiungi cibo' : '+ Aggiungi i primi cibi'}</button>
    <div class="ff-add-form" id="ff-add-form" style="display:none">
      <div class="ff-add-title">Nuovo cibo abituale</div>
      <div class="ff-search-area">
        <div class="ff-search-row">
          <input class="ff-search-inp" id="ff-search-inp" type="text" placeholder="Cerca un alimento..." oninput="onFfSearch(this)" autocomplete="off">
          <button class="ff-bc-btn" onclick="openBarcodeForFf()" title="Scansiona barcode">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a2 2 0 0 1 2-2h2"/><path d="M15 4h2a2 2 0 0 1 2 2v3"/><path d="M21 15v3a2 2 0 0 1-2 2h-2"/><path d="M9 20H6a2 2 0 0 1-2-2v-3"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>
          </button>
        </div>
        <div class="ff-search-results" id="ff-search-results" style="display:none"></div>
        <div class="ff-or-sep">oppure inserisci a mano</div>
      </div>
      <input class="ff-add-name" id="ff-nome" type="text" placeholder="Nome alimento" autocomplete="off">
      <div class="ff-add-grid">
        <div class="ff-add-lbl">Kcal / 100g<input type="number" id="ff-kcal" min="0" step="1" placeholder="0"></div>
        <div class="ff-add-lbl">Prot / 100g<input type="number" id="ff-prot" min="0" step="0.1" placeholder="0"></div>
        <div class="ff-add-lbl">Carb / 100g<input type="number" id="ff-carb" min="0" step="0.1" placeholder="0"></div>
        <div class="ff-add-lbl">Grassi / 100g<input type="number" id="ff-fat" min="0" step="0.1" placeholder="0"></div>
      </div>
      <div class="ff-add-lbl" style="margin-bottom:0">Porzione tipica (g)<input type="number" id="ff-portion" min="1" step="1" placeholder="100"></div>
      <div class="ff-add-row">
        <button class="ff-add-cancel" onclick="_toggleFfForm()">Annulla</button>
        <button class="ff-add-btn" onclick="addFavoriteFood()">Salva cibo</button>
      </div>
    </div>
  </div>`;
}

function favoriteFoodsProfileRedirectHTML() {
  const favoriteFoodsCount = (S.favoriteFoods || []).length;
  return `<div class="profile-redirect-card support-mini-card">
    <div class="profile-card-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Profilo</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Cibi abituali</div>
          <span class="support-mini-state ${favoriteFoodsCount ? 'progress' : 'idle'}">${favoriteFoodsCount ? `${favoriteFoodsCount} salvati` : 'In arrivo'}</span>
        </div>
        <div class="support-mini-sub">Uno spazio che ti aiutera a ritrovare in fretta quello che usi davvero.</div>
      </div>
    </div>
    <div class="ff-inline-note">${favoriteFoodsCount
      ? 'I cibi che hai gia salvato restano con te. Li ritroverai qui in una versione piu comoda.'
      : 'Per ora trovi i template pronti da usare e una piccola anteprima di cio che arriva dopo.'}</div>
    <button class="ff-open-add-btn profile-redirect-btn" onclick="openProfileFavoriteFoods()">Vedi anteprima in Piano</button>
  </div>`;
}

function pianoComingSoonCardHTML(kind) {
  const config = kind === 'foods'
    ? {
        icon: '★',
        label: 'Cibi abituali',
        title: 'I cibi che usi davvero, sempre a portata di mano',
        body: 'Una libreria personale per richiamare al volo le tue basi preferite e velocizzare ogni scelta.',
        bullets: ['ricerca rapida', 'preferiti pronti', 'scelte veloci'],
        preview: `
          <div class="piano-coming-soon-preview piano-coming-soon-preview-foods" aria-hidden="true">
            <div class="pcs-search"></div>
            <div class="pcs-list">
              <div class="pcs-list-row">
                <span class="pcs-dot"></span>
                <div class="pcs-list-lines">
                  <span class="pcs-line" style="width:42%"></span>
                  <span class="pcs-line" style="width:66%"></span>
                </div>
                <span class="pcs-chip" style="width:54px"></span>
              </div>
              <div class="pcs-list-row">
                <span class="pcs-dot"></span>
                <div class="pcs-list-lines">
                  <span class="pcs-line" style="width:48%"></span>
                  <span class="pcs-line" style="width:58%"></span>
                </div>
                <span class="pcs-chip" style="width:62px"></span>
              </div>
            </div>
          </div>`,
      }
    : {
        icon: '✨',
        label: 'Helper pasto',
        title: 'Idee pasto su misura, pronte quando ti servono',
        body: 'Ti proporra spunti semplici da adattare, usare al volo e trasformare in template.',
        bullets: ['spunti veloci', 'macro chiare', 'salva subito'],
        preview: `
          <div class="piano-coming-soon-preview piano-coming-soon-preview-helper" aria-hidden="true">
            <div class="pcs-chip-row">
              <span class="pcs-chip" style="width:74px"></span>
              <span class="pcs-chip" style="width:88px"></span>
              <span class="pcs-chip" style="width:62px"></span>
            </div>
            <div class="pcs-grid">
              <div class="pcs-card">
                <span class="pcs-line" style="width:34%"></span>
                <span class="pcs-line" style="width:78%"></span>
                <span class="pcs-line" style="width:52%"></span>
                <div class="pcs-chip-row pcs-chip-row-tight">
                  <span class="pcs-chip" style="width:56px"></span>
                  <span class="pcs-chip" style="width:70px"></span>
                </div>
              </div>
            </div>
          </div>`,
      };

  return `<div class="piano-coming-soon-card">
    <div class="piano-coming-soon-top">
      <span class="piano-coming-soon-pill"><span class="piano-coming-soon-pill-dot"></span>Prossimo passo</span>
      <span class="piano-coming-soon-label">${config.label}</span>
    </div>
    <div class="piano-coming-soon-body">
      <div class="piano-coming-soon-copy">
        <div class="piano-coming-soon-title-row">
          <span class="piano-coming-soon-icon" aria-hidden="true">${config.icon}</span>
          <div class="piano-coming-soon-title">${config.title}</div>
        </div>
        <div class="piano-coming-soon-text">${config.body}</div>
        <div class="piano-coming-soon-bullets">
          ${config.bullets.map(item => `<span class="piano-coming-soon-bullet">${item}</span>`).join('')}
        </div>
      </div>
      ${config.preview}
    </div>
  </div>`;
}

function getTemplateMealMetaMap() {
  const options = typeof getTemplateMealOptionsFromTodayConfig === 'function'
    ? getTemplateMealOptionsFromTodayConfig()
    : [];
  const map = new Map();
  options.forEach(option => {
    map.set(option.key, option);
  });
  if (!map.size) {
    [
      { key: 'colazione', icon: '🥣', name: 'Colazione', label: '🥣 Colazione' },
      { key: 'pranzo', icon: '🍽️', name: 'Pranzo', label: '🍽️ Pranzo' },
      { key: 'cena', icon: '🍳', name: 'Cena', label: '🍳 Cena' },
      { key: 'spuntino', icon: '⚡', name: 'Spuntino', label: '⚡ Spuntino' },
    ].forEach(option => map.set(option.key, option));
  }
  return map;
}

function renderPiano() {
  if (!S.templates) S.templates = [];
  const pianoUi = typeof ensurePianoUiState === 'function'
    ? ensurePianoUiState()
    : { activeMealFilter: 'all', templateSort: 'useful_now', helperExpanded: true };
  const activeMealFilter = pianoUi.activeMealFilter || 'all';
  const mealTypeCounts = typeof getTemplateCountsByMealType === 'function'
    ? getTemplateCountsByMealType(S.templates || [])
    : {};
  const filteredTemplates = typeof filterTemplatesByMealType === 'function'
    ? filterTemplatesByMealType(S.templates || [], activeMealFilter)
    : (S.templates || []);
  const helperEl = document.getElementById('meal-planner-helper');
  if (helperEl) {
    helperEl.innerHTML = pianoComingSoonCardHTML('helper');
  }
  const favoriteFoodsEl = document.getElementById('piano-favorite-foods');
  if (favoriteFoodsEl) {
    favoriteFoodsEl.innerHTML = pianoComingSoonCardHTML('foods');
  }
  if (document.getElementById('tmpl-form')?.style.display === 'block' && typeof renderTmplMealTypePills === 'function') {
    renderTmplMealTypePills();
  }

  const filtersEl = document.getElementById('tmpl-filters');
  filtersEl.innerHTML = '';
  const mealMetaMap = getTemplateMealMetaMap();
  const FILTERS = [
    { key: 'all', label: 'Tutti' },
    ...Array.from(mealMetaMap.values()).map(option => ({ key: option.key, label: option.label })),
  ];
  FILTERS.forEach(filter => {
    const btn = document.createElement('button');
    const count = filter.key === 'all'
      ? (S.templates || []).length
      : (mealTypeCounts[filter.key] || 0);
    btn.className = 'piano-meal-filter' + (activeMealFilter === filter.key ? ' active' : '');
    btn.innerHTML = `<span>${filter.label}</span><strong>${count}</strong>`;
    btn.addEventListener('click', () => setPianoMealFilter(filter.key));
    filtersEl.appendChild(btn);
  });

  const listEl = document.getElementById('tmpl-list');
  if (!filteredTemplates.length) {
    listEl.innerHTML = `<div class="piano-template-section piano-template-section-compact"><div class="tmpl-empty-state">${
      S.templates.length
        ? 'Con questo filtro non c e ancora niente. Prova un altro filtro o salva un nuovo template.'
        : 'Non hai ancora template. Salva i pasti che ripeti e li ritroverai qui.'
    }</div></div>`;
    return;
  }

  const renderTemplateCard = t => {
    const macros = typeof computeTemplateMacros === 'function'
      ? computeTemplateMacros(t.items || [])
      : { k: 0, p: 0, c: 0, f: 0 };
    const templateMealTypes = typeof normalizeTemplateMealTypes === 'function'
      ? normalizeTemplateMealTypes(t)
      : [t.mealType || t.tag || ''].filter(Boolean);
    const typeBadges = templateMealTypes.map(mealType => {
      const meta = mealMetaMap.get(mealType);
      const label = meta?.label || mealType;
      return `<span class="tmpl-type-badge">${htmlEsc(label)}</span>`;
    }).join('');
    const itemCount = (t.items || []).length;
    const itemNames = (t.items || [])
      .map(item => String(item.name || '').trim())
      .filter(Boolean);
    const visibleNames = itemNames.slice(0, 2);
    const extraCount = Math.max(0, itemNames.length - visibleNames.length);
    const summary = visibleNames.join(' · ');
    const detailLines = (t.items || []).map(item => {
      const grams = Number(item.grams || 0) || 0;
      return `<div class="tmpl-detail-line"><span class="tmpl-detail-name">${htmlEsc(item.name || 'Ingrediente')}</span><span class="tmpl-detail-grams">${grams} g</span></div>`;
    }).join('');
      return `<div class="tmpl-card tmpl-card-compact">
      <div class="tmpl-card-compact-main">
        <div class="tmpl-card-topline">
          ${typeBadges}
          <span class="tmpl-card-count">${itemCount} alimenti</span>
        </div>
        <span class="tmpl-card-name">${htmlEsc(t.name)}</span>
        <div class="tmpl-card-macros tmpl-card-macros-compact">
          <span class="tmpl-macro-kcal">${macros.k} kcal</span>
          <span class="tmpl-macro-dot">·</span>
          <span>P ${macros.p.toFixed(0)}g</span>
          <span class="tmpl-macro-dot">·</span>
          <span>C ${macros.c.toFixed(0)}g</span>
          <span class="tmpl-macro-dot">·</span>
          <span>G ${macros.f.toFixed(0)}g</span>
        </div>
        ${summary ? `<div class="tmpl-card-summary">${htmlEsc(summary)}${extraCount ? ` · +${extraCount}` : ''}</div>` : ''}
        ${detailLines ? `<button class="tmpl-detail-toggle" onclick="toggleTemplateCardDetails('${t.id}', ${extraCount > 0 ? 'true' : 'false'})" aria-expanded="false" id="tmpl-detail-toggle-${t.id}">${extraCount > 0 ? 'Mostra tutti' : 'Dettagli'}</button>` : ''}
        ${detailLines ? `<div class="tmpl-detail-list" id="tmpl-detail-${t.id}" style="display:none">${detailLines}</div>` : ''}
      </div>
      <div class="tmpl-card-actions tmpl-card-actions-compact">
        <button class="tmpl-btn-load" onclick="loadTemplateToLog('${t.id}')">Usa</button>
        <button class="tmpl-btn-sec tmpl-btn-icon" onclick="editTemplate('${t.id}')" title="Modifica template" aria-label="Modifica template">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="tmpl-btn-sec tmpl-btn-icon" onclick="deleteTemplate('${t.id}')" title="Elimina template" aria-label="Elimina template">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
  };
  const activeFilterLabel = activeMealFilter === 'all'
    ? 'tutti i pasti'
    : (mealMetaMap.get(activeMealFilter)?.label || activeMealFilter);
  const visibleCountLabel = filteredTemplates.length === 1 ? '1 template visibile' : `${filteredTemplates.length} template visibili`;

  listEl.innerHTML = `
    <div class="tmpl-rail-shell">
      <div class="tmpl-rail-head">
        <div class="tmpl-rail-title">Template per ${activeFilterLabel}</div>
        <span class="piano-template-pill">${visibleCountLabel}</span>
      </div>
      <div class="tmpl-vertical-rail">${filteredTemplates.map(renderTemplateCard).join('')}</div>
    </div>`;
}

function toggleTemplateCardDetails(id, hasHiddenItems = false) {
  const body = document.getElementById(`tmpl-detail-${id}`);
  const btn = document.getElementById(`tmpl-detail-toggle-${id}`);
  if (!body || !btn) return;
  const opening = body.style.display === 'none';
  body.style.display = opening ? 'grid' : 'none';
  btn.textContent = opening ? 'Nascondi dettagli' : (hasHiddenItems ? 'Mostra tutti' : 'Dettagli');
  btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
}

function mealPlannerHelperHTML(type, plannerState) {
  const mealIdx = typeof plannerState.mealIdx === 'number' ? plannerState.mealIdx : 0;
  const meal = S.meals[type]?.[mealIdx];
  const target = meal ? getMealPlannerTarget(type, mealIdx) : null;
  const mealState = getCurrentMealState(type, S.selDate || localDate());
  const isCurrent = mealState?.key === mealIdx && !mealState?.isExtra && (mealState.kind === 'now' || mealState.kind === 'next');
  const mealStateLabel = !isCurrent ? 'Pasto selezionato' : (mealState.kind === 'now' ? 'Pasto del momento' : 'Prossimo pasto');
  const mealType = getMealTypeFromName(meal?.name || '');
  const favoriteFoods = typeof normalizeFavoriteFoods === 'function'
    ? normalizeFavoriteFoods(S.favoriteFoods || [])
    : (S.favoriteFoods || []);
  const selectedFavoriteFoodIds = Array.isArray(plannerState.selectedFavoriteFoodIds)
    ? plannerState.selectedFavoriteFoodIds
    : [];
  const eligibility = mealType && typeof getMealHelperEligibility === 'function'
    ? getMealHelperEligibility({ mealType, favoriteFoods })
    : { available: false, compatibleFoods: [], suggestions: [] };
  let generationIssue = '';
  if (mealType && eligibility.available && typeof generateMealSuggestion === 'function') {
    const generated = generateMealSuggestion({
      mealType,
      targetKcal: target?.k,
      targetMacros: target,
      favoriteFoods,
      preferredFoodIds: selectedFavoriteFoodIds,
      phase: S.goal?.phase || 'mantieni',
      context: { mealName: meal?.name || '' },
    });
    if (generated.unavailableReason) {
      plannerState.results = [];
      generationIssue = generated.unavailableReason;
    } else {
      plannerState.results = generated.suggestions.map(result => ({
        ...result,
        delta: {
          k: (result.macros.kcal || 0) - (target?.k || 0),
          p: (result.macros.p || 0) - (target?.p || 0),
          c: (result.macros.c || 0) - (target?.c || 0),
          f: (result.macros.f || 0) - (target?.f || 0),
        },
        macros: {
          kcal: result.macros.kcal || 0,
          p: result.macros.p || 0,
          c: result.macros.c || 0,
          f: result.macros.f || 0,
        },
      }));
    }
  } else {
    plannerState.results = [];
  }
  const mealButtons = (S.meals[type] || []).map((mealOpt, idx) => `
    <button class="mph-meal-chip${idx === mealIdx ? ' active' : ''}" onclick="setMealPlannerMeal('${type}', ${idx})">
      <span class="mph-meal-chip-name">${htmlEsc(mealOpt.name)}</span>
      <span class="mph-meal-chip-time">${htmlEsc(mealOpt.time || '')}</span>
    </button>
  `).join('');
  const compatibleFoods = favoriteFoods.filter(food => !mealType || isFoodCompatibleWithMeal(food, mealType));
  const coverageHighlights = Array.isArray(eligibility.coverageHighlights) ? eligibility.coverageHighlights : [];
  const helperCanWork = !!mealType && eligibility.available;
  const hasSelectionIssue = !!generationIssue;
  const helperStateClass = !mealType ? 'idle' : helperCanWork && !hasSelectionIssue ? 'ready' : 'warn';
  const helperStateLabel = !mealType
    ? 'Scegli un pasto'
    : hasSelectionIssue
      ? 'Da comporre'
      : helperCanWork
        ? 'Pronto'
        : 'Dati pochi';
  const helperStateCopy = !mealType
    ? 'Scegli prima il pasto su cui vuoi lavorare.'
    : hasSelectionIssue
      ? 'I cibi ci sono, ma questa combinazione puo venire ancora meglio.'
      : helperCanWork
      ? 'Per questo pasto posso proporti una bozza credibile.'
      : 'Per questo pasto servono ancora piu cibi adatti.';
  const helperStatusCopy = !mealType
    ? 'Scegli prima uno slot del giorno.'
    : hasSelectionIssue
      ? 'Tieni questi cibi e lascia al planner il resto.'
      : helperCanWork
      ? 'Puoi partire subito.'
      : 'Aggiungi ancora qualche cibo giusto.';
  const helperBullets = [generationIssue, ...(eligibility.suggestions || [])].filter(Boolean).slice(0, 3);
  const selectedFoods = compatibleFoods.filter(food => selectedFavoriteFoodIds.includes(food.id));
  const helperGlanceBits = [
    mealType ? `<span class="meal-planner-glance-chip strong">${htmlEsc(mealType)}</span>` : `<span class="meal-planner-glance-chip">nessun pasto</span>`,
    `<span class="meal-planner-glance-chip">${compatibleFoods.length} cibi adatti</span>`,
    selectedFoods.length ? `<span class="meal-planner-glance-chip active">${selectedFoods.length} fissati</span>` : `<span class="meal-planner-glance-chip">0 fissati</span>`,
  ].join('');
  const pinSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8l-2 5 3 3H7l3-3-2-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M12 12v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
  const resultCards = (plannerState.results || []).length
    ? plannerState.results.map((result, idx) => {
        const deltaK = Math.round(result.delta.k);
        const deltaP = Math.round(result.delta.p * 10) / 10;
        const deltaC = Math.round(result.delta.c * 10) / 10;
        const deltaF = Math.round(result.delta.f * 10) / 10;
        const scoreLabel = result.score >= 92 ? 'Molto vicino' : result.score >= 82 ? 'Buona base' : 'Da sistemare';
        const scoreTone = result.score >= 92 ? 'strong' : result.score >= 82 ? 'good' : 'soft';
        return `<div class="mph-result-card">
          <div class="mph-result-top">
            <div>
              <div class="mph-result-kicker">Proposta</div>
              <div class="mph-result-title">${htmlEsc(result.title)}</div>
              <div class="mph-result-sub">${htmlEsc(result.summary)}</div>
            </div>
            <div class="mph-score-wrap">
              <div class="mph-score-pill ${scoreTone}">${scoreLabel}</div>
            </div>
          </div>
          <div class="mph-macros">${macroVisualCardsHTML({
            k: result.macros.kcal,
            p: result.macros.p,
            c: result.macros.c,
            f: result.macros.f,
          }, { size: 'compact' })}</div>
          <div class="mph-delta">
            Scarto: ${deltaK >= 0 ? '+' : ''}${deltaK} kcal · P ${deltaP >= 0 ? '+' : ''}${deltaP}g · C ${deltaC >= 0 ? '+' : ''}${deltaC}g · F ${deltaF >= 0 ? '+' : ''}${deltaF}g
          </div>
          <div class="mph-result-footer">
            <div class="mph-items mph-items-inline">
              ${result.items.map(it => `<span class="mph-item-chip">${htmlEsc(it.name)} · ${it.grams}g</span>`).join('')}
            </div>
            <div class="mph-actions mph-actions-inline">
              <button class="mph-btn mph-btn-main" onclick="applyMealPlannerSuggestion('${type}',${idx})">Usa nel piano</button>
              <button class="mph-btn" onclick="loadMealPlannerSuggestionToToday('${type}',${idx})">Carica in Oggi</button>
              <button class="mph-btn" onclick="plannerSuggestionToTemplate('${type}',${idx})">Salva come template</button>
            </div>
          </div>
        </div>`;
      }).join('')
    : `<div class="mph-empty">
        <div class="mph-empty-title">${mealType ? (hasSelectionIssue ? 'Questa base puo venire meglio' : 'Prima servono piu cibi giusti') : 'Scegli un pasto'}</div>
        <div class="mph-empty-copy">${mealType
          ? (hasSelectionIssue
            ? `Per ${mealType} la base c e gia: con qualche scelta in piu il pasto viene molto meglio.`
            : `Per ${mealType} non ci sono ancora abbastanza cibi abituali per creare una proposta credibile.`)
          : 'Scegli lo slot del giorno e l helper ti dira subito se puo aiutarti.'}</div>
        <div class="mph-empty-list">
          ${helperBullets.length
            ? helperBullets.map(text => `<span>${htmlEsc(text)}</span>`).join('')
            : `<span>Aggiungi i primi cibi abituali e poi riprova.</span>`}
        </div>
        <div class="mph-empty-actions">
          <button class="mph-btn mph-btn-main" onclick="openProfileFavoriteFoods()">Gestisci cibi abituali</button>
        </div>
      </div>`;

  return `<div class="meal-planner-helper">
    <div class="meal-planner-head">
      <div class="meal-planner-head-main">
        <div class="meal-planner-kicker">Helper del momento</div>
        <div class="meal-planner-title-row">
          <div class="meal-planner-title">Costruisci il prossimo pasto</div>
          <span class="meal-planner-state ${helperStateClass}">${helperStateLabel}</span>
        </div>
        <div class="meal-planner-sub">${helperStateCopy}</div>
        <div class="meal-planner-glance">${helperGlanceBits}</div>
      </div>
      ${target ? `<div class="meal-planner-target-card">
        <div class="meal-planner-target-kicker">Target pasto</div>
        <div class="meal-planner-target">${macroVisualCardsHTML(target, { size: 'compact' })}</div>
      </div>` : ''}
    </div>
    <div class="meal-planner-grid">
      <div class="meal-planner-controls">
        <div class="meal-planner-focus-row">
          <div class="meal-planner-focus">
            <div class="meal-planner-focus-kicker">${mealStateLabel}</div>
            <div class="meal-planner-focus-title">${htmlEsc(meal?.name || 'Pasto')}</div>
            <div class="meal-planner-focus-meta">${htmlEsc(meal?.time || '')}${mealType ? ` · ${mealType}` : ''}</div>
          </div>
          <div class="meal-planner-status-card">
            <div class="meal-planner-status-kicker">Stato dati</div>
            <div class="meal-planner-status-line">${mealType ? `${compatibleFoods.length} cibi adatti a questo pasto` : 'Prima scegli il pasto'}</div>
            <div class="meal-planner-status-copy">${helperStatusCopy}</div>
            ${coverageHighlights.length ? `<div class="meal-planner-coverage">
              ${coverageHighlights.map(item => `<span class="meal-planner-coverage-chip ${item.ready ? 'ready' : item.required ? 'missing' : 'optional'}">${htmlEsc(item.label)}</span>`).join('')}
            </div>` : ''}
          </div>
        </div>
        <div class="mph-chip-group mph-chip-group-meals">
          <div class="mph-chip-label">Pasto</div>
          <div class="mph-meal-chip-row">${mealButtons}</div>
        </div>
        ${compatibleFoods.length ? `<div class="mph-chip-group">
          <div class="mph-chip-label">Usa adesso</div>
          <div class="mph-helper-copy">Scegli fino a 3 cibi che vuoi tenere dentro. Il planner completera il resto da solo.</div>
          <div class="mph-inline-row">
            ${compatibleFoods
              .slice(0, 8)
              .map(food => {
                const active = selectedFavoriteFoodIds.includes(food.id);
                return `<button class="mph-chip-btn mph-chip-btn-min${active ? ' active' : ''}" onclick="toggleMealPlannerFavoriteFood('${type}','${food.id}')" title="${active ? 'Cibo fissato nella bozza' : 'Aggiungi questo cibo alla bozza'}">${active ? `<span class="mph-chip-pin" aria-hidden="true">${pinSvg}</span>` : ''}<span>${htmlEsc(food.name)}</span></button>`;
              }).join('')}
          </div>
          ${selectedFoods.length ? `<div class="mph-helper-copy">Fissati: ${selectedFoods.map(food => htmlEsc(food.name)).join(' · ')}</div>` : ''}
        </div>` : ''}
        <div class="mph-actions-panel">
          <div class="mph-actions-kicker">Per migliorarlo</div>
          <div class="mph-helper-copy">${helperBullets.length
            ? helperBullets.map(text => htmlEsc(text)).join(' · ')
            : 'Aggiungi piu cibi abituali adatti ai diversi pasti della giornata.'}</div>
          <div class="mph-cta-row">
            <button class="mph-btn" onclick="openProfileFavoriteFoods()">Gestisci cibi abituali</button>
          </div>
        </div>
      </div>
      <div class="meal-planner-results">${resultCards}</div>
    </div>
  </div>`;
}
function renderOnDaysPicker() {
  const el = document.getElementById('ondays-picker');
  if (!el) return;
  const NAMES = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  el.style.cssText = 'display:flex;gap:5px;flex-wrap:nowrap';
  el.innerHTML = NAMES.map((n,i) => {
    const isOn = S.onDays.includes(i);
    return `<button onclick="toggleOnDay(${i})" class="onday-btn${isOn?' onday-on':''}">${n}</button>`;
  }).join('');
}
function altEntryHTML(altKey, j, a) {
  const edId = `aentry-${altKey}-${j}`;
  return `<div class="alt-entry" id="${edId}">
    <div class="alt-entry-head" onclick="toggleAltEntry('${edId}')">
      <span class="alt-entry-label">${a.label} · ${a.ingr.length > 50 ? a.ingr.slice(0,50)+'…' : a.ingr}</span>
      <div class="alt-entry-pills">
        <span class="pill pk" style="font-size:9px">${a.kcal} kcal</span>
        <span class="pill pp" style="font-size:9px">P ${a.p}g</span>
      </div>
      <button class="alt-entry-del" onclick="event.stopPropagation();deleteAlt('${altKey}',${j})" title="Elimina">✕ </button>
      <span class="alt-entry-chev">› </span>
    </div>
    <div class="alt-entry-body" id="aeb-${edId}">
      <div class="ae-field">
        <label>Nome variante</label>
        <input value="${esc(a.label)}" oninput="S.alts['${altKey}'][${j}].label=this.value;rerender()">
      </div>
      <div class="ae-field">
        <label>Ingredienti</label>
        <textarea rows="2" oninput="S.alts['${altKey}'][${j}].ingr=this.value;rerender()">${esc(a.ingr)}</textarea>
      </div>
      <div class="ae-macro">
        <div class="ae-mf"><label style="color:var(--on)">Kcal</label>
          <input type="number" value="${a.kcal}" oninput="S.alts['${altKey}'][${j}].kcal=+this.value;rerender()">
        </div>
        <div class="ae-mf"><label style="color:var(--blue)">P (g)</label>
          <input type="number" value="${a.p}" oninput="S.alts['${altKey}'][${j}].p=+this.value;rerender()">
        </div>
        <div class="ae-mf"><label style="color:var(--amber)">C (g)</label>
          <input type="number" value="${a.c}" oninput="S.alts['${altKey}'][${j}].c=+this.value;rerender()">
        </div>
        <div class="ae-mf"><label style="color:var(--red)">F (g)</label>
          <input type="number" value="${a.f}" oninput="S.alts['${altKey}'][${j}].f=+this.value;rerender()">
        </div>
      </div>
    </div>
  </div>`;
}
function parseWeightLogDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3], 12);
  const itMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (itMatch) return new Date(+itMatch[3], +itMatch[2] - 1, +itMatch[1], 12);
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStatsRangeBounds(range) {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  let start = new Date(end);
  let label = 'Ultimi 30 giorni';

  if (range === '7d') {
    start.setDate(end.getDate() - 6);
    label = 'Ultimi 7 giorni';
  } else if (range === '30d') {
    start.setDate(end.getDate() - 29);
    label = 'Ultimi 30 giorni';
  } else if (range === '8w') {
    start.setDate(end.getDate() - 55);
    label = 'Ultime 8 settimane';
  } else {
    label = 'Panoramica completa';
    const candidates = [];
    (S.weightLog || []).forEach(entry => {
      const parsed = parseWeightLogDate(entry.date);
      if (parsed) candidates.push(parsed);
    });
    (S.measurements || []).forEach(entry => {
      if (entry?.date) candidates.push(new Date(entry.date + 'T12:00:00'));
    });
    Object.keys(S.doneByDate || {}).forEach(key => candidates.push(new Date(key + 'T12:00:00')));
    start = candidates.length
      ? new Date(Math.min(...candidates.map(d => d.getTime())))
      : new Date(end);
  }

  start.setHours(12, 0, 0, 0);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return { range, label, start, end, days };
}

function getPreviousRangeBounds(bounds) {
  if (!bounds || bounds.range === 'all') return null;
  const prevEnd = new Date(bounds.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(12, 0, 0, 0);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (bounds.days - 1));
  prevStart.setHours(12, 0, 0, 0);
  return { start: prevStart, end: prevEnd, days: bounds.days };
}

function getWeightEntriesForBounds(bounds) {
  return (S.weightLog || [])
    .map((entry, idx) => {
      const dt = parseWeightLogDate(entry.date);
      return dt ? {
        ...entry,
        srcIndex: idx,
        dt,
        dateKey: localDate(dt),
        shortLabel: String(entry.date || '').slice(0, 5),
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dt - b.dt)
    .filter(entry => entry.dt >= bounds.start && entry.dt <= bounds.end);
}

function getRollingWeightValues(entries, windowSize = 3) {
  return entries.map((entry, idx) => {
    const slice = entries.slice(Math.max(0, idx - windowSize + 1), idx + 1);
    return {
      dt: entry.dt,
      val: slice.reduce((sum, item) => sum + item.val, 0) / slice.length,
    };
  });
}

function getCompletionStatsForBounds(bounds) {
  let activeDays = 0;
  let fullDays = 0;
  let partialDays = 0;
  let emptyDays = 0;
  let hydrationDays = 0;
  let supplementDays = 0;
  let onDays = 0;
  let offDays = 0;
  let mealDoneTotal = 0;
  let mealTargetTotal = 0;
  let weekendActiveDays = 0;
  let weekendDays = 0;

  const cursor = new Date(bounds.start);
  while (cursor <= bounds.end) {
    const key = localDate(cursor);
    const info = S.doneByDate?.[key];
    const hasActivity = !!info?.hasActivity;
    const isFull = !!(info && info.total > 0 && info.done >= info.total);
    const trackedType = info?.type || getScheduledDayType(key);
    const dow = cursor.getDay();

    if (trackedType === 'on') onDays++;
    if (trackedType === 'off') offDays++;
    if (hasActivity) activeDays++;
    if (isFull) fullDays++;
    else if (hasActivity) partialDays++;
    else emptyDays++;
    if ((info?.waterCount || 0) > 0) hydrationDays++;
    if ((info?.suppDone || 0) > 0) supplementDays++;
    mealDoneTotal += info?.done || 0;
    mealTargetTotal += info?.total || 0;
    if (dow === 0 || dow === 6) {
      weekendDays++;
      if (hasActivity) weekendActiveDays++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDays = bounds.days;
  return {
    totalDays,
    activeDays,
    fullDays,
    partialDays,
    emptyDays,
    adherenceRate: totalDays ? Math.round(activeDays / totalDays * 100) : 0,
    hydrationRate: totalDays ? Math.round(hydrationDays / totalDays * 100) : 0,
    supplementRate: totalDays ? Math.round(supplementDays / totalDays * 100) : 0,
    mealRate: mealTargetTotal ? Math.round(mealDoneTotal / mealTargetTotal * 100) : 0,
    weekendAdherenceRate: weekendDays ? Math.round(weekendActiveDays / weekendDays * 100) : 0,
    onDays,
    offDays,
  };
}

function getMeasurementsForBounds(bounds) {
  return (S.measurements || [])
    .map((entry, idx) => ({
      ...entry,
      _idx: idx,
      _dt: entry?.date ? new Date(entry.date + 'T12:00:00') : null,
    }))
    .filter(entry => entry._dt && entry._dt >= bounds.start && entry._dt <= bounds.end)
    .sort((a, b) => a._dt - b._dt);
}

function getMeasurementSnapshot(entries, key) {
  const withValue = entries.filter(entry => entry[key] != null);
  if (!withValue.length) return { first: null, last: null, delta: null };
  const first = withValue[0];
  const last = withValue[withValue.length - 1];
  const delta = first !== last ? +(last[key] - first[key]).toFixed(1) : null;
  return { first, last, delta };
}

function getMeasurementReading(key, delta, phase) {
  if (delta == null) return 'serve una seconda rilevazione';
  if (Math.abs(delta) < 0.2) return 'quasi stabile nel periodo';
  if (key === 'vita' && phase === 'cut' && delta < 0) return 'segnale positivo in cut';
  if (key === 'vita' && phase === 'bulk' && delta <= 0.5) return 'vita sotto controllo';
  if (key === 'braccio' && phase === 'bulk' && delta > 0) return 'crescita moderata';
  if (key === 'petto' && delta > 0) return 'volume in aumento';
  if (delta < 0) return 'riduzione nel periodo';
  return 'variazione da monitorare';
}

function getMeasurementsInsight(phase, weightDelta, deltas) {
  const vitaDelta = deltas.vita?.delta;
  if (phase === 'cut' && (weightDelta || 0) < 0 && vitaDelta != null && vitaDelta < 0) {
    return 'Peso e vita scendono insieme nel periodo: il segnale e coerente con una perdita guidata piu dalla composizione che dal caso.';
  }
  if (phase === 'bulk' && (weightDelta || 0) > 0 && vitaDelta != null && vitaDelta <= 0.5) {
    return 'Il peso sale senza una crescita marcata della vita: per ora il bulk resta sotto controllo.';
  }
  if (vitaDelta != null && vitaDelta > 1) {
    return 'La vita sta salendo in modo piu evidente delle altre misure: e il primo punto da monitorare nel prossimo periodo.';
  }
  return 'Le misure corporee aggiungono contesto al peso: con piu rilevazioni nel range questa lettura diventera ancora piu utile.';
}

function computeStatsConsistencyScore(adherence, streak) {
  const adherencePart = Math.round((adherence?.adherenceRate || 0) * 0.55);
  const mealPart = Math.round((adherence?.mealRate || 0) * 0.2);
  const hydrationPart = Math.round((adherence?.hydrationRate || 0) * 0.1);
  const supplementPart = Math.round((adherence?.supplementRate || 0) * 0.05);
  const streakPart = Math.round((Math.min(14, Math.max(0, streak || 0)) / 14) * 100 * 0.1);
  return Math.max(0, Math.min(100, adherencePart + mealPart + hydrationPart + supplementPart + streakPart));
}

function getStatsScoreLabel(score) {
  if (score >= 85) return 'Ottimo';
  if (score >= 70) return 'Buono';
  if (score >= 55) return 'Da consolidare';
  return 'Instabile';
}

function getWeightInsight(weight, adherenceRate) {
  if (!weight.count) return 'Mancano pesate nel periodo selezionato, quindi la lettura del trend e ancora da costruire.';
  if (weight.count === 1) return 'C e una sola pesata nel periodo: utile come riferimento, ma non basta ancora per leggere un trend affidabile.';
  if (Math.abs(weight.delta || 0) < 0.3) return 'Il peso e sostanzialmente stabile nel periodo: bene se sei in mantenimento, da monitorare se vuoi un cambio piu netto.';
  if (S.goal?.phase === 'cut' && (weight.delta || 0) < 0) return 'Il peso sta scendendo in modo coerente con una fase di cut, senza oscillazioni anomale.';
  if (S.goal?.phase === 'bulk' && (weight.delta || 0) > 0) return 'Il trend e in salita e resta coerente con una fase di bulk.';
  if (adherenceRate < 45) return 'Il trend esiste, ma la costanza del periodo e troppo bassa per leggerlo con grande fiducia.';
  return 'Il peso si sta muovendo nel periodo, ma va letto insieme a misure e aderenza prima di trarre conclusioni.';
}

function getStatsHero(data) {
  const prevAdh = data.previous?.adherence?.adherenceRate ?? null;
  const adherenceTrend = prevAdh == null ? null : data.adherence.adherenceRate - prevAdh;
  const phase = S.goal?.phase || 'mantieni';
  const weightDelta = data.weight.delta || 0;

  if (!data.weight.count && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'soft',
      title: 'Costanza buona, ma trend peso ancora da costruire',
      body: 'Stai alimentando abbastanza dati di aderenza. Serve solo piu continuita nelle pesate per trasformare la tab in una lettura davvero utile.',
    };
  }
  if (phase === 'cut' && weightDelta < -0.3 && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'ok',
      title: 'Trend coerente con la fase di cut',
      body: 'Il peso si sta muovendo nella direzione attesa e il livello di aderenza sostiene il segnale.',
    };
  }
  if (phase === 'bulk' && weightDelta > 0.3 && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'ok',
      title: 'Peso in crescita coerente con il bulk',
      body: 'Il periodo mostra sia movimento sul peso sia una base di costanza abbastanza solida da renderlo leggibile.',
    };
  }
  if (data.adherence.adherenceRate < 45) {
    return {
      tone: 'warn',
      title: 'Il collo di bottiglia ora e la costanza',
      body: 'Prima di interpretare troppo il fisico, conviene rendere piu regolare il comportamento quotidiano nel piano.',
    };
  }
  if (adherenceTrend != null && adherenceTrend >= 10) {
    return {
      tone: 'ok',
      title: 'Le ultime settimane mostrano piu solidita',
      body: 'L aderenza e migliorata rispetto al periodo precedente, quindi i prossimi dati avranno piu valore decisionale.',
    };
  }
  return {
    tone: 'soft',
    title: 'Panoramica stabile, con segnali da consolidare',
    body: 'La base dati e gia utile. Il prossimo salto di qualita verra da continuita nelle pesate e dal confronto con le misure corporee.',
  };
}

function getStatsDailyLogTotals(dateKey) {
  const dayLog = S.foodLog?.[dateKey] || {};
  return Object.values(dayLog).reduce((acc, items) => {
    if (!Array.isArray(items)) return acc;
    items.forEach(item => {
      const grams = Number(item?.grams || 0) / 100;
      acc.k += Math.round((Number(item?.kcal100 || 0) || 0) * grams);
      acc.p += (Number(item?.p100 || 0) || 0) * grams;
      acc.c += (Number(item?.c100 || 0) || 0) * grams;
      acc.f += (Number(item?.f100 || 0) || 0) * grams;
    });
    return acc;
  }, { k: 0, p: 0, c: 0, f: 0 });
}

function getStatsMacroSummary(bounds) {
  const days = [];
  const cursor = new Date(bounds.start);
  while (cursor <= bounds.end) {
    const key = localDate(cursor);
    const type = typeof resolveDayTypeForDate === 'function'
      ? resolveDayTypeForDate(key)
      : getTrackedDayType(key, getScheduledDayType(key));
    const totals = getStatsDailyLogTotals(key);
    const targetK = typeof getEffectiveKcalTarget === 'function'
      ? getEffectiveKcalTarget(key, type)
      : (S.macro?.[type]?.k || 0);
    const hasLog = totals.k > 0;
    const deltaK = hasLog && targetK ? Math.round(totals.k - targetK) : null;
    const isAligned = deltaK != null && Math.abs(deltaK) <= Math.max(180, Math.round(targetK * 0.12));
    days.push({
      key,
      type,
      targetK,
      totals,
      deltaK,
      hasLog,
      isAligned,
      info: S.doneByDate?.[key] || null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const loggedDays = days.filter(day => day.hasLog);
  const onLogged = loggedDays.filter(day => day.type === 'on');
  const offLogged = loggedDays.filter(day => day.type === 'off');
  const avg = list => list.length
    ? Math.round(list.reduce((sum, day) => sum + day.totals.k, 0) / list.length)
    : null;
  return {
    days,
    loggedDays: loggedDays.length,
    kcalAlignedDays: loggedDays.filter(day => day.isAligned).length,
    avgLoggedKcal: avg(loggedDays),
    avgOnKcal: avg(onLogged),
    avgOffKcal: avg(offLogged),
    onLoggedDays: onLogged.length,
    offLoggedDays: offLogged.length,
  };
}

function getStatsDataCoverage(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const measurementSnapshots = Object.values(data.measurements?.deltas || {});
  const readableMeasurementDeltas = measurementSnapshots.filter(snapshot => snapshot?.delta != null).length;
  const weightReliable = data.weight.count >= 2;
  const weightStrong = data.weight.count >= 3;
  const measuresReadable = data.measurements.count >= 2 && readableMeasurementDeltas >= 1;
  const behaviorReadable =
    data.adherence.activeDays >= Math.max(4, Math.round(data.bounds.days * 0.35))
    || data.macro.loggedDays >= Math.max(3, Math.round(data.bounds.days * 0.25));
  const recoveryReadable =
    (data.adherence.onDays + data.adherence.offDays) >= Math.max(6, Math.round(data.bounds.days * 0.45))
    && (data.adherence.activeDays >= Math.max(4, Math.round(data.bounds.days * 0.25)) || data.macro.loggedDays >= 3);
  const physicalReadable = weightReliable && measuresReadable;
  const quality = physicalReadable
    ? (weightStrong && readableMeasurementDeltas >= 2 ? 'forte' : 'utile')
    : (behaviorReadable || recoveryReadable ? 'utile' : 'iniziale');
  return {
    weightReliable,
    weightStrong,
    measuresReadable,
    readableMeasurementDeltas,
    physicalReadable,
    behaviorReadable,
    recoveryReadable,
    quality,
  };
}

function getStatsPrimaryModule(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const coverage = data.coverage || getStatsDataCoverage(range, data);
  if (coverage.physicalReadable) return 'physical';
  if (coverage.recoveryReadable && coverage.behaviorReadable) return 'recovery';
  if (coverage.behaviorReadable) return 'behavior';
  if (coverage.recoveryReadable) return 'recovery';
  return 'behavior';
}

function getStatsNextBestAction(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const coverage = data.coverage || getStatsDataCoverage(range, data);
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  if (!coverage.weightReliable) {
    return {
      title: 'Metti dentro 2-3 pesate',
      body: 'Con un minimo di continuita il fisico smette di essere rumoroso e la lettura diventa molto piu concreta.',
      ctaLabel: 'Aggiungi peso',
      onClick: `openStatsQuickAction('stats-actions-weight-form-shell','w-in')`,
      icon: '⚖️',
    };
  }
  if (!coverage.measuresReadable) {
    return {
      title: 'Completa una seconda rilevazione misure',
      body: 'Basta poco per capire se il peso si sta muovendo insieme alla composizione oppure no.',
      ctaLabel: 'Nuova rilevazione',
      onClick: 'openMeasurementEntry()',
      icon: '📏',
    };
  }
  if (data.adherence.hydrationRate <= 45 && data.adherence.activeDays >= 4) {
    return {
      title: 'Rendi piu stabile l acqua',
      body: 'Tra i segnali del periodo e il comportamento che cede per primo: sistemarlo pulisce tutto il resto.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '💧',
    };
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    return {
      title: 'Proteggi meglio il weekend',
      body: 'Il ritmo si rompe soprattutto li: basta ridurre lo scarto per dare piu stabilita a tutto il periodo.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '📅',
    };
  }
  if (alignmentRate && alignmentRate < 45) {
    return {
      title: 'Allinea meglio le kcal ai giorni attivi',
      body: 'Il comportamento c e, ma il ritmo calorico e ancora poco coerente tra giornate diverse.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '🔥',
    };
  }
  return {
    title: 'Rivedi il quadro e poi resta regolare',
    body: 'Hai gia abbastanza dati: adesso il vantaggio arriva dal tenere il ritmo, non dall aggiungere complessita.',
    ctaLabel: 'Apri profilo',
    onClick: `goView('profilo')`,
    icon: '🧭',
  };
}

function getStatsHeroAction(range = (S.statsRange || '30d'), primaryModule = null, resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const moduleKey = primaryModule || data.primaryModule || getStatsPrimaryModule(range, data);
  const nextAction = data.nextAction || getStatsNextBestAction(range, data);
  const moduleLabel = moduleKey === 'physical'
    ? 'peso + misure'
    : moduleKey === 'recovery'
      ? 'allenamento + recovery'
      : 'aderenza + routine';
  return {
    label: `Focus attivo: ${moduleLabel}`,
    body: `In questo periodo il segnale piu leggibile arriva da ${moduleLabel}. ${nextAction.body}`,
  };
}

function getStatsBehaviorSummary(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  if (data.adherence.activeDays < Math.max(4, Math.round(data.bounds.days * 0.25))) {
    return {
      title: 'Il ritmo c e solo a tratti',
      body: 'Prima di leggere troppo i dettagli conviene semplicemente dare piu continuita ai giorni registrati.',
      coach: 'La priorita non e essere perfetto: e rendere il periodo abbastanza leggibile da fidarti della dashboard.',
      weakestLabel: 'Giorni attivi',
      weakestValue: `${data.adherence.activeDays}/${data.adherence.totalDays}`,
      alignmentRate,
    };
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    return {
      title: 'La settimana regge, il weekend rompe il ritmo',
      body: 'Il comportamento nei giorni feriali e gia abbastanza solido: il punto vero da sistemare e il passaggio al weekend.',
      coach: 'Difendere 1-2 decisioni chiave nel weekend vale piu che inseguire la precisione ogni giorno.',
      weakestLabel: 'Weekend',
      weakestValue: `${data.adherence.weekendAdherenceRate}%`,
      alignmentRate,
    };
  }
  if (data.adherence.hydrationRate <= 45) {
    return {
      title: 'La routine piu fragile resta l acqua',
      body: 'Il resto del piano tiene meglio dell idratazione: sistemare quello rende la giornata piu pulita e prevedibile.',
      coach: 'Quando l acqua parte bene, spesso anche il resto della routine diventa piu facile da seguire.',
      weakestLabel: 'Acqua',
      weakestValue: `${data.adherence.hydrationRate}%`,
      alignmentRate,
    };
  }
  if (alignmentRate && alignmentRate < 45) {
    return {
      title: 'Le giornate ci sono, ma il ritmo kcal e ancora irregolare',
      body: 'Stai registrando abbastanza, pero le kcal restano spesso troppo lontane dal riferimento del giorno.',
      coach: 'Qui non serve piu controllo: serve una chiusura piu semplice e ripetibile nei giorni in cui resti indietro.',
      weakestLabel: 'Kcal in linea',
      weakestValue: `${alignmentRate}%`,
      alignmentRate,
    };
  }
  return {
    title: 'La routine e abbastanza leggibile',
    body: 'Il periodo mostra un comportamento gia utile da leggere: ora il margine viene dal consolidare i punti meno automatici.',
    coach: 'Quando la routine tiene, anche il fisico diventa molto piu semplice da interpretare.',
    weakestLabel: 'Giorni completi',
    weakestValue: `${data.adherence.fullDays}`,
    alignmentRate,
  };
}

function getStatsRecoverySummary(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const onOffDiff = (data.macro.avgOnKcal != null && data.macro.avgOffKcal != null)
    ? data.macro.avgOnKcal - data.macro.avgOffKcal
    : null;
  const theoreticalOnPct = Math.round((S.onDays?.length || 0) / 7 * 100);
  const actualOnPct = Math.round(data.adherence.onDays / Math.max(1, data.adherence.onDays + data.adherence.offDays) * 100);
  if (onOffDiff != null && onOffDiff >= 120) {
    return {
      title: 'ON e OFF hanno una separazione energetica leggibile',
      body: 'Le giornate di allenamento ricevono piu energia delle rest: il setup e abbastanza coerente con il ritmo settimanale.',
      coach: 'Mantieni semplice questa differenza: e uno dei segnali pratici piu utili che hai gia dentro l app.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  if (onOffDiff != null && onOffDiff < 80) {
    return {
      title: 'ON e OFF oggi si assomigliano troppo',
      body: 'Il ritmo settimanale c e, ma dal lato kcal le giornate stanno diventando troppo piatte per aiutarti davvero.',
      coach: 'Non serve estremizzare: basta rendere un po piu netta la differenza tra allenamento e recupero.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  if (data.adherence.onDays < 2 || data.adherence.offDays < 2) {
    return {
      title: 'Il recupero e ancora poco leggibile nel periodo scelto',
      body: 'Ci sono ancora pochi giorni ON/OFF distinti per capire se il ritmo settimanale ti sta aiutando davvero.',
      coach: 'Con qualche giornata in piu la lettura ON/OFF diventa molto piu concreta.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  return {
    title: 'Il ritmo allenamento-recupero e presente ma non ancora forte',
    body: 'La distribuzione settimanale e leggibile, ma il beneficio pratico dipende da quanto riesci a farla sentire anche nella routine.',
    coach: 'Qui conta piu la coerenza che la precisione: ON e OFF devono essere diversi in modo semplice.',
    onOffDiff,
    theoreticalOnPct,
    actualOnPct,
  };
}

function getStatsPatterns(data) {
  const patterns = [];
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  const onOffDiff = (data.macro.avgOnKcal != null && data.macro.avgOffKcal != null)
    ? data.macro.avgOnKcal - data.macro.avgOffKcal
    : null;
  if (data.primaryModule === 'physical') {
    if ((S.goal?.phase === 'cut') && (data.weight.delta || 0) < 0 && data.measurements.deltas.vita?.delta != null && data.measurements.deltas.vita.delta < 0) {
      patterns.push('Peso e vita scendono insieme: il segnale del periodo e pulito, quindi non complicare quello che sta gia funzionando.');
    } else if ((S.goal?.phase === 'bulk') && (data.weight.delta || 0) > 0 && data.measurements.deltas.vita?.delta != null && data.measurements.deltas.vita.delta <= 0.5) {
      patterns.push('Il bulk sta salendo senza allargare troppo la vita: il setup e sotto controllo piu di quanto sembri.');
    } else {
      patterns.push('Il fisico e finalmente leggibile: usa questa finestra per confermare il trend, non per inseguire micro-correzioni ogni giorno.');
    }
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    patterns.push('Il punto piu chiaro da sistemare resta il weekend: difendere li il ritmo vale piu di migliorare i giorni gia solidi.');
  } else if (data.adherence.hydrationRate <= 45 && data.adherence.activeDays >= 4) {
    patterns.push('Tra i comportamenti registrati, l acqua e ancora il segnale piu instabile: e li che puoi recuperare ordine senza sforzo alto.');
  } else if (alignmentRate && alignmentRate < 45) {
    patterns.push('Stai registrando abbastanza, ma le kcal restano spesso fuori traccia: una chiusura piu semplice la sera avrebbe impatto immediato.');
  }
  if (onOffDiff != null && onOffDiff < 80 && data.primaryModule !== 'physical') {
    patterns.push('ON e OFF sono troppo simili dal lato energia: rendere piu netta quella differenza darebbe piu senso a tutto il ritmo settimanale.');
  }
  if (data.nextAction?.title) {
    patterns.push(`Priorita pratica: ${data.nextAction.title.toLowerCase()}.`);
  }
  if (!patterns.length) {
    patterns.push('La base dati e gia abbastanza coerente: il vantaggio adesso viene dal restare regolare, non dal cercare nuovi numeri.');
  }
  return [...new Set(patterns)].slice(0, 3);
}

function getStatsRangeData(range = (S.statsRange || '30d')) {
  const bounds = getStatsRangeBounds(range);
  const previousBounds = getPreviousRangeBounds(bounds);
  const weightEntries = getWeightEntriesForBounds(bounds);
  const weightVals = weightEntries.map(entry => entry.val);
  const weightCurrent = weightVals.length ? weightVals[weightVals.length - 1] : null;
  const weightStart = weightVals.length ? weightVals[0] : null;
  const weightDelta = weightVals.length > 1 ? +(weightCurrent - weightStart).toFixed(1) : null;
  const weightAverage = weightVals.length
    ? +(weightVals.reduce((sum, val) => sum + val, 0) / weightVals.length).toFixed(1)
    : null;
  const targetWeight = S.goal?.targetWeight != null ? Number(S.goal.targetWeight) : null;
  const targetDiff = (targetWeight != null && weightCurrent != null)
    ? +(weightCurrent - targetWeight).toFixed(1)
    : null;
  const adherence = getCompletionStatsForBounds(bounds);
  const previous = previousBounds ? {
    adherence: getCompletionStatsForBounds(previousBounds),
  } : null;
  const weight = {
    entries: weightEntries,
    count: weightEntries.length,
    current: weightCurrent,
    start: weightStart,
    delta: weightDelta,
    average: weightAverage,
    rolling: getRollingWeightValues(weightEntries),
    target: targetWeight,
    targetDiff,
    insight: '',
  };
  weight.insight = getWeightInsight(weight, adherence.adherenceRate);
  const avgActivePerWeek = Math.max(0, Math.min(7, Math.round(adherence.activeDays / Math.max(1, bounds.days / 7))));
  const streak = calcStreak();
  const consistencyScore = computeStatsConsistencyScore(adherence, streak);
  const macro = getStatsMacroSummary(bounds);
  const hero = getStatsHero({ bounds, weight, adherence, previous, macro });
  const measurementEntries = getMeasurementsForBounds(bounds);
  const measurementKeys = ['vita', 'fianchi', 'petto', 'braccio', 'coscia'];
  const measurements = {
    entries: measurementEntries,
    deltas: Object.fromEntries(measurementKeys.map(key => [key, getMeasurementSnapshot(measurementEntries, key)])),
  };
  measurements.count = measurementEntries.length;
  measurements.insight = getMeasurementsInsight(S.goal?.phase || 'mantieni', weight.delta, measurements.deltas);
  const data = {
    bounds,
    hero,
    weight,
    adherence,
    measurements,
    macro,
    previous,
    kpis: {
      weightValue: weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`,
      adherenceValue: `${adherence.adherenceRate}%`,
      consistencyValue: `${avgActivePerWeek}/7`,
      scoreValue: consistencyScore,
      scoreLabel: getStatsScoreLabel(consistencyScore),
    },
  };
  data.coverage = getStatsDataCoverage(range, data);
  data.primaryModule = getStatsPrimaryModule(range, data);
  data.behaviorSummary = getStatsBehaviorSummary(range, data);
  data.recoverySummary = getStatsRecoverySummary(range, data);
  data.nextAction = getStatsNextBestAction(range, data);
  data.heroAction = getStatsHeroAction(range, data.primaryModule, data);
  data.patterns = getStatsPatterns(data);
  return data;
}

function renderStatsToolbar(data) {
  const el = document.getElementById('stats-toolbar');
  if (!el) return;
  const OPTIONS = [
    { key: '7d', label: '7G' },
    { key: '30d', label: '30G' },
    { key: '8w', label: '8 SETT' },
    { key: 'all', label: 'TOTALE' },
  ];
  const focusLabel = data.primaryModule === 'physical'
    ? 'Peso e misure'
    : data.primaryModule === 'recovery'
      ? 'Allenamento e recovery'
      : 'Aderenza e routine';
  el.innerHTML = `
    <div class="stats-toolbar-card">
      <div class="stats-toolbar">
        <div class="stats-toolbar-copy support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Leggi un periodo alla volta</div>
            <span class="support-mini-state progress">${data.bounds.label}</span>
          </div>
          <div class="support-mini-sub stats-toolbar-note">In questo periodo il segnale piu utile arriva da ${focusLabel.toLowerCase()}.</div>
        </div>
        <div class="stats-toolbar-side">
          <div class="stats-toolbar-quickstats">
            <div class="stats-toolbar-stat support-mini-card">
              <span class="stats-toolbar-stat-label">Focus</span>
              <strong>${focusLabel}</strong>
            </div>
            <div class="stats-toolbar-stat support-mini-card">
              <span class="stats-toolbar-stat-label">Qualita dati</span>
              <strong>${data.coverage.quality}</strong>
            </div>
          </div>
          <div class="stats-range-chips" role="tablist" aria-label="Seleziona periodo statistiche">
            ${OPTIONS.map(opt => `
              <button class="stats-range-chip${data.bounds.range === opt.key ? ' active' : ''}" onclick="setStatsRange('${opt.key}')">${opt.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function renderStatsHero(data) {
  const el = document.getElementById('stats-summary');
  if (!el) return;
  const toneClass = data.hero.tone === 'ok' ? ' tone-ok' : data.hero.tone === 'warn' ? ' tone-warn' : '';
  const signalLabel = data.primaryModule === 'physical'
    ? 'Fisico leggibile'
    : data.primaryModule === 'recovery'
      ? 'Recovery leggibile'
      : 'Routine leggibile';
  el.innerHTML = `
    <div class="stats-hero stats-decision-hero${toneClass}">
      <div class="stats-hero-copy">
        <div class="support-mini-kicker">Stats</div>
        <div class="stats-hero-title-row">
          <div class="stats-hero-title">${data.hero.title}</div>
        </div>
        <div class="stats-hero-body support-mini-sub">${data.hero.body}</div>
        <div class="stats-hero-meta">
          <div class="stats-hero-meta-chip">Periodo · ${data.bounds.label}</div>
          <div class="stats-hero-meta-chip">Segnale · ${signalLabel}</div>
          <div class="stats-hero-meta-chip">Qualita dati · ${data.coverage.quality}</div>
        </div>
        <div class="stats-decision-strip">
          <div class="stats-decision-strip-copy">
            <div class="stats-decision-kicker">${data.heroAction.label}</div>
            <div class="stats-decision-body">${data.heroAction.body}</div>
          </div>
          <button class="stats-head-action-btn stats-hero-action-btn" onclick="${data.nextAction.onClick}">${data.nextAction.ctaLabel}</button>
        </div>
      </div>
      <div class="stats-kpis stats-kpis-decision">
        <div class="sc-card">
          <div class="sc-kicker">Priorita</div>
          <div class="sc-val">${data.nextAction.icon}</div>
          <div class="sc-lbl">${data.nextAction.title}</div>
          <div class="sc-sub">${data.nextAction.body}</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Aderenza</div>
          <div class="sc-val${data.adherence.adherenceRate >= 70 ? ' ok' : data.adherence.adherenceRate >= 45 ? ' warn' : ' err'}">${data.kpis.adherenceValue}</div>
          <div class="sc-lbl">${data.adherence.activeDays}/${data.adherence.totalDays} giorni attivi</div>
          <div class="sc-sub">quanto il periodo e leggibile nella pratica</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Ritmo</div>
          <div class="sc-val${data.kpis.scoreValue >= 70 ? ' ok' : data.kpis.scoreValue >= 55 ? ' warn' : ' err'}">${data.kpis.scoreValue}</div>
          <div class="sc-lbl">${data.kpis.scoreLabel}</div>
          <div class="sc-sub">sintesi di costanza, acqua, pasti e routine</div>
        </div>
      </div>
    </div>`;
}

function toggleWeightLog() {
  toggleStatsSection('stats-actions-weight-log-shell', true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleStatsSection(id, forceOpen = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (forceOpen) el.classList.add('open');
  else el.classList.toggle('open');
}

function openMeasurementEntry() {
  toggleStatsSection('stats-actions-measurements-form-shell', true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('m-vita')?.focus(), 180);
}

function openStatsQuickAction(panelId, focusId = '') {
  toggleStatsSection(panelId, true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 180);
}

function renderStatsPhysicalModule(data) {
  const el = document.getElementById('stats-weight');
  if (!el) return;
  const weight = data.weight;
  const vitaDelta = data.measurements.deltas.vita?.delta;
  const targetText = weight.target == null
    ? 'Aggiungi un target nel profilo per leggere meglio il trend.'
    : weight.targetDiff == null
      ? `Target impostato a ${weight.target} kg.`
      : `Distanza dal target: ${weight.targetDiff > 0 ? '+' : ''}${weight.targetDiff.toFixed(1)} kg.`;
  el.innerHTML = `
    <div class="stats-panel stats-panel-weight stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Peso + misure</div>
            <span class="support-mini-state done">segnale principale</span>
          </div>
          <div class="support-mini-sub">Qui il fisico e abbastanza popolato da dirti se il periodo sta andando nella direzione giusta.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="openStatsQuickAction('stats-actions-weight-form-shell','w-in')">Aggiungi peso</button>
          <button class="stats-inline-btn" onclick="openStatsQuickAction('stats-actions-weight-log-shell')">Cronologia peso</button>
          <button class="stats-inline-btn" onclick="openStatsQuickAction('stats-actions-measurements-log-shell')">Cronologia misure</button>
        </div>
      </div>
      <div class="stats-glance-row stats-glance-row-weight">
        <div class="stats-glance-chip"><span>Attuale</span><strong>${weight.current != null ? `${weight.current.toFixed(1)} kg` : '—'}</strong></div>
        <div class="stats-glance-chip${weight.delta != null && Math.abs(weight.delta) >= 0.3 ? ' is-accent' : ''}"><span>Trend</span><strong>${weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`}</strong></div>
        <div class="stats-glance-chip${vitaDelta != null && vitaDelta <= 0 ? ' is-accent' : ''}"><span>Vita</span><strong>${vitaDelta == null ? 'n/d' : `${vitaDelta > 0 ? '+' : ''}${vitaDelta.toFixed(1)} cm`}</strong></div>
        <div class="stats-glance-chip"><span>Rilevazioni</span><strong>${data.measurements.count}</strong></div>
      </div>
      <div class="chart-box stats-chart-box">
        <div class="stats-weight-main">
          <div class="stats-weight-chart-area">
            <canvas id="w-canvas" style="width:100%;height:180px"></canvas>
          </div>
          <div class="stats-weight-reading">
            <div class="stats-weight-reading-title">Come sta andando</div>
            <div class="stats-weight-reading-body">${weight.insight}</div>
            <div class="stats-weight-reading-note">${targetText}</div>
          </div>
        </div>
        <div class="stats-measure-strip">
          <div class="stats-measure-strip-head">
            <div class="stats-weight-reading-title">Composizione nel periodo</div>
            <button class="stats-inline-btn stats-inline-btn-soft" onclick="openMeasurementEntry()">Nuova rilevazione</button>
          </div>
          <div class="measure-cards">
            ${Object.entries({ vita:'Vita', fianchi:'Fianchi', petto:'Petto', braccio:'Braccio dx', coscia:'Coscia' }).map(([key, label]) => {
              const snapshot = data.measurements.deltas[key];
              const last = snapshot?.last?.[key];
              const delta = snapshot?.delta;
              const tone = delta == null || Math.abs(delta) < 0.2 ? '' : delta < 0 ? ' neg' : ' pos';
              return `<div class="measure-card">
                <div class="measure-card-label">${label}</div>
                <div class="measure-card-value">${last != null ? `${last.toFixed(1)} cm` : '—'}</div>
                <div class="measure-card-delta${tone}">${delta == null ? 'n/d' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} cm`}</div>
                <div class="measure-card-note">${getMeasurementReading(key, delta, S.goal?.phase || 'mantieni')}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
  drawChart(weight.entries, { targetWeight: weight.target, rolling: weight.rolling });
}

function renderStatsBehaviorModule(data, targetId = 'stats-weight') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const behavior = data.behaviorSummary;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  el.innerHTML = `
    <div class="stats-panel stats-panel-adherence stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Aderenza + routine</div>
            <span class="support-mini-state ${targetId === 'stats-weight' ? 'done' : 'pending'}">${targetId === 'stats-weight' ? 'segnale principale' : 'supporto'}</span>
          </div>
          <div class="support-mini-sub">Quando il fisico non basta ancora, qui capisci dove il piano regge e dove no.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="goView('today')">Torna a oggi</button>
        </div>
      </div>
      <div class="stats-insight-strip">
        <div class="stats-insight-title">${behavior.title}</div>
        <div class="stats-insight-body">${behavior.body}</div>
        <div class="stats-weight-reading-note">${behavior.coach}</div>
      </div>
      <div class="stats-kpis stats-kpis-adh">
        <div class="sc-card">
          <div class="sc-kicker">Completi</div>
          <div class="sc-val ok">${data.adherence.fullDays}</div>
          <div class="sc-lbl">giorni pieni</div>
          <div class="sc-sub">quelli in cui il piano ha tenuto davvero</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Kcal in linea</div>
          <div class="sc-val${alignmentRate >= 60 ? ' ok' : alignmentRate >= 40 ? ' warn' : ' err'}">${alignmentRate || 'n/d'}${alignmentRate ? '%' : ''}</div>
          <div class="sc-lbl">giorni loggati</div>
          <div class="sc-sub">quanto spesso le kcal seguono il riferimento</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">${behavior.weakestLabel}</div>
          <div class="sc-val${data.adherence.hydrationRate <= 45 ? ' warn' : ''}">${behavior.weakestValue}</div>
          <div class="sc-lbl">collo di bottiglia</div>
          <div class="sc-sub">il punto da consolidare prima degli altri</div>
        </div>
      </div>
      <div class="adherence-breakdown adherence-breakdown-rail">
        <div class="adh-chip"><span>Pasti</span><strong>${data.adherence.mealRate}%</strong></div>
        <div class="adh-chip"><span>Acqua</span><strong>${data.adherence.hydrationRate}%</strong></div>
        <div class="adh-chip"><span>Integratori</span><strong>${data.adherence.supplementRate}%</strong></div>
        <div class="adh-chip"><span>Weekend</span><strong>${data.adherence.weekendAdherenceRate}%</strong></div>
      </div>
      <div class="stats-adherence-lower">
        <div class="stats-heatmap-wrap" id="stats-heatmap"></div>
        <div class="stats-ratio-wrap" id="stats-ratio"></div>
      </div>
    </div>`;
  renderHeatmap(data);
  renderRatio(data);
}

function renderStatsRecoveryModule(data, targetId = 'stats-weight') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const recovery = data.recoverySummary;
  const onOffDiff = recovery.onOffDiff != null ? `${recovery.onOffDiff > 0 ? '+' : ''}${recovery.onOffDiff} kcal` : 'n/d';
  el.innerHTML = `
    <div class="stats-panel stats-panel-patterns stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Allenamento + recovery</div>
            <span class="support-mini-state ${targetId === 'stats-weight' ? 'done' : 'pending'}">${targetId === 'stats-weight' ? 'segnale principale' : 'supporto'}</span>
          </div>
          <div class="support-mini-sub">Qui leggi se i giorni ON e OFF stanno davvero lavorando in squadra.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="goView('today')">Torna a oggi</button>
        </div>
      </div>
      <div class="stats-insight-strip">
        <div class="stats-insight-title">${recovery.title}</div>
        <div class="stats-insight-body">${recovery.body}</div>
        <div class="stats-weight-reading-note">${recovery.coach}</div>
      </div>
      <div class="stats-kpis stats-kpis-adh">
        <div class="sc-card">
          <div class="sc-kicker">Distribuzione</div>
          <div class="sc-val">${recovery.actualOnPct}%</div>
          <div class="sc-lbl">giorni ON reali</div>
          <div class="sc-sub">teorico ${recovery.theoreticalOnPct}% dal calendario</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Differenza kcal</div>
          <div class="sc-val${recovery.onOffDiff != null && recovery.onOffDiff >= 120 ? ' ok' : recovery.onOffDiff != null && recovery.onOffDiff < 80 ? ' warn' : ''}">${onOffDiff}</div>
          <div class="sc-lbl">ON vs OFF</div>
          <div class="sc-sub">quanto il ritmo energetico cambia davvero</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Completi</div>
          <div class="sc-val">${data.adherence.fullDays}</div>
          <div class="sc-lbl">giorni pieni</div>
          <div class="sc-sub">quanti giorni hanno davvero chiuso il cerchio</div>
        </div>
      </div>
      <div class="stats-adherence-lower">
        <div class="stats-heatmap-wrap" id="stats-heatmap"></div>
        <div class="stats-ratio-wrap" id="stats-ratio"></div>
      </div>
    </div>`;
  renderHeatmap(data);
  renderRatio(data);
}

function renderStatsSupportModule(data) {
  const el = document.getElementById('stats-measurements');
  if (!el) return;
  const supportModule = data.primaryModule === 'physical'
    ? (data.coverage.behaviorReadable ? 'behavior' : data.coverage.recoveryReadable ? 'recovery' : 'none')
    : data.primaryModule === 'recovery'
      ? (data.coverage.behaviorReadable ? 'behavior' : data.coverage.weightReliable ? 'teaser' : 'none')
      : (data.coverage.recoveryReadable ? 'recovery' : data.coverage.weightReliable ? 'teaser' : 'none');
  if (supportModule === 'behavior') {
    renderStatsBehaviorModule(data, 'stats-measurements');
    return;
  }
  if (supportModule === 'recovery') {
    renderStatsRecoveryModule(data, 'stats-measurements');
    return;
  }
  if (supportModule === 'teaser') {
    el.innerHTML = `
      <div class="stats-panel stats-panel-measurements stats-module-shell">
        <div class="stats-panel-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Stats</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">Fisico ancora leggero, ma gia vicino</div>
              <span class="support-mini-state idle">supporto</span>
            </div>
            <div class="support-mini-sub">Il peso sta iniziando a parlare, ma manca ancora abbastanza contesto per usarlo come segnale principale.</div>
          </div>
          <div class="stats-inline-actions">
            <button class="stats-head-action-btn" onclick="openStatsQuickAction('stats-actions-weight-form-shell','w-in')">Aggiungi peso</button>
            <button class="stats-inline-btn" onclick="openMeasurementEntry()">Nuova rilevazione</button>
          </div>
        </div>
        <div class="stats-glance-row">
          <div class="stats-glance-chip"><span>Pesate</span><strong>${data.weight.count}</strong></div>
          <div class="stats-glance-chip"><span>Trend</span><strong>${data.kpis.weightValue}</strong></div>
          <div class="stats-glance-chip"><span>Rilevazioni</span><strong>${data.measurements.count}</strong></div>
        </div>
        <div class="stats-weight-reading">
          <div class="stats-weight-reading-title">Lettura</div>
          <div class="stats-weight-reading-body">Un altro piccolo blocco di dati fisici basta per far salire peso e misure a segnale principale.</div>
        </div>
      </div>`;
    return;
  }
  el.innerHTML = '';
}

function renderStatsPatterns(data) {
  const el = document.getElementById('stats-patterns');
  if (!el) return;
  el.innerHTML = `
    <div class="stats-panel stats-panel-patterns">
      <div class="stats-patterns-layout">
        <div class="stats-patterns-side support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Pattern utili</div>
            <span class="support-mini-state idle">${data.bounds.label}</span>
          </div>
          <div class="support-mini-sub">Tre segnali al massimo, tutti pensati per decidere cosa fare adesso.</div>
          <div class="stats-patterns-note">Se questa sezione diventa lunga, sta fallendo: qui devono restare solo le priorita pratiche.</div>
        </div>
        <div class="stats-patterns-main">
          <div class="pattern-card pattern-card-featured">
            <div class="pattern-card-kicker">Insight del periodo</div>
            <div class="pattern-card-stack">
              ${(data.patterns || []).map(text => `<div class="pattern-card-line">${text}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStatsWeightLog(bounds) {
  const weightEntries = [...getWeightEntriesForBounds(bounds)].reverse();
  if (!weightEntries.length) {
    return `<div class="stats-form-note">Ancora nessuna pesata nel periodo.</div>`;
  }
  return `
    <div class="w-log open">
      <div class="w-log-title">Cronologia peso · puoi correggere o eliminare ogni riga</div>
      ${weightEntries.map((entry, ri, arr) => {
        const prev = arr[ri + 1];
        const delta = prev ? +(entry.val - prev.val).toFixed(1) : null;
        const deltaHtml = delta == null
          ? ''
          : `<span class="w-delta ${delta > 0 ? 'd-pos' : delta < 0 ? 'd-neg' : 'd-neu'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg</span>`;
        return `<div class="w-log-item">
          <span class="w-log-date">${entry.date}</span>
          <span class="w-log-val">${entry.val.toFixed(1)} kg</span>
          ${deltaHtml}
          <div class="stats-row-actions">
            <button class="stats-row-btn" onclick="editWeight(${entry.srcIndex})">Modifica</button>
            <button class="stats-row-btn danger" onclick="delWeight(${entry.srcIndex})">Elimina</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderStatsActions(data) {
  const el = document.getElementById('stats-actions');
  if (!el) return;
  el.innerHTML = `
    <div class="stats-actions-card">
      <div class="stats-actions-stack">
        <div class="stats-action-row stats-action-row-primary">
          <div class="stats-action-copy">
            <div class="stats-actions-title">Prossimo passo</div>
            <div class="stats-actions-note">${data.nextAction.title}. ${data.nextAction.body}</div>
          </div>
          <div class="stats-action-control">
            <button class="w-btn" onclick="${data.nextAction.onClick}">${data.nextAction.ctaLabel}</button>
          </div>
        </div>
        <div class="stats-actions-grid">
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Peso</div>
              <div class="stats-actions-note">Aggiungi una pesata o riapri la cronologia solo quando ti serve.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="toggleStatsSection('stats-actions-weight-form-shell')">Nuovo peso</button>
              <button class="stats-inline-btn" onclick="toggleStatsSection('stats-actions-weight-log-shell')">Cronologia</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Misure</div>
              <div class="stats-actions-note">Le rilevazioni restano qui sotto, fuori dalla lettura principale della tab.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="toggleStatsSection('stats-actions-measurements-form-shell')">Nuova rilevazione</button>
              <button class="stats-inline-btn" onclick="toggleStatsSection('stats-actions-measurements-log-shell')">Cronologia</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Obiettivo</div>
              <div class="stats-actions-note">Se il quadro ti sembra fuori fase, rivedi prima obiettivo e setup di base.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="goView('profilo')">Apri profilo</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Giornata attiva</div>
              <div class="stats-actions-note">Quando hai capito il quadro, torna subito su oggi e chiudi il prossimo passo utile.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="goView('today')">Torna a oggi</button>
            </div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-weight-form-shell">
          <div class="stats-action-block">
            <div class="stats-actions-title">Nuovo peso</div>
            <div class="stats-actions-note">Una pesata semplice vale piu di una stima mentale.</div>
            <div class="stats-weight-entry">
              <div class="weight-entry">
                <input class="w-input" type="number" id="w-in" step="0.1" placeholder="64.0">
                <span class="stats-inline-unit">kg</span>
                <button class="w-btn" onclick="addWeight()">Salva peso</button>
              </div>
            </div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-weight-log-shell">
          <div class="stats-action-block">${renderStatsWeightLog(data.bounds)}</div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-measurements-form-shell">
          <div class="stats-action-block">
            <div id="stats-actions-measurements-entry"></div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-measurements-log-shell">
          <div class="stats-action-block">
            <div id="stats-actions-measurements-log"></div>
          </div>
        </div>
      </div>
    </div>`;
  renderMeasurementsForm(data.bounds, 'stats-actions-measurements-entry', 'stats-actions-measurements-log');
}

function renderStatsComingSoon() {
  const sub = document.getElementById('stats-sub');
  if (sub) sub.textContent = 'Stiamo finalizzando trend, recovery e letture davvero utili prima dell’apertura pubblica.';
  const toolbar = document.getElementById('stats-toolbar');
  const summary = document.getElementById('stats-summary');
  const weight = document.getElementById('stats-weight');
  const measurements = document.getElementById('stats-measurements');
  const adherence = document.getElementById('stats-adherence');
  const patterns = document.getElementById('stats-patterns');
  const actions = document.getElementById('stats-actions');
  if (toolbar) toolbar.innerHTML = '';
  if (weight) weight.innerHTML = '';
  if (measurements) measurements.innerHTML = '';
  if (adherence) adherence.innerHTML = '';
  if (patterns) patterns.innerHTML = '';
  if (actions) actions.innerHTML = '';
  if (summary) {
    summary.innerHTML = `<div class="stats-coming-shell">
      <div class="stats-coming-card">
        <div class="stats-coming-top">
          <span class="stats-coming-pill"><span class="stats-coming-pill-dot"></span>In arrivo</span>
          <span class="stats-coming-label">Premium preview</span>
        </div>
        <div class="stats-coming-body">
          <div class="stats-coming-copy">
            <div class="stats-coming-title">Una nuova dashboard coach-like e piu leggibile.</div>
            <div class="stats-coming-text">Peso, macro, recovery e andamento dei giorni ON/OFF stanno passando in una vista piu chiara, meno rumorosa e molto piu orientata al prossimo passo.</div>
            <div class="stats-coming-bullets">
              <span class="stats-coming-bullet">trend peso</span>
              <span class="stats-coming-bullet">macro leggibili</span>
              <span class="stats-coming-bullet">recovery e routine</span>
            </div>
            <div class="stats-coming-actions">
              <button class="stats-coming-btn primary" onclick="goView('today')">Torna a oggi</button>
              <button class="stats-coming-btn" onclick="goView('profilo')">Apri profilo</button>
            </div>
          </div>
          <div class="stats-coming-visual" aria-hidden="true">
            <div class="stats-coming-masthead">
              <span class="stats-coming-chip wide"></span>
              <span class="stats-coming-chip"></span>
            </div>
            <div class="stats-coming-panel">
              <div class="stats-coming-line long"></div>
              <div class="stats-coming-line mid"></div>
              <div class="stats-coming-line short"></div>
              <div class="stats-coming-grid">
                <span class="stats-coming-metric"></span>
                <span class="stats-coming-metric"></span>
                <span class="stats-coming-metric"></span>
              </div>
            </div>
            <div class="stats-coming-panel muted">
              <div class="stats-coming-line mid"></div>
              <div class="stats-coming-line long"></div>
              <div class="stats-coming-chip-row">
                <span class="stats-coming-chip"></span>
                <span class="stats-coming-chip narrow"></span>
                <span class="stats-coming-chip"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
}

function renderStatsDashboard() {
  const data = getStatsRangeData(S.statsRange || '30d');
  document.getElementById('stats-sub').textContent = `${data.bounds.label} · prima leggi il segnale giusto, poi decidi il prossimo passo`;
  document.getElementById('stats-adherence').innerHTML = '';
  renderStatsToolbar(data);
  renderStatsHero(data);
  if (data.primaryModule === 'physical') renderStatsPhysicalModule(data);
  else if (data.primaryModule === 'recovery') renderStatsRecoveryModule(data);
  else renderStatsBehaviorModule(data);
  renderStatsSupportModule(data);
  renderStatsPatterns(data);
  renderStatsActions(data);
}
function renderStats() {
  renderStatsComingSoon();
}
function renderProfile() {
  renderAnagrafica();
  renderOnDaysPicker();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
}
function drawChart(log, opts = {}) {
  const el = document.getElementById('w-canvas');
  if (!el || !log?.length) return;
  const isCompact = window.innerWidth <= 720;
  const cssWidth = Math.max(260, Math.round(el.getBoundingClientRect().width || el.offsetWidth || 680));
  const cssHeight = isCompact ? 170 : 210;
  const dpr = window.devicePixelRatio || 1;
  el.style.width = '100%';
  el.style.height = `${cssHeight}px`;
  el.width = Math.round(cssWidth * dpr);
  el.height = Math.round(cssHeight * dpr);
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W=cssWidth, H=cssHeight, pad={t:18,r:24,b:30,l:42};
  const vals = log.map(l=>l.val);
  const rolling = opts.rolling || [];
  const targetW = opts.targetWeight ?? null;
  const n = vals.length;
  const allVals = [...vals, ...rolling.map(entry => entry.val), targetW].filter(v => v != null);
  const vmin = Math.min(...allVals) - 0.8;
  const vmax = Math.max(...allVals) + 0.8;
  const xs = i => pad.l + (W-pad.l-pad.r)*i/Math.max(n-1,1);
  const ys = v => H-pad.b - (v-vmin)/(vmax-vmin)*(H-pad.t-pad.b);
  ctx.clearRect(0,0,W,H);
  ctx.imageSmoothingEnabled = true;

  [0,.25,.5,.75,1].forEach(t => {
    const y=pad.t+(H-pad.t-pad.b)*t, v=(vmax-(vmax-vmin)*t).toFixed(1);
    ctx.strokeStyle='#e2dfd8';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';ctx.fillText(v,2,y+3);
  });

  if (targetW) {
    const ty = ys(targetW);
    ctx.strokeStyle='#1c52a0';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,ty);ctx.lineTo(W-pad.r,ty);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#1c52a0';ctx.font='10px JetBrains Mono';
    ctx.fillText(`target ${targetW}kg`,W-pad.r+3,ty+3);
  }

  if (rolling.length >= 2) {
    ctx.strokeStyle='rgba(28,82,160,.5)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    ctx.beginPath();
    rolling.forEach((entry, i) => i ? ctx.lineTo(xs(i), ys(entry.val)) : ctx.moveTo(xs(i), ys(entry.val)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (vals.length < 2) {
    ctx.fillStyle='#1a6b3f';ctx.beginPath();ctx.arc(xs(0),ys(vals[0]),4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';
    ctx.fillText(log[0].shortLabel || String(log[0].date || '').slice(0,5), pad.l+6, H-4);
    return;
  }

  const g=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
  g.addColorStop(0,'rgba(26,107,63,.18)');g.addColorStop(1,'rgba(26,107,63,0)');
  ctx.fillStyle=g;ctx.beginPath();
  ctx.moveTo(xs(0),H-pad.b);
  vals.forEach((v,i)=>ctx.lineTo(xs(i),ys(v)));
  ctx.lineTo(xs(n-1),H-pad.b);ctx.closePath();ctx.fill();

  ctx.strokeStyle='#1a6b3f';ctx.lineWidth=2;ctx.lineJoin='round';ctx.setLineDash([]);
  ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(xs(i),ys(v)):ctx.moveTo(xs(i),ys(v)));ctx.stroke();

  vals.forEach((v,i)=>{
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#1a6b3f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='10px JetBrains Mono';
    const lx = Math.min(Math.max(xs(i)-12, pad.l), W-pad.r-36);
    ctx.fillText(log[i].shortLabel || String(log[i].date || '').slice(0,5), lx, H-4);
  });
}
function renderHeatmap(data) {
  const el = document.getElementById('stats-heatmap');
  if (!el) return;
  const CELL=14, GAP=3, DOW_W=18, STEP=CELL+GAP;
  const today = new Date(); today.setHours(23,59,59,0);
  const rangeEnd = new Date(data?.bounds?.end || today);
  rangeEnd.setHours(23,59,59,0);
  const daysBack = data?.bounds?.range === 'all'
    ? Math.min(Math.max((data?.bounds?.days || 1) - 1, 27), 111)
    : Math.max((data?.bounds?.days || 30) - 1, 27);
  const start = new Date(rangeEnd); start.setDate(rangeEnd.getDate()-daysBack);
  const startDow = start.getDay();
  start.setDate(start.getDate() + (startDow===0?-6:1-startDow));

  // Build week matrix
  const weeks=[], d=new Date(start);
  let week=[];
  while(d<=rangeEnd){ week.push({key:localDate(d),dow:d.getDay(),date:new Date(d),info:S.doneByDate[localDate(d)]}); if(week.length===7){weeks.push(week);week=[];} d.setDate(d.getDate()+1); }
  if(week.length) weeks.push(week);

  const W = DOW_W + weeks.length*STEP + GAP;
  const H = 20 + 7*STEP + 4; // month labels + 7 rows + padding

  el.innerHTML = `<canvas id="hm-canvas" style="width:100%;max-width:${W}px;height:${H}px;display:block"></canvas>
    <div class="hm-legend">
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#1a6b3f"></div>ON completo</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#dfc070"></div>OFF completo</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#a8d4b8"></div>Parziale</div>
      <div class="hm-leg-item"><div class="hm-leg-dot" style="background:#e2dfd8"></div>Nessuno</div>
    </div>`;

  const cv = document.getElementById('hm-canvas');
  const dpr = window.devicePixelRatio||1;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr,dpr);

  const COLORS = { full_on:'#2c9e5a', full_off:'#dfc070', part:'#a8d4b8', none:'#e2dfd8', future:'#f5f3f0' };
  const DOW_NAMES=['L','M','M','G','V','S','D'];

  // Day-of-week labels
  DOW_NAMES.forEach((lbl,i)=>{
    ctx.fillStyle='#8c877f';ctx.font='bold 8px Manrope,sans-serif';ctx.textAlign='right';
    ctx.fillText(lbl,DOW_W-2,20+i*STEP+CELL*0.75);
  });

  // Month labels + cells
  const MONTHS=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  let lastMonth=-1;
  weeks.forEach((w,wi)=>{
    const wx = DOW_W + wi*STEP;
    // Month label on first week of month
    const m = w[0].date.getMonth();
    if(m!==lastMonth){ ctx.fillStyle='#8c877f';ctx.font='bold 8px Manrope,sans-serif';ctx.textAlign='left'; ctx.fillText(MONTHS[m],wx,12); lastMonth=m; }
    w.forEach(({key,info,date},di)=>{
      const isFuture = date>today;
      let color = COLORS.none;
      if(isFuture) color=COLORS.future;
      else if(info?.hasActivity){ color = info.done > 0 && info.done>=info.total ? (info.type==='on'?COLORS.full_on:COLORS.full_off) : COLORS.part; }
      ctx.fillStyle=color;
      const rx=wx, ry=20+di*STEP;
      // Rounded rect
      const r=3;
      ctx.beginPath();ctx.moveTo(rx+r,ry);ctx.lineTo(rx+CELL-r,ry);ctx.quadraticCurveTo(rx+CELL,ry,rx+CELL,ry+r);
      ctx.lineTo(rx+CELL,ry+CELL-r);ctx.quadraticCurveTo(rx+CELL,ry+CELL,rx+CELL-r,ry+CELL);
      ctx.lineTo(rx+r,ry+CELL);ctx.quadraticCurveTo(rx,ry+CELL,rx,ry+CELL-r);
      ctx.lineTo(rx,ry+r);ctx.quadraticCurveTo(rx,ry,rx+r,ry);ctx.closePath();ctx.fill();
    });
  });

  // Tooltip on hover
  cv._weeks=weeks; cv._today=today; cv._DOW_W=DOW_W; cv._STEP=STEP; cv._CELL=CELL;
  cv.onmousemove = function(e) {
    const rect=this.getBoundingClientRect(), mx=(e.clientX-rect.left)*(this.width/dpr/rect.width), my=(e.clientY-rect.top)*(this.height/dpr/rect.height);
    const wi=Math.floor((mx-this._DOW_W)/this._STEP), di=Math.floor((my-20)/this._STEP);
    if(wi>=0&&wi<this._weeks.length&&di>=0&&di<7){
      const cell=this._weeks[wi][di];
      if (cell) {
        const note = S.notes[cell.key] ? ` · "${S.notes[cell.key].slice(0,30)}${S.notes[cell.key].length>30?'?':''}"` : '';
        const meta = cell.info?.hasActivity
          ? ` · ${cell.info.done}/${cell.info.total} pasti${cell.info.suppDone ? ` · ${cell.info.suppDone} integratori` : ''}${cell.info.waterCount ? ` · ${cell.info.waterCount} bicchieri` : ''}`
          : '';
        this.title = `${cell.key}${meta}${note}`;
      }
    }
  };
}
function renderRatio(data) {
  const el = document.getElementById('stats-ratio');
  if (!el) return;
  const entries = [];
  const cursor = new Date(data.bounds.start);
  while (cursor <= data.bounds.end) {
    const key = localDate(cursor);
    const info = S.doneByDate?.[key];
    if (info?.hasActivity) entries.push(info);
    cursor.setDate(cursor.getDate() + 1);
  }
  if (!entries.length) { el.innerHTML = `<div style="font-size:12px;color:var(--muted)">Aggiungi un po di giorni e qui comparira il ritmo.</div>`; return; }
  const onDays  = entries.filter(e=>e.type==='on').length;
  const offDays = entries.filter(e=>e.type==='off').length;
  const total = onDays + offDays;
  const onPct = total ? Math.round(onDays/total*100) : 0;
  const expOnPct = Math.round(S.onDays.length/7*100);
  el.innerHTML = `
    <div class="ratio-labels stats-ratio-labels">
      <span style="color:var(--on)">ON ${onDays} giorni (${onPct}%)</span>
      <span style="color:var(--off)">OFF ${offDays} giorni</span>
    </div>
    <div class="ratio-bar"><div class="ratio-fill" style="width:${onPct}%"></div></div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px">Teorico: ${expOnPct}% ON · ${100-expOnPct}% OFF</div>
    <div class="ratio-stats">
      <div class="rs"><div class="rs-v" style="color:var(--on)">${entries.filter(e=>e.type==='on'&&e.done>0&&e.done>=e.total).length}</div><div class="rs-l">ON comp.</div></div>
      <div class="rs"><div class="rs-v" style="color:var(--off)">${entries.filter(e=>e.type==='off'&&e.done>0&&e.done>=e.total).length}</div><div class="rs-l">OFF comp.</div></div>
    </div>`;
}
function renderMeasurementsForm(bounds, entryTargetId = 'measurements-entry', logTargetId = 'measurements-log') {
  const el = document.getElementById(entryTargetId);
  if (!el) return;
  el.innerHTML = `
    <div class="meas-form">
      <div class="stats-form-note">Compila solo i campi che vuoi tracciare oggi. Potrai sempre sistemarli piu avanti.</div>
      <div class="meas-grid">
        <div class="meas-field"><label>Vita</label><input type="number" id="m-vita" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Fianchi</label><input type="number" id="m-fianchi" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Petto</label><input type="number" id="m-petto" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Braccio dx</label><input type="number" id="m-braccio" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Coscia</label><input type="number" id="m-coscia" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Peso</label><input type="number" id="m-peso" step="0.1" placeholder="–"><div class="meas-unit">kg</div></div>
      </div>
      <button class="meas-btn" onclick="addMeasurement()">+ Salva rilevazione</button>
    </div>`;
  renderMeasurementsLog(bounds, logTargetId);
}
function renderMeasurementsLog(bounds, targetId = 'measurements-log') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const log = [...(bounds ? getMeasurementsForBounds(bounds) : (S.measurements || []).map(m => ({ ...m })))].reverse().slice(0,10);
  if (!log.length) { el.innerHTML=''; return; }
  const LABELS = {peso:'Peso',vita:'Vita',fianchi:'Fianchi',petto:'Petto',braccio:'Braccio',coscia:'Coscia'};
  const UNITS  = {peso:'kg', vita:'cm',fianchi:'cm',petto:'cm',braccio:'cm',coscia:'cm'};
  el.innerHTML = `<div class="stats-measure-log-card">
    <div class="stats-form-note" style="margin-bottom:10px">Cronologia misure: apri ogni riga se vuoi correggerla o rimuoverla.</div>
    <div class="stats-measure-log-scroll">
    ${log.map((m,ri) => {
      const prev = log[ri+1];
      const pills = Object.entries(LABELS).filter(([k])=>m[k]!==null&&m[k]!==undefined).map(([k,lbl])=>{
        let delta='';
        if(prev&&prev[k]!=null){const d=(m[k]-prev[k]).toFixed(1);const c=k==='peso'?(+d>0?'var(--on)':'var(--red)'):(+d>0?'var(--red)':'var(--on)');delta=`<span style="font-size:9px;color:${c};margin-left:3px">${+d>0?'+':''}${d}</span>`;}
        return `<div class="meas-pill"><strong>${m[k]}</strong> ${UNITS[k]} <span style="color:var(--muted)">${lbl}</span>${delta}</div>`;
      }).join('');
      return `<div class="meas-log-item">
        <div class="meas-log-date">${m.date.split('-').reverse().join('/')}</div>
        <div class="meas-vals">${pills}</div>
        <div class="stats-row-actions">
          <button class="stats-icon-btn" title="Modifica rilevazione" aria-label="Modifica rilevazione" onclick="editMeasurement(${m._idx})">✏️</button>
          <button class="stats-icon-btn danger" title="Elimina rilevazione" aria-label="Elimina rilevazione" onclick="delMeasurement(${m._idx})">🗑️</button>
        </div>
      </div>`;
    }).join('')}
    </div>
  </div>`;
}
function renderGoalCard() {
  const el = document.getElementById('goal-card');
  if (!el) return;
  const g = S.goal;
  const weeksSince = g.startDate ? Math.floor((new Date()-new Date(g.startDate+'T12:00:00'))/(7*86400000)) : null;
  const phaseLabel = {bulk:'Bulk 💪',cut:'Cut 🔥',mantieni:'Mantenimento ⚖️'}[g.phase] || g.phase;
  const phaseState = g.phase === 'bulk' ? 'progress' : g.phase === 'cut' ? 'danger' : 'idle';
  el.innerHTML = `
    <div class="goal-card">
      <div class="profile-card-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Profilo</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Obiettivo fase</div>
            <span class="support-mini-state ${phaseState}">${phaseLabel.replace(/\s*[💪🔥⚖️]/g, '')}</span>
          </div>
          <div class="support-mini-sub">Data di partenza, target e note per restare sul pezzo.</div>
        </div>
      </div>
      <div class="goal-extra-head">
        <span class="goal-extra-phase">${phaseLabel}</span>
        ${weeksSince!==null?`<span class="goal-extra-weeks">Settimana ${weeksSince+1}</span>`:''}
      </div>
      <div class="goal-fields">
        <div class="goal-field">
          <label>Data inizio fase</label>
          <input id="goal-start-date" type="date" value="${g.startDate||''}">
        </div>
        <div class="goal-field">
          <label>Peso target (kg)</label>
          <input id="goal-target-weight" type="number" step="0.5" value="${g.targetWeight||''}" placeholder="–">
        </div>
        <div class="goal-field goal-full">
          <label>Note obiettivo</label>
          <textarea id="goal-notes" rows="2">${esc(g.notes||'')}</textarea>
        </div>
      </div>
      <button class="btn btn-primary anag-save-btn" onclick="saveGoalDetails()">Salva obiettivo</button>
    </div>`;
}
function supplementFormHTML(scope, opts = {}) {
  const safeScope = htmlEsc(scope || 'today');
  const isVisible = !!opts.visible;
  const isModal = !!opts.modal;
  return `
    <div id="supp-form-${safeScope}" data-supp-form-scope="${safeScope}" class="supp-form-shell${isModal ? ' supp-form-modal' : ''}" style="display:${isVisible ? 'block' : 'none'}">
      <div class="supp-form-grid">
        <div class="supp-form-field supp-form-field-name"><label class="supp-form-label">Nome</label>
          <input id="sf-name-${safeScope}" class="supp-form-input" type="text" placeholder="es. Magnesio"></div>
        <div class="supp-form-field"><label class="supp-form-label">Dose</label>
          <div class="supp-dose-wrap"><input id="sf-dose-${safeScope}" class="supp-form-input supp-dose-input" type="number" inputmode="decimal" min="0.1" max="100" step="0.1" placeholder="3"><span>g</span></div></div>
        <div class="supp-form-field"><label class="supp-form-label">Quando</label>
          <select id="sf-when-${safeScope}" class="supp-form-input supp-form-select">
            <option value="mattina">mattina</option>
            <option value="pranzo">pranzo</option>
            <option value="pomeriggio">pomeriggio</option>
            <option value="cena">cena</option>
            <option value="sera">sera</option>
          </select></div>
      </div>
      <div class="supp-form-actions">
        <button onclick="confirmAddSupp('${esc(scope || 'today')}')" class="supp-form-btn supp-form-btn-primary">Aggiungi</button>
        <button onclick="${isModal ? 'closeDayModal()' : `toggleSuppForm('${esc(scope || 'today')}')`}" class="supp-form-btn supp-form-btn-secondary">Annulla</button>
      </div>
    </div>`;
}
function renderWater() {
  const el = document.getElementById('water-widget');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const count = (S.water && S.water[dateKey]) || 0;
  const waterInfo = getWaterTargetInfo(dateKey);
  const totalMl = waterInfo.totalMl;
  const target = waterInfo.glasses;
  const waterStateCls = count >= target ? 'done' : count > 0 ? 'progress' : 'idle';
  const waterStateText = count >= target ? 'In linea' : count > 0 ? 'In corso' : 'Si parte';
  const remaining = Math.max(0, target - count);
  const footText = remaining === 0
    ? 'Sei in linea con l obiettivo di oggi.'
    : remaining === 1
      ? 'Ancora 1 bicchiere e ci sei.'
      : `Ancora ${remaining} bicchieri e ci sei.`;

  const pct = Math.min(count / target, 1) * 100;
  const glasses = Array.from({length: target}, (_,i) =>
    `<span class="water-glass${i < count ? ' filled' : ''}" title="Bicchiere ${i+1}">🥛</span>`
  ).join('');

  const infoBtn = `<button class="water-info-btn" onmouseenter="showWaterTip(this)" onmouseleave="hideTip('tip-water')" onclick="showWaterTip(this)" title="Info fabbisogno idrico">i</button>`;
  const editBtn = `<button class="water-edit-btn" onclick="editWaterTarget('${dateKey}')" title="Modifica obiettivo acqua" aria-label="Modifica obiettivo acqua"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>`;

  el.innerHTML = `<div class="water-widget support-mini-card">
    <div class="water-top support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Supporto idratazione</div>
        <div class="support-mini-title-row">
          <div class="water-title-cluster">
            <div class="support-mini-title">💧 Acqua di oggi</div>
            ${infoBtn}
            ${editBtn}
          </div>
        </div>
        <div class="support-mini-sub">${count}/${target} bicchieri oggi · obiettivo ${totalMl} ml</div>
      </div>
      <div class="water-head-actions">
        <div class="water-btns">
          <button class="water-btn" onclick="addWater(-1)"${count<=0?' disabled':''}>−</button>
          <span class="water-count">${count}<span class="water-target">/${target}</span></span>
          <button class="water-btn" onclick="addWater(1)"${count>=12?' disabled':''}>+</button>
        </div>
      </div>
    </div>
    <div class="water-bar-wrap">
      <div class="water-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="water-glasses">${glasses}</div>
    <div class="water-foot">${footText}</div>
  </div>`;
}

function showWaterTip(anchor) {
  const tip = document.getElementById('tip-water');
  if (!tip) return;
  const dateKey = S.selDate || localDate();
  const { dayType, baseMl, bonusMl, autoMl, totalMl, glasses: target, isManual } = getWaterTargetInfo(dateKey);

  tip.innerHTML = `
    <div class="tip-title">💧 Fabbisogno idrico</div>
    <div class="tip-desc">
      Formula: <strong>35 ml × kg</strong> di peso corporeo${dayType === 'on' ? ' + <strong>350 ml</strong> giorno ON' : ''}.
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div style="text-align:center;background:var(--bg);border-radius:6px;padding:6px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:500;color:var(--on)">${totalMl} ml</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Obiettivo</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:6px;padding:6px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:500;color:var(--on)">${target} 🥛</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Bicchieri (250ml)</div>
        </div>
      </div>
      ${S.anagrafica?.peso > 0 ? `<div style="margin-top:8px;font-size:11px">Base automatica: ${S.anagrafica.peso} kg × 35 ml = <strong>${baseMl} ml</strong>${bonusMl ? ` + ${bonusMl} ml (giorno ON) = <strong>${autoMl} ml</strong>` : ''}</div>` : '<div style="margin-top:8px;font-size:11px;color:var(--muted)">Inserisci il peso nel Profilo per un calcolo preciso.</div>'}
      ${isManual ? `<div style="margin-top:6px;font-size:11px;color:var(--on)">Target manuale attivo per questa data.</div>` : ''}
      <div style="margin-top:6px;font-size:10px;color:var(--muted)">Fonte: linee guida EFSA (2010) — adulti sani in clima temperato.</div>
    </div>`;
  showTip('tip-water', anchor);
}

function showDayModeTip(anchor) {
  const tip = document.getElementById('tip-day-mode');
  if (!tip) return;
  const phase = S.goal?.phase || 'mantieni';
  const phaseLabel = { bulk: 'bulk', cut: 'cut', mantieni: 'mantenimento' }[phase] || 'mantenimento';
  tip.innerHTML = `
    <div class="tip-title">Workout / Rest</div>
    <div class="tip-desc">
      Questo pulsante cambia la giornata tra <strong>allenamento</strong> e <strong>riposo</strong>.<br><br>
      Quando lo cambi, MarciFit aggiorna in modo coerente i <strong>target di kcal e macro</strong> del giorno in base alla tua fase attiva di <strong>${phaseLabel}</strong>.<br><br>
      In pratica: <strong>Workout</strong> usa i target del giorno con allenamento, <strong>Rest</strong> quelli del giorno di recupero.
    </div>`;
  showTip('tip-day-mode', anchor);
}

function showPastiDistTip(anchor) {
  const tip = document.getElementById('tip-pasti-dist');
  if (!tip) return;
  const type = S.day || 'on';
  const meals = S.meals[type] || [];
  const tgtK  = S.macro?.[type]?.k || 0;
  const totalPlanK = meals.reduce((s, meal) => s + (mealMacros(meal).kcal || 0), 0);
  const scale = tgtK > 0 && totalPlanK > 0 ? tgtK / totalPlanK : 1;
  const distRows = meals.map((meal, i) => {
    const mk = Math.round((mealMacros(meal).kcal || 0) * scale);
    const pct = tgtK > 0 ? Math.round(mk / tgtK * 100) : 0;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--b1)">
      <span style="font-size:11px;color:var(--ink2)">${meal.name || 'Pasto '+(i+1)}</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500">${mk} kcal <span style="color:var(--muted);font-size:10px">(${pct}%)</span></span>
    </div>`;
  }).join('');
  tip.innerHTML = `
    <div class="tip-title">🍽️ Distribuzione calorie</div>
    <div class="tip-desc">
      <div style="margin-bottom:8px">
        ${distRows || '<span style="color:var(--muted)">Nessun pasto nel piano.</span>'}
      </div>
      <div style="margin-top:4px;font-size:10px;color:var(--muted)">
        Linee guida ISSN/ACSM: distribuire le proteine in <strong>3–5 pasti</strong> da 20–40 g per massimizzare la sintesi proteica muscolare (MPS).<br><br>
        Per la performance: il pasto pre-allenamento dovrebbe coprire il <strong>25–30%</strong> delle calorie giornaliere, con carboidrati complessi e proteine moderate.<br><br>
        Fonte: ISSN Position Stand 2017 · Aragon & Schoenfeld (2013).
      </div>
    </div>`;
  showTip('tip-pasti-dist', anchor);
}

function renderSuppToday() {
  const el = document.getElementById('supp-today');
  if (!el) return;
  const active = S.supplements.filter(s=>s.active);
  const dateKey = S.selDate || localDate();
  const checked = S.suppChecked[dateKey] || [];
  const checkSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const doneCount = active.filter(s => checked.includes(s.id)).length;
  const pendingCount = Math.max(0, active.length - doneCount);
  const progressPct = active.length ? Math.round(doneCount / active.length * 100) : 0;
  const statusCls = active.length === 0 ? 'idle' : pendingCount === 0 ? 'done' : doneCount > 0 ? 'progress' : 'pending';
  const statusText = active.length === 0
    ? 'Da creare'
    : pendingCount === 0
      ? 'Fatta'
      : `${doneCount}/${active.length} presi`;
  const subText = active.length === 0
    ? 'Costruisci qui la routine che vuoi ritrovarti ogni giorno.'
    : pendingCount === 0
      ? 'Oggi hai gia chiuso tutta la routine.'
      : doneCount === 0
        ? 'Tocca quelli che stai prendendo per segnarli.'
        : `${pendingCount} ${pendingCount === 1 ? 'integratore da segnare' : 'integratori da segnare'}.`;
  const rows = active.length ? active.map(s => {
    const done = checked.includes(s.id);
    const suppIndex = S.supplements.findIndex(item => item.id === s.id);
    const doseHTML = s.dose ? `<span class="supp-today-chip support-mini-chip">${htmlEsc(s.dose)}</span>` : '';
    const whenHTML = s.when ? `<span class="supp-today-chip support-mini-chip is-time">${htmlEsc(s.when)}</span>` : '';
    return `<div class="supp-today-item${done ? ' is-done' : ''}" data-supp-id="${s.id}">
      <button class="supp-today-btn${done?' done':''}" onclick="toggleSupp('${s.id}')">
        <span class="supp-today-check">${done ? checkSVG : ''}</span>
        <span class="supp-today-copy">
          <span class="supp-today-name">${htmlEsc(s.name)}</span>
          ${(doseHTML || whenHTML) ? `<span class="supp-today-meta">${doseHTML}${whenHTML}</span>` : `<span class="supp-today-meta supp-today-meta-muted">Tocca per segnare</span>`}
        </span>
      </button>
      <button class="supp-today-manage" onclick="toggleSuppActive(${suppIndex})" title="Disattiva integratore">✕</button>
    </div>`;
  }).join('') : `<div class="supp-today-empty">
      <div class="supp-today-empty-title">Nessuna routine ancora</div>
      <div class="supp-today-empty-text">Aggiungi il primo integratore e trasformalo in un gesto semplice da ritrovare ogni giorno.</div>
    </div>`;
  const addCard = `<button class="supp-today-add-card" onclick="toggleSuppForm('today')">
      <span class="supp-today-add-mark">
        <span class="supp-today-add-plus">+</span>
      </span>
      <span class="supp-today-add-copy">
        <span class="supp-today-add-title">Aggiungi integratore</span>
      </span>
    </button>`;

  el.innerHTML = `
    <div class="support-mini-card support-mini-card-supp">
      <div class="supp-today-head support-mini-head">
        <div class="supp-today-head-copy support-mini-head-copy">
          <div class="supp-today-kicker support-mini-kicker">Supporto routine</div>
          <div class="supp-today-title-row support-mini-title-row">
            <div class="supp-today-title support-mini-title">💊 Routine integratori</div>
            <span class="supp-today-state support-mini-state ${statusCls}">${statusText}</span>
          </div>
          <div class="supp-today-sub support-mini-sub">${subText}</div>
        </div>
      </div>
      ${active.length ? `<div class="supp-today-progress"><div class="supp-today-progress-fill ${statusCls}" style="width:${progressPct}%"></div></div>` : ''}
      <div class="supp-today-row">
        ${rows}
        ${addCard}
      </div>
    </div>`;
  el.style.display='block';
}
function showStreakTip(anchor, streak) {
  const tip = document.getElementById('tip-streak');
  if (!tip) return;
  // Find best streak ever
  let best = 0, cur = 0;
  const days = Object.keys(S.doneByDate)
    .filter(key => (S.doneByDate[key]?.activityCount || 0) > 0)
    .sort();
  days.forEach((key, i) => {
    const prev = i > 0 ? days[i-1] : null;
    if (prev) {
      const diff = (new Date(key+'T12:00:00') - new Date(prev+'T12:00:00')) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    } else cur = 1;
    if (cur > best) best = cur;
  });
  const adh = calcAdherence(28);
  tip.innerHTML = `
    <div class="tip-title">Streak · Giorni consecutivi</div>
    <div class="tip-desc">
      Giorni con almeno <strong>1 attivita registrata</strong> consecutiva: cibo, integratori o acqua.<br><br>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="text-align:center;background:var(--off-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--amber)">${streak}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Attuale</div>
        </div>
        <div style="text-align:center;background:var(--on-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--on)">${best}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Record</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px">Aderenza 28 gg: <strong>${adh}%</strong></div>
    </div>`;
  showTip('tip-streak', anchor);
}

function showStatsScoreTip(anchor, score) {
  const tip = document.getElementById('tip-score');
  if (!tip) return;
  const data = getStatsRangeData(S.statsRange || '30d');
  const scoreLabel = getStatsScoreLabel(score);
  tip.innerHTML = `
    <div class="tip-title">Score · Lettura rapida della costanza</div>
    <div class="tip-desc">
      Lo score combina <strong>aderenza</strong>, pasti completati, idratazione, integrazione e un piccolo bonus streak.<br><br>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="text-align:center;background:var(--off-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--ink)">${score}</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">${scoreLabel}</div>
        </div>
        <div style="text-align:center;background:var(--on-l);border-radius:6px;padding:8px 4px">
          <div style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:500;color:var(--on)">${data.adherence.adherenceRate}%</div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:2px">Aderenza</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:11px">Pasti completati: <strong>${data.adherence.mealRate}%</strong> · Acqua: <strong>${data.adherence.hydrationRate}%</strong> · Streak: <strong>${calcStreak()} giorni</strong></div>
    </div>`;
  showTip('tip-score', anchor);
}
// htmlEsc: safe for innerHTML content (escapes HTML entities)
function htmlEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// esc: safe for JS string attributes in onclick/onchange handlers
function esc(s) { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,' '); }
let _tt;
function toast(msg) {
  clearTimeout(_tt); document.getElementById('tm').textContent=msg;
  const el=document.getElementById('toast'); el.classList.add('show');
  _tt=setTimeout(()=>el.classList.remove('show'),2400);
}
const _tipShownAt = {}; // tracks when each tip was last shown (ms)

function showTip(id, anchor) {
  const tip = document.getElementById(id);
  if (!tip) return;
  _tipShownAt[id] = Date.now();

  // Remove any stale outside-click handler from previous open
  if (tip._outsideHandler) {
    document.removeEventListener('pointerdown', tip._outsideHandler);
    tip._outsideHandler = null;
  }

  // Make visible off-screen to measure size
  tip.style.visibility = 'hidden';
  tip.style.display = 'block';

  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const GAP = 10;

  // Horizontal: try to centre on anchor, clamp to viewport with padding
  let left = rect.left + rect.width/2 - tipW/2;
  left = Math.max(12, Math.min(left, vw - tipW - 12));

  // Vertical: prefer above, fall back to below if no room
  let top, arrowDir;
  if (rect.top - tipH - GAP > 12) {
    top = rect.top - tipH - GAP;
    arrowDir = 'up';
  } else {
    top = rect.bottom + GAP;
    arrowDir = 'down';
  }

  // Arrow x offset relative to tooltip
  const arrowX = Math.min(Math.max(rect.left + rect.width/2 - left, 16), tipW - 16);

  tip.className = `stat-tip tip-${arrowDir}`;
  tip.style.setProperty('--arrow-x', arrowX + 'px');
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
  tip.style.visibility = 'visible';

  // Close immediately on scroll (user expects hover to vanish when scrolling)
  const onScroll = () => {
    tip.style.display = 'none';
    if (tip._outsideHandler) { document.removeEventListener('pointerdown', tip._outsideHandler); tip._outsideHandler = null; }
    tip._scrollHandler = null;
  };
  window.addEventListener('scroll', onScroll, { once: true, passive: true, capture: true });
  tip._scrollHandler = onScroll;

  // Outside-click/tap: close when touching anywhere outside the tip
  // (delayed 200ms to skip the triggering touch itself)
  const outside = (e) => {
    if (!tip.contains(e.target) && e.target !== anchor) {
      tip.style.display = 'none';
      if (tip._scrollHandler) { window.removeEventListener('scroll', tip._scrollHandler, { capture: true }); tip._scrollHandler = null; }
      document.removeEventListener('pointerdown', outside);
      tip._outsideHandler = null;
    }
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, { passive: true });
    tip._outsideHandler = outside;
  }, 200);
}

function hideTip(id) {
  // Debounce: on mobile, a synthetic mouseleave fires immediately after onclick (~50ms).
  // Ignore if shown less than 400ms ago — scroll handler will close it instead.
  if (Date.now() - (_tipShownAt[id] || 0) < 80) return;
  const tip = document.getElementById(id);
  if (!tip) return;
  if (tip._outsideHandler) { document.removeEventListener('pointerdown', tip._outsideHandler); tip._outsideHandler = null; }
  if (tip._scrollHandler) { window.removeEventListener('scroll', tip._scrollHandler, { capture: true }); tip._scrollHandler = null; }
  tip.style.display = 'none';
}

// --- Fabbisogno section tooltips ---

function showFabBmrTip(anchor) {
  const el = document.getElementById('tip-fab-bmr');
  if (!el) return;
  el.innerHTML = `
    <div class="tip-title">METABOLISMO BASALE (BMR)</div>
    <div class="tip-desc">Kcal bruciate a completo riposo — il minimo per le funzioni vitali.<br><br>
    <strong>Katch-McArdle</strong> (se % grasso disponibile):<br>
    BMR = 370 + 21.6 × massa magra (kg)<br><br>
    <strong>Mifflin-St Jeor</strong> (fallback):<br>
    M: 10×kg + 6.25×cm − 5×età + 5<br>
    F: 10×kg + 6.25×cm − 5×età − 161</div>`;
  showTip('tip-fab-bmr', anchor);
}

function showFabPalTip(anchor) {
  const el = document.getElementById('tip-fab-pal');
  if (!el) return;
  el.innerHTML = `
    <div class="tip-title">ATTIVITÀ QUOTIDIANA</div>
    <div class="tip-desc"><strong>NEAT</strong> = movimento non strutturato: passi, scale, spostamenti, lavoro dinamico.<br>
    Nell app viene stimato da stile di vita/professione e, se disponibili, anche dai passi medi giornalieri.<br><br>
    <strong>EAT</strong> = allenamento strutturato, convertito in media giornaliera settimanale.<br><br>
    <strong>TEF</strong> = termogenesi del cibo, impostata al 10% come default prudente.</div>`;
  showTip('tip-fab-pal', anchor);
}

function showFabTdeeTip(anchor) {
  const el = document.getElementById('tip-fab-tdee');
  if (!el) return;
  el.innerHTML = `
    <div class="tip-title">DISPENDIO ENERGETICO TOTALE (TDEE)</div>
    <div class="tip-desc"><strong>Total Daily Energy Expenditure</strong> — stima delle kcal bruciate in un giorno medio.<br><br>
    <strong>Formula</strong>: TDEE = (BMR + NEAT + EAT) / (1 - TEF%)<br><br>
    Dopo almeno 14 giorni di pesate sufficienti, MarciFit può spostare automaticamente il target di circa 100-150 kcal se il trend non è coerente con la fase.</div>`;
  showTip('tip-fab-tdee', anchor);
}

function showFabGoalTip(anchor) {
  const el = document.getElementById('tip-fab-goal');
  if (!el) return;
  const phase = (typeof S !== 'undefined' && S.goal?.phase) || 'mantieni';
  const data = {
    bulk:     { title: 'BULK — MASSA', on: 'TDEE + 200 kcal', off: 'TDEE + 100 kcal', note: 'Surplus moderato: proteine fisse, grassi adeguati e carboidrati come variabile principale per spingere performance e recupero.', prot: '1.7 g/kg · grassi 1.0 g/kg' },
    cut:      { title: 'CUT — DEFINIZIONE', on: 'TDEE − 300 kcal', off: 'TDEE − 450 kcal', note: 'Deficit moderato con proteine più alte per proteggere la massa magra; i carboidrati scendono per ultimi.', prot: '2.0 g/kg · grassi 0.8 g/kg' },
    mantieni: { title: 'MANTENIMENTO', on: 'TDEE', off: 'TDEE − 100 kcal', note: 'Proteine e grassi restano stabili; i carboidrati completano le calorie residue e sostengono meglio le giornate ON.', prot: '1.6 g/kg · grassi 0.9 g/kg' },
  };
  const d = data[phase] || data.mantieni;
  el.innerHTML = `
    <div class="tip-title">${d.title}</div>
    <div class="tip-desc">
    <strong>Giorno ON</strong>: ${d.on}<br>
    <strong>Giorno OFF</strong>: ${d.off}<br><br>
    ${d.note}<br><br>
    Proteine target: <strong>${d.prot}</strong></div>`;
  showTip('tip-fab-goal', anchor);
}
function renderTmplFormItems() {
  const el = document.getElementById('tf-items-list');
  if (!el) return;
  el.innerHTML = '';
  if (!_tmplFormItems.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:4px 0">Nessun ingrediente ancora. Cercane uno qui sotto.</div>';
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
      const nextGrams = Math.max(0, Math.round(+this.value || 0));
      _tmplFormItems[ii].grams = nextGrams;
      const kcalEl = row.querySelector('.fir-kcal');
      if (kcalEl) kcalEl.textContent = `${Math.round(it.kcal100 * nextGrams / 100)} kcal`;
    });
    row.querySelector('.fir-grams').addEventListener('blur', function() {
      const nextGrams = Math.max(0, Math.round(+this.value || 0));
      _tmplFormItems[ii].grams = nextGrams;
      this.value = nextGrams;
    });
    row.querySelector('.fir-del').addEventListener('click', () => {
      _tmplFormItems.splice(ii, 1);
      renderTmplFormItems();
    });
    el.appendChild(row);
  });
}
function renderAnagrafica() {
  const a = S.anagrafica || {};
  const g = S.goal || {};
  if (!S.profileUi || typeof S.profileUi !== 'object') S.profileUi = {};
  if (typeof S.profileUi.primaryExpanded !== 'boolean') S.profileUi.primaryExpanded = false;
  const coreProfileFields = [a.nome, a.sesso, a.eta, a.altezza, a.peso];
  const coreProfileCount = coreProfileFields.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
  const hasStepsContext = a.passiGiornalieri !== null && a.passiGiornalieri !== undefined && String(a.passiGiornalieri).trim() !== '';
  const profileStateCls = coreProfileCount >= 5 && hasStepsContext ? 'done' : coreProfileCount >= 5 || coreProfileCount >= 3 ? 'progress' : 'idle';
  const profileStateText = coreProfileCount >= 5
    ? (hasStepsContext ? 'Completo' : 'Quasi pronto')
    : `${coreProfileCount}/5 essenziali`;

  // Orari pasti: parse e genera righe per i 4 pasti principali
  const _MT_LABELS = ['Colazione', 'Pranzo', 'Spuntino pom.', 'Cena'];
  const _MT_ICONS  = ['🥣', '🍽️', '🍎', '🍳'];
  function _parseT(str) {
    const m = (str || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    return m ? { s: m[1], e: m[2] } : { s: '', e: '' };
  }
  const configuredMealTimes = [0,1,2,3].reduce((count, i) => {
    const meal = S.meals.off?.[i] || S.meals.on?.[i] || {};
    const { s, e } = _parseT(meal.time);
    return count + (s && e ? 1 : 0);
  }, 0);
  const mealTimeRowsHTML = [0,1,2,3].map(i => {
    const meal = S.meals.off?.[i] || S.meals.on?.[i] || {};
    const {s, e} = _parseT(meal.time);
    return `<div class="mt-row">
      <span class="mt-icon">${_MT_ICONS[i]}</span>
      <span class="mt-name">${_MT_LABELS[i]}</span>
      <div class="mt-time-group">
        <input type="time" class="mt-time-inp" id="mt-start-${i}" value="${s}" onchange="updateMealTime(${i})">
        <span class="mt-sep">–</span>
        <input type="time" class="mt-time-inp" id="mt-end-${i}" value="${e}" onchange="updateMealTime(${i})">
      </div>
    </div>`;
  }).join('');

  const curProf = PROFESSIONI.find(p => p.key === (a.professione || 'desk_sedentary')) || PROFESSIONI[0];
  const profItems = PROFESSIONI.map(p =>
    `<button class="pdrop-item${p.key === curProf.key ? ' sel' : ''}" onclick="setAnagProf('${p.key}')">
      <span class="pdrop-label">${htmlEsc(p.label)}</span>
      <span class="pdrop-desc">${htmlEsc(p.desc)}</span>
    </button>`
  ).join('');

  const freqBtns = ALLENAMENTI.map(al =>
    `<button class="freq-btn${a.allenamentiSett===al.key?' active':''}" data-k="${al.key}"
      onclick="setAnagFreq('${al.key}')" title="${htmlEsc(al.desc)}">${htmlEsc(al.label)}</button>`
  ).join('');

  const PHASE_INFO = {
    bulk:     { lbl:'Bulk',     desc:'Surplus moderato, proteine a 1.7 g/kg, grassi a 1.0 g/kg e carboidrati come leva principale per sostenere performance e crescita.' },
    cut:      { lbl:'Cut',      desc:'Deficit moderato con proteine a 2.0 g/kg e grassi a 0.8 g/kg; i carboidrati si adattano alle calorie residue.' },
    mantieni: { lbl:'Mantieni', desc:'Target vicino al mantenimento con proteine a 1.6 g/kg, grassi a 0.9 g/kg e carboidrati in residuo.' },
  };
  const phaseBtns = Object.entries(PHASE_INFO).map(([id, info]) =>
    `<button class="goal-phase-btn${g.phase===id?' active-'+id:''}" data-phase="${id}" onclick="setGoalPhase('${id}', false);_updateFabbisognoPreview()">${info.lbl}</button>`
  ).join('');
  const activePhaseDesc = PHASE_INFO[g.phase]?.desc || '';
  const isPrimaryExpanded = !!S.profileUi.primaryExpanded;

  document.getElementById('prof-card').innerHTML = `
    <button class="profile-collapse-head${isPrimaryExpanded ? ' expanded' : ''}" onclick="toggleProfilePrimaryCard()">
      <span class="profile-collapse-title">Dati base e target</span>
      <span class="profile-collapse-meta">
        <span class="profile-collapse-badge ${profileStateCls}">${profileStateText}</span>
        <svg class="profile-collapse-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </span>
    </button>
    ${isPrimaryExpanded ? `<div class="profile-collapse-body">
    <div class="anag-section-title">Anagrafica</div>
    <div class="anag-grid">
      <div class="anag-field anag-field-name">
        <div class="field-label-row">
          <label class="anag-label">Nome</label>
          <div class="name-char-count" id="anag-nome-count">${Math.min(String(a.nome || '').length, 40)}/40</div>
        </div>
        <input id="anag-nome" class="anag-input" maxlength="40" autocomplete="name" value="${htmlEsc(a.nome||'')}" oninput="_handleAnagInput('anag-nome');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-nome',{forceValidate:true})">
        <div class="anag-field-error" id="anag-error-nome"></div>
      </div>
      <div class="anag-field anag-field-sex">
        <label class="anag-label">Sesso</label>
        <div class="sesso-toggle">
          <button class="sesso-btn${a.sesso==='m'?' active':''}" data-s="m" onclick="setAnagSesso('m')">M</button>
          <button class="sesso-btn${a.sesso==='f'?' active':''}" data-s="f" onclick="setAnagSesso('f')">F</button>
        </div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Età</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-eta" class="anag-input anag-spin-input" type="number" min="10" max="99" inputmode="numeric" value="${a.eta||''}" oninput="_handleAnagInput('anag-eta');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-eta',{forceValidate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',-1)">▼</button></div>
          </div>
          <span class="anag-unit">anni</span>
        </div>
        <div class="anag-field-error" id="anag-error-eta"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Altezza</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-altezza" class="anag-input anag-spin-input" type="number" min="120" max="250" inputmode="numeric" value="${a.altezza||''}" oninput="_handleAnagInput('anag-altezza');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-altezza',{forceValidate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',-1)">▼</button></div>
          </div>
          <span class="anag-unit">cm</span>
        </div>
        <div class="anag-field-error" id="anag-error-altezza"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Peso</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-peso" class="anag-input anag-spin-input" type="number" min="30" max="300" step="0.1" inputmode="decimal" value="${a.peso||''}" oninput="_handleAnagInput('anag-peso');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-peso',{forceValidate:true})">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',-1)">▼</button></div>
          </div>
          <span class="anag-unit">kg</span>
        </div>
        <div class="anag-field-error" id="anag-error-peso"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">% Grasso <span class="anag-opt">(opz.)</span></label>
        <div class="anag-input-wrap">
          <input id="anag-grasso" class="anag-input" type="number" min="3" max="60" step="0.1" inputmode="decimal" value="${a.grassoCorporeo||''}" placeholder="—" oninput="_handleAnagInput('anag-grasso');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-grasso',{forceValidate:true})">
          <span class="anag-unit">%</span>
        </div>
        <div class="anag-field-error" id="anag-error-grasso"></div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Passi medi <span class="anag-opt">(opz.)</span></label>
        <div class="anag-input-wrap">
          <input id="anag-passi" class="anag-input" type="number" min="1000" max="40000" step="100" inputmode="numeric" value="${a.passiGiornalieri||''}" placeholder="Es. 8000" oninput="_handleAnagInput('anag-passi');_updateFabbisognoPreview()" onblur="_handleAnagInput('anag-passi',{forceValidate:true})">
          <span class="anag-unit">passi</span>
        </div>
        <div class="anag-field-error" id="anag-error-passi"></div>
      </div>
    </div>

    <div class="anag-section-title" style="margin-top:22px">Attività</div>
    <div class="anag-field anag-field-wide" style="margin-bottom:12px">
      <label class="anag-label">Professione</label>
      <div class="pdrop" id="pdrop">
        <button class="pdrop-trigger" onclick="toggleProfDropdown(event)">
          <span id="pdrop-cur">${htmlEsc(curProf.label)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="pdrop-chevron"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="pdrop-list" id="pdrop-list">${profItems}</div>
      </div>
    </div>
    <div class="anag-field anag-field-wide">
      <label class="anag-label">Allenamenti / sett.</label>
      <div class="freq-toggle">${freqBtns}</div>
    </div>

    <div class="anag-section-title" style="margin-top:22px">Obiettivo</div>
    <div class="goal-card" style="margin-bottom:0">
      <div class="goal-phase-btns">${phaseBtns}</div>
      <div class="goal-phase-desc" id="goal-phase-desc">${activePhaseDesc}</div>
    </div>

    <div class="anag-section-title" style="margin-top:22px">Fabbisogno</div>
    <div class="fabbisogno-card" id="fab-preview">
      <div class="fab-empty">Caricamento…</div>
    </div>

    <button class="btn btn-primary anag-save-btn" onclick="saveAnagrafica()">Salva profilo</button>
    </div>` : ''}`;

  // ── Card 2: Orari pasti ──
  const timesEl = document.getElementById('prof-times-card');
  if (timesEl) timesEl.innerHTML = `
    <div class="profile-card-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Profilo</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Orari pasti</div>
          <span class="support-mini-state ${configuredMealTimes === 4 ? 'done' : configuredMealTimes > 0 ? 'progress' : 'idle'}">${configuredMealTimes}/4</span>
        </div>
        <div class="support-mini-sub">Orari guida per tenere la giornata piu ordinata.</div>
      </div>
    </div>
    <div class="mt-card">${mealTimeRowsHTML}</div>`;

  const foodsEl = document.getElementById('prof-foods-card');
  if (foodsEl) foodsEl.innerHTML = favoriteFoodsProfileRedirectHTML();

  setTimeout(_updateFabbisognoPreview, 0);
}

function toggleProfilePrimaryCard() {
  if (!S.profileUi || typeof S.profileUi !== 'object') S.profileUi = {};
  S.profileUi.primaryExpanded = !S.profileUi.primaryExpanded;
  renderAnagrafica();
}
