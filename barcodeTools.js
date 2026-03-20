// barcodeTools.js - scanner barcode, lookup OFF e integrazione con Oggi/Template/Preferiti

let _bcCtx = null; // {dateKey, mealIdx} or null for template form
let _bcStream = null;
let _bcScanning = false;
let _bcItem = null;
let _bcMode = 'log'; // 'log' | 'ff'
let _bcLookupController = null;
let _bcResolvedCode = null;
const _bcProductCache = {};

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
      const status = document.getElementById('bc-status');
      if (status) status.textContent = 'Inquadra il codice a barre del prodotto';
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
  document.getElementById('bc-status').textContent = '✅ Prodotto trovato!';
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
  _bcScanning = false;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
    _bcLookupController = null;
  }
  const modal = document.getElementById('barcode-modal');
  const result = document.getElementById('bc-result');
  const status = document.getElementById('bc-status');
  result.style.display = 'none';
  status.textContent = 'Inquadra il codice a barre del prodotto';
  modal.style.display = 'flex';
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

    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
      let _lastCode = null;
      let _codeCount = 0;
      const CONFIRM_NEEDED = 2;
      const tick = async () => {
        if (!_bcScanning) return;
        try {
          const codes = await det.detect(v);
          if (codes.length) {
            const code = codes[0].rawValue;
            if (code === _lastCode) {
              _codeCount++;
              if (_codeCount >= CONFIRM_NEEDED) {
                _bcScanning = false;
                onBarcodeDetected(code);
                return;
              }
            } else {
              _lastCode = code;
              _codeCount = 1;
            }
          } else {
            _lastCode = null;
            _codeCount = 0;
          }
        } catch(e) {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } else if (typeof Quagga !== 'undefined') {
      const cv = document.getElementById('bc-canvas');
      let _lastCode = null;
      let _codeCount = 0;
      const CONFIRM_NEEDED = 2;
      const _quaggaConfident = (r) => {
        const codes = r?.codeResult?.decodedCodes;
        if (!codes) return false;
        const errors = codes.filter(c => c.error !== undefined);
        if (!errors.length) return true;
        const avgErr = errors.reduce((s, c) => s + c.error, 0) / errors.length;
        return avgErr < 0.25;
      };

      const scan = () => {
        if (!_bcScanning) return;
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
        }, r => {
          if (r?.codeResult?.code && _quaggaConfident(r)) {
            const code = r.codeResult.code;
            if (code === _lastCode) {
              _codeCount++;
              if (_codeCount >= CONFIRM_NEEDED) {
                _bcScanning = false;
                onBarcodeDetected(code);
                return;
              }
            } else {
              _lastCode = code;
              _codeCount = 1;
            }
          }
          if (_bcScanning) setTimeout(scan, 150);
        });
      };
      v.addEventListener('playing', scan, { once: true });
      if (v.readyState >= 3) scan();
    } else {
      document.getElementById('bc-status').textContent = '⚠️  Libreria scanner non caricata. Usa la ricerca testuale.';
    }
  } catch(e) {
    document.getElementById('bc-status').textContent =
      e.name === 'NotAllowedError'
        ? '❌  Permesso fotocamera negato. Abilitalo nelle impostazioni browser.'
        : '❌  Fotocamera non disponibile: ' + e.message;
  }
}

async function onBarcodeDetected(barcode) {
  const cleanBarcode = _sanitizeBarcode(barcode);
  if (!cleanBarcode) return;
  if (_bcResolvedCode === cleanBarcode && _bcItem) {
    showBcResult();
    return;
  }

  _bcScanning = false;
  if (_bcLookupController) {
    try { _bcLookupController.abort(); } catch(e) {}
  }

  const cached = _bcProductCache[cleanBarcode];
  if (cached) {
    _bcResolvedCode = cleanBarcode;
    _bcItem = { ...cached };
    document.getElementById('bc-status').textContent = '⚡ Prodotto riconosciuto dalla cache';
    showBcResult();
    return;
  }

  document.getElementById('bc-status').textContent = '🔍 Codice: ' + cleanBarcode + ' · Cerco su Open Food Facts...';
  let timeoutId = null;
  try {
    _bcLookupController = new AbortController();
    timeoutId = setTimeout(() => {
      try { _bcLookupController?.abort(); } catch(e) {}
    }, 5000);
    const barcodeUrl = 'https://world.openfoodfacts.org/api/v0/product/' + cleanBarcode + '.json?fields=code,product_name,product_name_it,product_name_en,generic_name,generic_name_it,brands,quantity,nutriments';
    const resp = await mfFetch(
      barcodeUrl,
      { signal: _bcLookupController.signal },
      { source: 'barcode-lookup', barcode: cleanBarcode }
    );
    clearTimeout(timeoutId);
    const data = await resp.json();
    const p = data.status === 1 ? data.product : null;
    const item = _buildFoodItemFromBarcodeProduct(p, cleanBarcode);
    if (!item) {
      document.getElementById('bc-status').textContent = '⚠️  Prodotto non trovato (' + cleanBarcode + '). Riprova o usa la ricerca.';
      _bcResolvedCode = null;
      _resumeBarcodeScanning(1400);
      return;
    }
    _bcResolvedCode = cleanBarcode;
    _bcItem = item;
    _cacheBarcodeItem(_bcItem);
    save();
    showBcResult();
  } catch(e) {
    if (e.name === 'AbortError') {
      mfWarn('barcode', 'lookup aborted', { barcode: cleanBarcode });
      document.getElementById('bc-status').textContent = '⚠️  Ricerca troppo lenta. Riprova o usa la ricerca testuale.';
      _resumeBarcodeScanning(1200);
    } else {
      mfError('barcode', 'lookup failed', { barcode: cleanBarcode, name: e?.name, message: e?.message });
      document.getElementById('bc-status').textContent = '❌  Errore di rete. Controlla la connessione.';
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    _bcLookupController = null;
  }
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
}

function openBarcodeForFf() {
  _bcMode = 'ff';
  openBarcode(null, null);
}
