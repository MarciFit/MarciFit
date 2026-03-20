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
const _bcProductCache = {};

function _setBarcodeStatus(message, tone = 'neutral') {
  const status = document.getElementById('bc-status');
  if (!status) return;
  status.textContent = message;
  status.className = `bc-status${tone !== 'neutral' ? ` is-${tone}` : ''}`;
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
  _setBarcodeStatus(message, 'neutral');
  _renderBarcodeActions([]);
}

function _startBarcodeDetectorLoop(token) {
  const v = document.getElementById('bc-video');
  const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
  let lastCode = null;
  let codeCount = 0;
  const confirmNeeded = 2;

  const tick = async () => {
    if (!_bcScanning || token !== _bcScanLoopToken) return;
    try {
      const codes = await detector.detect(v);
      if (codes.length) {
        const code = codes[0].rawValue;
        if (code === lastCode) {
          codeCount += 1;
          if (codeCount >= confirmNeeded) {
            _bcScanning = false;
            onBarcodeDetected(code);
            return;
          }
        } else {
          lastCode = code;
          codeCount = 1;
        }
      } else {
        lastCode = null;
        codeCount = 0;
      }
    } catch(e) {}
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function _startQuaggaLoop(token) {
  const v = document.getElementById('bc-video');
  const cv = document.getElementById('bc-canvas');
  let lastCode = null;
  let codeCount = 0;
  const confirmNeeded = 2;
  const isConfident = (result) => {
    const codes = result?.codeResult?.decodedCodes;
    if (!codes) return false;
    const errors = codes.filter(code => code.error !== undefined);
    if (!errors.length) return true;
    const avgErr = errors.reduce((sum, code) => sum + code.error, 0) / errors.length;
    return avgErr < 0.25;
  };

  const scan = () => {
    if (!_bcScanning || token !== _bcScanLoopToken) return;
    cv.width = v.videoWidth || 640;
    cv.height = v.videoHeight || 480;
    cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
    Quagga.decodeSingle({
      src: cv.toDataURL('image/jpeg', 0.9),
      numOfWorkers: 0,
      inputStream: { size: 800 },
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'code_128_reader'],
        multiple: false
      },
      locator: { patchSize: 'medium', halfSample: false },
    }, result => {
      if (result?.codeResult?.code && isConfident(result)) {
        const code = result.codeResult.code;
        if (code === lastCode) {
          codeCount += 1;
          if (codeCount >= confirmNeeded) {
            _bcScanning = false;
            onBarcodeDetected(code);
            return;
          }
        } else {
          lastCode = code;
          codeCount = 1;
        }
      }
      if (_bcScanning && token === _bcScanLoopToken) setTimeout(scan, 150);
    });
  };

  if (v.readyState >= 3) scan();
  else v.addEventListener('playing', scan, { once: true });
}

function scanBarcode() {
  if (!_bcStream || !_bcScanning) return;
  _bcScanLoopToken += 1;
  const token = _bcScanLoopToken;
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
  return 'https://world.openfoodfacts.org/api/v0/product/' + barcode + '.json?fields=code,product_name,product_name_it,product_name_en,generic_name,generic_name_it,brands,quantity,nutriments';
}

function _makeBarcodeLookupError(code, extra = {}) {
  const error = new Error(extra.message || code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

async function _fetchBarcodeProductOnce(barcode, timeoutMs) {
  let timeoutId = null;
  try {
    _bcLookupController = new AbortController();
    timeoutId = setTimeout(() => {
      try { _bcLookupController?.abort(); } catch(e) {}
    }, timeoutMs);
    const resp = await mfFetch(
      _barcodeLookupUrl(barcode),
      { signal: _bcLookupController.signal },
      { source: 'barcode-lookup', barcode, timeoutMs }
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
    if (timeoutId) clearTimeout(timeoutId);
    _bcLookupController = null;
  }
}

async function _lookupBarcodeProduct(barcode) {
  const retryTimeouts = [4000, 6500];
  let lastFailure = null;

  for (let attempt = 0; attempt < retryTimeouts.length; attempt += 1) {
    const timeoutMs = retryTimeouts[attempt];
    try {
      return await _fetchBarcodeProductOnce(barcode, timeoutMs);
    } catch(e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const status = e.code === 'timeout'
        ? 'timeout'
        : (offline ? 'offline' : 'provider_error');
      lastFailure = {
        status,
        message: e?.message || '',
        httpStatus: e?.status || null,
      };
      const hasRetryLeft = attempt < retryTimeouts.length - 1;
      if (!hasRetryLeft || status === 'offline') return lastFailure;
      _setBarcodeStatus('⏳ Servizio lento, provo di nuovo...', 'warn');
    }
  }

  return lastFailure || { status: 'provider_error' };
}

function _showBarcodeLookupFallback(barcode, outcome) {
  const actions = [
    { id: 'open-text-search', label: 'Usa ricerca testuale', tone: 'primary' },
    { id: 'restart-scan', label: 'Nuova scansione' },
  ];

  if (outcome.status === 'timeout') {
    _setBarcodeStatus(`⏳ Barcode letto: ${barcode}. Open Food Facts sta rispondendo troppo lentamente.`, 'warn');
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

  const { mealIdx } = _bcCtx;
  const domKey = typeof mealIdx === 'string' ? `extra-${mealIdx}` : `${S.day}-${mealIdx}`;
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
  _bcProductCache[item.barcode] = { ...item };
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
  document.getElementById('bc-product-name').textContent = _bcItem.name;
  document.getElementById('bc-product-meta').textContent =
    (_bcItem.brand ? _bcItem.brand + ' · ' : '') +
    (_bcItem.quantity ? _bcItem.quantity + ' · ' : '') +
    _bcItem.kcal100 + ' kcal · P ' + _bcItem.p100 + 'g · C ' + _bcItem.c100 + 'g · G ' + _bcItem.f100 + 'g per 100g';
  _setBarcodeStatus('✅ Prodotto trovato!', 'success');
  _renderBarcodeActions([]);
  const gi = document.getElementById('bc-gram-input');
  const gc = document.getElementById('bc-gram-calc');
  gi.value = 100;
  gc.textContent = '= ' + _bcItem.kcal100 + ' kcal';
  gi.oninput = () => { gc.textContent = '= ' + Math.round(_bcItem.kcal100 * (+gi.value || 0) / 100) + ' kcal'; };
  document.getElementById('bc-result').style.display = 'block';
  if (_bcStream) {
    _bcStream.getTracks().forEach(t => t.stop());
    _bcStream = null;
  }
  gi.focus();
}

function openBarcode(dateKey, mealIdx) {
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
  startBcCamera();
}

async function startBcCamera() {
  try {
    _bcStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    const v = document.getElementById('bc-video');
    v.srcObject = _bcStream;
    await v.play();
    _bcScanning = true;
    scanBarcode();
  } catch(e) {
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
  const cleanBarcode = _sanitizeBarcode(barcode);
  if (!cleanBarcode) return;
  _bcLastDetectedCode = cleanBarcode;
  if (_bcResolvedCode === cleanBarcode && _bcItem) {
    showBcResult();
    return;
  }

  _bcScanning = false;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
  }

  const cached = _bcProductCache[cleanBarcode];
  if (cached && !opts.skipCache) {
    _bcResolvedCode = cleanBarcode;
    _bcItem = { ...cached };
    _setBarcodeStatus('⚡ Prodotto riconosciuto dalla cache', 'success');
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
    if (!S.foodLog[dateKey]) S.foodLog[dateKey] = {};
    if (!S.foodLog[dateKey][mealIdx]) S.foodLog[dateKey][mealIdx] = [];
    S.foodLog[dateKey][mealIdx].push(item);
    syncLoggedMealState(dateKey, mealIdx, S.day);
    save();
    closeBarcode();
    toast('✅  ' + item.name + ' aggiunto');
    refreshMealCard(S.day, mealIdx);
    requestAnimationFrame(() => {
      if (typeof scrollMealCardIntoView === 'function') {
        scrollMealCardIntoView(S.day, mealIdx, { behavior: 'smooth', focusAdd: true });
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
