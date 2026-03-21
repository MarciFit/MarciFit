// ─────────────────────────────────────────────────────────────────────────────
// nutritionLogic.js  –  Calcoli macro, statistiche, helper date, FOOD_DB, API ricerca
// Dipendenze: S (state object da app.js), save() da storage.js
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TDEE / Macro engine — evidence-based
// Fonti: Mifflin-St Jeor (1990), Katch-McArdle (1975), WHO/FAO/UNU (2004),
//        ISSN Position Stand (2011), Helms et al. (2014)
// ─────────────────────────────────────────────────────────────────────────────

const PROFESSIONI = [
  { key: 'desk_sedentary', label: 'Scrivania — sedentario',         desc: 'Ufficio, IT, ricerca, studente',             palJob: 1.20 },
  { key: 'desk_light',     label: 'Scrivania + spostamenti',        desc: 'Manager, medico ambulatoriale, commerciale', palJob: 1.30 },
  { key: 'standing',       label: 'Prevalentemente in piedi',       desc: 'Insegnante, infermiere, commesso',            palJob: 1.45 },
  { key: 'physical_light', label: 'Lavoro fisico leggero-moderato', desc: 'Tecnico, meccanico, militare non operativo',  palJob: 1.55 },
  { key: 'physical_heavy', label: 'Lavoro fisico intenso',          desc: 'Muratore, corriere, operaio, militare',      palJob: 1.75 },
];

const ALLENAMENTI = [
  { key: '0',   label: '0',   desc: 'Nessun allenamento strutturato', dPal: 0.00 },
  { key: '1-2', label: '1–2', desc: '1–2 sessioni/sett.',             dPal: 0.10 },
  { key: '3-4', label: '3–4', desc: '3–4 sessioni/sett.',             dPal: 0.20 },
  { key: '5-6', label: '5–6', desc: '5–6 sessioni/sett.',             dPal: 0.30 },
  { key: '7+',  label: '7+',  desc: 'Allenamento quotidiano',         dPal: 0.40 },
];

// BMR: Katch-McArdle se % grasso disponibile, altrimenti Mifflin-St Jeor
function calcBMR(ana) {
  const { peso, altezza, eta, sesso, grassoCorporeo } = ana;
  if (!peso || !altezza || !eta) return null;
  if (grassoCorporeo != null && grassoCorporeo > 0) {
    const lbm = peso * (1 - grassoCorporeo / 100);
    return Math.round(370 + 21.6 * lbm);
  }
  // Mifflin-St Jeor
  const base = 10 * peso + 6.25 * altezza - 5 * eta;
  return Math.round(sesso === 'f' ? base - 161 : base + 5);
}

// PAL = PAL_occupazione + Δ_esercizio (cap 2.50)
function calcPAL(ana) {
  const prof = PROFESSIONI.find(p => p.key === ana.professione) || PROFESSIONI[0];
  const all  = ALLENAMENTI.find(a => a.key === ana.allenamentiSett) || ALLENAMENTI[2];
  return Math.min(+(prof.palJob + all.dPal).toFixed(2), 2.50);
}

function calcTDEE(ana) {
  const bmr = calcBMR(ana);
  if (!bmr) return null;
  return Math.round(bmr * calcPAL(ana));
}

// Calcola macro ON e OFF per il giorno dato il TDEE e il goal
function calcMacros(tdee, peso, goal) {
  if (!tdee || !peso) return null;
  const phase = goal?.phase || 'mantieni';

  // Calorie target per giorno ON e OFF
  const kcalOn  = phase === 'bulk'     ? tdee + 250
                : phase === 'cut'      ? tdee - 300
                : /* mantieni */        tdee;
  const kcalOff = phase === 'bulk'     ? tdee
                : phase === 'cut'      ? tdee - 500
                : /* mantieni */        tdee - 100;

  // Proteine (g/kg, invariate ON=OFF)
  const protG = Math.round(
    phase === 'cut' ? 2.3 * peso :
    phase === 'bulk' ? 2.0 * peso :
    1.8 * peso
  );

  function buildDay(kcal) {
    // Grassi: min 0.7g/kg, min 25% kcal; max 35% kcal
    let fat = Math.max(0.7 * peso, kcal * 0.25 / 9);
    fat = Math.min(fat, kcal * 0.35 / 9);
    fat = Math.round(fat);
    // Carboidrati: calorie residue
    const carb = Math.max(0, Math.round((kcal - protG * 4 - fat * 9) / 4));
    const kcalReal = Math.round(protG * 4 + carb * 4 + fat * 9);
    return { p: protG, c: carb, f: fat, k: kcalReal };
  }

  return { macroOn: buildDay(kcalOn), macroOff: buildDay(kcalOff) };
}

// Funzione principale: restituisce {bmr, pal, tdee, formula, macroOn, macroOff}
function computeNutrition(ana, goal) {
  const bmr = calcBMR(ana);
  if (!bmr) return null;
  const pal  = calcPAL(ana);
  const tdee = Math.round(bmr * pal);
  const formula = (ana.grassoCorporeo != null && ana.grassoCorporeo > 0)
    ? 'Katch-McArdle' : 'Mifflin-St Jeor';
  const macros = calcMacros(tdee, ana.peso, goal);
  if (!macros) return null;
  return { bmr, pal, tdee, formula, ...macros };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper date / stringhe
// ─────────────────────────────────────────────────────────────────────────────

function localDate(d) {
  const dt = d || new Date();
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getScheduledDayType(dateKey) {
  const ON_SET = new Set(S.onDays || []);
  const baseDate = dateKey ? new Date(dateKey + 'T12:00:00') : new Date();
  return ON_SET.has(baseDate.getDay()) ? 'on' : 'off';
}

function getTrackedDayType(dateKey, fallbackType) {
  return S.doneByDate?.[dateKey]?.type || fallbackType || getScheduledDayType(dateKey);
}

function getDayCompletion(dateKey, type) {
  const key = dateKey || localDate();
  const dayType = getTrackedDayType(key, type);
  const meals = S.meals?.[dayType] || [];
  const dayLog = S.foodLog?.[key] || {};
  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(key) : null;
  const extraActive = S.extraMealsActive?.[key] || {};
  const extraLogKeys = Object.keys(dayLog).filter(logKey => Number.isNaN(Number(logKey)));
  const extraKeys = Array.from(new Set([...Object.keys(extraActive), ...extraLogKeys]));

  const mealDone = meals.filter((_, i) => (dayLog[i] || []).length > 0).length;
  const extraDone = extraKeys.filter(extraKey => (dayLog[extraKey] || []).length > 0).length;
  const done = mealDone + extraDone;
  const total = meals.length + extraKeys.length;
  const cheatDone = cheat ? 1 : 0;
  const suppDone = ((S.suppChecked && S.suppChecked[key]) || []).length;
  const waterCount = (S.water && S.water[key]) || 0;
  const activityCount = done + cheatDone + (suppDone > 0 ? 1 : 0) + (waterCount > 0 ? 1 : 0);

  return {
    key,
    type: dayType,
    mealDone,
    extraDone,
    done,
    total,
    cheatDone,
    suppDone,
    waterCount,
    activityCount,
    hasMealsLogged: done > 0,
    hasActivity: activityCount > 0,
  };
}

function getMealPlannerTarget(type, mealIdx) {
  const meals = S.meals?.[type] || [];
  const meal = meals[mealIdx];
  const daily = S.macro?.[type];
  if (!meal || !daily) return null;
  const totals = meals.reduce((acc, currentMeal) => {
    const mm = mealMacros(currentMeal);
    acc.k += mm.kcal;
    acc.p += mm.p;
    acc.c += mm.c;
    acc.f += mm.f;
    return acc;
  }, { k: 0, p: 0, c: 0, f: 0 });
  const mealMac = mealMacros(meal);
  const ratio = totals.k > 0 ? daily.k / totals.k : 1;
  return {
    k: Math.round(mealMac.kcal * ratio),
    p: Math.round(mealMac.p * ratio * 10) / 10,
    c: Math.round(mealMac.c * ratio * 10) / 10,
    f: Math.round(mealMac.f * ratio * 10) / 10,
  };
}

function htmlEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Calcoli macro pasto
// ─────────────────────────────────────────────────────────────────────────────

// Calcola macro da items[] – fallback su campi flat per backward compat
function mealMacros(meal) {
  if (meal?.items?.length) {
    return meal.items.reduce((acc, it) => {
      const g = (it.grams || 0) / 100;
      return {
        kcal: acc.kcal + Math.round(it.kcal100 * g),
        p:    Math.round((acc.p + it.p100 * g) * 10) / 10,
        c:    Math.round((acc.c + it.c100 * g) * 10) / 10,
        f:    Math.round((acc.f + it.f100 * g) * 10) / 10,
      };
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }
  return { kcal: meal?.kcal || 0, p: meal?.p || 0, c: meal?.c || 0, f: meal?.f || 0 };
}

// Testo ingredienti leggibile da items[]
function mealIngrText(meal) {
  if (meal?.items?.length) {
    return meal.items
      .filter(it => it.grams > 0)
      .map(it => `${it.name} ${it.grams} g`)
      .join(' + ') || '–';
  }
  return meal?.ingr || '–';
}

function normalizePlannerName(value) {
  return String(value || '').trim().toLowerCase();
}

function plannerCloneItem(item, grams) {
  return {
    name: item.name,
    brand: item.brand || '',
    grams,
    kcal100: item.kcal100,
    p100: item.p100 || 0,
    c100: item.c100 || 0,
    f100: item.f100 || 0,
  };
}

function plannerGapScore(target, macros) {
  if (!target) return 9999;
  return (
    Math.abs((target.k || 0) - (macros.kcal || 0)) * 1.2 +
    Math.abs((target.p || 0) - (macros.p || 0)) * 10 +
    Math.abs((target.c || 0) - (macros.c || 0)) * 7 +
    Math.abs((target.f || 0) - (macros.f || 0)) * 9
  );
}

function plannerDelta(target, macros) {
  return {
    k: Math.round(((macros.kcal || 0) - (target.k || 0)) * 10) / 10,
    p: Math.round(((macros.p || 0) - (target.p || 0)) * 10) / 10,
    c: Math.round(((macros.c || 0) - (target.c || 0)) * 10) / 10,
    f: Math.round(((macros.f || 0) - (target.f || 0)) * 10) / 10,
  };
}

function plannerFindFoodsByPrompt(prompt) {
  const parts = String(prompt || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!parts.length) return [];
  const picked = new Map();
  parts.forEach(part => {
    const queryCtx = buildFoodQueryContext(part);
    const matches = dedupeFoodResults([
      ...(S.favoriteFoods || []).map(f => ({ ...f, src: 'favorite' })),
      ...(S.customFoods || []).map(f => ({ ...f, src: 'local' })),
      ...FOOD_DB.map(f => ({ ...f, src: 'local' })),
      ...getRecentFoods(queryCtx),
    ].filter(item => hasQueryMatch(item, queryCtx)), queryCtx, 4);
    matches.forEach(match => {
      const key = `${normalizePlannerName(match.name)}|${Math.round(match.kcal100 || 0)}`;
      if (!picked.has(key)) picked.set(key, match);
    });
  });
  return Array.from(picked.values());
}

function plannerSuggestPortion(food, target, existingItems) {
  const options = Array.from(new Set([
    food.typicalGrams || food.grams || 100,
    40, 60, 80, 100, 120, 150, 180, 200, 250, 300,
  ])).filter(g => g >= 20 && g <= 400);
  let best = { grams: 100, score: Infinity };
  options.forEach(grams => {
    const macros = mealMacros({ items: [...existingItems, plannerCloneItem(food, grams)] });
    const score = plannerGapScore(target, macros);
    if (score < best.score) best = { grams, score };
  });
  return best.grams;
}

function plannerBuildFromFoods(target, foods, title, summary, baseItems = []) {
  const items = baseItems.map(it => ({ ...it }));
  const used = new Set(items.map(it => normalizePlannerName(it.name)));
  const pool = foods.filter(food => !used.has(normalizePlannerName(food.name)));
  for (let i = 0; i < pool.length && items.length < 5; i++) {
    const food = pool[i];
    const grams = plannerSuggestPortion(food, target, items);
    if (grams < 20) continue;
    const candidate = plannerCloneItem(food, grams);
    const before = plannerGapScore(target, mealMacros({ items }));
    const afterItems = [...items, candidate];
    const after = plannerGapScore(target, mealMacros({ items: afterItems }));
    if (after < before || items.length === 0) {
      items.push(candidate);
      used.add(normalizePlannerName(food.name));
    }
    if (plannerGapScore(target, mealMacros({ items })) < 85) break;
  }
  const macros = mealMacros({ items });
  return {
    title,
    summary,
    items,
    macros,
    delta: plannerDelta(target, macros),
    score: Math.max(1, Math.round(100 - plannerGapScore(target, macros) / 18)),
  };
}

function buildMealPlannerSuggestions(type, mealIdx, prompt, opts = {}) {
  const target = getMealPlannerTarget(type, mealIdx);
  const meal = S.meals?.[type]?.[mealIdx];
  if (!target || !meal) return [];
  const mealType = getMealTypeFromName(meal.name || '');
  const queryText = String(prompt || '').trim();
  const queryCtx = buildFoodQueryContext(queryText || meal.name || '');
  const promptFoods = plannerFindFoodsByPrompt(queryText);
  const favoriteFoods = (opts.useFavorites ? (S.favoriteFoods || []) : []).map(f => ({ ...f, src: 'favorite' }));
  const pool = dedupeFoodResults([
    ...promptFoods,
    ...favoriteFoods,
    ...getRecentFoods(queryCtx),
  ], queryCtx, 12);

  const templateResults = (opts.useTemplates ? (S.templates || []) : [])
    .filter(t => {
      if (!mealType) return true;
      return String(t.mealType || t.tag || '').toLowerCase().includes(mealType);
    })
    .slice(0, 3)
    .map(t => plannerBuildFromFoods(
      target,
      pool,
      t.name,
      'Base template rifinita sul target del pasto',
      (t.items || []).map(it => ({ ...it }))
    ));

  const promptResult = pool.length
    ? [plannerBuildFromFoods(target, pool, 'Combinazione smart', 'Costruita da input utente, preferiti e alimenti recenti')]
    : [];

  return [...templateResults, ...promptResult]
    .filter(result => result.items.length)
    .sort((a, b) => plannerGapScore(target, a.macros) - plannerGapScore(target, b.macros))
    .slice(0, 3);
}

// Risolve il pasto effettivo (con alternativa selezionata se presente)
// key è sempre String(i) – condivisa tra ON e OFF
function effMeal(type, i) {
  const base = S.meals[type][i];
  const key  = String(i);
  const ai   = S.altSel[key];
  if (ai !== undefined && S.alts[key]?.[ai]) {
    const a = S.alts[key][ai];
    const altMacros = mealMacros(a);
    return { ...base, items: a.items || null, ingr: a.ingr || mealIngrText(a), ...altMacros };
  }
  const macros = mealMacros(base);
  return { ...base, ingr: mealIngrText(base), ...macros };
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistiche aderenza
// ─────────────────────────────────────────────────────────────────────────────

function calcStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = localDate(d);
    const info = S.doneByDate[key];
    if (info && (info.activityCount || 0) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      // oggi non ancora loggato → non interrompe la streak
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function calcAdherence(daysBack = 28) {
  let count = 0, total = 0;
  const d = new Date();
  for (let i = 0; i < daysBack; i++) {
    const key = localDate(d);
    if (new Date(key + 'T12:00:00') <= new Date()) {
      total++;
      const info = S.doneByDate[key];
      if (info && info.total > 0 && info.done >= Math.ceil(info.total * 0.75)) count++;
    }
    d.setDate(d.getDate() - 1);
  }
  return total ? Math.round(count / total * 100) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database alimenti locale
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_DB = [
  // Latticini / uova
  {name:"Yogurt greco 0%",brand:"Fage",kcal100:57,p100:10,c100:3.5,f100:0.2,verified:true,verifiedAliases:["fage 0","yogurt greco fage"]},
  {name:"Yogurt greco 2%",brand:"Fage Total",kcal100:73,p100:9.7,c100:4,f100:2},
  {name:"Yogurt greco intero",brand:"Generico",kcal100:97,p100:9,c100:3.2,f100:5},
  {name:"Yogurt bianco intero",brand:"Muller",kcal100:61,p100:3.5,c100:4.7,f100:3.2},
  {name:"Yogurt bianco 0%",brand:"Danone",kcal100:36,p100:4.3,c100:4.8,f100:0.1},
  {name:"Skyr naturale",brand:"Arla",kcal100:63,p100:11,c100:4,f100:0.2,verified:true,verifiedAliases:["skyr arla"]},
  {name:"Quark magro",brand:"Exquisa",kcal100:67,p100:12,c100:4,f100:0.3},
  {name:"Fiocchi di latte magri",brand:"Generico",kcal100:86,p100:12,c100:4,f100:2.5},
  {name:"Ricotta vaccina",brand:"Generico",kcal100:146,p100:11,c100:3,f100:10},
  {name:"Ricotta di pecora",brand:"Generico",kcal100:157,p100:9,c100:4,f100:12},
  {name:"Parmigiano reggiano",brand:"Generico",kcal100:392,p100:33,c100:0,f100:28},
  {name:"Grana padano",brand:"Generico",kcal100:384,p100:32,c100:0,f100:27},
  {name:"Mozzarella vaccina",brand:"Generico",kcal100:254,p100:18,c100:2.2,f100:19},
  {name:"Mozzarella light",brand:"Generico",kcal100:149,p100:18,c100:2,f100:8},
  {name:"Feta",brand:"Generico",kcal100:264,p100:14,c100:4,f100:21},
  {name:"Pecorino",brand:"Generico",kcal100:419,p100:26,c100:0.5,f100:35},
  {name:"Provolone",brand:"Generico",kcal100:352,p100:25,c100:2,f100:27},
  {name:"Scamorza",brand:"Generico",kcal100:334,p100:25,c100:1,f100:25},
  {name:"Latte intero",brand:"Granarolo",kcal100:61,p100:3.2,c100:4.8,f100:3.3},
  {name:"Latte parzialmente scremato",brand:"Granarolo",kcal100:46,p100:3.3,c100:4.8,f100:1.6},
  {name:"Latte scremato",brand:"Generico",kcal100:35,p100:3.6,c100:5,f100:0.1},
  {name:"Latte di soia",brand:"Alpro",kcal100:33,p100:3.3,c100:0.9,f100:1.8},
  {name:"Latte di avena",brand:"Oatly",kcal100:47,p100:1,c100:6.5,f100:1.5},
  {name:"Uovo intero",brand:"Generico",kcal100:143,p100:13,c100:0.7,f100:10},
  {name:"Albume",brand:"Generico",kcal100:52,p100:11,c100:0.7,f100:0.2},
  {name:"Tuorlo",brand:"Generico",kcal100:322,p100:16,c100:0.3,f100:27},
  // Carni
  {name:"Petto di pollo crudo",brand:"Generico",kcal100:110,p100:23,c100:0,f100:1.5},
  {name:"Petto di pollo cotto",brand:"Amadori",kcal100:165,p100:31,c100:0,f100:3.6},
  {name:"Fesa di tacchino cruda",brand:"Generico",kcal100:107,p100:24,c100:0,f100:0.8},
  {name:"Fesa di tacchino affettata",brand:"Negroni",kcal100:107,p100:22,c100:1,f100:1.5},
  {name:"Lonza di maiale",brand:"Generico",kcal100:143,p100:22,c100:0,f100:6},
  {name:"Prosciutto crudo San Daniele",brand:"San Daniele",kcal100:269,p100:27,c100:0,f100:18},
  {name:"Prosciutto cotto alta qualita",brand:"Rovagnati",kcal100:128,p100:18,c100:1,f100:5.5},
  {name:"Bresaola",brand:"Valtellina",kcal100:151,p100:32,c100:0,f100:2},
  {name:"Manzo magro fettine",brand:"Generico",kcal100:136,p100:21,c100:0,f100:5.5},
  {name:"Macinato di manzo 5%",brand:"Generico",kcal100:137,p100:21,c100:0,f100:5.5},
  {name:"Macinato di manzo 20%",brand:"Generico",kcal100:254,p100:17,c100:0,f100:20},
  {name:"Bistecca di manzo",brand:"Generico",kcal100:158,p100:26,c100:0,f100:5.8},
  {name:"Straccetti di pollo",brand:"Generico",kcal100:120,p100:22,c100:1,f100:3},
  // Pesce
  {name:"Tonno al naturale",brand:"Rio Mare",kcal100:103,p100:23,c100:0,f100:1,verified:true,verifiedAliases:["rio mare tonno naturale"]},
  {name:"Tonno in olio sgocciolato",brand:"Rio Mare",kcal100:198,p100:25,c100:0,f100:11},
  {name:"Salmone atlantico fresco",brand:"Generico",kcal100:208,p100:20,c100:0,f100:13},
  {name:"Merluzzo",brand:"Generico",kcal100:82,p100:18,c100:0,f100:0.7},
  {name:"Orata",brand:"Generico",kcal100:121,p100:20,c100:0,f100:4.5},
  {name:"Spigola branzino",brand:"Generico",kcal100:97,p100:17,c100:0,f100:3},
  {name:"Gamberetti sgusciati",brand:"Generico",kcal100:71,p100:14,c100:1.5,f100:1},
  {name:"Sgombro al naturale",brand:"Nostromo",kcal100:189,p100:19,c100:0,f100:12},
  // Cereali / carboidrati
  {name:"Riso bianco secco",brand:"Scotti",kcal100:355,p100:7,c100:79,f100:0.6},
  {name:"Riso basmati secco",brand:"Scotti",kcal100:355,p100:7.3,c100:78,f100:0.5,verified:true,verifiedAliases:["riso scotti basmati","scotti basmati"]},
  {name:"Riso integrale secco",brand:"Riso Scotti",kcal100:337,p100:7.5,c100:72,f100:2.2},
  {name:"Riso parboiled secco",brand:"Riso Gallo",kcal100:356,p100:8,c100:78,f100:0.6},
  {name:"Pasta secca penne rigatoni",brand:"Barilla",kcal100:357,p100:13,c100:71,f100:1.5,verified:true,verifiedAliases:["penne barilla","pasta barilla penne"]},
  {name:"Pasta integrale secca",brand:"Barilla",kcal100:337,p100:13,c100:66,f100:2.5},
  {name:"Pasta proteica secca",brand:"Barilla ProteinPLUS",kcal100:340,p100:18,c100:59,f100:3},
  {name:"Spaghetti secchi",brand:"De Cecco",kcal100:357,p100:12,c100:72,f100:1.3},
  {name:"Farro perlato secco",brand:"Generico",kcal100:335,p100:14,c100:67,f100:2.5},
  {name:"Orzo perlato secco",brand:"Generico",kcal100:352,p100:10,c100:74,f100:1},
  {name:"Avena fiocchi",brand:"Quaker",kcal100:379,p100:13,c100:66,f100:7},
  {name:"Farina di avena",brand:"Generico",kcal100:389,p100:17,c100:66,f100:7},
  {name:"Pane comune bianco",brand:"Generico",kcal100:275,p100:9,c100:54,f100:2},
  {name:"Pane integrale",brand:"Generico",kcal100:235,p100:8,c100:44,f100:3},
  {name:"Pane azzimo",brand:"Generico",kcal100:389,p100:11,c100:80,f100:1.4},
  {name:"Gallette di riso",brand:"Generico",kcal100:387,p100:7,c100:82,f100:2.5},
  {name:"Crackers integrali",brand:"Ryvita",kcal100:351,p100:10,c100:65,f100:3},
  {name:"Patata bollita",brand:"Generico",kcal100:77,p100:2,c100:17,f100:0.1},
  {name:"Patata dolce cruda",brand:"Generico",kcal100:86,p100:1.6,c100:20,f100:0.1},
  {name:"Quinoa cotta",brand:"Generico",kcal100:120,p100:4.4,c100:22,f100:1.9},
  {name:"Farina 00",brand:"Mulino Chiavazza",kcal100:361,p100:11,c100:74,f100:1.5},
  {name:"Farina integrale",brand:"Generico",kcal100:339,p100:13,c100:68,f100:3},
  // Grassi / condimenti
  {name:"Olio EVO",brand:"Generico",kcal100:884,p100:0,c100:0,f100:100},
  {name:"Olio di semi girasole",brand:"Generico",kcal100:884,p100:0,c100:0,f100:100},
  {name:"Burro",brand:"Generico",kcal100:717,p100:0.9,c100:0.6,f100:81},
  {name:"Burro di arachidi",brand:"Whole Earth",kcal100:588,p100:25,c100:20,f100:50},
  {name:"Burro di mandorle",brand:"Generico",kcal100:614,p100:21,c100:19,f100:56},
  {name:"Tahini crema sesamo",brand:"Generico",kcal100:595,p100:17,c100:23,f100:53},
  {name:"Mandorle",brand:"Generico",kcal100:579,p100:21,c100:22,f100:50},
  {name:"Noci",brand:"Generico",kcal100:654,p100:15,c100:14,f100:65},
  {name:"Anacardi",brand:"Generico",kcal100:553,p100:18,c100:30,f100:44},
  {name:"Pistacchi",brand:"Generico",kcal100:560,p100:20,c100:28,f100:45},
  {name:"Arachidi tostate",brand:"Generico",kcal100:567,p100:26,c100:16,f100:49},
  {name:"Avocado",brand:"Generico",kcal100:160,p100:2,c100:9,f100:15},
  {name:"Maionese light",brand:"Calve",kcal100:286,p100:1,c100:5,f100:29},
  // Frutta
  {name:"Banana",brand:"Generico",kcal100:89,p100:1.1,c100:23,f100:0.3},
  {name:"Mela",brand:"Generico",kcal100:52,p100:0.3,c100:14,f100:0.2},
  {name:"Arancia",brand:"Generico",kcal100:47,p100:0.9,c100:12,f100:0.1},
  {name:"Pera",brand:"Generico",kcal100:57,p100:0.4,c100:15,f100:0.1},
  {name:"Fragole",brand:"Generico",kcal100:32,p100:0.7,c100:7.7,f100:0.3},
  {name:"Mirtilli",brand:"Generico",kcal100:57,p100:0.7,c100:14,f100:0.3},
  {name:"Ananas fresco",brand:"Generico",kcal100:50,p100:0.5,c100:13,f100:0.1},
  {name:"Mango",brand:"Generico",kcal100:60,p100:0.8,c100:15,f100:0.4},
  {name:"Kiwi",brand:"Generico",kcal100:61,p100:1.1,c100:15,f100:0.5},
  {name:"Uva",brand:"Generico",kcal100:69,p100:0.6,c100:18,f100:0.2},
  {name:"Anguria",brand:"Generico",kcal100:30,p100:0.6,c100:7.6,f100:0.2},
  {name:"Pesche",brand:"Generico",kcal100:39,p100:0.9,c100:10,f100:0.3},
  {name:"Datteri secchi",brand:"Generico",kcal100:282,p100:2.5,c100:75,f100:0.4},
  // Verdure
  {name:"Spinaci freschi",brand:"Generico",kcal100:23,p100:2.9,c100:3.6,f100:0.4},
  {name:"Broccoli",brand:"Generico",kcal100:34,p100:2.8,c100:7,f100:0.4},
  {name:"Zucchine",brand:"Generico",kcal100:17,p100:1.2,c100:3.4,f100:0.2},
  {name:"Peperoni misti",brand:"Generico",kcal100:31,p100:1,c100:6,f100:0.3},
  {name:"Pomodori",brand:"Generico",kcal100:18,p100:0.9,c100:3.9,f100:0.2},
  {name:"Insalata mista",brand:"Generico",kcal100:15,p100:1.2,c100:2.2,f100:0.2},
  {name:"Carote",brand:"Generico",kcal100:41,p100:0.9,c100:10,f100:0.2},
  {name:"Cetrioli",brand:"Generico",kcal100:15,p100:0.7,c100:3.6,f100:0.1},
  {name:"Asparagi",brand:"Generico",kcal100:20,p100:2.2,c100:3.7,f100:0.1},
  {name:"Cavolo cappuccio",brand:"Generico",kcal100:25,p100:1.3,c100:6,f100:0.1},
  {name:"Cavolfiore",brand:"Generico",kcal100:25,p100:1.9,c100:5,f100:0.3},
  {name:"Fagiolini",brand:"Generico",kcal100:31,p100:1.8,c100:7,f100:0.4},
  {name:"Funghi champignon",brand:"Generico",kcal100:22,p100:3.1,c100:3.3,f100:0.3},
  {name:"Cipolla",brand:"Generico",kcal100:40,p100:1.1,c100:9,f100:0.1},
  {name:"Aglio",brand:"Generico",kcal100:149,p100:6.4,c100:33,f100:0.5},
  // Legumi
  {name:"Lenticchie secche",brand:"Generico",kcal100:353,p100:26,c100:60,f100:1.1},
  {name:"Lenticchie cotte",brand:"Generico",kcal100:116,p100:9,c100:20,f100:0.4},
  {name:"Ceci secchi",brand:"Generico",kcal100:364,p100:19,c100:61,f100:6},
  {name:"Ceci cotti",brand:"Generico",kcal100:164,p100:8.9,c100:27,f100:2.6},
  {name:"Fagioli borlotti cotti",brand:"Generico",kcal100:129,p100:8.7,c100:23,f100:0.5},
  {name:"Fagioli neri cotti",brand:"Generico",kcal100:132,p100:8.9,c100:24,f100:0.5},
  {name:"Edamame soia verde",brand:"Generico",kcal100:122,p100:11,c100:10,f100:5},
  {name:"Tofu compatto",brand:"Generico",kcal100:76,p100:8,c100:1.9,f100:4.8},
  // Condimenti
  {name:"Miele millefiori",brand:"Generico",kcal100:304,p100:0.3,c100:82,f100:0},
  {name:"Sciroppo di acero",brand:"Generico",kcal100:260,p100:0,c100:67,f100:0.1},
  {name:"Zucchero bianco",brand:"Generico",kcal100:387,p100:0,c100:100,f100:0},
  {name:"Salsa di pomodoro",brand:"Mutti",kcal100:34,p100:1.6,c100:6,f100:0.4,verified:true,verifiedAliases:["salsa mutti","pomodoro mutti"]},
  {name:"Passata di pomodoro",brand:"Mutti",kcal100:32,p100:1.4,c100:5.6,f100:0.2},
  {name:"Ketchup",brand:"Heinz",kcal100:112,p100:1.4,c100:28,f100:0.1,verified:true,verifiedAliases:["ketchup heinz"]},
  {name:"Senape",brand:"Calve",kcal100:66,p100:4.4,c100:6,f100:3.3},
  {name:"Salsa soia",brand:"Kikkoman",kcal100:60,p100:6,c100:5.6,f100:0,verified:true,verifiedAliases:["soia kikkoman","salsa di soia kikkoman"]},
  {name:"Sale",brand:"Generico",kcal100:0,p100:0,c100:0,f100:0},
  // Proteine / integratori
  {name:"Whey protein 80%",brand:"MyProtein",kcal100:373,p100:80,c100:6,f100:5},
  {name:"Whey isolate 90%",brand:"Optimum",kcal100:363,p100:90,c100:3,f100:1},
  {name:"Caseina proteica",brand:"MyProtein",kcal100:349,p100:79,c100:9,f100:2},
  {name:"Creatina monoidrato",brand:"Creapure",kcal100:0,p100:0,c100:0,f100:0},
  {name:"BCAA in polvere",brand:"MyProtein",kcal100:150,p100:30,c100:5,f100:1},
  {name:"Collagene idrolizzato",brand:"Generico",kcal100:348,p100:87,c100:0,f100:0},
  // Bevande
  {name:"Caffe espresso",brand:"Generico",kcal100:2,p100:0.1,c100:0,f100:0},
  {name:"Caffe americano",brand:"Generico",kcal100:5,p100:0.3,c100:0,f100:0},
  {name:"Te verde infuso",brand:"Generico",kcal100:1,p100:0,c100:0.3,f100:0},
  {name:"Succo arancia fresco",brand:"Generico",kcal100:45,p100:0.7,c100:10,f100:0.2},
  {name:"Acqua naturale",brand:"Generico",kcal100:0,p100:0,c100:0,f100:0},
  {name:"Coca-Cola Zero Zuccheri",brand:"Coca-Cola",kcal100:0.3,p100:0,c100:0,f100:0,verified:true,verifiedAliases:["coca zero","coca cola zero","coke zero","coca zero zuccheri"]},
  // Prodotti da forno / colazione
  {name:"Corn flakes",brand:"Kelloggs",kcal100:379,p100:7,c100:84,f100:0.9,verified:true,verifiedAliases:["kelloggs corn flakes","corn flakes kelloggs"]},
  {name:"Muesli senza zucchero",brand:"Jordans",kcal100:364,p100:10,c100:67,f100:7},
  {name:"Fette biscottate",brand:"Mulino Bianco",kcal100:413,p100:12,c100:74,f100:8,verified:true,verifiedAliases:["fette mulino bianco","fette biscottate mulino bianco"]},
  {name:"Wasa fibra",brand:"Wasa",kcal100:334,p100:9.8,c100:67,f100:2,verified:true,verifiedAliases:["wasa fibre","wasa fibra"]},
  {name:"Barretta proteica Quest",brand:"Quest",kcal100:355,p100:42,c100:29,f100:7},
  {name:"Barretta proteica",brand:"MyProtein",kcal100:370,p100:37,c100:30,f100:10},
  {name:"Uova strapazzate cotte",brand:"Generico",kcal100:149,p100:10,c100:1.6,f100:11},
  {name:"Hamburger manzo cotto",brand:"Generico",kcal100:254,p100:17,c100:0,f100:20},
];

// ─────────────────────────────────────────────────────────────────────────────
// Ricerca alimenti (locale + API esterne)
// ─────────────────────────────────────────────────────────────────────────────

let _foodSearchTimer = null;
let _foodSearchSelected = null;

const FOOD_SEARCH_STOPWORDS = new Set([
  'a', 'al', 'alla', 'alle', 'allo', 'ai', 'agli',
  'con', 'da', 'dal', 'dalla', 'dalle', 'dei', 'del', 'della', 'di',
  'e', 'ed', 'il', 'in', 'la', 'le', 'lo', 'per', 'su', 'un', 'una', 'uno',
]);

const WHOLE_FOOD_TERMS = new Set([
  'banana', 'banane', 'mela', 'mele', 'pera', 'pere', 'arancia', 'arance',
  'fragola', 'fragole', 'mirtilli', 'ananas', 'mango', 'kiwi', 'uva',
  'anguria', 'pesca', 'pesche', 'avocado', 'pomodoro', 'pomodori',
  'zucchina', 'zucchine', 'broccoli', 'spinaci', 'carota', 'carote',
  'patata', 'patate', 'pollo', 'tacchino', 'manzo', 'salmone', 'tonno',
  'merluzzo', 'orata', 'uovo', 'uova', 'riso', 'avena', 'quinoa',
  'lenticchie', 'ceci', 'fagioli', 'yogurt', 'skyr', 'ricotta',
]);

const COMPOUND_FOOD_TERMS = new Set([
  'chips', 'chip', 'crisps', 'snack', 'barretta', 'barrette', 'biscotto', 'biscotti',
  'merendina', 'merendine', 'dessert', 'gelato', 'torta', 'tortina', 'cake', 'bread',
  'bevanda', 'drink', 'succo', 'smoothie', 'frullato', 'crema', 'salsa', 'mousse',
  'cereali', 'flakes', 'cracker', 'gallette', 'yogurtino', 'budino', 'wafer', 'caramelle',
]);

const FOOD_ATTRIBUTE_TOKENS = new Set([
  'basmati', 'integrale', 'integrali', 'proteico', 'proteica', 'proteici', 'proteiche',
  'zero', '0', 'percent', 'senza', 'lattosio', 'light', 'magro', 'magra', 'magri', 'magre',
  'bianco', 'bianca', 'naturale', 'nature', 'greco', 'greca',
]);

const FOOD_TOKEN_ALIASES = {
  greek: 'greco',
  greca: 'greco',
  greche: 'greco',
  greci: 'greco',
  kelloggs: 'kellogg',
  kellogg: 'kellogg',
  oats: 'avena',
  oat: 'avena',
  chicken: 'pollo',
  turkey: 'tacchino',
  tuna: 'tonno',
  salmon: 'salmone',
  rice: 'riso',
  proteins: 'proteico',
  protein: 'proteico',
  proteine: 'proteico',
  proteica: 'proteico',
  proteici: 'proteico',
  proteiche: 'proteico',
  integrali: 'integrale',
  banane: 'banana',
  mele: 'mela',
  pere: 'pera',
  arance: 'arancia',
  pesche: 'pesca',
  zucchine: 'zucchina',
  carote: 'carota',
  patate: 'patata',
  uova: 'uovo',
  yogurti: 'yogurt',
};

const FOOD_BRAND_HINTS = (() => {
  const tokens = new Set(['prix', 'lidl', 'coop', 'conad', 'esselunga', 'carrefour', 'eurospin', 'despar', 'pam', 'md']);
  FOOD_DB.forEach(item => {
    removeWeakTokens(tokenizeFoodText(item.brand || '')).forEach(token => {
      const canonical = canonicalizeFoodToken(token);
      if (canonical.length < 3) return;
      if (WHOLE_FOOD_TERMS.has(canonical)) return;
      if (COMPOUND_FOOD_TERMS.has(canonical)) return;
      if (FOOD_ATTRIBUTE_TOKENS.has(canonical)) return;
      tokens.add(canonical);
    });
  });
  return tokens;
})();

const FOOD_STORE_PRIVATE_LABELS = {
  lidl: [
    { phrase: 'lidl' },
    { phrase: 'milbona', hints: ['yogurt', 'skyr', 'latte', 'mozzarella', 'ricotta', 'formaggio'] },
    { phrase: 'crownfield', hints: ['avena', 'cereali', 'muesli', 'granola', 'flakes'] },
    { phrase: 'italiamo', hints: ['pasta', 'pizza', 'passata', 'sugo', 'pomodoro'] },
    { phrase: 'combino', hints: ['riso', 'tonno', 'mais', 'legumi', 'salsa'] },
    { phrase: 'nixe', hints: ['tonno', 'salmone', 'sgombro', 'pesce'] },
  ],
  carrefour: [
    { phrase: 'carrefour' },
    { phrase: 'carrefour bio', hints: ['yogurt', 'skyr', 'avena', 'riso', 'pasta', 'latte'] },
    { phrase: 'terre d italia', hints: ['pasta', 'passata', 'sugo', 'pomodoro', 'mozzarella'] },
    { phrase: 'simpl' },
    { phrase: 'selection carrefour' },
  ],
  esselunga: [
    { phrase: 'esselunga' },
    { phrase: 'equilibrio', hints: ['skyr', 'yogurt', 'latte', 'proteico', 'protein'] },
    { phrase: 'smart' },
  ],
  coop: [
    { phrase: 'coop' },
    { phrase: 'fior fiore', hints: ['pasta', 'passata', 'sugo', 'pomodoro', 'mozzarella'] },
    { phrase: 'vivi verde', hints: ['yogurt', 'latte', 'avena', 'riso', 'pasta', 'bio'] },
    { phrase: 'bene si', hints: ['proteico', 'skyr', 'yogurt', 'latte', 'light'] },
  ],
  conad: [
    { phrase: 'conad' },
    { phrase: 'piacersi', hints: ['skyr', 'yogurt', 'proteico', 'latte', 'light'] },
    { phrase: 'verso natura', hints: ['bio', 'integrale', 'avena', 'riso', 'pasta'] },
    { phrase: 'sapori dintorni', hints: ['pasta', 'sugo', 'pomodoro', 'mozzarella', 'olio'] },
    { phrase: 'alimentum', hints: ['senza', 'lattosio', 'gluten free'] },
  ],
  eurospin: [
    { phrase: 'eurospin' },
    { phrase: 'land', hints: ['latte', 'yogurt', 'skyr', 'mozzarella', 'formaggio'] },
    { phrase: 'tre mulini', hints: ['pasta', 'biscotti', 'cracker', 'cereali'] },
    { phrase: 'amo essere', hints: ['proteico', 'skyr', 'yogurt', 'latte', 'senza', 'glutine'] },
    { phrase: 'ondina', hints: ['tonno', 'salmone', 'pesce'] },
    { phrase: 'delizie dal sole', hints: ['passata', 'sugo', 'pomodoro', 'pizza', 'pasta'] },
    { phrase: 'dolciando', hints: ['biscotti', 'wafer', 'dessert'] },
  ],
  prix: [
    { phrase: 'prix' },
    { phrase: 'prix quality' },
    { phrase: 'vivo meglio', hints: ['proteico', 'yogurt', 'skyr', 'latte', 'light'] },
    { phrase: 'natura chiama', hints: ['bio', 'integrale', 'avena', 'riso', 'pasta'] },
  ],
  despar: [
    { phrase: 'despar' },
    { phrase: 'scelta verde', hints: ['bio', 'avena', 'riso', 'pasta', 'latte'] },
  ],
  pam: [
    { phrase: 'pam' },
    { phrase: 'pam panorama' },
  ],
  md: [
    { phrase: 'md' },
    { phrase: 'let s go', hints: ['snack', 'proteico', 'drink'] },
    { phrase: 'bon my', hints: ['latte', 'yogurt', 'mozzarella'] },
  ],
};

function normalizeFoodText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[%]/g, ' percent ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeFoodText(str) {
  return normalizeFoodText(str).split(' ').filter(Boolean);
}

function removeWeakTokens(tokens) {
  return tokens.filter(t => t.length >= 2 && !FOOD_SEARCH_STOPWORDS.has(t));
}

function canonicalizeFoodToken(token) {
  return FOOD_TOKEN_ALIASES[token] || token;
}

function canonicalizeFoodTokens(tokens) {
  return tokens.map(canonicalizeFoodToken);
}

function uniqueFoodTerms(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildStoreAliasData(storeTokens, queryTokens = []) {
  const canonicalQueryTokens = uniqueFoodTerms((queryTokens || []).map(canonicalizeFoodToken));
  const phraseEntries = [];

  storeTokens.forEach(storeToken => {
    const entries = FOOD_STORE_PRIVATE_LABELS[storeToken] || [];
    entries.forEach(entry => {
      const normalizedPhrase = normalizeFoodText(entry?.phrase || '');
      if (!normalizedPhrase) return;
      const phraseTokens = uniqueFoodTerms(
        removeWeakTokens(tokenizeFoodText(normalizedPhrase))
          .map(canonicalizeFoodToken)
          .filter(token => token.length >= 3)
      );
      const hintTokens = uniqueFoodTerms(
        removeWeakTokens((entry?.hints || []).flatMap(tokenizeFoodText))
          .map(canonicalizeFoodToken)
      );
      phraseEntries.push({
        storeToken,
        normalizedPhrase,
        phraseTokens,
        hintHits: hintTokens.filter(token => canonicalQueryTokens.includes(token)).length,
        isExactStorePhrase: phraseTokens.length === 1 && phraseTokens[0] === storeToken,
      });
    });
  });

  const dedupedEntries = [];
  const seen = new Set();
  phraseEntries.forEach(entry => {
    if (seen.has(entry.normalizedPhrase)) return;
    seen.add(entry.normalizedPhrase);
    dedupedEntries.push(entry);
  });

  const sortedEntries = dedupedEntries.sort((a, b) =>
    (b.hintHits - a.hintHits) ||
    (Number(a.isExactStorePhrase) - Number(b.isExactStorePhrase)) ||
    (a.phraseTokens.length - b.phraseTokens.length) ||
    a.normalizedPhrase.localeCompare(b.normalizedPhrase)
  );

  const searchEntries = [...sortedEntries]
    .filter(entry => !entry.isExactStorePhrase)
    .sort((a, b) =>
      (b.hintHits - a.hintHits) ||
      (a.phraseTokens.length - b.phraseTokens.length) ||
      a.normalizedPhrase.localeCompare(b.normalizedPhrase)
    );

  return {
    entries: sortedEntries,
    phrases: uniqueFoodTerms(sortedEntries.map(entry => entry.normalizedPhrase)),
    searchPhrases: uniqueFoodTerms(searchEntries.map(entry => entry.normalizedPhrase)),
  };
}

function buildFoodQueryVariants(queryCtx) {
  const variants = [];
  const pushVariant = (terms) => {
    const normalizedTerms = normalizeFoodText(Array.isArray(terms) ? terms.join(' ') : terms);
    if (!normalizedTerms || normalizedTerms.length < 2) return;
    if (!variants.includes(normalizedTerms)) variants.push(normalizedTerms);
  };

  pushVariant(queryCtx.raw);
  pushVariant(queryCtx.canonicalJoined);

  const storeCoreTokens = queryCtx.effectiveCanonicalTokens.filter(t => !queryCtx.storeHintTokens.includes(t));
  if (queryCtx.storeAliasSearchPhrases.length > 0) {
    const storeVariantBase = storeCoreTokens.length ? storeCoreTokens : queryCtx.coreTokens;
    queryCtx.storeAliasSearchPhrases.slice(0, 3).forEach(phrase => {
      const phraseTokens = removeWeakTokens(tokenizeFoodText(phrase));
      pushVariant(storeVariantBase.length ? [...storeVariantBase, ...phraseTokens] : phraseTokens);
    });
  }

  const noAttr = queryCtx.effectiveCanonicalTokens.filter(t => !FOOD_ATTRIBUTE_TOKENS.has(t));
  const noBrand = queryCtx.effectiveCanonicalTokens.filter(t => !FOOD_BRAND_HINTS.has(t));

  const core = queryCtx.effectiveCanonicalTokens.filter(t =>
    !FOOD_BRAND_HINTS.has(t) && !FOOD_ATTRIBUTE_TOKENS.has(t)
  );

  if (queryCtx.brandHintTokens.length > 0) {
    if (noAttr.length && noAttr.length !== queryCtx.effectiveCanonicalTokens.length) pushVariant(noAttr);
    if (noBrand.length && noBrand.length !== queryCtx.effectiveCanonicalTokens.length) pushVariant(noBrand);
    if (core.length) pushVariant(core);
  } else {
    if (noBrand.length && noBrand.length !== queryCtx.effectiveCanonicalTokens.length) pushVariant(noBrand);
    if (noAttr.length && noAttr.length !== queryCtx.effectiveCanonicalTokens.length) pushVariant(noAttr);
    if (core.length) pushVariant(core);
  }

  if (core.length > 1) pushVariant(core.slice(0, 2));

  return variants.slice(0, 6);
}

function buildFoodQueryContext(q) {
  const normalized = normalizeFoodText(q);
  const rawTokens = tokenizeFoodText(q);
  const tokens = removeWeakTokens(rawTokens);
  const strongTokens = tokens.filter(t => t.length >= 3);
  const effectiveTokens = strongTokens.length ? strongTokens : tokens;
  const canonicalTokens = canonicalizeFoodTokens(tokens);
  const canonicalStrongTokens = canonicalTokens.filter(t => t.length >= 3);
  const effectiveCanonicalTokens = canonicalStrongTokens.length ? canonicalStrongTokens : canonicalTokens;
  const wholeFoodTokens = effectiveTokens.filter(t => WHOLE_FOOD_TERMS.has(t));
  const brandHintTokens = effectiveCanonicalTokens.filter(t => FOOD_BRAND_HINTS.has(t));
  const storeHintTokens = uniqueFoodTerms(brandHintTokens.filter(t => FOOD_STORE_PRIVATE_LABELS[t]));
  const storeAliasData = buildStoreAliasData(storeHintTokens, effectiveCanonicalTokens);
  const attributeTokens = effectiveCanonicalTokens.filter(t => FOOD_ATTRIBUTE_TOKENS.has(t));
  const nonBrandTokens = effectiveCanonicalTokens.filter(t => !FOOD_BRAND_HINTS.has(t));
  const coreTokens = nonBrandTokens.filter(t => !FOOD_ATTRIBUTE_TOKENS.has(t));
  const requiredNameTokens = coreTokens.length
    ? coreTokens
    : (nonBrandTokens.length ? nonBrandTokens : effectiveCanonicalTokens);
  const queryCtx = {
    raw: String(q || '').trim(),
    normalized,
    key: normalized,
    rawTokens,
    tokens,
    strongTokens,
    effectiveTokens,
    canonicalTokens,
    effectiveCanonicalTokens,
    wholeFoodTokens,
    isWholeFoodQuery: effectiveTokens.length > 0 && wholeFoodTokens.length === effectiveTokens.length,
    isBrandFocusedQuery: effectiveCanonicalTokens.length > 0 && brandHintTokens.length === effectiveCanonicalTokens.length,
    joined: effectiveTokens.join(' '),
    canonicalJoined: effectiveCanonicalTokens.join(' '),
    brandHintTokens,
    storeHintTokens,
    storeAliasPhrases: storeAliasData.phrases,
    storeAliasSearchPhrases: storeAliasData.searchPhrases,
    attributeTokens,
    nonBrandTokens,
    coreTokens,
    requiredNameTokens: uniqueFoodTerms(requiredNameTokens),
    expandedTokens: uniqueFoodTerms([...effectiveTokens, ...effectiveCanonicalTokens]),
  };
  queryCtx.variants = buildFoodQueryVariants(queryCtx);
  return queryCtx;
}

function buildFoodResultContext(item) {
  const nameNorm = normalizeFoodText(item.name || '');
  const brandNorm = normalizeFoodText(item.brand || '');
  const combinedNorm = `${nameNorm} ${brandNorm}`.trim();
  const aliasNorm = normalizeFoodText((item.verifiedAliases || []).join(' '));
  const nameTokens = removeWeakTokens(tokenizeFoodText(item.name || ''));
  const brandTokens = removeWeakTokens(tokenizeFoodText(item.brand || ''));
  const aliasTokens = removeWeakTokens((item.verifiedAliases || []).flatMap(tokenizeFoodText));
  const canonicalNameTokens = canonicalizeFoodTokens(nameTokens);
  const canonicalBrandTokens = canonicalizeFoodTokens(brandTokens);
  const canonicalAliasTokens = canonicalizeFoodTokens(aliasTokens);
  const combinedTokens = Array.from(new Set([...nameTokens, ...brandTokens, ...aliasTokens]));
  const canonicalCombinedTokens = Array.from(new Set([...canonicalNameTokens, ...canonicalBrandTokens, ...canonicalAliasTokens]));
  return {
    nameNorm,
    brandNorm,
    combinedNorm,
    aliasNorm,
    nameTokens,
    brandTokens,
    aliasTokens,
    combinedTokens,
    canonicalNameTokens,
    canonicalBrandTokens,
    canonicalAliasTokens,
    canonicalCombinedTokens,
    canonicalNameNorm: canonicalNameTokens.join(' '),
    canonicalBrandNorm: canonicalBrandTokens.join(' '),
    canonicalAliasNorm: canonicalAliasTokens.join(' '),
    canonicalCombinedNorm: canonicalCombinedTokens.join(' '),
  };
}

function resultMatchesNormalizedPhrase(resultCtx, normalizedPhrase, item) {
  if (!normalizedPhrase) return false;
  if (
    resultCtx.nameNorm.includes(normalizedPhrase) ||
    resultCtx.brandNorm.includes(normalizedPhrase) ||
    resultCtx.combinedNorm.includes(normalizedPhrase)
  ) return true;
  return !!(item?.verified && resultCtx.aliasNorm.includes(normalizedPhrase));
}

function getStoreAliasMatchDetails(resultCtx, item, queryCtx) {
  const storeAliasPhrases = queryCtx?.storeAliasPhrases || [];
  const matchedPhrases = [];

  [...storeAliasPhrases]
    .sort((a, b) => b.length - a.length)
    .forEach(phrase => {
      if (!resultMatchesNormalizedPhrase(resultCtx, phrase, item)) return;
      const overlapsExisting = matchedPhrases.some(existing => existing.includes(phrase) || phrase.includes(existing));
      if (!overlapsExisting) matchedPhrases.push(phrase);
    });

  return {
    matchedPhrases,
    phraseHits: matchedPhrases.length,
    tokenHits: 0,
    hitCount: matchedPhrases.length,
  };
}

function hasQueryMatch(item, queryCtx) {
  const resultCtx = buildFoodResultContext(item);
  const tokens = queryCtx.expandedTokens;
  const storeMatch = queryCtx.storeHintTokens.length > 0
    ? getStoreAliasMatchDetails(resultCtx, item, queryCtx)
    : { hitCount: 0 };
  if (!queryCtx.normalized || !tokens.length) return false;
  if (resultCtx.combinedNorm.includes(queryCtx.normalized)) return true;
  if (item.verified && resultCtx.aliasNorm.includes(queryCtx.normalized)) return true;
  if (queryCtx.canonicalJoined && (
    resultCtx.canonicalNameNorm.includes(queryCtx.canonicalJoined) ||
    resultCtx.canonicalCombinedNorm.includes(queryCtx.canonicalJoined) ||
    (item.verified && resultCtx.canonicalAliasNorm.includes(queryCtx.canonicalJoined))
  )) return true;

  const effectiveTokens = queryCtx.effectiveCanonicalTokens.length
    ? queryCtx.effectiveCanonicalTokens
    : queryCtx.effectiveTokens;
  const requiredNameTokens = queryCtx.requiredNameTokens?.length
    ? queryCtx.requiredNameTokens
    : effectiveTokens;

  let matchedNameOrAlias = 0;
  let matchedBrand = 0;
  let matchedRequiredNameOrAlias = 0;

  effectiveTokens.forEach(t => {
    const canonical = canonicalizeFoodToken(t);
    const inName = resultCtx.nameTokens.includes(t) || resultCtx.canonicalNameTokens.includes(canonical);
    const inAlias = item.verified && (
      resultCtx.aliasTokens.includes(t) || resultCtx.canonicalAliasTokens.includes(canonical)
    );
    const inBrand = resultCtx.brandTokens.includes(t) || resultCtx.canonicalBrandTokens.includes(canonical);

    if (inName || inAlias) {
      matchedNameOrAlias++;
      if (requiredNameTokens.includes(t) || requiredNameTokens.includes(canonical)) matchedRequiredNameOrAlias++;
    } else if (inBrand) {
      matchedBrand++;
    }
  });

  if (queryCtx.isBrandFocusedQuery) {
    const minBrandMatches = Math.min(queryCtx.brandHintTokens.length || 1, 2);
    if (storeMatch.hitCount > 0) return true;
    return matchedBrand >= minBrandMatches;
  }

  if (queryCtx.brandHintTokens.length > 0 && matchedNameOrAlias === 0) return false;
  if (!matchedNameOrAlias && !matchedBrand) return false;

  if (requiredNameTokens.length >= 3 && matchedRequiredNameOrAlias < 2) return false;
  if (requiredNameTokens.length >= 1 && matchedRequiredNameOrAlias < 1) return false;

  const minTotalMatches = effectiveTokens.length >= 4 ? 2 : 1;
  return (matchedNameOrAlias + matchedBrand) >= minTotalMatches;
}

function sourceRank(src) {
  if (src === 'local') return 5;
  if (src === 'recent') return 4;
  if (src === 'favorite') return 4;
  if (src === 'cache') return 3;
  if (src === 'off') return 1;
  return 0;
}

function getWholeFoodNameDetails(resultCtx, queryCtx) {
  if (!queryCtx?.isWholeFoodQuery || !queryCtx.wholeFoodTokens?.length) {
    return { matchedWholeTokens: [], otherWholeTokens: [], exactWholeName: false };
  }

  const queryWholeTokens = uniqueFoodTerms(queryCtx.wholeFoodTokens.map(canonicalizeFoodToken));
  const nameWholeTokens = uniqueFoodTerms(
    resultCtx.canonicalNameTokens.filter(token => WHOLE_FOOD_TERMS.has(token))
  );
  const matchedWholeTokens = nameWholeTokens.filter(token => queryWholeTokens.includes(token));
  const otherWholeTokens = nameWholeTokens.filter(token => !queryWholeTokens.includes(token));
  const exactWholeName =
    resultCtx.canonicalNameTokens.length === queryWholeTokens.length &&
    queryWholeTokens.every(token => resultCtx.canonicalNameTokens.includes(token));

  return { matchedWholeTokens, otherWholeTokens, exactWholeName };
}

function foodQualityPenalty(item) {
  const kcal = Number(item.kcal100 || 0);
  const p = Number(item.p100 || 0);
  const c = Number(item.c100 || 0);
  const f = Number(item.f100 || 0);
  let penalty = 0;
  if (!item.name) penalty += 80;
  if (kcal <= 0) penalty += 20;
  if (kcal > 950) penalty += 10;
  if (p < 0 || c < 0 || f < 0) penalty += 30;
  if (p === 0 && c === 0 && f === 0 && kcal > 0) penalty += 12;
  return penalty;
}

function wholeFoodQueryAdjustment(resultCtx, queryCtx, wholeFoodDetails = null) {
  if (!queryCtx.isWholeFoodQuery || !queryCtx.wholeFoodTokens.length) return 0;
  const details = wholeFoodDetails || getWholeFoodNameDetails(resultCtx, queryCtx);

  let adj = 0;
  const matchedWholeTokens = queryCtx.wholeFoodTokens.filter(t => resultCtx.nameTokens.includes(t));
  if (matchedWholeTokens.length === queryCtx.wholeFoodTokens.length) adj += 40;

  if (details.exactWholeName) adj += 80;
  if (details.otherWholeTokens.length > 0) {
    adj -= details.otherWholeTokens.length * (queryCtx.wholeFoodTokens.length === 1 ? 90 : 56);
  }

  const extraNameTokens = resultCtx.nameTokens.filter(t => !queryCtx.wholeFoodTokens.includes(t));
  const compoundHits = extraNameTokens.filter(t => COMPOUND_FOOD_TERMS.has(t)).length;
  const genericExtras = extraNameTokens.length - compoundHits;

  if (compoundHits > 0) adj -= compoundHits * 28;
  if (genericExtras > 0) adj -= Math.min(genericExtras * 8, 24);

  if (resultCtx.nameTokens.length === queryCtx.wholeFoodTokens.length) adj += 35;
  if (resultCtx.nameTokens.length <= queryCtx.wholeFoodTokens.length + 1) adj += 12;

  return adj;
}

function classifyFoodConfidence(score, meta, item, queryCtx) {
  if (queryCtx?.isWholeFoodQuery && meta.otherWholeFoodHits > 0) {
    return 'low';
  }
  if (queryCtx?.storeHintTokens?.length > 0 && meta.storeHits === 0 && meta.brandHits === 0) {
    return 'low';
  }
  if (
    queryCtx?.brandHintTokens?.length > 0 &&
    !queryCtx.isBrandFocusedQuery &&
    meta.brandHits === 0 &&
    meta.storeHits === 0
  ) {
    return 'low';
  }
  if (queryCtx?.attributeTokens?.length > 0 && meta.attributeHits === 0) {
    return 'low';
  }
  if (queryCtx?.attributeTokens?.length > 1 && meta.attributeHits < queryCtx.attributeTokens.length) {
    return score >= 54 ? 'medium' : 'low';
  }

  const source = item.src || 'off';
  if (source === 'local' || source === 'recent' || source === 'favorite') {
    if (score >= 85 || meta.fullCanonicalMatch) return 'high';
    if (score >= 48) return 'medium';
    return 'low';
  }
  if (source === 'cache') {
    if (score >= 74 || meta.fullCanonicalMatch) return 'high';
    if (score >= 42) return 'medium';
    return 'low';
  }
  if (meta.exactNameTokenMatches >= Math.max(1, meta.tokenCount - meta.missingStrong) && meta.matchedName > 0 && score >= 68) return 'high';
  if (meta.matchedName > 0 && score >= 38) return 'medium';
  return 'low';
}

function scoreFoodResult(item, queryCtx, opts = {}) {
  const resultCtx = buildFoodResultContext(item);
  const tokens = queryCtx.effectiveCanonicalTokens.length ? queryCtx.effectiveCanonicalTokens : queryCtx.effectiveTokens;
  let score = 0;
  const variantIndex = Number.isFinite(Number(item._offVariantIndex)) ? Number(item._offVariantIndex) : 0;
  const meta = {
    tokenCount: tokens.length,
    matchedName: 0,
    matchedBrand: 0,
    missingStrong: 0,
    exactNameTokenMatches: 0,
    attributeHits: 0,
    brandHits: 0,
    storeHits: 0,
    storePhraseHits: 0,
    otherWholeFoodHits: 0,
    exactWholeFoodName: false,
    aliasHits: 0,
    fullCanonicalMatch: false,
    verifiedBoost: 0,
  };

  if (queryCtx.normalized && resultCtx.nameNorm === queryCtx.normalized) score += 120;
  if (queryCtx.normalized && resultCtx.combinedNorm === queryCtx.normalized) score += 130;
  if (queryCtx.joined && resultCtx.nameNorm.includes(queryCtx.joined)) score += 48;
  if (queryCtx.joined && resultCtx.combinedNorm.includes(queryCtx.joined)) score += 32;
  if (queryCtx.canonicalJoined && resultCtx.canonicalNameNorm.includes(queryCtx.canonicalJoined)) score += 34;
  if (queryCtx.canonicalJoined && resultCtx.canonicalCombinedNorm.includes(queryCtx.canonicalJoined)) score += 22;
  meta.fullCanonicalMatch = !!(queryCtx.canonicalJoined && (
    resultCtx.canonicalNameNorm.includes(queryCtx.canonicalJoined) ||
    resultCtx.canonicalCombinedNorm.includes(queryCtx.canonicalJoined)
  ));

  tokens.forEach(t => {
    const nameTokenExact = resultCtx.canonicalNameTokens.includes(t);
    const inName = resultCtx.nameNorm.includes(t) || resultCtx.canonicalNameTokens.includes(t);
    const inBrand = resultCtx.brandNorm.includes(t) || resultCtx.canonicalBrandTokens.includes(t);
    const inAlias = item.verified && (
      resultCtx.aliasNorm.includes(t) || resultCtx.canonicalAliasTokens.includes(t)
    );
    if (inName) {
      meta.matchedName++;
      if (nameTokenExact) {
        meta.exactNameTokenMatches++;
        score += 18;
      }
      score += 14;
      if (resultCtx.nameNorm.startsWith(t) || resultCtx.nameNorm.includes(' ' + t)) score += 8;
    } else if (inBrand) {
      meta.matchedBrand++;
      score += 6;
    } else if (inAlias) {
      meta.aliasHits++;
      score += 10;
    }
    if (!inName && !inBrand && !inAlias && t.length >= 3) meta.missingStrong++;
  });

  if (tokens.length) {
    const coverage = (meta.matchedName + meta.matchedBrand) / tokens.length;
    score += Math.round(coverage * 24);
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (resultCtx.nameNorm.includes(bigram) || resultCtx.canonicalNameNorm.includes(bigram)) score += 18;
    else if (resultCtx.combinedNorm.includes(bigram) || resultCtx.canonicalCombinedNorm.includes(bigram)) score += 10;
  }

  if (meta.matchedName > 0 && meta.matchedBrand > 0) score += 10;
  if (meta.matchedBrand > 0 && meta.matchedName === 0) score -= 12;
  if (meta.missingStrong > 0) score -= meta.missingStrong * 10;
  if ((item._offHasItLabel || item._hasItLabel) && meta.matchedName > 0) score += 4;

  if (tokens.length === 1 && meta.exactNameTokenMatches > 0) {
    score += 55;
    const extraNameTokens = resultCtx.canonicalNameTokens.filter(t => t !== tokens[0]).length;
    score -= Math.min(extraNameTokens * 7, 35);
  }

  if (tokens.length <= 2 && meta.exactNameTokenMatches === tokens.length && resultCtx.canonicalNameTokens.length === tokens.length) {
    score += 40;
  }

  if (queryCtx.storeHintTokens.length > 0) {
    const storeMatch = getStoreAliasMatchDetails(resultCtx, item, queryCtx);
    meta.storeHits = storeMatch.hitCount;
    meta.storePhraseHits = storeMatch.phraseHits;
    score += storeMatch.phraseHits * 26;
    if (storeMatch.phraseHits === 0) score += Math.min(storeMatch.tokenHits * 8, 18);
    if (queryCtx.isBrandFocusedQuery && meta.storeHits > 0) score += 36;
    else if (meta.storeHits > 0 && meta.matchedName > 0) score += 18;
    else if (meta.storeHits === 0) score -= Math.min(28, queryCtx.storeHintTokens.length * 18);
  }

  if (queryCtx.attributeTokens.length > 0) {
    meta.attributeHits = queryCtx.attributeTokens.filter(t =>
      resultCtx.canonicalNameTokens.includes(t) || resultCtx.canonicalBrandTokens.includes(t)
    ).length;
    score += meta.attributeHits * 10;
    if (meta.attributeHits === 0) score -= Math.min(28, queryCtx.attributeTokens.length * 14);
    else if (meta.attributeHits < queryCtx.attributeTokens.length) score -= (queryCtx.attributeTokens.length - meta.attributeHits) * 6;
  }

  if (queryCtx.brandHintTokens.length > 0) {
    meta.brandHits = queryCtx.brandHintTokens.filter(t =>
      resultCtx.canonicalBrandTokens.includes(t) ||
      resultCtx.canonicalNameTokens.includes(t) ||
      resultCtx.canonicalCombinedNorm.includes(t)
    ).length;
    score += meta.brandHits * 18;
    if (
      queryCtx.isBrandFocusedQuery &&
      (
        meta.brandHits === queryCtx.brandHintTokens.length ||
        (queryCtx.storeHintTokens.length === queryCtx.brandHintTokens.length && meta.storeHits > 0)
      )
    ) score += 34;
    if (!queryCtx.isBrandFocusedQuery && meta.brandHits === 0 && meta.storeHits === 0) {
      score -= Math.min(32, queryCtx.brandHintTokens.length * 18);
    }
  }

  if (item.src === 'off') {
    if (variantIndex === 0) score += 18;
    else score -= Math.min(variantIndex * (queryCtx.brandHintTokens.length > 0 ? 14 : 10), 42);
  }

  const wholeFoodDetails = getWholeFoodNameDetails(resultCtx, queryCtx);
  meta.otherWholeFoodHits = wholeFoodDetails.otherWholeTokens.length;
  meta.exactWholeFoodName = wholeFoodDetails.exactWholeName;
  score += wholeFoodQueryAdjustment(resultCtx, queryCtx, wholeFoodDetails);
  meta.verifiedBoost = verifiedFoodBoost(item, resultCtx, queryCtx, meta);
  score += meta.verifiedBoost;

  score += sourceRank(item.src) * 9;
  score += foodLearningBoost(item, queryCtx, opts.contextKey || 'generic');
  score -= foodQualityPenalty(item);
  return {
    score,
    confidence: classifyFoodConfidence(score, meta, item, queryCtx),
    meta,
  };
}

function verifiedFoodBoost(item, resultCtx, queryCtx, meta) {
  if (!item?.verified) return 0;

  let boost = 0;
  const aliasExact = !!(queryCtx.normalized && resultCtx.aliasNorm && resultCtx.aliasNorm.includes(queryCtx.normalized));
  const aliasCanonical = !!(queryCtx.canonicalJoined && resultCtx.canonicalAliasNorm && resultCtx.canonicalAliasNorm.includes(queryCtx.canonicalJoined));
  const strongCoverage = meta.tokenCount > 0 && (meta.matchedName + meta.matchedBrand + meta.aliasHits) >= Math.max(1, meta.tokenCount - meta.missingStrong);

  if (meta.fullCanonicalMatch) boost += 26;
  if (aliasExact || aliasCanonical) boost += 34;
  if (meta.matchedName > 0 && (meta.matchedBrand > 0 || meta.brandHits > 0 || meta.storeHits > 0)) boost += 18;
  if (meta.attributeHits > 0) boost += 10;
  if (strongCoverage) boost += 16;
  if (meta.exactNameTokenMatches === meta.tokenCount && meta.tokenCount > 0) boost += 18;
  if (meta.matchedName > 0 || meta.aliasHits > 0) boost += 8;

  return boost;
}

function getFoodDedupeKey(item) {
  const resultCtx = buildFoodResultContext(item);
  const brandKey = (resultCtx.brandTokens.find(t => t !== 'generico') || '').slice(0, 18);
  const kcalKey = Math.round((Number(item.kcal100 || 0)) / 5) * 5;
  return `${resultCtx.nameNorm}|${brandKey}|${kcalKey}`;
}

function rememberFoodSelection(item, queryCtx, contextKey = 'generic') {
  if (!item) return;
  if (!S.foodSearchLearn) S.foodSearchLearn = {};
  const itemKey = getFoodDedupeKey(item);
  const record = S.foodSearchLearn[itemKey] || {
    count: 0,
    lastPickedAt: null,
    queries: {},
    contexts: {},
  };
  record.count += 1;
  record.lastPickedAt = new Date().toISOString();
  const queryKey = queryCtx?.key || normalizeFoodText(queryCtx?.raw || '');
  if (queryKey) {
    record.queries[queryKey] = (record.queries[queryKey] || 0) + 1;
    if (queryCtx?.canonicalJoined && queryCtx.canonicalJoined !== queryKey) {
      record.queries[queryCtx.canonicalJoined] = (record.queries[queryCtx.canonicalJoined] || 0) + 1;
    }
  }
  if (contextKey) record.contexts[contextKey] = (record.contexts[contextKey] || 0) + 1;
  S.foodSearchLearn[itemKey] = record;

  const keys = Object.keys(S.foodSearchLearn);
  if (keys.length > 450) {
    keys
      .sort((a, b) => {
        const da = new Date(S.foodSearchLearn[a]?.lastPickedAt || 0).getTime();
        const db = new Date(S.foodSearchLearn[b]?.lastPickedAt || 0).getTime();
        return da - db;
      })
      .slice(0, 120)
      .forEach(key => delete S.foodSearchLearn[key]);
  }
  saveSoon();
}

function foodLearningBoost(item, queryCtx, contextKey = 'generic') {
  const itemKey = getFoodDedupeKey(item);
  const record = S.foodSearchLearn?.[itemKey];
  if (!record) return 0;

  const queryKey = queryCtx?.key || '';
  const canonicalQueryKey = queryCtx?.canonicalJoined || '';
  const queryHits = (queryKey ? (record.queries?.[queryKey] || 0) : 0) +
    (canonicalQueryKey && canonicalQueryKey !== queryKey ? (record.queries?.[canonicalQueryKey] || 0) : 0);
  const contextHits = contextKey ? (record.contexts?.[contextKey] || 0) : 0;
  const totalHits = Number(record.count || 0);

  let boost = Math.min(totalHits * 3, 18);
  boost += Math.min(queryHits * 9, 30);
  boost += Math.min(contextHits * 4, 10);

  const lastPickedAt = record.lastPickedAt ? new Date(record.lastPickedAt).getTime() : 0;
  if (lastPickedAt) {
    const ageDays = (Date.now() - lastPickedAt) / 86400000;
    if (ageDays <= 3) boost += 10;
    else if (ageDays <= 14) boost += 5;
  }

  return boost;
}

function rankFoods(items, queryCtx, opts = {}) {
  return items
    .map(item => {
      const evaluation = scoreFoodResult(item, queryCtx, opts);
      return {
        ...item,
        _searchScore: evaluation.score,
        _searchConfidence: evaluation.confidence,
        _searchMeta: evaluation.meta,
      };
    })
    .sort((a, b) =>
      (sourceRank(b.src) - sourceRank(a.src)) ||
      ((b._searchConfidence === 'high') - (a._searchConfidence === 'high')) ||
      ((b._searchConfidence === 'medium') - (a._searchConfidence === 'medium')) ||
      (b._searchScore - a._searchScore) ||
      ((a.name || '').length - (b.name || '').length)
    );
}

function dedupeFoodResults(items, queryCtx, limit = Infinity, opts = {}) {
  const ranked = rankFoods(items, queryCtx, opts);
  const picked = new Map();
  for (const item of ranked) {
    const key = getFoodDedupeKey(item);
    const prev = picked.get(key);
    if (!prev || item._searchScore > prev._searchScore) picked.set(key, item);
  }
  return Array.from(picked.values())
    .sort((a, b) =>
      (b._searchScore - a._searchScore) ||
      (sourceRank(b.src) - sourceRank(a.src))
    )
    .slice(0, limit);
}

// Alimenti recenti: scansiona foodLog (ultimi 14 gg) per alimenti effettivamente loggati
function getRecentFoods(q) {
  const queryCtx = typeof q === 'string' ? buildFoodQueryContext(q) : q;
  const seen = new Set();
  const recents = [];
  const dateKeys = Object.keys(S.foodLog || {}).sort().reverse();
  for (const dk of dateKeys.slice(0, 14)) {
    const dayLog = S.foodLog[dk];
    for (const mealItems of Object.values(dayLog)) {
      for (const item of (mealItems || [])) {
        const dedupeKey = getFoodDedupeKey(item);
        if (!seen.has(dedupeKey) && hasQueryMatch(item, queryCtx)) {
          seen.add(dedupeKey);
          recents.push({ ...item, src: 'recent' });
          if (recents.length >= 4) return recents;
        }
      }
    }
  }
  return recents;
}

// AbortController/versione per contesto di ricerca
const _offAbortByContext = {};
const _searchVersionByContext = {};

function _makeFoodSearchError(code, extra = {}) {
  const error = new Error(extra.message || code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function _classifyFoodSearchError(error) {
  if (error?.name === 'AbortError') return 'aborted';
  if (error?.code === 'timeout') return 'timeout';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return 'provider_error';
}

// Ricerca unificata a 2 fasi:
//   1) locale+recenti istantaneo
//   2) OFF in background (~1s) — aggiunta ai risultati quando arriva
// callback(results, apiStatus) — chiamata 2 volte: locale, poi locale+OFF
async function searchFoods(q, callback, opts = {}) {
  if (!q || q.length < 2) { callback([], null); return; }
  const queryCtx = buildFoodQueryContext(q);
  const key = queryCtx.key;
  const contextKey = opts.contextKey || 'global';
  const version = (_searchVersionByContext[contextKey] || 0) + 1;
  _searchVersionByContext[contextKey] = version;

  // Cancella fetch OFF precedente solo nello stesso contesto
  if (_offAbortByContext[contextKey]) {
    try { _offAbortByContext[contextKey].abort(); } catch(e) {}
  }
  _offAbortByContext[contextKey] = new AbortController();
  const signal = _offAbortByContext[contextKey].signal;

  // 1. Local: custom + database interno
  const custom = (S.customFoods || [])
    .filter(f => hasQueryMatch(f, queryCtx))
    .map(f => ({ ...f, src: 'local' }));

  const favorites = (S.favoriteFoods || [])
    .filter(f => hasQueryMatch(f, queryCtx))
    .map(f => ({ ...f, src: 'favorite' }));

  const local = FOOD_DB
    .filter(f => hasQueryMatch(f, queryCtx))
    .map(f => ({ ...f, src: 'local' }));

  const allLocal = dedupeFoodResults([...favorites, ...custom, ...local], queryCtx, 10, { contextKey });

  // 1.5 Cache query/sessione: usata davvero come prima sorgente esterna locale
  const cached = ((S.foodCache && S.foodCache[key]) || [])
    .map(f => ({ ...f, src: 'cache' }))
    .filter(f => hasQueryMatch(f, queryCtx));

  // 2. Recenti da log effettivo (non cache di ricerca)
  const recents = dedupeFoodResults([...allLocal, ...cached, ...getRecentFoods(queryCtx)], queryCtx, 12, { contextKey })
    .filter(r => r.src === 'recent');

  // Callback fase 1 — locale + cache + recenti
  const phaseOneResults = dedupeFoodResults([...allLocal, ...cached, ...recents], queryCtx, 12, { contextKey });
  callback(phaseOneResults, { off: 'loading', hasCache: cached.length > 0 });

  // 3. OFF in background
  try {
    const offItems = await fetchOFF(q, signal, queryCtx);
    // Scarta se nel frattempo è partita una nuova ricerca
    if (version !== _searchVersionByContext[contextKey]) return;
    const merged = dedupeFoodResults([...phaseOneResults, ...offItems], queryCtx, 32, { contextKey });
    const filtered = merged.filter(r => r.src === 'off' || r.src === 'cache');
    // Cache OFF per sessione
    if (filtered.length) {
      S.foodCache[key] = filtered.map(r => ({ ...r, src: 'cache' }));
      const ks = Object.keys(S.foodCache);
      if (ks.length > 300) ks.slice(0, 80).forEach(k => delete S.foodCache[k]);
      save();
    }
    callback(merged, { off: 'ok', hasCache: cached.length > 0 });
  } catch(e) {
    if (version !== _searchVersionByContext[contextKey]) return; // ricerca annullata, ignora
    const status = _classifyFoodSearchError(e);
    if (status === 'aborted') return;    // cancellato da nuova ricerca
    callback(phaseOneResults, { off: status, hasCache: cached.length > 0 });
  }
}

// Mapping keyword → categoria OFF italiana
// Open Food Facts — ricerca via v1 full-text (cgi/search.pl)
// v2 search_terms è rotto server-side; v1 funziona per tutto:
// categorie (pasta, yogurt), brand (milbona, activia), piatti (spiedini, tiramisù)
async function fetchOFF(q, signal, queryCtx) {
  const V1 = 'https://it.openfoodfacts.net/cgi/search.pl';
  const FIELDS = 'product_name,product_name_it,brands,nutriments';
  const localQueryCtx = queryCtx || buildFoodQueryContext(q);

  // Ricerca full-text v1 — se 0 risultati, riprova con query più corta
  // (es. "fettine di pollo lidl" → 0 → riprova "fettine di pollo")
  const _fetch = async (terms) => {
    const url = `${V1}?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`;
    let timeoutId = null;
    let controller = null;
    try {
      controller = signal ? null : new AbortController();
      const effectiveSignal = signal || controller.signal;
      timeoutId = setTimeout(() => {
        try { (controller || { abort() {} }).abort(); } catch(e) {}
      }, 8000);
      const resp = await mfFetch(
        url,
        { signal: effectiveSignal },
        { source: 'openfoodfacts-search', terms }
      );
      if (!resp.ok) throw _makeFoodSearchError('provider_http', { status: resp.status, message: 'OFF ' + resp.status });
      const data = await resp.json();
      return (data.products || []).filter(p =>
        p.product_name && p.nutriments?.['energy-kcal_100g'] > 0
      );
    } catch (e) {
      if (e.name === 'AbortError') {
        if (signal?.aborted) throw e;
        throw _makeFoodSearchError('timeout', { message: 'OFF timeout' });
      }
      throw e;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const variants = (localQueryCtx.variants && localQueryCtx.variants.length)
    ? localQueryCtx.variants
    : [q];
  let products = [];

  for (let idx = 0; idx < variants.length; idx++) {
    const variant = variants[idx];
    const variantProducts = await _fetch(variant);
    if (variantProducts.length) {
      products = products.concat(variantProducts.map(p => ({
        ...p,
        _offVariantIndex: idx,
        _offVariant: variant,
      })));
    }
    if (products.length >= 18) break;
  }

  // Ranking a 5 fattori: nome match, posizione parola, brand, copertura query, scheda IT
  const mapped = products.map(p => {
    const n = p.nutriments;
    return {
      name:    (p.product_name_it || p.product_name || '').trim().slice(0, 60),
      brand:   (p.brands || '').split(',')[0].trim().slice(0, 30),
      kcal100: Math.round(n['energy-kcal_100g'] || 0),
      p100:    Math.round((n['proteins_100g']      || 0) * 10) / 10,
      c100:    Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
      f100:    Math.round((n['fat_100g']           || 0) * 10) / 10,
      _offHasItLabel: !!(p.product_name_it && p.product_name_it.trim()),
      _offVariantIndex: Number.isFinite(Number(p._offVariantIndex)) ? Number(p._offVariantIndex) : 0,
      _offVariant: p._offVariant || '',
      src: 'off',
    };
  }).filter(r => r.name && r.kcal100 > 0 && hasQueryMatch(r, localQueryCtx));

  return dedupeFoodResults(mapped, localQueryCtx, 20, { contextKey: 'off-fetch' });
}

// fetchUSDA rimosso — OFF è la sorgente API primaria

// ─────────────────────────────────────────────────────────────────────────────
// UI ricerca alimenti (dropdown + gram picker)
// ─────────────────────────────────────────────────────────────────────────────

// HTML del form "Aggiungi manualmente" — sempre disponibile in fondo ai risultati
function _manualFormHTML(uid) {
  return `<div class="mf-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.classList.toggle('mf-open')">
      <span class="mf-toggle-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <span class="mf-toggle-copy">
        <span class="mf-toggle-title">Aggiungi manualmente</span>
        <span class="mf-toggle-sub">Crea un alimento personalizzato per questo pasto</span>
      </span>
    </div>
    <div class="mf-form" style="display:none" id="mff-${uid}">
      <div class="mf-form-head">
        <div class="mf-form-title">Nuovo alimento personalizzato</div>
        <div class="mf-form-sub">Inserisci i valori nutrizionali per 100g e lo aggiungiamo subito al pasto.</div>
      </div>
      <input class="mf-name" type="text" placeholder="Nome alimento (es. Pasticciotto leccese)" autocomplete="off" style="font-size:16px">
      <div class="mf-row4">
        <label class="mf-lbl">Kcal<input class="mf-kcal" type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Prot<input class="mf-p"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Carb<input class="mf-c"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Grassi<input class="mf-g"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
      </div>
      <div class="mf-hint">Valori per 100g</div>
      <button class="mf-save-btn">Salva e aggiungi</button>
    </div>`;
}

// Bind del form manuale — riutilizzabile sia con risultati che senza
function _bindManualForm(resEl, onSelectFn) {
  const form = resEl.querySelector('.mf-form');
  if (!form) return;
  form.querySelector('.mf-save-btn').addEventListener('click', () => {
    const name = form.querySelector('.mf-name').value.trim();
    const kcal = parseFloat(form.querySelector('.mf-kcal').value) || 0;
    const p100 = parseFloat(form.querySelector('.mf-p').value)    || 0;
    const c100 = parseFloat(form.querySelector('.mf-c').value)    || 0;
    const f100 = parseFloat(form.querySelector('.mf-g').value)    || 0;
    if (!name) { toast('❌ Inserisci il nome'); return; }
    if (!kcal) { toast('❌ Inserisci le kcal'); return; }
    const food = { name, brand: '📝 Personale', kcal100: Math.round(kcal), p100, c100, f100, src: 'local' };
    if (!S.customFoods) S.customFoods = [];
    if (!S.customFoods.find(x => x.name.toLowerCase() === name.toLowerCase())) {
      S.customFoods.push({ name, brand: '📝 Personale', kcal100: Math.round(kcal), p100, c100, f100 });
      save();
      toast('✅ ' + name + ' salvato nel database personale');
    }
    onSelectFn(food, document.createElement('div'));
  });
}

function renderFoodDropdown(results, resEl, onSelectFn, extraHTML, apiStatus) {
  const uid = resEl.id || ('mf' + Date.now());
  const manualHtml = _manualFormHTML(uid);
  const PRIMARY_VISIBLE = 5;
  const OFF_VISIBLE = 5;

  // Alert / spinner API status
  let alertsHtml = '';
  if (apiStatus) {
    if (apiStatus.off === 'loading' && results.length) {
      alertsHtml = '<div class="fsr-loading-inline"><span class="fsr-spinner"></span>Ricerca ampliata su Open Food Facts…</div>';
    }
    if (apiStatus.off === 'timeout') alertsHtml += '<div class="alert-slim a-warn"><span class="alert-dot"></span><span class="alert-txt">Open Food Facts lento: continuo con i risultati locali</span></div>';
    if (apiStatus.off === 'offline') alertsHtml += '<div class="alert-slim a-err"><span class="alert-dot"></span><span class="alert-txt">Connessione assente: uso solo risultati locali</span></div>';
    if (apiStatus.off === 'provider_error') alertsHtml += '<div class="alert-slim a-err"><span class="alert-dot"></span><span class="alert-txt">Open Food Facts non raggiungibile</span></div>';
  }

  if (!results.length) {
    const msg = apiStatus?.off === 'loading'
      ? 'Nessun risultato locale. Sto ancora ampliando la ricerca…'
      : apiStatus
        ? 'Nessun risultato utile — prova un altro termine o aggiungi manualmente'
        : 'Nessun risultato. Prova un altro termine o usa il barcode.';
    resEl.innerHTML = alertsHtml + `<div class="fsr-loading">${msg}</div>` + manualHtml + (extraHTML || '');
    _bindManualForm(resEl, onSelectFn);
    return;
  }

  // Raggruppa per src — 'cache' → 'off'
  const groups = { favorite: [], local: [], recent: [], cache: [], off: [] };
  results.forEach(r => {
    const g = groups[r.src] ? r.src : 'off';
    groups[g].push(r);
  });

  const srcBadge = {
    favorite:'<span class="fsr-src fsr-src-favorite">Preferito</span>',
    local:  '<span class="fsr-src fsr-src-local">Locale</span>',
    recent: '<span class="fsr-src fsr-src-recent">Recente</span>',
    cache:  '<span class="fsr-src fsr-src-cache">Cache</span>',
    off:    '<span class="fsr-src fsr-src-api">OFF</span>',
  };
  const confidenceBadge = {
    high: '<span class="fsr-conf fsr-conf-high">Match forte</span>',
    medium: '<span class="fsr-conf fsr-conf-medium">Match buono</span>',
    low: '<span class="fsr-conf fsr-conf-low">Altro risultato</span>',
  };
  const verifiedBadge = '<span class="fsr-verified" title="Alimento verificato" aria-label="Alimento verificato"><span class="fsr-verified-check">✓</span></span>';

  let html = alertsHtml;
  let idx = 0;
  const primaryPool = [...groups.favorite, ...groups.local, ...groups.recent, ...groups.cache]
    .sort((a, b) => (b._searchScore - a._searchScore));
  const primaryItems = primaryPool.filter(item => item._searchConfidence !== 'low');
  const lowConfidencePrimaryItems = primaryPool.filter(item => item._searchConfidence === 'low');
  const strongOffItems = groups.off.filter(item => item._searchConfidence !== 'low');
  const lowConfidenceOffItems = groups.off.filter(item => item._searchConfidence === 'low');

  // Sezione locale + recenti: nessun header
  const _renderPrimaryItem = (item) => {
    const k = 'r-' + idx++;
    return '<div class="fsr-item" id="fsri-' + k + '">' +
      (srcBadge[item.src] || '') +
      '<div class="fsr-info"><div class="fsr-name"><span class="fsr-name-txt">' + htmlEsc(item.name) + '</span>' + (item.verified ? verifiedBadge : '') + '</div>' +
      '<div class="fsr-brand">' + htmlEsc(item.brand || '') + '</div></div>' +
      '<div class="fsr-macros"><div class="fsr-kcal">' + item.kcal100 + '</div>' +
      '<div class="fsr-per">kcal/100g</div></div></div>';
  };
  primaryItems.slice(0, PRIMARY_VISIBLE).forEach(item => { html += _renderPrimaryItem(item); });
  if (primaryItems.length > PRIMARY_VISIBLE) {
    const moreCount = primaryItems.length - PRIMARY_VISIBLE;
    const moreId = 'fsr-primary-more-' + Date.now();
    html += '<div class="fsr-show-more" onclick="document.getElementById(\'' + moreId + '\').style.display=\'block\';this.style.display=\'none\'">Mostra più risultati (' + moreCount + ')</div>';
    html += '<div id="' + moreId + '" style="display:none">';
    primaryItems.slice(PRIMARY_VISIBLE).forEach(item => { html += _renderPrimaryItem(item); });
    html += '</div>';
  }

  // Sezione OFF: header + primi 5, poi "mostra più" per i restanti
  if (strongOffItems.length) {
    html += '<div class="fsr-section">Open Food Facts</div>';
    const _offItem = (item) => {
      const k = 'r-' + idx++;
      return '<div class="fsr-item" id="fsri-' + k + '">' +
        srcBadge.off +
        '<div class="fsr-info"><div class="fsr-name"><span class="fsr-name-txt">' + htmlEsc(item.name) + '</span>' + (item.verified ? verifiedBadge : '') + '</div>' +
        '<div class="fsr-brand">' + htmlEsc(item.brand || '') + '</div></div>' +
        '<div class="fsr-macros"><div class="fsr-kcal">' + item.kcal100 + '</div>' +
        '<div class="fsr-per">kcal/100g</div></div></div>';
    };
    strongOffItems.slice(0, OFF_VISIBLE).forEach(item => { html += _offItem(item); });
    if (strongOffItems.length > OFF_VISIBLE) {
      const moreCount = strongOffItems.length - OFF_VISIBLE;
      const moreId = 'fsr-more-' + Date.now();
      html += '<div class="fsr-show-more" onclick="document.getElementById(\'' + moreId + '\').style.display=\'block\';this.style.display=\'none\'">Mostra più risultati (' + moreCount + ')</div>';
      html += '<div id="' + moreId + '" style="display:none">';
      strongOffItems.slice(OFF_VISIBLE).forEach(item => { html += _offItem(item); });
      html += '</div>';
    }
  }

  const lowConfidenceItems = [...lowConfidencePrimaryItems, ...lowConfidenceOffItems]
    .sort((a, b) => (b._searchScore - a._searchScore));

  if (lowConfidenceItems.length) {
    html += '<div class="fsr-section">Altri risultati</div>';
    const lowId = 'fsr-low-' + Date.now();
    html += '<div class="fsr-show-more" onclick="document.getElementById(\'' + lowId + '\').style.display=\'block\';this.style.display=\'none\'">Mostra risultati meno pertinenti (' + lowConfidenceItems.length + ')</div>';
    html += '<div id="' + lowId + '" style="display:none">';
    lowConfidenceItems.forEach(item => {
      const k = 'r-' + idx++;
      html += '<div class="fsr-item fsr-item-low" id="fsri-' + k + '">' +
        (srcBadge[item.src] || srcBadge.off) +
        confidenceBadge.low +
        '<div class="fsr-info"><div class="fsr-name"><span class="fsr-name-txt">' + htmlEsc(item.name) + '</span>' + (item.verified ? verifiedBadge : '') + '</div>' +
        '<div class="fsr-brand">' + htmlEsc(item.brand || '') + '</div></div>' +
        '<div class="fsr-macros"><div class="fsr-kcal">' + item.kcal100 + '</div>' +
        '<div class="fsr-per">kcal/100g</div></div></div>';
    });
    html += '</div>';
  }

  html += manualHtml;
  if (extraHTML) html += extraHTML;
  resEl.innerHTML = html;

  // Bind click su tutti gli item
  let bindIdx = 0;
  [...primaryItems, ...strongOffItems, ...lowConfidenceItems].forEach(item => {
    const el = document.getElementById('fsri-r-' + bindIdx++);
    if (el) el.addEventListener('click', () => onSelectFn(item, el));
  });
  _bindManualForm(resEl, onSelectFn);
}

const FOOD_PORTIONS = [
  { label: 'Cucchiaino', g: 5 },
  { label: 'Cucchiaio',  g: 15 },
  { label: 'Fetta',      g: 30 },
  { label: 'Porzione',   g: 100 },
  { label: 'Tazza',      g: 240 },
];

function showGramPicker(resEl, item, onConfirmFn, mealCtx) {
  const old = resEl.nextSibling;
  if (old && old.classList?.contains('fsr-gram-row')) old.remove();
  const div = document.createElement('div');
  div.className = 'fsr-gram-row';

  const portionChips = FOOD_PORTIONS.map(p =>
    `<button class="fsr-portion" data-g="${p.g}">${p.label}<span class="fsr-portion-g">${p.g}g</span></button>`
  ).join('');
  const sourceLabel = item.src === 'local'
    ? 'Locale'
    : item.src === 'recent'
      ? 'Recente'
      : item.src === 'cache'
        ? 'Cache'
        : item.src === 'off'
          ? 'OFF'
          : '';
  const verifiedHtml = item.verified
    ? `<span class="fsr-gp-verified" title="Alimento verificato">Verificato</span>`
    : '';
  const brandHtml = item.brand
    ? `<div class="fsr-gp-brand">${htmlEsc(item.brand)}</div>`
    : `<div class="fsr-gp-brand fsr-gp-brand-muted">Brand non specificato</div>`;
  const metaBadgesHtml = [
    sourceLabel ? `<span class="fsr-gp-badge">${sourceLabel}</span>` : '',
    verifiedHtml,
  ].filter(Boolean).join('');

  // Compute daily remaining kcal
  const _dk = (typeof S !== 'undefined' && S.selDate) || (typeof localDate === 'function' ? localDate() : '');
  const _type = typeof S !== 'undefined' ? S.day : 'on';
  const _tgtK = typeof S !== 'undefined' ? (S.macro[_type]?.k || 0) : 0;
  let _eatenK = 0;
  if (typeof S !== 'undefined' && _dk) {
    const _dayLog = S.foodLog[_dk] || {};
    Object.values(_dayLog).forEach(mItems => {
      if (Array.isArray(mItems)) mItems.forEach(it => { _eatenK += Math.round(it.kcal100 * it.grams / 100); });
    });
  }
  const _remK = _tgtK - _eatenK;

  // Compute per-meal remaining kcal (only for numbered meal slots)
  let _mealTgtK = 0, _mealEatenK = 0, _hasMealTarget = false;
  if (mealCtx && typeof mealCtx.mealIdx === 'number' && typeof S !== 'undefined') {
    const meals = S.meals[_type] || [];
    const thisMeal = meals[mealCtx.mealIdx];
    if (thisMeal) {
      const totalPlanK = meals.reduce((s, ml) => s + (mealMacros(ml).kcal || 0), 0);
      const scale = (_tgtK > 0 && totalPlanK > 0) ? _tgtK / totalPlanK : 1;
      _mealTgtK = Math.round(mealMacros(thisMeal).kcal * scale);
      const mealLog = S.foodLog[_dk]?.[mealCtx.mealIdx] || [];
      _mealEatenK = mealLog.reduce((s, it) => s + Math.round(it.kcal100 * it.grams / 100), 0);
      _hasMealTarget = _mealTgtK > 0;
    }
  }
  const _mealRemK = _mealTgtK - _mealEatenK;
  const _p100 = Math.round((item.p100 || 0) * 10) / 10;
  const _c100 = Math.round((item.c100 || 0) * 10) / 10;
  const _f100 = Math.round((item.f100 || 0) * 10) / 10;

  const remRowHTML = (_tgtK > 0 || _hasMealTarget) ? `<div class="fsr-rem-row">` +
    (_hasMealTarget ? `<span class="fsr-rem-lbl">Pasto:</span><span class="fsr-meal-rem-val ${_mealRemK < 0 ? 'err' : _mealRemK < _mealTgtK * 0.1 ? 'warn' : 'ok'}">${_mealRemK - item.kcal100} kcal rim.</span><span class="fsr-rem-sep">·</span>` : '') +
    (_tgtK > 0 ? `<span class="fsr-rem-lbl">Giorno:</span><span class="fsr-rem-val ok">${_remK - item.kcal100} kcal rim.</span>` : '') +
    `</div>` : '';

  div.innerHTML =
    `<div class="fsr-gp-info">` +
      `<div class="fsr-gp-head">` +
        `<div class="fsr-gp-copy">` +
          `<div class="fsr-gram-name">${htmlEsc(item.name.slice(0, 42))}</div>` +
          `${brandHtml}` +
        `</div>` +
        (metaBadgesHtml ? `<div class="fsr-gp-badges">${metaBadgesHtml}</div>` : '') +
      `</div>` +
      `<div class="fsr-gp-macro-title">Valori nutrizionali per 100g</div>` +
      `<div class="fsr-gp-macro-grid">` +
        `<div class="fsr-gp-macro-card kcal"><span class="fsr-gp-macro-k">🔥</span><span class="fsr-gp-macro-v">${item.kcal100}</span><span class="fsr-gp-macro-u">kcal</span><span class="fsr-gp-macro-l">per 100g</span></div>` +
        `<div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🥩</span><span class="fsr-gp-macro-v">${_p100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Proteine</span></div>` +
        `<div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🍚</span><span class="fsr-gp-macro-v">${_c100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Carboidrati</span></div>` +
        `<div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🧈</span><span class="fsr-gp-macro-v">${_f100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Grassi</span></div>` +
      `</div>` +
    `</div>` +
    `<div class="fsr-gp-action">` +
      `<div class="fsr-gp-action-head">Inserisci quantita</div>` +
      `<div class="fsr-portions">${portionChips}</div>` +
      `<div class="fsr-gram-custom">` +
      `<div class="fsr-gram-input-wrap">` +
      `<input type="number" class="fsr-gram-input" value="100" min="1" max="5000" step="1" style="font-size:16px" placeholder="grammi">` +
      `<span class="fsr-gram-unit">g</span>` +
      `</div>` +
      `<span class="fsr-gram-calc">=\u00a0${item.kcal100}\u00a0kcal</span>` +
      `<button class="fsr-gram-add">Aggiungi</button>` +
      `</div>` +
      `<div class="fsr-gp-live">` +
        `<span class="fsr-gp-live-lbl">Con questa quantita</span>` +
        `<span class="fsr-gp-live-val">
          <strong class="fsr-gp-live-k">${item.kcal100} kcal</strong>
          <span class="fsr-gp-live-sep">·</span>
          <span class="fsr-gp-live-m">P <span class="fsr-gp-live-p">${_p100}</span>g</span>
          <span class="fsr-gp-live-sep">·</span>
          <span class="fsr-gp-live-m">C <span class="fsr-gp-live-c">${_c100}</span>g</span>
          <span class="fsr-gp-live-sep">·</span>
          <span class="fsr-gp-live-m">G <span class="fsr-gp-live-f">${_f100}</span>g</span>
        </span>` +
      `</div>` +
      remRowHTML +
    `</div>`;

  resEl.after(div);
  const gi = div.querySelector('.fsr-gram-input');
  const gc = div.querySelector('.fsr-gram-calc');
  const gr = div.querySelector('.fsr-rem-val');
  const gm = div.querySelector('.fsr-meal-rem-val');
  const liveK = div.querySelector('.fsr-gp-live-k');
  const liveP = div.querySelector('.fsr-gp-live-p');
  const liveC = div.querySelector('.fsr-gp-live-c');
  const liveF = div.querySelector('.fsr-gp-live-f');

  const updateCalc = g => {
    const thisKcal = Math.round(item.kcal100 * g / 100);
    const thisP = Math.round((item.p100 || 0) * g / 100 * 10) / 10;
    const thisC = Math.round((item.c100 || 0) * g / 100 * 10) / 10;
    const thisF = Math.round((item.f100 || 0) * g / 100 * 10) / 10;
    gc.textContent = '=\u00a0' + thisKcal + '\u00a0kcal';
    if (liveK) liveK.textContent = `${thisKcal} kcal`;
    if (liveP) liveP.textContent = thisP;
    if (liveC) liveC.textContent = thisC;
    if (liveF) liveF.textContent = thisF;
    if (gr && _tgtK > 0) {
      const afterRem = _remK - thisKcal;
      gr.textContent = (afterRem >= 0 ? afterRem : Math.abs(afterRem)) + (afterRem >= 0 ? ' kcal rim.' : ' kcal in più');
      gr.className = 'fsr-rem-val ' + (afterRem < 0 ? 'err' : afterRem < _tgtK * 0.1 ? 'warn' : 'ok');
    }
    if (gm && _hasMealTarget) {
      const mAfterRem = _mealRemK - thisKcal;
      gm.textContent = (mAfterRem >= 0 ? mAfterRem : Math.abs(mAfterRem)) + (mAfterRem >= 0 ? ' kcal rim.' : ' kcal in più');
      gm.className = 'fsr-meal-rem-val ' + (mAfterRem < 0 ? 'err' : mAfterRem < _mealTgtK * 0.1 ? 'warn' : 'ok');
    }
  };

  gi.addEventListener('input', () => updateCalc(+gi.value || 0));

  div.querySelectorAll('.fsr-portion').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = parseInt(btn.dataset.g);
      gi.value = g;
      updateCalc(g);
      div.querySelectorAll('.fsr-portion').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
    });
  });

  gi.focus();
  div.querySelector('.fsr-gram-add').addEventListener('click', () => {
    const g = Math.round(+gi.value || 100);
    onConfirmFn({ ...item, grams: g });
    div.remove();
  });
}

// Timer separati per non sovrascriversi tra aree di ricerca diverse
const _logTimer  = {};
const _planTimer = {};
let   _tmplTimer = null;

function onLogFoodSearch(input, dateKey, mealIdx, domKey) {
  const q = input.value.trim();
  const queryCtx = buildFoodQueryContext(q);
  const resEl = document.getElementById('mlsr-' + domKey);
  if (!resEl) return;
  clearTimeout(_logTimer[domKey]);
  const gp = resEl.nextSibling;
  if (gp && gp.classList?.contains('fsr-gram-row')) gp.remove();
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div class="fsr-loading">Cerco...</div>';
  _logTimer[domKey] = setTimeout(() => {
    searchFoods(q, (results, apiStatus) => {
      renderFoodDropdown(results, resEl,
        (item, el) => {
          rememberFoodSelection(item, queryCtx, 'meal-log');
          resEl.querySelectorAll('.fsr-item').forEach(e => e.classList.remove('sel'));
          el.classList.add('sel');
          showGramPicker(resEl, item, confirmed => {
            const dayType = typeof resolveDayTypeForDate === 'function'
              ? resolveDayTypeForDate(dateKey)
              : S.day;
            if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
            if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
            S.foodLog[dateKey][mealIdx].push(confirmed);
            syncLoggedMealState(dateKey, mealIdx, dayType);
            save();
            input.value = '';
            resEl.innerHTML = '';
            const gp2 = resEl.nextSibling;
            if (gp2?.classList?.contains('fsr-gram-row')) gp2.remove();
            toast('✅ ' + confirmed.name + ' aggiunto');
            refreshMealCard(dayType, mealIdx);
            requestAnimationFrame(() => {
              if (typeof scrollMealCardIntoView === 'function') {
                scrollMealCardIntoView(dayType, mealIdx, { behavior: 'smooth', focusAdd: true });
              }
            });
          }, { mealIdx, dateKey });
        },
        null, apiStatus
      );
    }, { contextKey: `meal-log:${domKey}` });
  }, 400);
}

function onTmplFoodSearch(input) {
  const q = input.value.trim();
  const queryCtx = buildFoodQueryContext(q);
  const resEl = document.getElementById('tf-search-results');
  if (!resEl) return;
  clearTimeout(_tmplTimer);
  const gp = resEl.nextSibling;
  if (gp && gp.classList?.contains('fsr-gram-row')) gp.remove();
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div class="fsr-loading">Cerco...</div>';
  _tmplTimer = setTimeout(() => {
    searchFoods(q, (results, apiStatus) => {
      renderFoodDropdown(results, resEl,
        (item, el) => {
          rememberFoodSelection(item, queryCtx, 'template-form');
          resEl.querySelectorAll('.fsr-item').forEach(e => e.classList.remove('sel'));
          el.classList.add('sel');
          showGramPicker(resEl, item, confirmed => {
            _tmplFormItems.push(confirmed);
            input.value = '';
            resEl.innerHTML = '';
            renderTmplFormItems();
          });
        },
        null, apiStatus
      );
    }, { contextKey: 'template-form' });
  }, 400);
}

function onFoodSearch(input, type, mealIdx, domKey) {
  const q = input.value.trim();
  const queryCtx = buildFoodQueryContext(q);
  const resEl = document.getElementById('fsr-' + domKey);
  if (!resEl) return;
  clearTimeout(_planTimer[domKey]);
  const gp = resEl.nextSibling;
  if (gp && gp.classList?.contains('fsr-gram-row')) gp.remove();
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  resEl.innerHTML = '<div class="fsr-loading">Cerco...</div>';
  _planTimer[domKey] = setTimeout(() => {
    searchFoods(q, (results, apiStatus) => {
      renderFoodDropdown(results, resEl,
        (item, el) => {
          rememberFoodSelection(item, queryCtx, 'piano');
          resEl.querySelectorAll('.fsr-item').forEach(e => e.classList.remove('sel'));
          el.classList.add('sel');
          showGramPicker(resEl, item, confirmed => {
            const meal = S.meals[type][mealIdx];
            if (!meal.items) meal.items = [];
            meal.items.push(confirmed);
            save();
            input.value = '';
            resEl.innerHTML = '';
            toast('✅ ' + confirmed.name + ' aggiunto');
            renderPiano();
          });
        },
        null, apiStatus
      );
    }, { contextKey: `piano:${domKey}` });
  }, 400);
}
