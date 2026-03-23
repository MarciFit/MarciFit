// authSync.js — auth/session layer with optional Supabase provider and local fallback

const AUTH_USERS_KEY = 'marcifit_auth_users_v1';
const AUTH_SESSION_KEY = 'marcifit_auth_session_v1';
const AUTH_SUPABASE_CONFIG_KEY = 'marcifit_supabase_config_v1';
const AUTH_STATE_META_KEY = 'marcifit_state_meta_v1';
const AUTH_STATE_BACKUP_KEY = 'marcifit_state_backup_v1';
const AUTH_SYNC_DELAY_MS = 900;
const AUTH_POST_LOGOUT_MODE_KEY = 'marcifit_post_logout_mode_v1';

const AUTH = {
  status: 'guest',
  provider: 'local_mock',
  user: null,
  sessionReady: false,
  isSyncing: false,
  lastSyncedAt: null,
  needsEmailConfirmation: false,
  bootstrapReady: false,
};

let _supabaseClient = null;
let _authSyncTimer = null;
let _supabaseAuthSubscription = null;

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

function authCurrentBaseStorageKey() {
  return typeof LS_KEY !== 'undefined' ? LS_KEY : 'piano_federico_v2';
}

function authGetAppStorageKey(baseKey = 'piano_federico_v2') {
  if (!authIsAuthenticated()) return baseKey;
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
  if (source === 'pre_cloud_sync') return 'prima della sync cloud';
  if (source === 'remote_import') return 'prima del caricamento cloud';
  return 'backup di sicurezza';
}

function authFormatSyncTime(iso) {
  if (!iso) return 'Non ancora sincronizzato';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return 'Non ancora sincronizzato';
  }
}

function authStatusMeta() {
  if (AUTH.needsEmailConfirmation) return { label: 'Conferma email', cls: 'pending' };
  if (AUTH.isSyncing) return { label: 'Sync in corso', cls: 'syncing' };
  if (authIsAuthenticated() && AUTH.provider === 'supabase') {
    return { label: AUTH.lastSyncedAt ? 'Cloud attivo' : 'Cloud pronto', cls: 'connected' };
  }
  if (authIsAuthenticated() && AUTH.provider === 'local_mock') return { label: 'Solo dispositivo', cls: 'local' };
  if (authCanUseSupabase()) return { label: 'Supabase pronto', cls: 'ready' };
  return { label: 'Locale', cls: 'local' };
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

function authSetGuestState() {
  AUTH.status = 'guest';
  AUTH.provider = authCanUseSupabase() ? 'supabase' : 'local_mock';
  AUTH.user = null;
  AUTH.sessionReady = true;
  AUTH.needsEmailConfirmation = false;
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
  return AUTH;
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
        authSetGuestState();
      }
      authRefreshUi();
    });
    _supabaseAuthSubscription = subscription?.data?.subscription || null;
  } catch (_) {}
}

async function authInit() {
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      authSubscribeSupabaseSession();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      const user = data?.session?.user || null;
      if (user) {
        authApplySupabaseUser(user);
        return AUTH;
      }
    } catch (_) {}
  }

  const session = authLoadSession();
  const users = authLoadUsers();
  if (!session?.userId) {
    authSetGuestState();
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
    const { error } = await client.from('profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) return { ok: false, message: error.message || 'Sync profilo non riuscita' };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Sync profilo non riuscita' };
  }
}

async function authFetchRemoteStateRow() {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !authCanUseSupabase()) return { ok: false, skipped: true };
  try {
    const client = authGetSupabaseClient();
    const { data, error } = await client
      .from('app_state')
      .select('state_json, updated_at, state_version')
      .eq('user_id', AUTH.user.id)
      .maybeSingle();
    if (error) return { ok: false, message: error.message || 'Lettura cloud non riuscita' };
    return { ok: true, row: data || null };
  } catch (err) {
    return { ok: false, message: err?.message || 'Lettura cloud non riuscita' };
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

function authDescribeStatePresence(state) {
  return authHasMeaningfulState(state)
    ? { label: 'Contiene dati', cls: 'filled' }
    : { label: 'Vuota o quasi vuota', cls: 'empty' };
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
    return true;
  } catch (_) {
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
  if (!remote.ok || !remote.row) return remote.ok ? { ok: true, hydrated: false } : remote;
  const remoteState = authParseRemoteState(remote.row.state_json);
  if (!remoteState) return { ok: false, message: 'Stato cloud non valido' };
  if (typeof validateImportedState === 'function') {
    const validation = validateImportedState(remoteState);
    if (!validation.ok) return { ok: false, message: validation.detail || 'Stato cloud non valido' };
  }

  const localRaw = localStorage.getItem(authGetAppStorageKey(authCurrentBaseStorageKey()));
  const localMeta = authReadStateMeta();
  const localState = authParseRemoteState(localRaw);
  const remoteAt = Date.parse(remote.row.updated_at || 0) || 0;
  const localAt = Date.parse(localMeta.updatedAt || 0) || 0;
  const resetAt = Date.parse(localMeta.resetAt || 0) || 0;
  const hasMeaningfulLocal = authHasMeaningfulState(localState) && !!localAt;
  const hasMeaningfulRemote = authHasMeaningfulState(remoteState) && !!remote.row.updated_at && !!remoteAt;

  if (resetAt && resetAt >= remoteAt && !hasMeaningfulLocal) {
    authWriteStateMeta({
      ...localMeta,
      updatedAt: localMeta.updatedAt || localMeta.resetAt || new Date().toISOString(),
      remoteUpdatedAt: remote.row.updated_at || localMeta.remoteUpdatedAt || null,
      resetPending: authIsAuthenticated() && AUTH.provider === 'supabase',
      dirty: authIsAuthenticated() && AUTH.provider === 'supabase',
    });
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || null;
    return { ok: true, hydrated: false, source: 'local_reset' };
  }

  if (!hasMeaningfulLocal && hasMeaningfulRemote) {
    authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
    return { ok: true, hydrated: true, source: 'remote' };
  }

  if (hasMeaningfulLocal && !hasMeaningfulRemote) {
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
    return { ok: true, hydrated: false, source: 'local' };
  }

  if (hasMeaningfulLocal && hasMeaningfulRemote && remoteAt !== localAt) {
    if (remoteAt > localAt) {
      authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
      return { ok: true, hydrated: true, source: 'remote' };
    }
    AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
    return { ok: true, hydrated: false, source: 'local' };
  }

  if (!hasMeaningfulLocal || !localRaw || remoteAt > localAt) {
    authStoreRemoteStateLocally(remoteState, remote.row.updated_at);
    return { ok: true, hydrated: true, source: 'remote' };
  }

  AUTH.lastSyncedAt = localMeta.lastSyncedAt || localMeta.remoteUpdatedAt || null;
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
  return { ok: true, user: AUTH.user };
}

async function signUpWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: cleanEmail.split('@')[0] } },
      });
      if (error) return { ok: false, message: error.message || 'Registrazione non riuscita' };
      const user = data?.user;
      if (!user) return { ok: false, message: 'Registrazione avviata, controlla la tua email' };
      if (data?.session?.user) {
        authApplySupabaseUser(data.session.user);
        await authEnsureRemoteProfile();
        return { ok: true, user: AUTH.user };
      }
      AUTH.status = 'guest';
      AUTH.provider = 'supabase';
      AUTH.user = null;
      AUTH.sessionReady = true;
      AUTH.needsEmailConfirmation = true;
      return {
        ok: true,
        pendingConfirmation: true,
        message: 'Controlla la tua email per confermare l’account, poi accedi da qui.',
      };
    } catch (err) {
      return { ok: false, message: err?.message || 'Errore Supabase' };
    }
  }
  return signUpLocal(cleanEmail, password);
}

async function signInWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) return { ok: false, message: error.message || 'Accesso non riuscito' };
      const user = data?.user;
      if (!user) return { ok: false, message: 'Accesso non riuscito' };
      authApplySupabaseUser(user);
      await authEnsureRemoteProfile();
      const storageKey = authGetAppStorageKey(authCurrentBaseStorageKey());
      const localRaw = localStorage.getItem(storageKey);
      const localState = authParseRemoteState(localRaw);
      if (!authHasMeaningfulState(localState)) {
        authClearLocalStateMeta();
      }
      return { ok: true, user: AUTH.user };
    } catch (err) {
      return { ok: false, message: err?.message || 'Errore Supabase' };
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
      const { error } = await client.auth.resetPasswordForEmail(cleanEmail);
      if (error) return { ok: false, message: error.message || 'Invio email non riuscito' };
      return { ok: true, message: 'Ti abbiamo inviato una mail per reimpostare la password.' };
    } catch (err) {
      return { ok: false, message: err?.message || 'Invio email non riuscito' };
    }
  }
  return {
    ok: false,
    message: 'Reset password disponibile quando attivi Supabase. In locale mock puoi creare un nuovo account o pulire quelli locali.',
  };
}

async function signOutUser() {
  try {
    sessionStorage.setItem(AUTH_POST_LOGOUT_MODE_KEY, 'login');
  } catch (_) {}
  if (window.S) {
    window.S.authEntryCompleted = false;
  }
  if (AUTH.provider === 'supabase' && authCanUseSupabase()) {
    try {
      const client = authGetSupabaseClient();
      await client.auth.signOut();
    } catch (_) {}
  } else {
    authSaveSession(null);
  }
  authSetGuestState();
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
    body: 'Verrai disconnesso da questo dispositivo e tornerai alla schermata di accesso.',
    confirmText: 'Esci dal profilo',
    cancelText: 'Resta dentro',
    danger: true,
    onConfirm: () => { signOutUser(); },
  });
}

function authOnLocalStateSaved(raw, options = {}) {
  const now = new Date().toISOString();
  const meta = authReadStateMeta();
  const shouldSync = authIsAuthenticated() && AUTH.provider === 'supabase';
  const dirty = shouldSync ? (meta.resetPending ? true : !options.skipCloudSync) : false;
  const nextMeta = {
    ...meta,
    updatedAt: now,
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
    const { error } = await client.from('app_state').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      AUTH.isSyncing = false;
      authRefreshUi();
      return { ok: false, message: error.message || 'Sync cloud non riuscita' };
    }
    AUTH.isSyncing = false;
    AUTH.lastSyncedAt = updatedAt;
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
    return { ok: false, message: err?.message || 'Sync cloud non riuscita' };
  }
}

function authQueueStateSync(delay = AUTH_SYNC_DELAY_MS) {
  if (!authIsAuthenticated() || AUTH.provider !== 'supabase' || !AUTH.bootstrapReady) return;
  AUTH.isSyncing = true;
  authRefreshUi();
  clearTimeout(_authSyncTimer);
  _authSyncTimer = setTimeout(() => {
    authSyncStateToCloud().catch(() => {});
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
  if (typeof toast === 'function') toast('✅ Supabase configurato');
}

function authRemoveSupabaseConfig() {
  authClearSupabaseConfig();
  if (!authIsAuthenticated()) authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('🧹 Configurazione Supabase rimossa');
}

function authClearLocalAccounts() {
  localStorage.removeItem(AUTH_USERS_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
  if (!authIsAuthenticated()) authSetGuestState();
  authRefreshUi();
  if (typeof toast === 'function') toast('🧹 Account locali rimossi');
}

async function authSyncNow() {
  const result = await authSyncStateToCloud(true);
  if (typeof toast === 'function') {
    toast(result.ok ? '✅ Dati sincronizzati' : `⚠️ ${result.message || 'Sync non riuscita'}`);
  }
}

function renderAuthNav() {
  const slot = document.getElementById('nav-auth-slot');
  if (!slot) return;
  const status = authStatusMeta();
  if (authIsAuthenticated()) {
    slot.innerHTML = `
      <button class="btn btn-ghost auth-nav-btn" onclick="goView('profilo')" title="${htmlEsc(AUTH.user.email)}">
        <i data-lucide="badge-check" class="nav-action-icon"></i>
        <span class="auth-nav-copy">${htmlEsc(AUTH.user.name || 'Account')}</span>
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
  const syncLabel = authFormatSyncTime(AUTH.lastSyncedAt || authReadStateMeta().lastSyncedAt);
  const backupMeta = authGetLatestBackupMeta();
  const backupLabel = backupMeta
    ? `${authFormatSyncTime(backupMeta.createdAt)} · ${authFormatBackupSource(backupMeta.source)}`
    : 'Non ancora creato';
  const status = authStatusMeta();
  if (authIsAuthenticated()) {
    el.innerHTML = `
      <div class="profile-inline-card profile-account-card">
        <div class="profile-card-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Account</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">Profilo connesso</div>
              <span class="support-mini-state done">Connesso</span>
            </div>
            <div class="support-mini-sub">${AUTH.provider === 'supabase' ? `Account attivo con sincronizzazione disponibile. Ultimo aggiornamento: ${htmlEsc(syncLabel)}.` : 'Account attivo su questo dispositivo. Puoi collegare la sincronizzazione quando vuoi.'}</div>
          </div>
        </div>
        <div class="profile-account-status-row">
          <span class="profile-account-pill ${status.cls}">${htmlEsc(status.label)}</span>
          <span class="profile-account-status-copy">${AUTH.provider === 'supabase' ? 'I tuoi dati possono restare allineati e disponibili anche sugli altri dispositivi.' : 'Per ora questo profilo salva i dati solo qui sul dispositivo.'}</span>
        </div>
        <div class="profile-account-note">Backup locale di sicurezza: ${htmlEsc(backupLabel)}</div>
        <div class="profile-account-body">
          <div class="profile-account-email">${htmlEsc(AUTH.user.email)}</div>
          <div class="profile-account-actions">
            ${AUTH.provider === 'supabase' ? `<button class="auth-account-btn" onclick="authSyncNow()">🔄 Sincronizza adesso</button>` : cfg ? `<button class="auth-account-btn" onclick="openAuthEntry()">☁️ Attiva sincronizzazione</button>` : ''}
            ${AUTH.provider === 'local_mock' ? `<button class="auth-account-btn" onclick="authClearLocalAccounts()">🧹 Pulisci account locali</button>` : ''}
            <button class="auth-account-btn auth-account-btn-danger" onclick="confirmSignOutUser()">↩️ Logout</button>
          </div>
        </div>
        ${AUTH.provider !== 'supabase' && cfg ? `<div class="profile-account-note">${hasEmbeddedConfig ? 'La sincronizzazione è già pronta: esci e rientra con il tuo account per usarla.' : 'La sincronizzazione è configurata: esci e rientra con il tuo account per attivarla.'}</div>` : ''}
      </div>`;
  } else {
    const providerReady = authCanUseSupabase() ? 'Sync pronta' : 'Solo dispositivo';
    el.innerHTML = `
      <div class="profile-inline-card profile-account-card">
        <div class="profile-card-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Account</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">Stai usando MarciFit come guest</div>
              <span class="support-mini-state ${AUTH.needsEmailConfirmation ? 'pending' : 'idle'}">${AUTH.needsEmailConfirmation ? 'Conferma email' : providerReady}</span>
            </div>
            <div class="support-mini-sub">${AUTH.needsEmailConfirmation ? 'Hai quasi finito: conferma la mail ricevuta e poi accedi per attivare la sincronizzazione.' : authCanUseSupabase() ? 'Puoi entrare con il tuo account e tenere i dati disponibili anche sugli altri dispositivi.' : 'Crea un account per salvare e ritrovare i tuoi dati con piu continuita.'}</div>
          </div>
        </div>
        <div class="profile-account-status-row">
          <span class="profile-account-pill ${status.cls}">${htmlEsc(status.label)}</span>
          <span class="profile-account-status-copy">${AUTH.needsEmailConfirmation ? 'Conferma la mail ricevuta e poi accedi per collegare il tuo profilo.' : authCanUseSupabase() ? 'La sincronizzazione è pronta: puoi accedere o creare un account.' : 'Per ora l’app salva i dati solo sul dispositivo.'}</span>
        </div>
        <div class="profile-account-note">Backup locale di sicurezza: ${htmlEsc(backupLabel)}</div>
        <div class="profile-account-body">
          <div class="profile-account-email">Dati salvati solo su questo dispositivo</div>
          <div class="profile-account-actions">
            <button class="auth-account-btn" onclick="openAuthEntry()">🔐 Accedi o crea account</button>
            <button class="auth-account-btn" onclick="authClearLocalAccounts()">🧹 Pulisci account locali</button>
            ${cfg && !hasEmbeddedConfig ? `<button class="auth-account-btn" onclick="authRemoveSupabaseConfig()">📱 Usa solo dispositivo</button>` : ''}
          </div>
        </div>
        ${cfg || hasEmbeddedConfig ? '' : `
        <div class="profile-account-config">
          <div class="profile-account-config-title">Attiva sincronizzazione</div>
          <div class="profile-account-config-sub">Inserisci i parametri del progetto per abilitare accesso account e dati condivisi tra dispositivi.</div>
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
            <button class="auth-account-btn" onclick="authSubmitSupabaseConfig()">☁️ Salva configurazione</button>
          </div>
        </div>`}
      </div>`;
  }
}
