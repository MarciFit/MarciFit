// debugTools.js - debug mode, fetch wrapper e validazione stato storage

const DEBUG_KEY = 'marcifit_debug_mode';
const _storageStatus = {
  hadSavedState: false,
  loadError: null,
  lastImportError: null,
};

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
function _isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function validateImportedState(state) {
  if (!_isPlainObject(state)) return { ok: false, code: 'root_invalid', detail: 'Il file importato non contiene un oggetto valido.' };
  if ('meals' in state) {
    if (!_isPlainObject(state.meals)) return { ok: false, code: 'meals_invalid', detail: 'La struttura dei pasti non e valida.' };
    if ('on' in state.meals && !Array.isArray(state.meals.on)) return { ok: false, code: 'meals_on_invalid', detail: 'I pasti ON non sono in formato valido.' };
    if ('off' in state.meals && !Array.isArray(state.meals.off)) return { ok: false, code: 'meals_off_invalid', detail: 'I pasti OFF non sono in formato valido.' };
  }
  if ('templates' in state && !Array.isArray(state.templates)) return { ok: false, code: 'templates_invalid', detail: 'La libreria template non e in formato valido.' };
  if ('weightLog' in state && !Array.isArray(state.weightLog)) return { ok: false, code: 'weightlog_invalid', detail: 'Il log peso non e in formato valido.' };
  if ('measurements' in state && !Array.isArray(state.measurements)) return { ok: false, code: 'measurements_invalid', detail: 'Le misurazioni non sono in formato valido.' };
  if ('notes' in state && !_isPlainObject(state.notes)) return { ok: false, code: 'notes_invalid', detail: 'Le note non sono in formato valido.' };
  if ('water' in state && !_isPlainObject(state.water)) return { ok: false, code: 'water_invalid', detail: 'I dati acqua non sono in formato valido.' };
  return { ok: true };
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
