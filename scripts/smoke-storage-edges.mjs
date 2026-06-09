import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, '.codex-previews');
const baseUrl = `file://${path.join(rootDir, 'index.html')}`;
const storageKey = 'piano_federico_v2';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openWithStorage(context, value) {
  await context.addInitScript(({ key, raw }) => {
    window.lucide = window.lucide || { createIcons() {} };
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  }, { key: storageKey, raw: value });
}

async function waitForStableLocalState(page, key) {
  await page.waitForFunction((storageKey) => window.localStorage.getItem(storageKey) !== null, key);
  await page.waitForTimeout(700);
}

async function disableSupabaseAndUseLocalAuth(page) {
  await page.evaluate(() => {
    window.MARCI_SUPABASE_URL = '';
    window.MARCI_SUPABASE_ANON_KEY = '';
    if (typeof authClearSupabaseConfig === 'function') authClearSupabaseConfig();
    if (typeof authSetGuestState === 'function') authSetGuestState();
    if (typeof renderAuthNav === 'function') renderAuthNav();
    if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  });
}

async function installFakeSupabase(page) {
  await page.evaluate(() => {
    const state = {
      users: {},
      session: null,
      profileRows: {},
      appStateRow: null,
      listeners: [],
      getSessionAttemptCount: 0,
      getSessionFailuresRemaining: 0,
      getSessionFailureMode: '',
      signInAttemptCount: 0,
      signInFailuresRemaining: 0,
      signInFailureMode: '',
    };
    const emit = (event, session) => {
      state.listeners.slice().forEach(cb => {
        try { cb(event, session); } catch (_) {}
      });
    };
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    window.__mfFakeSupabaseState = state;
    window.supabase = {
      createClient() {
        return {
          auth: {
            async getSession() {
              state.getSessionAttemptCount += 1;
              if (state.getSessionFailuresRemaining > 0) {
                state.getSessionFailuresRemaining -= 1;
                if (state.getSessionFailureMode === 'timeout') {
                  await wait(9500);
                } else {
                  throw new TypeError('Failed to fetch');
                }
              }
              return { data: { session: state.session }, error: null };
            },
            onAuthStateChange(cb) {
              state.listeners.push(cb);
              return {
                data: {
                  subscription: {
                    unsubscribe() {
                      state.listeners = state.listeners.filter(fn => fn !== cb);
                    },
                  },
                },
              };
            },
            async signUp({ email, password, options }) {
              if (state.users[email]) {
                return { data: {}, error: { message: 'Utente gia presente' } };
              }
              const user = {
                id: `fake_${Object.keys(state.users).length + 1}`,
                email,
                user_metadata: { name: options?.data?.name || email.split('@')[0] },
              };
              state.users[email] = { user, password };
              state.session = { user };
              emit('SIGNED_IN', state.session);
              return { data: { user, session: state.session }, error: null };
            },
            async signInWithPassword({ email, password }) {
              state.signInAttemptCount += 1;
              if (state.signInFailuresRemaining > 0) {
                state.signInFailuresRemaining -= 1;
                if (state.signInFailureMode === 'timeout') {
                  await wait(12500);
                } else {
                  throw new TypeError('Failed to fetch');
                }
              }
              const record = state.users[email];
              if (!record || record.password !== password) {
                return { data: {}, error: { message: 'Credenziali non valide' } };
              }
              state.session = { user: record.user };
              emit('SIGNED_IN', state.session);
              return { data: { user: record.user, session: state.session }, error: null };
            },
            async setSession({ access_token, refresh_token }) {
              const sessionUser = state.session?.user || Object.values(state.users)[0]?.user || null;
              if (!access_token || !refresh_token || !sessionUser) {
                return { data: { session: null, user: null }, error: { message: 'Sessione fake non valida' } };
              }
              state.session = {
                access_token,
                refresh_token,
                user: sessionUser,
              };
              emit('SIGNED_IN', state.session);
              return { data: { session: state.session, user: sessionUser }, error: null };
            },
            async signOut() {
              state.session = null;
              emit('SIGNED_OUT', null);
              return { error: null };
            },
            async resetPasswordForEmail() {
              return { error: null };
            },
          },
          from(table) {
            if (table === 'profiles') {
              return {
                async upsert(payload) {
                  state.profileRows[payload.user_id] = { ...payload };
                  return { error: null };
                },
              };
            }
            if (table === 'app_state') {
              return {
                select() {
                  return {
                    eq() {
                      return {
                        async maybeSingle() {
                          return { data: state.appStateRow, error: null };
                        },
                      };
                    },
                  };
                },
                async upsert(payload) {
                  state.appStateRow = {
                    user_id: payload.user_id,
                    state_json: payload.state_json,
                    updated_at: payload.updated_at,
                    state_version: payload.state_version,
                  };
                  return { error: null };
                },
              };
            }
            return {
              async upsert() {
                return { error: null };
              },
            };
          },
        };
      },
    };
    window.MARCI_SUPABASE_URL = 'https://fake.supabase.co';
    window.MARCI_SUPABASE_ANON_KEY = 'fake-anon-key';
    if (typeof authConfigureSupabase === 'function') {
      authConfigureSupabase('https://fake.supabase.co', 'fake-anon-key');
    }
    if (typeof authSetGuestState === 'function') authSetGuestState();
    if (typeof renderAuthNav === 'function') renderAuthNav();
    if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
  });
}

async function verifyCorruptedLocalStorage(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, '{"broken":');
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await page.waitForSelector('#day-modal-ov');

  const modalTitle = (await page.locator('#day-modal-title').textContent())?.trim() || '';
  const toastText = (await page.locator('#tm').textContent())?.trim() || '';
  assert(modalTitle.includes('Non siamo riusciti ad aprire i tuoi dati'), 'Storage corrotto: modal di recupero non mostrata');
  assert(toastText.includes('Apertura dati da controllare'), 'Storage corrotto: toast di avviso non mostrato');
  await context.close();
}

async function verifyInvalidImport(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, null);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);
  const beforeRaw = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);

  const invalidPath = path.join(outDir, 'invalid-import.json');
  await writeFile(invalidPath, JSON.stringify({ meals: 'bad-structure' }, null, 2), 'utf8');

  await page.evaluate(() => window.goView('profilo'));
  await page.waitForSelector('#view-profilo.active');
  await page.locator('#fi').setInputFiles(invalidPath);
  await page.waitForTimeout(300);

  const storedRaw = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  const toastText = (await page.locator('#tm').textContent())?.trim() || '';
  assert(storedRaw === beforeRaw, 'Import non valido: lo stato salvato non doveva cambiare');
  assert(toastText.includes('Questa copia non sembra valida'), 'Import non valido: toast di errore non mostrato');
  await context.close();
}

async function verifyInvalidStructuredImport(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, null);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);
  const beforeRaw = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);

  const invalidPath = path.join(outDir, 'invalid-structured-import.json');
  await writeFile(invalidPath, JSON.stringify({ macro: 'bad-structure' }, null, 2), 'utf8');

  await page.evaluate(() => window.goView('profilo'));
  await page.waitForSelector('#view-profilo.active');
  await page.locator('#fi').setInputFiles(invalidPath);
  await page.waitForTimeout(300);

  const storedRaw = await page.evaluate((key) => window.localStorage.getItem(key), storageKey);
  const toastText = (await page.locator('#tm').textContent())?.trim() || '';
  assert(storedRaw === beforeRaw, 'Import strutturalmente invalido: lo stato salvato non doveva cambiare');
  assert(toastText.includes('Questa copia non sembra valida'), 'Import strutturalmente invalido: toast di errore non mostrato');
  await context.close();
}

function makeLocalSeed(name, extra = {}) {
  return {
    day: 'on',
    planTab: 'on',
    authEntryCompleted: true,
    onboardingCompleted: true,
    onboardingVersion: 1,
    anagrafica: {
      nome: name,
      sesso: 'm',
      eta: 34,
      altezza: 178,
      peso: 80.2,
      passiGiornalieri: 9000,
      grassoCorporeo: null,
      professione: 'desk_sedentary',
      allenamentiSett: '3-4',
    },
    goal: { phase: 'bulk', startDate: '2026-06-08', targetWeight: 84, notes: '', calibrationOffsetKcal: 0, calibrationMeta: null },
    weightLog: [{ date: '2026-06-08', val: 80.2 }],
    notes: {},
    foodLog: {},
    doneByDate: {},
    water: {},
    customFoods: [],
    favoriteFoods: [],
    onDays: [1, 3, 5],
    ...extra,
  };
}

async function verifyEmptyStorageOpensLocalOnboarding(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, null);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);

  const state = await page.evaluate((key) => {
    const isVisible = (selector) => {
      const el = document.querySelector(selector);
      return !!el && getComputedStyle(el).display !== 'none';
    };
    const snapshot = window.getMarciFitStorageSnapshot();
    return {
      baseExists: !!window.localStorage.getItem(key),
      currentKey: snapshot.currentKey,
      authEntryCompleted: S.authEntryCompleted,
      onboardingCompleted: S.onboardingCompleted,
      authEntryVisible: isVisible('#auth-entry'),
      welcomeVisible: isVisible('#welcome-onboarding'),
      isAuthenticated: typeof authIsAuthenticated === 'function' ? authIsAuthenticated() : true,
      navState: document.querySelector('#nav-auth-slot .auth-nav-state')?.textContent?.trim() || '',
    };
  }, storageKey);

  assert(state.baseExists, 'Storage vuoto: il profilo locale base non e stato creato');
  assert(state.currentKey === storageKey, 'Storage vuoto: la chiave attiva deve restare quella base');
  assert(state.authEntryCompleted === true, 'Storage vuoto: accesso locale non marcato come completato');
  assert(state.onboardingCompleted !== true, 'Storage vuoto: onboarding non deve risultare completato');
  assert(state.authEntryVisible === false, 'Storage vuoto: overlay auth visibile');
  assert(state.welcomeVisible === true, 'Storage vuoto: onboarding non aperto');
  assert(state.isAuthenticated === false, 'Storage vuoto: non deve esistere una sessione account');
  assert(state.navState === 'Locale', 'Storage vuoto: nav non mostra lo stato Locale');

  await context.close();
}

async function verifyExistingLocalProfileLoads(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, JSON.stringify(makeLocalSeed('Profilo Esistente')));
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);

  const state = await page.evaluate((key) => {
    const isVisible = (selector) => {
      const el = document.querySelector(selector);
      return !!el && getComputedStyle(el).display !== 'none';
    };
    const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
    const snapshot = window.getMarciFitStorageSnapshot();
    return {
      currentKey: snapshot.currentKey,
      name: S.anagrafica?.nome || '',
      storedName: stored?.anagrafica?.nome || '',
      authEntryVisible: isVisible('#auth-entry'),
      welcomeVisible: isVisible('#welcome-onboarding'),
      navCopy: document.querySelector('#nav-auth-slot .auth-nav-copy')?.textContent?.trim() || '',
      navState: document.querySelector('#nav-auth-slot .auth-nav-state')?.textContent?.trim() || '',
      profileTitle: document.querySelector('#profile-account-slot .local-profile-title')?.textContent?.trim() || '',
      profileScope: document.querySelector('#profile-account-slot .local-profile-sub')?.textContent?.trim() || '',
      navHtml: document.querySelector('#nav-auth-slot')?.innerHTML || '',
      errors: document.querySelector('#_err')?.textContent || '',
    };
  }, storageKey);

  assert(state.currentKey === storageKey, 'Profilo esistente: la chiave attiva deve essere base');
  assert(state.name === 'Profilo Esistente', 'Profilo esistente: nome non caricato in memoria');
  assert(state.storedName === 'Profilo Esistente', 'Profilo esistente: storage base non preservato');
  assert(state.authEntryVisible === false, 'Profilo esistente: overlay auth visibile');
  assert(state.welcomeVisible === false, 'Profilo esistente: onboarding aperto nonostante profilo configurato');
  assert(state.navCopy === 'Profilo Esistente', `Profilo esistente: nav non mostra il nome (${JSON.stringify(state)})`);
  assert(state.navState === 'Locale', 'Profilo esistente: nav non mostra Locale');
  assert(state.profileTitle === 'Profilo Esistente', 'Profilo esistente: card profilo non aggiornata');

  await context.close();
}

async function verifyLegacyAccountCacheMigratesToBase(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await context.addInitScript(({ key, legacyKey, raw }) => {
    window.lucide = window.lucide || { createIcons() {} };
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(`${key}__mirror`);
    window.localStorage.removeItem(`${key}__snapshots`);
    window.localStorage.setItem(legacyKey, raw);
  }, {
    key: storageKey,
    legacyKey: `${storageKey}__acct_legacy`,
    raw: JSON.stringify(makeLocalSeed('Legacy Locale', {
      customFoods: [{ name: 'Pane test', kcal100: 250, p100: 8, c100: 48, f100: 2 }],
      _localSavedAt: '2026-06-08T10:00:00.000Z',
    })),
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);

  const result = await page.evaluate(({ key, legacyKey }) => {
    const baseRaw = window.localStorage.getItem(key);
    const legacyRaw = window.localStorage.getItem(legacyKey);
    const mirrorRaw = window.localStorage.getItem(`${key}__mirror`);
    const snapshotsRaw = window.localStorage.getItem(`${key}__snapshots`);
    const base = JSON.parse(baseRaw || '{}');
    return {
      currentKey: window.getMarciFitStorageSnapshot().currentKey,
      name: S.anagrafica?.nome || '',
      baseName: base?.anagrafica?.nome || '',
      migratedFrom: base?._localMigratedFrom || '',
      oldStillExists: !!legacyRaw,
      mirrorName: JSON.parse(mirrorRaw || '{}')?.anagrafica?.nome || '',
      snapshotsCount: JSON.parse(snapshotsRaw || '[]').length,
      customFoods: Array.isArray(S.customFoods) ? S.customFoods.length : 0,
    };
  }, { key: storageKey, legacyKey: `${storageKey}__acct_legacy` });

  assert(result.currentKey === storageKey, 'Migrazione legacy: la chiave attiva deve essere base');
  assert(result.name === 'Legacy Locale', 'Migrazione legacy: profilo non visibile in memoria');
  assert(result.baseName === 'Legacy Locale', 'Migrazione legacy: cache account non copiata nello storage base');
  assert(result.migratedFrom.endsWith('__acct_legacy'), 'Migrazione legacy: sorgente migrazione non tracciata');
  assert(result.oldStillExists === true, 'Migrazione legacy: la vecchia cache account non deve essere cancellata');
  assert(result.mirrorName === 'Legacy Locale', 'Migrazione legacy: mirror locale non aggiornato');
  assert(result.snapshotsCount > 0, 'Migrazione legacy: snapshot locale non creato');
  assert(result.customFoods === 1, 'Migrazione legacy: dati extra non preservati');

  await context.close();
}

async function verifyImportTargetsBaseLocalProfile(browser) {
  const context = await browser.newContext({ locale: 'it-IT', colorScheme: 'light', acceptDownloads: true });
  await openWithStorage(context, JSON.stringify(makeLocalSeed('Local Seed')));
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#view-today.active');
  await waitForStableLocalState(page, storageKey);

  const importState = await page.evaluate(() => JSON.parse(JSON.stringify(S)));
  importState.anagrafica.nome = 'Import Locale';
  importState.anagrafica.peso = 79.4;
  importState.authEntryCompleted = true;
  importState.onboardingCompleted = true;
  const importPath = path.join(outDir, 'auth-import.json');
  await writeFile(importPath, JSON.stringify(importState, null, 2), 'utf8');

  await page.evaluate(() => window.goView('profilo'));
  await page.waitForSelector('#view-profilo.active');
  await page.locator('#fi').setInputFiles(importPath);
  await page.waitForFunction(() => window.S?.anagrafica?.nome === 'Import Locale');

  const importedState = await page.evaluate(() => {
    const snapshot = window.getMarciFitStorageSnapshot();
    const baseRaw = window.localStorage.getItem('piano_federico_v2');
    return {
      currentKey: snapshot.currentKey,
      baseName: JSON.parse(baseRaw || '{}')?.anagrafica?.nome || '',
      toastText: document.getElementById('tm')?.textContent?.trim() || '',
    };
  });

  assert(importedState.currentKey === storageKey, 'Import locale: storage key attiva non e base');
  assert(importedState.baseName === 'Import Locale', 'Import locale: i dati importati non sono finiti nello storage base');
  assert(importedState.toastText.includes('Dati importati'), 'Import locale: toast di conferma non mostrato');

  await context.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await verifyCorruptedLocalStorage(browser);
    await verifyInvalidImport(browser);
    await verifyInvalidStructuredImport(browser);
    await verifyEmptyStorageOpensLocalOnboarding(browser);
    await verifyExistingLocalProfileLoads(browser);
    await verifyLegacyAccountCacheMigratesToBase(browser);
    await verifyImportTargetsBaseLocalProfile(browser);
    console.log('smoke-storage-edges ok');
  } catch (err) {
    const failurePath = path.join(outDir, 'smoke-storage-edges-failure.txt');
    await writeFile(failurePath, String(err?.stack || err), 'utf8').catch(() => {});
    console.error(`smoke-storage-edges failed: ${err.message}`);
    console.error(`failure log: ${failurePath}`);
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
