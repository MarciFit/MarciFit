// ─────────────────────────────────────────────────────────────────────────────
// storage.js  –  Persistenza dati (localStorage) e import/export
// Dipendenze: S (state object), mealMacros(), mealIngrText(), esc() da nutritionLogic.js
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'piano_federico_v2';
let _saveTimer;

function currentStorageKey() {
  if (typeof authGetAppStorageKey === 'function') return authGetAppStorageKey(LS_KEY);
  return LS_KEY;
}

const USER_STATE_KEYS = [
  'checked','altSel','weightLog','notes','noteSearch','profHist',
  'profilo','anagrafica','macro','meals','alts','onDays','calOffset','selDate',
  'doneByDate','measurements','goal','supplements','suppChecked','statsRange',
  'lastCheckin','weeklyCheckinWarmupWeek','barcodeCache','foodCache','foodSearchLearn','foodLog','templates','customFoods','water',
  'cheatMealsByDate','cheatConfig',
  'favoriteFoods','mealPlanner'
  ,'authEntryCompleted','onboardingCompleted','onboardingVersion'
];

function applyValidatedState(saved) {
  USER_STATE_KEYS.forEach(k => { if (k in saved) S[k] = saved[k]; });

  if (saved.day === 'on' || saved.day === 'off') S.day = saved.day;
  if (saved.planTab === 'on' || saved.planTab === 'off') S.planTab = saved.planTab;

  if (!Array.isArray(S.onDays) || S.onDays.length === 0) S.onDays = [1, 3, 5];
  if (typeof S.noteSearch !== 'string') S.noteSearch = '';
  if (!S.cheatMealsByDate || typeof S.cheatMealsByDate !== 'object' || Array.isArray(S.cheatMealsByDate)) S.cheatMealsByDate = {};
  if (typeof normalizeCheatConfig === 'function') normalizeCheatConfig(S.cheatConfig);
}

// Salva lo stato su localStorage
function save(options = {}) {
  try {
    const raw = JSON.stringify(S);
    localStorage.setItem(currentStorageKey(), raw);
    if (typeof authOnLocalStateSaved === 'function') authOnLocalStateSaved(raw, options);
    mfDebug('storage', 'save ok', { bytes: raw.length });
  } catch(e) {
    mfError('storage', 'save failed', { name: e?.name, message: e?.message });
  }
}

// Salvataggio debounced (evita scritture eccessive durante l'editing)
function saveSoon() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 400);
}

// Carica lo stato da localStorage; restituisce true se trovato
function loadSaved() {
  _resetStorageLoadStatus();
  try {
    const storageKey = currentStorageKey();
    const resolved = localStorage.getItem(storageKey);
    if (!resolved) {
      mfDebug('storage', 'load skipped: no saved state');
      return false;
    }
    _storageStatus.hadSavedState = true;
    const saved = JSON.parse(resolved);
    const validation = validateImportedState(saved);
    if (!validation.ok) {
      _setStorageLoadError(validation.code, validation.detail);
      mfError('storage', 'load validation failed', validation);
      return false;
    }

    applyValidatedState(saved);

    mfDebug('storage', 'load ok', { keys: Object.keys(saved).length, bytes: resolved.length });
    return true;
  } catch(e) {
    _setStorageLoadError('json_parse_failed', e?.message || 'JSON non valido');
    mfError('storage', 'load failed', { name: e?.name, message: e?.message });
    return false;
  }
}

// Cancella tutti i dati e ricarica la pagina
function clearStorage() {
  showDayModal({
    icon: '🗑️',
    title: 'Reset tutti i dati',
    body: 'Questa operazione <strong>cancella definitivamente</strong> tutti i dati salvati (piani, log, misurazioni, profilo) e riporta l\'app ai valori originali.<br><br>L\'operazione non è reversibile.',
    danger: true,
    onConfirm: () => {
      mfWarn('storage', 'clear storage requested');
      if (typeof authMarkExplicitReset === 'function') authMarkExplicitReset();
      localStorage.removeItem(currentStorageKey());
      location.reload();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export / Import JSON
// ─────────────────────────────────────────────────────────────────────────────

function exportJSON() {
  const raw = JSON.stringify(S, null, 2);
  dl(new Blob([raw], { type: 'application/json' }), buildExportFilename('json'));
  mfDebug('storage', 'export json ok', { bytes: raw.length });
  toast('💾  Salvato');
}

function loadJSON() {
  document.getElementById('fi').click();
}

function onLoad(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const validation = validateImportedState(parsed);
      if (!validation.ok) {
        _storageStatus.lastImportError = { code: validation.code, detail: validation.detail };
        mfError('storage', 'import json rejected', validation);
        toast('❌  File JSON non valido');
        return;
      }
      applyValidatedState(parsed);
      save();
      if (typeof authEnsureRemoteProfile === 'function') await authEnsureRemoteProfile();
      if (typeof authSyncStateToCloud === 'function') {
        const syncResult = await authSyncStateToCloud(true);
        if (!syncResult?.ok && !syncResult?.skipped) {
          throw new Error(syncResult?.message || 'Sync cloud non riuscita');
        }
      }
      _storageStatus.lastImportError = null;
      mfDebug('storage', 'import json ok', { keys: Object.keys(parsed || {}).length });
      toast('📂  Caricato');
      location.reload();
    } catch (e) {
      _storageStatus.lastImportError = { code: 'json_parse_failed', detail: e?.message || 'JSON non valido' };
      mfError('storage', 'import json failed', { name: e?.name, message: e?.message });
      toast(`❌  ${e?.message || 'Errore JSON'}`);
    } finally {
      e.target.value = '';
    }
  };
  r.readAsText(f);
}

function buildExportFilename(ext = 'json') {
  const rawName = String(
    S?.anagrafica?.nome ||
    AUTH?.user?.name ||
    AUTH?.user?.email ||
    'backup'
  ).trim();
  const safeName = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'backup';
  const datePart = new Date().toISOString().slice(0, 10);
  return `marcifit_${safeName}_${datePart}.${ext}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Python
// ─────────────────────────────────────────────────────────────────────────────

function exportPy() {
  const mo = S.macro.on, mf = S.macro.off;
  const py = `#!/usr/bin/env python3
# Piano Alimentare – ${new Date().toLocaleDateString('it-IT')}
MACRO_ON ={'p':${mo.p},'c':${mo.c},'f':${mo.f},'k':${mo.k}}
MACRO_OFF={'p':${mf.p},'c':${mf.c},'f':${mf.f},'k':${mf.k}}
PASTI_ON=[${S.meals.on.map((m) => {
    const mm = mealMacros(m);
    return `\n    ('${m.icon}','${esc(m.name)}','${esc(m.time)}','${esc(mealIngrText(m))}',${mm.kcal},${mm.p},${mm.c},${mm.f})`;
  }).join(',')}
]
PASTI_OFF=[${S.meals.off.map((m) => {
    const mm = mealMacros(m);
    return `\n    ('${m.icon}','${esc(m.name)}','${esc(m.time)}','${esc(mealIngrText(m))}',${mm.kcal},${mm.p},${mm.c},${mm.f})`;
  }).join(',')}
]
if __name__=='__main__':
    for t,meals,macro in[('ON',PASTI_ON,MACRO_ON),('OFF',PASTI_OFF,MACRO_OFF)]:
        print(f"\\nGiorno {t}: {macro['k']} kcal | P {macro['p']}g C {macro['c']}g F {macro['f']}g")
        for m in meals: print(f"  {m[1]}: {m[4]} kcal")
`;
  dl(new Blob([py], { type: 'text/plain' }), buildExportFilename('py'));
  toast('⬇️  Python scaricato');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility download
// ─────────────────────────────────────────────────────────────────────────────

function dl(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
