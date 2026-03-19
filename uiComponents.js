// uiComponents.js — rendering & UI helpers

const EXTRA_MEALS = {
  merenda:  { key: 'merenda',  name: 'Merenda',  icon: '🍎 ', time: '10:00 – 10:30' },
  spuntino: { key: 'spuntino', name: 'Spuntino', icon: '🫐 ', time: '21:30 – 22:00' },
};

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
    <span class="mc-real-kcal">${logMacros.kcal} kcal</span>
    <span class="mc-real-sep">·</span>
    <span class="mc-real-p">P ${logMacros.p.toFixed(1)}g</span>
    <span class="mc-real-sep">·</span>
    <span class="mc-real-c">C ${logMacros.c.toFixed(1)}g</span>
    <span class="mc-real-sep">·</span>
    <span class="mc-real-f">G ${logMacros.f.toFixed(1)}g</span>
    <button class="mc-log-clear" onclick="clearLogMeal('${dateKey}','${key}');event.stopPropagation()" title="Azzera alimenti">✕</button>
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
          <span class="food-search-icon">🔍 </span>
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
  const done  = !!S.checked[domKey];
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
          <span class="food-search-icon">🔍 </span>
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
          <span class="mc-real-kcal">${logMacros.kcal} kcal</span>
          <span class="mc-real-sep">·</span>
          <span class="mc-real-p">P ${logMacros.p.toFixed(1)}g</span>
          <span class="mc-real-sep">·</span>
          <span class="mc-real-c">C ${logMacros.c.toFixed(1)}g</span>
          <span class="mc-real-sep">·</span>
          <span class="mc-real-f">G ${logMacros.f.toFixed(1)}g</span>
          <button class="mc-log-clear" onclick="clearLogMeal('${dateKey}',${i});event.stopPropagation()" title="Azzera alimenti">✕</button>
        </div>` : '';

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
      ${hasLog ? `<div class="mc-log-items">${logRows}</div>${logSummary}` : ''}
      <div class="mc-log-search" id="mls-${domKey}" style="display:none">
        ${tmplPickerHTML}
        <div class="food-search-input-row">
          <span class="food-search-icon">🔍 </span>
          <input type="text" class="food-search-input" id="mlsi-${domKey}"
            placeholder="Cerca alimento..."
            oninput="onLogFoodSearch(this,'${dateKey}',${i},'${domKey}')"
            autocomplete="off">
          <button class="bc-btn" onclick="openBarcode('${dateKey}',${i});event.stopPropagation()" title="Scansiona barcode">📷 </button>
        </div>
        <div class="food-search-results" id="mlsr-${domKey}"></div>
        ${!hasLog ? `<button class="mc-log-from-plan" onclick="loadPlanToLog('${dateKey}',${i},'${type}');event.stopPropagation()">
          📋 Carica dal piano
        </button>` : ''}
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
            <span class="mc-name">${htmlEsc(base.name)}</span>
            ${currentBadge}
            ${ai !== undefined && alts[ai] ? `<span style="font-size:9px;font-weight:700;color:var(--on);margin-left:4px;background:var(--on-l);padding:1px 7px;border-radius:10px;border:1px solid var(--on-b);white-space:nowrap">${alts[ai].label}</span>` : ''}
            <span class="mc-time">${clockSVG}${base.time}</span>
          </div>
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

function getGreetingSubtext(h, type, streak, score) {
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
  if (score === 100) return '💯 Score perfetto questa settimana!';

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
    return score >= 75 ? 'Settimana ottima finora · continua così' : 'Giorno OFF · ricarica le energie';
  } else {
    // Sera
    if (score >= 75) return 'Ottima giornata · i numeri lo confermano';
    if (score < 50)  return 'Domani è una nuova opportunità';
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
function generateAlerts(type, h, dateKey) {
  const alerts = [];
  const tgt  = S.macro[type] || {};
  const tgtK = tgt.k || 0, tgtP = tgt.p || 0, tgtC = tgt.c || 0, tgtF = tgt.f || 0;
  if (tgtK === 0) return alerts;

  // Compute eaten macros
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
  const pct  = tgtK > 0 ? Math.round(eK / tgtK * 100) : 0;

  const todayStr = localDate(new Date());
  const isToday  = !dateKey || dateKey === todayStr;
  const isPast   = dateKey && dateKey < todayStr;

  // 1. Supplementi (dalle 8:00 alle 22:00, solo oggi)
  if (isToday && h >= 8 && h < 22) {
    const suppActive  = (S.supplements || []).filter(s => s.active);
    const suppChecked = (S.suppChecked && S.suppChecked[dateKey]) || [];
    const suppPending = suppActive.filter(s => !suppChecked.includes(s.id));
    suppPending.slice(0, 2).forEach(s => {
      const doseStr = s.dose && s.dose !== '---' ? ` · ${s.dose}` : '';
      alerts.push({ type: 'supp', icon: '💊', text: `${s.name}${doseStr} — non ancora presa oggi` });
    });
  }

  // 2. Alert mezzogiorno — apporto critico (< 20% a mezzogiorno)
  if (isToday && h >= 12 && h < 17 && eK > 0 && pct < 20) {
    alerts.push({ type: 'warn', icon: '⚠️', text: `Solo ${eK} kcal consumate a quest'ora — rischio di sotto-alimentazione per la giornata` });
  }

  // 3. Alert serali (dopo le 20:00 o data passata)
  if (isPast || (isToday && h >= 20)) {
    if (remK > 300) {
      alerts.push({ type: 'err', icon: '🔥', text: `Mancano ${remK} kcal al target giornaliero`, hasSuggest: true, remK, remP: Math.max(0, remP), remC: Math.max(0, remC), remF: Math.max(0, remF) });
    } else if (remK > 150) {
      alerts.push({ type: 'warn', icon: '🔥', text: `Ancora ${remK} kcal mancanti al target`, hasSuggest: true, remK, remP: Math.max(0, remP), remC: Math.max(0, remC), remF: Math.max(0, remF) });
    } else if (remK < -300) {
      alerts.push({ type: 'err', icon: '⚠️', text: `Surplus di ${Math.abs(remK)} kcal sul target — ${Math.abs(remK) > 500 ? 'significativo eccesso calorico' : 'leggermente sopra il target'}` });
    } else if (pct >= 93) {
      alerts.push({ type: 'ok', icon: '✅', text: `Giornata centrata — ${pct}% del target raggiunto` });
    }
    if (remP > 25) {
      alerts.push({ type: 'warn', icon: '🥩', text: `Proteine basse: mancano ${remP}g — la sintesi muscolare notturna è limitata da deficit proteico`, hasSuggest: true, remK: Math.max(0, remK), remP, remC: Math.max(0, remC), remF: Math.max(0, remF) });
    }
    if (type === 'on' && remC > 80) {
      alerts.push({ type: 'warn', icon: '🍚', text: `Carboidrati bassi per un giorno ON: mancano ${remC}g`, hasSuggest: remP <= 25, remK: Math.max(0, remK), remP: Math.max(0, remP), remC, remF: Math.max(0, remF) });
    }
  }

  return alerts.slice(0, 3);
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
  if (streak >= 100) return { emoji: '🏆', style: 'color:#92400e;background:#fef3c7;border:2px solid #d97706;font-size:11px' };
  if (streak >= 30)  return { emoji: '🌟', style: 'color:#78350f;background:#fef9c3;border:2px solid #facc15' };
  if (streak >= 7)   return { emoji: '🔥', style: 'color:#b45309;background:#fef3c7;border:2px solid #fbbf24;font-weight:800' };
  return { emoji: '🔥', style: 'color:var(--amber);background:#fef3c7;border-color:#fde68a' };
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
  let streakBadge = '';
  if (streak > 0) {
    const sbs = streakBadgeStyle(streak);
    streakBadge = `<span class="tg-streak" style="${sbs.style}" onmouseenter="showTip('tip-streak',this)" onmouseleave="hideTip('tip-streak')">${sbs.emoji} ${streak}</span>`;
    setTimeout(() => {
      const tipStreak = document.getElementById('tip-streak');
      if (tipStreak) tipStreak.innerHTML = `<div class="tip-title">${sbs.emoji} Streak · ${streak} ${streak===1?'giorno':'giorni'} consecutivi</div>
        <div class="tip-desc">Hai loggato almeno un pasto per <strong>${streak} ${streak===1?'giorno':'giorni'} di fila</strong>. Continua così!</div>`;
    }, 0);
  }

  // Chip giorno ON/OFF
  const isOn = type === 'on';
  const chipStyle = isOn
    ? `background:var(--on-l);color:var(--on);border:1.5px solid var(--on-b)`
    : `background:var(--off-l);color:var(--off);border:1.5px solid var(--off-b)`;
  const chipTxt = isOn ? '🟢 Giorno ON' : '🟡 Giorno OFF';
  const dayChip = `<button onclick="setDay('${isOn?'off':'on'}')" style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;padding:5px 13px;border-radius:20px;cursor:pointer;transition:all .18s;${chipStyle};letter-spacing:.01em">${chipTxt}</button>`;

  // Badge fase obiettivo
  let goalBadge = '';
  if (S.goal?.phase && S.goal?.startDate) {
    const weeks = Math.floor((new Date()-new Date(S.goal.startDate+'T12:00:00'))/(7*86400000));
    const phaseLabel = {bulk:'Bulk',cut:'Cut',mantieni:'Mantenimento'}[S.goal.phase]||S.goal.phase;
    goalBadge = `<span style="font-size:10px;font-weight:700;color:var(--blue);background:var(--blue-l);border:1px solid #bfdbfe;border-radius:20px;padding:2px 9px;white-space:nowrap">Sett. ${weeks+1} · ${phaseLabel}</span>`;
  }

  // Frase del giorno
  const dateKey = S.selDate || localDate(now);
  const quote   = getDailyQuote(dateKey);
  const quoteHTML = `<div class="tg-quote">
    <div class="tg-quote-text">"${quote.text}"</div>
    ${quote.attr ? `<div class="tg-quote-attr">— ${quote.attr}</div>` : ''}
  </div>`;

  // Alert engine
  const alerts = generateAlerts(type, h, dateKey);
  const hasFavFoods = (S.favoriteFoods || []).length > 0;
  const alertsHTML = alerts.length ? `<div class="tg-alerts">
    ${alerts.map(a => {
      const suggestBtn = a.hasSuggest
        ? `<button class="tg-alert-suggest" onclick="openFoodSuggestion(${a.remK||0},${a.remP||0},${a.remC||0},${a.remF||0})">${hasFavFoods ? 'Vedi cosa mangiare →' : 'Aggiungi cibi preferiti →'}</button>`
        : '';
      return `<div class="tg-alert tg-alert-${a.type}">
        <span class="tg-alert-icon">${a.icon}</span>
        <span class="tg-alert-text">${a.text}</span>
        ${suggestBtn}
      </div>`;
    }).join('')}
  </div>` : '';

  document.getElementById('today-greeting').innerHTML = `
    <div class="tg-row">
      <div class="tg-left">
        <div class="tg-hello">${saluto}, <em>${nome}.</em></div>
        <div class="tg-date">${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}</div>
      </div>
      <div class="tg-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        ${dayChip}
        ${goalBadge}
        ${streakBadge}
      </div>
    </div>
    ${quoteHTML}
    ${alertsHTML}`;
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
    const isFull  = dayInfo && dayInfo.done >= dayInfo.total;
    const hasDone = !!dayInfo;

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

    const doneBadge = hasDone
      ? `<div class="wc-done${isFull?' full':''}" title="${dayInfo.done}/${dayInfo.total} pasti"></div>`
      : '';

    // Show a small amber dot inline in the badge when logged type differs from schedule
    const overrideDot = hasDone && (visualOn !== scheduledOn)
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
  const isToday = dateKey === localDate();
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
    } else if (isToday && S.checked[`${type}-${i}`]) {
      // Solo per oggi: pasto spuntato senza log → usa piano come stima
      const m = effMeal(type,i);
      eK+=m.kcal; eP+=m.p; eC+=m.c; eF+=m.f;
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
// Partial render ? only what changes when log items are added/removed
// Skips greeting and calendar (expensive, unnecessary for log changes)
function renderTodayLog() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];

  const {eK, eP, eC, eF} = renderMacroStrip(type, meals, tgt);
  renderWater();

  // Alerts — shown only at end of day (≥20:00) or when viewing a past date
  // Thresholds: future configurable from Profilo > Impostazioni alert
  const ALERT_KCAL_ERR  = 300; // kcal
  const ALERT_KCAL_WARN = 150; // kcal
  const ALERT_PROT_WARN = 20;  // g
  const dK   = eK - tgt.k;
  const dateKey = S.selDate || localDate();
  const dayLog  = S.foodLog[dateKey] || {};
  const loggedCount = meals.filter((_,i) => (dayLog[i]||[]).length > 0).length;

  const nowHour = new Date().getHours();
  const todayStr = localDate(new Date());
  const isViewingPast = S.selDate && S.selDate < todayStr;
  const showAlerts = loggedCount > 0 && (isViewingPast || nowHour >= 20);

  let alertsHTML = '';
  if (showAlerts) {
    if (Math.abs(dK) > ALERT_KCAL_ERR)  alertsHTML += alert_('err', `Calorie: ${dK>0?'+':''}${dK} kcal (${eK} vs target ${tgt.k})`);
    else if (Math.abs(dK) > ALERT_KCAL_WARN) alertsHTML += alert_('warn', `Calorie: ${dK>0?'+':''}${dK} kcal (${eK} vs target ${tgt.k})`);
    if (Math.abs(eP - tgt.p) > ALERT_PROT_WARN) {
      const dP = Math.round((eP - tgt.p)*10)/10;
      alertsHTML += alert_('warn', `Proteine: ${dP>0?'+':''}${dP}g (${eP}g vs target ${tgt.p}g)`);
    }
  }
  const dashEl = document.getElementById('dash-alerts');
  if (dashEl) { dashEl.innerHTML = alertsHTML; dashEl.style.marginBottom = alertsHTML ? '8px' : '0'; }

  // Determine current meal index based on time (only for today's view)
  const isToday2 = !S.selDate || S.selDate === localDate();
  let currentMealIdx = -1;
  if (isToday2) {
    const nowMins = new Date().getHours()*60 + new Date().getMinutes();
    // First pass: meal whose window contains now (±90 min grace)
    for (let i = 0; i < meals.length; i++) {
      const m = (meals[i].time||'').match(/(\d+):(\d+)\s*[-–]\s*(\d+):(\d+)/);
      if (!m) continue;
      const start = parseInt(m[1])*60+parseInt(m[2]);
      const end   = parseInt(m[3])*60+parseInt(m[4]);
      if (nowMins >= start - 15 && nowMins <= end + 90) { currentMealIdx = i; break; }
    }
    // Second pass: next upcoming meal if none found
    if (currentMealIdx === -1) {
      let minDiff = Infinity;
      for (let i = 0; i < meals.length; i++) {
        const m = (meals[i].time||'').match(/(\d+):(\d+)/);
        if (!m) continue;
        const start = parseInt(m[1])*60+parseInt(m[2]);
        if (start > nowMins && start - nowMins < minDiff) { minDiff = start-nowMins; currentMealIdx = i; }
      }
    }
  }

  const _activeExtra = S.extraMealsActive?.[dateKey] || {};
  let _mealsHTML = '';
  meals.forEach((_, i) => {
    _mealsHTML += mealCardHTML(type, i, 'today', i === currentMealIdx);
    if (i === 0) {
      _mealsHTML += _activeExtra.merenda
        ? extraMealCardHTML('merenda', dateKey)
        : extraMealAddBtnHTML('merenda', 'Merenda');
    }
    if (i === meals.length - 1) {
      _mealsHTML += _activeExtra.spuntino
        ? extraMealCardHTML('spuntino', dateKey)
        : extraMealAddBtnHTML('spuntino', 'Spuntino');
    }
  });
  document.getElementById('meals-today').innerHTML = _mealsHTML;

  // Progress: count meals with at least one logged item
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${loggedCount} / ${meals.length} pasti`;
  if (dpFill)  dpFill.style.width  = `${(loggedCount/meals.length)*100}%`;
}
function renderNotes() {
  const entries = Object.entries(S.notes)
    .filter(([,v]) => v && v.trim())
    .sort((a,b) => b[0].localeCompare(a[0])).slice(0, 20);
  const el = document.getElementById('notes-prev');
  if (!el) return;
  if (!entries.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="notes-hist-label">Storico</div>` +
    entries.map(([k,v]) => `
    <div class="note-item">
      <span class="note-date">${k.split('-').reverse().join('/')}</span>
      <span class="note-text">${esc(v)}</span>
      <button class="note-del" onclick="deleteNote('${k}')" title="Elimina nota">✕</button>
    </div>`).join('');
}
function renderPiano() {
  if (!S.templates) S.templates = [];

  // --- Piano Pasti section ---
  const planType = S.planTab || 'on';
  // Sync toggle button states
  const ptOn  = document.getElementById('pt-on');
  const ptOff = document.getElementById('pt-off');
  if (ptOn)  ptOn.className  = 'pt on'  + (planType === 'on'  ? ' active' : '');
  if (ptOff) ptOff.className = 'pt off' + (planType === 'off' ? ' active' : '');
  // Meal cards in edit mode
  const planMealsEl = document.getElementById('piano-meals-list');
  if (planMealsEl) {
    planMealsEl.innerHTML = S.meals[planType].map((_, i) => mealCardHTML(planType, i, 'edit')).join('');
  }
  // Macro summary for the day
  const planMacroEl = document.getElementById('piano-macros-summary');
  if (planMacroEl) {
    const totals = S.meals[planType].reduce((acc, _, i) => {
      const mm = mealMacros(S.meals[planType][i]);
      return { k: acc.k + mm.kcal, p: acc.p + mm.p, c: acc.c + mm.c, f: acc.f + mm.f };
    }, { k:0, p:0, c:0, f:0 });
    planMacroEl.innerHTML =
      `<span class="pill pk">${totals.k} kcal</span>` +
      `<span class="pill pp">P ${totals.p.toFixed(0)}g</span>` +
      `<span class="pill pc">C ${totals.c.toFixed(0)}g</span>` +
      `<span class="pill pf">F ${totals.f.toFixed(0)}g</span>`;
  }
  // Integratori
  renderSupplements();

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

  const listEl = document.getElementById('tmpl-list');
  if (!filtered.length) {
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:24px 0;text-align:center">${
      S.templates.length ? 'Nessun template con questo tag.' : 'Nessun template. Creane uno con +.'
    }</div>`;
    return;
  }

  const TMPL_TYPE_EMOJI = {colazione:'🥣', pranzo:'🍽️', cena:'🍳', merenda:'🍎', spuntino:'⚡', altro:'📦'};

  listEl.innerHTML = '';
  filtered.forEach(t => {
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

    listEl.appendChild(card);
  });
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
function renderStats() {
  // ? ?  Summary: streak, score, adherence ? ? 
  const streak = calcStreak();
  const score  = calcWeekScore();
  const adh    = calcAdherence(28);
  const scoreCls = score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'err';
  document.getElementById('stats-sub').textContent =
    `Settimana in corso · Score ${score}/100 · ${streak} giorni consecutivi`;

  document.getElementById('stats-summary').innerHTML = `
    <div class="stats-summary">
      <div class="sc-card">
        <div class="sc-val ${scoreCls}">${score}</div>
        <div class="sc-lbl">Score settimana</div>
        <div class="sc-sub">/ 100</div>
      </div>
      <div class="sc-card">
        <div class="sc-val${streak>=7?' ok':''}">${streak}</div>
        <div class="sc-lbl">Streak giorni</div>
        <div class="sc-sub">consecutivi</div>
      </div>
      <div class="sc-card">
        <div class="sc-val${adh>=70?' ok':adh>=40?' warn':' err'}">${adh}%</div>
        <div class="sc-lbl">Aderenza</div>
        <div class="sc-sub">ultimi 28 gg</div>
      </div>
    </div>`;

  // ? ?  Measurements form ? ? 
  renderMeasurementsForm();

  // ? ?  Peso graph ? ? 
  const log = S.weightLog;
  if (!log.length) {
    document.getElementById('w-empty').style.display = 'block';
    document.getElementById('w-canvas').style.display = 'none';
    document.getElementById('w-log').style.display = 'none';
    document.getElementById('w-stats').innerHTML = '';
  } else {
    document.getElementById('w-empty').style.display = 'none';
    document.getElementById('w-canvas').style.display = 'block';
    document.getElementById('w-log').style.display = 'block';
    const vals = log.map(l=>l.val);
    const delta = (vals[vals.length-1]-vals[0]).toFixed(1);
    const avg = (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1);
    const dc = +delta>0?'var(--on)':+delta<0?'var(--red)':'var(--muted)';
    document.getElementById('w-stats').innerHTML = `
      <div class="w-stats" style="margin-bottom:12px">
        <div class="ws"><div class="ws-l">Attuale</div><div class="ws-v">${vals[vals.length-1]} kg</div></div>
        <div class="ws"><div class="ws-l">Partenza</div><div class="ws-v">${vals[0]} kg</div></div>
        <div class="ws"><div class="ws-l">?  totale</div><div class="ws-v" style="color:${dc}">${+delta>0?'+':''}${delta} kg</div></div>
        <div class="ws"><div class="ws-l">Media</div><div class="ws-v">${avg} kg</div></div>
      </div>`;
    drawChart(log);
    document.getElementById('w-log').innerHTML = `
      <div class="w-log-title">Pesate</div>
      ${[...log].reverse().map((l,ri,arr) => {
        const prev = arr[ri+1];
        let dlt = '';
        if (prev) { const d=(l.val-prev.val).toFixed(1); const cls=+d>0?'d-pos':+d<0?'d-neg':'d-neu'; dlt=`<span class="w-delta ${cls}">${+d>0?'+':''}${d} kg</span>`; }
        return `<div class="w-log-item">
          <span class="w-log-date">${l.date}</span>
          <span class="w-log-val">${l.val} kg</span>
          ${dlt}
          <button class="w-del" onclick="delWeight(${log.length-1-ri})">✕</button>
        </div>`;
      }).join('')}`;
  }

  // ? ?  Heatmap ? ? 
  renderHeatmap();
  renderMeasCompare();
  // ? ?  ON/OFF ratio ? ? 
  renderRatio();
}
function renderProfile() {
  renderAnagrafica();
  renderOnDaysPicker();
  renderGoalCard();
  renderSupplements();
}
function drawChart(log) {
  const el = document.getElementById('w-canvas');
  el.width = el.offsetWidth || 680; el.height = 200;
  const ctx = el.getContext('2d');
  const W=el.width, H=el.height, pad={t:20,r:80,b:32,l:46};
  const vals = log.map(l=>l.val);
  const PROJ_WEEKS = 4; // proiezione 4 settimane

  // Linear regression per trend
  const n = vals.length;
  let sumX=0,sumY=0,sumXY=0,sumX2=0;
  vals.forEach((v,i)=>{ sumX+=i; sumY+=v; sumXY+=i*v; sumX2+=i*i; });
  const slope = n>1 ? (n*sumXY - sumX*sumY)/(n*sumX2 - sumX*sumX) : 0;
  const intercept = n>1 ? (sumY - slope*sumX)/n : vals[0];

  // Target weight from goal or +0.375/week default
  const targetW = S.goal?.targetWeight || null;
  const defaultSlope = 0.375/7; // per entry (assuming weekly)

  // Extended range for projection
  const totalPoints = n + PROJ_WEEKS;
  const projVals = Array.from({length:PROJ_WEEKS}, (_,i) => intercept + slope*(n+i));

  // Y range: include target and projection
  const allVals = [...vals, ...projVals, targetW].filter(v=>v!=null);
  const vmin = Math.min(...allVals) - 0.8;
  const vmax = Math.max(...allVals) + 0.8;

  const xs = i => pad.l + (W-pad.l-pad.r)*i/Math.max(totalPoints-1,1);
  const ys = v => H-pad.b - (v-vmin)/(vmax-vmin)*(H-pad.t-pad.b);
  ctx.clearRect(0,0,W,H);

  // Grid lines
  [0,.25,.5,.75,1].forEach(t => {
    const y=pad.t+(H-pad.t-pad.b)*t, v=(vmax-(vmax-vmin)*t).toFixed(1);
    ctx.strokeStyle='#e2dfd8';ctx.lineWidth=1;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';ctx.fillText(v,2,y+3);
  });

  // Vertical separator between real and projection
  if (n > 1) {
    const sepX = xs(n-1);
    ctx.strokeStyle='#e2dfd8';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(sepX,pad.t);ctx.lineTo(sepX,H-pad.b);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#8c877f';ctx.font='8px JetBrains Mono';
    ctx.fillText('oggi',sepX+3,pad.t+10);
  }

  // Target weight line (from goal)
  if (targetW) {
    const ty = ys(targetW);
    ctx.strokeStyle='#1c52a0';ctx.lineWidth=1;ctx.setLineDash([5,3]);
    ctx.beginPath();ctx.moveTo(pad.l,ty);ctx.lineTo(W-pad.r,ty);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='#1c52a0';ctx.font='9px JetBrains Mono';
    ctx.fillText(`target ${targetW}kg`,W-pad.r+3,ty+3);
  }

  // Trend line (full range)
  if (n > 2) {
    ctx.strokeStyle='rgba(44,158,90,.25)';ctx.lineWidth=1.5;ctx.setLineDash([]);
    ctx.beginPath();
    for (let i=0;i<totalPoints;i++) {
      const tv = intercept + slope*i;
      i===0 ? ctx.moveTo(xs(i),ys(tv)) : ctx.lineTo(xs(i),ys(tv));
    }
    ctx.stroke();
  }

  // Projection area (shaded)
  if (n > 1 && projVals.length) {
    ctx.fillStyle='rgba(26,107,63,.05)';
    ctx.beginPath();
    ctx.moveTo(xs(n-1),H-pad.b);
    projVals.forEach((v,i)=>ctx.lineTo(xs(n+i),ys(v)));
    ctx.lineTo(xs(totalPoints-1),H-pad.b);
    ctx.closePath();ctx.fill();

    // Projection line dashed
    ctx.strokeStyle='rgba(26,107,63,.4)';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(xs(n-1),ys(vals[n-1]));
    projVals.forEach((v,i)=>ctx.lineTo(xs(n+i),ys(v)));
    ctx.stroke();ctx.setLineDash([]);
    // Projection end label
    const projEnd = projVals[projVals.length-1];
    ctx.fillStyle='rgba(26,107,63,.7)';ctx.font='9px JetBrains Mono';
    ctx.fillText(`${projEnd.toFixed(1)}`,xs(totalPoints-1)+3,ys(projEnd)+3);
    ctx.fillText('+4sett',xs(totalPoints-1)+3,ys(projEnd)+13);
  }

  if (vals.length < 2) {
    ctx.fillStyle='#1a6b3f';ctx.beginPath();ctx.arc(xs(0),ys(vals[0]),4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';
    ctx.fillText(log[0].date.slice(0,5), pad.l+6, H-4);
    return;
  }

  // Area fill under real data
  const g=ctx.createLinearGradient(0,pad.t,0,H-pad.b);
  g.addColorStop(0,'rgba(26,107,63,.18)');g.addColorStop(1,'rgba(26,107,63,0)');
  ctx.fillStyle=g;ctx.beginPath();
  ctx.moveTo(xs(0),H-pad.b);
  vals.forEach((v,i)=>ctx.lineTo(xs(i),ys(v)));
  ctx.lineTo(xs(n-1),H-pad.b);ctx.closePath();ctx.fill();

  // Real data line
  ctx.strokeStyle='#1a6b3f';ctx.lineWidth=2;ctx.lineJoin='round';ctx.setLineDash([]);
  ctx.beginPath();vals.forEach((v,i)=>i?ctx.lineTo(xs(i),ys(v)):ctx.moveTo(xs(i),ys(v)));ctx.stroke();

  // Dots + date labels
  vals.forEach((v,i)=>{
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#1a6b3f';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(xs(i),ys(v),4,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#8c877f';ctx.font='9px JetBrains Mono';
    const lx = Math.min(Math.max(xs(i)-12, pad.l), W-pad.r-36);
    ctx.fillText(log[i].date.slice(0,5), lx, H-4);
  });
}
function renderHeatmap() {
  const el = document.getElementById('stats-heatmap');
  if (!el) return;
  const CELL=14, GAP=3, DOW_W=18, STEP=CELL+GAP;
  const ON_SET = new Set(S.onDays);
  const today = new Date(); today.setHours(23,59,59,0);
  const start = new Date(today); start.setDate(today.getDate()-83);
  const startDow = start.getDay();
  start.setDate(start.getDate() + (startDow===0?-6:1-startDow));

  // Build week matrix
  const weeks=[], d=new Date(start);
  let week=[];
  while(d<=today){ week.push({key:localDate(d),dow:d.getDay(),date:new Date(d),info:S.doneByDate[localDate(d)]}); if(week.length===7){weeks.push(week);week=[];} d.setDate(d.getDate()+1); }
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
      else if(info){ color = info.done>=info.total ? (info.type==='on'?COLORS.full_on:COLORS.full_off) : COLORS.part; }
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
      if(cell){ const note=S.notes[cell.key]?` · "${S.notes[cell.key].slice(0,30)}${S.notes[cell.key].length>30?'?':''}"`:''; this.title=`${cell.key}${cell.info?` ? ${cell.info.done}/${cell.info.total} pasti`:''}${note}`; }
    }
  };
}
function renderRatio() {
  const el = document.getElementById('stats-ratio');
  if (!el) return;
  const entries = Object.values(S.doneByDate);
  if (!entries.length) { el.innerHTML = `<div style="font-size:12px;color:var(--muted)">Nessun dato ancora.</div>`; return; }
  const onDays  = entries.filter(e=>e.type==='on').length;
  const offDays = entries.filter(e=>e.type==='off').length;
  const total = onDays + offDays;
  const onPct = total ? Math.round(onDays/total*100) : 0;
  const ON_SET = new Set(S.onDays);
  // Expected ON %
  const expOnPct = Math.round(S.onDays.length/7*100);
  el.innerHTML = `
    <div class="ratio-labels">
      <span style="color:var(--on)">ON ${onDays} giorni (${onPct}%)</span>
      <span style="color:var(--off)">OFF ${offDays} giorni</span>
    </div>
    <div class="ratio-bar"><div class="ratio-fill" style="width:${onPct}%"></div></div>
    <div style="font-size:10px;color:var(--muted);margin-top:4px">Programmazione: ${expOnPct}% ON · ${100-expOnPct}% OFF</div>
    <div class="ratio-stats">
      <div class="rs"><div class="rs-v" style="color:var(--on)">${entries.filter(e=>e.type==='on'&&e.done>=e.total).length}</div><div class="rs-l">ON completi</div></div>
      <div class="rs"><div class="rs-v" style="color:var(--off)">${entries.filter(e=>e.type==='off'&&e.done>=e.total).length}</div><div class="rs-l">OFF completi</div></div>
    </div>`;
}
function renderMeasurementsForm() {
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
  renderMeasurementsLog();
}
function renderMeasurementsLog() {
  const el = document.getElementById('measurements-log');
  if (!el) return;
  const log = [...S.measurements].reverse().slice(0,10);
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
  const todayKey = localDate();
  const checked = S.suppChecked[todayKey] || [];
  const cards = S.supplements.map((s, i) => {
    const done = checked.includes(s.id);
    return `<div class="supp-card${done?' done':''}${s.active?'':' supp-inactive'}" onclick="toggleSupp('${s.id}')">
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

  // Personalized target: 35 ml/kg base + 350 ml bonus on ON days
  const peso = S.anagrafica?.peso || 0;
  const baseMl  = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = S.day === 'on' ? 350 : 0;
  const totalMl = baseMl + bonusMl;
  const target  = Math.max(6, Math.round(totalMl / 250));

  const pct = Math.min(count / target, 1) * 100;
  const glasses = Array.from({length: target}, (_,i) =>
    `<span class="water-glass${i < count ? ' filled' : ''}" title="Bicchiere ${i+1}">🥛</span>`
  ).join('');

  const infoBtn = `<button class="water-info-btn" onmouseenter="showWaterTip(this)" onmouseleave="hideTip('tip-water')" onclick="showWaterTip(this)" title="Info fabbisogno idrico">i</button>`;

  el.innerHTML = `<div class="water-widget">
    <div class="water-top">
      <div class="water-left">
        <span class="water-icon">💧</span>
        <div>
          <div class="water-title">Acqua ${infoBtn}</div>
          <div class="water-sub">${count} di ${target} bicchieri (~${count*250} ml / ${totalMl} ml obiettivo)</div>
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
  const peso = S.anagrafica?.peso || 0;
  const baseMl  = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = S.day === 'on' ? 350 : 0;
  const totalMl = baseMl + bonusMl;
  const target  = Math.max(6, Math.round(totalMl / 250));

  tip.innerHTML = `
    <div class="tip-title">💧 Fabbisogno idrico</div>
    <div class="tip-desc">
      Formula: <strong>35 ml × kg</strong> di peso corporeo${S.day === 'on' ? ' + <strong>350 ml</strong> giorno ON' : ''}.
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
  if (!active.length) { el.style.display='none'; return; }
  el.style.display='block';
  const todayKey = localDate();
  const checked = S.suppChecked[todayKey] || [];
  const checkSVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  el.innerHTML = `
    <div class="notes-label" style="margin-bottom:8px">💊 Integratori di oggi</div>
    <div class="supp-today-row">
      ${active.map(s => {
        const done = checked.includes(s.id);
        return `<button class="supp-today-btn${done?' done':''}" onclick="toggleSupp('${s.id}')">
          <span class="supp-today-check">${done ? checkSVG : ''}</span>
          <span class="supp-today-name">${htmlEsc(s.name)}</span>
          ${s.dose ? `<span class="supp-today-dose">${htmlEsc(s.dose)}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`;
}
function showStreakTip(anchor, streak) {
  const tip = document.getElementById('tip-streak');
  if (!tip) return;
  // Find best streak ever
  let best = 0, cur = 0;
  const days = Object.keys(S.doneByDate).sort();
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
      Giorni con almeno <strong>1 pasto loggato</strong> consecutivi.<br><br>
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
function showScoreTip(anchor, score) {
  const tip = document.getElementById('tip-score');
  if (!tip) return;
  // Compute breakdown
  const now = new Date();
  const dow = now.getDay();
  const mondayOff = dow===0 ? -6 : 1-dow;
  const monday = new Date(now); monday.setDate(now.getDate()+mondayOff); monday.setHours(0,0,0,0);
  const ON_SET = new Set(S.onDays);
  let mealPts=0, onPts=0, notePts=0, days=0;
  for (let i=0; i<7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    if (d > now) break;
    const key = localDate(d);
    days++;
    const info = S.doneByDate[key];
    if (info) mealPts += info.done/info.total;
    const scheduled = ON_SET.has(d.getDay()) ? 'on' : 'off';
    if (info && info.type===scheduled) onPts++;
    if (S.notes[key]) notePts++;
  }
  const mealScore = days ? Math.round((mealPts/days)*50) : 0;
  const onScore   = days ? Math.round((onPts/days)*30)   : 0;
  const noteScore = days ? Math.round((notePts/days)*20)  : 0;
  const barColor  = score >= 75 ? 'var(--on)' : score >= 50 ? 'var(--amber)' : 'var(--red)';

  tip.innerHTML = `
    <div class="tip-title">Score · Settimana in corso</div>
    <div class="tip-desc">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:500;color:${barColor};line-height:1">${score}</div>
        <div style="flex:1">
          <div style="height:6px;background:var(--b1);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${score}%;background:${barColor};border-radius:3px;transition:width .4s"></div>
          </div>
          <div style="font-size:9px;color:var(--muted);margin-top:3px">/ 100 punti</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;font-size:11px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>&#x1F37D;&#xFE0F;  Pasti completati</span>
          <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--on)">${mealScore}<span style="font-weight:400;color:var(--muted)">/50</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>&#x1F4C5;  Piano ON/OFF rispettato</span>
          <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--blue)">${onScore}<span style="font-weight:400;color:var(--muted)">/30</span></span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>&#x1F4DD;  Note inserite</span>
          <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--amber)">${noteScore}<span style="font-weight:400;color:var(--muted)">/20</span></span>
        </div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--muted)">Basato su ${days} giorn${days===1?'o':'i'} della settimana corrente</div>
    </div>`;
  showTip('tip-score', anchor);
}
function alert_(cls, msg) {
  return `<div class="alert-slim a-${cls}"><span class="alert-dot"></span><span class="alert-txt">${msg}</span></div>`;
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
function showTip(id, anchor) {
  const tip = document.getElementById(id);
  if (!tip) return;

  // Make visible off-screen to measure size
  tip.style.visibility = 'hidden';
  tip.style.display = 'block';

  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
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
}

function hideTip(id) {
  const tip = document.getElementById(id);
  if (tip) tip.style.display = 'none';
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
