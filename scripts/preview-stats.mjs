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

function buildStatsPreviewState() {
  const doneByDate = {};
  const water = {};
  const suppChecked = {};
  const foodLog = {};
  const start = new Date('2026-01-25T12:00:00');
  const scheduleOn = new Set([1, 3, 5]);

  for (let i = 0; i < 56; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const type = scheduleOn.has(dow) ? 'on' : 'off';
    const weekend = dow === 0 || dow === 6;
    const full = i % 5 !== 0 && (!weekend || i % 4 !== 0);
    const partial = !full && i % 3 === 0;
    const mealTotal = type === 'on' ? 4 : 3;
    const mealDone = full ? mealTotal : partial ? Math.max(1, mealTotal - 1) : 0;
    const suppDone = full || i % 6 === 0 ? 1 : 0;
    const waterCount = full ? 6 : partial ? 3 : i % 7 === 0 ? 1 : 0;
    const activityCount = (mealDone > 0 ? 1 : 0) + (suppDone > 0 ? 1 : 0) + (waterCount > 0 ? 1 : 0);

    if (mealDone > 0 || suppDone > 0 || waterCount > 0) {
      doneByDate[key] = {
        done: mealDone,
        total: mealTotal,
        type,
        mealDone,
        extraDone: 0,
        suppDone,
        waterCount,
        activityCount,
        hasActivity: activityCount > 0,
        hasTypeOverride: false,
      };
    }
    water[key] = waterCount;
    suppChecked[key] = suppDone ? ['creatina'] : [];
    if (mealDone > 0) {
      foodLog[key] = {};
      for (let mealIndex = 0; mealIndex < mealDone; mealIndex++) {
        foodLog[key][mealIndex] = [{
          name: `Meal ${mealIndex + 1}`,
          brand: '',
          grams: 100,
          kcal100: 150,
          p100: 12,
          c100: 15,
          f100: 5,
        }];
      }
    }
  }

  return {
    day: 'on',
    planTab: 'on',
    statsRange: '30d',
    onDays: [1, 3, 5],
    goal: {
      phase: 'cut',
      startDate: '2026-01-20',
      targetWeight: 61.5,
      notes: '',
    },
    doneByDate,
    water,
    suppChecked,
    foodLog,
    weightLog: [
      { date: '28/01/2026', val: 64.8 },
      { date: '01/02/2026', val: 64.4 },
      { date: '05/02/2026', val: 64.2 },
      { date: '09/02/2026', val: 63.9 },
      { date: '13/02/2026', val: 63.8 },
      { date: '18/02/2026', val: 63.6 },
      { date: '22/02/2026', val: 63.4 },
      { date: '27/02/2026', val: 63.3 },
      { date: '03/03/2026', val: 63.1 },
      { date: '08/03/2026', val: 62.9 },
      { date: '12/03/2026', val: 62.8 },
      { date: '16/03/2026', val: 62.6 },
      { date: '20/03/2026', val: 62.4 },
    ],
    measurements: [
      { date: '2026-02-01', peso: 64.4, vita: 83.5, fianchi: 95.5, petto: 99.5, braccio: 32.0, coscia: 56.0 },
      { date: '2026-02-15', peso: 63.8, vita: 82.7, fianchi: 95.0, petto: 99.2, braccio: 32.0, coscia: 55.8 },
      { date: '2026-03-01', peso: 63.3, vita: 81.9, fianchi: 94.6, petto: 99.0, braccio: 31.9, coscia: 55.5 },
      { date: '2026-03-18', peso: 62.6, vita: 80.8, fianchi: 94.1, petto: 98.8, braccio: 31.8, coscia: 55.1 },
    ],
    supplements: [
      { id: 'creatina', name: 'Creatina Creapure', dose: '3 g', when: 'mattina', active: true },
      { id: 'omega3', name: 'Omega 3', dose: '2 cps', when: 'cena', active: true },
    ],
  };
}

async function loadPreviewState() {
  if (!existsSync(previewStatePath)) return buildStatsPreviewState();
  const raw = await readFile(previewStatePath, 'utf8');
  return JSON.parse(raw);
}

async function captureStats(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.goView === 'function');
  await page.evaluate(() => window.goView('stats'));
  await page.waitForSelector('#view-stats.active');
  await page.waitForSelector('#stats-summary .stats-hero');
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: true,
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const previewState = await loadPreviewState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'it-IT',
    colorScheme: 'light',
  });

  await context.addInitScript((state) => {
    window.localStorage.setItem('piano_federico_v2', JSON.stringify(state));
  }, previewState);

  const page = await context.newPage();
  await captureStats(page, 'stats-desktop.png', { width: 1440, height: 1800 });
  await captureStats(page, 'stats-mobile.png', { width: 430, height: 1800 });
  await browser.close();

  console.log(path.join(outDir, 'stats-desktop.png'));
  console.log(path.join(outDir, 'stats-mobile.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
