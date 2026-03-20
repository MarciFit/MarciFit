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
  const checked = (S.suppChecked && S.suppChecked[dateKey]) || [];
  return (S.supplements || []).find(s => s.active && !checked.includes(s.id)) || null;
}

function actionCtaIconHTML(icon) {
  return `<span class="action-cta-mark"><span class="action-cta-circle">${icon}</span><span class="action-cta-plus">+</span></span>`;
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
      <span class="mc-item-grams">${it.grams} g</span>
      <span class="mc-item-kcal">${itK} kcal</span>
      <button class="fir-del" onclick="removeLogItem('${dateKey}','${key}',${ii});event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><polyline points="2,3.5 11,3.5"/><path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M10 3.5L9.3 10.5a1 1 0 01-1 .9H4.7a1 1 0 01-1-.9L3 3.5"/><line x1="5.5" y1="6" x2="5.5" y2="9"/><line x1="7.5" y1="6" x2="7.5" y2="9"/></svg></button>
    </div>`;
  }).join('');

  const logSummary = hasLog ? `<div class="mc-real-intake">
    <span class="mc-real-label">Apporto reale:</span>
    <span class="mc-real-values">
      <span class="mc-real-kcal">${logMacros.kcal} kcal</span>
      <span class="mc-real-sep">·</span>
      <span class="mc-real-p">P ${logMacros.p.toFixed(1)}g</span>
      <span class="mc-real-sep">·</span>
      <span class="mc-real-c">C ${logMacros.c.toFixed(1)}g</span>
      <span class="mc-real-sep">·</span>
      <span class="mc-real-f">G ${logMacros.f.toFixed(1)}g</span>
    </span>
  </div>
  <div class="mc-log-clear-row">
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
      <div class="mc-log-search" id="mls-${domKey}" style="display:none">
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
  if (n.includes('merenda'))   return 'merenda';
  if (n.includes('spuntino'))  return 'spuntino';
  return null;
}

function mealCardHTML(type, i, mode, isCurrent=false) {
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
  const done  = _hasLog;

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
    // Always show cur / tgt so every meal card has the same format
    const kcalHTML = `<span class="mc-badge-kcal-cur">${curK}</span><span class="mc-badge-kcal-sep">/</span><span class="mc-badge-kcal-tgt">${dispK} kcal</span>`;
    const macHTML  = `P <span class="mc-badge-mac-cur">${curP}</span><span class="mc-badge-mac-sep">/</span>${dispP}g&thinsp;·&thinsp;C <span class="mc-badge-mac-cur">${curC}</span><span class="mc-badge-mac-sep">/</span>${dispC}g&thinsp;·&thinsp;G <span class="mc-badge-mac-cur">${curF}</span><span class="mc-badge-mac-sep">/</span>${dispF}g`;
    targetBadge = `<div class="mc-target-badge">
        <div class="mc-badge-label">🎯 OBIETTIVO</div>
        <div class="mc-badge-kcal">${kcalHTML}</div>
        <div class="mc-badge-macros">${macHTML}</div>
      </div>`;
  }

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
    const logMacros = logItems.reduce((acc, it) => {
      const g = it.grams / 100;
      return { kcal: acc.kcal + Math.round(it.kcal100*g), p: acc.p + it.p100*g, c: acc.c + it.c100*g, f: acc.f + it.f100*g };
    }, {kcal:0, p:0, c:0, f:0});
    const hasLog = logItems.length > 0;

    const logRows = logItems.map((it, ii) => {
      const itK = Math.round(it.kcal100 * it.grams / 100);
      return `<div class="mc-log-row">
        <span class="mc-item-dot"></span>
        <span class="mc-item-name">${htmlEsc(it.name)}</span>
        <span class="mc-item-grams">${it.grams} g</span>
        <span class="mc-item-kcal">${itK} kcal</span>
        <button class="fir-edit" onclick="editLogItem('${dateKey}',${i},${ii});event.stopPropagation()" title="Modifica grammatura"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="fir-del" onclick="removeLogItem('${dateKey}',${i},${ii});event.stopPropagation()"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><polyline points="2,3.5 11,3.5"/><path d="M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1"/><path d="M10 3.5L9.3 10.5a1 1 0 01-1 .9H4.7a1 1 0 01-1-.9L3 3.5"/><line x1="5.5" y1="6" x2="5.5" y2="9"/><line x1="7.5" y1="6" x2="7.5" y2="9"/></svg></button>
      </div>`;
    }).join('');

    const logSummary = hasLog
      ? `<div class="mc-real-intake">
          <span class="mc-real-label">Apporto reale:</span>
          <span class="mc-real-values">
            <span class="mc-real-kcal">${logMacros.kcal} kcal</span>
            <span class="mc-real-sep">·</span>
            <span class="mc-real-p">P ${logMacros.p.toFixed(1)}g</span>
            <span class="mc-real-sep">·</span>
            <span class="mc-real-c">C ${logMacros.c.toFixed(1)}g</span>
            <span class="mc-real-sep">·</span>
            <span class="mc-real-f">G ${logMacros.f.toFixed(1)}g</span>
          </span>
        </div>
        <div class="mc-log-clear-row">
          <button class="mc-log-clear" onclick="clearLogMeal('${dateKey}',${i});event.stopPropagation()" title="Azzera tutti gli alimenti del pasto" aria-label="Azzera tutti gli alimenti del pasto">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            <span>Azzera</span>
          </button>
        </div>` : '';
    const emptyStateHTML = hasLog ? '' : `<div class="mc-empty-state">
      <span class="mc-empty-dot"></span>
      <span class="mc-empty-text">Nessun alimento loggato per questo pasto</span>
    </div>`;

    // Template picker: filter templates matching this meal type
    const mealType = getMealTypeFromName(base.name);
    const matchingTmpls = (S.templates || []).filter(t => {
      if (!mealType) return false;
      const tmplType = (t.mealType || t.tag || '').toLowerCase();
      return tmplType.includes(mealType);
    });
    const tmplPickerHTML = matchingTmpls.length ? `
      <div class="mc-tmpl-picker">
        <div class="mc-tmpl-title">📋 Da template</div>
        ${matchingTmpls.map(t => {
          const mk = t.items.reduce((s,it) => s + Math.round(it.kcal100*it.grams/100), 0);
          const mp = t.items.reduce((s,it) => s + it.p100*it.grams/100, 0);
          return `<div class="mc-tmpl-row">
            <div class="mc-tmpl-info">
              <div class="mc-tmpl-name">${htmlEsc(t.name)}</div>
              <div class="mc-tmpl-macros">${mk} kcal · P ${mp.toFixed(1)}g</div>
            </div>
            <button class="mc-tmpl-load" onclick="loadTemplateToMeal('${t.id}','${dateKey}',${i});event.stopPropagation()">Carica</button>
          </div>`;
        }).join('')}
      </div>
      <div class="mc-tmpl-sep">— oppure cerca alimento —</div>` : '';

    return `<div class="mc-log-panel" id="mlp-${domKey}">
      ${hasLog ? `<div class="mc-log-items">${logRows}</div>${logSummary}` : emptyStateHTML}
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

  // + button (today mode only) — blue round button
  const addBtn = mode !== 'today' ? '' :
    `<button class="mc-add-btn" onclick="toggleLogSearch('${domKey}');event.stopPropagation()" title="Aggiungi alimento"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>`;

  const clockSVG = `<svg class="mc-clock-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 14"/></svg>`;

  const currentBadge = isCurrent && mode === 'today'
    ? `<span class="mc-now-badge">ORA</span>`
    : '';

  return `
    <div class="mc${done && mode==='today' ? ' checked' : ''}${isCurrent && mode==='today' ? ' mc-current' : ''}" id="mc-${domKey}">
      <div class="mc-row">
        ${checkZone}
        <div class="mc-body" style="cursor:default">
          <div class="mc-top">
            <span class="mc-icon">${base.icon}</span>
            <span class="mc-name-group">
              <span class="mc-name">${htmlEsc(base.name)}</span>
              ${mode === 'today' ? `<button class="mc-rename-btn" onclick="renameMeal('${type}',${i});event.stopPropagation()" title="Rinomina pasto"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>` : ''}
            </span>
            <span class="mc-time-wrap">${currentBadge}<span class="mc-time">${clockSVG}${base.time}</span></span>
          </div>
          ${mode === 'today' ? `<div class="mc-meta-row">
            ${ai !== undefined && alts[ai] ? `<span class="mc-alt-badge">${alts[ai].label}</span>` : ''}
          </div>` : ''}
          ${mode === 'today' ? `<div class="mc-badge-row">${targetBadge}${addBtn}</div>` : targetBadge}
          ${mode !== 'today' ? `<div class="${ingrCls}">${m.ingr}</div>` : ''}
        </div>
        ${editBtn}
      </div>
      ${mode !== 'today' ? `<div class="mc-pills">${pills}</div>` : ''}
      ${todayLogHTML}
      ${mode === 'edit' ? altsChipsHTML : ''}
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
    return streak >= 5 ? 'Streak positiva · continua così' : 'Giorno OFF · ricarica le energie';
  } else {
    // Sera
    if (streak >= 5) return 'Ottima continuità · si vede nel tempo';
    return type === 'on' ? 'Giornata di allenamento quasi conclusa' : 'Buon recupero · a domani';
  }
}

// ─── Frase motivazionale giornaliera ─────────────────────────────────────────
function getDailyQuote(dateKey) {
  const QUOTES = [
    // Mindset
    { text: 'La disciplina è fare ciò che va fatto, anche quando non ne hai voglia.', attr: '' },
    { text: 'Il progresso, non la perfezione, è l\'obiettivo che cambia tutto.', attr: '' },
    { text: 'Ogni allenamento è un voto per la persona che vuoi diventare.', attr: 'James Clear' },
    { text: 'Non cercare la motivazione — costruisci l\'abitudine.', attr: '' },
    { text: 'La fatica di oggi è la forza di domani.', attr: '' },
    { text: 'La coerenza batte l\'intensità: anni di lavoro costante superano settimane di sforzo massimo.', attr: '' },
    { text: 'Non confrontarti con gli altri — confrontati con chi eri ieri.', attr: '' },
    { text: 'Fai del tuo allenamento una priorità, non un\'opzione.', attr: '' },
    { text: 'Il successo non è un evento, è una serie di scelte quotidiane.', attr: '' },
    { text: 'Chi si allena con testa vince su chi si allena con solo grinta.', attr: '' },
    // Scienza
    { text: 'Il sovraccarico progressivo è l\'unica legge universale del miglioramento fisico.', attr: '' },
    { text: 'L\'ipertrofia muscolare richiede stimolo, nutrizione e recupero — tutti e tre, sempre.', attr: '' },
    { text: '1.6–2.2 g di proteine per kg di peso corporeo: è il range che massimizza la crescita muscolare.', attr: 'Morton et al., 2018' },
    { text: 'I carboidrati non fanno ingrassare — l\'eccesso calorico sì. I carb alimentano la performance.', attr: '' },
    { text: 'Il 70% dei guadagni di forza nelle prime settimane è neurologico, non muscolare.', attr: '' },
    { text: 'Una disidratazione del 2% riduce la forza muscolare del 10–20%.', attr: 'ACSM Guidelines' },
    { text: 'Il surplus calorico ottimale per il muscle gain è di 200–300 kcal/die — oltre si accumula solo grasso.', attr: '' },
    { text: 'La creatina monoidrato è il supplemento più studiato e sicuro per la performance in forza.', attr: 'ISSN, 2017' },
    { text: 'Dormire meno di 7 ore riduce significativamente la capacità di sintesi muscolare.', attr: 'Walker, 2017' },
    { text: 'Allenare ogni muscolo 2 volte a settimana è superiore all\'una: la frequenza conta quanto il volume.', attr: 'Schoenfeld, 2016' },
    // Recupero
    { text: 'Il sonno è il tuo allenamento invisibile — è quando i muscoli crescono davvero.', attr: '' },
    { text: 'Il riposo non è pigrizia: è la parte del piano che completa il lavoro in palestra.', attr: '' },
    { text: 'Nei giorni OFF i muscoli non si indeboliscono — si ricostruiscono più forti.', attr: '' },
    { text: 'La caseina prima di dormire supporta la sintesi proteica per 7–8h durante la notte.', attr: 'Res et al., 2012' },
    { text: 'Il cortisolo cronico da stress riduce la sintesi muscolare: gestire lo stress è parte del training.', attr: '' },
    { text: 'Ascolta il tuo corpo: un giorno di riposo extra oggi vale più di una settimana di stop forzato domani.', attr: '' },
    { text: 'La supercompensazione avviene nelle 24–72h dopo lo stimolo: il recupero è parte del training.', attr: '' },
    { text: 'Non è l\'allenamento che ti rende più forte — è il recupero dall\'allenamento.', attr: '' },
    { text: 'Il recupero attivo — camminare, stretching — accelera l\'eliminazione dei metaboliti muscolari.', attr: '' },
    { text: 'Corpo e mente si allenano insieme: il recupero mentale è parte del recupero fisico.', attr: '' },
    // Nutrizione
    { text: 'Non esiste cibo "cattivo" — esistono quantità sbagliate e momenti sbagliati.', attr: '' },
    { text: 'La costanza nel mangiare bene per mesi conta più della perfezione per una settimana.', attr: '' },
    { text: 'Il meal prep non è ossessione — è rispetto per i tuoi obiettivi futuri.', attr: '' },
    { text: 'Distribuire le proteine in 4 pasti da 0.4 g/kg massimizza la sintesi muscolare nelle 24h.', attr: 'ISSN, 2017' },
    { text: 'I grassi non sono nemici: sono essenziali per gli ormoni anabolici, incluso il testosterone.', attr: '' },
    { text: 'Mangiare lentamente riduce l\'intake calorico totale del 10–15% — la sazietà arriva dopo 20 minuti.', attr: '' },
    { text: 'La fibra alimentare migliora il microbiota intestinale, che influenza l\'umore e l\'energia.', attr: '' },
    { text: 'Il deficit calorico deve essere moderato (−300/−500 kcal) per preservare la massa muscolare.', attr: '' },
    { text: 'Ogni grammo di glicogeno muscolare trattiene 3g di acqua — "gonfiore" da carb è energia immagazzinata.', attr: '' },
    { text: 'La finestra anabolica post-workout dura ore, non minuti — mangia bene nella giornata, non solo dopo.', attr: '' },
  ];
  const d = dateKey || localDate(new Date());
  const base = new Date(d.slice(0,4) + '-01-01');
  const dayOfYear = Math.round((new Date(d) - base) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
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
function generateAlerts(type, h, dateKey) {
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
  } else if (ctx.isToday && ctx.hasLunchSlot && ctx.lunchStatus === 'overdue' && !ctx.hasLunch) {
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

  return finalizeAlerts(alerts, 2);
}

function splitTodayAlerts(type, dateKey) {
  const alerts = generateAlerts(type, new Date().getHours(), dateKey);
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
  const supportAlerts = alerts.filter(a => a.type === 'supp' || String(a.id || '').startsWith('supp-'));
  const focusAlerts = alerts.filter(a => !supportAlerts.includes(a) && a.type !== 'ok');
  const statusAlerts = alerts.filter(a => a.type === 'ok');
  const signals = [...supportAlerts, ...focusAlerts, ...statusAlerts].slice(0, 2).map(alert => ({
    tone: alert.type === 'err' || alert.type === 'supp' ? 'err' : alert.type === 'warn' ? 'warn' : 'ok',
    text: alert.type === 'supp'
      ? 'Integratore da segnare'
      : alert.id === 'day-centered'
        ? 'Giornata in linea'
        : alert.text,
    action: resolveAction(alert),
  }));

  return {
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

function renderGreeting(type, now) {
  const DAYS   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const h = now.getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const nomeCompleto = S.anagrafica?.nome || S.profilo.find(r=>r.l==='Nome')?.v || 'Federico Marci';
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
    const tdee = S.anagrafica ? calcTDEE(S.anagrafica) : null;
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
      if (tipBmr && bmr) tipBmr.innerHTML = `<div class="tip-title">BMR · Metabolismo Basale</div>
        <div class="tip-desc">Calorie bruciate a <strong>completo riposo</strong>.<br>
        Formula Mifflin-St Jeor (M): <strong>10×${peso} + 6.25×${alt} − 5×${eta} + 5 = ${bmr} kcal</strong></div>`;
      const tipTdee = document.getElementById('tip-tdee');
      if (tipTdee && tdee) {
        const surplus = S.macro.on.k - tdee;
        const palVal = S.anagrafica ? calcPAL(S.anagrafica) : 1.4;
        tipTdee.innerHTML = `<div class="tip-title">TDEE · Fabbisogno Calorico Totale</div>
          <div class="tip-desc">BMR × <strong>${palVal}</strong> (PAL) = <strong>~${tdee} kcal/die</strong>.<br>
          Il tuo piano ON (<strong>${S.macro.on.k} kcal</strong>) prevede un surplus di <strong style="color:${surplus>0?'var(--on)':'var(--red)'}"> ${surplus>0?'+':''}${surplus} kcal</strong>.</div>`;
      }
    }, 0);
  }

  // Streak badge
  const streak = calcStreak();
  const sbs = streakBadgeStyle(streak);
  const streakBadge = `<span class="tg-streak tg-streak-${sbs.tier}${streak === 0 ? ' is-zero' : ''}" onmouseenter="showTip('tip-streak',this)" onmouseleave="hideTip('tip-streak')">
    <span class="tg-streak-medal"><span class="tg-streak-icon">${sbs.emoji}</span></span>
    <span class="tg-streak-copy">
      <span class="tg-streak-label">Streak</span>
      <span class="tg-streak-val">${streak}</span>
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

  // Chip giorno ON/OFF
  const isOn = type === 'on';
  const chipTxt = isOn ? 'Giorno ON' : 'Giorno OFF';
  const chipIcon = isOn ? '●' : '◐';
  const dayChip = `<button class="tg-day-chip tg-day-chip-${isOn ? 'on' : 'off'}" onclick="setDay('${isOn?'off':'on'}')">
    <span class="tg-day-chip-dot">${chipIcon}</span>
    <span class="tg-day-chip-text">${chipTxt}</span>
  </button>`;

  // Badge fase obiettivo rimosso (tracking settimane rimandato a implementazione futura)
  let goalBadge = '';

  // Frase del giorno
  const dateKey = S.selDate || localDate(now);
  const quote   = getDailyQuote(dateKey);
  const quoteHTML = `<div class="tg-quote">
    <div class="tg-quote-kicker">Frase del giorno</div>
    <div class="tg-quote-text">"${quote.text}"</div>
    ${quote.attr ? `<div class="tg-quote-attr">— ${quote.attr}</div>` : ''}
  </div>`;

  const greetingEl = document.getElementById('today-greeting');
  if (greetingEl) {
    greetingEl.classList.remove('is-on', 'is-off');
    greetingEl.classList.add(isOn ? 'is-on' : 'is-off');
  }

  document.getElementById('today-greeting').innerHTML = `
    <div class="tg-hero-main">
      <div class="tg-hero-copy">
        <div class="tg-date-row">
          <div class="tg-date">Oggi · ${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}</div>
        </div>
        <div class="tg-mobile-meta">
          ${dayChip}
          ${streakBadge}
        </div>
        <div class="tg-hello">${saluto}, <em>${nome}.</em></div>
        <div class="tg-subtext">${getGreetingSubtext(h, type, streak)}</div>
      </div>
    </div>
    <div class="tg-hero-body">
      <div class="tg-hero-block tg-hero-block-quote">${quoteHTML}</div>
    </div>`;
}

function renderTodaySignals(type, dateKey) {
  const el = document.getElementById('today-signal-row');
  if (!el) return;
  const model = splitTodayAlerts(type, dateKey);
  if (!model.signals.length) { el.innerHTML = ''; return; }
  const visibleSignals = model.signals.slice(0, 3);
  const hiddenCount = Math.max(model.signals.length - visibleSignals.length, 0);
  el.innerHTML = `
    <div class="today-signal-row">
      ${visibleSignals.map(signal => signal.action
        ? `<button class="today-signal today-signal-${signal.tone} is-action" onclick="${signal.action}">${signal.text}</button>`
        : `<div class="today-signal today-signal-${signal.tone}">${signal.text}</div>`
      ).join('')}
      ${hiddenCount ? `<div class="today-signal today-signal-muted">+${hiddenCount} altri segnali</div>` : ''}
    </div>`;
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
  const trackedType = getTrackedDayType(dateKey, getScheduledDayType(dateKey));
  const peso = S.anagrafica?.peso || 0;
  const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
  const totalMl = baseMl + (trackedType === 'on' ? 350 : 0);
  const waterTarget = Math.max(6, Math.round(totalMl / 250));
  const noteValue = (S.notes?.[dateKey] || '').trim();
  el.innerHTML = `
    <div class="today-quick-actions-head">
      <div class="today-dashboard-block-title">Salti rapidi</div>
      <div class="today-quick-actions-sub">Acqua, routine e note senza perdere il filo della giornata.</div>
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
  const model = splitTodayAlerts(type, dateKey);
  const alert = model.supportAlert;
  if (!alert) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="today-context-alert today-context-alert-support today-context-alert-support-compact">
      <div class="today-context-alert-kicker">Da non perdere</div>
      <div class="today-context-alert-main">${alert.text}</div>
      ${alert.ctaLabel && alert.ctaAction ? `<button class="today-context-alert-btn" onclick="${alert.ctaAction}">${alert.ctaLabel}</button>` : ''}
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

  document.getElementById('week-cal').innerHTML = Array.from({length:7}, (_,i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dow    = d.getDay();
    const dStr   = localDate(d);
    const isTod  = dStr === todayStr;
    const isSel  = dStr === S.selDate;
    const isPast = d < now && !isTod;
    const dayInfo = S.doneByDate[dStr];
    const isFull  = !!dayInfo && dayInfo.done > 0 && dayInfo.total > 0 && dayInfo.done >= dayInfo.total;
    const hasDone = !!dayInfo && (dayInfo.activityCount || 0) > 0;

    // Visual type: if meals were logged for this day, use that type.
    // If no dayInfo but this is the currently viewed date, use S.day (reflects manual ON/OFF toggle).
    // Otherwise fall back to the scheduled ON/OFF from onDays.
    const scheduledOn = ON_SET.has(dow);
    const isViewedDate = dStr === (S.selDate || todayStr);
    const visualOn = dayInfo ? dayInfo.type === 'on' : (isViewedDate ? S.day === 'on' : scheduledOn);
    // Type to pass when clicking (what plan to show)
    const clickType = visualOn ? 'on' : 'off';

    const cls = [
      'wc-day',
      visualOn ? 'wc-on' : 'wc-off',
      isTod  ? 'today' : '',
      isSel  ? 'sel'   : '',
      isPast ? 'past'  : '',
    ].filter(Boolean).join(' ');

    const doneTitle = !dayInfo ? '' : [
      dayInfo.total > 0 ? `${dayInfo.done}/${dayInfo.total} pasti` : '',
      dayInfo.suppDone > 0 ? `${dayInfo.suppDone} integratori` : '',
      dayInfo.waterCount > 0 ? `${dayInfo.waterCount} bicchieri` : '',
    ].filter(Boolean).join(' · ');
    const doneBadge = hasDone
      ? `<div class="wc-done${isFull?' full':''}" title="${doneTitle}"></div>`
      : '';

    // Show a small amber dot inline in the badge when logged type differs from schedule
    const overrideDot = dayInfo && (visualOn !== scheduledOn)
      ? `<span title="Piano ${visualOn?'ON':'OFF'} (diverso dalla programmazione)" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--amber);vertical-align:middle;margin-left:3px;opacity:.9;flex-shrink:0"></span>`
      : '';

    return `<div class="${cls}" onclick="calSelectDay('${dStr}','${clickType}')" title="${d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}">
      ${doneBadge}
      <div class="wc-name">${isTod ? 'OGGI' : DOW_NAMES[i]}</div>
      <div class="wc-num">${d.getDate()}</div>
      <div class="wc-badge" style="display:flex;align-items:center;justify-content:center">${visualOn?'ON':'OFF'}${overrideDot}</div>
    </div>`;
  }).join('');
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

  const el = document.getElementById('macro-strip');
  if (!el) return {eK,eP,eC,eF};

  // --- Kcal hero ---
  const kPct = tgt.k > 0 ? Math.min(eK / tgt.k, 1) * 100 : 0;
  const kRem = tgt.k - eK;
  const kRc  = kRem < 0 ? 'err' : kRem < tgt.k * 0.15 ? 'warn' : 'ok';
  const kRt  = kRem <= 0
    ? (eK > tgt.k ? `+${Math.round(eK - tgt.k)} kcal in più` : 'obiettivo raggiunto ✓')
    : `–${Math.abs(Math.round(kRem))} mancanti`;

  // --- Macro 3 card ---
  const macros = [
    { cls:'prot', icon:'🥩', lbl:'Proteine', eaten:eP, tgt:tgt.p, unit:'g' },
    { cls:'carb', icon:'🍚', lbl:'Carb',     eaten:eC, tgt:tgt.c, unit:'g' },
    { cls:'fat',  icon:'🧈', lbl:'Grassi',   eaten:eF, tgt:tgt.f, unit:'g' },
  ];

  const macroCards = macros.map(m => {
    const pct = m.tgt > 0 ? Math.min(m.eaten / m.tgt, 1) * 100 : 0;
    const rem = m.tgt - m.eaten;
    const rc  = rem < 0 ? 'err' : rem < m.tgt * 0.15 ? 'warn' : 'ok';
    const rt  = rem <= 0
      ? (m.eaten > m.tgt ? `+${Math.round(m.eaten - m.tgt)}g` : '✓')
      : `–${Math.abs(Math.round(rem))}g`;
    return `<div class="ms-macro-card ${m.cls}" onclick="openMacroDetail('${m.cls}')" style="cursor:pointer">
      <div class="ms-macro-icon">${m.icon}</div>
      <div class="ms-macro-val">${m.eaten}<span class="ms-macro-unit">${m.unit}</span></div>
      <div class="ms-macro-lbl">${m.lbl}</div>
      <div class="ms-macro-bar"><div class="ms-macro-fill" style="width:${pct}%"></div></div>
      <div class="ms-macro-rem ${rc}">${rt} / ${m.tgt}${m.unit}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="ms-kcal-card">
      <div class="ms-kcal-top">
        <div class="ms-kcal-eaten">
          <span class="ms-kcal-icon">🔥</span>
          <span class="ms-kcal-val">${eK.toLocaleString('it-IT')}</span>
          <span class="ms-kcal-unit">kcal</span>
        </div>
        <div class="ms-kcal-rem ${kRc}">${kRt}</div>
      </div>
      <div class="ms-kcal-bar">
        <div class="ms-kcal-fill ${kRc}" style="width:${kPct}%"></div>
      </div>
      <div class="ms-kcal-target">obiettivo: ${tgt.k.toLocaleString('it-IT')} kcal</div>
    </div>
    <div class="ms-macros-row">${macroCards}</div>`;

  return {eK, eP, eC, eF};
}
function renderToday() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const now   = new Date();

  renderGreeting(type, now);
  renderWeekCal(now);
  renderTodayLog(); // cards + macro + alerts + progress
  renderTodayQuickActions(type, S.selDate || localDate(now));

  // Notes
  const noteKey   = S.selDate || localDate(now);
  const noteInput = document.getElementById('notes-input');
  if (noteInput && !noteInput.dataset.loaded) {
    noteInput.value = S.notes[noteKey] || '';
    noteInput.dataset.loaded = '1';
    noteInput.dataset.key = noteKey;
  }
  renderNotes();
  renderSuppToday();
  checkWeeklyCheckin();
}

function getCurrentMealState(type, dateKey) {
  const isTodayView = !S.selDate || S.selDate === localDate();
  if (!isTodayView) return { index: -1, kind: 'none' };

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
  if (mealState.index === -1) { el.innerHTML = ''; return; }

  const meal = mealState.isExtra ? EXTRA_MEALS[mealState.key] : effMeal(type, mealState.key);
  const mealLog = S.foodLog[dateKey]?.[mealState.key] || [];
  const hasLog = mealLog.length > 0;
  const logMacros = mealLog.reduce((acc, item) => {
    const grams = (item.grams || 0) / 100;
    acc.kcal += Math.round((item.kcal100 || 0) * grams);
    acc.p += (item.p100 || 0) * grams;
    acc.c += (item.c100 || 0) * grams;
    acc.f += (item.f100 || 0) * grams;
    return acc;
  }, { kcal: 0, p: 0, c: 0, f: 0 });
  const pillClass = mealState.kind === 'now' ? 'now' : 'next';
  const pillText = mealState.kind === 'now' ? 'Adesso' : 'Prossimo';
  const targetId = mealState.isExtra ? `mc-extra-${mealState.key}` : `mc-${type}-${mealState.key}`;
  const mealIcon = actionCtaIconHTML('🍽️');
  const subText = hasLog
    ? 'Hai gia iniziato questo pasto: puoi aggiungere altri alimenti o rifinire le grammature.'
    : (mealState.kind === 'now'
      ? 'Questo e il pasto su cui conviene agire adesso per tenere il tracking semplice e veloce.'
      : 'Questo e il prossimo snodo della giornata: puoi prepararlo in anticipo o loggarlo appena inizi.');
  const progressLabel = hasLog ? 'Pasto avviato' : 'Ancora da loggare';
  const progressValue = hasLog ? `${mealLog.length} aliment${mealLog.length === 1 ? 'o' : 'i'}` : '0 alimenti';
  const insightText = hasLog
    ? `${logMacros.kcal} kcal inserite`
    : `Aprilo per inserire il primo alimento`;
  const macroText = hasLog
    ? `P ${logMacros.p.toFixed(1)}g · C ${logMacros.c.toFixed(1)}g · G ${logMacros.f.toFixed(1)}g`
    : 'Il primo inserimento fa partire tracking e progressione del giorno';
  const focusAlert = alertModel?.focusAlert || null;
  const hasFavFoods = (S.favoriteFoods || []).length > 0;
  const focusAlertHtml = focusAlert ? `
    <div class="today-context-alert">
      <div class="today-context-alert-kicker">Segnale del momento</div>
      <div class="today-context-alert-main">${focusAlert.text}</div>
      <div class="today-context-alert-actions">
        ${focusAlert.ctaLabel && focusAlert.ctaAction ? `<button class="today-context-alert-btn" onclick="${focusAlert.ctaAction}">${focusAlert.ctaLabel}</button>` : ''}
        ${focusAlert.hasSuggest ? `<button class="today-context-alert-btn is-secondary" onclick="openFoodSuggestion(${focusAlert.remK||0},${focusAlert.remP||0},${focusAlert.remC||0},${focusAlert.remF||0})">${hasFavFoods ? 'Vedi cosa mangiare' : 'Aggiungi cibi preferiti'}</button>` : ''}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="current-meal-focus">
      <div class="current-meal-kicker">Focus del momento</div>
      <div class="current-meal-main">
        <div class="current-meal-copy">
          <div class="current-meal-title">${htmlEsc(meal.name)}</div>
          <div class="current-meal-meta">
            <span class="current-meal-time">${htmlEsc(meal.time || '')}</span>
            <span class="current-meal-pill ${pillClass}">${pillText}</span>
          </div>
          <div class="current-meal-sub">${subText}</div>
          <div class="current-meal-insight">
            <div class="current-meal-insight-top">
              <span class="current-meal-insight-label">${progressLabel}</span>
              <span class="current-meal-insight-value">${progressValue}</span>
            </div>
            <div class="current-meal-insight-main">${insightText}</div>
            <div class="current-meal-insight-foot">${macroText}</div>
          </div>
          ${focusAlertHtml}
        </div>
        <div class="current-meal-actions">
          <button class="current-meal-btn current-meal-btn-main" onclick="document.getElementById('${targetId}')?.scrollIntoView({behavior:'smooth',block:'center'})">
            ${mealIcon}<span>${hasLog ? 'Apri pasto' : 'Vai al pasto'}</span>
          </button>
        </div>
      </div>
    </div>`;
}

// Partial render ? only what changes when log items are added/removed
// Skips greeting and calendar (expensive, unnecessary for log changes)
function renderTodayLog() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const dateKey = S.selDate || localDate();
  const {eK, eP, eC, eF} = renderMacroStrip(type, meals, tgt);
  renderWater();

  // Determine current meal index based on time (only for today's view)
  const mealState = getCurrentMealState(type, dateKey);
  const currentMealIdx = mealState.isExtra ? -1 : mealState.key;
  const alertModel = splitTodayAlerts(type, dateKey);

  const _visibleExtra = getVisibleExtraMealKeys(dateKey);
  let _mealsHTML = '';
  meals.forEach((_, i) => {
    _mealsHTML += mealCardHTML(type, i, 'today', i === currentMealIdx);
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
  renderTodaySignals(type, dateKey);
  renderSupportAlerts(type, dateKey);

  // Progress: count meals with at least one logged item
  const completion = getDayCompletion(dateKey, type);
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${completion.done} / ${completion.total} pasti`;
  if (dpFill)  dpFill.style.width  = `${completion.total ? (completion.done/completion.total)*100 : 0}%`;
}
function renderNotes() {
  const entries = Object.entries(S.notes)
    .filter(([,v]) => v && v.trim())
    .sort((a,b) => b[0].localeCompare(a[0])).slice(0, 20);
  const el = document.getElementById('notes-prev');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = `<div class="notes-empty-state">Nessuna nota recente. Usa questo spazio solo per segnali che vuoi ritrovare piu tardi.</div>`;
    return;
  }
  el.innerHTML = `<div class="notes-hist-label">Storico</div>` +
    entries.map(([k,v]) => `
    <div class="note-item">
      <span class="note-date">${k.split('-').reverse().join('/')}</span>
      <span class="note-text">${esc(v)}</span>
      <button class="note-del" onclick="deleteNote('${k}')" title="Elimina nota">✕</button>
    </div>`).join('');
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

function pianoMiniStatCardHTML(stat) {
  const infoIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6"></path><path d="M12 7.2h.01"></path></svg>`;
  return `<div class="piano-mini-stat ${stat.cls || ''}">
    <div class="piano-mini-stat-top">
      <span class="piano-mini-stat-kicker">${stat.kicker}</span>
      <button class="piano-mini-stat-info" onmouseenter="showPianoSummaryTip('${stat.tipKey}', this)" onmouseleave="hideTip('tip-piano-summary')" onclick="showPianoSummaryTip('${stat.tipKey}', this)" aria-label="Informazioni ${stat.kicker}">${infoIcon}</button>
    </div>
    <div class="piano-mini-stat-main">${stat.main}</div>
    <div class="piano-mini-stat-foot">${stat.foot}</div>
  </div>`;
}

function getLoggedDayMacros(dateKey) {
  const dayLog = S.foodLog?.[dateKey] || {};
  let k = 0, p = 0, c = 0, f = 0;
  Object.values(dayLog).forEach(items => {
    (items || []).forEach(it => {
      const grams = (it.grams || 0) / 100;
      k += Math.round((it.kcal100 || 0) * grams);
      p += (it.p100 || 0) * grams;
      c += (it.c100 || 0) * grams;
      f += (it.f100 || 0) * grams;
    });
  });
  return {
    k,
    p: Math.round(p * 10) / 10,
    c: Math.round(c * 10) / 10,
    f: Math.round(f * 10) / 10,
  };
}
function renderPiano() {
  if (!S.templates) S.templates = [];

  // --- Piano Pasti section ---
  const planType = S.day || S.planTab || 'on';
  S.planTab = planType;
  const plannerState = ensureMealPlannerState(planType);
  const targetDay = S.macro[planType];
  const plannerMeal = S.meals[planType]?.[plannerState.mealIdx];
  const plannerMealType = getMealTypeFromName(plannerMeal?.name || '');
  const templatesForMealType = (S.templates || []).filter(t => {
    if (!plannerMealType) return true;
    return String(t.mealType || t.tag || '').toLowerCase().includes(plannerMealType);
  });
  // Meal cards in edit mode
  const planMealsEl = document.getElementById('piano-meals-list');
  if (planMealsEl) {
    planMealsEl.innerHTML = S.meals[planType].map((_, i) => mealCardHTML(planType, i, 'edit')).join('');
  }
  // Macro summary for the day
  const planMacroEl = document.getElementById('piano-macros-summary');
  if (planMacroEl) {
    const dateKey = S.selDate || localDate();
    const loggedTotals = getLoggedDayMacros(dateKey);
    const remK = targetDay.k - loggedTotals.k;
    const remP = targetDay.p - loggedTotals.p;
    const remC = targetDay.c - loggedTotals.c;
    const remF = targetDay.f - loggedTotals.f;
    const macroGap = Math.abs(remP) + Math.abs(remC) + Math.abs(remF);
    const hasNoIntake = loggedTotals.k === 0 && loggedTotals.p === 0 && loggedTotals.c === 0 && loggedTotals.f === 0;
    const kcalState = hasNoIntake
      ? 'Tutto da coprire'
      : Math.abs(remK) <= 80 ? 'In linea' : (remK < 0 ? 'Sei sopra' : 'Da colmare');
    const macroState = hasNoIntake
      ? 'Macro da coprire'
      : macroGap <= 20 ? 'Macro in ordine' : macroGap <= 40 ? 'Quasi centrati' : 'Da colmare';
    const plannerSummary = plannerMeal
      ? `${plannerMeal.name}${plannerMeal.time ? ` · ${plannerMeal.time}` : ''}`
      : 'Seleziona un pasto';
    planMacroEl.innerHTML =
      `<div class="piano-summary-card">
        <div class="piano-summary-top">
          <span class="piano-summary-badge ${planType}">${planType.toUpperCase()}</span>
          <span class="piano-summary-title">Quadro giornaliero</span>
        </div>
        <div class="piano-summary-main">
          <div class="piano-summary-col">
            <span class="piano-summary-label">Target giorno</span>
            ${macroVisualCardsHTML(targetDay, { size: 'compact' })}
          </div>
        </div>
        <div class="piano-summary-stats">
          ${pianoMiniStatCardHTML({
            cls: hasNoIntake ? 'warn' : remK > 80 ? 'warn' : remK < -80 ? 'ok' : 'neutral',
            tipKey: 'kcal',
            kicker: 'Stato kcal',
            info: 'Confronta le calorie gia registrate oggi con il target del giorno selezionato. Se non hai ancora loggato cibi, il fabbisogno resta tutto da coprire.',
            main: kcalState,
            foot: `${remK > 0 ? '-' : '+'}${Math.abs(Math.round(remK))} kcal`,
          })}
          ${pianoMiniStatCardHTML({
            cls: hasNoIntake ? 'warn' : macroGap > 40 ? 'warn' : macroGap <= 20 ? 'ok' : 'neutral',
            tipKey: 'macro',
            kicker: 'Stato macro',
            info: 'Mostra quanto ti manca ancora oggi per arrivare ai target di proteine, carboidrati e grassi del giorno selezionato.',
            main: macroState,
            foot: `P ${remP > 0 ? '-' : '+'}${Math.abs(remP).toFixed(0)}g · C ${remC > 0 ? '-' : '+'}${Math.abs(remC).toFixed(0)}g · F ${remF > 0 ? '-' : '+'}${Math.abs(remF).toFixed(0)}g`,
          })}
          ${pianoMiniStatCardHTML({
            cls: 'focus',
            tipKey: 'focus',
            kicker: 'Pasto in focus',
            info: 'E il pasto che l’helper sta usando adesso per generare suggerimenti e template utili.',
            main: htmlEsc(plannerMeal?.name || 'Seleziona un pasto'),
            foot: htmlEsc(plannerMeal?.time || 'Helper pronto sul pasto selezionato'),
          })}
          ${pianoMiniStatCardHTML({
            cls: 'template',
            tipKey: 'template',
            kicker: 'Template utili',
            info: 'Conta quanti template in libreria sono compatibili con il tipo di pasto selezionato.',
            main: `${templatesForMealType.length}`,
            foot: plannerMealType ? `Per ${plannerMealType}` : 'Libreria completa',
          })}
        </div>
      </div>`;
  }
  const helperEl = document.getElementById('meal-planner-helper');
  if (helperEl) {
    helperEl.innerHTML = mealPlannerHelperHTML(planType, plannerState);
  }
  const allTags = ['tutti', ...new Set(
    S.templates.flatMap(t => t.tag.split(',').map(x=>x.trim()).filter(Boolean))
  )];

  // Filter pills ? use DOM creation to avoid quote issues
  const filtersEl = document.getElementById('tmpl-filters');
  filtersEl.innerHTML = '';
  allTags.forEach(tag => {
    const btn = document.createElement('button');
    const active = _tmplFilter === tag;
    btn.textContent = tag;
    btn.className = 'tmpl-tag-btn' + (active ? ' active' : '');
    btn.addEventListener('click', () => { _tmplFilter = tag; renderPiano(); });
    filtersEl.appendChild(btn);
  });

  const filtered = _tmplFilter === 'tutti'
    ? S.templates
    : S.templates.filter(t => t.tag.toLowerCase().includes(_tmplFilter.toLowerCase()));
  const sortedFiltered = filtered.slice().sort((a, b) => {
    const aMatch = plannerMealType && String(a.mealType || a.tag || '').toLowerCase().includes(plannerMealType) ? 1 : 0;
    const bMatch = plannerMealType && String(b.mealType || b.tag || '').toLowerCase().includes(plannerMealType) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return String(a.name || '').localeCompare(String(b.name || ''), 'it');
  });

  const listEl = document.getElementById('tmpl-list');
  if (!sortedFiltered.length) {
    listEl.innerHTML = `<div class="tmpl-empty-state">${
      S.templates.length ? 'Nessun template con questo tag.' : 'Nessun template. Creane uno con +.'
    }</div>`;
    return;
  }

  const TMPL_TYPE_EMOJI = {colazione:'🥣', pranzo:'🍽️', cena:'🍳', merenda:'🍎', spuntino:'⚡', altro:'📦'};

  listEl.innerHTML = '';
  listEl.innerHTML = `<div class="tmpl-library-meta">
    <div class="tmpl-library-stat">
      <span class="tmpl-library-kicker">In libreria</span>
      <span class="tmpl-library-value">${S.templates.length}</span>
    </div>
    <div class="tmpl-library-stat">
      <span class="tmpl-library-kicker">Filtro attivo</span>
      <span class="tmpl-library-value">${sortedFiltered.length}</span>
    </div>
    <div class="tmpl-library-stat">
      <span class="tmpl-library-kicker">Utili adesso</span>
      <span class="tmpl-library-value">${templatesForMealType.length}</span>
    </div>
  </div>`;

  sortedFiltered.forEach(t => {
    const macros = t.items.reduce((acc,it) => {
      const g = it.grams/100;
      return {k:acc.k+Math.round(it.kcal100*g), p:acc.p+it.p100*g, c:acc.c+it.c100*g, f:acc.f+it.f100*g};
    }, {k:0,p:0,c:0,f:0});

    const card = document.createElement('div');
    card.className = 'mc';
    card.style.marginBottom = '10px';

    const mealType = t.mealType || (t.tag || '').split(',')[0].trim();
    const typeEmoji = TMPL_TYPE_EMOJI[mealType] || '';
    const typeLbl = mealType ? (mealType.charAt(0).toUpperCase() + mealType.slice(1)) : '';

    const rowsHtml = t.items.map(it => {
      const k = Math.round(it.kcal100*it.grams/100);
      return `<div class="food-item-row" style="padding:5px 0">
        <div class="fir-dot"></div>
        <div class="fir-name">${htmlEsc(it.name)}</div>
        <div class="fir-grams-wrap"><span class="fir-grams" style="border:none;background:none;pointer-events:none">${it.grams}</span><span class="fir-unit">g</span></div>
        <div class="fir-kcal">${k} kcal</div>
      </div>`;
    }).join('');

    card.innerHTML = `
      <div class="tmpl-card-body">
        <div class="tmpl-card-header">
          <span class="tmpl-card-name">${typeEmoji ? typeEmoji + ' ' : ''}${htmlEsc(t.name)}</span>
          ${typeLbl ? `<span class="tmpl-type-badge">${typeLbl}</span>` : ''}
        </div>
        <div class="tmpl-card-macros">
          <span class="tmpl-macro-kcal">🔥 ${macros.k} kcal</span>
          <span class="tmpl-macro-dot">·</span>
          <span>P ${macros.p.toFixed(0)}g</span>
          <span class="tmpl-macro-dot">·</span>
          <span>C ${macros.c.toFixed(0)}g</span>
          <span class="tmpl-macro-dot">·</span>
          <span>G ${macros.f.toFixed(0)}g</span>
        </div>
        <div id="ti-${t.id}" style="display:none;margin-top:10px">${rowsHtml}</div>
      </div>
      <div class="tmpl-card-actions" id="tca-${t.id}"></div>`;

    // Buttons via DOM (no inline JS string issues) — no "Carica in Oggi" (available via "+" in meal cards)
    const actionsEl = card.querySelector('.tmpl-card-actions');
    [
      ['Dettagli', () => toggleTmplItems(t.id), 'tmpl-btn-sec'],
      ['Modifica', () => editTemplate(t.id),    'tmpl-btn-sec'],
      ['Elimina',  () => deleteTemplate(t.id),  'tmpl-btn-del'],
    ].forEach(([label, fn, cls]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = cls;
      b.addEventListener('click', fn);
      actionsEl.appendChild(b);
    });
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Carica in Oggi';
    loadBtn.className = 'tmpl-btn-load';
    loadBtn.addEventListener('click', () => loadTemplateToLog(t.id));
    actionsEl.prepend(loadBtn);

    listEl.appendChild(card);
  });
}

function mealPlannerHelperHTML(type, plannerState) {
  const mealIdx = typeof plannerState.mealIdx === 'number' ? plannerState.mealIdx : 0;
  const meal = S.meals[type]?.[mealIdx];
  const target = meal ? getMealPlannerTarget(type, mealIdx) : null;
  const mealState = getCurrentMealState(type, S.selDate || localDate());
  const isCurrent = mealState?.key === mealIdx && !mealState?.isExtra && (mealState.kind === 'now' || mealState.kind === 'next');
  const mealStateLabel = !isCurrent ? 'Pasto selezionato' : (mealState.kind === 'now' ? 'Pasto del momento' : 'Prossimo pasto');
  const mealType = getMealTypeFromName(meal?.name || '');
  const mealButtons = (S.meals[type] || []).map((mealOpt, idx) => `
    <button class="mph-meal-chip${idx === mealIdx ? ' active' : ''}" onclick="setMealPlannerMeal('${type}', ${idx})">
      <span class="mph-meal-chip-name">${htmlEsc(mealOpt.name)}</span>
      <span class="mph-meal-chip-time">${htmlEsc(mealOpt.time || '')}</span>
    </button>
  `).join('');
  const promptPresets = [
    { label: 'Veloce', value: 'qualcosa di veloce' },
    { label: 'Saziante', value: 'pasto saziante' },
    { label: 'Leggero', value: 'pasto leggero' },
    { label: 'Post workout', value: 'post workout' },
  ];
  const matchingTemplates = (S.templates || []).filter(t => {
    if (!mealType) return true;
    return String(t.mealType || t.tag || '').toLowerCase().includes(mealType);
  }).slice(0, 4);
  const favoriteFoods = (S.favoriteFoods || []).slice(0, 6);
  const resultCards = (plannerState.results || []).length
    ? plannerState.results.map((result, idx) => {
        const deltaK = Math.round(result.delta.k);
        const deltaP = Math.round(result.delta.p * 10) / 10;
        const deltaC = Math.round(result.delta.c * 10) / 10;
        const deltaF = Math.round(result.delta.f * 10) / 10;
        const scoreLabel = result.score >= 92 ? 'Molto vicino' : result.score >= 82 ? 'Buona base' : 'Da rifinire';
        return `<div class="mph-result-card">
          <div class="mph-result-top">
            <div>
              <div class="mph-result-title">${htmlEsc(result.title)}</div>
              <div class="mph-result-sub">${htmlEsc(result.summary)}</div>
            </div>
            <div class="mph-score-wrap">
              <div class="mph-score">${result.score}</div>
              <div class="mph-score-label">${scoreLabel}</div>
            </div>
          </div>
          <div class="mph-macros">${macroVisualCardsHTML({
            k: result.macros.kcal,
            p: result.macros.p,
            c: result.macros.c,
            f: result.macros.f,
          }, { size: 'compact' })}</div>
          <div class="mph-delta">
            Scarto vs target: ${deltaK >= 0 ? '+' : ''}${deltaK} kcal · P ${deltaP >= 0 ? '+' : ''}${deltaP}g · C ${deltaC >= 0 ? '+' : ''}${deltaC}g · F ${deltaF >= 0 ? '+' : ''}${deltaF}g
          </div>
          <div class="mph-items">
            ${result.items.map(it => `<span class="mph-item-chip">${htmlEsc(it.name)} · ${it.grams}g</span>`).join('')}
          </div>
          <div class="mph-actions">
            <button class="mph-btn mph-btn-main" onclick="applyMealPlannerSuggestion('${type}',${idx})">Usa nel piano</button>
            <button class="mph-btn" onclick="loadMealPlannerSuggestionToToday('${type}',${idx})">Carica in Oggi</button>
            <button class="mph-btn" onclick="plannerSuggestionToTemplate('${type}',${idx})">Salva come template</button>
          </div>
        </div>`;
      }).join('')
    : `<div class="mph-empty">
        <div class="mph-empty-title">Nessun suggerimento ancora</div>
        <div class="mph-empty-copy">Scegli il pasto, aggiungi un paio di vincoli o preferenze e genera una proposta che si avvicini al target.</div>
        <div class="mph-empty-list">
          <span>1. Seleziona il pasto da sistemare</span>
          <span>2. Scrivi 2-3 alimenti o il contesto del momento</span>
          <span>3. Genera e usa la proposta migliore</span>
        </div>
      </div>`;

  return `<div class="meal-planner-helper">
    <div class="meal-planner-head">
      <div>
        <div class="meal-planner-title">Helper pasto del momento</div>
        <div class="meal-planner-sub">Usalo quando un pasto non è chiaro: selezioni lo slot, dai un contesto rapido e il sistema ti propone combinazioni riutilizzabili.</div>
      </div>
      ${target ? `<div class="meal-planner-target">${macroVisualCardsHTML(target, { size: 'compact' })}</div>` : ''}
    </div>
    <div class="meal-planner-grid">
      <div class="meal-planner-controls">
        <div class="meal-planner-steps">
          <span class="meal-planner-step">1. Scegli</span>
          <span class="meal-planner-step">2. Dai contesto</span>
          <span class="meal-planner-step">3. Usa</span>
        </div>
        <div class="meal-planner-focus">
          <div class="meal-planner-focus-kicker">${mealStateLabel}</div>
          <div class="meal-planner-focus-title">${htmlEsc(meal?.name || 'Pasto')}</div>
          <div class="meal-planner-focus-meta">${htmlEsc(meal?.time || '')}${mealType ? ` · ${mealType}` : ''}</div>
        </div>
        <div class="mph-chip-group mph-chip-group-meals">
          <div class="mph-chip-label">Pasto da costruire</div>
          <div class="mph-meal-chip-row">${mealButtons}</div>
        </div>
        <label class="mph-label">Input utente</label>
        <textarea class="mph-textarea" placeholder="Esempio: riso, pollo, qualcosa di veloce; oppure alimenti che hai disponibili adesso" oninput="setMealPlannerPrompt('${type}', this.value)">${htmlEsc(plannerState.prompt || '')}</textarea>
        <div class="mph-helper-copy">Scrivi cosa vuoi mangiare, che situazione hai o cosa hai disponibile. Esempio: "riso, pollo, pranzo veloce".</div>
        <div class="mph-chip-group mph-chip-group-inline">
          <div class="mph-chip-label">Preset rapidi</div>
          <div class="mph-inline-row">
            ${promptPresets.map(preset => `<button class="mph-chip-btn mph-chip-btn-min" onclick="appendMealPlannerPrompt('${type}','${preset.value}')">${preset.label}</button>`).join('')}
          </div>
        </div>
        <div class="mph-options-block">
          <div class="mph-chip-label">Opzioni</div>
          <div class="mph-inline-row mph-inline-row-options">
            <button class="mph-toggle${plannerState.useFavorites ? ' active' : ''}" onclick="toggleMealPlannerOption('${type}','useFavorites')">Preferiti</button>
            <button class="mph-toggle${plannerState.useTemplates ? ' active' : ''}" onclick="toggleMealPlannerOption('${type}','useTemplates')">Template</button>
          </div>
        </div>
        ${favoriteFoods.length ? `<div class="mph-chip-group">
          <div class="mph-chip-label">Preferiti rapidi</div>
          <div class="mph-inline-row">
            ${favoriteFoods.map(food => `<button class="mph-chip-btn mph-chip-btn-min" onclick="appendMealPlannerPrompt('${type}','${esc(food.name)}')">${htmlEsc(food.name)}</button>`).join('')}
          </div>
        </div>` : ''}
        ${matchingTemplates.length ? `<div class="mph-chip-group">
          <div class="mph-chip-label">Template utili</div>
          <div class="mph-inline-row">
            ${matchingTemplates.map(t => `<button class="mph-chip-btn mph-chip-btn-min" onclick="appendMealPlannerPrompt('${type}','${esc(t.name)}')">${htmlEsc(t.name)}</button>`).join('')}
          </div>
        </div>` : ''}
        <div class="mph-actions-panel">
          <div class="mph-actions-kicker">Azioni</div>
          <div class="mph-cta-row">
          <button class="mph-generate" onclick="generateMealPlanner()">Genera suggerimenti</button>
          <button class="mph-btn" onclick="resetMealPlanner('${type}')">Reset</button>
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

function getStatsPatterns(data) {
  const patterns = [];
  const prevAdh = data.previous?.adherence?.adherenceRate ?? null;
  if (prevAdh != null) {
    const diff = data.adherence.adherenceRate - prevAdh;
    if (Math.abs(diff) >= 10) {
      patterns.push(diff > 0
        ? `Le ultime ${data.bounds.days} giornate sono piu solide del periodo precedente: aderenza +${diff} punti.`
        : `L aderenza e scesa di ${Math.abs(diff)} punti rispetto al periodo precedente: serve riportare ritmo prima di leggere troppo il trend fisico.`);
    }
  }
  if (data.adherence.weekendAdherenceRate && data.adherence.adherenceRate - data.adherence.weekendAdherenceRate >= 15) {
    patterns.push('La costanza cala soprattutto nel weekend: e il punto piu chiaro su cui intervenire adesso.');
  }
  if (data.adherence.hydrationRate <= 40 && data.adherence.activeDays >= 4) {
    patterns.push('L acqua e il comportamento meno stabile del periodo: la base alimentare regge meglio dell idratazione.');
  }
  if (data.weight.count <= 1 && data.adherence.adherenceRate >= 60) {
    patterns.push('Stai registrando il comportamento molto piu del peso: una pesata in piu a settimana renderebbe la dashboard piu leggibile.');
  }
  if (!patterns.length) {
    patterns.push('Il quadro e abbastanza lineare: continua a costruire dati su peso e misure per far emergere pattern piu specifici.');
  }
  return patterns.slice(0, 4);
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
  const hero = getStatsHero({ bounds, weight, adherence, previous });
  const measurementEntries = getMeasurementsForBounds(bounds);
  const measurementKeys = ['vita', 'fianchi', 'petto', 'braccio', 'coscia'];
  const measurements = {
    entries: measurementEntries,
    deltas: Object.fromEntries(measurementKeys.map(key => [key, getMeasurementSnapshot(measurementEntries, key)])),
  };
  measurements.count = measurementEntries.length;
  measurements.insight = getMeasurementsInsight(S.goal?.phase || 'mantieni', weight.delta, measurements.deltas);

  return {
    bounds,
    hero,
    weight,
    adherence,
    measurements,
    previous,
    patterns: getStatsPatterns({ bounds, weight, adherence, previous, measurements }),
    kpis: {
      weightValue: weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`,
      adherenceValue: `${adherence.adherenceRate}%`,
      consistencyValue: `${avgActivePerWeek}/7`,
    },
  };
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
  el.innerHTML = `
    <div class="stats-toolbar-card">
      <div class="stats-toolbar">
        <div class="stats-toolbar-copy">
          <div class="stats-toolbar-label">Periodo</div>
          <div class="stats-toolbar-title">${data.bounds.label}</div>
          <div class="stats-toolbar-note">Usa un solo filtro per leggere peso, misure e costanza nello stesso contesto.</div>
        </div>
        <div class="stats-toolbar-side">
          <div class="stats-toolbar-quickstats">
            <div class="stats-toolbar-stat">
              <span class="stats-toolbar-stat-label">Streak</span>
              <strong>${calcStreak()} giorni</strong>
            </div>
            <div class="stats-toolbar-stat">
              <span class="stats-toolbar-stat-label">Giorni attivi</span>
              <strong>${data.adherence.activeDays}/${data.adherence.totalDays}</strong>
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
  const streak = calcStreak();
  el.innerHTML = `
    <div class="stats-hero${toneClass}">
      <div class="stats-hero-copy">
        <div class="stats-hero-kicker">Lettura del periodo</div>
        <div class="stats-hero-title">${data.hero.title}</div>
        <div class="stats-hero-body">${data.hero.body}</div>
      </div>
      <div class="stats-hero-meta">
        <div class="stats-hero-meta-chip">Range · ${data.bounds.label}</div>
        <div class="stats-hero-meta-chip">Streak · ${streak} giorni</div>
      </div>
      <div class="stats-kpis">
        <div class="sc-card">
          <div class="sc-val${data.weight.delta != null && Math.abs(data.weight.delta) >= 0.3 ? ' ok' : ''}">${data.kpis.weightValue}</div>
          <div class="sc-lbl">Trend peso</div>
          <div class="sc-sub">movimento letto su ${data.bounds.label.toLowerCase()}</div>
        </div>
        <div class="sc-card">
          <div class="sc-val${data.adherence.adherenceRate >= 70 ? ' ok' : data.adherence.adherenceRate >= 45 ? ' warn' : ' err'}">${data.kpis.adherenceValue}</div>
          <div class="sc-lbl">Aderenza reale</div>
          <div class="sc-sub">${data.adherence.activeDays} giorni attivi su ${data.adherence.totalDays}</div>
        </div>
        <div class="sc-card">
          <div class="sc-val${streak >= 7 ? ' ok' : ''}">${data.kpis.consistencyValue}</div>
          <div class="sc-lbl">Costanza</div>
          <div class="sc-sub">media settimanale · streak attuale ${streak}</div>
        </div>
      </div>
    </div>`;
}

function toggleWeightLog() {
  document.getElementById('w-log')?.classList.toggle('open');
}

function toggleStatsSection(id, forceOpen = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (forceOpen) el.classList.add('open');
  else el.classList.toggle('open');
}

function openMeasurementEntry() {
  toggleStatsSection('measurements-form-shell', true);
  document.getElementById('stats-measurements')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('m-vita')?.focus(), 180);
}

function renderStatsWeight(data) {
  const el = document.getElementById('stats-weight');
  if (!el) return;
  const weight = data.weight;
  const targetText = weight.target == null
    ? 'Imposta un target nel profilo per contestualizzare meglio il trend.'
    : weight.targetDiff == null
      ? `Target impostato a ${weight.target} kg.`
      : `Distanza dal target: ${weight.targetDiff > 0 ? '+' : ''}${weight.targetDiff.toFixed(1)} kg.`;

  if (!weight.count) {
    el.innerHTML = `
      <div class="stats-panel stats-panel-weight">
        <div class="stats-panel-head">
          <div>
            <div class="stat-section-title">Andamento peso</div>
            <div class="stats-panel-sub">${data.bounds.label}</div>
          </div>
        </div>
        <div class="stats-weight-empty">
          <div class="stats-weight-empty-title">Nessuna pesata nel periodo selezionato</div>
          <div class="stats-weight-empty-body">Registra almeno una pesata per iniziare a leggere l andamento. Quando avremo piu punti, qui comparira anche il trend.</div>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="stats-panel stats-panel-weight">
      <div class="stats-panel-head">
        <div>
          <div class="stat-section-title">Andamento peso</div>
          <div class="stats-panel-sub">${data.bounds.label} · ${weight.count} ${weight.count === 1 ? 'pesata' : 'pesate'}</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-inline-btn" onclick="toggleWeightLog()">Cronologia</button>
          <button class="stats-inline-btn stats-inline-btn-soft" onclick="document.getElementById('w-in')?.focus()">Registra</button>
        </div>
      </div>
      <div class="w-stats stats-weight-stats">
        <div class="ws"><div class="ws-l">Attuale</div><div class="ws-v">${weight.current.toFixed(1)} kg</div></div>
        <div class="ws"><div class="ws-l">Variazione</div><div class="ws-v" style="color:${weight.delta == null ? 'var(--muted)' : weight.delta > 0 ? 'var(--on)' : weight.delta < 0 ? 'var(--red)' : 'var(--ink)'}">${weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`}</div></div>
        <div class="ws"><div class="ws-l">Media</div><div class="ws-v">${weight.average != null ? `${weight.average.toFixed(1)} kg` : 'n/d'}</div></div>
        <div class="ws"><div class="ws-l">Target</div><div class="ws-v">${weight.target == null ? '—' : `${weight.target.toFixed(1)} kg`}</div></div>
      </div>
      <div class="chart-box stats-chart-box">
        <div class="stats-weight-main">
          <div class="stats-weight-chart-area">
            <canvas id="w-canvas" style="width:100%;height:180px"></canvas>
          </div>
          <div class="stats-weight-reading">
            <div class="stats-weight-reading-title">Lettura</div>
            <div class="stats-weight-reading-body">${weight.insight}</div>
            <div class="stats-weight-reading-note">${targetText}</div>
          </div>
        </div>
        <div class="w-log" id="w-log">
          <div class="w-log-title">Pesate nel periodo</div>
          ${[...weight.entries].reverse().map((entry, ri, arr) => {
            const prev = arr[ri + 1];
            const delta = prev ? +(entry.val - prev.val).toFixed(1) : null;
            const deltaHtml = delta == null
              ? ''
              : `<span class="w-delta ${delta > 0 ? 'd-pos' : delta < 0 ? 'd-neg' : 'd-neu'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg</span>`;
            return `<div class="w-log-item">
              <span class="w-log-date">${entry.date}</span>
              <span class="w-log-val">${entry.val.toFixed(1)} kg</span>
              ${deltaHtml}
              <button class="w-del" onclick="delWeight(${entry.srcIndex})">✕</button>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  drawChart(weight.entries, { targetWeight: weight.target, rolling: weight.rolling });
}

function renderStatsMeasurements(data) {
  const el = document.getElementById('stats-measurements');
  if (!el) return;
  const LABELS = { vita:'Vita', fianchi:'Fianchi', petto:'Petto', braccio:'Braccio dx', coscia:'Coscia' };
  const UNITS = { vita:'cm', fianchi:'cm', petto:'cm', braccio:'cm', coscia:'cm' };
  const phase = S.goal?.phase || 'mantieni';

  el.innerHTML = `
    <div class="stats-panel">
      <div class="stats-panel-head">
        <div>
          <div class="stat-section-title">Misure e composizione</div>
          <div class="stats-panel-sub">${data.bounds.label} · ${data.measurements.count} ${data.measurements.count === 1 ? 'rilevazione' : 'rilevazioni'}</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-inline-btn" onclick="toggleStatsSection('measurements-form-shell')">Registra</button>
          <button class="stats-inline-btn" onclick="toggleStatsSection('measurements-log-shell')">Cronologia</button>
        </div>
      </div>
      <div class="stats-insight-strip">
        <div class="stats-insight-title">Lettura composizione</div>
        <div class="stats-insight-body">${data.measurements.insight}</div>
      </div>
      <div class="measure-cards measure-cards-inline">
        ${Object.keys(LABELS).map(key => {
          const snap = data.measurements.deltas[key];
          const last = snap.last?.[key];
          const delta = snap.delta;
          const tone = delta == null || Math.abs(delta) < 0.2 ? '' : delta < 0 ? ' neg' : ' pos';
          return `<div class="measure-card">
            <div class="measure-card-label">${LABELS[key]}</div>
            <div class="measure-card-value">${last != null ? `${last.toFixed(1)} ${UNITS[key]}` : '—'}</div>
            <div class="measure-card-delta${tone}">${delta == null ? 'n/d' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${UNITS[key]}`}</div>
            <div class="measure-card-note">${getMeasurementReading(key, delta, phase)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="stats-collapsible" id="measurements-form-shell">
        <div id="measurements-entry"></div>
      </div>
      <div class="stats-collapsible" id="measurements-log-shell">
        <div id="measurements-log"></div>
      </div>
    </div>`;
  renderMeasurementsForm(data.bounds);
}

function renderStatsAdherence(data) {
  const el = document.getElementById('stats-adherence');
  if (!el) return;
  const adherence = data.adherence;
  el.innerHTML = `
    <div class="stats-panel">
      <div class="stats-panel-head">
        <div>
          <div class="stat-section-title">Aderenza e costanza</div>
          <div class="stats-panel-sub">${data.bounds.label} · ${adherence.activeDays}/${adherence.totalDays} giorni con attivita</div>
        </div>
      </div>
      <div class="stats-kpis stats-kpis-adh">
        <div class="sc-card">
          <div class="sc-val ok">${adherence.fullDays}</div>
          <div class="sc-lbl">Giorni completi</div>
          <div class="sc-sub">tutto il piano giornaliero</div>
        </div>
        <div class="sc-card">
          <div class="sc-val warn">${adherence.partialDays}</div>
          <div class="sc-lbl">Giorni parziali</div>
          <div class="sc-sub">qualcosa c e, non tutto</div>
        </div>
        <div class="sc-card">
          <div class="sc-val${adherence.emptyDays > 0 ? ' err' : ''}">${adherence.emptyDays}</div>
          <div class="sc-lbl">Giorni vuoti</div>
          <div class="sc-sub">nessuna attivita registrata</div>
        </div>
      </div>
      <div class="adherence-breakdown">
        <div class="adh-chip"><span>Pasti</span><strong>${adherence.mealRate}%</strong></div>
        <div class="adh-chip"><span>Acqua</span><strong>${adherence.hydrationRate}%</strong></div>
        <div class="adh-chip"><span>Integratori</span><strong>${adherence.supplementRate}%</strong></div>
        <div class="adh-chip"><span>Weekend</span><strong>${adherence.weekendAdherenceRate}%</strong></div>
      </div>
      <div class="stats-adherence-lower">
        <div class="stats-heatmap-wrap" id="stats-heatmap"></div>
        <div class="stats-ratio-wrap" id="stats-ratio"></div>
      </div>
    </div>`;
  renderHeatmap(data);
  renderRatio(data);
}

function renderStatsPatterns(data) {
  const el = document.getElementById('stats-patterns');
  if (!el) return;
  const patterns = data.patterns?.length
    ? data.patterns
    : ['Nessun pattern rilevante nel periodo selezionato.'];
  el.innerHTML = `
    <div class="stats-panel">
      <div class="stats-patterns-layout">
        <div class="stats-patterns-side">
          <div class="stat-section-title">Pattern utili</div>
          <div class="stats-panel-sub">Segnali automatici emersi dal periodo selezionato</div>
          <div class="stats-patterns-note">Questi segnali aiutano a capire dove il comportamento sta sostenendo il percorso e dove conviene intervenire per primo.</div>
        </div>
        <div class="stats-patterns-main">
          <div class="pattern-card pattern-card-featured">
            <div class="pattern-card-kicker">Insight del periodo</div>
            <div class="pattern-card-stack">
              ${patterns.map(text => `<div class="pattern-card-line">${text}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStatsActions() {
  const el = document.getElementById('stats-actions');
  if (!el) return;
  el.innerHTML = `
    <div class="stats-panel stats-panel-actions">
      <div class="stats-panel-head">
        <div>
          <div class="stat-section-title">Azioni rapide</div>
          <div class="stats-panel-sub">Aggiorna i dati chiave della dashboard</div>
        </div>
      </div>
      <div class="stats-actions-card">
        <div class="stats-actions-stack">
          <div class="stats-action-row stats-action-row-primary">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Peso</div>
              <div class="stats-actions-note">Per trend e target.</div>
            </div>
            <div class="stats-action-control">
              <div class="weight-entry">
                <input class="w-input" type="number" id="w-in" step="0.1" placeholder="64.0">
                <span style="font-size:12px;color:var(--muted);font-weight:600">kg</span>
                <button class="w-btn" onclick="addWeight()">+ Registra peso</button>
              </div>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Misure</div>
              <div class="stats-actions-note">Per leggere la composizione.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="openMeasurementEntry()">Apri misurazioni</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStats() {
  const data = getStatsRangeData(S.statsRange || '30d');
  const streak = calcStreak();
  document.getElementById('stats-sub').textContent = `${data.bounds.label} · streak attuale ${streak} giorni`;
  renderStatsToolbar(data);
  renderStatsHero(data);
  renderStatsWeight(data);
  renderStatsMeasurements(data);
  renderStatsAdherence(data);
  renderStatsPatterns(data);
  renderStatsActions();
}
function renderProfile() {
  renderAnagrafica();
  renderOnDaysPicker();
  renderSupplements();
}
function drawChart(log, opts = {}) {
  const el = document.getElementById('w-canvas');
  if (!el || !log?.length) return;
  const isCompact = window.innerWidth <= 720;
  el.width = el.offsetWidth || 680; el.height = isCompact ? 160 : 220;
  const ctx = el.getContext('2d');
  const W=el.width, H=el.height, pad={t:20,r:22,b:36,l:46};
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

  [0,.25,.5,.75,1].forEach(t => {
    const y=pad.t+(H-pad.t-pad.b)*t, v=(vmax-(vmax-vmin)*t).toFixed(1);
    ctx.strokeStyle='#e2dfd8';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';ctx.fillText(v,2,y+3);
  });

  if (targetW) {
    const ty = ys(targetW);
    ctx.strokeStyle='#1c52a0';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,ty);ctx.lineTo(W-pad.r,ty);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#1c52a0';ctx.font='9px JetBrains Mono';
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
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';
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
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';
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
  if (!entries.length) { el.innerHTML = `<div style="font-size:12px;color:var(--muted)">Nessun dato ancora.</div>`; return; }
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
function renderMeasurementsForm(bounds) {
  const el = document.getElementById('measurements-entry');
  if (!el) return;
  el.innerHTML = `
    <div class="meas-form">
      <div class="meas-grid">
        <div class="meas-field"><label>Vita</label><input type="number" id="m-vita" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Fianchi</label><input type="number" id="m-fianchi" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Petto</label><input type="number" id="m-petto" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Braccio dx</label><input type="number" id="m-braccio" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Coscia</label><input type="number" id="m-coscia" step="0.5" placeholder="–"><div class="meas-unit">cm</div></div>
        <div class="meas-field"><label>Peso</label><input type="number" id="m-peso" step="0.1" placeholder="–"><div class="meas-unit">kg</div></div>
      </div>
      <button class="meas-btn" onclick="addMeasurement()">+ Registra misurazioni</button>
    </div>`;
  renderMeasurementsLog(bounds);
}
function renderMeasurementsLog(bounds) {
  const el = document.getElementById('measurements-log');
  if (!el) return;
  const log = [...(bounds ? getMeasurementsForBounds(bounds) : (S.measurements || []).map(m => ({ ...m })))].reverse().slice(0,10);
  if (!log.length) { el.innerHTML=''; return; }
  const LABELS = {peso:'Peso',vita:'Vita',fianchi:'Fianchi',petto:'Petto',braccio:'Braccio',coscia:'Coscia'};
  const UNITS  = {peso:'kg', vita:'cm',fianchi:'cm',petto:'cm',braccio:'cm',coscia:'cm'};
  el.innerHTML = `<div style="background:var(--surf);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;box-shadow:var(--sh)">
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
      </div>`;
    }).join('')}
  </div>`;
}
function renderGoalCard() {
  const el = document.getElementById('goal-card');
  if (!el) return;
  const g = S.goal;
  const weeksSince = g.startDate ? Math.floor((new Date()-new Date(g.startDate+'T12:00:00'))/(7*86400000)) : null;
  const phaseLabel = {bulk:'Bulk 💪',cut:'Cut 🔥',mantieni:'Mantenimento ⚖️'}[g.phase] || g.phase;
  el.innerHTML = `
    <div class="goal-card">
      <div class="goal-extra-head">
        <span class="goal-extra-phase">${phaseLabel}</span>
        ${weeksSince!==null?`<span class="goal-extra-weeks">Settimana ${weeksSince+1}</span>`:''}
      </div>
      <div class="goal-fields">
        <div class="goal-field">
          <label>Data inizio fase</label>
          <input type="date" value="${g.startDate||''}" oninput="S.goal.startDate=this.value;save();renderGoalCard()">
        </div>
        <div class="goal-field">
          <label>Peso target (kg)</label>
          <input type="number" step="0.5" value="${g.targetWeight||''}" placeholder="–" oninput="S.goal.targetWeight=+this.value||null;save()">
        </div>
        <div class="goal-field goal-full">
          <label>Note obiettivo</label>
          <textarea rows="2" oninput="S.goal.notes=this.value;save()">${esc(g.notes||'')}</textarea>
        </div>
      </div>
    </div>`;
}
function renderSupplements() {
  const el = document.getElementById('supps-card');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const checked = S.suppChecked[dateKey] || [];
  const cards = S.supplements.map((s, i) => {
    const done = checked.includes(s.id);
    return `<div class="supp-card${done?' done':''}${s.active?'':' supp-inactive'}" data-supp-id="${s.id}" onclick="toggleSupp('${s.id}')">
      <div class="supp-card-check">${done ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>
      <div class="supp-card-name">${htmlEsc(s.name)}</div>
      <div class="supp-card-meta">${esc(s.dose)}${s.dose && s.when ? ' · ' : ''}${esc(s.when)}</div>
      <button class="supp-card-toggle" onclick="event.stopPropagation();toggleSuppActive(${i})" title="${s.active?'Disattiva':'Attiva'}">${s.active?'–':'+'}</button>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="supp-cards-row">
      ${cards}
      <button class="supp-card supp-card-add" onclick="toggleSuppForm()">
        <div class="supp-card-check"></div>
        <div class="supp-card-name">+ Aggiungi</div>
        <div class="supp-card-meta"></div>
      </button>
    </div>
    <div id="supp-form" style="display:none;margin-top:10px;background:var(--surf);border:1px solid var(--b1);border-radius:var(--r2);padding:12px">
      <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;margin-bottom:8px">
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Nome</label>
          <input id="sf-name" type="text" placeholder="es. Magnesio" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink);transition:border-color .13s"></div>
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Dose</label>
          <input id="sf-dose" type="text" placeholder="3 g" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink)"></div>
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Quando</label>
          <input id="sf-when" type="text" placeholder="mattina" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink)"></div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="confirmAddSupp()" style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;background:var(--on);color:#fff;border:none;border-radius:var(--r2);padding:7px 16px;cursor:pointer;flex:1">Aggiungi</button>
        <button onclick="toggleSuppForm()" style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;background:none;border:1.5px solid var(--b2);border-radius:var(--r2);padding:7px 14px;cursor:pointer;color:var(--muted)">Annulla</button>
      </div>
    </div>`;
}
function renderWater() {
  const el = document.getElementById('water-widget');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const count = (S.water && S.water[dateKey]) || 0;
  const dayType = getTrackedDayType(dateKey, getScheduledDayType(dateKey));

  // Personalized target: 35 ml/kg base + 350 ml bonus on ON days
  const peso = S.anagrafica?.peso || 0;
  const baseMl  = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = dayType === 'on' ? 350 : 0;
  const totalMl = baseMl + bonusMl;
  const target  = Math.max(6, Math.round(totalMl / 250));

  const pct = Math.min(count / target, 1) * 100;
  const glasses = Array.from({length: target}, (_,i) =>
    `<span class="water-glass${i < count ? ' filled' : ''}" title="Bicchiere ${i+1}">🥛</span>`
  ).join('');

  const infoBtn = `<button class="water-info-btn" onmouseenter="showWaterTip(this)" onmouseleave="hideTip('tip-water')" onclick="showWaterTip(this)" title="Info fabbisogno idrico">i</button>`;

  el.innerHTML = `<div class="water-widget support-mini-card">
    <div class="water-top">
      <div class="water-left">
        <span class="water-icon">💧</span>
        <div>
          <div class="water-title">Idratazione ${infoBtn}</div>
          <div class="water-sub">${count}/${target} bicchieri · ${count*250} ml su ${totalMl} ml</div>
        </div>
      </div>
      <div class="water-btns">
        <button class="water-btn" onclick="addWater(-1)"${count<=0?' disabled':''}>−</button>
        <span class="water-count">${count}<span class="water-target">/${target}</span></span>
        <button class="water-btn" onclick="addWater(1)"${count>=12?' disabled':''}>+</button>
      </div>
    </div>
    <div class="water-bar-wrap">
      <div class="water-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="water-glasses">${glasses}</div>
  </div>`;
}

function showWaterTip(anchor) {
  const tip = document.getElementById('tip-water');
  if (!tip) return;
  const dateKey = S.selDate || localDate();
  const dayType = getTrackedDayType(dateKey, getScheduledDayType(dateKey));
  const peso = S.anagrafica?.peso || 0;
  const baseMl  = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = dayType === 'on' ? 350 : 0;
  const totalMl = baseMl + bonusMl;
  const target  = Math.max(6, Math.round(totalMl / 250));

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
      ${peso > 0 ? `<div style="margin-top:8px;font-size:11px">Base: ${peso} kg × 35 ml = <strong>${baseMl} ml</strong>${bonusMl ? ` + ${bonusMl} ml (giorno ON) = <strong>${totalMl} ml</strong>` : ''}</div>` : '<div style="margin-top:8px;font-size:11px;color:var(--muted)">Inserisci il peso nel Profilo per un calcolo preciso.</div>'}
      <div style="margin-top:6px;font-size:10px;color:var(--muted)">Fonte: linee guida EFSA (2010) — adulti sani in clima temperato.</div>
    </div>`;
  showTip('tip-water', anchor);
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
  const todayKey = localDate();
  const checked = S.suppChecked[todayKey] || [];
  const checkSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const rows = active.length ? active.map(s => {
    const done = checked.includes(s.id);
    const suppIndex = S.supplements.findIndex(item => item.id === s.id);
    return `<div class="supp-today-item" data-supp-id="${s.id}">
      <button class="supp-today-btn${done?' done':''}" onclick="toggleSupp('${s.id}')">
        <span class="supp-today-check">${done ? checkSVG : ''}</span>
        <span class="supp-today-name">${htmlEsc(s.name)}</span>
        ${s.dose ? `<span class="supp-today-dose">${htmlEsc(s.dose)}</span>` : ''}
      </button>
      <button class="supp-today-manage" onclick="toggleSuppActive(${suppIndex})" title="Disattiva integratore">✕</button>
    </div>`;
  }).join('') : `<div class="supp-today-empty">Nessun integratore attivo. Aggiungine uno per gestirlo da qui ogni giorno.</div>`;

  el.innerHTML = `
    <div class="support-mini-card support-mini-card-supp">
    <div class="supp-today-head">
      <div class="notes-label">💊 Routine integratori</div>
      <button class="supp-today-add-btn" onclick="toggleSuppForm()">+ Nuovo</button>
    </div>
    <div class="supp-today-row">
      ${rows}
    </div>
    </div>`;
  el.style.display='block';
  el.innerHTML += `
    <div id="supp-form" style="display:none;margin-top:10px;background:var(--surf);border:1px solid var(--b1);border-radius:var(--r2);padding:12px">
      <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:8px;margin-bottom:8px">
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Nome</label>
          <input id="sf-name" type="text" placeholder="es. Magnesio" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink);transition:border-color .13s"></div>
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Dose</label>
          <input id="sf-dose" type="text" placeholder="3 g" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink)"></div>
        <div><label style="display:block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px">Quando</label>
          <input id="sf-when" type="text" placeholder="mattina" style="font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--bg);border:1.5px solid var(--b1);border-radius:var(--r2);padding:7px 10px;width:100%;outline:none;color:var(--ink)"></div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="confirmAddSupp()" style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;background:var(--on);color:#fff;border:none;border-radius:var(--r2);padding:7px 16px;cursor:pointer;flex:1">Aggiungi</button>
        <button onclick="toggleSuppForm()" style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;background:none;border:1.5px solid var(--b2);border-radius:var(--r2);padding:7px 14px;cursor:pointer;color:var(--muted)">Annulla</button>
      </div>
    </div>`;
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

function showPianoSummaryTip(kind, anchor) {
  const tip = document.getElementById('tip-piano-summary');
  if (!tip) return;
  const tips = {
    kcal: {
      title: 'Stato kcal',
      body: 'Confronta il totale calorie del piano con il target del giorno. Ti dice se il piano e gia in linea, troppo alto o troppo basso.',
    },
    macro: {
      title: 'Stato macro',
      body: 'Riassume quanto proteine, carboidrati e grassi del piano sono vicini ai target del giorno. Serve per capire se il piano e bilanciato prima ancora di guardare il singolo pasto.',
    },
    focus: {
      title: 'Pasto in focus',
      body: 'E il pasto che il planner sta usando adesso. I suggerimenti, i template rilevanti e il contesto dell helper ruotano intorno a questo slot.',
    },
    template: {
      title: 'Template utili',
      body: 'Conta i template compatibili con il tipo di pasto selezionato, ad esempio colazioni per colazione o cene per cena. Ti fa capire subito quante basi riusabili hai disponibili.',
    },
  };
  const model = tips[kind] || tips.kcal;
  tip.innerHTML = `<div class="tip-title">${model.title}</div><div class="tip-desc">${model.body}</div>`;
  showTip('tip-piano-summary', anchor);
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
    <div class="tip-title">LIVELLO DI ATTIVITÀ (PAL)</div>
    <div class="tip-desc"><strong>Physical Activity Level</strong> — moltiplica il BMR per stimare il consumo reale.<br><br>
    <strong>Occupazione</strong>: da 1.20 (scrivania) a 1.75 (lavoro fisico intenso)<br>
    <strong>Allenamento</strong>: +0.10 (1–2/sett) fino a +0.40 (7+/sett)<br><br>
    Formula: PAL = occupazione + delta allenamento<br>
    Range tipico: 1.20 – 2.50</div>`;
  showTip('tip-fab-pal', anchor);
}

function showFabTdeeTip(anchor) {
  const el = document.getElementById('tip-fab-tdee');
  if (!el) return;
  el.innerHTML = `
    <div class="tip-title">DISPENDIO ENERGETICO TOTALE (TDEE)</div>
    <div class="tip-desc"><strong>Total Daily Energy Expenditure</strong> — stima delle kcal bruciate in un giorno medio.<br><br>
    <strong>Formula</strong>: TDEE = BMR × PAL<br><br>
    È il punto di pareggio calorico: mangiare esattamente il TDEE mantiene il peso stabile nel tempo.</div>`;
  showTip('tip-fab-tdee', anchor);
}

function showFabGoalTip(anchor) {
  const el = document.getElementById('tip-fab-goal');
  if (!el) return;
  const phase = (typeof S !== 'undefined' && S.goal?.phase) || 'mantieni';
  const data = {
    bulk:     { title: 'BULK — MASSA', on: 'TDEE + 250 kcal', off: 'TDEE', note: 'Surplus moderato per stimolare la sintesi muscolare. I carboidrati salgono nei giorni di allenamento per supportare la performance.', prot: '2.0 g/kg' },
    cut:      { title: 'CUT — DEFINIZIONE', on: 'TDEE − 300 kcal', off: 'TDEE − 500 kcal', note: 'Deficit progressivo: più contenuto nei giorni di allenamento, più ampio nei giorni di riposo. Le proteine sono alte per preservare la massa muscolare.', prot: '2.3 g/kg' },
    mantieni: { title: 'MANTENIMENTO', on: 'TDEE', off: 'TDEE − 100 kcal', note: 'Pareggio calorico nei giorni di allenamento. Leggero deficit nei giorni di riposo per una composizione corporea stabile.', prot: '1.8 g/kg' },
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
function renderAnagrafica() {
  const a = S.anagrafica || {};
  const g = S.goal || {};

  // Orari pasti: parse e genera righe per i 4 pasti principali
  const _MT_LABELS = ['Colazione', 'Pranzo', 'Spuntino pom.', 'Cena'];
  const _MT_ICONS  = ['🥣', '🍽️', '🍎', '🍳'];
  function _parseT(str) {
    const m = (str || '').match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
    return m ? { s: m[1], e: m[2] } : { s: '', e: '' };
  }
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
    bulk:     { lbl:'Bulk',     desc:'Surplus calorico (+250 kcal/ON) per massimizzare la crescita muscolare. I carboidrati aumentano nei giorni di allenamento.' },
    cut:      { lbl:'Cut',      desc:'Deficit calorico (−300 kcal ON / −500 kcal OFF) con proteine elevate (2.3 g/kg) per preservare la massa muscolare in fase di dimagrimento.' },
    mantieni: { lbl:'Mantieni', desc:'Intake vicino al TDEE (−100 kcal OFF) per mantenere composizione corporea e performance in palestra.' },
  };
  const phaseBtns = Object.entries(PHASE_INFO).map(([id, info]) =>
    `<button class="goal-phase-btn${g.phase===id?' active-'+id:''}" onclick="setGoalPhase('${id}');_updateFabbisognoPreview()">${info.lbl}</button>`
  ).join('');
  const activePhaseDesc = PHASE_INFO[g.phase]?.desc || '';

  document.getElementById('prof-card').innerHTML = `
    <div class="anag-section-title">Anagrafica</div>
    <div class="anag-grid">
      <div class="anag-field anag-field-wide">
        <label class="anag-label">Nome</label>
        <input id="anag-nome" class="anag-input" value="${htmlEsc(a.nome||'')}" oninput="_updateFabbisognoPreview()">
      </div>
      <div class="anag-field">
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
            <input id="anag-eta" class="anag-input anag-spin-input" type="number" min="10" max="99" value="${a.eta||''}" oninput="_updateFabbisognoPreview()">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-eta',-1)">▼</button></div>
          </div>
          <span class="anag-unit">anni</span>
        </div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Altezza</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-altezza" class="anag-input anag-spin-input" type="number" min="100" max="250" value="${a.altezza||''}" oninput="_updateFabbisognoPreview()">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-altezza',-1)">▼</button></div>
          </div>
          <span class="anag-unit">cm</span>
        </div>
      </div>
      <div class="anag-field">
        <label class="anag-label">Peso</label>
        <div class="anag-input-wrap">
          <div class="anag-spin-wrap">
            <input id="anag-peso" class="anag-input anag-spin-input" type="number" min="30" max="300" step="0.1" value="${a.peso||''}" oninput="_updateFabbisognoPreview()">
            <div class="anag-stepper"><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',1)">▲</button><button class="anag-step-btn" onclick="_stepAnagField('anag-peso',-1)">▼</button></div>
          </div>
          <span class="anag-unit">kg</span>
        </div>
      </div>
      <div class="anag-field">
        <label class="anag-label">% Grasso <span class="anag-opt">(opz.)</span></label>
        <div class="anag-input-wrap">
          <input id="anag-grasso" class="anag-input" type="number" min="3" max="60" step="0.1" value="${a.grassoCorporeo||''}" placeholder="—" oninput="_updateFabbisognoPreview()">
          <span class="anag-unit">%</span>
        </div>
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

    <button class="btn btn-primary anag-save-btn" onclick="saveAnagrafica()">Salva profilo</button>`;

  // ── Card 2: Orari pasti ──
  const timesEl = document.getElementById('prof-times-card');
  if (timesEl) timesEl.innerHTML = `<div class="mt-card">${mealTimeRowsHTML}</div>`;

  // ── Card 3: Cibi preferiti ──
  const ffsHtml = (() => {
    const ffs = S.favoriteFoods || [];
    if (!ffs.length) return `<div class="ff-empty">Nessun cibo aggiunto ancora.</div>`;
    return ffs.map(f => {
      const typK = Math.round(f.kcal100 * f.typicalGrams / 100);
      const typP = (f.p100 * f.typicalGrams / 100).toFixed(0);
      const typC = (f.c100 * f.typicalGrams / 100).toFixed(0);
      return `<div class="ff-item">
        <div class="ff-info">
          <div class="ff-name">${htmlEsc(f.name)}</div>
          <div class="ff-macros">${f.typicalGrams}g · ${typK} kcal · P ${typP}g · C ${typC}g</div>
        </div>
        <button class="ff-del" onclick="removeFavoriteFood('${f.id}')" title="Rimuovi">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="2" x2="11" y2="11"/><line x1="11" y1="2" x2="2" y2="11"/></svg>
        </button>
      </div>`;
    }).join('');
  })();
  const foodsEl = document.getElementById('prof-foods-card');
  if (foodsEl) foodsEl.innerHTML = `
    <div class="ff-hint">Aggiungi i cibi che mangi spesso — l'assistente serale li userà per suggerirti cosa mangiare quando mancano calorie o macro.</div>
    <div class="ff-list" id="ff-list">${ffsHtml}</div>
    <button class="ff-open-add-btn" id="ff-add-toggle" onclick="_toggleFfForm()">+ Aggiungi cibo preferito</button>
    <div class="ff-add-form" id="ff-add-form" style="display:none">
      <div class="ff-add-title">Nuovo cibo preferito</div>
      <div class="ff-search-area">
        <div class="ff-search-row">
          <input class="ff-search-inp" id="ff-search-inp" type="text" placeholder="Cerca su OpenFoodFacts…" oninput="onFfSearch(this)" autocomplete="off">
          <button class="ff-bc-btn" onclick="openBarcodeForFf()" title="Scansiona barcode">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a2 2 0 0 1 2-2h2"/><path d="M15 4h2a2 2 0 0 1 2 2v3"/><path d="M21 15v3a2 2 0 0 1-2 2h-2"/><path d="M9 20H6a2 2 0 0 1-2-2v-3"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>
          </button>
        </div>
        <div class="ff-search-results" id="ff-search-results" style="display:none"></div>
        <div class="ff-or-sep">— oppure inserisci manualmente —</div>
      </div>
      <input class="ff-add-name" id="ff-nome" type="text" placeholder="Nome (es. Yogurt greco 0%, Ricotta magra…)" autocomplete="off">
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
    </div>`;

  setTimeout(_updateFabbisognoPreview, 0);
}
