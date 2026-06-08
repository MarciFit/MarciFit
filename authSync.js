// authSync.js — profili locali e compatibilita con vecchie cache account

const AUTH_USERS_KEY = 'marcifit_auth_users_v1';
const AUTH_SESSION_KEY = 'marcifit_auth_session_v1';
const AUTH_SUPABASE_CONFIG_KEY = 'marcifit_supabase_config_v1';
const AUTH_PROXY_SESSION_KEY = 'marcifit_auth_proxy_session_v1';
const AUTH_LOCAL_PROXY_ORIGIN_KEY = 'marcifit_local_proxy_origin_v1';
const AUTH_DEFAULT_LOCAL_PROXY_ORIGIN = 'http://127.0.0.1:8793';
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
  lastAttempt: null,
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

function authIsTimeoutError(err) {
  const message = String(err?.message || err?.cause?.message || '').toLowerCase();
  return err?.name === 'AuthTimeoutError'
    || err?.name === 'TimeoutError'
    || message.includes('timed out')
    || message.includes('timeout');
}

function authIsInvalidCredentialsMessage(message = '') {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('invalid login')
    || normalized.includes('invalid credentials')
    || normalized.includes('email not confirmed')
    || normalized.includes('invalid grant')
    || normalized.includes('password')
    || normalized.includes('credenzial');
}

function authCreateFlowResult({
  ok = false,
  code = 'unknown_error',
  stage = 'idle',
  source = 'sdk',
  user = null,
  session = null,
  recovery = null,
  message = '',
  retryable = false,
  diagnostics = [],
  extra = {},
} = {}) {
  return {
    ok: !!ok,
    code,
    stage,
    source,
    user,
    session,
    recovery,
    message: message || '',
    retryable: !!retryable,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
    ...extra,
  };
}

function authUserMessage(result = {}) {
  switch (result.code) {
    case 'success':
      return result.message || 'Bentornato';
    case 'signup_success':
      return result.message || 'Profilo creato';
    case 'pending_confirmation':
      return result.message || 'Ti abbiamo inviato un link. Aprilo e poi torna qui per entrare.';
    case 'invalid_email':
      return 'Inserisci un email valida';
    case 'weak_password':
      return 'La password deve avere almeno 8 caratteri';
    case 'password_mismatch':
      return 'Le password non coincidono';
    case 'email_exists':
      return 'Esiste gia un account con questa email';
    case 'invalid_credentials':
      return 'Email o password non corretti';
    case 'local_recovery':
      return 'Profilo aperto su questo dispositivo';
    case 'network_unavailable':
      return 'Non riesco a completare l accesso. Riprova tra poco';
    case 'conflict':
      return 'Scegli quale versione del profilo usare';
    default:
      return result.message && !/failed to fetch|supabase|proxy|gateway|token|remote state/i.test(result.message)
        ? result.message
        : 'Non riesco a completare l accesso. Riprova tra poco';
  }
}

function authRecoverLocalProfile(reason = 'network_unavailable') {
  const candidate = authMaybeResumeLocalCache();
  if (!candidate) {
    return authCreateFlowResult({
      ok: false,
      code: 'network_unavailable',
      stage: 'local_bootstrap',
      source: 'local_cache',
      retryable: true,
      message: authUserMessage({ code: 'network_unavailable' }),
      diagnostics: [{ reason }],
    });
  }
  return authCreateFlowResult({
    ok: true,
    code: 'local_recovery',
    stage: 'local_bootstrap',
    source: 'local_cache',
    recovery: candidate,
    retryable: true,
    message: authUserMessage({ code: 'local_recovery' }),
    diagnostics: [{ reason }],
  });
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

function authLoadProxySession() {
  try {
    const raw = localStorage.getItem(AUTH_PROXY_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function authSaveProxySession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_PROXY_SESSION_KEY);
    return;
  }
  localStorage.setItem(AUTH_PROXY_SESSION_KEY, JSON.stringify(session));
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
  return false;
}

function authProviderLabel() {
  return 'Locale';
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
      return 'Account';
    case 'local':
      return 'Profilo salvato';
    case 'local_resume':
      return 'Cache locale ripresa';
    case 'local_reset':
      return 'Profilo ripristinato';
    case 'empty':
      return 'Nessun dato trovato';
    case 'account_connected':
      return 'Account collegato';
    case 'awaiting_email':
      return 'Conferma email';
    case 'cloud_push':
      return 'Profilo aggiornato';
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

function authAttemptMaskEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const atIndex = raw.indexOf('@');
  if (atIndex <= 1) return raw;
  const local = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

function authAttemptStageLabel(stage) {
  switch (stage) {
    case 'auth_gateway':
      return 'Servizio accesso';
    case 'sign_in':
      return 'Login account';
    case 'sign_in_fallback':
      return 'Login diretto';
    case 'profile_sync':
      return 'Profilo base';
    case 'remote_state':
      return 'Profilo account';
    case 'bootstrap':
      return 'Apertura profilo';
    case 'done':
      return 'Completato';
    default:
      return 'Diagnostica';
  }
}

function authNotifyAttemptUi() {
  if (typeof renderAuthEntry === 'function') renderAuthEntry();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
}

function authStartAttempt(mode, email = '') {
  AUTH.lastAttempt = {
    mode: mode || 'login',
    email: authAttemptMaskEmail(email),
    status: 'pending',
    currentStage: 'idle',
    startedAt: new Date().toISOString(),
    startedMs: Date.now(),
    updatedAt: new Date().toISOString(),
    lines: [],
  };
  authNotifyAttemptUi();
  return AUTH.lastAttempt;
}

function authRecordAttemptStage(stage, status, message = '') {
  if (!AUTH.lastAttempt) authStartAttempt('login');
  const nowMs = Date.now();
  const elapsedMs = Math.max(0, nowMs - (AUTH.lastAttempt.startedMs || nowMs));
  const line = {
    stage: stage || 'idle',
    label: authAttemptStageLabel(stage),
    status: status || 'info',
    message: String(message || ''),
    elapsedMs,
    createdAt: new Date().toISOString(),
  };
  AUTH.lastAttempt.currentStage = line.stage;
  AUTH.lastAttempt.updatedAt = line.createdAt;
  AUTH.lastAttempt.lines = [...(AUTH.lastAttempt.lines || []).filter(entry => entry.stage !== line.stage), line].slice(-8);
  if (status === 'error') AUTH.lastAttempt.status = 'error';
  else if (status === 'success' && stage === 'done') AUTH.lastAttempt.status = 'success';
  else if (AUTH.lastAttempt.status !== 'error') AUTH.lastAttempt.status = 'pending';
  authNotifyAttemptUi();
  return line;
}

function authClearAttemptDiagnostics() {
  AUTH.lastAttempt = null;
  authNotifyAttemptUi();
}

function authGetLastAttemptDiagnostics() {
  const attempt = AUTH.lastAttempt;
  if (!attempt?.lines?.length) return null;
  const lines = attempt.lines.map(line => ({
    ...line,
    elapsedLabel: `${Math.max(0, Math.round((line.elapsedMs || 0) / 100) / 10)}s`,
  }));
  const latest = lines[lines.length - 1];
  return {
    mode: attempt.mode,
    email: attempt.email,
    status: attempt.status,
    currentStage: attempt.currentStage,
    latest,
    lines,
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
  return '';
}

function authGatewayFailureHelp() {
  const standaloneHint = AUTH.clientContext === 'standalone'
    ? 'Apri MarciFit direttamente in Safari e riprova.'
    : 'Riprova da Safari nello stesso dispositivo.';
  return `${standaloneHint} Se usi VPN, Private Relay, DNS filtrato o adblock, disattivali un attimo e ritenta.`;
}

function authFriendlyAccessIssueMessage(hasDeviceProfile = false) {
  const profileCopy = hasDeviceProfile
    ? ' Il profilo su questo dispositivo resta disponibile.'
    : '';
  return `Non siamo riusciti ad aprire il profilo. Riprova tra poco.${profileCopy}`;
}

function authGetAccountDiagnostics() {
  authUpdateClientContext();
  const meta = authReadStateMeta();
  const localState = authReadActiveLocalState();
  const hasMeaningfulLocal = authHasMeaningfulState(localState);
  const bootstrapDiag = authGetBootstrapDiagnostics();
  const lastAttempt = authGetLastAttemptDiagnostics();
  const lastSyncedAt = meta.updatedAt || AUTH.lastSyncedAt || null;
  const dirty = false;
  const standaloneSessionNote = '';
  const storageLabel = 'Profilo locale';
  const storageTone = 'local';
  const statusDetail = 'I dati sono salvati solo su questo dispositivo.';
  const syncDetail = 'Salvataggio automatico locale con mirror e snapshot di recupero.';
  const scopeLabel = 'Questo dispositivo';

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
    lastAttempt,
  };
}

function authCurrentBaseStorageKey() {
  return typeof LS_KEY !== 'undefined' ? LS_KEY : 'piano_federico_v2';
}

function authGetAppStorageKey(baseKey = 'piano_federico_v2') {
  return baseKey;
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
  return { label: 'Locale', cls: 'local' };
}

function authRefreshUi() {
  if (typeof renderAuthNav === 'function') renderAuthNav();
  if (typeof renderProfileAccountCard === 'function') renderProfileAccountCard();
}

function authSetBootstrapReady(isReady) {
  AUTH.bootstrapReady = !!isReady;
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
  return false;
}

function authCanUseLocalProxy() {
  return false;
}

function authGetLocalProxyOrigin() {
  try {
    const { protocol, hostname, origin } = window.location || {};
    if (protocol?.startsWith('http') && ['localhost', '127.0.0.1'].includes(hostname)) return origin || '';
    const configured = String(window.MARCI_LOCAL_PROXY_ORIGIN || localStorage.getItem(AUTH_LOCAL_PROXY_ORIGIN_KEY) || '').trim();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured.replace(/\/$/, '');
    if (protocol === 'file:') return AUTH_DEFAULT_LOCAL_PROXY_ORIGIN;
  } catch (_) {}
  return '';
}

function authBuildLocalProxyUrl(path) {
  const cleanPath = String(path || '');
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;
  const origin = authGetLocalProxyOrigin();
  if (!origin) return cleanPath;
  return `${origin}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
}

function authHasProxySession() {
  const session = authLoadProxySession();
  return !!(session?.access_token && session?.user?.id);
}

function authGetProxyAccessToken() {
  return authLoadProxySession()?.access_token || '';
}

async function authProxyJson(path, { method = 'GET', body = null, token = '' } = {}) {
  const headers = {};
  if (body != null) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(authBuildLocalProxyUrl(path), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function authGetSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (!authCanUseSupabase()) return null;
  const cfg = authResolveSupabaseConfig();
  _supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
  return _supabaseClient;
}

async function authSignInViaDirectHttp(email, password) {
  if (!authCanUseSupabase()) {
    return { ok: false, message: 'Servizio di accesso non configurato' };
  }
  try {
    let payload = null;
    if (authCanUseLocalProxy()) {
      const proxyResult = await authWithTimeout(
        authProxyJson('/__auth_proxy/token?grant_type=password', {
          method: 'POST',
          body: { email, password },
        }),
        'Il login diretto sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      if (!proxyResult.ok) {
        const proxyPayload = proxyResult.payload || {};
        return {
          ok: false,
          message: proxyPayload?.msg || proxyPayload?.error_description || proxyPayload?.error || `Auth proxy ${proxyResult.status}`,
          payload: proxyPayload,
        };
      }
      payload = proxyResult.payload || {};
    } else {
      const cfg = authResolveSupabaseConfig();
      const endpoint = `${String(cfg.url || '').replace(/\/+$/, '')}/auth/v1/token?grant_type=password`;
      const response = await authWithTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: cfg.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }),
        'Il login diretto sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          message: payload?.msg || payload?.error_description || payload?.error || `Auth HTTP ${response.status}`,
          payload,
        };
      }
    }
    if (!payload) {
      return {
        ok: false,
        message: 'Il login diretto non ha restituito una risposta valida',
      };
    }
    const user = payload?.user || null;
    const accessToken = payload?.access_token || '';
    const refreshToken = payload?.refresh_token || '';
    if (!user?.id || !accessToken || !refreshToken) {
      return { ok: false, message: 'La risposta auth non contiene una sessione valida', payload };
    }

    authSaveProxySession({
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
      updated_at: new Date().toISOString(),
    });

    if (authCanUseLocalProxy()) {
      authApplySupabaseUser(user);
      return { ok: true, user, session: { access_token: accessToken, refresh_token: refreshToken } };
    }

    const client = authGetSupabaseClient();
    if (client?.auth?.setSession) {
      const { data, error } = await authWithTimeout(
        client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
        'L accesso sta impiegando troppo tempo',
        AUTH_ASYNC_TIMEOUT_MS
      );
      if (error) {
        return { ok: false, message: error.message || 'Accesso non disponibile in questo momento' };
      }
      return {
        ok: true,
        user: data?.user || data?.session?.user || user,
        session: data?.session || null,
      };
    }

    authApplySupabaseUser(user);
    return { ok: true, user, session: { access_token: accessToken, refresh_token: refreshToken } };
  } catch (err) {
    return { ok: false, message: err?.message || 'Login diretto non disponibile in questo momento' };
  }
}

async function authSignUpViaDirectHttp(email, password) {
  if (!authCanUseSupabase()) {
    return { ok: false, message: 'Servizio di accesso non configurato' };
  }
  try {
    let payload = null;
    if (authCanUseLocalProxy()) {
      const proxyResult = await authWithTimeout(
        authProxyJson('/__auth_proxy/signup', {
          method: 'POST',
          body: {
            email,
            password,
            data: { name: String(email || '').split('@')[0] || '' },
          },
        }),
        'La registrazione sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      if (!proxyResult.ok) {
        const proxyPayload = proxyResult.payload || {};
        return {
          ok: false,
          message: proxyPayload?.msg || proxyPayload?.error_description || proxyPayload?.error || `Auth signup ${proxyResult.status}`,
          payload: proxyPayload,
        };
      }
      payload = proxyResult.payload || {};
    } else {
      const cfg = authResolveSupabaseConfig();
      const endpoint = `${String(cfg.url || '').replace(/\/+$/, '')}/auth/v1/signup`;
      const response = await authWithTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: cfg.anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            data: { name: String(email || '').split('@')[0] || '' },
          }),
        }),
        'La registrazione sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          message: payload?.msg || payload?.error_description || payload?.error || `Auth signup ${response.status}`,
          payload,
        };
      }
    }

    const user = payload?.user || null;
    const accessToken = payload?.access_token || payload?.session?.access_token || '';
    const refreshToken = payload?.refresh_token || payload?.session?.refresh_token || '';
    if (!user?.id) {
      return { ok: false, pendingConfirmation: true, message: 'Controlla la tua email per completare l accesso', payload };
    }
    if (accessToken && refreshToken) {
      authSaveProxySession({
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
        updated_at: new Date().toISOString(),
      });
      authApplySupabaseUser(user);
      return { ok: true, user, session: { access_token: accessToken, refresh_token: refreshToken } };
    }
    return { ok: true, pendingConfirmation: true, user, message: 'Ti abbiamo inviato un link. Aprilo e poi torna qui per entrare.' };
  } catch (err) {
    return { ok: false, message: err?.message || 'Registrazione non disponibile in questo momento' };
  }
}

async function authProbeAuthGateway() {
  if (!authCanUseSupabase()) {
    return { ok: false, skipped: true, message: 'Servizio di accesso non configurato' };
  }
  if (typeof window !== 'undefined' && window.__mfFakeSupabaseState && !window.__mfForceGatewayProbe) {
    return { ok: true, message: 'Servizio di accesso disponibile' };
  }
  try {
    if (authCanUseLocalProxy()) {
      return {
        ok: true,
        skipped: true,
        message: 'Servizio di accesso pronto',
      };
    }
    const cfg = authResolveSupabaseConfig();
    const endpoint = `${String(cfg.url || '').replace(/\/+$/, '')}/auth/v1/settings`;
    const response = await authWithTimeout(
      fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: cfg.anonKey,
        },
        cache: 'no-store',
      }),
      'Il servizio di accesso non risponde in tempo',
      4500
    );
    if ([200, 401, 403].includes(response.status)) {
      return { ok: true, status: response.status, message: `Servizio di accesso raggiunto (${response.status})` };
    }
    return { ok: false, status: response.status, message: `Il servizio di accesso ha risposto ${response.status}` };
  } catch (err) {
    return { ok: false, message: err?.message || 'Servizio di accesso non raggiungibile' };
  }
}

function authConfigureSupabase(url, anonKey) {
  return false;
}

function authClearSupabaseConfig() {
  localStorage.removeItem(AUTH_SUPABASE_CONFIG_KEY);
  _supabaseClient = null;
}

function authSetGuestState(options = {}) {
  const { preserveLocalRecovery = false, preserveBootstrapHint = false } = options;
  AUTH.status = 'guest';
  AUTH.provider = 'local_mock';
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
        ? `Abbiamo trovato il profilo di ${AUTH.localRecoveryMeta.name} su questo dispositivo.`
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
      ? `Abbiamo trovato il profilo di ${candidate.name} su questo dispositivo.`
      : 'Abbiamo trovato un profilo su questo dispositivo.'
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
  authMigrateBestLegacyAccountCacheToBase();
  AUTH.status = 'guest';
  AUTH.provider = 'local_mock';
  AUTH.user = null;
  AUTH.sessionReady = true;
  AUTH.needsEmailConfirmation = false;
  AUTH.isSyncing = false;
  AUTH.lastSyncedAt = null;
  authClearLocalRecovery();
  authSetExplicitLogout(false);
  authSetBootstrapHint('local', 'Profilo locale pronto.');
  return AUTH;
}

async function authEnsureRemoteProfile() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) return { ok: false, skipped: true };
  try {
    authRecordAttemptStage('profile_sync', 'pending', 'Controllo profilo base account...');
    if (authCanUseLocalProxy() && authHasProxySession()) {
      const proxyResult = await authWithTimeout(
        authProxyJson('/__supabase_proxy/profiles', {
          method: 'POST',
          token: authGetProxyAccessToken(),
          body: {
            user_id: AUTH.user.id,
            email: AUTH.user.email || '',
            name: AUTH.user.name || '',
            onboarding_completed: !!window.S?.onboardingCompleted,
            updated_at: new Date().toISOString(),
          },
        }),
        'Il profilo sta impiegando troppo tempo a prepararsi',
        AUTH_ASYNC_TIMEOUT_MS
      );
      if (!proxyResult.ok) {
        authRecordAttemptStage('profile_sync', 'error', proxyResult.payload?.message || proxyResult.payload?.error || 'Profilo base non disponibile');
        return { ok: false, message: proxyResult.payload?.message || proxyResult.payload?.error || 'Non siamo riusciti a preparare il profilo' };
      }
      authRecordAttemptStage('profile_sync', 'success', 'Profilo base pronto');
      return { ok: true };
    }
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
        timeoutMessage: 'Il profilo sta impiegando troppo tempo a prepararsi',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) {
      authRecordAttemptStage('profile_sync', 'error', error.message || 'Profilo base non disponibile');
      return { ok: false, message: error.message || 'Non siamo riusciti a preparare il profilo' };
    }
    authRecordAttemptStage('profile_sync', 'success', 'Profilo base pronto');
    return { ok: true };
  } catch (err) {
    authRecordAttemptStage('profile_sync', 'error', err?.message || 'Profilo base non disponibile');
    return { ok: false, message: err?.message || 'Non siamo riusciti a preparare il profilo' };
  }
}

async function authFetchRemoteStateRow() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) return { ok: false, skipped: true };
  try {
    if (authCanUseLocalProxy() && authHasProxySession()) {
      const proxyResult = await authWithTimeout(
        authProxyJson(`/__supabase_proxy/app_state?user_id=${encodeURIComponent(AUTH.user.id)}`, {
          token: authGetProxyAccessToken(),
        }),
        'Il profilo sta impiegando troppo tempo ad aprirsi',
        AUTH_ASYNC_TIMEOUT_MS
      );
      if (!proxyResult.ok) return { ok: false, message: proxyResult.payload?.message || proxyResult.payload?.error || 'Non siamo riusciti a recuperare il profilo' };
      return { ok: true, row: proxyResult.payload || null };
    }
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
        timeoutMessage: 'Il profilo sta impiegando troppo tempo ad aprirsi',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Non siamo riusciti a recuperare il profilo' };
    return { ok: true, row: data || null };
  } catch (err) {
    return { ok: false, message: err?.message || 'Non siamo riusciti a recuperare il profilo' };
  }
}

function authNormalizeSharedBarcodePayload(item = {}, { includeAudit = false } = {}) {
  const barcode = String(item?.barcode || '').replace(/\D/g, '');
  const name = String(item?.name || '').trim().slice(0, 120);
  const brand = String(item?.brand || '').trim().slice(0, 60);
  const quantity = String(item?.quantity || '').trim().slice(0, 40);
  const kcal100 = Math.round(Number(item?.kcal100 || 0));
  const p100 = Math.round(Number(item?.p100 || 0) * 10) / 10;
  const c100 = Math.round(Number(item?.c100 || 0) * 10) / 10;
  const f100 = Math.round(Number(item?.f100 || 0) * 10) / 10;
  if (!barcode || !name || !Number.isFinite(kcal100) || kcal100 <= 0) return null;
  const hasFullMacros = [p100, c100, f100].every(val => Number.isFinite(val) && val >= 0)
    && (p100 > 0 || c100 > 0 || f100 > 0);
  const completenessScore = (name ? 1 : 0) + (kcal100 > 0 ? 2 : 0) + (hasFullMacros ? 2 : 0) + ((brand || quantity) ? 1 : 0);
  const payload = {
    barcode,
    name,
    brand,
    quantity,
    kcal100,
    p100: Number.isFinite(p100) ? p100 : 0,
    c100: Number.isFinite(c100) ? c100 : 0,
    f100: Number.isFinite(f100) ? f100 : 0,
    source: item?.source === 'off' ? 'off' : 'user_manual',
    completeness_score: Number(item?.completeness_score || item?.completeness || completenessScore) || completenessScore,
    updated_at: item?.updated_at || item?.updatedAt || new Date().toISOString(),
  };
  if (includeAudit && AUTH.user?.id) payload.created_by = AUTH.user.id;
  return payload;
}

async function authFetchSharedBarcode(barcode) {
  const normalizedBarcode = String(barcode || '').replace(/\D/g, '');
  if (!normalizedBarcode) return { ok: false, skipped: true, reason: 'invalid_barcode' };
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) {
    return { ok: false, skipped: true };
  }
  try {
    if (authCanUseLocalProxy() && authHasProxySession()) {
      try {
        const proxyResult = await authWithTimeout(
          authProxyJson(`/__supabase_proxy/barcode_catalog?barcode=${encodeURIComponent(normalizedBarcode)}`, {
            token: authGetProxyAccessToken(),
          }),
          'Il catalogo barcode condiviso sta impiegando troppo tempo a rispondere',
          AUTH_ASYNC_TIMEOUT_MS
        );
        if (proxyResult.ok) {
          return { ok: true, row: authNormalizeSharedBarcodePayload(proxyResult.payload || {}) };
        }
      } catch (_) {
        // Fallback diretto Supabase qui sotto.
      }
    }
    const client = authGetSupabaseClient();
    const { data, error } = await authRunWithRetry(
      () => client
        .from('barcode_catalog')
        .select('barcode, name, brand, quantity, kcal100, p100, c100, f100, source, completeness_score, updated_at, created_by')
        .eq('barcode', normalizedBarcode)
        .maybeSingle(),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
        timeoutMessage: 'Il catalogo barcode condiviso sta impiegando troppo tempo a rispondere',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Catalogo barcode non disponibile' };
    return { ok: true, row: authNormalizeSharedBarcodePayload(data || {}) };
  } catch (err) {
    return { ok: false, message: err?.message || 'Catalogo barcode non disponibile' };
  }
}

async function authUpsertSharedBarcode(item) {
  const payload = authNormalizeSharedBarcodePayload(item, { includeAudit: true });
  if (!payload) return { ok: false, skipped: true, reason: 'invalid_payload' };
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) {
    return { ok: false, skipped: true };
  }
  try {
    if (authCanUseLocalProxy() && authHasProxySession()) {
      try {
        const proxyResult = await authWithTimeout(
          authProxyJson('/__supabase_proxy/barcode_catalog', {
            method: 'POST',
            token: authGetProxyAccessToken(),
            body: payload,
          }),
          'Il catalogo barcode condiviso sta impiegando troppo tempo ad aggiornarsi',
          AUTH_ASYNC_TIMEOUT_MS
        );
        if (proxyResult.ok) return { ok: true, row: authNormalizeSharedBarcodePayload(proxyResult.payload || payload) };
      } catch (_) {
        // Fallback diretto Supabase qui sotto.
      }
    }
    const client = authGetSupabaseClient();
    const { data, error } = await authRunWithRetry(
      () => client
        .from('barcode_catalog')
        .upsert(payload, { onConflict: 'barcode' })
        .select('barcode, name, brand, quantity, kcal100, p100, c100, f100, source, completeness_score, updated_at, created_by')
        .maybeSingle(),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_ASYNC_TIMEOUT_MS,
        timeoutMessage: 'Il catalogo barcode condiviso sta impiegando troppo tempo ad aggiornarsi',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Aggiornamento catalogo barcode non riuscito' };
    return { ok: true, row: authNormalizeSharedBarcodePayload(data || payload) };
  } catch (err) {
    return { ok: false, message: err?.message || 'Aggiornamento catalogo barcode non riuscito' };
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

function authStateSignificanceScore(state) {
  if (!state || typeof state !== 'object') return 0;
  let score = 0;
  if (state.onboardingCompleted) score += 20;
  if (String(state.anagrafica?.nome || '').trim()) score += 10;
  if (Number.isFinite(Number(state.anagrafica?.peso)) && Number(state.anagrafica.peso) > 0) score += 8;
  if (Array.isArray(state.weightLog)) score += Math.min(30, state.weightLog.length * 3);
  if (Array.isArray(state.measurements)) score += Math.min(24, state.measurements.length * 3);
  if (Array.isArray(state.customFoods)) score += Math.min(20, state.customFoods.length * 2);
  if (Array.isArray(state.favoriteFoods)) score += Math.min(20, state.favoriteFoods.length * 2);
  ['foodLog', 'doneByDate', 'notes', 'water', 'cheatMealsByDate'].forEach(key => {
    if (state[key] && typeof state[key] === 'object' && !Array.isArray(state[key])) {
      score += Math.min(30, Object.keys(state[key]).length * 2);
    }
  });
  return score;
}

function authReadLegacyAccountCacheEntries() {
  const baseKey = authCurrentBaseStorageKey();
  const prefix = `${baseKey}__acct_`;
  const entries = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      const state = authParseRemoteState(raw);
      if (!authHasMeaningfulState(state)) continue;
      entries.push({
        key,
        raw,
        state,
        score: authStateSignificanceScore(state),
        updatedAt: state?._localSavedAt || null,
      });
    }
  } catch (_) {}
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (Date.parse(b.updatedAt || 0) || 0) - (Date.parse(a.updatedAt || 0) || 0);
  });
  return entries;
}

function authMigrateBestLegacyAccountCacheToBase() {
  const baseKey = authCurrentBaseStorageKey();
  try {
    const baseRaw = localStorage.getItem(baseKey);
    const baseState = authParseRemoteState(baseRaw);
    const baseScore = authStateSignificanceScore(baseState);
    const best = authReadLegacyAccountCacheEntries()[0];
    if (!best || best.score <= baseScore) return { migrated: false, reason: 'base_preferred' };
    const raw = JSON.stringify({
      ...best.state,
      authEntryCompleted: true,
      _localMigratedFrom: best.key,
      _localMigratedAt: new Date().toISOString(),
    });
    if (typeof storageCommitRaw === 'function') {
      storageCommitRaw(baseKey, raw, { source: 'legacy_account_migration' });
    } else {
      localStorage.setItem(baseKey, raw);
    }
    authSetBootstrapHint('local_resume', 'Profilo locale recuperato da una vecchia cache account.');
    return { migrated: true, from: best.key, score: best.score };
  } catch (err) {
    if (typeof mfWarn === 'function') mfWarn('auth', 'legacy local profile migration failed', { message: err?.message });
    return { migrated: false, reason: 'failed', message: err?.message || '' };
  }
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

function authStableStateStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(authStableStateStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${authStableStateStringify(value[key])}`).join(',')}}`;
}

function authStatesAreEquivalent(localState, remoteState) {
  if (!localState || !remoteState) return false;
  try {
    return authStableStateStringify(localState) === authStableStateStringify(remoteState);
  } catch (_) {
    return false;
  }
}

function authEstimateStateRichness(state) {
  if (!state || typeof state !== 'object') return 0;
  let score = 0;
  score += Array.isArray(state.weightLog) ? state.weightLog.length * 4 : 0;
  score += Array.isArray(state.measurements) ? state.measurements.length * 4 : 0;
  score += Array.isArray(state.customFoods) ? state.customFoods.length * 2 : 0;
  score += Array.isArray(state.favoriteFoods) ? state.favoriteFoods.length * 2 : 0;
  score += state.foodLog && typeof state.foodLog === 'object' ? Object.keys(state.foodLog).length * 5 : 0;
  score += state.doneByDate && typeof state.doneByDate === 'object' ? Object.keys(state.doneByDate).length * 3 : 0;
  score += state.notes && typeof state.notes === 'object' ? Object.keys(state.notes).length * 2 : 0;
  score += state.water && typeof state.water === 'object' ? Object.keys(state.water).length * 2 : 0;
  score += state.cheatMealsByDate && typeof state.cheatMealsByDate === 'object' ? Object.keys(state.cheatMealsByDate).length * 2 : 0;
  score += state.onboardingCompleted ? 3 : 0;
  score += String(state.anagrafica?.nome || '').trim() ? 2 : 0;
  score += Number.isFinite(Number(state.anagrafica?.peso)) && Number(state.anagrafica?.peso) > 0 ? 2 : 0;
  return score;
}

function authResolvePreferredState({
  localState,
  remoteState,
  localUpdatedAt,
  remoteUpdatedAt,
  localDirty = false,
}) {
  const hasMeaningfulLocal = authHasMeaningfulState(localState);
  const hasMeaningfulRemote = authHasMeaningfulState(remoteState);
  const localAt = Date.parse(localUpdatedAt || 0) || 0;
  const remoteAt = Date.parse(remoteUpdatedAt || 0) || 0;
  const equivalent = authStatesAreEquivalent(localState, remoteState);
  const localRichness = authEstimateStateRichness(localState);
  const remoteRichness = authEstimateStateRichness(remoteState);

  if (equivalent) {
    return {
      choice: remoteAt && remoteAt >= localAt ? 'remote' : 'local',
      reason: 'equivalent_state',
      equivalent,
      localRichness,
      remoteRichness,
    };
  }
  if (!hasMeaningfulLocal && hasMeaningfulRemote) {
    return { choice: 'remote', reason: 'remote_only', equivalent, localRichness, remoteRichness };
  }
  if (hasMeaningfulLocal && !hasMeaningfulRemote) {
    return { choice: 'local', reason: 'local_only', equivalent, localRichness, remoteRichness };
  }
  if (localAt && remoteAt && localAt !== remoteAt) {
    return {
      choice: remoteAt > localAt ? 'remote' : 'local',
      reason: remoteAt > localAt ? 'remote_newer' : 'local_newer',
      equivalent,
      localRichness,
      remoteRichness,
    };
  }
  if (localRichness !== remoteRichness) {
    return {
      choice: localRichness > remoteRichness ? 'local' : 'remote',
      reason: localRichness > remoteRichness ? 'local_richer' : 'remote_richer',
      equivalent,
      localRichness,
      remoteRichness,
    };
  }
  if (remoteAt && !localAt) {
    return { choice: 'remote', reason: 'remote_timestamp_only', equivalent, localRichness, remoteRichness };
  }
  if (localAt && !remoteAt) {
    return { choice: 'local', reason: 'local_timestamp_only', equivalent, localRichness, remoteRichness };
  }
  if (localDirty) {
    return { choice: 'local', reason: 'local_dirty', equivalent, localRichness, remoteRichness };
  }
  return { choice: 'remote', reason: 'default_remote', equivalent, localRichness, remoteRichness };
}

async function authHydrateLocalCacheFromRemote() {
  return { ok: true, skipped: true, localOnly: true };
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
  const result = await authRunSignupFlow({ email, password });
  return {
    ...result,
    message: authUserMessage(result),
  };
}

async function authRunSignupFlow({ email, password, confirmPassword = null } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!authValidateEmail(cleanEmail)) {
    return authCreateFlowResult({
      ok: false,
      code: 'invalid_email',
      stage: 'preflight',
      source: authCanUseSupabase() ? 'proxy' : 'local_mock',
    });
  }
  if (!authValidatePassword(password)) {
    return authCreateFlowResult({
      ok: false,
      code: 'weak_password',
      stage: 'preflight',
      source: authCanUseSupabase() ? 'proxy' : 'local_mock',
    });
  }
  if (confirmPassword != null && String(password) !== String(confirmPassword)) {
    return authCreateFlowResult({
      ok: false,
      code: 'password_mismatch',
      stage: 'preflight',
      source: authCanUseSupabase() ? 'proxy' : 'local_mock',
    });
  }
  if (authCanUseSupabase()) {
    if (authCanUseLocalProxy()) {
      try {
        authStartAttempt('signup', cleanEmail);
        authRecordAttemptStage('auth_gateway', 'pending', 'Preparazione accesso...');
        authRecordAttemptStage('sign_in', 'pending', 'Creazione profilo...');
        const proxyResult = await authSignUpViaDirectHttp(cleanEmail, password);
        if (!proxyResult.ok) {
          if (proxyResult.pendingConfirmation) {
            return authCreateFlowResult({
              ok: true,
              code: 'pending_confirmation',
              stage: 'credential_exchange',
              source: 'proxy',
              extra: { pendingConfirmation: true },
            });
          }
          const code = proxyResult.message?.toLowerCase().includes('already')
            ? 'email_exists'
            : authShouldRetryTransientError({ message: proxyResult.message })
              ? 'network_unavailable'
              : 'unknown_error';
          authRecordAttemptStage('sign_in', 'error', authUserMessage({ code }));
          return authCreateFlowResult({
            ok: false,
            code,
            stage: 'credential_exchange',
            source: 'proxy',
            retryable: code === 'network_unavailable',
            diagnostics: [{ message: proxyResult.message || '' }],
          });
        }
        if (proxyResult.pendingConfirmation) {
          AUTH.status = 'guest';
          AUTH.provider = 'supabase';
          AUTH.user = null;
          AUTH.sessionReady = true;
          AUTH.needsEmailConfirmation = true;
          authSetBootstrapHint('awaiting_email', 'Controlla la tua email per confermare l accesso.');
          return authCreateFlowResult({
            ok: true,
            code: 'pending_confirmation',
            stage: 'credential_exchange',
            source: 'proxy',
            extra: { pendingConfirmation: true },
          });
        }
        authSeedAccountStateFromGuest(proxyResult.user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Account creato. Stiamo preparando il tuo profilo.');
        const profileResult = await authEnsureRemoteProfile();
        authRecordAttemptStage('done', 'success', 'Profilo pronto');
        return authCreateFlowResult({
          ok: true,
          code: 'signup_success',
          stage: profileResult?.ok === false ? 'sync_pending' : 'remote_profile',
          source: 'proxy',
          user: AUTH.user,
          session: proxyResult.session || null,
          retryable: profileResult?.ok === false,
          diagnostics: profileResult?.ok === false ? [{ message: profileResult.message || '' }] : [],
        });
      } catch (proxyErr) {
        authRecordAttemptStage('sign_in', 'error', authUserMessage({ code: 'network_unavailable' }));
        return authCreateFlowResult({
          ok: false,
          code: 'network_unavailable',
          stage: 'credential_exchange',
          source: 'proxy',
          retryable: true,
          diagnostics: [{ message: proxyErr?.message || '' }],
        });
      }
    }
    try {
      authStartAttempt('signup', cleanEmail);
      authRecordAttemptStage('auth_gateway', 'pending', 'Preparazione accesso...');
      const client = authGetSupabaseClient();
      authRecordAttemptStage('sign_in', 'pending', 'Creazione profilo...');
      const { data, error } = await authWithTimeout(
        client.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { name: cleanEmail.split('@')[0] } },
        }),
        'La registrazione sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      if (error) {
        const code = authIsInvalidCredentialsMessage(error.message) ? 'invalid_credentials' : 'unknown_error';
        authRecordAttemptStage('sign_in', 'error', authUserMessage({ code }));
        return authCreateFlowResult({
          ok: false,
          code,
          stage: 'credential_exchange',
          source: 'sdk',
          retryable: code !== 'invalid_credentials',
          diagnostics: [{ message: error.message || '' }],
        });
      }
      const user = data?.user;
      if (!user) {
        return authCreateFlowResult({
          ok: true,
          code: 'pending_confirmation',
          stage: 'credential_exchange',
          source: 'sdk',
          extra: { pendingConfirmation: true },
        });
      }
      if (data?.session?.user) {
        authApplySupabaseUser(data.session.user);
        authSeedAccountStateFromGuest(data.session.user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Account creato. Stiamo preparando il tuo profilo.');
        await authEnsureRemoteProfile();
        authRecordAttemptStage('done', 'success', 'Profilo pronto');
        return authCreateFlowResult({
          ok: true,
          code: 'signup_success',
          stage: 'sync_pending',
          source: 'sdk',
          user: AUTH.user,
          session: data.session || null,
        });
      }
      AUTH.status = 'guest';
      AUTH.provider = 'supabase';
      AUTH.user = null;
      AUTH.sessionReady = true;
      AUTH.needsEmailConfirmation = true;
      authSetBootstrapHint('awaiting_email', 'Controlla la tua email per confermare l accesso.');
      return authCreateFlowResult({
        ok: true,
        code: 'pending_confirmation',
        stage: 'credential_exchange',
        source: 'sdk',
        extra: { pendingConfirmation: true },
      });
    } catch (err) {
      authRecordAttemptStage('sign_in', 'error', authUserMessage({ code: 'network_unavailable' }));
      return authCreateFlowResult({
        ok: false,
        code: authShouldRetryTransientError(err) ? 'network_unavailable' : 'unknown_error',
        stage: 'credential_exchange',
        source: 'sdk',
        retryable: authShouldRetryTransientError(err),
        diagnostics: [{ message: err?.message || '' }],
      });
    }
  }
  const localResult = signUpLocal(cleanEmail, password);
  if (!localResult.ok) {
    const code = localResult.message?.includes('Esiste') ? 'email_exists' : 'unknown_error';
    return authCreateFlowResult({
      ok: false,
      code,
      stage: 'credential_exchange',
      source: 'local_mock',
      message: authUserMessage({ code }) || localResult.message,
    });
  }
  return authCreateFlowResult({
    ok: true,
    code: 'signup_success',
    stage: 'session_ready',
    source: 'local_mock',
    user: AUTH.user,
  });
}

async function signInWithEmail(email, password) {
  const result = await authRunLoginFlow({ email, password });
  return {
    ...result,
    message: authUserMessage(result),
  };
}

async function authRunLoginFlow({ email, password } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!authValidateEmail(cleanEmail)) {
    return authCreateFlowResult({
      ok: false,
      code: 'invalid_email',
      stage: 'preflight',
      source: authCanUseSupabase() ? 'proxy' : 'local_mock',
    });
  }
  if (!password) {
    return authCreateFlowResult({
      ok: false,
      code: 'invalid_credentials',
      stage: 'preflight',
      source: authCanUseSupabase() ? 'proxy' : 'local_mock',
    });
  }
  if (authCanUseSupabase()) {
    authStartAttempt('login', cleanEmail);
    authRecordAttemptStage('auth_gateway', 'pending', 'Preparazione accesso...');

    if (authCanUseLocalProxy()) {
      try {
        authRecordAttemptStage('sign_in', 'pending', 'Accesso in corso...');
        const proxyResult = await authSignInViaDirectHttp(cleanEmail, password);
        if (!proxyResult.ok) {
          const code = authIsInvalidCredentialsMessage(proxyResult.message)
            ? 'invalid_credentials'
            : authShouldRetryTransientError({ message: proxyResult.message })
              ? 'network_unavailable'
              : 'unknown_error';
          if (code === 'network_unavailable') {
            const recoveryResult = authRecoverLocalProfile('proxy_login_failed');
            if (recoveryResult.ok) return recoveryResult;
          }
          authRecordAttemptStage('sign_in', 'error', authUserMessage({ code }));
          return authCreateFlowResult({
            ok: false,
            code,
            stage: 'credential_exchange',
            source: 'proxy',
            retryable: code !== 'invalid_credentials',
            diagnostics: [{ message: proxyResult.message || '' }],
          });
        }
        authRecordAttemptStage('sign_in', 'success', 'Accesso riuscito');
        authSeedAccountStateFromGuest(proxyResult.user.id, { markDirty: true });
        authSetBootstrapHint('account_connected', 'Bentornato. Stiamo aprendo il tuo profilo.');
        const profileResult = await authEnsureRemoteProfile();
        const storageKey = authGetAppStorageKey(authCurrentBaseStorageKey());
        const localRaw = localStorage.getItem(storageKey);
        const localState = authParseRemoteState(localRaw);
        if (!authHasMeaningfulState(localState)) authClearLocalStateMeta();
        return authCreateFlowResult({
          ok: true,
          code: 'success',
          stage: profileResult?.ok === false ? 'sync_pending' : 'remote_profile',
          source: 'proxy',
          user: AUTH.user,
          session: proxyResult.session || null,
          retryable: profileResult?.ok === false,
          diagnostics: profileResult?.ok === false ? [{ message: profileResult.message || '' }] : [],
        });
      } catch (proxyErr) {
        const recoveryResult = authRecoverLocalProfile('proxy_exception');
        if (recoveryResult.ok) return recoveryResult;
        authRecordAttemptStage('sign_in', 'error', authUserMessage({ code: 'network_unavailable' }));
        return {
          ...authCreateFlowResult({
            ok: false,
            code: 'network_unavailable',
            stage: 'credential_exchange',
            source: 'proxy',
            retryable: true,
            diagnostics: [{ message: proxyErr?.message || '' }],
          }),
        };
      }
    }

    try {
      const gatewayProbe = await authProbeAuthGateway();
      if (!gatewayProbe.ok) {
        const recoveryResult = authRecoverLocalProfile('gateway_probe_failed');
        if (recoveryResult.ok) return recoveryResult;
        authRecordAttemptStage('auth_gateway', 'error', authUserMessage({ code: 'network_unavailable' }));
        return authCreateFlowResult({
          ok: false,
          code: 'network_unavailable',
          stage: 'preflight',
          source: 'sdk',
          retryable: true,
          diagnostics: [{ message: gatewayProbe.message || '' }],
        });
      }
      authRecordAttemptStage('auth_gateway', 'success', 'Accesso pronto');
      authRecordAttemptStage('sign_in', 'pending', 'Accesso in corso...');
      const client = authGetSupabaseClient();
      let data = null;
      let error = null;
      try {
        ({ data, error } = await authWithTimeout(
          client.auth.signInWithPassword({ email: cleanEmail, password }),
          'L accesso sta impiegando troppo tempo',
          AUTH_LOGIN_TIMEOUT_MS
        ));
      } catch (sdkErr) {
        if (!authShouldRetryTransientError(sdkErr)) throw sdkErr;
        if (!authIsTimeoutError(sdkErr)) {
          authRecordAttemptStage('sign_in', 'pending', 'Accesso in corso...');
          try {
            ({ data, error } = await authWithTimeout(
              client.auth.signInWithPassword({ email: cleanEmail, password }),
              'L accesso sta impiegando troppo tempo',
              AUTH_LOGIN_TIMEOUT_MS
            ));
          } catch (retryErr) {
            if (!authShouldRetryTransientError(retryErr)) throw retryErr;
            sdkErr = retryErr;
          }
        }
        authRecordAttemptStage('sign_in_fallback', 'pending', 'Accesso in corso...');
        if (!data && !error) {
          const fallbackResult = await authSignInViaDirectHttp(cleanEmail, password);
          if (!fallbackResult.ok) {
            const recoveryResult = authRecoverLocalProfile('sdk_and_direct_failed');
            if (recoveryResult.ok) return recoveryResult;
            return authCreateFlowResult({
              ok: false,
              code: 'network_unavailable',
              stage: 'credential_exchange',
              source: 'sdk',
              retryable: true,
              diagnostics: [{ message: fallbackResult.message || sdkErr?.message || '' }],
            });
          }
          data = { user: fallbackResult.user, session: fallbackResult.session || null };
          error = null;
        }
      }
      if (error) {
        const code = authIsInvalidCredentialsMessage(error.message) ? 'invalid_credentials' : 'unknown_error';
        authRecordAttemptStage('sign_in', 'error', authUserMessage({ code }));
        return authCreateFlowResult({
          ok: false,
          code,
          stage: 'credential_exchange',
          source: 'sdk',
          retryable: code !== 'invalid_credentials',
          diagnostics: [{ message: error.message || '' }],
        });
      }
      const user = data?.user;
      if (!user) {
        authRecordAttemptStage('sign_in', 'error', authUserMessage({ code: 'unknown_error' }));
        return authCreateFlowResult({
          ok: false,
          code: 'unknown_error',
          stage: 'session_ready',
          source: 'sdk',
          retryable: true,
        });
      }
      authRecordAttemptStage('sign_in', 'success', 'Accesso riuscito');
      authApplySupabaseUser(user);
      authSeedAccountStateFromGuest(user.id, { markDirty: true });
      authSetBootstrapHint('account_connected', 'Bentornato. Stiamo aprendo il tuo profilo.');
      const profileResult = await authEnsureRemoteProfile();
      const storageKey = authGetAppStorageKey(authCurrentBaseStorageKey());
      const localRaw = localStorage.getItem(storageKey);
      const localState = authParseRemoteState(localRaw);
      if (!authHasMeaningfulState(localState)) authClearLocalStateMeta();
      return authCreateFlowResult({
        ok: true,
        code: 'success',
        stage: profileResult?.ok === false ? 'sync_pending' : 'remote_profile',
        source: 'sdk',
        user: AUTH.user,
        session: data.session || null,
        retryable: profileResult?.ok === false,
        diagnostics: profileResult?.ok === false ? [{ message: profileResult.message || '' }] : [],
      });
    } catch (err) {
      const recoveryResult = authRecoverLocalProfile('sdk_exception');
      if (authShouldRetryTransientError(err) && recoveryResult.ok) return recoveryResult;
      const code = authShouldRetryTransientError(err) ? 'network_unavailable' : 'unknown_error';
      authRecordAttemptStage('sign_in', 'error', authUserMessage({ code }));
      return authCreateFlowResult({
        ok: false,
        code,
        stage: 'credential_exchange',
        source: 'sdk',
        retryable: code === 'network_unavailable',
        diagnostics: [{ message: err?.message || '' }],
      });
    }
  }
  const localResult = signInLocal(cleanEmail, password);
  if (!localResult.ok) {
    return authCreateFlowResult({
      ok: false,
      code: 'invalid_credentials',
      stage: 'credential_exchange',
      source: 'local_mock',
      diagnostics: [{ message: localResult.message || '' }],
    });
  }
  return authCreateFlowResult({
    ok: true,
    code: 'success',
    stage: 'session_ready',
    source: 'local_mock',
    user: AUTH.user,
  });
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

async function authChangePassword(newPassword) {
  const password = String(newPassword || '');
  if (!authIsAuthenticated()) {
    return { ok: false, message: 'Accedi di nuovo per cambiare password.' };
  }
  if (!authValidatePassword(password)) {
    return { ok: false, message: 'La password deve avere almeno 8 caratteri.' };
  }
  if (AUTH.provider !== 'supabase' || !authCanUseSupabase()) {
    return { ok: false, message: 'Cambio password disponibile solo per account collegati.' };
  }
  try {
    if (authCanUseLocalProxy() && authHasProxySession()) {
      const cfg = authResolveSupabaseConfig();
      const endpoint = `${String(cfg.url || '').replace(/\/+$/, '')}/auth/v1/user`;
      const response = await authWithTimeout(
        fetch(endpoint, {
          method: 'PUT',
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${authGetProxyAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        }),
        'Il cambio password sta impiegando troppo tempo',
        AUTH_LOGIN_TIMEOUT_MS
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, message: payload?.msg || payload?.error_description || payload?.error || 'Password non aggiornata.' };
      }
      return { ok: true, message: 'Password aggiornata.' };
    }

    const client = authGetSupabaseClient();
    const { error } = await authRunWithRetry(
      () => client.auth.updateUser({ password }),
      {
        attempts: AUTH_REMOTE_RETRY_ATTEMPTS,
        timeoutMs: AUTH_LOGIN_TIMEOUT_MS,
        timeoutMessage: 'Il cambio password sta impiegando troppo tempo',
        retryDelayMs: AUTH_REMOTE_RETRY_DELAY_MS,
      }
    );
    if (error) return { ok: false, message: error.message || 'Password non aggiornata.' };
    return { ok: true, message: 'Password aggiornata.' };
  } catch (err) {
    return { ok: false, message: err?.message || 'Password non aggiornata.' };
  }
}

function openAccountPasswordChange() {
  if (typeof toast === 'function') toast('Profilo locale: non serve nessuna password.');
}

async function submitAccountPasswordChange() {
  if (typeof toast === 'function') toast('Profilo locale: non serve nessuna password.');
}

async function signOutUser() {
  authSaveSession(null);
  authSaveProxySession(null);
  authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('Profilo locale gia attivo su questo dispositivo.');
}

function confirmSignOutUser() {
  if (typeof toast === 'function') toast('Profilo locale: non c e un account da cui uscire.');
}

function authOnLocalStateSaved(raw, options = {}) {
  const now = new Date().toISOString();
  const meta = authReadStateMeta();
  const updatedAt = options.preserveMetaTimestamp
    ? (meta.updatedAt || now)
    : now;
  const nextMeta = {
    ...meta,
    updatedAt,
    dirty: false,
    localOnly: true,
  };
  authWriteStateMeta(nextMeta);
}

async function authSyncStateToCloud(force = false) {
  return { ok: true, skipped: true, localOnly: true };
}

function authQueueStateSync(delay = AUTH_SYNC_DELAY_MS) {
  clearTimeout(_authSyncTimer);
  AUTH.isSyncing = false;
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
  authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('🧹 Vecchie credenziali locali rimosse');
}

async function authSyncNow() {
  if (typeof toast === 'function') toast('✅ Dati salvati su questo dispositivo');
}

function renderAuthNav() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;
  const status = authStatusMeta();
  const label = String(window.S?.anagrafica?.nome || '').trim() || 'Profilo locale';
  slot.innerHTML = `
    <button class="local-profile-nav-chip" onclick="goView('profilo')" title="Apri profilo locale">
      <span class="local-profile-nav-icon"><i data-lucide="user-check"></i></span>
      <span class="local-profile-nav-copy">
        <span class="auth-nav-copy">${htmlEsc(label)}</span>
        <span class="auth-nav-state ${status.cls}">${htmlEsc(status.label)}</span>
      </span>
    </button>`;
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function renderProfileAccountCard() {
  const el = document.getElementById('profile-account-slot');
  if (!el) return;
  const accountDiag = authGetAccountDiagnostics();
  const showDevUi = authShowDevelopmentUi();
  const factGrid = showDevUi ? `
    <div class="local-profile-debug-grid">
      <div class="local-profile-debug-item">
        <span>Dati</span>
        <strong>${htmlEsc(accountDiag.storageLabel)}</strong>
      </div>
      <div class="local-profile-debug-item">
        <span>Contesto</span>
        <strong>${htmlEsc(accountDiag.contextLabel)}</strong>
      </div>
      <div class="local-profile-debug-item">
        <span>Ingresso</span>
        <strong>${htmlEsc(accountDiag.sourceLabel)}</strong>
      </div>
      <div class="local-profile-debug-item">
        <span>Salvataggio</span>
        <strong>${htmlEsc(accountDiag.scopeLabel)}</strong>
      </div>
    </div>` : '';
  const backupMeta = showDevUi ? authGetLatestBackupMeta() : null;
  const backupLabel = backupMeta
    ? `${authFormatSyncTime(backupMeta.createdAt)} · ${authFormatBackupSource(backupMeta.source)}`
    : '';
  const notes = [
    accountDiag.syncDetail,
    accountDiag.sourceDetail,
    backupMeta
      ? `Copia di sicurezza locale: ${backupLabel}.`
      : 'La prima copia di sicurezza parte automaticamente appena inizi a salvare dati.',
  ].filter(Boolean);
  const notesHtml = showDevUi ? `
    <div class="local-profile-debug-notes">
      ${notes.map(note => `<div class="local-profile-debug-note">${htmlEsc(note)}</div>`).join('')}
    </div>` : '';
  const attemptDiagHtml = showDevUi && accountDiag.lastAttempt ? `
    <div class="auth-attempt-box auth-attempt-box-inline">
      <div class="auth-attempt-head">Diagnostica ultimo tentativo${accountDiag.lastAttempt.email ? ` · ${htmlEsc(accountDiag.lastAttempt.email)}` : ''}</div>
      ${accountDiag.lastAttempt.lines.map(line => `
        <div class="auth-attempt-row ${line.status}">
          <span class="auth-attempt-stage">${htmlEsc(line.label)}</span>
          <span class="auth-attempt-meta">${htmlEsc(line.elapsedLabel)}</span>
          <span class="auth-attempt-msg">${htmlEsc(line.message || '')}</span>
        </div>
      `).join('')}
    </div>` : '';
  const devPanel = showDevUi ? `
    <div class="local-profile-debug-panel">
      <div class="local-profile-debug-title">Strumenti sviluppo</div>
      <div class="local-profile-debug-sub">Diagnostica e controlli interni restano fuori dalla UI prodotto.</div>
      <div class="local-profile-debug-note">Contesto: ${htmlEsc(accountDiag.contextLabel)} · ingresso: ${htmlEsc(accountDiag.sourceLabel)}</div>
      ${accountDiag.sourceDetail ? `<div class="local-profile-debug-note">${htmlEsc(accountDiag.sourceDetail)}</div>` : ''}
      <div class="local-profile-actions debug">
        <button class="local-profile-action compact" onclick="authClearLocalAccounts()">Pulisci vecchie credenziali</button>
      </div>
    </div>` : '';
  const profileName = String(window.S?.anagrafica?.nome || '').trim() || 'Profilo locale';
  el.innerHTML = `
    <div class="profile-inline-card local-profile-panel">
      <div class="local-profile-hero">
        <div class="local-profile-mark" aria-hidden="true">
          <i data-lucide="hard-drive"></i>
        </div>
        <div class="local-profile-copy">
          <div class="local-profile-kicker">Profilo locale</div>
          <div class="local-profile-title">${htmlEsc(profileName)}</div>
          <div class="local-profile-sub">Salvato su questo dispositivo.</div>
        </div>
      </div>
      ${factGrid}
      ${notesHtml}
      ${attemptDiagHtml}
      <div class="local-profile-actions">
        <button class="local-profile-action primary" onclick="openProfileSection('dati')">
          <span class="local-profile-action-icon"><i data-lucide="database-backup"></i></span>
          <span>Dati e backup</span>
        </button>
        <button class="local-profile-action" onclick="exportJSON()">
          <span class="local-profile-action-icon"><i data-lucide="download"></i></span>
          <span>Esporta</span>
        </button>
        <button class="local-profile-action" onclick="loadJSON()">
          <span class="local-profile-action-icon"><i data-lucide="upload"></i></span>
          <span>Importa</span>
        </button>
      </div>
      ${devPanel}
    </div>`;
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}
