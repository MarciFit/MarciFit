// bootstrapTools.js - helper per initAll, migrazioni e recovery stato

function sanitizeMealIcons(state) {
  function isBadIcon(x) {
    if (typeof x !== 'string') return true;
    if (!x.trim()) return true;
    if (/^[?\s]+$/.test(x)) return true;
    if (x.includes('\uFFFD')) return true;
    if (/[\u3400-\u4DBF\u4E00-\u9FFF]/.test(x)) return true;
    return false;
  }
  function defaultIconFor(name, idx) {
    const n = String(name || '').toLowerCase();
    if (n.includes('colazione')) return '\u{1F963} ';
    if (n.includes('pranzo')) return '\u{1F37D}\uFE0F ';
    if (n.includes('cena')) return '\u{1F373} ';
    if (n.includes('spuntino')) return '\u{26A1} ';
    if (idx === 0) return '\u{1F963} ';
    if (idx === 1) return '\u{1F37D}\uFE0F ';
    if (idx === 2) return '\u{26A1} ';
    return '\u{1F373} ';
  }

  let fixedCount = 0;
  ['on', 'off'].forEach(type => {
    (state.meals && Array.isArray(state.meals[type]) ? state.meals[type] : []).forEach((meal, idx) => {
      if (isBadIcon(meal.icon)) {
        meal.icon = defaultIconFor(meal.name, idx);
        fixedCount++;
      }
      if (typeof meal.icon === 'string') {
        meal.icon = meal.icon.replace('\u{1F37D} \uFE0F', '\u{1F37D}\uFE0F');
      }
    });
  });
  return fixedCount;
}

function ensureBootstrapDefaults(state) {
  if (!Array.isArray(state.measurements)) state.measurements = [];
  if (!Array.isArray(state.weightLog)) state.weightLog = [];
  if (!state.notes || typeof state.notes !== 'object' || Array.isArray(state.notes)) state.notes = {};
  if (!state.profHist || typeof state.profHist !== 'object' || Array.isArray(state.profHist)) state.profHist = {};
  if (!state.goal || typeof state.goal !== 'object' || Array.isArray(state.goal)) {
    state.goal = { phase: 'bulk', startDate: null, targetWeight: null, notes: '', calibrationOffsetKcal: 0, calibrationMeta: null };
  }
  if (!('calibrationOffsetKcal' in state.goal)) state.goal.calibrationOffsetKcal = 0;
  if (!('calibrationMeta' in state.goal)) state.goal.calibrationMeta = null;
  if (!Array.isArray(state.profilo)) state.profilo = [];
  if (!state.anagrafica || typeof state.anagrafica !== 'object' || Array.isArray(state.anagrafica)) {
    state.anagrafica = {
      nome: '',
      sesso: 'm',
      eta: null,
      altezza: null,
      peso: null,
      passiGiornalieri: null,
      grassoCorporeo: null,
      professione: 'desk_sedentary',
      allenamentiSett: '3-4',
    };
  }
  if (!state.meals || typeof state.meals !== 'object' || Array.isArray(state.meals)) state.meals = { on: [], off: [] };
  if (!Array.isArray(state.meals.on)) state.meals.on = [];
  if (!Array.isArray(state.meals.off)) state.meals.off = [];
  if (!state.macro || typeof state.macro !== 'object' || Array.isArray(state.macro)) {
    state.macro = {
      on: { p: 130, c: 295, f: 70, k: 2350 },
      off:{ p: 130, c: 235, f: 70, k: 2100 },
    };
  }
  if (!state.macro.on || typeof state.macro.on !== 'object') state.macro.on = { p: 130, c: 295, f: 70, k: 2350 };
  if (!state.macro.off || typeof state.macro.off !== 'object') state.macro.off = { p: 130, c: 235, f: 70, k: 2100 };
  if (!Array.isArray(state.supplements)) state.supplements = [];
  if (!state.suppChecked || typeof state.suppChecked !== 'object' || Array.isArray(state.suppChecked)) state.suppChecked = {};
  if (!state.doneByDate || typeof state.doneByDate !== 'object' || Array.isArray(state.doneByDate)) state.doneByDate = {};
  if (!['7d', '30d', '8w', 'all'].includes(state.statsRange)) state.statsRange = '30d';
  if (!state.barcodeCache || typeof state.barcodeCache !== 'object' || Array.isArray(state.barcodeCache)) state.barcodeCache = {};
  else {
    Object.keys(state.barcodeCache).forEach(code => {
      const entry = state.barcodeCache[code];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        delete state.barcodeCache[code];
        return;
      }
      state.barcodeCache[code] = {
        ...entry,
        barcode: String(entry.barcode || code || '').replace(/\D/g, ''),
        source: entry.source || 'cache',
        completeness: Number(entry.completeness || entry.completeness_score || 0) || 0,
        updatedAt: entry.updatedAt || entry.updated_at || entry.cachedAt || null,
        cachedAt: entry.cachedAt || entry.updatedAt || entry.updated_at || new Date().toISOString(),
      };
    });
  }
  if (!state.foodCache || typeof state.foodCache !== 'object' || Array.isArray(state.foodCache)) state.foodCache = {};
  if (!state.foodSearchLearn || typeof state.foodSearchLearn !== 'object' || Array.isArray(state.foodSearchLearn)) state.foodSearchLearn = {};
  if (!state.foodLog || typeof state.foodLog !== 'object' || Array.isArray(state.foodLog)) state.foodLog = {};
  if (!state.condimentConfirmations || typeof state.condimentConfirmations !== 'object' || Array.isArray(state.condimentConfirmations)) state.condimentConfirmations = {};
  if (!Array.isArray(state.templates)) state.templates = [];
  if (!Array.isArray(state.customFoods)) state.customFoods = [];
  if (!Array.isArray(state.favoriteFoods)) state.favoriteFoods = [];
  if (!state.water || typeof state.water !== 'object' || Array.isArray(state.water)) state.water = {};
  if (!state.waterTargetOverrides || typeof state.waterTargetOverrides !== 'object' || Array.isArray(state.waterTargetOverrides)) state.waterTargetOverrides = {};
  if (!state.cheatMealsByDate || typeof state.cheatMealsByDate !== 'object' || Array.isArray(state.cheatMealsByDate)) state.cheatMealsByDate = {};
  if (!state.mealPlanner || typeof state.mealPlanner !== 'object' || Array.isArray(state.mealPlanner)) {
    state.mealPlanner = {
      on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
      off: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
    };
  }
  if (!Array.isArray(state.onDays) || !state.onDays.length) state.onDays = [1, 3, 5];
  if (typeof state.noteSearch !== 'string') state.noteSearch = '';
  if (!state.pianoUi || typeof state.pianoUi !== 'object') {
    state.pianoUi = {
      activeMealFilter: 'all',
      templateSort: 'useful_now',
      helperExpanded: true,
    };
  }
  if (typeof state.pianoUi.activeMealFilter !== 'string') state.pianoUi.activeMealFilter = 'all';
  if (typeof state.pianoUi.templateSort !== 'string') state.pianoUi.templateSort = 'useful_now';
  if (typeof state.pianoUi.helperExpanded !== 'boolean') state.pianoUi.helperExpanded = true;
  if (typeof state.authEntryCompleted !== 'boolean') state.authEntryCompleted = false;
  if (typeof state.onboardingVersion !== 'number') state.onboardingVersion = 1;
  if (state.checked) delete state.checked;
  if (state.anagrafica && !('passiGiornalieri' in state.anagrafica)) state.anagrafica.passiGiornalieri = null;
  if (Array.isArray(state.favoriteFoods) && typeof normalizeFavoriteFoods === 'function') {
    state.favoriteFoods = normalizeFavoriteFoods(state.favoriteFoods);
  }
  if (Array.isArray(state.templates) && typeof getTemplateMealType === 'function') {
    state.templates = state.templates.map(template => ({
      ...template,
      mealType: template.mealType || getTemplateMealType(template),
      usageCount: Number(template.usageCount || 0) || 0,
      pinned: !!template.pinned,
      source: template.source || 'manual',
    }));
  }
}

function migrateTemplateMealTypes(state) {
  (state.templates || []).forEach(template => {
    if (!template.mealType && template.tag) {
      const tag = template.tag.toLowerCase();
      const types = ['colazione', 'pranzo', 'cena', 'merenda', 'spuntino'];
      template.mealType = types.find(type => tag.includes(type)) || template.tag.split(',')[0].trim() || 'altro';
    }
  });
}

function migrateProfiloToAnagrafica(state) {
  if (state.anagrafica) return;
  const findP = lbl => state.profilo?.find(row => row.l === lbl)?.v || '';
  state.anagrafica = {
    nome: findP('Nome') || '',
    sesso: 'm',
    eta: parseInt(findP('Età')) || null,
    altezza: parseInt(findP('Altezza')) || null,
    peso: parseFloat(findP('Peso attuale')) || null,
    passiGiornalieri: null,
    grassoCorporeo: null,
    professione: 'desk_sedentary',
    allenamentiSett: '3-4',
  };
}

function migrateFlatMealsToItems(state) {
  ['on', 'off'].forEach(type => {
    state.meals[type]?.forEach(meal => {
      if (!meal.items) {
        meal.items = [{
          name: meal.ingr || meal.name || 'Ingredienti',
          brand: '',
          grams: 100,
          kcal100: meal.kcal || 0,
          p100: meal.p || 0,
          c100: meal.c || 0,
          f100: meal.f || 0,
        }];
      }
    });
  });
}

function normalizeLegacyMealIcons(state) {
  const iconMap = new Map([
    ['\u2600 ', '🥣 '],
    ['\u25C6 ', '🍽️ '],
    ['\u25CF ', '🥚 '],
    ['\u25CB ', '🍎 '],
  ]);
  ['on', 'off'].forEach(type => {
    state.meals[type]?.forEach(meal => {
      if (typeof meal.icon === 'string') {
        const mapped = iconMap.get(meal.icon);
        if (mapped) meal.icon = mapped;
        meal.icon = meal.icon
          .replace('🥣 🍽️', '🍽️')
          .replace('🥣🥚', '🥚')
          .replace(/\s+$/, ' ');
      }
    });
  });
}

function normalizePersistedStateForBootstrap(state) {
  const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const validProfessionKeys = (typeof VALID_PROFESSION_KEYS !== 'undefined' && Array.isArray(VALID_PROFESSION_KEYS))
    ? VALID_PROFESSION_KEYS
    : ['desk_sedentary', 'desk_light', 'standing', 'physical_light', 'physical_heavy'];
  const validWorkoutKeys = (typeof VALID_WORKOUT_FREQ_KEYS !== 'undefined' && Array.isArray(VALID_WORKOUT_FREQ_KEYS))
    ? VALID_WORKOUT_FREQ_KEYS
    : ['0', '1-2', '3-4', '5-6', '7+'];
  const defaultMacro = {
    on: { p: 130, c: 295, f: 70, k: 2350 },
    off: { p: 130, c: 235, f: 70, k: 2100 },
  };
  const toFiniteNumber = value => {
    if (value == null || value === '') return null;
    const parsed = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(parsed) ? parsed : null;
  };
  const numberInRangeOrNull = (value, min, max) => {
    const parsed = toFiniteNumber(value);
    if (parsed == null) return null;
    if (parsed < min || parsed > max) return null;
    return parsed;
  };
  const normalizeWorkoutFreq = value => {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (validWorkoutKeys.includes(raw)) return raw;
    const numeric = parseInt(raw, 10);
    if (!Number.isFinite(numeric)) return '3-4';
    if (numeric <= 0) return '0';
    if (numeric <= 2) return '1-2';
    if (numeric <= 4) return '3-4';
    if (numeric <= 6) return '5-6';
    return '7+';
  };
  const normalizeGoalPhase = value => {
    if (value == null || value === '') return null;
    const phase = String(value).trim().toLowerCase();
    if (!phase) return null;
    if (['bulk', 'cut', 'mantieni'].includes(phase)) return phase;
    if (['maintain', 'maintenance', 'mantenimento'].includes(phase)) return 'mantieni';
    return null;
  };
  const sanitizeMacroDay = day => {
    if (!isPlainObject(day)) return null;
    const nextDay = {};
    for (const key of ['p', 'c', 'f', 'k']) {
      const parsed = toFiniteNumber(day[key]);
      if (parsed == null) return null;
      nextDay[key] = parsed;
    }
    return nextDay;
  };
  const sanitizeMealPlannerBranch = branch => {
    if (!isPlainObject(branch)) return null;
    return {
      mealIdx: Number.isInteger(branch.mealIdx) ? branch.mealIdx : null,
      prompt: typeof branch.prompt === 'string' ? branch.prompt : '',
      useFavorites: typeof branch.useFavorites === 'boolean' ? branch.useFavorites : true,
      useTemplates: typeof branch.useTemplates === 'boolean' ? branch.useTemplates : true,
      results: Array.isArray(branch.results) ? branch.results : [],
    };
  };

  if (!isPlainObject(state)) return null;

  let next = null;
  try {
    next = JSON.parse(JSON.stringify(state));
  } catch (_) {
    return null;
  }

  if ('day' in next && !['on', 'off'].includes(next.day)) delete next.day;
  if ('planTab' in next && !['on', 'off'].includes(next.planTab)) delete next.planTab;
  if ('statsRange' in next && !['7d', '30d', '8w', 'all'].includes(next.statsRange)) delete next.statsRange;
  if ('selDate' in next && !(next.selDate == null || typeof next.selDate === 'string')) next.selDate = null;
  if ('onDays' in next && !Array.isArray(next.onDays)) delete next.onDays;

  if ('anagrafica' in next) {
    if (!isPlainObject(next.anagrafica)) {
      delete next.anagrafica;
    } else {
      const ana = next.anagrafica;
      if (typeof ana.nome !== 'string') ana.nome = '';
      if (!['m', 'f'].includes(ana.sesso)) ana.sesso = 'm';
      ana.eta = numberInRangeOrNull(ana.eta, 10, 99);
      ana.altezza = numberInRangeOrNull(ana.altezza, 120, 250);
      ana.peso = numberInRangeOrNull(ana.peso, 30, 300);
      ana.passiGiornalieri = numberInRangeOrNull(ana.passiGiornalieri, 1000, 40000);
      ana.grassoCorporeo = numberInRangeOrNull(ana.grassoCorporeo, 3, 60);
      if (!(ana.professione == null || typeof ana.professione === 'string')) ana.professione = null;
      if (typeof ana.professione === 'string' && ana.professione && !validProfessionKeys.includes(ana.professione)) {
        ana.professione = 'desk_sedentary';
      }
      if (!(ana.allenamentiSett == null || typeof ana.allenamentiSett === 'string')) ana.allenamentiSett = null;
      ana.allenamentiSett = normalizeWorkoutFreq(ana.allenamentiSett);

      const hasUsefulAnagrafica = [
        'nome',
        'eta',
        'altezza',
        'peso',
        'passiGiornalieri',
        'grassoCorporeo',
        'professione',
        'allenamentiSett',
      ].some(key => ana[key] != null && ana[key] !== '');
      if (!hasUsefulAnagrafica && Array.isArray(next.profilo) && next.profilo.length > 0) {
        delete next.anagrafica;
      }
    }
  }

  if ('goal' in next) {
    if (!isPlainObject(next.goal)) {
      delete next.goal;
    } else {
      const goal = next.goal;
      const phase = normalizeGoalPhase(goal.phase);
      if (phase) goal.phase = phase;
      else delete goal.phase;
      if (!(goal.startDate == null || typeof goal.startDate === 'string')) goal.startDate = null;
      goal.targetWeight = numberInRangeOrNull(goal.targetWeight, 30, 300);
      if (!(goal.notes == null || typeof goal.notes === 'string')) goal.notes = '';
      goal.calibrationOffsetKcal = Math.round(toFiniteNumber(goal.calibrationOffsetKcal) || 0);
      if (!(goal.calibrationMeta == null || isPlainObject(goal.calibrationMeta))) goal.calibrationMeta = null;
    }
  }

  if ('macro' in next) {
    if (!isPlainObject(next.macro)) {
      delete next.macro;
    } else {
      const flatMacro = sanitizeMacroDay(next.macro);
      if (flatMacro) {
        next.macro = { on: { ...flatMacro }, off: { ...flatMacro } };
      } else {
        const macroOn = sanitizeMacroDay(next.macro.on);
        const macroOff = sanitizeMacroDay(next.macro.off);
        if (!macroOn || !macroOff) {
          delete next.macro;
        } else {
          next.macro = {
            on: { ...defaultMacro.on, ...macroOn },
            off: { ...defaultMacro.off, ...macroOff },
          };
        }
      }
    }
  }

  if ('mealPlanner' in next) {
    if (!isPlainObject(next.mealPlanner)) {
      delete next.mealPlanner;
    } else {
      const plannerOn = sanitizeMealPlannerBranch(next.mealPlanner.on);
      const plannerOff = sanitizeMealPlannerBranch(next.mealPlanner.off);
      next.mealPlanner = {};
      if (plannerOn) next.mealPlanner.on = plannerOn;
      if (plannerOff) next.mealPlanner.off = plannerOff;
      if (!Object.keys(next.mealPlanner).length) delete next.mealPlanner;
    }
  }

  if ('cheatConfig' in next) {
    if (!isPlainObject(next.cheatConfig)) {
      delete next.cheatConfig;
    } else {
      const cfg = next.cheatConfig;
      const weeklyMax = Number.isInteger(cfg.weeklyMax) ? cfg.weeklyMax : 2;
      const hardMax = Number.isInteger(cfg.hardMax) ? cfg.hardMax : 3;
      const fixedKcal = Number.isFinite(cfg.fixedKcal) ? Math.round(cfg.fixedKcal) : 350;
      const surplusPct = Number.isFinite(cfg.surplusPct) ? cfg.surplusPct : 12;
      next.cheatConfig = {
        enabled: cfg.enabled !== false,
        weeklyMax: Math.max(0, Math.min(3, weeklyMax)),
        hardMax: Math.max(1, Math.min(3, hardMax)),
        defaultMode: cfg.defaultMode === 'fixed' ? 'fixed' : 'surplus_pct',
        surplusPct: Math.max(5, Math.min(20, surplusPct)),
        fixedKcal: Math.max(150, Math.min(800, fixedKcal)),
      };
      if (next.cheatConfig.weeklyMax > next.cheatConfig.hardMax) {
        next.cheatConfig.weeklyMax = next.cheatConfig.hardMax;
      }
    }
  }

  return next;
}

function finalizeBootstrapState(state, hadSaved) {
  const hasEstablishedState = typeof authHasMeaningfulState === 'function'
    ? authHasMeaningfulState(state)
    : !!hadSaved;
  state.selDate = null;
  if (typeof state.authEntryCompleted !== 'boolean') {
    state.authEntryCompleted = !!hadSaved || hasEstablishedState;
  }
  if (typeof state.onboardingCompleted !== 'boolean') {
    state.onboardingCompleted = !!hadSaved || hasEstablishedState;
  }
  if (hasEstablishedState) {
    state.authEntryCompleted = true;
    state.onboardingCompleted = true;
  }
  if (!hadSaved) {
    const dow = new Date().getDay();
    state.day = state.onDays.includes(dow) ? 'on' : 'off';
  }
  state.planTab = state.day;
}

function resetBootstrapUiState() {
  const ni = document.getElementById('notes-input');
  if (ni) delete ni.dataset.loaded;
}
