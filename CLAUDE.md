# CLAUDE.md - MarciFit

Documento operativo per sessioni con Claude/Codex. Va mantenuto breve, aggiornato e utile per entrare nel progetto senza rileggere tutto il codice.

Ultimo aggiornamento: 2026-05-03

## Snapshot Progetto

MarciFit e una web app personale per nutrizione, tracking giornaliero e progressi fisici. La UI e in italiano, mobile-first, senza framework frontend.

| Area | Stato attuale |
| --- | --- |
| Stack | HTML + CSS + Vanilla JS |
| Runtime | Browser, dati in `localStorage`, sync opzionale Supabase |
| File entry | `index.html` |
| State globale | `const S` in `app.js` |
| Persistenza | `storage.js`, key principale `piano_federico_v2` |
| Test rapidi | `node --check app.js uiComponents.js`, smoke npm |

Asset version correnti in `index.html`:

- `style.css?v=150`
- `debugTools.js?v=5`
- `authSync.js?v=17`
- `storage.js?v=42`
- `nutritionLogic.js?v=57`
- `mealTaxonomy.js?v=1`
- `templateEngine.js?v=2`
- `mealHelperEngine.js?v=1`
- `uiComponents.js?v=122`
- `bootstrapTools.js?v=7`
- `app.js?v=101`
- `barcodeTools.js?v=18`

Incrementare il query param quando si modifica un asset, soprattutto in preview `file://` o browser con cache aggressiva.

## Architettura UI Attuale

Le quattro tab restano in bottom nav:

- `Oggi`: cockpit sintetico della giornata. Contiene greeting, alert, macro/kcal, calendario, acqua, integratori, sgarro controllato e note.
- `Piano`: area operativa pasti. Contiene le meal card del giorno selezionato e la libreria template.
- `Stats`: al momento mostra solo stato minimale `In arrivo`; il codice dashboard esiste ancora ma non viene montato da `renderStats()`.
- `Profilo`: menu a sezioni (`Account`, `Anagrafica`, `Orari pasti`, `Giorni di allenamento`, `Dati/export`).

Markup principale in `index.html`:

- `#view-today`: dashboard/routine/note, senza meal card complete.
- `#view-piano`: `#current-meal-focus`, `.piano-section-meals`, `#meals-today`, `.piano-section-library`.
- `#food-search-sheet-ov`: bottom sheet globale per ricerca cibo, fuori dalle meal card.
- `#day-modal-ov`: modal generico usato per recap, spiegazioni, gram edit, diario note.

## Mappa File

| File | Ruolo |
| --- | --- |
| `index.html` | Shell DOM, nav, container view, modal globali, script include |
| `app.js` | Stato `S`, handler, navigazione, modali, food sheet, acqua, integratori, profilo, calendario |
| `uiComponents.js` | Rendering HTML delle view/card, alert, macro strip, meal card, profilo, stats, acqua/integratori |
| `nutritionLogic.js` | Calcolo TDEE/macro, database alimenti, ricerca food, ranking, gram picker |
| `storage.js` | Save/load locale, import/export, applicazione stato validato |
| `debugTools.js` | Debug flag, fetch wrapper, validazione import |
| `bootstrapTools.js` | Migrazioni e normalizzazione stato legacy |
| `barcodeTools.js` | Scanner barcode, Open Food Facts barcode, fallback manuale |
| `mealTaxonomy.js` | Tag meal/ruoli alimento, compatibilita pasto, porzioni suggerite |
| `templateEngine.js` | Normalizzazione e scoring template per pasto |
| `authSync.js` | Account/sync opzionale Supabase |
| `mealHelperEngine.js` | Helper/suggerimenti pianificazione, attualmente non centrale nella UI |

## Entrypoint Importanti

### Navigazione e date

- `goView(name)` in `app.js`: cambia tab e chiama il render della view.
- `moveSelectedDate(deltaDays)` in `app.js`: cambia `S.selDate`, aggiorna `S.day`, `S.planTab`, calendario e render.
- `attachTodaySwipe()` in `app.js`: swipe su `Oggi` per cambiare data.
- `openPianoMeals(targetId)` in `app.js`: CTA da alert/dashboard verso i pasti in `Piano`.

### Oggi

- `renderToday()` in `uiComponents.js`: greeting, calendario, dashboard, note, acqua, integratori.
- `renderTodayLog()` in `uiComponents.js`: aggiorna macro strip, progress pasti, alert e meal card. Anche se il nome e legacy, ora popola `#meals-today` dentro `Piano`.
- `renderMacroStrip()` in `uiComponents.js`: energia/macro nella dashboard.
- `splitTodayAlerts()` e `renderTodayAlertHTML()` in `uiComponents.js`: alert attivi e support panel.
- `renderWater()` / `renderSuppToday()` / `renderCheatWidget()` in `uiComponents.js`: routine e supporto giornaliero.

### Piano e pasti

- `renderPiano()` in `uiComponents.js`: render meal card del giorno selezionato + template library.
- `mealCardHTML()` in `uiComponents.js`: HTML della meal card principale.
- `extraMealCardHTML()` in `uiComponents.js`: merenda/spuntino extra per data.
- `mealTemplateButtonHTML()` in `uiComponents.js`: CTA `Aggiungi template` sulle meal card.
- `refreshMealCard(type, mealIdx)` in `app.js`: refresh parziale dopo log/edit/remove.
- `loadTemplateToLog()` / `loadTemplateToMeal()` in `app.js`: applicazione template.

### Ricerca alimenti

- `toggleLogSearch(domKey)` in `app.js`: apre il bottom sheet globale.
- `renderFoodSearchSheet(ctx)` in `app.js`: costruisce sheet con header, template, input search, barcode.
- `returnFoodSearchToResults()` in `app.js`: torna dal gram picker alla lista risultati.
- `searchFoods(q, callback, opts)` in `nutritionLogic.js`: pipeline unica locale + cache + Open Food Facts fallback.
- `renderFoodDropdown()` in `nutritionLogic.js`: lista risultati unica, senza sezioni tecniche.
- `showGramPicker()` in `nutritionLogic.js`: vista dedicata alla quantita dentro il bottom sheet.

### Profilo e fabbisogno

- `renderProfile()` / `renderProfileMenu()` in `uiComponents.js`: menu profilo e sezioni.
- `renderAnagrafica()` in `uiComponents.js`: card `Fabbisogno`, `Dati base`, `Attivita`, `Target`.
- `buildFabbisognoPreviewHTML()` in `app.js`: preview fabbisogno, target Workout/Rest e righe tecniche.
- `showFabBmrTip()` / `showFabPalTip()` / `showFabTdeeTip()` / `showFabGoalTip()` in `uiComponents.js`: spiegazioni in modal, non tooltip hover.
- `_updateFabbisognoPreview()` e `persistAnagraficaDraft()` in `app.js`: live preview e autosave.
- `computeNutrition(ana, goal)` in `nutritionLogic.js`: motore BMR + NEAT + EAT + TEF, macro Workout/Rest.

### Storage, bootstrap e sync

- `save()` / `saveSoon()` / `loadSaved()` in `storage.js`.
- `applyValidatedState(saved)` in `storage.js`: applica solo chiavi note.
- `validateImportedState()` in `debugTools.js`: validazione import.
- `normalizePersistedStateForBootstrap()` in `bootstrapTools.js`: migrazioni legacy.
- `authSync.js`: sync opzionale; non assumere backend obbligatorio.

## Stato Dati e Convenzioni

- Le chiavi interne restano `on`/`off`; in UI usare `Workout`/`Rest`.
- `S.day`: tipo giorno visualizzato.
- `S.selDate`: data selezionata; se vuota, usare `localDate()`.
- `S.foodLog[dateKey][mealIdx]`: log alimenti del giorno.
- `S.templates[]`: template pasti separati dal food log.
- `S.extraMealsActive[dateKey]`: merenda/spuntino extra attivi per data.
- `S.doneByDate`: stato derivato da attivita reali, non da vecchie checkbox.
- `S.water`, `S.suppChecked`, `S.notes`: routine giornaliera.
- `S.condimentConfirmations[dateKey][mealIdx]`: conferma condimenti assenti.
- `S.anagrafica`: dati base, attivita, passi medi, grasso corporeo.
- `S.goal`: fase, calibrazione e target.

Non introdurre nuove migrazioni se si puo mantenere backward compatibility tramite default/normalizzazione.

## UX Corrente

- `Oggi` deve restare breve. Non reinserire meal card complete nella tab Oggi.
- `Piano` e il luogo per logging pasti, template, ricerca cibo e prompt condimenti.
- Il bottom sheet food search e globale: non renderizzare search inline dentro ogni meal card.
- Le spiegazioni scientifiche del fabbisogno devono stare in modal, non in tooltip stretti.
- Evitare copy tecnico `ON/OFF` nella UI utente: preferire `Workout/Rest`.
- Evitare card “in arrivo” grandi: se una feature non e pronta, usare presenza minima o niente.

## Design System

- Font: `Lora` per brand/titoli editoriali, `Manrope` per UI, `JetBrains Mono` per numeri.
- Colori principali in `style.css`: `--on` verde, `--off` ambra/marrone, `--ink`, `--muted`, `--surface-border`.
- Mobile-first: bottom nav fissa, brand bar sticky, safe area iOS.
- Niente card dentro card quando non necessario; preferire sezioni piene e gerarchie semplici.
- Animazioni leggere: progress bar, glow/pop brevi, rispetto di `prefers-reduced-motion`.

## Comandi

```bash
# Server locale
npm run preview:serve
# equivalente: python3 server.py

# Smoke principali
npm test
npm run smoke:core
npm run smoke:dataflow
npm run smoke:storage

# Screenshot/preview script
npm run preview:today
npm run preview:stats

# Check sintassi veloci
node --check app.js
node --check uiComponents.js
node --check nutritionLogic.js
```

Note:

- In sandbox macOS, Playwright/headless puo fallire per permessi. Se succede, riportarlo come limite ambiente.
- Per semplici modifiche UI, preferire `node --check` + verifica manuale rapida.
- Il browser in-app puo aprire direttamente `file:///Users/federicomarci/Desktop/MarciFit/index.html`; per test con server usare la porta impostata dal comando preview.

## Ricerca Cibi e Barcode

- Ricerca testuale: `searchFoods()` in `nutritionLogic.js`.
- Ranking/dedupe: `scoreFoodResult()`, `dedupeFoodResults()`, contesto query e trust label transienti.
- Cache search: `S.foodCache`; i barcode non devono sporcare la cache query.
- Barcode: `openBarcode()` in `barcodeTools.js`, usa `BarcodeDetector` se disponibile e Quagga fallback.
- OFF deve essere fallback silenzioso: risultati locali subito, online solo quando utile.

## Gotcha Importanti

- `renderTodayLog()` ha nome legacy: aggiorna sia dashboard Oggi sia meal card Piano.
- `#meals-today` vive in `#view-piano`, non in `#view-today`.
- Gli alert che puntano ai pasti devono usare `openPianoMeals()`.
- `refreshMealCard()` deve continuare a funzionare anche quando la tab attiva e `Piano`.
- Non usare `prompt()`/`confirm()` nativi: il browser in-app non li supporta. Usare modal custom.
- Aggiornare cache bust in `index.html` dopo modifiche a CSS/JS.
- Non usare `Object.assign(S, parsed)` su import: passare da validazione e chiavi note.
- Non trattare `S.checked` come fonte di verita: completion deriva da log/acqua/integratori.

## Feature Future / Note Aperte

- Stats: codice dashboard esistente ma UI attuale minimal `In arrivo`; decidere se riattivare o rifare.
- Learning/scienza: gli spunti scientifici sono stati rimossi da Oggi; eventuale nuova sezione dedicata futura.
- Lista spesa: possibile estensione naturale di template + meal plan.
- Alert tolerances: soglie ancora in parte hardcoded; valutare configurazione profilo solo se serve davvero.

