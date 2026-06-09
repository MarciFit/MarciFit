/* MarciFit Pasti rendering, templates, custom foods, shared macro cards. */

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

function renderCustomFoodsDatabasePage(activeEditIndex = -1) {
  const listEl = document.getElementById('custom-food-list');
  if (!listEl) return;
  const foods = Array.isArray(S.customFoods) ? S.customFoods : [];
  if (!foods.length) {
    listEl.innerHTML = `<div class="piano-template-section piano-template-section-compact">
      <div class="tmpl-empty-state">Non hai ancora alimenti manuali. Quando ne crei uno dal bottom sheet, lo ritrovi qui.</div>
    </div>`;
    return;
  }
  const fmtNum = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };
  listEl.innerHTML = `<div class="custom-food-list">
    ${foods.map((food, index) => {
      const isEditing = activeEditIndex === index;
      const name = htmlEsc(food.name || 'Alimento manuale');
      const kcal = Math.round(Number(food.kcal100 || 0));
      const p = fmtNum(food.p100);
      const c = fmtNum(food.c100);
      const f = fmtNum(food.f100);
      if (isEditing) {
        return `<div class="custom-food-card is-editing">
          <div class="custom-food-edit-head">
            <span class="custom-food-badge">Personale</span>
            <strong>Modifica alimento</strong>
          </div>
          <div class="custom-food-form">
            <label class="custom-food-field custom-food-field-name">Nome<input id="cf-name-${index}" type="text" value="${name}" autocomplete="off"></label>
            <label class="custom-food-field">Kcal / 100g<input id="cf-kcal-${index}" type="number" min="0" step="1" value="${kcal}"></label>
            <label class="custom-food-field">Prot / 100g<input id="cf-p-${index}" type="number" min="0" step="0.1" value="${p}"></label>
            <label class="custom-food-field">Carb / 100g<input id="cf-c-${index}" type="number" min="0" step="0.1" value="${c}"></label>
            <label class="custom-food-field">Grassi / 100g<input id="cf-f-${index}" type="number" min="0" step="0.1" value="${f}"></label>
          </div>
          <div class="custom-food-actions">
            <button class="tmpl-btn-sec" onclick="cancelEditCustomFood()">Annulla</button>
            <button class="tmpl-btn-load" onclick="saveCustomFood(${index})">Salva</button>
          </div>
        </div>`;
      }
      return `<div class="custom-food-card">
        <div class="custom-food-main">
          <div class="custom-food-top">
            <span class="custom-food-badge">Personale</span>
            <span class="custom-food-kcal">${kcal} kcal/100g</span>
          </div>
          <div class="custom-food-name">${name}</div>
          <div class="custom-food-macros">
            <span>P ${p}g</span>
            <span>C ${c}g</span>
            <span>G ${f}g</span>
          </div>
        </div>
        <div class="custom-food-actions">
          <button class="tmpl-btn-sec tmpl-btn-icon" onclick="editCustomFood(${index})" title="Modifica alimento" aria-label="Modifica alimento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="tmpl-btn-sec tmpl-btn-icon" onclick="deleteCustomFood(${index})" title="Elimina alimento" aria-label="Elimina alimento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderPiano() {
  if (!S.templates) S.templates = [];
  if (typeof renderWeekCal === 'function') renderWeekCal(new Date());
  renderTodayLog();
  const pianoUi = typeof ensurePianoUiState === 'function'
    ? ensurePianoUiState()
    : { activeMealFilter: 'all', templateSort: 'useful_now', helperExpanded: true, activeSubView: 'meals', editCustomFoodIndex: -1 };
  const activeSubView = ['templates', 'customFoods'].includes(pianoUi.activeSubView) ? pianoUi.activeSubView : 'meals';
  const pianoView = document.getElementById('view-piano');
  if (pianoView) {
    pianoView.classList.toggle('is-template-subview', activeSubView === 'templates');
    pianoView.classList.toggle('is-custom-foods-subview', activeSubView === 'customFoods');
    pianoView.classList.toggle('is-meals-subview', activeSubView === 'meals');
  }
  renderCustomFoodsDatabasePage(activeSubView === 'customFoods' ? pianoUi.editCustomFoodIndex : -1);
  if (activeSubView === 'customFoods') return;
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
  listEl.innerHTML = `
    <div class="tmpl-rail-shell">
      <div class="tmpl-rail-head">
        <div class="tmpl-rail-title">Template per ${activeFilterLabel}</div>
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
