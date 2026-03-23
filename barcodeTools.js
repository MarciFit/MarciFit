// barcodeTools.js - scanner barcode, lookup OFF e integrazione con Oggi/Template/Preferiti

let _bcCtx = null; // {dateKey, mealIdx} or null for template form
let _bcStream = null;
let _bcScanning = false;
let _bcItem = null;
let _bcMode = 'log'; // 'log' | 'ff'
let _bcLookupController = null;
let _bcResolvedCode = null;
let _bcLastDetectedCode = null;
let _bcScanLoopToken = 0;
let _bcOpenToken = 0;
const _bcProductCache = {};
const _BC_FRAME_ASPECT = 220 / 84;
const _BC_SCAN_MODES = {
  roi: { widthRatio: 0.68, maxHeightRatio: 0.28 },
  wide: { widthRatio: 0.88, maxHeightRatio: 0.4 },
  full: { widthRatio: 1, maxHeightRatio: 1 },
};
const _BC_DETECTION_WEIGHTS = {
  detector: { roi: 1.65, wide: 1.2, full: 0.95 },
  quagga: { roi: 1.3, wide: 1.0, full: 0.8 },
};
const _BC_CONFIRM_SCORE = 3.15;
const _BC_CONFIRM_MARGIN = 0.85;
const _BC_CONFIRM_MIN_HITS = 2;
const _BC_STAGE_WIDE_MS = 450;
const _BC_STAGE_FULL_MS = 1400;
const _BC_QUAGGA_FALLBACK_MS = 900;
const _BC_LOOKUP_ATTEMPTS = [
  { timeoutMs: 4000, slowNoticeMs: 2200 },
  { timeoutMs: 6000, slowNoticeMs: 3200 },
];

function _setBarcodeStatus(message, tone = 'neutral') {
  const status = document.getElementById('bc-status');
  if (!status) return;
  const nextMessage = String(message || '');
  const nextClass = `bc-status${tone !== 'neutral' ? ` is-${tone}` : ''}`;
  if (status.textContent === nextMessage && status.className === nextClass) return;
  status.textContent = nextMessage;
  status.className = nextClass;
}

function _renderBarcodeActions(actions = []) {
  const actionsEl = document.getElementById('bc-actions');
  if (!actionsEl) return;
  if (!actions.length) {
    actionsEl.innerHTML = '';
    actionsEl.style.display = 'none';
    return;
  }
  actionsEl.innerHTML = actions.map(action => `
    <button class="bc-action-btn${action.tone ? ` ${action.tone}` : ''}" onclick="handleBarcodeAction('${action.id}')">
      ${action.label}
    </button>
  `).join('');
  actionsEl.style.display = 'flex';
}

function _resetBarcodeFeedback(message = 'Inquadra il codice a barre del prodotto') {
  const status = document.getElementById('bc-status');
  if (status) delete status.dataset.scanStage;
  _setBarcodeStatus(message, 'neutral');
  _renderBarcodeActions([]);
}

function _getBarcodeItemStatusLabel(item) {
  if (!item) return 'Prodotto trovato';
  const name = String(item.name || '').trim() || 'Prodotto trovato';
  const meta = [String(item.brand || '').trim(), String(item.quantity || '').trim()].filter(Boolean).join(' · ');
  return meta ? `${name} · ${meta}` : name;
}

function _setBarcodeScanStage(stage) {
  const messages = {
    roi: '🎯 Allinea il barcode nel riquadro centrale',
    wide: '🔎 Allargo la ricerca attorno al riquadro',
    full: '🧭 Cerco su tutta l\'inquadratura',
    quagga: '⚡ Scansione avanzata attiva: prova ad avvicinare il codice',
  };
  const stageOrder = { roi: 0, wide: 1, full: 2, quagga: 3 };
  const next = messages[stage] || messages.roi;
  const status = document.getElementById('bc-status');
  const currentStage = status?.dataset.scanStage || '';
  if (currentStage === stage) return;
  if (currentStage && stageOrder[stage] < stageOrder[currentStage]) return;
  if (status) status.dataset.scanStage = stage;
  _setBarcodeStatus(next, 'neutral');
}

function _isValidEan8(barcode) {
  if (!/^\d{8}$/.test(barcode)) return false;
  const digits = barcode.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10) === check;
}

function _isValidUpcA(barcode) {
  if (!/^\d{12}$/.test(barcode)) return false;
  const digits = barcode.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10) === check;
}

function _isValidEan13(barcode) {
  if (!/^\d{13}$/.test(barcode)) return false;
  const digits = barcode.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 1 : 3), 0);
  return ((10 - (sum % 10)) % 10) === check;
}

function _isLikelyFoodBarcode(barcode) {
  if (!barcode) return false;
  if (barcode.length === 8) return _isValidEan8(barcode);
  if (barcode.length === 12) return _isValidUpcA(barcode);
  if (barcode.length === 13) return _isValidEan13(barcode);
  return false;
}

function _normalizeDetectedBarcode(raw) {
  const barcode = String(raw || '').replace(/\D/g, '');
  if (!_isLikelyFoodBarcode(barcode)) return null;
  return barcode;
}

function _getBarcodeScanRect(video, modeKey) {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  if (modeKey === 'full') {
    return { sx: 0, sy: 0, sw: vw, sh: vh };
  }
  const mode = _BC_SCAN_MODES[modeKey] || _BC_SCAN_MODES.roi;
  let sw = Math.round(vw * mode.widthRatio);
  let sh = Math.round(sw / _BC_FRAME_ASPECT);
  const maxHeight = Math.round(vh * mode.maxHeightRatio);
  if (sh > maxHeight) {
    sh = maxHeight;
    sw = Math.round(sh * _BC_FRAME_ASPECT);
  }
  sw = Math.max(220, Math.min(sw, vw));
  sh = Math.max(84, Math.min(sh, vh));
  const sx = Math.max(0, Math.round((vw - sw) / 2));
  const sy = Math.max(0, Math.round((vh - sh) / 2));
  return { sx, sy, sw, sh };
}

function _drawBarcodeScanRegion(video, canvas, modeKey) {
  const { sx, sy, sw, sh } = _getBarcodeScanRect(video, modeKey);
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.clearRect(0, 0, sw, sh);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return true;
}

function _createBarcodeStabilityState() {
  return {
    scores: {},
    hits: {},
    lastLeader: null,
  };
}

function _decayBarcodeScores(state, factor) {
  Object.keys(state.scores).forEach(code => {
    state.scores[code] *= factor;
    if (state.scores[code] < 0.25) {
      delete state.scores[code];
      delete state.hits[code];
    }
  });
}

function _getBarcodeDetectionWeight(sample) {
  const byEngine = _BC_DETECTION_WEIGHTS[sample.engine] || _BC_DETECTION_WEIGHTS.detector;
  return byEngine[sample.mode] || 1;
}

function _updateBarcodeStabilityState(state, sample) {
  if (!sample?.code) {
    _decayBarcodeScores(state, 0.82);
    if (!Object.keys(state.scores).length) state.lastLeader = null;
    return { confirmed: false, candidate: null, confidence: 0 };
  }

  const normalizedCode = _normalizeDetectedBarcode(sample.code);
  if (!normalizedCode) {
    _decayBarcodeScores(state, 0.86);
    return { confirmed: false, candidate: null, confidence: 0 };
  }

  _decayBarcodeScores(state, 0.92);
  const weight = _getBarcodeDetectionWeight(sample);
  const code = normalizedCode;
  state.scores[code] = (state.scores[code] || 0) + weight;
  state.hits[code] = (state.hits[code] || 0) + 1;

  const ranked = Object.entries(state.scores)
    .sort((a, b) => b[1] - a[1]);
  const [leaderCode, leaderScore] = ranked[0] || [null, 0];
  const secondScore = ranked[1]?.[1] || 0;
  state.lastLeader = leaderCode;

  const confirmed = !!leaderCode &&
    leaderScore >= _BC_CONFIRM_SCORE &&
    (leaderScore - secondScore) >= _BC_CONFIRM_MARGIN &&
    (state.hits[leaderCode] || 0) >= _BC_CONFIRM_MIN_HITS;

  return {
    confirmed,
    candidate: leaderCode,
    confidence: leaderScore,
  };
}

function _updateBarcodeScanHint(stability) {
  if (!stability?.candidate || stability.confirmed) return;
  if (stability.confidence >= 2.8) {
    _setBarcodeStatus('✨ Barcode quasi agganciato: tienilo fermo ancora un attimo', 'neutral');
  }
}

async function _detectBarcodeWithDetector(detector, video, canvas, modeKey) {
  if (!_drawBarcodeScanRegion(video, canvas, modeKey)) return null;
  const codes = await detector.detect(canvas);
  const code = codes?.[0]?.rawValue || null;
  return code ? { code, engine: 'detector', mode: modeKey } : null;
}

function _decodeBarcodeWithQuagga(canvas) {
  return new Promise(resolve => {
    Quagga.decodeSingle({
      src: canvas.toDataURL('image/jpeg', 0.92),
      numOfWorkers: 0,
      inputStream: { size: 800 },
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
        multiple: false
      },
      locator: { patchSize: 'medium', halfSample: false },
    }, result => resolve(result || null));
  });
}

async function _detectBarcodeWithQuagga(video, canvas, modeKey) {
  if (!_drawBarcodeScanRegion(video, canvas, modeKey)) return null;
  const result = await _decodeBarcodeWithQuagga(canvas);
  const decodedCodes = result?.codeResult?.decodedCodes;
  const errors = decodedCodes?.filter(code => code.error !== undefined) || [];
  if (errors.length) {
    const avgErr = errors.reduce((sum, code) => sum + code.error, 0) / errors.length;
    if (avgErr >= 0.25) return null;
  }
  const code = result?.codeResult?.code || null;
  return code ? { code, engine: 'quagga', mode: modeKey } : null;
}

function _getScanModesForElapsed(elapsedMs) {
  if (elapsedMs < _BC_STAGE_WIDE_MS) return ['roi'];
  if (elapsedMs < _BC_STAGE_FULL_MS) return ['roi', 'wide'];
  return ['roi', 'wide', 'full'];
}

function _startBarcodeDetectorLoop(token) {
  const v = document.getElementById('bc-video');
  const cv = document.getElementById('bc-canvas');
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  const stabilityState = _createBarcodeStabilityState();
  const startedAt = Date.now();

  const tick = async () => {
    if (!_bcScanning || token !== _bcScanLoopToken) return;
    const elapsedMs = Date.now() - startedAt;
    const scanModes = _getScanModesForElapsed(elapsedMs);
    _setBarcodeScanStage(scanModes[scanModes.length - 1]);
    let detectionSample = null;

    for (const modeKey of scanModes) {
      try {
        detectionSample = await _detectBarcodeWithDetector(detector, v, cv, modeKey);
      } catch(e) {
        detectionSample = null;
      }
      if (detectionSample) break;
    }

    if (!detectionSample && elapsedMs >= _BC_QUAGGA_FALLBACK_MS && typeof Quagga !== 'undefined') {
      _setBarcodeScanStage('quagga');
      const quaggaModes = scanModes.filter(modeKey => modeKey !== 'full');
      for (const modeKey of (quaggaModes.length ? quaggaModes : scanModes)) {
        try {
          detectionSample = await _detectBarcodeWithQuagga(v, cv, modeKey);
        } catch(e) {
          detectionSample = null;
        }
        if (detectionSample) break;
      }
    }

    const stability = _updateBarcodeStabilityState(stabilityState, detectionSample);
    _updateBarcodeScanHint(stability);
    if (stability.confirmed) {
      _bcScanning = false;
      onBarcodeDetected(stability.candidate);
      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function _startQuaggaLoop(token) {
  const v = document.getElementById('bc-video');
  const cv = document.getElementById('bc-canvas');
  const stabilityState = _createBarcodeStabilityState();
  const startedAt = Date.now();

  const scan = async () => {
    if (!_bcScanning || token !== _bcScanLoopToken) return;
    const elapsedMs = Date.now() - startedAt;
    const scanModes = _getScanModesForElapsed(elapsedMs);
    _setBarcodeScanStage(scanModes[scanModes.length - 1]);
    let detectionSample = null;

    for (const modeKey of scanModes) {
      try {
        detectionSample = await _detectBarcodeWithQuagga(v, cv, modeKey);
      } catch(e) {
        detectionSample = null;
      }
      if (detectionSample) break;
    }

    const stability = _updateBarcodeStabilityState(stabilityState, detectionSample);
    _updateBarcodeScanHint(stability);
    if (stability.confirmed) {
      _bcScanning = false;
      onBarcodeDetected(stability.candidate);
      return;
    }

    if (_bcScanning && token === _bcScanLoopToken) setTimeout(scan, 140);
  };

  if (v.readyState >= 3) scan();
  else v.addEventListener('playing', scan, { once: true });
}

function scanBarcode() {
  if (!_bcStream || !_bcScanning) return;
  _bcScanLoopToken += 1;
  const token = _bcScanLoopToken;
  _setBarcodeScanStage('roi');
  if ('BarcodeDetector' in window) {
    _startBarcodeDetectorLoop(token);
    return;
  }
  if (typeof Quagga !== 'undefined') {
    _startQuaggaLoop(token);
    return;
  }
  _setBarcodeStatus('⚠️ Libreria scanner non caricata. Usa la ricerca testuale.', 'warn');
  _renderBarcodeActions([
    { id: 'open-text-search', label: 'Usa ricerca testuale', tone: 'primary' },
  ]);
}

function _barcodeLookupUrl(barcode) {
  return 'https://world.openfoodfacts.net/api/v0/product/' + barcode + '.json?fields=code,product_name,product_name_it,product_name_en,generic_name,generic_name_it,brands,quantity,nutriments';
}

function _makeBarcodeLookupError(code, extra = {}) {
  const error = new Error(extra.message || code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function _isProbablyOfflineBarcodeError(error) {
  const offlineFlag = typeof navigator !== 'undefined' && navigator.onLine === false;
  const message = String(error?.message || '').toLowerCase();
  const isNetworkish = error?.name === 'TypeError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed');
  return offlineFlag && isNetworkish;
}

function _makeBarcodeLookupOutcomeFromError(error) {
  return {
    status: error?.code === 'timeout'
      ? 'timeout'
      : (_isProbablyOfflineBarcodeError(error) ? 'offline' : 'provider_error'),
    message: error?.message || '',
    httpStatus: error?.status || null,
    errorName: error?.name || '',
  };
}

async function _fetchBarcodeProductOnce(barcode, hardTimeoutMs, slowNoticeMs = 7000) {
  let timeoutId = null;
  let slowNoticeId = null;
  try {
    _bcLookupController = new AbortController();
    timeoutId = setTimeout(() => {
      try { _bcLookupController?.abort(); } catch(e) {}
    }, hardTimeoutMs);
    if (slowNoticeMs > 0) {
      slowNoticeId = setTimeout(() => {
        _setBarcodeStatus(`⏳ Barcode letto: ${barcode}. Open Food Facts sta rispondendo lentamente, aspetto ancora qualche secondo...`, 'warn');
      }, slowNoticeMs);
    }
    const resp = await mfFetch(
      _barcodeLookupUrl(barcode),
      { signal: _bcLookupController.signal },
      { source: 'barcode-lookup', barcode, timeoutMs: hardTimeoutMs }
    );
    if (!resp.ok) {
      throw _makeBarcodeLookupError('provider_http', {
        status: resp.status,
        message: 'OFF ' + resp.status,
      });
    }
    const data = await resp.json();
    const product = data.status === 1 ? data.product : null;
    if (!product) return { status: 'not_found' };
    const item = _buildFoodItemFromBarcodeProduct(product, barcode);
    if (!item) {
      return {
        status: 'insufficient_data',
        productName: (
          product.product_name_it ||
          product.product_name_en ||
          product.product_name ||
          product.generic_name_it ||
          product.generic_name ||
          'Prodotto'
        ).trim(),
      };
    }
    return { status: 'found', item };
  } catch(e) {
    if (e.name === 'AbortError') {
      throw _makeBarcodeLookupError('timeout', { message: 'lookup timeout' });
    }
    throw e;
  } finally {
    if (slowNoticeId) clearTimeout(slowNoticeId);
    if (timeoutId) clearTimeout(timeoutId);
    _bcLookupController = null;
  }
}

async function _lookupBarcodeProduct(barcode) {
  let lastError = null;
  for (let i = 0; i < _BC_LOOKUP_ATTEMPTS.length; i++) {
    const attempt = _BC_LOOKUP_ATTEMPTS[i];
    if (i > 0) {
      _setBarcodeStatus(`⏳ Barcode letto: ${barcode}. Open Food Facts e lento, provo ancora una volta...`, 'warn');
    }
    try {
      return await _fetchBarcodeProductOnce(barcode, attempt.timeoutMs, attempt.slowNoticeMs);
    } catch(e) {
      lastError = e;
      if (_isProbablyOfflineBarcodeError(e)) return _makeBarcodeLookupOutcomeFromError(e);
    }
  }
  return _makeBarcodeLookupOutcomeFromError(lastError);
}

function _showBarcodeLookupFallback(barcode, outcome) {
  const actions = [
    { id: 'open-text-search', label: 'Usa ricerca testuale', tone: 'primary' },
    { id: 'restart-scan', label: 'Nuova scansione' },
  ];

  if (outcome.status === 'timeout') {
    _setBarcodeStatus(`⏳ Barcode letto: ${barcode}. Open Food Facts e molto lento o non restituisce il prodotto in tempo utile.`, 'warn');
    _renderBarcodeActions([
      { id: 'retry-lookup', label: 'Riprova lookup', tone: 'warn' },
      ...actions,
    ]);
    return;
  }

  if (outcome.status === 'offline') {
    _setBarcodeStatus(`❌ Barcode letto: ${barcode}. Sembra che la connessione non sia disponibile.`, 'error');
    _renderBarcodeActions(actions);
    return;
  }

  if (outcome.status === 'provider_error') {
    _setBarcodeStatus(`❌ Barcode letto: ${barcode}. Open Food Facts non e raggiungibile in questo momento.`, 'error');
    _renderBarcodeActions([
      { id: 'retry-lookup', label: 'Riprova lookup', tone: 'warn' },
      ...actions,
    ]);
    return;
  }

  if (outcome.status === 'insufficient_data') {
    _setBarcodeStatus(`⚠️ Barcode letto: ${barcode}. Prodotto trovato, ma i valori nutrizionali non sono sufficienti.`, 'warn');
    _renderBarcodeActions(actions);
    return;
  }

  _setBarcodeStatus(`⚠️ Barcode letto: ${barcode}. Prodotto non trovato su Open Food Facts.`, 'warn');
  _renderBarcodeActions(actions);
}

function _focusBarcodeTextFallback() {
  if (_bcMode === 'ff') {
    closeBarcode();
    goView('profilo');
    setTimeout(() => {
      const form = document.getElementById('ff-add-form');
      if (form && (form.style.display === 'none' || form.style.display === '')) _toggleFfForm();
      const foodsCard = document.getElementById('prof-foods-card');
      foodsCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const input = document.getElementById('ff-search-inp');
      if (input) {
        input.focus();
        input.select?.();
      }
    }, 160);
    return;
  }

  if (!_bcCtx) {
    closeBarcode();
    return;
  }

  const { mealIdx, dateKey } = _bcCtx;
  const dayType = typeof resolveDayTypeForDate === 'function'
    ? resolveDayTypeForDate(dateKey)
    : S.day;
  const domKey = typeof mealIdx === 'string' ? `extra-${mealIdx}` : `${dayType}-${mealIdx}`;
  closeBarcode();
  setTimeout(() => {
    const card = document.getElementById(`mc-${domKey}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const search = document.getElementById('mls-' + domKey);
    if (search && search.style.display === 'none') search.style.display = 'block';
    const input = document.getElementById('mlsi-' + domKey);
    if (input) {
      input.focus();
      input.select?.();
    }
  }, 140);
}

function restartBarcodeScan() {
  _bcItem = null;
  _bcResolvedCode = null;
  _resetBarcodeFeedback();
  const result = document.getElementById('bc-result');
  if (result) result.style.display = 'none';
  if (_bcStream) {
    _bcScanning = true;
    scanBarcode();
    return;
  }
  startBcCamera();
}

async function retryBarcodeLookup() {
  if (!_bcLastDetectedCode) {
    restartBarcodeScan();
    return;
  }
  _bcResolvedCode = null;
  _bcItem = null;
  _renderBarcodeActions([]);
  _setBarcodeStatus(`🔄 Barcode letto: ${_bcLastDetectedCode}. Riprovo il lookup prodotto...`);
  await onBarcodeDetected(_bcLastDetectedCode, { skipCache: true });
}

function handleBarcodeAction(actionId) {
  if (actionId === 'retry-lookup') {
    retryBarcodeLookup();
    return;
  }
  if (actionId === 'restart-scan') {
    restartBarcodeScan();
    return;
  }
  if (actionId === 'open-text-search') {
    _focusBarcodeTextFallback();
  }
}

function _sanitizeBarcode(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function _getBcNutriment(n, keys) {
  for (const key of keys) {
    const val = Number(n?.[key]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return 0;
}

function _buildFoodItemFromBarcodeProduct(product, barcode) {
  if (!product) return null;
  const n = product.nutriments || {};
  const p100 = Math.round((_getBcNutriment(n, ['proteins_100g']) || 0) * 10) / 10;
  const c100 = Math.round((_getBcNutriment(n, ['carbohydrates_100g']) || 0) * 10) / 10;
  const f100 = Math.round((_getBcNutriment(n, ['fat_100g']) || 0) * 10) / 10;
  let kcal100 = Math.round(_getBcNutriment(n, ['energy-kcal_100g', 'energy_from_fat_100g']));
  if (!kcal100) {
    const kj = _getBcNutriment(n, ['energy-kj_100g', 'energy_100g']);
    if (kj) kcal100 = Math.round(kj / 4.184);
  }
  if (!kcal100 && (p100 || c100 || f100)) {
    kcal100 = Math.round(p100 * 4 + c100 * 4 + f100 * 9);
  }

  const rawName = (
    product.product_name_it ||
    product.product_name_en ||
    product.product_name ||
    product.generic_name_it ||
    product.generic_name ||
    'Prodotto'
  ).trim();

  if (!rawName || !kcal100) return null;

  return {
    barcode,
    name: rawName.slice(0, 60),
    brand: (product.brands || '').split(',')[0].trim().slice(0, 30),
    quantity: (product.quantity || '').trim().slice(0, 24),
    kcal100,
    p100,
    c100,
    f100,
  };
}

function _cacheBarcodeItem(item) {
  if (!item?.barcode) return;
  const cachedItem = { ...item, cachedAt: new Date().toISOString() };
  _bcProductCache[item.barcode] = { ...cachedItem };
  if (!S.barcodeCache) S.barcodeCache = {};
  S.barcodeCache[item.barcode] = { ...cachedItem };
  const barcodeKeys = Object.keys(S.barcodeCache);
  if (barcodeKeys.length > 250) {
    barcodeKeys
      .sort((a, b) => new Date(S.barcodeCache[a]?.cachedAt || 0).getTime() - new Date(S.barcodeCache[b]?.cachedAt || 0).getTime())
      .slice(0, 60)
      .forEach(key => delete S.barcodeCache[key]);
  }
  const ck = item.name.toLowerCase().slice(0, 20);
  if (!S.foodCache[ck]) S.foodCache[ck] = [];
  if (!S.foodCache[ck].find(x => x.name === item.name && x.brand === item.brand)) {
    S.foodCache[ck].push({
      name: item.name,
      brand: item.brand,
      kcal100: item.kcal100,
      p100: item.p100,
      c100: item.c100,
      f100: item.f100,
      src: 'cache',
    });
  }
}

function _normalizeCachedBarcodeItem(item, barcode) {
  if (!item) return null;
  const normalized = {
    barcode: barcode || item.barcode || '',
    name: String(item.name || '').trim().slice(0, 60),
    brand: String(item.brand || '').trim().slice(0, 30),
    quantity: String(item.quantity || '').trim().slice(0, 24),
    kcal100: Math.round(Number(item.kcal100 || 0)),
    p100: Math.round(Number(item.p100 || 0) * 10) / 10,
    c100: Math.round(Number(item.c100 || 0) * 10) / 10,
    f100: Math.round(Number(item.f100 || 0) * 10) / 10,
  };
  if (!normalized.barcode || !normalized.name || !normalized.kcal100) return null;
  return normalized;
}

function _findBarcodeItemFromHistory(barcode) {
  const normalizedBarcode = _sanitizeBarcode(barcode);
  if (!normalizedBarcode) return null;

  const tryItem = (candidate) => {
    if (!candidate || _sanitizeBarcode(candidate.barcode) !== normalizedBarcode) return null;
    return _normalizeCachedBarcodeItem(candidate, normalizedBarcode);
  };

  const dateKeys = Object.keys(S.foodLog || {}).sort().reverse();
  for (const dateKey of dateKeys) {
    const dayLog = S.foodLog?.[dateKey] || {};
    for (const mealItems of Object.values(dayLog)) {
      for (const item of (mealItems || [])) {
        const match = tryItem(item);
        if (match) return match;
      }
    }
  }

  for (const template of (S.templates || [])) {
    for (const item of (template.items || [])) {
      const match = tryItem(item);
      if (match) return match;
    }
  }

  for (const favorite of (S.favoriteFoods || [])) {
    const match = tryItem(favorite);
    if (match) return match;
  }

  for (const custom of (S.customFoods || [])) {
    const match = tryItem(custom);
    if (match) return match;
  }

  return null;
}

function _readBarcodeCacheItem(barcode) {
  if (!barcode) return null;
  if (_bcProductCache[barcode]) return { ..._bcProductCache[barcode] };
  const persistent = S.barcodeCache?.[barcode];
  if (persistent) {
    _bcProductCache[barcode] = { ...persistent };
    return { ...persistent };
  }
  return null;
}

function _resumeBarcodeScanning(delay = 1200) {
  if (_bcStream) {
    setTimeout(() => {
      if (!_bcStream || _bcScanning) return;
      _bcScanning = true;
      _resetBarcodeFeedback();
      scanBarcode();
    }, delay);
  }
}

function fillFfFromProduct(item) {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('ff-nome', item.name || '');
  setVal('ff-kcal', item.kcal100 || 0);
  setVal('ff-prot', item.p100 || 0);
  setVal('ff-carb', item.c100 || 0);
  setVal('ff-fat', item.f100 || 0);
  const si = document.getElementById('ff-search-inp');
  if (si) si.value = item.name || '';
  const sr = document.getElementById('ff-search-results');
  if (sr) sr.style.display = 'none';
  toast('✅ Dati compilati — verifica e salva');
}

function showBcResult() {
  if (_bcMode === 'ff') {
    fillFfFromProduct(_bcItem);
    closeBarcode();
    return;
  }
  const resultEl = document.getElementById('bc-result');
  if (!resultEl) return;
  const portions = (typeof FOOD_PORTIONS !== 'undefined' ? FOOD_PORTIONS : [
    { label: 'Cucchiaino', g: 5 },
    { label: 'Cucchiaio',  g: 15 },
    { label: 'Fetta',      g: 30 },
    { label: 'Porzione',   g: 100 },
    { label: 'Tazza',      g: 240 },
  ]);
  const portionChips = portions.map(p =>
    `<button class="fsr-portion${p.g === 100 ? ' sel' : ''}" data-g="${p.g}">${p.label}<span class="fsr-portion-g">${p.g}g</span></button>`
  ).join('');
  const p100 = Math.round((_bcItem.p100 || 0) * 10) / 10;
  const c100 = Math.round((_bcItem.c100 || 0) * 10) / 10;
  const f100 = Math.round((_bcItem.f100 || 0) * 10) / 10;
  const metaBadges = [
    `<span class="fsr-gp-badge">Barcode</span>`,
    _bcItem.barcode ? `<span class="fsr-gp-badge">${_bcItem.barcode}</span>` : '',
  ].filter(Boolean).join('');

  let remRowHTML = '';
  let dayRemaining = null;
  let mealRemaining = null;
  if (_bcCtx) {
    const { dateKey, mealIdx } = _bcCtx;
    const dayType = typeof resolveDayTypeForDate === 'function' ? resolveDayTypeForDate(dateKey) : S.day;
    const tgtK = S.macro?.[dayType]?.k || 0;
    let eatenK = 0;
    const dayLog = S.foodLog[dateKey] || {};
    Object.values(dayLog).forEach(items => {
      if (Array.isArray(items)) items.forEach(it => { eatenK += Math.round(it.kcal100 * it.grams / 100); });
    });
    dayRemaining = tgtK - eatenK;

    if (typeof mealIdx === 'number') {
      const meals = S.meals[dayType] || [];
      const thisMeal = meals[mealIdx];
      if (thisMeal) {
        const totalPlanK = meals.reduce((s, ml) => s + (mealMacros(ml).kcal || 0), 0);
        const scale = (tgtK > 0 && totalPlanK > 0) ? tgtK / totalPlanK : 1;
        const mealTarget = Math.round(mealMacros(thisMeal).kcal * scale);
        const mealLog = S.foodLog[dateKey]?.[mealIdx] || [];
        const mealEaten = mealLog.reduce((s, it) => s + Math.round(it.kcal100 * it.grams / 100), 0);
        mealRemaining = mealTarget - mealEaten;
      }
    }
    remRowHTML = `<div class="fsr-rem-row">` +
      (mealRemaining !== null ? `<span class="fsr-rem-lbl">Pasto:</span><span id="bc-meal-rem" class="fsr-meal-rem-val ${mealRemaining < 0 ? 'err' : mealRemaining < 80 ? 'warn' : 'ok'}">${mealRemaining - _bcItem.kcal100} kcal rim.</span><span class="fsr-rem-sep">·</span>` : '') +
      (tgtK > 0 ? `<span class="fsr-rem-lbl">Giorno:</span><span id="bc-day-rem" class="fsr-rem-val ok">${dayRemaining - _bcItem.kcal100} kcal rim.</span>` : '') +
    `</div>`;
  }

  resultEl.innerHTML = `
    <div class="bc-result-shell">
      <div class="fsr-gp-info">
        <div class="fsr-gp-head">
          <div class="fsr-gp-copy">
            <div id="bc-product-name" class="fsr-gram-name">${_bcItem.name}</div>
            <div id="bc-product-meta" class="fsr-gp-brand${_bcItem.brand ? '' : ' fsr-gp-brand-muted'}">${_bcItem.brand ? `${_bcItem.brand}${_bcItem.quantity ? ` · ${_bcItem.quantity}` : ''}` : (_bcItem.quantity || 'Brand non specificato')}</div>
          </div>
          <div class="fsr-gp-badges">${metaBadges}</div>
        </div>
        <div class="fsr-gp-macro-title">Valori nutrizionali per 100g</div>
        <div class="fsr-gp-macro-grid">
          <div class="fsr-gp-macro-card kcal"><span class="fsr-gp-macro-k">🔥</span><span class="fsr-gp-macro-v">${_bcItem.kcal100}</span><span class="fsr-gp-macro-u">kcal</span><span class="fsr-gp-macro-l">per 100g</span></div>
          <div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🥩</span><span class="fsr-gp-macro-v">${p100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Proteine</span></div>
          <div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🍚</span><span class="fsr-gp-macro-v">${c100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Carboidrati</span></div>
          <div class="fsr-gp-macro-card"><span class="fsr-gp-macro-k">🧈</span><span class="fsr-gp-macro-v">${f100}</span><span class="fsr-gp-macro-u">g</span><span class="fsr-gp-macro-l">Grassi</span></div>
        </div>
      </div>
      <div class="fsr-gp-action bc-gp-action">
        <div class="fsr-gp-action-head">Inserisci quantita</div>
        <div class="fsr-portions">${portionChips}</div>
        <div class="fsr-gram-custom">
          <div class="fsr-gram-input-wrap">
            <input type="number" class="fsr-gram-input" id="bc-gram-input" value="100" min="1" max="5000" step="1">
            <span class="fsr-gram-unit">g</span>
          </div>
          <span class="fsr-gram-calc" id="bc-gram-calc">= 100 kcal</span>
          <button class="fsr-gram-add" onclick="confirmBarcodeItem()">Aggiungi</button>
        </div>
        <div class="fsr-gp-live">
          <span class="fsr-gp-live-lbl">Con questa quantita</span>
          <span class="fsr-gp-live-val">
            <strong class="fsr-gp-live-k" id="bc-live-k">${_bcItem.kcal100} kcal</strong>
            <span class="fsr-gp-live-sep">·</span>
            <span class="fsr-gp-live-m">P <span id="bc-live-p">${p100}</span>g</span>
            <span class="fsr-gp-live-sep">·</span>
            <span class="fsr-gp-live-m">C <span id="bc-live-c">${c100}</span>g</span>
            <span class="fsr-gp-live-sep">·</span>
            <span class="fsr-gp-live-m">G <span id="bc-live-f">${f100}</span>g</span>
          </span>
        </div>
        ${remRowHTML}
      </div>
    </div>`;
  _setBarcodeStatus(`✅ ${_getBarcodeItemStatusLabel(_bcItem)}`, 'success');
  _renderBarcodeActions([]);
  const gi = document.getElementById('bc-gram-input');
  const gc = document.getElementById('bc-gram-calc');
  const liveK = document.getElementById('bc-live-k');
  const liveP = document.getElementById('bc-live-p');
  const liveC = document.getElementById('bc-live-c');
  const liveF = document.getElementById('bc-live-f');
  const mealRemEl = document.getElementById('bc-meal-rem');
  const dayRemEl = document.getElementById('bc-day-rem');
  const updateLive = grams => {
    const g = Math.max(1, Math.round(grams || 0));
    const kcal = Math.round(_bcItem.kcal100 * g / 100);
    const p = Math.round((_bcItem.p100 || 0) * g / 100 * 10) / 10;
    const c = Math.round((_bcItem.c100 || 0) * g / 100 * 10) / 10;
    const f = Math.round((_bcItem.f100 || 0) * g / 100 * 10) / 10;
    gc.textContent = `= ${kcal} kcal`;
    if (liveK) liveK.textContent = `${kcal} kcal`;
    if (liveP) liveP.textContent = p;
    if (liveC) liveC.textContent = c;
    if (liveF) liveF.textContent = f;
    if (mealRemEl) {
      const mealRemainingNow = mealRemaining - kcal;
      mealRemEl.textContent = `${mealRemainingNow} kcal rim.`;
      mealRemEl.className = `fsr-meal-rem-val ${mealRemainingNow < 0 ? 'err' : mealRemainingNow < 80 ? 'warn' : 'ok'}`;
    }
    if (dayRemEl) {
      dayRemEl.textContent = `${dayRemaining - kcal} kcal rim.`;
    }
  };
  gi.value = 100;
  updateLive(100);
  gi.oninput = () => updateLive(+gi.value || 0);
  resultEl.querySelectorAll('.fsr-portion').forEach(btn => {
    btn.onclick = () => {
      resultEl.querySelectorAll('.fsr-portion').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      gi.value = btn.dataset.g;
      updateLive(+btn.dataset.g || 0);
      gi.focus();
    };
  });
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (_bcStream) {
    _bcStream.getTracks().forEach(t => t.stop());
    _bcStream = null;
  }
  gi.focus();
}

function openBarcode(dateKey, mealIdx) {
  _bcOpenToken += 1;
  _bcCtx = dateKey != null ? { dateKey, mealIdx } : null;
  _bcItem = null;
  _bcResolvedCode = null;
  _bcLastDetectedCode = null;
  _bcScanning = false;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
    _bcLookupController = null;
  }
  const modal = document.getElementById('barcode-modal');
  const result = document.getElementById('bc-result');
  result.style.display = 'none';
  _resetBarcodeFeedback();
  modal.style.display = 'flex';
  if (typeof lockUiScroll === 'function') lockUiScroll();
  startBcCamera(_bcOpenToken);
}

async function startBcCamera(openToken = _bcOpenToken) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('API fotocamera non supportata da questo browser');
    }
    _bcStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    if (openToken !== _bcOpenToken) {
      _bcStream.getTracks().forEach(t => t.stop());
      _bcStream = null;
      return;
    }
    const v = document.getElementById('bc-video');
    if (!v) {
      _bcStream.getTracks().forEach(t => t.stop());
      _bcStream = null;
      return;
    }
    v.srcObject = _bcStream;
    await v.play();
    if (openToken !== _bcOpenToken) {
      _bcStream.getTracks().forEach(t => t.stop());
      _bcStream = null;
      return;
    }
    _bcScanning = true;
    scanBarcode();
  } catch(e) {
    if (openToken !== _bcOpenToken) return;
    _setBarcodeStatus(
      e.name === 'NotAllowedError'
        ? '❌  Permesso fotocamera negato. Abilitalo nelle impostazioni browser.'
        : '❌  Fotocamera non disponibile: ' + e.message,
      'error'
    );
    _renderBarcodeActions([
      { id: 'open-text-search', label: 'Usa ricerca testuale', tone: 'primary' },
    ]);
  }
}

async function onBarcodeDetected(barcode, opts = {}) {
  const cleanBarcode = _normalizeDetectedBarcode(barcode) || _sanitizeBarcode(barcode);
  if (!cleanBarcode || !_isLikelyFoodBarcode(cleanBarcode)) {
    _setBarcodeStatus('⚠️ Lettura incerta del barcode. Riprovo automaticamente...', 'warn');
    _resumeBarcodeScanning(500);
    return;
  }
  _bcLastDetectedCode = cleanBarcode;
  if (_bcResolvedCode === cleanBarcode && _bcItem) {
    showBcResult();
    return;
  }

  _bcScanning = false;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
  }

  const cached = _readBarcodeCacheItem(cleanBarcode);
  if (cached && !opts.skipCache) {
    _bcResolvedCode = cleanBarcode;
    _bcItem = { ...cached };
    _setBarcodeStatus(`⚡ ${_getBarcodeItemStatusLabel(_bcItem)}`, 'success');
    showBcResult();
    return;
  }

  _renderBarcodeActions([]);
  _setBarcodeStatus('🔍 Codice: ' + cleanBarcode + ' · Cerco su Open Food Facts...');
  const outcome = await _lookupBarcodeProduct(cleanBarcode);
  if (outcome.status === 'found') {
    _bcResolvedCode = cleanBarcode;
    _bcItem = outcome.item;
    _cacheBarcodeItem(_bcItem);
    save();
    showBcResult();
    return;
  }

  const historyItem = _findBarcodeItemFromHistory(cleanBarcode);
  if (historyItem) {
    _bcResolvedCode = cleanBarcode;
    _bcItem = { ...historyItem };
    _setBarcodeStatus(`⚠️ Prodotto non verificato online: ${_getBarcodeItemStatusLabel(_bcItem)}`, 'warn');
    showBcResult();
    return;
  }

  _bcResolvedCode = null;
  _bcItem = null;
  mfWarn('barcode', 'lookup unresolved', { barcode: cleanBarcode, outcome });
  _showBarcodeLookupFallback(cleanBarcode, outcome);
}

function confirmBarcodeItem() {
  if (!_bcItem) return;
  const grams = Math.round(+document.getElementById('bc-gram-input').value || 100);
  const item = { ..._bcItem, grams };
  if (_bcCtx) {
    const { dateKey, mealIdx } = _bcCtx;
    const dayType = typeof resolveDayTypeForDate === 'function'
      ? resolveDayTypeForDate(dateKey)
      : S.day;
    if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
    if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
    S.foodLog[dateKey][mealIdx].push(item);
    syncLoggedMealState(dateKey, mealIdx, dayType);
    save();
    closeBarcode();
    toast('✅  ' + item.name + ' aggiunto');
    refreshMealCard(dayType, mealIdx);
    requestAnimationFrame(() => {
      if (typeof scrollMealCardIntoView === 'function') {
        scrollMealCardIntoView(dayType, mealIdx, { behavior: 'smooth', focusAdd: true });
      }
    });
  } else {
    _tmplFormItems.push(item);
    closeBarcode();
    renderTmplFormItems();
    toast('✅  ' + item.name + ' aggiunto al template');
  }
}

function closeBarcode() {
  _bcScanning = false;
  _bcMode = 'log';
  _bcResolvedCode = null;
  _bcLastDetectedCode = null;
  _bcScanLoopToken += 1;
  _bcOpenToken += 1;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
    _bcLookupController = null;
  }
  if (_bcStream) {
    _bcStream.getTracks().forEach(t => t.stop());
    _bcStream = null;
  }
  document.getElementById('barcode-modal').style.display = 'none';
  document.getElementById('bc-result').style.display = 'none';
  _bcItem = null;
  _bcCtx = null;
  _renderBarcodeActions([]);
  if (typeof unlockUiScroll === 'function') unlockUiScroll();
}

function openBarcodeForFf() {
  _bcMode = 'ff';
  openBarcode(null, null);
}
