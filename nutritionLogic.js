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
    if (S.doneByDate[key] && S.doneByDate[key].done > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      // oggi non ancora loggato → non interrompe la streak
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function calcWeekScore() {
  // Score 0-100: pasti completati 50%, ON rispettati 30%, note inserite 20%
  const now = new Date();
  const dow = now.getDay();
  const mondayOff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOff);
  monday.setHours(0, 0, 0, 0);
  const ON_SET = new Set(S.onDays);
  let mealPts = 0, onPts = 0, notePts = 0, days = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (d > now) break;
    const key = localDate(d);
    days++;
    const info = S.doneByDate[key];
    if (info) { mealPts += info.done / info.total; }
    const scheduled = ON_SET.has(d.getDay()) ? 'on' : 'off';
    if (info && info.type === scheduled) onPts++;
    if (S.notes[key]) notePts++;
  }
  if (!days) return 0;
  return Math.round((mealPts / days) * 50 + (onPts / days) * 30 + (notePts / days) * 20);
}

function calcAdherence(daysBack = 28) {
  let count = 0, total = 0;
  const d = new Date();
  for (let i = 0; i < daysBack; i++) {
    const key = localDate(d);
    if (new Date(key + 'T12:00:00') <= new Date()) {
      total++;
      const info = S.doneByDate[key];
      if (info && info.done >= Math.ceil(info.total * 0.75)) count++;
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
  {name:"Yogurt greco 0%",brand:"Fage",kcal100:57,p100:10,c100:3.5,f100:0.2},
  {name:"Yogurt greco 2%",brand:"Fage Total",kcal100:73,p100:9.7,c100:4,f100:2},
  {name:"Yogurt greco intero",brand:"Generico",kcal100:97,p100:9,c100:3.2,f100:5},
  {name:"Yogurt bianco intero",brand:"Muller",kcal100:61,p100:3.5,c100:4.7,f100:3.2},
  {name:"Yogurt bianco 0%",brand:"Danone",kcal100:36,p100:4.3,c100:4.8,f100:0.1},
  {name:"Skyr naturale",brand:"Arla",kcal100:63,p100:11,c100:4,f100:0.2},
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
  {name:"Tonno al naturale",brand:"Rio Mare",kcal100:103,p100:23,c100:0,f100:1},
  {name:"Tonno in olio sgocciolato",brand:"Rio Mare",kcal100:198,p100:25,c100:0,f100:11},
  {name:"Salmone atlantico fresco",brand:"Generico",kcal100:208,p100:20,c100:0,f100:13},
  {name:"Merluzzo",brand:"Generico",kcal100:82,p100:18,c100:0,f100:0.7},
  {name:"Orata",brand:"Generico",kcal100:121,p100:20,c100:0,f100:4.5},
  {name:"Spigola branzino",brand:"Generico",kcal100:97,p100:17,c100:0,f100:3},
  {name:"Gamberetti sgusciati",brand:"Generico",kcal100:71,p100:14,c100:1.5,f100:1},
  {name:"Sgombro al naturale",brand:"Nostromo",kcal100:189,p100:19,c100:0,f100:12},
  // Cereali / carboidrati
  {name:"Riso bianco secco",brand:"Scotti",kcal100:355,p100:7,c100:79,f100:0.6},
  {name:"Riso basmati secco",brand:"Scotti",kcal100:355,p100:7.3,c100:78,f100:0.5},
  {name:"Riso integrale secco",brand:"Riso Scotti",kcal100:337,p100:7.5,c100:72,f100:2.2},
  {name:"Riso parboiled secco",brand:"Riso Gallo",kcal100:356,p100:8,c100:78,f100:0.6},
  {name:"Pasta secca penne rigatoni",brand:"Barilla",kcal100:357,p100:13,c100:71,f100:1.5},
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
  {name:"Salsa di pomodoro",brand:"Mutti",kcal100:34,p100:1.6,c100:6,f100:0.4},
  {name:"Passata di pomodoro",brand:"Mutti",kcal100:32,p100:1.4,c100:5.6,f100:0.2},
  {name:"Ketchup",brand:"Heinz",kcal100:112,p100:1.4,c100:28,f100:0.1},
  {name:"Senape",brand:"Calve",kcal100:66,p100:4.4,c100:6,f100:3.3},
  {name:"Salsa soia",brand:"Kikkoman",kcal100:60,p100:6,c100:5.6,f100:0},
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
  // Prodotti da forno / colazione
  {name:"Corn flakes",brand:"Kelloggs",kcal100:379,p100:7,c100:84,f100:0.9},
  {name:"Muesli senza zucchero",brand:"Jordans",kcal100:364,p100:10,c100:67,f100:7},
  {name:"Fette biscottate",brand:"Mulino Bianco",kcal100:413,p100:12,c100:74,f100:8},
  {name:"Wasa fibra",brand:"Wasa",kcal100:334,p100:9.8,c100:67,f100:2},
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

// Alimenti recenti: scansiona foodLog (ultimi 14 gg) per alimenti effettivamente loggati
function getRecentFoods(q) {
  const key = q.toLowerCase().trim();
  const seen = new Set();
  const recents = [];
  const dateKeys = Object.keys(S.foodLog || {}).sort().reverse();
  for (const dk of dateKeys.slice(0, 14)) {
    const dayLog = S.foodLog[dk];
    for (const mealItems of Object.values(dayLog)) {
      for (const item of (mealItems || [])) {
        const nameKey = item.name.toLowerCase();
        if (!seen.has(nameKey) &&
            (nameKey.includes(key) || (item.brand||'').toLowerCase().includes(key))) {
          seen.add(nameKey);
          recents.push({ ...item, src: 'recent' });
          if (recents.length >= 4) return recents;
        }
      }
    }
  }
  return recents;
}

// Calcola punteggio rilevanza: quante parole della query (>2 char) compaiono nel nome O nel brand
function _relevance(name, q, brand) {
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return 1;
  const text = (name + ' ' + (brand || '')).toLowerCase();
  return words.filter(w => text.includes(w)).length;
}

// AbortController globale per cancellare fetch OFF precedenti
let _offAbort = null;
let _searchVersion = 0;

// Ricerca unificata a 2 fasi:
//   1) locale+recenti istantaneo
//   2) OFF in background (~1s) — aggiunta ai risultati quando arriva
// callback(results, apiStatus) — chiamata 2 volte: locale, poi locale+OFF
async function searchFoods(q, callback) {
  if (!q || q.length < 2) { callback([], null); return; }
  const key = q.toLowerCase().trim();
  const version = ++_searchVersion;

  // Cancella fetch OFF precedente
  if (_offAbort) { try { _offAbort.abort(); } catch(e) {} }
  _offAbort = new AbortController();
  const signal = _offAbort.signal;

  // 1. Local: custom + database interno
  const custom = (S.customFoods || []).filter(f =>
    f.name.toLowerCase().includes(key) || (f.brand||'').toLowerCase().includes(key)
  ).slice(0, 5).map(f => ({ ...f, src: 'local' }));

  const local = FOOD_DB.filter(f =>
    f.name.toLowerCase().includes(key) || f.brand.toLowerCase().includes(key)
  ).slice(0, 6).map(f => ({ ...f, src: 'local' }));

  const allLocal = [...custom, ...local].slice(0, 8);

  // 2. Recenti da log effettivo (non cache di ricerca)
  const recents = getRecentFoods(q)
    .filter(r => !allLocal.find(l => l.name.toLowerCase() === r.name.toLowerCase()));

  const seen = new Set([...allLocal, ...recents].map(r => r.name.toLowerCase().slice(0, 25)));

  // Callback fase 1 — locale+recenti (nessun apiStatus = "OFF in caricamento")
  callback([...allLocal, ...recents], null);

  // 3. OFF in background
  try {
    const offItems = await fetchOFF(q, signal);
    // Scarta se nel frattempo è partita una nuova ricerca
    if (version !== _searchVersion) return;
    const filtered = offItems.filter(r => {
      const k = r.name.toLowerCase().slice(0, 25);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    }).slice(0, 20);
    // Cache OFF per sessione
    if (filtered.length) {
      S.foodCache[key] = filtered.map(r => ({ ...r, src: 'cache' }));
      const ks = Object.keys(S.foodCache);
      if (ks.length > 300) ks.slice(0, 80).forEach(k => delete S.foodCache[k]);
      save();
    }
    callback([...allLocal, ...recents, ...filtered], { off: 'ok' });
  } catch(e) {
    if (version !== _searchVersion) return; // ricerca annullata, ignora
    if (e.name === 'AbortError') return;    // cancellato da nuova ricerca
    callback([...allLocal, ...recents], { off: 'err' });
  }
}

// Mapping keyword → categoria OFF italiana
// Open Food Facts — ricerca via v1 full-text (cgi/search.pl)
// v2 search_terms è rotto server-side; v1 funziona per tutto:
// categorie (pasta, yogurt), brand (milbona, activia), piatti (spiedini, tiramisù)
async function fetchOFF(q, signal) {
  const V1 = 'https://it.openfoodfacts.net/cgi/search.pl';
  const FIELDS = 'product_name,product_name_it,brands,nutriments';
  const fetchOpts = signal ? { signal } : { signal: AbortSignal.timeout(8000) };

  // Ricerca full-text v1 — se 0 risultati, riprova con query più corta
  // (es. "fettine di pollo lidl" → 0 → riprova "fettine di pollo")
  const _fetch = async (terms) => {
    const resp = await fetch(
      `${V1}?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`,
      fetchOpts
    );
    if (!resp.ok) throw new Error('OFF ' + resp.status);
    const data = await resp.json();
    return (data.products || []).filter(p =>
      p.product_name && p.nutriments?.['energy-kcal_100g'] > 0
    );
  };

  let products = await _fetch(q);

  // Retry progressivo: se 0 risultati e query ha 3+ parole, rimuovi ultima parola
  const words = q.trim().split(/\s+/);
  if (products.length === 0 && words.length >= 3) {
    products = await _fetch(words.slice(0, -1).join(' '));
  }

  // Ranking a 5 fattori: nome match, posizione parola, brand, copertura query, scheda IT
  const qWords = q.toLowerCase().split(/\s+/).filter(w => w.length >= 3);
  if (qWords.length > 0) {
    products.sort((a, b) => {
      const _score = (p) => {
        const name = ((p.product_name_it || '') + ' ' + (p.product_name || '')).toLowerCase();
        const brand = (p.brands || '').toLowerCase();
        let s = 0;
        for (const w of qWords) {
          if (name.includes(w)) s += 3;                         // a) match nel nome
          if (name.startsWith(w) || name.includes(' ' + w)) s += 2; // b) nome inizia con parola
          if (brand.includes(w)) s += 1;                        // c) match nel brand
        }
        // d) copertura: bonus proporzionale a quante parole della query matchano
        const matched = qWords.filter(w => name.includes(w) || brand.includes(w)).length;
        s += Math.round((matched / qWords.length) * 3);
        // e) scheda italiana disponibile
        if (p.product_name_it && p.product_name_it.trim()) s += 1;
        return s;
      };
      return _score(b) - _score(a);
    });
  }

  return products.slice(0, 20).map(p => {
    const n = p.nutriments;
    return {
      name:    (p.product_name_it || p.product_name || '').trim().slice(0, 60),
      brand:   (p.brands || '').split(',')[0].trim().slice(0, 30),
      kcal100: Math.round(n['energy-kcal_100g'] || 0),
      p100:    Math.round((n['proteins_100g']      || 0) * 10) / 10,
      c100:    Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
      f100:    Math.round((n['fat_100g']           || 0) * 10) / 10,
      src: 'off',
    };
  }).filter(r => r.name && r.kcal100 > 0);
}

// fetchUSDA rimosso — OFF è la sorgente API primaria

// ─────────────────────────────────────────────────────────────────────────────
// UI ricerca alimenti (dropdown + gram picker)
// ─────────────────────────────────────────────────────────────────────────────

// HTML del form "Aggiungi manualmente" — sempre disponibile in fondo ai risultati
function _manualFormHTML(uid) {
  return `<div class="mf-toggle" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.classList.toggle('mf-open')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Aggiungi manualmente
    </div>
    <div class="mf-form" style="display:none" id="mff-${uid}">
      <input class="mf-name" type="text" placeholder="Nome (es. Pasticciotto leccese)" autocomplete="off" style="font-size:16px">
      <div class="mf-row4">
        <label class="mf-lbl">kcal<input class="mf-kcal" type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Prot<input class="mf-p"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Carb<input class="mf-c"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
        <label class="mf-lbl">Gras<input class="mf-g"    type="number" min="0" placeholder="0" inputmode="decimal" style="font-size:16px"></label>
      </div>
      <div class="mf-hint">Valori per 100g</div>
      <button class="mf-save-btn">Salva e aggiungi →</button>
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

  // Alert / spinner API status
  let alertsHtml = '';
  if (apiStatus) {
    if (apiStatus.off === 'err') alertsHtml += '<div class="alert-slim a-err"><span class="alert-dot"></span><span class="alert-txt">Open Food Facts non raggiungibile</span></div>';
  } else if (results.length) {
    // Fase intermedia: locale pronto, OFF ancora in caricamento
    alertsHtml = '<div class="fsr-loading-inline"><span class="fsr-spinner"></span>Open Food Facts in caricamento…</div>';
  }

  if (!results.length) {
    const msg = apiStatus
      ? 'Nessun risultato — prova un altro termine o aggiungi manualmente'
      : 'Nessun risultato. Prova un altro termine o usa il barcode.';
    resEl.innerHTML = alertsHtml + `<div class="fsr-loading">${msg}</div>` + manualHtml + (extraHTML || '');
    _bindManualForm(resEl, onSelectFn);
    return;
  }

  // Raggruppa per src — 'cache' → 'off'
  const groups = { local: [], recent: [], off: [] };
  results.forEach(r => {
    const g = r.src === 'cache' ? 'off' : (groups[r.src] ? r.src : 'off');
    groups[g].push(r);
  });

  const srcBadge = {
    local:  '',
    recent: '<span class="fsr-recent-icon">🕐</span>',
    off:    '<span class="fsr-src fsr-src-api">OFF</span>',
  };

  let html = alertsHtml;
  let idx = 0;

  // Sezione locale + recenti: nessun header
  [...groups.local, ...groups.recent].forEach(item => {
    const k = 'r-' + idx++;
    html +=
      '<div class="fsr-item" id="fsri-' + k + '">' +
      (item.src === 'recent' ? srcBadge.recent : '') +
      '<div class="fsr-info"><div class="fsr-name">' + htmlEsc(item.name) + '</div>' +
      '<div class="fsr-brand">' + htmlEsc(item.brand || '') + '</div></div>' +
      '<div class="fsr-macros"><div class="fsr-kcal">' + item.kcal100 + '</div>' +
      '<div class="fsr-per">kcal/100g</div></div></div>';
  });

  // Sezione OFF: header + primi 8, poi "mostra più" per i restanti
  const OFF_VISIBLE = 8;
  if (groups.off.length) {
    html += '<div class="fsr-section">Open Food Facts</div>';
    const _offItem = (item) => {
      const k = 'r-' + idx++;
      return '<div class="fsr-item" id="fsri-' + k + '">' +
        srcBadge.off +
        '<div class="fsr-info"><div class="fsr-name">' + htmlEsc(item.name) + '</div>' +
        '<div class="fsr-brand">' + htmlEsc(item.brand || '') + '</div></div>' +
        '<div class="fsr-macros"><div class="fsr-kcal">' + item.kcal100 + '</div>' +
        '<div class="fsr-per">kcal/100g</div></div></div>';
    };
    groups.off.slice(0, OFF_VISIBLE).forEach(item => { html += _offItem(item); });
    if (groups.off.length > OFF_VISIBLE) {
      const moreCount = groups.off.length - OFF_VISIBLE;
      const moreId = 'fsr-more-' + Date.now();
      html += '<div class="fsr-show-more" onclick="document.getElementById(\'' + moreId + '\').style.display=\'block\';this.style.display=\'none\'">Mostra più risultati (' + moreCount + ')</div>';
      html += '<div id="' + moreId + '" style="display:none">';
      groups.off.slice(OFF_VISIBLE).forEach(item => { html += _offItem(item); });
      html += '</div>';
    }
  }

  html += manualHtml;
  if (extraHTML) html += extraHTML;
  resEl.innerHTML = html;

  // Bind click su tutti gli item
  let bindIdx = 0;
  [...groups.local, ...groups.recent, ...groups.off].forEach(item => {
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

  const remRowHTML = (_tgtK > 0 || _hasMealTarget) ? `<div class="fsr-rem-row">` +
    (_hasMealTarget ? `<span class="fsr-rem-lbl">Pasto:</span><span class="fsr-meal-rem-val ${_mealRemK < 0 ? 'err' : _mealRemK < _mealTgtK * 0.1 ? 'warn' : 'ok'}">${_mealRemK - item.kcal100} kcal rim.</span><span class="fsr-rem-sep">·</span>` : '') +
    (_tgtK > 0 ? `<span class="fsr-rem-lbl">Giorno:</span><span class="fsr-rem-val ok">${_remK - item.kcal100} kcal rim.</span>` : '') +
    `</div>` : '';

  div.innerHTML =
    `<div class="fsr-gram-name">${htmlEsc(item.name.slice(0, 30))}</div>` +
    `<div class="fsr-portions">${portionChips}</div>` +
    `<div class="fsr-gram-custom">` +
    `<input type="number" class="fsr-gram-input" value="100" min="1" max="5000" step="1" style="font-size:16px" placeholder="grammi">` +
    `<span class="fsr-gram-unit">g</span>` +
    `<span class="fsr-gram-calc">=\u00a0${item.kcal100}\u00a0kcal</span>` +
    `<button class="fsr-gram-add">Aggiungi</button>` +
    `</div>` +
    remRowHTML;

  resEl.after(div);
  const gi = div.querySelector('.fsr-gram-input');
  const gc = div.querySelector('.fsr-gram-calc');
  const gr = div.querySelector('.fsr-rem-val');
  const gm = div.querySelector('.fsr-meal-rem-val');

  const updateCalc = g => {
    const thisKcal = Math.round(item.kcal100 * g / 100);
    gc.textContent = '=\u00a0' + thisKcal + '\u00a0kcal';
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
          resEl.querySelectorAll('.fsr-item').forEach(e => e.classList.remove('sel'));
          el.classList.add('sel');
          showGramPicker(resEl, item, confirmed => {
            if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
            if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
            S.foodLog[dateKey][mealIdx].push(confirmed);
            // Auto-check: primo alimento loggato → pasto completato (solo pasti regolari)
            if (typeof mealIdx === 'number') {
              const autoKey = S.day + '-' + mealIdx;
              if (!S.checked[autoKey]) { S.checked[autoKey] = true; syncDoneByDate(); }
            }
            save();
            input.value = '';
            resEl.innerHTML = '';
            const gp2 = resEl.nextSibling;
            if (gp2?.classList?.contains('fsr-gram-row')) gp2.remove();
            toast('✅ ' + confirmed.name + ' aggiunto');
            refreshMealCard(S.day, mealIdx);
          }, { mealIdx, dateKey });
        },
        null, apiStatus
      );
    });
  }, 400);
}

function onTmplFoodSearch(input) {
  const q = input.value.trim();
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
    });
  }, 400);
}

function onFoodSearch(input, type, mealIdx, domKey) {
  const q = input.value.trim();
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
    });
  }, 400);
}
