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

async function loadPreviewState() {
  if (!existsSync(previewStatePath)) return null;
  const raw = await readFile(previewStatePath, 'utf8');
  return JSON.parse(raw);
}

async function dismissEntryOverlays(page) {
  await page.evaluate(() => {
    if (window.S) {
      S.authEntryCompleted = true;
      S.onboardingCompleted = true;
    }
    if (typeof closeAuthEntry === 'function') closeAuthEntry();
    if (typeof closeWelcomeOnboarding === 'function') closeWelcomeOnboarding();
  });
}

async function capturePage(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#view-today.active');
  await page.waitForSelector('#macro-strip');
  await dismissEntryOverlays(page);
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: true,
  });
}

async function captureEveningSummary(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#view-today.active');
  await page.waitForSelector('#macro-strip');
  await dismissEntryOverlays(page);
  await page.evaluate(() => {
    const evening = new Date();
    evening.setHours(20, 35, 0, 0);
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
      { id: 'preview-summary-creatina', name: 'Creatina', dose: '5 g', when: 'sera', active: true },
      { id: 'preview-summary-magnesio', name: 'Magnesio', dose: '200 mg', when: 'sera', active: true },
    ];
    S.suppChecked[dateKey] = ['preview-summary-creatina'];
    syncDoneByDate(dateKey, dayType);
    save();
    renderToday();
    if (document.getElementById('today-greeting') && typeof renderGreeting === 'function') {
      renderGreeting(dayType, evening);
    }
  });
  await page.waitForSelector('#macro-strip');
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

  if (previewState) {
    await context.addInitScript((state) => {
      window.localStorage.setItem('piano_federico_v2', JSON.stringify(state));
    }, previewState);
  }

  const page = await context.newPage();
  await capturePage(page, 'today-desktop.png', { width: 1440, height: 1600 });
  await capturePage(page, 'today-mobile.png', { width: 430, height: 1400 });
  await captureEveningSummary(page, 'today-evening-summary-mobile.png', { width: 430, height: 1400 });
  await browser.close();

  console.log(path.join(outDir, 'today-desktop.png'));
  console.log(path.join(outDir, 'today-mobile.png'));
  console.log(path.join(outDir, 'today-evening-summary-mobile.png'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
