// authSync.js — auth/session layer with optional Supabase provider and local fallback

const AUTH_USERS_KEY = 'marcifit_auth_users_v1';
const AUTH_SESSION_KEY = 'marcifit_auth_session_v1';
const AUTH_SUPABASE_CONFIG_KEY = 'marcifit_supabase_config_v1';
const AUTH_STATE_META_KEY = 'marcifit_state_meta_v1';
const AUTH_STATE_BACKUP_KEY = 'marcifit_state_backup_v1';
const AUTH_SYNC_DELAY_MS = 900;
const AUTH_POST_LOGOUT_MODE_KEY = 'marcifit_post_logout_mode_v1';
const AUTH_ASYNC_TIMEOUT_MS = 9000;
const AUTH_LOGIN_TIMEOUT_MS = 12000;
const AUTH_REMOTE_RETRY_ATTEMPTS = 2;
const AUTH_REMOTE_RETRY_DELAY_MS = 1400;
const AUTH_LAST_ACTIVE_ACCOUNT_KEY = 'marcifit_last_account_v1';
const AUTH_EXPLICIT_LOGOUT_KEY = 'marcifit_explicit_logout_v1';

const AUTH = {
  status: 'guest',
  provider: 'local_mock',
  user: null,
  sessionReady: false,
  isSyncing: false,
  lastSyncedAt: null,
  needsEmailConfirmation: false,
  bootstrapReady: false,
  clientContext: 'browser',
  bootstrapSource: 'unknown',
  bootstrapMessage: '',
  localRecoveryKey: null,
  localRecoveryMeta: null,
};

let _supabaseClient = null;
let _authSyncTimer = null;
let _supabaseAuthSubscription = null;

function authWithTimeout(promise, message, timeoutMs = AUTH_ASYNC_TIMEOUT_MS) {
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error(message || 'Operazione scaduta');
      err.name = 'AuthTimeoutError';
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
}

function authSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function authShouldRetryTransientError(err) {
  const message = String(err?.message || err?.cause?.message || '').toLowerCase();
  return err?.name === 'AuthTimeoutError'
    || err?.name === 'TimeoutError'
    || message.includes('failed to fetch')
    || message.includes('fetch failed')
    || message.includes('network')
    || message.includes('network request failed')
    || message.includes('fetch')
    || message.includes('load failed')
    || message.includes('timed out')
    || message.includes('timeout');
}

async function authRunWithRetry(factory, {
  attempts = 2,
  timeoutMs = AUTH_ASYNC_TIMEOUT_MS,
  timeoutMessage = 'Operazione scaduta',
  retryDelayMs = 1200,
} = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await authWithTimeout(factory(), timeoutMessage, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !authShouldRetryTransientError(err)) {
        throw err;
      }
      await authSleep(retryDelayMs);
    }
  }
  throw lastErr;
}

function authLoadUsers() {
  try {
    const raw = localStorage.getItem(AUTH_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function authSaveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users || []));
}

function authLoadSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function authSaveSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function authReadLastActiveAccount() {
  try {
    const raw = localStorage.getItem(AUTH_LAST_ACTIVE_ACCOUNT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function authRememberLastActiveAccount(user) {
  if (!user?.id) return;
  try {
    localStorage.setItem(AUTH_LAST_ACTIVE_ACCOUNT_KEY, JSON.stringify({
      userId: user.id,
      email: user.email || '',
      name: user.name || '',
      updatedAt: new Date().toISOString(),
    }));
  } catch (_) {}
}

function authSetExplicitLogout(isLoggedOut) {
  try {
    if (isLoggedOut) localStorage.setItem(AUTH_EXPLICIT_LOGOUT_KEY, '1');
    else localStorage.removeItem(AUTH_EXPLICIT_LOGOUT_KEY);
  } catch (_) {}
}

function authHasExplicitLogout() {
  try {
    return localStorage.getItem(AUTH_EXPLICIT_LOGOUT_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function authSetLocalRecovery(cache) {
  AUTH.localRecoveryKey = cache?.key || null;
  AUTH.localRecoveryMeta = cache ? {
    key: cache.key,
    userId: cache.userId || '',
    name: cache.name || '',
    email: cache.email || '',
    updatedAt: cache.updatedAt || null,
  } : null;
}

function authClearLocalRecovery() {
  authSetLocalRecovery(null);
}

function authGenerateId() {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function authValidateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function authValidatePassword(password) {
  return String(password || '').length >= 8;
}

function authIsAuthenticated() {
  return AUTH.status === 'authenticated' && !!AUTH.user?.id;
}

function authProviderLabel() {
  return AUTH.provider === 'supabase' ? 'Supabase' : 'Locale mock';
}

function authDetectClientContext() {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return 'standalone';
  } catch (_) {}
  try {
    if (window.navigator?.standalone) return 'standalone';
  } catch (_) {}
  return 'browser';
}

function authClientContextLabel(context = authDetectClientContext()) {
  return context === 'standalone' ? 'Web app Home' : 'Browser';
}

function authUpdateClientContext() {
  AUTH.clientContext = authDetectClientContext();
  return AUTH.clientContext;
}

function authSetBootstrapHint(source, message = '') {
  AUTH.bootstrapSource = source || 'unknown';
  AUTH.bootstrapMessage = String(message || '');
  authUpdateClientContext();
}

function authShowDevelopmentUi() {
  return typeof window !== 'undefined'
    && typeof window.isMarciFitDebugEnabled === 'function'
    && window.isMarciFitDebugEnabled();
}

function authDescribeBootstrapSource(source = AUTH.bootstrapSource) {
  switch (source) {
    case 'guest':
      return 'Guest';
    case 'guest_seed':
      return 'Dati guest collegati';
    case 'remote':
      return 'Cloud';
    case 'local':
      return 'Cache account';
    case 'local_resume':
      return 'Cache locale ripresa';
    case 'local_reset':
      return 'Reset locale';
    case 'empty':
      return 'Nessun dato trovato';
    case 'account_connected':
      return 'Account collegato';
    case 'awaiting_email':
      return 'Conferma email';
    case 'cloud_push':
      return 'Cloud aggiornato';
    case 'error':
      return 'Serve attenzione';
    default:
      return 'Pronto';
  }
}

function authGetBootstrapDiagnostics() {
  authUpdateClientContext();
  return {
    contextLabel: authClientContextLabel(AUTH.clientContext),
    sourceLabel: authDescribeBootstrapSource(AUTH.bootstrapSource),
    detail: AUTH.bootstrapMessage || '',
  };
}

function authReadActiveLocalStateRaw() {
  try {
    return localStorage.getItem(authGetAppStorageKey(authCurrentBaseStorageKey()));
  } catch (_) {
    return null;
  }
}

function authReadActiveLocalState() {
  return authParseRemoteState(authReadActiveLocalStateRaw());
}

function authGetStandaloneSessionNote() {
  if (authIsAuthenticated() || AUTH.clientContext !== 'standalone' || !authCanUseSupabase()) return '';
  return 'Se in Safari eri gia dentro, qui puo servirti un accesso la prima volta: la web app Home mantiene una sessione separata.';
}

function authGetAccountDiagnostics() {
  authUpdateClientContext();
  const meta = authReadStateMeta();
  const localState = authReadActiveLocalState();
  const hasMeaningfulLocal = authHasMeaningfulState(localState);
  const bootstrapDiag = authGetBootstrapDiagnostics();
  const lastSyncedAt = AUTH.lastSyncedAt || meta.lastSyncedAt || null;
  const dirty = !!meta.dirty;
  const standaloneSessionNote = authGetStandaloneSessionNote();

  let storageLabel = 'Guest locale';
  let storageTone = 'guest';
  let statusDetail = 'Stai usando i dati salvati solo su questo dispositivo.';
  let syncDetail = standaloneSessionNote || 'Le modifiche restano qui finche non colleghi un account.';
  let scopeLabel = 'Spazio guest di questo dispositivo';

  if (authIsAuthenticated() && AUTH.provider === 'supabase') {
    storageLabel = bootstrapDiag.sourceLabel === 'Cloud'
      ? 'Cloud + cache account'
      : 'Cache account';
    storageTone = bootstrapDiag.sourceLabel === 'Cloud' ? 'cloud' : 'local';
    scopeLabel = 'Cache dedicata a questo account';
    statusDetail = bootstrapDiag.sourceLabel === 'Cloud'
      ? 'Hai aperto il profilo dal cloud e ora lavori sulla cache del tuo account in questo dispositivo.'
      : 'Stai lavorando sulla cache del tuo account in questo dispositivo.';
    if (AUTH.isSyncing) {
      syncDetail = 'Stiamo allineando le ultime modifiche al cloud.';
    } else if (dirty) {
      syncDetail = 'Ci sono modifiche locali da inviare al cloud.';
    } else if (lastSyncedAt) {
      syncDetail = `Cloud allineato: ${authFormatSyncTime(lastSyncedAt)}.`;
    } else {
      syncDetail = hasMeaningfulLocal
        ? 'Account attivo: il primo sync cloud verra completato appena possibile.'
        : 'Account attivo: aspettiamo solo il primo dato da salvare.';
    }
  } else if (authIsAuthenticated()) {
    storageLabel = 'Solo locale';
    storageTone = 'local';
    scopeLabel = 'Cache dedicata a questo account';
    statusDetail = 'Questo profilo resta salvato solo su questo dispositivo.';
    syncDetail = authCanUseSupabase()
      ? 'Per ritrovarlo anche altrove, entra con email e attiva il cloud.'
      : 'Il cloud non e attivo in questo ambiente.';
  } else if (AUTH.localRecoveryKey) {
    storageLabel = 'Cache account locale';
    storageTone = 'local';
    scopeLabel = 'Cache dedicata all ultimo profilo aperto';
    statusDetail = 'Stiamo usando la copia locale ritrovata su questo dispositivo.';
    syncDetail = standaloneSessionNote || 'Per riallinearla con il cloud, accedi di nuovo al tuo account.';
  }

  return {
    isAuthenticated: authIsAuthenticated(),
    provider: AUTH.provider,
    contextLabel: bootstrapDiag.contextLabel,
    sourceLabel: bootstrapDiag.sourceLabel,
    sourceDetail: bootstrapDiag.detail || '',
    storageLabel,
    storageTone,
    statusDetail,
    syncDetail,
    scopeLabel,
    dirty,
    hasMeaningfulLocal,
    standaloneSessionNote,
    lastSyncedAt,
    lastSyncedLabel: authFormatSyncTime(lastSyncedAt),
  };
}

function authCurrentBaseStorageKey() {
  return typeof LS_KEY !== 'undefined' ? LS_KEY : 'piano_federico_v2';
}

function authGetAppStorageKey(baseKey = 'piano_federico_v2') {
  if (!authIsAuthenticated()) return AUTH.localRecoveryKey || baseKey;
  return `${baseKey}__acct_${AUTH.user.id}`;
}

function authGetStateMetaKey() {
  return authGetAppStorageKey(AUTH_STATE_META_KEY);
}

function authGetStateBackupKey() {
  return authGetAppStorageKey(AUTH_STATE_BACKUP_KEY);
}

function authReadStateMeta() {
  try {
    const raw = localStorage.getItem(authGetStateMetaKey());
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function authWriteStateMeta(meta) {
  localStorage.setItem(authGetStateMetaKey(), JSON.stringify(meta || {}));
}

function authClearLocalStateMeta() {
  localStorage.removeItem(authGetStateMetaKey());
}

function authReadStateBackups() {
  try {
    const raw = localStorage.getItem(authGetStateBackupKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function authWriteStateBackups(backups) {
  localStorage.setItem(authGetStateBackupKey(), JSON.stringify(Array.isArray(backups) ? backups : []));
}

function authCreateStateBackup(source, state, extra = {}) {
  if (!authHasMeaningfulState(state)) return false;
  try {
    const raw = JSON.stringify(state);
    const backups = authReadStateBackups();
    const latest = backups[0];
    if (latest?.raw === raw && latest?.source === source) return true;
    const next = [{
      source,
      createdAt: new Date().toISOString(),
      updatedAt: extra.updatedAt || null,
      hasMeaningfulState: true,
      raw,
    }, ...backups].slice(0, 5);
    authWriteStateBackups(next);
    return true;
  } catch (_) {
    return false;
  }
}

function authGetLatestBackupMeta() {
  const latest = authReadStateBackups()[0];
  if (!latest) return null;
  return {
    source: latest.source || 'backup',
    createdAt: latest.createdAt || null,
    updatedAt: latest.updatedAt || null,
  };
}

function authFormatBackupSource(source) {
  if (source === 'pre_cloud_sync') return 'copia automatica';
  if (source === 'remote_import') return 'copia automatica';
  return 'copia automatica';
}

function authFormatSyncTime(iso) {
  if (!iso) return 'Ancora nessun aggiornamento';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return 'Ancora nessun aggiornamento';
  }
}

function authStatusMeta() {
  if (AUTH.needsEmailConfirmation) return { label: 'Controlla email', cls: 'pending' };
  if (AUTH.isSyncing) return { label: 'Sync in corso', cls: 'syncing' };
  if (authIsAuthenticated() && AUTH.provider === 'supabase') {
    return { label: AUTH.lastSyncedAt ? 'Cloud attivo' : 'Cloud pronto', cls: 'connected' };
  }
  if (authIsAuthenticated() && AUTH.provider === 'local_mock') return { label: 'Solo locale', cls: 'local' };
  if (AUTH.localRecoveryKey) return { label: 'Ripresa locale', cls: 'local' };
  return { label: 'Guest', cls: 'guest' };
}

function authRefreshUi() {
  if (typeof renderAuthNav === 'function') renderAuthNav();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
}

function authSetBootstrapReady(isReady) {
  AUTH.bootstrapReady = !!isReady;
  if (AUTH.bootstrapReady) {
    const meta = authReadStateMeta();
    if (meta.dirty) authQueueStateSync(1200);
  }
}

function authResolveSupabaseConfig() {
  const fromWindow = {
    url: window.MARCI_SUPABASE_URL || '',
    anonKey: window.MARCI_SUPABASE_ANON_KEY || '',
  };
  if (fromWindow.url && fromWindow.anonKey) return fromWindow;
  try {
    const raw = localStorage.getItem(AUTH_SUPABASE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.url && parsed?.anonKey) return parsed;
  } catch (_) {}
  return null;
}

function authHasEmbeddedSupabaseConfig() {
  return !!(window.MARCI_SUPABASE_URL && window.MARCI_SUPABASE_ANON_KEY);
}

function authCanUseSupabase() {
  const cfg = authResolveSupabaseConfig();
  return !!(cfg?.url && cfg?.anonKey && window.supabase?.createClient);
}

function authGetSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (!authCanUseSupabase()) return null;
  const cfg = authResolveSupabaseConfig();
  _supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  return _supabaseClient;
}

function authConfigureSupabase(url, anonKey) {
  const cfg = { url: String(url || '').trim(), anonKey: String(anonKey || '').trim() };
  if (!cfg.url || !cfg.anonKey) return false;
  localStorage.setItem(AUTH_SUPABASE_CONFIG_KEY, JSON.stringify(cfg));
  _supabaseClient = null;
  return true;
}

function authClearSupabaseConfig() {
  localStorage.removeItem(AUTH_SUPABASE_CONFIG_KEY);
  _supabaseClient = null;
}

function authSetGuestState(options = {}) {
  const { preserveLocalRecovery = false, preserveBootstrapHint = false } = options;
  AUTH.status = 'guest';
  AUTH.provider = authCanUseSupabase() ? 'supabase' : 'local_mock';
  AUTH.user = null;
  AUTH.sessionReady = true;
  AUTH.isSyncing = false;
  AUTH.lastSyncedAt = null;
  AUTH.needsEmailConfirmation = false;
  if (!preserveLocalRecovery) authClearLocalRecovery();
  if (!preserveBootstrapHint) {
    authSetBootstrapHint(
      preserveLocalRecovery && AUTH.localRecoveryKey ? 'local_resume' : 'guest',
      preserveLocalRecovery && AUTH.localRecoveryMeta?.name
        ? `Abbiamo riaperto la copia locale di ${AUTH.localRecoveryMeta.name}.`
        : ''
    );
  }
}

function authApplySupabaseUser(user) {
  if (!user?.id) {
    authSetGuestState();
    return AUTH;
  }
  AUTH.status = 'authenticated';
  AUTH.provider = 'supabase';
  AUTH.user = {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || (user.email || '').split('@')[0] || '',
  };
  AUTH.sessionReady = true;
  AUTH.needsEmailConfirmation = false;
  authClearLocalRecovery();
  authRememberLastActiveAccount(AUTH.user);
  authSetExplicitLogout(false);
  authUpdateClientContext();
  return AUTH;
}

function authListRecoverableLocalCaches() {
  const baseKey = authCurrentBaseStorageKey();
  const prefix = `${baseKey}__acct_`;
  const caches = [];
  const usersById = new Map(authLoadUsers().map(user => [user.id, user]));
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      const state = authParseRemoteState(raw);
      if (!authHasMeaningfulState(state)) continue;
      const userId = key.slice(prefix.length);
      const metaRaw = localStorage.getItem(`${AUTH_STATE_META_KEY}__acct_${userId}`);
      const meta = authParseRemoteState(metaRaw) || {};
      caches.push({
        key,
        userId,
        name: String(state?.anagrafica?.nome || '').trim(),
        email: usersById.get(userId)?.email || '',
        updatedAt: meta.updatedAt || meta.lastSyncedAt || meta.remoteUpdatedAt || null,
      });
    }
  } catch (_) {
    return [];
  }
  caches.sort((a, b) => (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0));
  return caches;
}

function authResolveRecoverableLocalCache() {
  if (authIsAuthenticated() || authHasExplicitLogout()) return null;
  const caches = authListRecoverableLocalCaches();
  if (!caches.length) return null;
  const lastActive = authReadLastActiveAccount();
  if (lastActive?.userId) {
    const matched = caches.find(cache => cache.userId === lastActive.userId);
    if (matched) {
      return {
        ...matched,
        email: matched.email || lastActive.email || '',
        name: matched.name || lastActive.name || '',
      };
    }
  }
  return caches.length === 1 ? caches[0] : null;
}

function authMaybeResumeLocalCache() {
  if (authIsAuthenticated()) return null;
  try {
    const localState = authReadActiveLocalState();
    if (authHasMeaningfulState(localState)) return null;
  } catch (_) {}
  const candidate = authResolveRecoverableLocalCache();
  if (!candidate) return null;
  authSetLocalRecovery(candidate);
  authSetBootstrapHint(
    'local_resume',
    candidate.name
      ? `Abbiamo riaperto la copia locale di ${candidate.name}.`
      : 'Abbiamo riaperto l ultima copia locale trovata su questo dispositivo.'
  );
  return candidate;
}

function authSubscribeSupabaseSession() {
  if (!authCanUseSupabase()) return;
  if (_supabaseAuthSubscription?.unsubscribe) return;
  try {
    const client = authGetSupabaseClient();
    const subscription = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        authApplySupabaseUser(session.user);
      } else {
        if (AUTH.localRecoveryKey) {
          authSetGuestState({ preserveLocalRecovery: true, preserveBootstrapHint: true });
        } else {
          authSetGuestState();
          authMaybeResumeLocalCache();
        }
      }
      authRefreshUi();
    });
    _supabaseAuthSubscription = subscription?.data?.subscription || null;
  } catch (_) {}
}

async function authInit() {
  const recoverableLocalCache = authResolveRecoverableLocalCache();
  if (authCanUseSupabase() && recoverableLocalCache) {
    AUTH.status = 'guest';
    AUTH.provider = 'supabase';
    AUTH.user = null;
    AUTH.sessionReady = true;
    AUTH.isSyncing = false;
    AUTH.lastSyncedAt = null;
    AUTH.needsEmailConfirmation = false;
    authSetLocalRecovery(recoverableLocalCache);
    authSetBootstrapHint(
      'local_resume',
      recoverableLocalCache.name
        ? `Abbiamo riaperto la copia locale di ${recoverableLocalCache.name}.`
        : 'Abbiamo riaperto l ultima copia locale trovata su questo dispositivo.'
    );
    try {
      const client = authGetSupabaseClient();
      authSubscribeSupabaseSession();
      authRunWithRetry(
        () => client.auth.getSession(),
        {
          attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
          timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
          timeoutMessage: 'Il cloud sta impiegando troppo tempo a rispondere',
          retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
        }
      ).then(({ data, error }) => {
        if (error) return;
        const user = data?.session?.user || null;
        if (!user) return;
        authApplySupabaseUser(user);
        authSeedAccountStateFromGuest(user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Stiamo preparando il tuo profilo.');
        authRefreshUi();
      }).catch(() => {});
    } catch (_) {}
    return AUTH;
  }
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      authSubscribeSupabaseSession();
      const { data, error } = await authRunWithRetry(
        () => client.auth.getSession(),
        {
          attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
          timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
          timeoutMessage: 'Il cloud sta impiegando troppo tempo a rispondere',
          retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
        }
      );
      if (error) throw error;
      const user = data?.session?.user || null;
      if (user) {
        authApplySupabaseUser(user);
        authSeedAccountStateFromGuest(user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Stiamo preparando il tuo profilo.');
        return AUTH;
      }
    } catch (err) {
      authSetBootstrapHint(
        'error',
        err?.message || 'Il cloud non ha risposto in tempo. Proviamo a ripartire con la copia locale.'
      );
    }
  }

  const session = authLoadSession();
  const users = authLoadUsers();
  if (!session?.userId) {
    authSetGuestState();
    authMaybeResumeLocalCache();
    return AUTH;
  }
  const user = users.find(entry => entry.id === session.userId);
  if (!user) {
    authSaveSession(null);
    authSetGuestState();
    return AUTH;
  }
  AUTH.status = 'authenticated';
  AUTH.provider = 'local_mock';
  AUTH.user = {
    id: user.id,
    email: user.email,
    name: user.name || '',
  };
  AUTH.sessionReady = true;
  AUTH.needsEmailConfirmation = false;
  authClearLocalRecovery();
  authRememberLastActiveAccount(AUTH.user);
  authSetExplicitLogout(false);
  authSeedAccountStateFromGuest(user.id);
  authSetBootstrapHint('local', 'Il tuo profilo e pronto.');
  return AUTH;
}

async function authEnsureRemoteProfile() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) return { ok: false, skipped: true };
  try {
    const client = authGetSupabaseClient();
    const payload = {
      user_id: AUTH.user.id,
      email: AUTH.user.email || '',
      name: AUTH.user.name || '',
      onboarding_completed: !!window.S?.onboardingCompleted,
      updated_at: new Date().toISOString(),
    };
    const { error } = await authRunWithRetry(
      () => client.from('profiles').upsert(payload, { onConflict: 'user_id' }),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
        timeoutMessage: 'Il cloud sta impiegando troppo tempo a preparare il profilo',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Non siamo riusciti a preparare il profilo' };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Non siamo riusciti a preparare il profilo' };
  }
}

async function authFetchRemoteStateRow() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) return { ok: false, skipped: true };
  try {
    const client = authGetSupabaseClient();
    const { data, error } = await authRunWithRetry(
      () => client
        .from('app_state')
        .select('state_json, updated_at, state_version')
        .eq('user_id', AUTH.user.id)
        .maybeSingle(),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
        timeoutMessage: 'Il cloud sta impiegando troppo tempo a recuperare il profilo',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Non siamo riusciti a recuperare il profilo' };
    return { ok: true, row: data || null };
  } catch (err) {
    return { ok: false, message: err?.message || 'Non siamo riusciti a recuperare il profilo' };
  }
}

function authParseRemoteState(rawState) {
  if (!rawState) return null;
  if (typeof rawState === 'string') {
    try { return JSON.parse(rawState); } catch (_) { return null; }
  }
  return typeof rawState === 'object' ? rawState : null;
}

function authHasMeaningfulState(state) {
  if (!state || typeof state !== 'object') return false;
  if (Array.isArray(state.weightLog) && state.weightLog.length > 0) return true;
  if (Array.isArray(state.measurements) && state.measurements.length > 0) return true;
  if (state.foodLog && typeof state.foodLog === 'object' && Object.keys(state.foodLog).length > 0) return true;
  if (state.doneByDate && typeof state.doneByDate === 'object' && Object.keys(state.doneByDate).length > 0) return true;
  if (state.notes && typeof state.notes === 'object' && Object.keys(state.notes).length > 0) return true;
  if (state.water && typeof state.water === 'object' && Object.keys(state.water).length > 0) return true;
  if (state.cheatMealsByDate && typeof state.cheatMealsByDate === 'object' && Object.keys(state.cheatMealsByDate).length > 0) return true;
  if (Array.isArray(state.customFoods) && state.customFoods.length > 0) return true;
  if (Array.isArray(state.favoriteFoods) && state.favoriteFoods.length > 0) return true;
  if (state.onboardingCompleted) return true;
  const profileName = String(state.anagrafica?.nome || '').trim();
  if (profileName) return true;
  if (Number.isFinite(Number(state.anagrafica?.peso)) && Number(state.anagrafica?.peso) > 0) return true;
  return false;
}

function authSeedAccountStateFromGuest(userId, options = {}) {
  const targetUserId = String(userId || '').trim();
  if (!targetUserId) return false;
  const baseKey = authCurrentBaseStorageKey();
  const guestKey = baseKey;
  const accountKey = `${baseKey}__acct_${targetUserId}`;
  if (guestKey === accountKey) return false;
  try {
    const guestRaw = localStorage.getItem(guestKey);
    const accountRaw = localStorage.getItem(accountKey);
    const guestState = authParseRemoteState(guestRaw);
    const accountState = authParseRemoteState(accountRaw);
    const hasMeaningfulGuest = authHasMeaningfulState(guestState);
    const hasMeaningfulAccount = authHasMeaningfulState(accountState);
    if (!hasMeaningfulGuest) return false;
    if (hasMeaningfulAccount && !options.force) return false;

    localStorage.setItem(accountKey, guestRaw);
    const now = new Date().toISOString();
    localStorage.setItem(`${AUTH_STATE_META_KEY}__acct_${targetUserId}`, JSON.stringify({
      updatedAt: now,
      lastSyncedAt: null,
      remoteUpdatedAt: null,
      resetPending: false,
      dirty: !!options.markDirty,
    }));
    authSetBootstrapHint('guest_seed', 'Abbiamo ritrovato i tuoi progressi e li abbiamo collegati al profilo.');
    return true;
  } catch (_) {
    return false;
  }
}

function authDescribeStatePresence(state) {
  return authHasMeaningfulState(state)
    ? { label: 'Con progressi', cls: 'filled' }
    : { label: 'Quasi vuota', cls: 'empty' };
}

function authMarkExplicitReset() {
  const now = new Date().toISOString();
  const meta = authReadStateMeta();
  authWriteStateMeta({
    ...meta,
    updatedAt: now,
    resetAt: now,
    resetPending: true,
    dirty: authIsAuthenticated() && AUTH.provider === 'supabase',
  });
}

function authStoreRemoteStateLocally(state, updatedAt) {
  try {
    authCreateStateBackup('remote_import', state, { updatedAt });
    const raw = JSON.stringify(state);
    localStorage.setItem(authGetAppStorageKey(authCurrentBaseStorageKey()), raw);
    authWriteStateMeta({
      updatedAt: updatedAt || new Date().toISOString(),
      lastSyncedAt: updatedAt || new Date().toISOString(),
      remoteUpdatedAt: updatedAt || new Date().toISOString(),
      resetPending: false,
      dirty: false,
    });
    AUTH.lastSyncedAt = updatedAt || new Date().toISOString();
    authSetBootstrapHint('remote', 'Abbiamo caricato la versione piu aggiornata del tuo profilo.');
    return true;
  } catch (_) {
    authSetBootstrapHint('error', 'Abbiamo trovato il tuo profilo, ma serve un nuovo tentativo per aprirlo bene.');
    return false;
  }
}

function authMarkLocalStatePreferred(remoteUpdatedAt) {
  const meta = authReadStateMeta();
  const updatedAt = meta.updatedAt || new Date().toISOString();
  authWriteStateMeta({
    ...meta,
    updatedAt,
    remoteUpdatedAt: remoteUpdatedAt || meta.remoteUpdatedAt || null,
    dirty: true,
  });
}

async function authHydrateLocalCacheFromRemote() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) {
    return { ok: false, skipped: true };
  }
  const remote = await authFetchRemoteStateRow();
  if (!remote.ok) {
    authSetBootstrapHint('error', remote.message || 'Stiamo avendo un attimo di difficolta a recuperare il tuo profilo.');
    return remote;
  }
  if (!remote.row) {
    const localRaw = localStorage.getItem(authGetAppStorageKey(authCurrentBaseStorageKey()));
    const localState = authParseRemoteState(localRaw);
    if (authHasMeaningfulState(localState)) {
      authSetBootstrapHint('local', 'Ripartiamo dai dati che hai gia qui.');
    } else {
      authSetBootstrapHint('empty', 'Parti da un profilo nuovo.');
    }
    return { ok: true, hydrated: false, source: authHasMeaningfulState(localState) ? 'local' : 'empty' };
  }
  const remoteState = authParseRemoteState(remote.row.state_json);
  if (!remoteState) {
    authSetBootstrapHint('error', 'La versione trovata non e leggibile.');
    return { ok: false, message: 'La versione trovata non e leggibile' };
  }
  if (typeof validateImportedState === 'function') {
    const validation = validateImportedState(remoteState);
    if (!validation.ok) {
      authSetBootstrapHint('error', 'La versione trovata non e completa.');
      return { ok: false, message: 'La versione trovata non e completa' };
    }
  }

  const localRaw = authReadActiveLocalStateRaw();
  const localMeta = authReadStateMeta();
  const localState = authParseRemoteState(localRaw);
  const remoteAt = Date.parse(remote.row.updated_at || 0) || 0;
  const localAt = Date.parse(localMeta.updatedAt || localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || 0) || 0;
  const resetAt = Date.parse(localMeta.resetAt || 0) || 0;
  const hasMeaningfulLocal = authHasMeaningfulState(localState);
  const hasMeaningfulRemote = authHasMeaningfulState(remoteState) && !!remote.row.updated_at && !!remoteAt;
  const localDirty = !!localMeta.dirty || !!localMeta.resetPending;

  if (resetAt && resetAt >= remoteAt && !hasMeaningfulLocal) {
    authWriteStateMeta({
      ...localMeta,
      updatedAt: localMeta.updatedAt || localMeta.resetAt || new Date().toISOString(),
      remoteUpdatedAt: remote.row.updated_at || localMeta.remoteUpdatedAt || null,
      resetPending: authIsAuthenticated() && AUTH.provider === 'supabase',
      dirty: authIsAuthenticated() && AUTH.provider === 'supabase',
    });
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || null;
    authSetBootstrapHint('local_reset', 'Ripartiamo da questa versione del profilo.');
    return { ok: true, hydrated: false, source: 'local_reset' };
  }

  if (!hasMeaningfulLocal && hasMeaningfulRemote) {
    authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
    return { ok: true, hydrated: true, source: 'remote' };
  }

  if (hasMeaningfulLocal && !hasMeaningfulRemote) {
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
    authSetBootstrapHint('local', 'Restiamo sulla versione che hai gia qui.');
    return { ok: true, hydrated: false, source: 'local' };
  }

  if (hasMeaningfulLocal && hasMeaningfulRemote && (!localAt || !remoteAt || remoteAt !== localAt)) {
    if (!localAt || !remoteAt || localDirty) {
      authSetBootstrapHint('local', 'Abbiamo trovato una copia locale e una nel cloud: scegliamo insieme quella giusta.');
      return {
        ok: true,
        conflict: true,
        reason: !localAt || !remoteAt
          ? 'timestamp_missing'
          : remoteAt > localAt
            ? 'remote_newer_local_dirty'
            : 'local_newer_remote_present',
        localState,
        remoteState,
        localUpdatedAt: localMeta.updatedAt || null,
        remoteUpdatedAt: remote.row.updated_at || null,
      };
    }
    if (remoteAt > localAt) {
      authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
      return { ok: true, hydrated: true, source: 'remote' };
    }
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
    authSetBootstrapHint('local', 'La cache del tuo account qui sembra la versione piu aggiornata.');
    return { ok: true, hydrated: false, source: 'local' };
  }

  if (!hasMeaningfulLocal || !localRaw || remoteAt > localAt) {
    authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
    return { ok: true, hydrated: true, source: 'remote' };
  }

  AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
  authSetBootstrapHint('local', 'Il tuo profilo e gia pronto.');
  return { ok: true, hydrated: false, source: 'local' };
}

function signUpLocal(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!authValidateEmail(cleanEmail)) {
    return { ok: false, message: 'Inserisci un email valida' };
  }
  if (!authValidatePassword(password)) {
    return { ok: false, message: 'La password deve avere almeno 8 caratteri' };
  }
  const users = authLoadUsers();
  if (users.some(user => user.email === cleanEmail)) {
    return { ok: false, message: 'Esiste già un account con questa email' };
  }
  const user = {
    id: authGenerateId(),
    email: cleanEmail,
    passwordHash: String(password),
    name: cleanEmail.split('@')[0],
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  authSaveUsers(users);
  authSaveSession({ userId: user.id, createdAt: new Date().toISOString() });
  AUTH.status = 'authenticated';
  AUTH.provider = 'local_mock';
  AUTH.user = { id: user.id, email: user.email, name: user.name };
  AUTH.sessionReady = true;
  authClearLocalRecovery();
  authRememberLastActiveAccount(AUTH.user);
  authSetExplicitLogout(false);
  authSeedAccountStateFromGuest(user.id);
  authSetBootstrapHint('local', 'Il tuo profilo e attivo.');
  return { ok: true, user: AUTH.user };
}

function signInLocal(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = authLoadUsers();
  const user = users.find(entry => entry.email === cleanEmail);
  if (!user) return { ok: false, message: 'Account non trovato' };
  if (String(user.passwordHash) !== String(password)) {
    return { ok: false, message: 'Password non corretta' };
  }
  authSaveSession({ userId: user.id, createdAt: new Date().toISOString() });
  AUTH.status = 'authenticated';
  AUTH.provider = 'local_mock';
  AUTH.user = { id: user.id, email: user.email, name: user.name || '' };
  AUTH.sessionReady = true;
  authClearLocalRecovery();
  authRememberLastActiveAccount(AUTH.user);
  authSetExplicitLogout(false);
  authSeedAccountStateFromGuest(user.id);
  authSetBootstrapHint('local', 'Il tuo profilo e attivo.');
  return { ok: true, user: AUTH.user };
}

async function signUpWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      const { data, error } = await authWithTimeout(
        client.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: cleanEmail.split('@')[0] } },
        }),
        'La registrazione sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      if (error) return { ok: false, message: error.message || 'Registrazione non riuscita' };
      const user = data?.user;
      if (!user) return { ok: false, message: 'Controlla la tua email per completare l accesso' };
      if (data?.session?.user) {
        authApplySupabaseUser(data.session.user);
        authSeedAccountStateFromGuest(data.session.user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Account creato. Stiamo preparando il tuo profilo.');
        await authEnsureRemoteProfile();
        return { ok: true, user: AUTH.user };
      }
      AUTH.status = 'guest';
      AUTH.provider = 'supabase';
      AUTH.user = null;
      AUTH.sessionReady = true;
      AUTH.needsEmailConfirmation = true;
      authSetBootstrapHint('awaiting_email', 'Controlla la tua email per confermare l accesso.');
      return {
        ok: true,
        pendingConfirmation: true,
        message: 'Ti abbiamo inviato un link. Aprilo e poi torna qui per entrare.',
      };
    } catch (err) {
      return { ok: false, message: err?.message || 'Accesso non disponibile in questo momento' };
    }
  }
  return signUpLocal(cleanEmail, password);
}

async function signInWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      const { data, error } = await authRunWithRetry(
        () => client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        {
          attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
          timeoutMs: AUTH_LOGIN_TIMEOUT_MS,
          timeoutMessage: 'L accesso sta impiegando troppo tempo',
          retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
        }
      );
      if (error) return { ok: false, message: error.message || 'Accesso non riuscito' };
      const user = data?.user;
      if (!user) return { ok: false, message: 'Accesso non riuscito' };
      authApplySupabaseUser(user);
      authSeedAccountStateFromGuest(user.id, { markDirty: true });
      authSetBootstrapHint('account_connected', 'Bentornato. Stiamo aprendo il tuo profilo.');
      await authEnsureRemoteProfile();
      const storageKey = authGetAppStorageKey(authCurrentBaseStorageKey());
      const localRaw = localStorage.getItem(storageKey);
      const localState = authParseRemoteState(localRaw);
      if (!authHasMeaningfulState(localState)) {
        authClearLocalStateMeta();
      }
      return { ok: true, user: AUTH.user };
    } catch (err) {
      if (authShouldRetryTransientError(err)) {
        return {
          ok: false,
          message: AUTH.localRecoveryKey
            ? 'Il cloud sta rispondendo troppo lentamente anche dopo un nuovo tentativo. La copia locale del profilo resta comunque disponibile su questo dispositivo.'
            : 'Il cloud sta rispondendo troppo lentamente anche dopo un nuovo tentativo. Riprova tra poco.',
        };
      }
      return { ok: false, message: err?.message || 'Accesso non disponibile in questo momento' };
    }
  }
  return signInLocal(cleanEmail, password);
}

async function authSendPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!authValidateEmail(cleanEmail)) {
    return { ok: false, message: 'Inserisci un email valida' };
  }
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      const { error } = await authRunWithRetry(
        () => client.auth.resetPasswordForEmail(cleanEmail),
        {
          attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
          timeoutMs: AUTH_LOGIN_TIMEOUT_MS,
          timeoutMessage: 'Il reset password sta impiegando troppo tempo',
          retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
        }
      );
      if (error) return { ok: false, message: error.message || 'Invio email non riuscito' };
      return { ok: true, message: 'Ti abbiamo inviato una mail per reimpostare la password.' };
    } catch (err) {
      return { ok: false, message: err?.message || 'Invio email non riuscito' };
    }
  }
  return {
    ok: false,
    message: 'Per ora crea un nuovo profilo o usa l accesso che stai gia utilizzando.',
  };
}

async function signOutUser() {
  try {
    sessionStorage.setItem(AUTH_POST_LOGOUT_MODE_KEY, 'login');
  } catch (_) {}
  authSetExplicitLogout(true);
  if (window.S) {
    window.S.authEntryCompleted = false;
  }
  if (AUTH.provider === 'supabase' && authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      await authWithTimeout(
        client.auth.signOut(),
        'L uscita sta impiegando troppo tempo'
      );
    } catch (_) {}
  } else {
    authSaveSession(null);
  }
  authSetGuestState();
  authRefreshUi();
  const canInlineLogoutTransition =
    typeof bootstrapAppStateFromCurrentStorage === 'function'
    && typeof refreshAppAfterBootstrap === 'function'
    && typeof openAuthEntry === 'function'
    && typeof openAuthMode === 'function';
  if (canInlineLogoutTransition) {
    try {
      bootstrapAppStateFromCurrentStorage({ resetState: true });
      if (typeof S !== 'undefined') {
        S.authEntryCompleted = false;
      }
      if (typeof save === 'function') save({ skipCloudSync: true });
      if (typeof closeWelcomeOnboarding === 'function') closeWelcomeOnboarding();
      refreshAppAfterBootstrap({ closeAuthOverlay: true, preferredView: 'today' });
      openAuthEntry(true);
      openAuthMode('login');
      return;
    } catch (_) {}
  }
  const logoutHandler = typeof handleMarciFitAccountLogoutTransition === 'function'
    ? handleMarciFitAccountLogoutTransition
    : window.handleMarciFitAccountLogoutTransition;
  if (typeof logoutHandler === 'function') {
    try {
      await logoutHandler({ preferredMode: 'login' });
      return;
    } catch (_) {}
  }
  if (typeof location !== 'undefined') location.reload();
}

function confirmSignOutUser() {
  if (typeof showDayModal !== 'function') {
    signOutUser();
    return;
  }
  showDayModal({
    icon: '↩️',
    eyebrow: 'Account',
    title: 'Vuoi davvero uscire?',
    body: 'Tornerai alla schermata di accesso e potrai rientrare quando vuoi.',
    confirmText: 'Esci',
    cancelText: 'Resta dentro',
    danger: true,
    onConfirm: () => { signOutUser(); },
  });
}

function authOnLocalStateSaved(raw, options = {}) {
  const now = new Date().toISOString();
  const meta = authReadStateMeta();
  const shouldSync = authIsAuthenticated() && AUTH.provider === 'supabase';
  const dirty = shouldSync
    ? (meta.resetPending ? true : (options.skipCloudSync ? !!meta.dirty : true))
    : false;
  const updatedAt = options.preserveMetaTimestamp
    ? (meta.updatedAt || now)
    : now;
  const nextMeta = {
    ...meta,
    updatedAt,
    dirty,
  };
  authWriteStateMeta(nextMeta);
  if (!options.skipCloudSync && AUTH.bootstrapReady) authQueueStateSync();
}

async function authSyncStateToCloud(force = false) {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) {
    return { ok: false, skipped: true };
  }
  if (!AUTH.bootstrapReady) {
    return { ok: false, skipped: true, reason: 'bootstrap_pending' };
  }
  const meta = authReadStateMeta();
  if (!force && meta.dirty === false) {
    return { ok: true, skipped: true };
  }
  try {
    AUTH.isSyncing = true;
    const client = authGetSupabaseClient();
    const raw = localStorage.getItem(authGetAppStorageKey(authCurrentBaseStorageKey())) || JSON.stringify(window.S || {});
    const parsed = JSON.parse(raw);
    authCreateStateBackup('pre_cloud_sync', parsed, { updatedAt: meta.updatedAt || null });
    const remote = await authFetchRemoteStateRow();
    const remoteState = remote?.row ? authParseRemoteState(remote.row.state_json) : null;
    const remoteAt = Date.parse(remote?.row?.updated_at || 0) || 0;
    const localAt = Date.parse(meta.updatedAt || 0) || 0;
    const hasMeaningfulLocal = authHasMeaningfulState(parsed);
    const hasMeaningfulRemote = authHasMeaningfulState(remoteState);

    if (!force && hasMeaningfulRemote && (!hasMeaningfulLocal || remoteAt > localAt)) {
      AUTH.isSyncing = false;
      AUTH.lastSyncedAt = remote?.row?.updated_at || AUTH.lastSyncedAt;
      authWriteStateMeta({
        ...meta,
        remoteUpdatedAt: remote?.row?.updated_at || meta.remoteUpdatedAt || null,
        lastSyncedAt: remote?.row?.updated_at || meta.lastSyncedAt || null,
        dirty: hasMeaningfulLocal ? meta.dirty : false,
      });
      authRefreshUi();
      return {
        ok: false,
        conflict: true,
        reason: !hasMeaningfulLocal ? 'local_empty_remote_present' : 'remote_newer',
        localState: parsed,
        remoteState,
        localUpdatedAt: meta.updatedAt || null,
        remoteUpdatedAt: remote?.row?.updated_at || null,
      };
    }

    await authEnsureRemoteProfile();
    const updatedAt = meta.updatedAt || new Date().toISOString();
    const payload = {
      user_id: AUTH.user.id,
      state_json: parsed,
      state_version: 1,
      updated_at: updatedAt,
    };
    const { error } = await authRunWithRetry(
      () => client.from('app_state').upsert(payload, { onConflict: 'user_id' }),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
        timeoutMessage: 'Il cloud sta impiegando troppo tempo ad aggiornare il profilo',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) {
      AUTH.isSyncing = false;
      authRefreshUi();
      return { ok: false, message: error.message || 'Non siamo riusciti ad aggiornare il profilo' };
    }
    AUTH.isSyncing = false;
    AUTH.lastSyncedAt = updatedAt;
    authSetBootstrapHint('cloud_push', 'Abbiamo aggiornato il tuo profilo.');
    authWriteStateMeta({
      ...meta,
      updatedAt,
      lastSyncedAt: updatedAt,
      remoteUpdatedAt: updatedAt,
      resetPending: false,
      dirty: false,
    });
    authRefreshUi();
    return { ok: true, syncedAt: updatedAt };
  } catch (err) {
    AUTH.isSyncing = false;
    authRefreshUi();
    return { ok: false, message: err?.message || 'Non siamo riusciti ad aggiornare il profilo' };
  }
}

function authQueueStateSync(delay = AUTH_SYNC_DELAY_MS) {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !AUTH.bootstrapReady) return;
  AUTH.isSyncing = true;
  authRefreshUi();
  clearTimeout(_authSyncTimer);
  _authSyncTimer = setTimeout(() => {
    const conflictHandler = typeof handleMarciFitCloudConflict === 'function'
      ? handleMarciFitCloudConflict
      : window.handleMarciFitCloudConflict;
    authSyncStateToCloud()
      .then(result => {
        if (result?.conflict && typeof conflictHandler === 'function') {
          return conflictHandler(result, { pushLocalOnChoice: true, source: 'queued_sync' });
        }
        return null;
      })
      .catch(() => {});
  }, delay);
}

function authSubmitSupabaseConfig() {
  const url = document.getElementById('supabase-url-input')?.value || '';
  const anonKey = document.getElementById('supabase-anon-input')?.value || '';
  const ok = authConfigureSupabase(url, anonKey);
  if (!ok) {
    if (typeof toast === 'function') toast('⚠️ Inserisci URL e anon key');
    return;
  }
  if (!authIsAuthenticated()) authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('✅ Configurazione salvata');
}

function authRemoveSupabaseConfig() {
  authClearSupabaseConfig();
  if (!authIsAuthenticated()) authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('🧹 Configurazione rimossa');
}

function authClearLocalAccounts() {
  localStorage.removeItem(AUTH_USERS_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
  if (!authIsAuthenticated()) authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('🧹 Account rimossi');
}

async function authSyncNow() {
  const result = await authSyncStateToCloud();
  const conflictHandler = typeof handleMarciFitCloudConflict === 'function'
    ? handleMarciFitCloudConflict
    : window.handleMarciFitCloudConflict;
  if (result?.conflict && typeof conflictHandler === 'function') {
    const resolution = await conflictHandler(result, { pushLocalOnChoice: true, source: 'manual_sync' });
    if (typeof toast === 'function') {
      toast(
        resolution?.choice === 'remote'
          ? '✅ Abbiamo aperto la versione cloud'
          : resolution?.choice === 'local'
            ? '✅ Abbiamo tenuto e sincronizzato questa versione'
            : 'ℹ️ Sync da confermare'
      );
    }
    return;
  }
  if (typeof toast === 'function') {
    toast(result.ok ? '✅ Profilo aggiornato' : `⚠️ ${result.message || 'Aggiornamento non riuscito'}`);
  }
}

function renderAuthNav() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;
  const status = authStatusMeta();
  if (authIsAuthenticated() || AUTH.localRecoveryKey) {
    const title = authIsAuthenticated()
      ? AUTH.user.email
      : (AUTH.localRecoveryMeta?.email || AUTH.localRecoveryMeta?.name || 'Profilo locale');
    const label = authIsAuthenticated()
      ? (AUTH.user.name || 'Account')
      : (AUTH.localRecoveryMeta?.name || 'Profilo locale');
    slot.innerHTML = `
      <button class="btn btn-ghost auth-nav-btn" onclick="goView('profilo')" title="${htmlEsc(title)}">
        <i data-lucide="badge-check" class="nav-action-icon"></i>
        <span class="auth-nav-copy">${htmlEsc(label)}</span>
        <span class="auth-nav-state ${status.cls}">${htmlEsc(status.label)}</span>
      </button>`;
  } else {
    slot.innerHTML = `
      <button class="btn btn-ghost auth-nav-btn" onclick="openAuthEntry()">
        <i data-lucide="log-in" class="nav-action-icon"></i>
        <span class="auth-nav-copy">Accedi</span>
        <span class="auth-nav-state ${status.cls}">${htmlEsc(status.label)}</span>
      </button>`;
  }
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function renderProfileAccountCard() {
  const el = document.getElementById('profile-account-slot');
  if (!el) return;
  const cfg = authResolveSupabaseConfig();
  const hasEmbeddedConfig = authHasEmbeddedSupabaseConfig();
  const accountDiag = authGetAccountDiagnostics();
  const backupMeta = authGetLatestBackupMeta();
  const backupLabel = backupMeta
    ? `${authFormatSyncTime(backupMeta.createdAt)} · ${authFormatBackupSource(backupMeta.source)}`
    : 'La prima copia arriva automaticamente';
  const status = authStatusMeta();
  const showDevUi = authShowDevelopmentUi();
  const factGrid = `
    <div class="profile-account-facts">
      <div class="profile-account-fact">
        <span class="profile-account-fact-label">Dati</span>
        <strong class="profile-account-fact-value">${htmlEsc(accountDiag.storageLabel)}</strong>
      </div>
      <div class="profile-account-fact">
        <span class="profile-account-fact-label">Contesto</span>
        <strong class="profile-account-fact-value">${htmlEsc(accountDiag.contextLabel)}</strong>
      </div>
      <div class="profile-account-fact">
        <span class="profile-account-fact-label">Ingresso</span>
        <strong class="profile-account-fact-value">${htmlEsc(accountDiag.sourceLabel)}</strong>
      </div>
      <div class="profile-account-fact">
        <span class="profile-account-fact-label">Salvataggio</span>
        <strong class="profile-account-fact-value">${htmlEsc(accountDiag.scopeLabel)}</strong>
      </div>
    </div>`;
  const notes = [
    accountDiag.syncDetail,
    accountDiag.sourceDetail,
    accountDiag.standaloneSessionNote && accountDiag.standaloneSessionNote !== accountDiag.syncDetail
      ? accountDiag.standaloneSessionNote
      : '',
    backupMeta
      ? `Copia di sicurezza locale: ${backupLabel}.`
      : authIsAuthenticated()
        ? 'La prossima copia di sicurezza locale verra preparata automaticamente.'
        : 'La prima copia locale parte automaticamente appena inizi a salvare dati.',
  ].filter(Boolean);
  const notesHtml = `
    <div class="profile-account-notes">
      ${notes.map(note => `<div class="profile-account-note">${htmlEsc(note)}</div>`).join('')}
    </div>`;
  const devPanel = showDevUi ? `
    <div class="profile-account-config">
      <div class="profile-account-config-title">Strumenti sviluppo</div>
      <div class="profile-account-config-sub">Setup, diagnostica e controlli interni restano qui fuori dalla UI prodotto.</div>
      <div class="profile-account-note">Contesto: ${htmlEsc(accountDiag.contextLabel)} · ingresso: ${htmlEsc(accountDiag.sourceLabel)}</div>
      ${accountDiag.sourceDetail ? `<div class="profile-account-note">${htmlEsc(accountDiag.sourceDetail)}</div>` : ''}
      ${cfg || hasEmbeddedConfig ? `
        <div class="profile-account-note">${hasEmbeddedConfig ? 'Accesso email integrato nel build corrente.' : 'Accesso email configurato manualmente.'}</div>
      ` : `
        <div class="profile-account-config-grid">
          <label class="profile-account-config-field">
            <span>Project URL</span>
            <input id="supabase-url-input" class="profile-account-input" type="url" placeholder="https://xxxxx.supabase.co">
          </label>
          <label class="profile-account-config-field">
            <span>Anon key</span>
            <input id="supabase-anon-input" class="profile-account-input" type="password" placeholder="eyJhbGciOi...">
          </label>
        </div>
        <div class="profile-account-actions">
          <button class="auth-account-btn" onclick="authSubmitSupabaseConfig()">Salva configurazione</button>
        </div>
      `}
      <div class="profile-account-actions">
        ${cfg && !hasEmbeddedConfig ? `<button class="auth-account-btn" onclick="authRemoveSupabaseConfig()">Rimuovi configurazione</button>` : ''}
        <button class="auth-account-btn" onclick="authClearLocalAccounts()">Pulisci account locali</button>
      </div>
    </div>` : '';
  if (authIsAuthenticated()) {
    const summary = AUTH.provider === 'supabase'
      ? (accountDiag.storageLabel === 'Cloud + cache account'
        ? 'Il profilo del tuo account e gia qui e questa schermata e partita dal cloud.'
        : 'Il profilo del tuo account e gia qui e continua dalla cache salvata su questo dispositivo.')
      : 'Questo profilo resta disponibile solo su questo dispositivo.';
    const statusCopy = accountDiag.statusDetail;
    const secondaryAction = AUTH.provider === 'supabase'
      ? `<button class="auth-account-btn" onclick="authSyncNow()">Aggiorna ora</button>`
      : authCanUseSupabase()
        ? `<button class="auth-account-btn" onclick="openAuthEntry()">Collega il cloud</button>`
        : '';
    el.innerHTML = `
      <div class="profile-inline-card profile-account-card">
        <div class="profile-card-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Account</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">${AUTH.provider === 'supabase' ? 'Profilo collegato' : 'Profilo locale attivo'}</div>
              <span class="support-mini-state done">${AUTH.provider === 'supabase' ? 'Collegato' : 'Locale'}</span>
            </div>
            <div class="support-mini-sub">${summary}</div>
          </div>
        </div>
        <div class="profile-account-status-row">
          <span class="profile-account-pill ${status.cls}">${htmlEsc(status.label)}</span>
          <span class="profile-account-status-copy">${statusCopy}</span>
        </div>
        ${factGrid}
        ${notesHtml}
        <div class="profile-account-body">
          <div class="profile-account-email">${htmlEsc(AUTH.user.email)}</div>
          <div class="profile-account-actions">
            ${secondaryAction}
            <button class="auth-account-btn auth-account-btn-danger" onclick="confirmSignOutUser()">Esci</button>
          </div>
        </div>
        ${devPanel}
      </div>`;
  } else {
    const hasRecoveredLocalProfile = !!AUTH.localRecoveryKey;
    const title = AUTH.needsEmailConfirmation
      ? 'Controlla la tua email'
      : hasRecoveredLocalProfile
        ? 'Profilo locale ripreso'
        : accountDiag.standaloneSessionNote
          ? 'Collega questa web app'
          : 'Stai usando MarciFit come guest';
    const badge = AUTH.needsEmailConfirmation
      ? 'Quasi pronto'
      : hasRecoveredLocalProfile
        ? 'Locale'
        : 'Guest';
    const summary = AUTH.needsEmailConfirmation
      ? 'Apri il link che ti abbiamo inviato e poi rientra qui.'
      : hasRecoveredLocalProfile
        ? 'Abbiamo riaperto la copia locale del tuo ultimo profilo. Puoi continuare a usarla subito e ricollegare il cloud quando vuoi.'
        : accountDiag.standaloneSessionNote
          ? 'Se il profilo era aperto in Safari, qui puo servirti un accesso la prima volta. Dopo l accesso ritrovi la copia cloud.'
          : 'I dati che vedi ora restano locali finche non scegli di collegare un account.';
    const statusCopy = AUTH.needsEmailConfirmation
      ? 'Dopo la conferma ti riportiamo subito dentro.'
      : accountDiag.statusDetail;
    const emailLabel = AUTH.needsEmailConfirmation
      ? 'Conferma in attesa'
      : hasRecoveredLocalProfile
        ? (AUTH.localRecoveryMeta?.email || AUTH.localRecoveryMeta?.name || 'Ultimo profilo locale')
        : 'Nessun account collegato';
    const connectAction = hasRecoveredLocalProfile
      ? `<button class="auth-account-btn" onclick="openAuthEntry(true); openAuthMode('login');">Ricollega account</button>`
      : `<button class="auth-account-btn" onclick="openAuthEntry()">Accedi o crea profilo</button>`;
    el.innerHTML = `
      <div class="profile-inline-card profile-account-card">
        <div class="profile-card-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Account</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">${title}</div>
              <span class="support-mini-state ${AUTH.needsEmailConfirmation ? 'pending' : 'idle'}">${badge}</span>
            </div>
            <div class="support-mini-sub">${summary}</div>
          </div>
        </div>
        <div class="profile-account-status-row">
          <span class="profile-account-pill ${status.cls}">${htmlEsc(status.label)}</span>
          <span class="profile-account-status-copy">${statusCopy}</span>
        </div>
        ${factGrid}
        ${notesHtml}
        <div class="profile-account-body">
          <div class="profile-account-email">${htmlEsc(emailLabel)}</div>
          <div class="profile-account-actions">
            ${connectAction}
          </div>
        </div>
        ${devPanel}
      </div>`;
  }
}
