# MarciFit Account, Auth & Sync Plan

## Obiettivo

Introdurre account utente e sincronizzazione cloud senza rompere:

- il flusso `guest first`
- il modello di stato attuale basato su `S`
- la persistenza locale con `localStorage`
- l'onboarding già implementato

L'MVP deve permettere:

- registrazione
- login
- logout
- session restore
- sync cloud del profilo e dello stato app
- migrazione da guest locale a utente autenticato

## Principi

1. L'account non deve bloccare il primo utilizzo.
2. Il guest flow resta supportato.
3. Il cloud è una sincronizzazione dello stato, non una riscrittura completa dell'architettura.
4. `localStorage` resta cache locale e fallback offline.
5. Per l'MVP usiamo `state_json`, non tabelle normalizzate per ogni entità.

## UX Flow

### 1. Entry screen

Schermata iniziale prima dell'onboarding:

- `Crea account`
- `Accedi`
- `Continua senza account`

Note UX:

- tono leggero, non aggressivo
- benefit chiari:
  - salva i dati
  - sincronizza tra dispositivi
  - backup sicuro

### 2. Signup flow

Ordine:

1. email
2. password
3. conferma password
4. creazione account
5. onboarding profilo

Output atteso:

- sessione attiva
- `profiles` creato
- `app_state` iniziale scritto al termine onboarding

### 3. Login flow

Ordine:

1. email
2. password
3. login
4. restore stato cloud

Caso speciale:

se su device esiste già uno stato guest locale diverso dal cloud:

- `Usa dati di questo dispositivo`
- `Usa dati del tuo account`

### 4. Guest flow

Il guest continua a funzionare come oggi:

- onboarding locale
- stato salvato in `localStorage`

Trigger futuri suggeriti:

- CTA dopo onboarding: `Vuoi salvare i dati con un account?`
- CTA dopo 3 giorni attivi
- CTA prima di export/reset

### 5. Guest -> account

Se il guest crea un account dallo stesso device:

- lo stato locale corrente diventa il primo `state_json` del nuovo account
- il cloud viene inizializzato con i dati locali

Regola MVP:

- i dati locali vincono nella creazione del primo account sul device

## Architettura Consigliata

Stack consigliato:

- `Supabase Auth` per autenticazione
- `Postgres` per `profiles` e `app_state`

Motivi:

- email/password già pronta
- session restore già pronta
- reset password disponibile dopo
- integrazione semplice lato frontend
- ottima compatibilità con MVP basato su JSON blob

## Data Model MVP

### Tabella `profiles`

Campi:

- `user_id` UUID PK, FK verso auth user
- `email` text
- `name` text nullable
- `onboarding_completed` boolean default false
- `created_at` timestamptz
- `updated_at` timestamptz

Uso:

- info utente base
- stato onboarding
- metadata per UI

### Tabella `app_state`

Campi:

- `user_id` UUID PK, FK verso auth user
- `state_json` jsonb
- `state_version` int default 1
- `updated_at` timestamptz

Uso:

- salvataggio integrale dello stato applicativo
- restore semplice
- sync MVP rapida

## Stato Frontend Da Introdurre

Nuovo oggetto runtime consigliato:

```js
const AUTH = {
  status: 'guest', // 'guest' | 'loading' | 'authenticated'
  user: null,
  sessionReady: false,
  isSyncing: false,
  lastSyncedAt: null,
  hasRemoteState: false,
};
```

Questo stato non deve finire dentro `S`.

`S` resta lo stato nutrizionale/app.
`AUTH` gestisce sessione e sync.

## Strategia Di Persistenza

### Guest

- legge da `localStorage`
- scrive su `localStorage`
- nessun cloud

### Authenticated

Bootstrap:

1. restore sessione auth
2. recupera `profiles`
3. recupera `app_state`
4. idrata `S`
5. salva anche in locale

Operatività:

- `save()` continua a scrivere in locale
- in più attiva `saveRemoteStateSoon()`

### Offline

- tutto continua a scrivere in locale
- se autenticato, il sync remoto si mette in coda

Regola MVP:

- sync remoto debounced
- ultimo salvataggio vince

## Merge / Conflitti

### MVP

Strategia:

- `last write wins`

Confronto:

- `updated_at` remoto
- `lastLocalChangeAt` locale

### Caso login con dati locali guest già presenti

Se cloud e locale differiscono:

mostrare decision modal:

- `Usa dati di questo dispositivo`
- `Usa dati del tuo account`

Per MVP non fare merge automatico profondo.

## API / Service Layer

Creare un nuovo modulo, ad esempio:

- `authSync.js`

Funzioni consigliate:

```js
async function authInit()
async function signUpWithEmail(email, password)
async function signInWithEmail(email, password)
async function signOutUser()
async function fetchRemoteProfile(userId)
async function fetchRemoteState(userId)
async function upsertRemoteProfile(userId, profile)
async function upsertRemoteState(userId, state)
function saveRemoteStateSoon()
async function pushLocalStateToRemote()
async function pullRemoteStateToLocal()
```

## Integrazione Con Lo Stato Attuale

### Save path

Oggi:

- `save()` -> `localStorage`

Target:

- `save()` -> `localStorage`
- se autenticato -> `saveRemoteStateSoon()`

### Init path

Oggi:

- `initAll()`
- `loadSaved()`
- bootstrap

Target:

1. `authInit()`
2. se guest:
   - `loadSaved()`
3. se autenticato:
   - prova cloud restore
   - fallback a locale se cloud vuoto
4. `initAll()`

Nota:

`initAll()` va probabilmente spezzato in:

- bootstrap stato
- render iniziale

così possiamo decidere meglio da dove arriva lo stato prima di renderizzare.

## Onboarding & Account

### Nuova logica d'ingresso consigliata

Ordine:

1. `entry gate`
2. scelta:
   - signup
   - login
   - guest
3. onboarding
4. app

### Guest onboarding

- `onboardingCompleted = true`
- solo locale

### Signup onboarding

- auth session già attiva
- onboarding scrive direttamente nello stato utente
- al termine:
  - `profiles.onboarding_completed = true`
  - `app_state.state_json = S`

## File / Moduli Da Introdurre

### Nuovi file

- `authSync.js`
- `authViews.js` oppure integrazione in `uiComponents.js`

### File da toccare

- `index.html`
  - entry gate
  - login/signup surfaces
  - import script auth

- `app.js`
  - bootstrap auth-aware
  - flow guest vs logged
  - session state hooks

- `storage.js`
  - mantenere save locale
  - eventuale hook verso save remoto

- `style.css`
  - UI auth screens
  - sync badges / account state UI

## Stati UI Da Prevedere

### Entry

- guest
- login
- signup

### Session

- autenticazione in corso
- login fallito
- utente autenticato
- utente guest

### Sync

- sincronizzato
- salvataggio in corso
- offline
- conflitto locale/cloud

## Microcopy Consigliato

### Entry

Titolo:

- `Come vuoi iniziare?`

Sottotitolo:

- `Puoi usare MarciFit subito oppure creare un account per salvare e sincronizzare i tuoi dati.`

CTA:

- `Crea account`
- `Accedi`
- `Continua senza account`

### Guest upgrade

- `Salva i tuoi dati creando un account`
- `Sincronizza profilo, pasti e progressi tra dispositivi`

### Conflict modal

Titolo:

- `Abbiamo trovato dati sia sul dispositivo che nel tuo account`

Azioni:

- `Usa dati di questo dispositivo`
- `Usa dati del tuo account`

## Roadmap Tecnica Consigliata

### Step 1

Preparazione architetturale:

- introdurre `AUTH`
- introdurre `authSync.js`
- separare bootstrap sessione da bootstrap UI

### Step 2

UI accesso:

- entry gate
- login screen
- signup screen
- continue as guest

### Step 3

Auth provider:

- sign up
- sign in
- session restore
- sign out

### Step 4

Persistenza cloud:

- `profiles`
- `app_state`
- restore e save remoto

### Step 5

Migrazione guest -> account:

- promuovere stato locale a cloud

### Step 6

Refinement:

- indicatori sync
- conflict modal
- offline handling
- reset password

## MVP Acceptance Criteria

Il primo rilascio account è ok se:

- un utente può registrarsi
- un utente può accedere
- un utente può uscire
- il guest continua a funzionare
- i dati del profilo e dello stato vengono ripristinati dopo login
- i dati modificati vengono salvati sia in locale sia nel cloud
- il passaggio guest -> account non fa perdere i dati

## Step Successivo Consigliato

Prima di scrivere codice auth reale:

1. confermare provider (`Supabase` consigliato)
2. disegnare il gateway UX iniziale
3. implementare il solo `entry gate` in app
4. poi agganciare auth e sync
