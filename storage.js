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
    const validation = validateImportedState(saved, { relaxed: true });
    if (!validation.ok) {
      _setStorageLoadError(validation.code, validation.detail);
      mfError('storage', 'load validation failed', validation);
      return false;
    }

    applyValidatedState(validation.normalizedState || saved);

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
    title: 'Riparti da zero',
    body: 'Cancellerai <strong>profilo, pasti, misure e progressi</strong> di questo percorso.<br><br>Se vuoi tenerne una copia, esportala prima. Questa azione non si puo annullare.',
    danger: true,
    confirmText: 'Cancella tutto',
    cancelText: 'Torna indietro',
    onConfirm: async () => {
      mfWarn('storage', 'clear storage requested');
      if (typeof authMarkExplicitReset === 'function') authMarkExplicitReset();
      localStorage.removeItem(currentStorageKey());
      if (typeof bootstrapAppStateFromCurrentStorage === 'function') {
        bootstrapAppStateFromCurrentStorage({ resetState: true });
        if (typeof refreshAppAfterBootstrap === 'function') {
          refreshAppAfterBootstrap({ closeAuthOverlay: true, preferredView: 'today' });
        }
        if (!S.onboardingCompleted) {
          if (S.authEntryCompleted && typeof openWelcomeOnboarding === 'function') openWelcomeOnboarding();
          else if (typeof openAuthEntry === 'function') openAuthEntry(false);
        }
        if (typeof authIsAuthenticated === 'function' && authIsAuthenticated() && typeof authSyncStateToCloud === 'function') {
          const syncResult = await authSyncStateToCloud(true);
          if (!syncResult?.ok && !syncResult?.skipped) {
            toast(`⚠️ ${syncResult.message || 'Aggiornamento del profilo non riuscito'}`);
            return;
          }
        }
        toast('🧹 Profilo azzerato');
        return;
      }
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
  toast('✅ Copia pronta');
}

function loadJSON() {
  document.getElementById('fi').click();
}

function reinitializeImportedState() {
  if (typeof sanitizeMealIcons === 'function') sanitizeMealIcons(S);
  if (typeof ensureBootstrapDefaults === 'function') ensureBootstrapDefaults(S);
  if (typeof migrateTemplateMealTypes === 'function') migrateTemplateMealTypes(S);
  if (typeof migrateProfiloToAnagrafica === 'function') migrateProfiloToAnagrafica(S);
  if (typeof migrateFlatMealsToItems === 'function') migrateFlatMealsToItems(S);
  if (typeof normalizeLegacyMealIcons === 'function') normalizeLegacyMealIcons(S);
  if (typeof finalizeBootstrapState === 'function') finalizeBootstrapState(S, true);
  if (typeof normalizeCheatConfig === 'function') normalizeCheatConfig(S.cheatConfig);
  if (typeof syncAnagraficaWeightFromLogs === 'function') syncAnagraficaWeightFromLogs({ preserveIfEmpty: true });
  if (typeof refreshNutritionTargetsFromState === 'function') refreshNutritionTargetsFromState({ saveDeferred: false });
  if (typeof authIsAuthenticated === 'function' && authIsAuthenticated()) {
    S.authEntryCompleted = true;
  }
  if (typeof ensureMealPlannerState === 'function') {
    ensureMealPlannerState('on');
    ensureMealPlannerState('off');
  }
  if (typeof closeAuthEntry === 'function') closeAuthEntry();
  if (S.onboardingCompleted && typeof closeWelcomeOnboarding === 'function') closeWelcomeOnboarding();
  if (typeof resetBootstrapUiState === 'function') resetBootstrapUiState();

  const activeViewId = document.querySelector('.view.active')?.id || 'view-profilo';
  const activeView = activeViewId.replace(/^view-/, '') || 'profilo';
  if (typeof setDay === 'function') setDay(S.day);
  if (typeof renderNotes === 'function') renderNotes();
  if (typeof renderAuthNav === 'function') renderAuthNav();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  if (typeof goView === 'function') goView(activeView);
  else if (typeof rerender === 'function') rerender();
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
        toast('⚠️ Questa copia non sembra valida');
        return;
      }
      applyValidatedState(parsed);
      reinitializeImportedState();
      save();
      if (typeof authEnsureRemoteProfile === 'function') await authEnsureRemoteProfile();
      if (typeof authSyncStateToCloud === 'function') {
        const syncResult = await authSyncStateToCloud(true);
        if (!syncResult?.ok && !syncResult?.skipped) {
          throw new Error(syncResult?.message || 'Aggiornamento del profilo non riuscito');
        }
      }
      _storageStatus.lastImportError = null;
      mfDebug('storage', 'import json ok', { keys: Object.keys(parsed || {}).length });
      toast('✅ Dati importati');
    } catch (e) {
      _storageStatus.lastImportError = { code: 'import_failed', detail: e?.message || 'Importazione non riuscita' };
      mfError('storage', 'import json failed', { name: e?.name, message: e?.message });
      toast(`⚠️ ${e?.message || 'Importazione non riuscita'}`);
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
  toast('✅ File pronto');
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
