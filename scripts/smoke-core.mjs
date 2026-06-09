import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, '.codex-previews');
const baseUrl = `file://${path.join(rootDir, 'index.html')}`;
const previewStatePath = path.join(rootDir, 'preview-state.json');
const storageKey = 'piano_federico_v2';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPreviewState() {
  if (!existsSync(previewStatePath)) return null;
  const raw = await readFile(previewStatePath, 'utf8');
  return JSON.parse(raw);
}

async function installStableGlobals(context, previewState) {
  await context.addInitScript(({ state, key }) => {
    window.lucide = window.lucide || { createIcons() {} };
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
  }, { state: previewState, key: storageKey });
}

async function openApp(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.initAll === 'function' && typeof window.goView === 'function');
  await page.waitForSelector('#view-today.active');
  await page.waitForSelector('#macro-strip');
}

async function verifyBootstrap(page) {
  const errText = await page.locator('#_err').textContent().catch(() => null);
  assert(!errText, `Bootstrap error overlay presente: ${errText}`);

  const todayActive = await page.locator('#view-today.active').count();
  assert(todayActive === 1, 'La view Today non e attiva al bootstrap');

  const macroStripText = (await page.locator('#macro-strip').textContent())?.trim() || '';
  assert(macroStripText.length > 0, 'Il riepilogo macro di Today non e stato renderizzato');
}

async function verifyLocalProfileAccessUi(page) {
  await page.evaluate(() => {
    closeWelcomeOnboarding?.();
    if (window.S) {
      S.authEntryCompleted = true;
    }
  });

  const navState = await page.evaluate(() => {
    const authEntry = document.getElementById('auth-entry');
    const nav = document.querySelector('#nav-auth-slot .local-profile-nav-chip');
    return {
      authEntryVisible: !!authEntry && getComputedStyle(authEntry).display !== 'none',
      navVisible: !!nav,
      navText: nav?.textContent?.replace(/\s+/g, ' ').trim() || '',
      hasLegacyButton: !!document.querySelector('.auth-entry-btn.primary'),
    };
  });

  assert(navState.authEntryVisible === false, 'Profilo locale: overlay accesso visibile al bootstrap');
  assert(navState.navVisible, 'Profilo locale: chip nav non renderizzata');
  assert(navState.navText.includes('Locale'), 'Profilo locale: stato Locale assente dalla nav');
  assert(navState.hasLegacyButton === false, 'Profilo locale: bottone login legacy presente nel DOM');

  await page.evaluate(() => {
    window.goView('profilo');
    window.openProfileSection?.('account');
  });
  await page.waitForSelector('#view-profilo.active');
  await page.waitForSelector('#profile-account-slot .local-profile-panel');

  const panelState = await page.evaluate(() => ({
    title: document.querySelector('#profile-account-slot .local-profile-title')?.textContent?.trim() || '',
    sub: document.querySelector('#profile-account-slot .local-profile-sub')?.textContent?.trim() || '',
    actionCount: document.querySelectorAll('#profile-account-slot .local-profile-action').length,
    text: document.querySelector('#profile-account-slot')?.textContent || '',
  }));

  assert(panelState.title.length > 0, 'Profilo locale: titolo pannello assente');
  assert(panelState.sub.includes('Salvato su questo dispositivo'), 'Profilo locale: testo salvataggio locale assente');
  assert(panelState.actionCount >= 3, 'Profilo locale: azioni dati/export/import mancanti');
  assert(!/password|email|logout|cloud|account/i.test(panelState.text), 'Profilo locale: testo legacy account visibile nel pannello prodotto');

  await page.evaluate(() => {
    closeWelcomeOnboarding?.();
    window.goView('today');
  });
  await page.waitForSelector('#view-today.active');
}

async function verifyTabs(page) {
  const checks = [
    { view: 'piano', selector: '#view-piano.active', content: '#tmpl-list .tmpl-card:visible' },
    { view: 'stats', selector: '#view-stats.active', content: '#stats-summary .stats-hero' },
    { view: 'profilo', selector: '#view-profilo.active', content: '#prof-card #anag-nome' },
    { view: 'today', selector: '#view-today.active', content: '#current-meal-focus .current-meal-primary:visible' },
  ];

  for (const check of checks) {
    await page.evaluate((view) => window.goView(view), check.view);
    if (check.view === 'piano') {
      await page.evaluate(() => window.setPianoSubView?.('templates'));
    }
    if (check.view === 'profilo') {
      await page.evaluate(() => window.openProfileSection?.('anagrafica'));
    }
    await page.waitForSelector(check.selector);
    await page.waitForSelector(check.content);
  }
}

async function verifySupplementsFlow(page) {
  await page.evaluate(() => {
    closeDayModal?.();
    S.selDate = null;
    S.supplements = [];
    S.suppChecked = {};
    save();
    window.goView('today');
    renderSuppToday();
  });
  await page.waitForSelector('#view-today.active');
  await page.waitForSelector('#supp-today .supp-today-add-card');

  const beforeSuppCount = await page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
    return stored?.supplements?.length || 0;
  }, storageKey);

  await page.evaluate(() => {
    document.querySelector('#supp-today .supp-today-add-card')?.click();
  });
  await page.waitForSelector('#supp-form-today', { state: 'visible' });
  await page.evaluate(() => {
    const form = document.querySelector('#day-modal-card.supplement-add-modal #supp-form-today');
    const name = form?.querySelector('#sf-name-today');
    const dose = form?.querySelector('#sf-dose-today');
    const when = form?.querySelector('#sf-when-today');
    if (name) {
      name.value = 'Smoke integratore';
      name.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (dose) {
      dose.value = '1';
      dose.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (when) {
      when.value = 'sera';
      when.dispatchEvent(new Event('change', { bubbles: true }));
    }
    form?.querySelector('.supp-form-btn-primary')?.click();
  });
  await page.waitForTimeout(250);

  const afterSuppCount = await page.evaluate((key) => {
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
    return stored?.supplements?.length || 0;
  }, storageKey);
  assert(afterSuppCount === beforeSuppCount + 1, 'Today: aggiunta integratore non persistita');

  const selectedDateDoneCount = await page.evaluate(() => {
    const selectedDate = '2026-03-15';
    const activeSupp = S.supplements.find(s => s.active);
    if (!activeSupp) return 0;
    S.selDate = selectedDate;
    S.suppChecked = {
      [window.localDate()]: [],
      [selectedDate]: [activeSupp.id],
    };
    renderSuppToday();
    return document.querySelectorAll('#supp-today .supp-today-btn.done').length;
  });
  assert(selectedDateDoneCount >= 1, 'Today: routine integratori non rispetta la data selezionata');
}

async function verifyEditLogPreview(page) {
  await page.evaluate((key) => {
    const todayKey = window.localDate();
    S.selDate = null;
    if (!S.foodLog[todayKey]) S.foodLog[todayKey] = {};
    S.foodLog[todayKey][0] = [{
      name: 'Smoke alimento',
      brand: '',
      grams: 100,
      kcal100: 200,
      p100: 10,
      c100: 20,
      f100: 5,
    }];
    syncLoggedMealState(todayKey, 0, S.day);
    save();
    renderTodayLog();
  }, storageKey);

  await page.evaluate(() => window.goView('today'));
  await page.waitForSelector('#view-today.active');
  await page.evaluate(() => {
    document.querySelector('.fir-edit')?.click();
  });
  await page.waitForSelector('#edit-gram-inp');
  await page.fill('#edit-gram-inp', '150');
  await page.waitForTimeout(150);

  const calcText = (await page.locator('#edit-gram-calc').textContent())?.trim() || '';
  assert(calcText.includes('300 kcal'), 'Edit grammatura: preview kcal non aggiornata');

  await page.evaluate(() => {
    document.querySelector('#day-modal-confirm')?.click();
  });
  await page.waitForTimeout(250);
}

async function verifyBarcodeFallback(page) {
  await page.evaluate(() => {
    S.selDate = null;
    window.goView('today');
    renderTodayLog();

    const denyCamera = async () => {
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      throw err;
    };

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: denyCamera },
      });
    } else {
      navigator.mediaDevices.getUserMedia = denyCamera;
    }
  });

  await page.waitForSelector('#view-today.active');
  const domKey = await page.evaluate(() => `${resolveDayTypeForDate(window.localDate())}-0`);
  await page.evaluate(() => openBarcode(window.localDate(), 0));
  await page.waitForTimeout(420);

  const barcodeStatus = (await page.locator('#bc-status').textContent())?.trim() || '';
  assert(barcodeStatus.includes('Permesso fotocamera negato'), 'Barcode: messaggio permessi camera non mostrato');

  const actionText = (await page.locator('#bc-actions button').textContent())?.trim() || '';
  assert(actionText.includes('Usa ricerca testuale'), 'Barcode: fallback testuale non disponibile dopo errore camera');

  await page.evaluate(() => {
    document.querySelector('#bc-actions button')?.click();
  });
  await page.waitForTimeout(250);

  const fallbackState = await page.evaluate((resolvedDomKey) => {
    const sheet = document.getElementById('food-search-sheet-ov');
    const input = document.getElementById(`mlsi-${resolvedDomKey}`);
    return {
      visible: !!sheet && sheet.classList.contains('open'),
      focused: !!input && document.activeElement === input,
    };
  }, domKey);
  assert(fallbackState.visible, 'Barcode: la ricerca testuale non si apre sul pasto corrente');
  assert(fallbackState.focused, 'Barcode: il focus non va sull input della ricerca testuale');

  await page.evaluate(() => {
    closeLogSearch?.();
  });
  await page.waitForTimeout(300);
}

async function verifyCheatMealFlow(page) {
  await page.evaluate(() => {
    S.cheatMealsByDate = {};
    S.cheatConfig = {
      enabled: true,
      weeklyMax: 2,
      hardMax: 3,
      defaultMode: 'surplus_pct',
      surplusPct: 12,
      fixedKcal: 350,
    };
    S.selDate = null;
    window.goView('today');
    renderToday();
  });
  const autoState = await page.evaluate((key) => {
    const todayKey = window.localDate();
    const dayType = S.day;
    const target = S.macro?.[dayType]?.k || 0;
    S.foodLog[todayKey] = {
      0: [{
        name: 'Smoke sgarro auto',
        brand: '',
        grams: 100,
        kcal100: target + 260,
        p100: 0,
        c100: 0,
        f100: 0,
      }],
    };
    save();
    renderToday();
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
    return {
      extraKcal: stored?.cheatMealsByDate?.[todayKey]?.extraKcal || 0,
      dotCount: document.querySelectorAll('#week-cal .wc-marker-cheat').length,
      macroText: document.querySelector('#macro-strip .ms-kcal-target')?.textContent || '',
      widgetVisible: getComputedStyle(document.getElementById('cheat-widget')).display !== 'none',
      widgetText: document.getElementById('cheat-widget')?.textContent || '',
    };
  }, storageKey);
  assert(autoState.extraKcal > 0, 'Sgarro auto: extra kcal non persistite');
  assert(autoState.dotCount >= 1, 'Sgarro auto: marker rosso non presente nel calendario');
  assert(autoState.macroText.includes('sgarro'), 'Sgarro auto: target kcal effettivo non mostrato nel recap');
  assert(autoState.widgetVisible, 'Sgarro auto: card supporto non visibile dopo attivazione');
  assert(autoState.widgetText.includes('allarghiamo il margine della giornata'), 'Sgarro auto: card non indica l attivazione automatica');
  assert(autoState.widgetText.includes('E gia tutto salvato'), 'Sgarro auto: nota di tracking automatico non visibile');

  const hiddenAfterDrop = await page.evaluate((key) => {
    const todayKey = window.localDate();
    S.foodLog[todayKey] = {};
    save();
    renderToday();
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
    return {
      hasCheat: !!stored?.cheatMealsByDate?.[todayKey],
      widgetHidden: getComputedStyle(document.getElementById('cheat-widget')).display === 'none',
    };
  }, storageKey);
  assert(!hiddenAfterDrop.hasCheat, 'Sgarro auto: rimozione automatica sotto soglia non persistita');
  assert(hiddenAfterDrop.widgetHidden, 'Sgarro auto: la card supporto non si nasconde sotto soglia');

  const limitCheck = await page.evaluate(() => {
    const baseDate = new Date(`${window.localDate()}T12:00:00`);
    const dow = baseDate.getDay();
    const monOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + monOffset);

    const toKey = (offset) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + offset);
      return window.localDate(d);
    };

    const seedA = toKey(0);
    const seedB = toKey(1);
    const target = toKey(2);
    S.cheatMealsByDate = {
      [seedA]: { extraKcal: 250, label: 'Seed', source: 'test', createdAt: new Date().toISOString() },
      [seedB]: { extraKcal: 275, label: 'Seed', source: 'test', createdAt: new Date().toISOString() },
    };
    S.selDate = target;
    S.day = getScheduledDayType(target);
    S.foodLog[target] = {
      0: [{
        name: 'Smoke limite sgarro',
        brand: '',
        grams: 100,
        kcal100: (S.macro?.[S.day]?.k || 0) + 260,
        p100: 0,
        c100: 0,
        f100: 0,
      }],
    };
    save();
    renderToday();
    const before = Object.keys(S.cheatMealsByDate).length;
    renderToday();
    const after = Object.keys(S.cheatMealsByDate).length;
    return {
      before,
      after,
      hasTarget: !!S.cheatMealsByDate[target],
    };
  });
  assert(limitCheck.before === 2 && limitCheck.after === 2 && !limitCheck.hasTarget, 'Sgarro: il limite settimanale non blocca il terzo inserimento');

  await page.evaluate(() => {
    S.cheatMealsByDate = {};
    S.foodLog[window.localDate()] = {};
    S.selDate = null;
    renderToday();
    save();
  });
}

async function verifyGreetingDailySummary(page) {
  await page.evaluate(() => {
    closeDayModal?.();
  });
  await page.waitForTimeout(200);

  const preEveningState = await page.evaluate(() => {
    const beforeSummary = new Date();
    beforeSummary.setHours(18, 10, 0, 0);
    const dateKey = window.localDate(beforeSummary);
    const dayType = getScheduledDayType(dateKey);
    const meals = S.meals?.[dayType] || [];
    const cloneItems = (meal, factor = 1) => (meal?.items || []).slice(0, 2).map(item => ({
      ...item,
      grams: Math.max(1, Math.round((item.grams || 0) * factor)),
    }));
    const dinnerIndex = meals.findIndex(meal => String(meal?.name || '').toLowerCase().includes('cena'));

    S.selDate = dateKey;
    S.day = dayType;
    S.foodLog[dateKey] = {};
    if (meals[0]) S.foodLog[dateKey][0] = cloneItems(meals[0], 1);
    if (meals[1]) S.foodLog[dateKey][1] = cloneItems(meals[1], 0.85);
    if (dinnerIndex >= 0) delete S.foodLog[dateKey][dinnerIndex];
    S.water[dateKey] = 4;
    S.supplements = [{ id: 'smoke-summary-pre', name: 'Creatina', dose: '5 g', when: 'sera', active: true }];
    S.suppChecked[dateKey] = [];
    syncDoneByDate(dateKey, dayType);
    save();
    renderToday();
    renderGreeting(dayType, beforeSummary);

    return {
      hasSummary: !!document.querySelector('#today-greeting .tg-summary'),
    };
  });

  assert(!preEveningState.hasSummary, 'Greeting summary: appare prima delle 19:30 senza cena completata');

  const summaryState = await page.evaluate(() => {
    const evening = new Date();
    evening.setHours(20, 40, 0, 0);
    const dateKey = window.localDate(evening);
    const dayType = getScheduledDayType(dateKey);
    const meals = S.meals?.[dayType] || [];
    const cloneItems = (meal, factor = 1) => (meal?.items || []).slice(0, 3).map(item => ({
      ...item,
      grams: Math.max(1, Math.round((item.grams || 0) * factor)),
    }));
    const dinnerIndex = meals.findIndex(meal => String(meal?.name || '').toLowerCase().includes('cena'));

    S.selDate = dateKey;
    S.day = dayType;
    S.foodLog[dateKey] = {};
    if (meals[0]) S.foodLog[dateKey][0] = cloneItems(meals[0], 1);
    if (meals[1]) S.foodLog[dateKey][1] = cloneItems(meals[1], 0.85);
    if (dinnerIndex >= 0 && meals[dinnerIndex]) S.foodLog[dateKey][dinnerIndex] = cloneItems(meals[dinnerIndex], 0.72);
    S.water[dateKey] = 5;
    S.supplements = [
      { id: 'smoke-summary-creatina', name: 'Creatina', dose: '5 g', when: 'sera', active: true },
      { id: 'smoke-summary-magnesio', name: 'Magnesio', dose: '200 mg', when: 'sera', active: true },
    ];
    S.suppChecked[dateKey] = ['smoke-summary-creatina'];
    syncDoneByDate(dateKey, dayType);
    save();
    renderToday();
    renderGreeting(dayType, evening);

    return {
      hasSummary: !!document.querySelector('#today-greeting .tg-summary'),
      hasQuote: !!document.querySelector('#today-greeting .tg-quote'),
      metricCount: document.querySelectorAll('#today-greeting .tg-summary-metric').length,
      text: document.querySelector('#today-greeting .tg-summary')?.textContent || '',
      note: document.querySelector('#today-greeting .tg-summary-note')?.textContent || '',
    };
  });

  assert(summaryState.hasSummary, 'Greeting summary: la card serale non viene mostrata dopo la soglia');
  assert(!summaryState.hasQuote, 'Greeting summary: la quote resta visibile al posto del recap');
  assert(summaryState.metricCount >= 6, 'Greeting summary: metriche insufficienti nel recap serale');
  assert(summaryState.text.includes('Riepilogo giornata'), 'Greeting summary: kicker del recap mancante');
  assert(summaryState.text.includes('Kcal'), 'Greeting summary: metrica calorie mancante');
  assert(summaryState.text.includes('Proteine'), 'Greeting summary: metrica proteine mancante');
  assert(summaryState.text.includes('Acqua'), 'Greeting summary: metrica idratazione mancante');
  assert(summaryState.text.includes('Integratori'), 'Greeting summary: metrica integratori mancante');
  assert(summaryState.note.length > 0, 'Greeting summary: copy di coaching mancante in caso di giornata incompleta');

  await page.evaluate(() => {
    S.selDate = null;
    renderToday();
    save();
  });
}

async function verifyTemplateFlows(page) {
  await page.evaluate(() => {
    closeDayModal?.();
  });
  await page.waitForTimeout(200);

  const templateState = await page.evaluate(() => {
    S.selDate = null;
    S.templates = [{
      id: 'tmpl-smoke-snack',
      name: 'Snack smoke',
      tag: 'spuntino',
      mealType: 'spuntino',
      items: [
        { name: 'Avena', grams: 80, kcal100: 390, p100: 13, c100: 67, f100: 7 },
        { name: 'Yogurt', grams: 200, kcal100: 60, p100: 10, c100: 4, f100: 0.4 },
      ],
      usageCount: 0,
      pinned: false,
      source: 'manual',
    }];
    const todayKey = window.localDate();
    if (!S.extraMealsActive[todayKey]) S.extraMealsActive[todayKey] = {};
    S.extraMealsActive[todayKey].spuntino = true;
    S.foodLog[todayKey] = {};
    save();
    window.goView('today');
    renderTodayLog();
    const targets = typeof getTemplateLoadTargets === 'function'
      ? getTemplateLoadTargets(S.templates[0], S.day).map(t => t.label)
      : [];
    return {
      targets,
      initialGrams: S.templates[0].items[0].grams,
    };
  });
  assert(templateState.targets.includes('Spuntino'), 'Template snack: target Spuntino non disponibile');

  await page.evaluate(() => {
    window.__originalPrompt = window.prompt;
    window.prompt = () => '6';
    window.__originalConfirm = window.confirm;
    window.confirm = () => true;
  });
  await page.evaluate(() => { void loadTemplateToLog('tmpl-smoke-snack'); });
  await page.waitForSelector('.template-target-modal');
  const selectedTarget = await page.evaluate(() => {
    const targets = typeof getTemplateLoadTargets === 'function'
      ? getTemplateLoadTargets(S.templates.find(t => t.id === 'tmpl-smoke-snack'), S.day)
      : [];
    const index = targets.findIndex(target => target?.isExtra && target?.key === 'spuntino');
    window.__smokeTemplateTargetKey = targets[index]?.key || 'spuntino';
    if (index >= 0) selectTemplateLoadTarget(index);
    return { index, key: targets[index]?.key || null, label: targets[index]?.label || '' };
  });
  assert(selectedTarget.index >= 0, 'Template target: Spuntino non trovato nel modal');
  await page.waitForSelector('.template-portion-modal');
  await page.evaluate(() => selectTemplatePortion(0.5));
  await page.waitForTimeout(250);

  const portionState = await page.evaluate(() => {
    const todayKey = window.localDate();
    const targetKey = window.__smokeTemplateTargetKey || 'spuntino';
    const logItems = S.foodLog?.[todayKey]?.[targetKey] || [];
    return {
      targetKey,
      count: logItems.length,
      grams: logItems[0]?.grams || 0,
      usageCount: S.templates[0]?.usageCount || 0,
      logKeys: Object.keys(S.foodLog?.[todayKey] || {}),
    };
  });
  assert(portionState.count === 2, `Template porzione: il caricamento nello spuntino non ha aggiunto gli ingredienti (${JSON.stringify(portionState)})`);
  assert(portionState.grams === 40, `Template porzione: attesi 40g sulla mezza porzione, ricevuti ${portionState.grams}`);
  assert(portionState.usageCount === 1, 'Template porzione: usageCount non aggiornato');

  await page.evaluate(() => {
    window.goView('piano');
    renderPiano();
    deleteTemplate('tmpl-smoke-snack');
  });
  await page.waitForSelector('.template-delete-modal');
  await page.click('#day-modal-confirm');
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    window.prompt = window.__originalPrompt;
    window.confirm = window.__originalConfirm;
    delete window.__originalPrompt;
    delete window.__originalConfirm;
  });

  const deleteState = await page.evaluate(() => ({
    count: S.templates.length,
    pianoText: document.getElementById('tmpl-list')?.textContent || '',
  }));
  assert(deleteState.count === 0, 'Template delete: il template non e stato rimosso');
  assert(deleteState.pianoText.includes('Non hai ancora template'), 'Template delete: empty state non aggiornata dopo la rimozione');
}

async function verifyPersistence(page) {
  await page.evaluate(() => {
    closeDayModal?.();
    S.selDate = null;
    window.goView('today');
  });
  await page.waitForSelector('#view-today.active');

  const noteValue = 'Smoke note';
  await page.evaluate((value) => {
    const todayKey = window.localDate();
    S.notes[todayKey] = value;
    save();
    window.addWater(1);
  }, noteValue);

  const todayKey = await page.evaluate(() => window.localDate());
  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey);

  assert(stored?.notes?.[todayKey] === noteValue, 'La nota non e stata persistita in localStorage');
  assert((stored?.water?.[todayKey] || 0) >= 1, 'L acqua non e stata persistita in localStorage');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');

  const reloadedState = await page.evaluate(() => {
    const todayKey = window.localDate();
    return {
      note: S.notes?.[todayKey] || '',
      water: S.water?.[todayKey] || 0,
    };
  });
  assert(reloadedState.note === noteValue, 'La nota non e stata ripristinata dopo reload');
  assert(reloadedState.water >= 1, 'L acqua non e stata ripristinata dopo reload');
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const previewState = await loadPreviewState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'it-IT',
    colorScheme: 'light',
  });

  await installStableGlobals(context, previewState);
  const page = await context.newPage();

  try {
    await openApp(page);
    await verifyBootstrap(page);
    await verifyLocalProfileAccessUi(page);
    await verifyTabs(page);
    await verifySupplementsFlow(page);
    await verifyEditLogPreview(page);
    await verifyBarcodeFallback(page);
    await verifyCheatMealFlow(page);
    await verifyTemplateFlows(page);
    await verifyPersistence(page);
    console.log('smoke-core ok');
  } catch (err) {
    const failurePath = path.join(outDir, 'smoke-core-failure.png');
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    console.error(`smoke-core failed: ${err.message}`);
    console.error(`failure screenshot: ${failurePath}`);
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
