// ─────────────────────────────────────────────────────────────────────────────
// storage.js  –  Persistenza dati (localStorage) e import/export
// Dipendenze: S (state object), mealMacros(), mealIngrText(), esc() da nutritionLogic.js
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'piano_federico_v2';
const LS_MIRROR_SUFFIX = '__mirror';
const LS_SNAPSHOT_SUFFIX = '__snapshots';
const LS_REGISTRY_KEY = 'marcifit_local_registry_v1';
const LS_MAX_SNAPSHOTS = 8;
let _saveTimer;

function currentStorageKey() {
  if (typeof authGetAppStorageKey === 'function') return authGetAppStorageKey(LS_KEY);
  return LS_KEY;
}

function storageMirrorKey(key = currentStorageKey()) {
  return `${key}${LS_MIRROR_SUFFIX}`;
}

function storageSnapshotsKey(key = currentStorageKey()) {
  return `${key}${LS_SNAPSHOT_SUFFIX}`;
}

function storageReadJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validation = validateImportedState(parsed, { relaxed: true });
    if (!validation.ok) return null;
    return {
      raw,
      state: validation.normalizedState || parsed,
      bytes: raw.length,
    };
  } catch (_) {
    return null;
  }
}

function storageReadSnapshots(key = currentStorageKey()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageSnapshotsKey(key)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry.raw === 'string') : [];
  } catch (_) {
    return [];
  }
}

function storageWriteSnapshots(key, raw, meta = {}) {
  try {
    const previous = storageReadSnapshots(key);
    if (previous[0]?.raw === raw) return;
    const next = [{
      raw,
      savedAt: meta.savedAt || new Date().toISOString(),
      bytes: raw.length,
      source: meta.source || 'auto',
    }, ...previous].slice(0, LS_MAX_SNAPSHOTS);
    localStorage.setItem(storageSnapshotsKey(key), JSON.stringify(next));
  } catch (e) {
    try {
      const compact = storageReadSnapshots(key).slice(0, 2);
      localStorage.setItem(storageSnapshotsKey(key), JSON.stringify(compact));
    } catch (_) {}
    mfWarn('storage', 'snapshot write skipped', { name: e?.name, message: e?.message });
  }
}

function storageRememberKey(key = currentStorageKey(), raw = '') {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_REGISTRY_KEY) || '[]');
    const registry = Array.isArray(parsed) ? parsed : [];
    const withoutCurrent = registry.filter(entry => entry?.key !== key);
    const next = [{
      key,
      updatedAt: new Date().toISOString(),
      bytes: raw.length || Number(withoutCurrent[0]?.bytes || 0),
    }, ...withoutCurrent].slice(0, 12);
    localStorage.setItem(LS_REGISTRY_KEY, JSON.stringify(next));
  } catch (_) {}
}

function storageCandidateRaws(key = currentStorageKey()) {
  const candidates = [];
  const add = (source, raw, savedAt = null) => {
    if (typeof raw === 'string' && raw.trim()) candidates.push({ source, raw, savedAt });
  };
  try { add('primary', localStorage.getItem(key)); } catch (_) {}
  try { add('mirror', localStorage.getItem(storageMirrorKey(key))); } catch (_) {}
  storageReadSnapshots(key).forEach((entry, index) => add(`snapshot_${index + 1}`, entry.raw, entry.savedAt || null));
  return candidates;
}

function storageFindBestLocalState(key = currentStorageKey()) {
  const valid = [];
  storageCandidateRaws(key).forEach(candidate => {
    const parsed = storageReadJson(candidate.raw);
    if (!parsed) return;
    valid.push({ ...candidate, ...parsed });
  });
  if (!valid.length) return null;
  valid.sort((a, b) => {
    const aTime = Date.parse(a.state?._localSavedAt || a.savedAt || 0) || 0;
    const bTime = Date.parse(b.state?._localSavedAt || b.savedAt || 0) || 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.bytes - a.bytes;
  });
  return valid[0];
}

function storageCommitRaw(key, raw, options = {}) {
  const savedAt = options.preserveMetaTimestamp ? (S?._localSavedAt || new Date().toISOString()) : new Date().toISOString();
  localStorage.setItem(key, raw);
  localStorage.setItem(storageMirrorKey(key), raw);
  storageWriteSnapshots(key, raw, { savedAt, source: options.source || 'save' });
  storageRememberKey(key, raw);
}

const USER_STATE_KEYS = [
  'checked','altSel','weightLog','notes','noteSearch','profHist',
  'profilo','anagrafica','macro','meals','alts','onDays','calOffset','selDate',
  'doneByDate','measurements','goal','supplements','suppChecked','statsRange',
    'lastCheckin','weeklyCheckinWarmupWeek','barcodeCache','foodCache','foodSearchLearn','foodLog','templates','customFoods','water','waterTargetOverrides','condimentConfirmations',
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
  if (!S.condimentConfirmations || typeof S.condimentConfirmations !== 'object' || Array.isArray(S.condimentConfirmations)) S.condimentConfirmations = {};
  if (!S.waterTargetOverrides || typeof S.waterTargetOverrides !== 'object' || Array.isArray(S.waterTargetOverrides)) S.waterTargetOverrides = {};
  if (typeof normalizeCheatConfig === 'function') normalizeCheatConfig(S.cheatConfig);
}

// Salva lo stato su localStorage
function save(options = {}) {
  try {
    const storageKey = currentStorageKey();
    if (!options.preserveMetaTimestamp) S._localSavedAt = new Date().toISOString();
    S._localSchema = 2;
    const raw = JSON.stringify(S);
    try {
      storageCommitRaw(storageKey, raw, options);
    } catch (primaryError) {
      try { localStorage.removeItem(storageSnapshotsKey(storageKey)); } catch (_) {}
      localStorage.setItem(storageKey, raw);
      localStorage.setItem(storageMirrorKey(storageKey), raw);
      storageRememberKey(storageKey, raw);
      mfWarn('storage', 'save recovered after pruning snapshots', { name: primaryError?.name, message: primaryError?.message });
    }
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
    const candidates = storageCandidateRaws(storageKey);
    const best = storageFindBestLocalState(storageKey);
    if (!best) {
      if (candidates.length) {
        _storageStatus.hadSavedState = true;
        _setStorageLoadError('no_valid_local_copy', 'Le copie locali presenti non sono leggibili.');
        mfError('storage', 'load validation failed for all local copies', { candidates: candidates.map(c => c.source) });
      }
      mfDebug('storage', 'load skipped: no saved state');
      return false;
    }
    _storageStatus.hadSavedState = true;
    applyValidatedState(best.state);
    if (best.source !== 'primary') {
      if (typeof _setStorageRecoveredFrom === 'function') _setStorageRecoveredFrom(best.source, `Dati recuperati da ${best.source}.`);
      try {
        storageCommitRaw(storageKey, JSON.stringify(best.state), { source: 'recovery', preserveMetaTimestamp: true });
      } catch (e) {
        mfWarn('storage', 'recovery re-commit skipped', { name: e?.name, message: e?.message });
      }
      mfWarn('storage', 'load recovered from backup', { source: best.source, bytes: best.bytes });
    }

    mfDebug('storage', 'load ok', { keys: Object.keys(best.state).length, bytes: best.bytes, source: best.source });
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
      const storageKey = currentStorageKey();
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageMirrorKey(storageKey));
      localStorage.removeItem(storageSnapshotsKey(storageKey));
      if (typeof bootstrapAppStateFromCurrentStorage === 'function') {
        bootstrapAppStateFromCurrentStorage({ resetState: true });
        if (typeof refreshAppAfterBootstrap === 'function') {
          refreshAppAfterBootstrap({ closeAuthOverlay: true, preferredView: 'today' });
        }
        if (!S.onboardingCompleted) {
          if (S.authEntryCompleted && typeof openWelcomeOnboarding === 'function') openWelcomeOnboarding();
          else if (typeof openAuthEntry === 'function') openAuthEntry(false);
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
  const raw = JSON.stringify({
    ...S,
    _exportedAt: new Date().toISOString(),
    _exportSource: 'MarciFit locale',
  }, null, 2);
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
