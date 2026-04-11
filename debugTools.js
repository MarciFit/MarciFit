// debugTools.js - debug mode, fetch wrapper e validazione stato storage

const DEBUG_KEY = 'marcifit_debug_mode';
const _storageStatus = {
  hadSavedState: false,
  loadError: null,
  lastImportError: null,
};
const VALID_PROFESSION_KEYS = ['desk_sedentary', 'desk_light', 'standing', 'physical_light', 'physical_heavy'];
const VALID_WORKOUT_FREQ_KEYS = ['0', '1-2', '3-4', '5-6', '7+'];

function _setDebugFlag(next) {
  try {
    if (next) localStorage.setItem(DEBUG_KEY, '1');
    else localStorage.removeItem(DEBUG_KEY);
  } catch(e) {}
}
function _readDebugFlag() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      _setDebugFlag(true);
      return true;
    }
    if (params.get('debug') === '0') {
      _setDebugFlag(false);
      return false;
    }
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch(e) {
    return false;
  }
}
function isDebugMode() {
  return _readDebugFlag();
}
function mfDebug(channel, message, extra) {
  if (!isDebugMode()) return;
  if (extra === undefined) console.log(`[MarciFit:${channel}] ${message}`);
  else console.log(`[MarciFit:${channel}] ${message}`, extra);
}
function mfWarn(channel, message, extra) {
  if (!isDebugMode()) return;
  if (extra === undefined) console.warn(`[MarciFit:${channel}] ${message}`);
  else console.warn(`[MarciFit:${channel}] ${message}`, extra);
}
function mfError(channel, message, extra) {
  if (!isDebugMode()) return;
  if (extra === undefined) console.error(`[MarciFit:${channel}] ${message}`);
  else console.error(`[MarciFit:${channel}] ${message}`, extra);
}
async function mfFetch(url, options, meta = {}) {
  const startedAt = Date.now();
  mfDebug('fetch', 'request start', { url, meta });
  try {
    const resp = await fetch(url, options);
    const elapsedMs = Date.now() - startedAt;
    const payload = { url, status: resp.status, ok: resp.ok, elapsedMs, meta };
    if (resp.ok) mfDebug('fetch', 'request ok', payload);
    else mfWarn('fetch', 'request non-ok', payload);
    return resp;
  } catch (e) {
    mfError('fetch', 'request failed', {
      url,
      elapsedMs: Date.now() - startedAt,
      meta,
      name: e?.name,
      message: e?.message,
    });
    throw e;
  }
}

function _resetStorageLoadStatus() {
  _storageStatus.hadSavedState = false;
  _storageStatus.loadError = null;
}
function _setStorageLoadError(code, detail = '') {
  _storageStatus.loadError = { code, detail };
}
function getStorageStatus() {
  return {
    hadSavedState: _storageStatus.hadSavedState,
    loadError: _storageStatus.loadError ? { ..._storageStatus.loadError } : null,
    lastImportError: _storageStatus.lastImportError ? { ..._storageStatus.lastImportError } : null,
  };
}
function getStorageDebugSnapshot() {
  const status = getStorageStatus();
  let currentKey = 'piano_federico_v2';
  try {
    if (typeof currentStorageKey === 'function') currentKey = currentStorageKey();
    else if (typeof authGetAppStorageKey === 'function') currentKey = authGetAppStorageKey(currentKey);
  } catch (_) {}
  let stateMeta = null;
  try {
    if (typeof authReadStateMeta === 'function') stateMeta = authReadStateMeta();
  } catch (_) {}
  let auth = null;
  try {
    if (typeof authGetAccountDiagnostics === 'function') auth = authGetAccountDiagnostics();
  } catch (_) {}
  return {
    ...status,
    currentKey,
    stateMeta,
    auth,
  };
}
function _isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function _isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
function _isNullableNumber(value) {
  return value == null || _isFiniteNumber(value);
}
function _isNullableString(value) {
  return value == null || typeof value === 'string';
}
function _validateMacroDay(day, label) {
  if (!_isPlainObject(day)) return { ok: false, code: `macro_${label}_invalid`, detail: `I macro ${label.toUpperCase()} non sono in formato valido.` };
  if (!['p', 'c', 'f', 'k'].every(key => _isFiniteNumber(day[key]))) {
    return { ok: false, code: `macro_${label}_fields_invalid`, detail: `I macro ${label.toUpperCase()} contengono valori non validi.` };
  }
  return { ok: true };
}
function _validateMealPlannerBranch(branch, label) {
  if (!_isPlainObject(branch)) return { ok: false, code: `mealplanner_${label}_invalid`, detail: `Lo stato planner ${label.toUpperCase()} non e valido.` };
  if (!(branch.mealIdx == null || Number.isInteger(branch.mealIdx))) {
    return { ok: false, code: `mealplanner_${label}_mealidx_invalid`, detail: `Il mealIdx del planner ${label.toUpperCase()} non e valido.` };
  }
  if (typeof branch.prompt !== 'string') {
    return { ok: false, code: `mealplanner_${label}_prompt_invalid`, detail: `Il prompt del planner ${label.toUpperCase()} non e valido.` };
  }
  if (typeof branch.useFavorites !== 'boolean' || typeof branch.useTemplates !== 'boolean') {
    return { ok: false, code: `mealplanner_${label}_flags_invalid`, detail: `Le opzioni del planner ${label.toUpperCase()} non sono valide.` };
  }
  if (!Array.isArray(branch.results)) {
    return { ok: false, code: `mealplanner_${label}_results_invalid`, detail: `I risultati del planner ${label.toUpperCase()} non sono in formato valido.` };
  }
  return { ok: true };
}
function _validateCheatConfig(config) {
  if (!_isPlainObject(config)) return { ok: false, code: 'cheatconfig_invalid', detail: 'La configurazione sgarri non e valida.' };
  if ('enabled' in config && typeof config.enabled !== 'boolean') return { ok: false, code: 'cheatconfig_enabled_invalid', detail: 'Il flag sgarri non e valido.' };
  if ('weeklyMax' in config && !Number.isInteger(config.weeklyMax)) return { ok: false, code: 'cheatconfig_weeklymax_invalid', detail: 'Il limite settimanale sgarri non e valido.' };
  if ('hardMax' in config && !Number.isInteger(config.hardMax)) return { ok: false, code: 'cheatconfig_hardmax_invalid', detail: 'Il limite massimo sgarri non e valido.' };
  if ('defaultMode' in config && !['surplus_pct', 'fixed'].includes(config.defaultMode)) return { ok: false, code: 'cheatconfig_mode_invalid', detail: 'La modalita sgarro non e valida.' };
  if ('surplusPct' in config && !_isFiniteNumber(config.surplusPct)) return { ok: false, code: 'cheatconfig_pct_invalid', detail: 'La percentuale sgarro non e valida.' };
  if ('fixedKcal' in config && !_isFiniteNumber(config.fixedKcal)) return { ok: false, code: 'cheatconfig_fixedkcal_invalid', detail: 'Le kcal fisse dello sgarro non sono valide.' };
  return { ok: true };
}
function _validateAnagraficaRange(value, min, max, code, detail) {
  if (value == null) return { ok: true };
  if (value < min || value > max) return { ok: false, code, detail };
  return { ok: true };
}
function validateImportedState(state, options = {}) {
  const relaxed = !!options.relaxed;
  if (relaxed && typeof normalizePersistedStateForBootstrap === 'function') {
    const normalizedState = normalizePersistedStateForBootstrap(state);
    if (normalizedState) state = normalizedState;
  }
  if (!_isPlainObject(state)) return { ok: false, code: 'root_invalid', detail: 'Il file importato non contiene un oggetto valido.' };
  if ('day' in state && !['on', 'off'].includes(state.day)) return { ok: false, code: 'day_invalid', detail: 'Il tipo giorno non e valido.' };
  if ('planTab' in state && !['on', 'off'].includes(state.planTab)) return { ok: false, code: 'plantab_invalid', detail: 'Il tab piano non e valido.' };
  if ('statsRange' in state && !['7d', '30d', '8w', 'all'].includes(state.statsRange)) return { ok: false, code: 'statsrange_invalid', detail: 'Il range statistiche non e valido.' };
  if ('selDate' in state && !_isNullableString(state.selDate)) return { ok: false, code: 'seldate_invalid', detail: 'La data selezionata non e valida.' };
  if ('onDays' in state && !Array.isArray(state.onDays)) return { ok: false, code: 'ondays_invalid', detail: 'I giorni ON non sono in formato valido.' };
  if ('meals' in state) {
    if (!_isPlainObject(state.meals)) return { ok: false, code: 'meals_invalid', detail: 'La struttura dei pasti non e valida.' };
    if ('on' in state.meals && !Array.isArray(state.meals.on)) return { ok: false, code: 'meals_on_invalid', detail: 'I pasti ON non sono in formato valido.' };
    if ('off' in state.meals && !Array.isArray(state.meals.off)) return { ok: false, code: 'meals_off_invalid', detail: 'I pasti OFF non sono in formato valido.' };
  }
  if ('anagrafica' in state) {
    if (!_isPlainObject(state.anagrafica)) return { ok: false, code: 'anagrafica_invalid', detail: 'L anagrafica non e in formato valido.' };
    const ana = state.anagrafica;
    if ('nome' in ana && typeof ana.nome !== 'string') return { ok: false, code: 'anagrafica_nome_invalid', detail: 'Il nome anagrafica non e valido.' };
    if (typeof ana.nome === 'string' && ana.nome.trim().length > 40) return { ok: false, code: 'anagrafica_nome_too_long', detail: 'Il nome anagrafica supera la lunghezza massima.' };
    if ('sesso' in ana && !['m', 'f'].includes(ana.sesso)) return { ok: false, code: 'anagrafica_sesso_invalid', detail: 'Il sesso anagrafica non e valido.' };
    if ('eta' in ana && !_isNullableNumber(ana.eta)) return { ok: false, code: 'anagrafica_eta_invalid', detail: 'L eta anagrafica non e valida.' };
    if ('altezza' in ana && !_isNullableNumber(ana.altezza)) return { ok: false, code: 'anagrafica_altezza_invalid', detail: 'L altezza anagrafica non e valida.' };
    if ('peso' in ana && !_isNullableNumber(ana.peso)) return { ok: false, code: 'anagrafica_peso_invalid', detail: 'Il peso anagrafica non e valido.' };
    if ('passiGiornalieri' in ana && !_isNullableNumber(ana.passiGiornalieri)) return { ok: false, code: 'anagrafica_passi_invalid', detail: 'I passi medi giornalieri non sono validi.' };
    if ('grassoCorporeo' in ana && !_isNullableNumber(ana.grassoCorporeo)) return { ok: false, code: 'anagrafica_grasso_invalid', detail: 'Il grasso corporeo non e valido.' };
    const ageRange = _validateAnagraficaRange(ana.eta, 10, 99, 'anagrafica_eta_range_invalid', 'L eta anagrafica e fuori range.');
    if (!ageRange.ok) return ageRange;
    const heightRange = _validateAnagraficaRange(ana.altezza, 120, 250, 'anagrafica_altezza_range_invalid', 'L altezza anagrafica e fuori range.');
    if (!heightRange.ok) return heightRange;
    const weightRange = _validateAnagraficaRange(ana.peso, 30, 300, 'anagrafica_peso_range_invalid', 'Il peso anagrafica e fuori range.');
    if (!weightRange.ok) return weightRange;
    const stepsRange = _validateAnagraficaRange(ana.passiGiornalieri, 1000, 40000, 'anagrafica_passi_range_invalid', 'I passi medi giornalieri sono fuori range.');
    if (!stepsRange.ok) return stepsRange;
    const bodyFatRange = _validateAnagraficaRange(ana.grassoCorporeo, 3, 60, 'anagrafica_grasso_range_invalid', 'Il grasso corporeo e fuori range.');
    if (!bodyFatRange.ok) return bodyFatRange;
    if ('professione' in ana && !_isNullableString(ana.professione)) return { ok: false, code: 'anagrafica_professione_invalid', detail: 'La professione non e valida.' };
    if (typeof ana.professione === 'string' && ana.professione && !VALID_PROFESSION_KEYS.includes(ana.professione)) {
      return { ok: false, code: 'anagrafica_professione_unknown', detail: 'La professione importata non e riconosciuta.' };
    }
    if ('allenamentiSett' in ana && !_isNullableString(ana.allenamentiSett)) return { ok: false, code: 'anagrafica_allenamenti_invalid', detail: 'La frequenza allenamenti non e valida.' };
    if (typeof ana.allenamentiSett === 'string' && ana.allenamentiSett && !VALID_WORKOUT_FREQ_KEYS.includes(ana.allenamentiSett)) {
      return { ok: false, code: 'anagrafica_allenamenti_unknown', detail: 'La frequenza allenamenti importata non e riconosciuta.' };
    }
  }
  if ('goal' in state) {
    if (!_isPlainObject(state.goal)) return { ok: false, code: 'goal_invalid', detail: 'L obiettivo non e in formato valido.' };
    if ('phase' in state.goal && !['bulk', 'cut', 'mantieni'].includes(state.goal.phase)) return { ok: false, code: 'goal_phase_invalid', detail: 'La fase obiettivo non e valida.' };
    if ('startDate' in state.goal && !_isNullableString(state.goal.startDate)) return { ok: false, code: 'goal_startdate_invalid', detail: 'La data inizio obiettivo non e valida.' };
    if ('targetWeight' in state.goal && !_isNullableNumber(state.goal.targetWeight)) return { ok: false, code: 'goal_targetweight_invalid', detail: 'Il peso target non e valido.' };
    if ('notes' in state.goal && !_isNullableString(state.goal.notes)) return { ok: false, code: 'goal_notes_invalid', detail: 'Le note obiettivo non sono valide.' };
    if ('calibrationOffsetKcal' in state.goal && !_isNullableNumber(state.goal.calibrationOffsetKcal)) return { ok: false, code: 'goal_calibration_offset_invalid', detail: 'La calibrazione kcal non e valida.' };
    if ('calibrationMeta' in state.goal && !(state.goal.calibrationMeta == null || _isPlainObject(state.goal.calibrationMeta))) return { ok: false, code: 'goal_calibration_meta_invalid', detail: 'I metadati della calibrazione non sono validi.' };
  }
  if ('macro' in state) {
    if (!_isPlainObject(state.macro)) return { ok: false, code: 'macro_invalid', detail: 'La struttura macro non e valida.' };
    const onValidation = _validateMacroDay(state.macro.on, 'on');
    if (!onValidation.ok) return onValidation;
    const offValidation = _validateMacroDay(state.macro.off, 'off');
    if (!offValidation.ok) return offValidation;
  }
  if ('templates' in state && !Array.isArray(state.templates)) return { ok: false, code: 'templates_invalid', detail: 'La libreria template non e in formato valido.' };
  if ('weightLog' in state && !Array.isArray(state.weightLog)) return { ok: false, code: 'weightlog_invalid', detail: 'Il log peso non e in formato valido.' };
  if ('measurements' in state && !Array.isArray(state.measurements)) return { ok: false, code: 'measurements_invalid', detail: 'Le misurazioni non sono in formato valido.' };
  if ('notes' in state && !_isPlainObject(state.notes)) return { ok: false, code: 'notes_invalid', detail: 'Le note non sono in formato valido.' };
  if ('water' in state && !_isPlainObject(state.water)) return { ok: false, code: 'water_invalid', detail: 'I dati acqua non sono in formato valido.' };
  if ('cheatMealsByDate' in state && !_isPlainObject(state.cheatMealsByDate)) return { ok: false, code: 'cheatmeals_invalid', detail: 'Gli sgarri salvati non sono in formato valido.' };
  if ('cheatConfig' in state) {
    const cheatValidation = _validateCheatConfig(state.cheatConfig);
    if (!cheatValidation.ok) return cheatValidation;
  }
  if ('supplements' in state && !Array.isArray(state.supplements)) return { ok: false, code: 'supplements_invalid', detail: 'Gli integratori non sono in formato valido.' };
  if ('suppChecked' in state && !_isPlainObject(state.suppChecked)) return { ok: false, code: 'suppchecked_invalid', detail: 'Lo stato integratori non e valido.' };
  if ('foodLog' in state && !_isPlainObject(state.foodLog)) return { ok: false, code: 'foodlog_invalid', detail: 'Il food log non e in formato valido.' };
  if ('doneByDate' in state && !_isPlainObject(state.doneByDate)) return { ok: false, code: 'donebydate_invalid', detail: 'Lo stato giornaliero non e in formato valido.' };
  if ('favoriteFoods' in state && !Array.isArray(state.favoriteFoods)) return { ok: false, code: 'favoritefoods_invalid', detail: 'I cibi preferiti non sono in formato valido.' };
  if ('customFoods' in state && !Array.isArray(state.customFoods)) return { ok: false, code: 'customfoods_invalid', detail: 'I cibi personalizzati non sono in formato valido.' };
  if ('mealPlanner' in state) {
    if (!_isPlainObject(state.mealPlanner)) return { ok: false, code: 'mealplanner_invalid', detail: 'Lo stato del meal planner non e valido.' };
    if ('on' in state.mealPlanner) {
      const onValidation = _validateMealPlannerBranch(state.mealPlanner.on, 'on');
      if (!onValidation.ok) return onValidation;
    }
    if ('off' in state.mealPlanner) {
      const offValidation = _validateMealPlannerBranch(state.mealPlanner.off, 'off');
      if (!offValidation.ok) return offValidation;
    }
  }
  return relaxed ? { ok: true, normalizedState: state } : { ok: true };
}

window.enableMarciFitDebug = function() {
  _setDebugFlag(true);
  console.info('[MarciFit:debug] debug mode enabled');
  if (typeof toast === 'function') toast('🛠️  Debug attivo');
};
window.disableMarciFitDebug = function() {
  _setDebugFlag(false);
  console.info('[MarciFit:debug] debug mode disabled');
  if (typeof toast === 'function') toast('Debug disattivato');
};
window.isMarciFitDebugEnabled = isDebugMode;
window.getMarciFitStorageStatus = getStorageStatus;
window.getMarciFitStorageSnapshot = getStorageDebugSnapshot;
