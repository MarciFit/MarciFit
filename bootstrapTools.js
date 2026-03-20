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
  if (!state.measurements) state.measurements = [];
  if (!state.goal) state.goal = { phase: 'bulk', startDate: null, targetWeight: null, notes: '' };
  if (!state.supplements) {
    state.supplements = [
      { id: 'creatina', name: 'Creatina Creapure', dose: '3 g', when: 'mattina', active: true },
      { id: 'vitd', name: 'Vitamina D', dose: '---', when: 'mattina', active: false },
    ];
  }
  if (!state.suppChecked) state.suppChecked = {};
  if (!state.doneByDate) state.doneByDate = {};
  if (!['7d', '30d', '8w', 'all'].includes(state.statsRange)) state.statsRange = '30d';
  if (!state.barcodeCache) state.barcodeCache = {};
  if (!state.foodCache) state.foodCache = {};
  if (!state.foodSearchLearn) state.foodSearchLearn = {};
  if (!state.foodLog) state.foodLog = {};
  if (!state.templates) state.templates = [];
  if (!state.mealPlanner) {
    state.mealPlanner = {
      on: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
      off: { mealIdx: null, prompt: '', useFavorites: true, useTemplates: true, results: [] },
    };
  }
  if (state.checked) delete state.checked;
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
    nome: findP('Nome') || 'Federico Marci',
    sesso: 'm',
    eta: parseInt(findP('Età')) || null,
    altezza: parseInt(findP('Altezza')) || null,
    peso: parseFloat(findP('Peso attuale')) || null,
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

function finalizeBootstrapState(state, hadSaved) {
  state.selDate = null;
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
