import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

function buildDefaultState() {
  return {
    day: 'on',
    planTab: 'on',
    selDate: null,
    statsRange: '30d',
    goal: { phase: 'cut', startDate: '2026-02-01', targetWeight: 61.5, notes: '' },
    templates: [
      {
        id: 'test-template-1',
        name: 'Template smoke',
        tag: 'colazione',
        mealType: 'colazione',
        items: [
          { name: 'Yogurt greco', brand: 'Fage', grams: 170, kcal100: 57, p100: 10, c100: 3.5, f100: 0.2 },
        ],
      },
    ],
    weightLog: [
      { date: '10/03/2026', val: 63.8 },
      { date: '15/03/2026', val: 63.4 },
      { date: '19/03/2026', val: 63.1 },
    ],
    measurements: [
      { date: '2026-03-05', peso: 63.9, vita: 82.5, fianchi: 95.2, petto: 99.1, braccio: 31.9, coscia: 55.8 },
      { date: '2026-03-15', peso: 63.3, vita: 81.7, fianchi: 94.8, petto: 98.9, braccio: 31.8, coscia: 55.4 },
    ],
    water: { '2026-03-20': 2 },
    notes: { '2026-03-20': 'Nota iniziale smoke dataflow' },
  };
}

async function loadPreviewState() {
  if (!existsSync(previewStatePath)) return buildDefaultState();
  const raw = await readFile(previewStatePath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    ...buildDefaultState(),
    ...parsed,
    templates: parsed.templates?.length ? parsed.templates : buildDefaultState().templates,
    weightLog: parsed.weightLog?.length ? parsed.weightLog : buildDefaultState().weightLog,
    measurements: parsed.measurements?.length ? parsed.measurements : buildDefaultState().measurements,
  };
}

async function installStableGlobals(context, previewState) {
  await context.addInitScript(({ state, key }) => {
    window.lucide = window.lucide || { createIcons() {} };
    window.scrollTo = window.scrollTo || (() => {});
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
  }, { state: previewState, key: storageKey });
}

async function openApp(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.initAll === 'function' && typeof window.goView === 'function');
  await page.waitForSelector('#view-today.active');
}

async function verifyStatsDataFlow(page) {
  await page.evaluate(() => window.goView('stats'));
  await page.waitForSelector('#view-stats.active');
  await page.waitForSelector('#stats-summary .stats-hero');

  const before = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey);
  const beforeWeightCount = before.weightLog?.length || 0;
  const beforeMeasurementCount = before.measurements?.length || 0;

  await page.getByRole('button', { name: 'Aggiungi peso' }).first().click();
  await page.waitForSelector('#stats-actions-weight-form-shell.open #w-in');
  await page.fill('#stats-actions-weight-form-shell.open #w-in', '62.7');
  await page.click('#stats-actions-weight-form-shell.open .w-btn');
  await page.waitForTimeout(250);

  const afterWeight = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey);
  assert((afterWeight.weightLog?.length || 0) === beforeWeightCount + 1, 'Stats: il peso non e stato salvato');

  await page.getByRole('button', { name: 'Nuova rilevazione' }).click();
  await page.waitForSelector('#stats-actions-measurements-form-shell.open #m-vita');
  await page.fill('#m-vita', '80.5');
  await page.fill('#m-peso', '62.6');
  await page.click('#stats-actions-measurements-entry .meas-btn');
  await page.waitForTimeout(250);

  const afterMeasurement = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey);
  assert((afterMeasurement.measurements?.length || 0) === beforeMeasurementCount + 1, 'Stats: la misurazione non e stata salvata');
  const latestWeight = afterMeasurement.weightLog?.[afterMeasurement.weightLog.length - 1];
  assert((afterMeasurement.weightLog?.length || 0) >= beforeWeightCount + 1, 'Stats: il sync peso da misurazioni non e avvenuto');
  assert(Number(latestWeight?.val) === 62.6, 'Stats: il peso finale non e stato aggiornato con la misurazione piu recente');
}

async function verifyPianoRendering(page) {
  await page.evaluate(() => window.goView('piano'));
  await page.waitForSelector('#view-piano.active');
  await page.evaluate(() => window.setPianoSubView?.('meals'));
  await page.evaluate(() => window.setPianoSubView?.('templates'));
  await page.waitForSelector('#tmpl-filters .piano-meal-filter');
  await page.waitForSelector('#tmpl-list .tmpl-card', { state: 'attached' });

  const templateCount = await page.locator('#tmpl-list .tmpl-btn-load').count();
  assert(templateCount >= 1, 'Piano: la libreria template non e stata renderizzata');
}

async function verifyExportImport(page) {
  await page.evaluate(() => window.goView('profilo'));
  await page.waitForSelector('#view-profilo.active');
  await page.evaluate(() => window.openProfileSection?.('dati'));
  await page.waitForSelector('#view-profilo.active .backup-card');

  const downloadPromise = page.waitForEvent('download');
  await page.click('.backup-card:nth-of-type(2)');
  const download = await downloadPromise;
  const exportPath = path.join(outDir, 'smoke-export.json');
  await download.saveAs(exportPath);
  const exportedRaw = await readFile(exportPath, 'utf8');
  const exported = JSON.parse(exportedRaw);
  assert(Array.isArray(exported.weightLog), 'Export JSON: weightLog mancante');

  const importState = {
    ...exported,
    notes: { '2026-03-20': 'Nota importata smoke' },
    water: { '2026-03-20': 5 },
  };
  const importPath = path.join(outDir, 'smoke-import.json');
  await writeFile(importPath, JSON.stringify(importState, null, 2), 'utf8');

  await page.locator('#fi').setInputFiles(importPath);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.goView('today'));
  await page.waitForSelector('#view-today.active');
  await page.waitForTimeout(200);

  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), storageKey);
  assert(stored?.notes?.['2026-03-20'] === 'Nota importata smoke', 'Import JSON: nota non ripristinata');
  assert(stored?.water?.['2026-03-20'] === 5, 'Import JSON: acqua non ripristinata');
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const previewState = await loadPreviewState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'it-IT',
    colorScheme: 'light',
    acceptDownloads: true,
  });

  await installStableGlobals(context, previewState);
  const page = await context.newPage();

  try {
    await openApp(page);
    await verifyStatsDataFlow(page);
    await verifyPianoRendering(page);
    await verifyExportImport(page);
    console.log('smoke-dataflow ok');
  } catch (err) {
    const failurePath = path.join(outDir, 'smoke-dataflow-failure.png');
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => {});
    console.error(`smoke-dataflow failed: ${err.message}`);
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
