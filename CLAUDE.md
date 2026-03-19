# CLAUDE.md — MarciFit

> Documento vivente per sessioni di lavoro con Claude Code.
> **Aggiornare ad ogni sessione** con stato attuale, bug, implementazioni in corso.

---

## Panoramica Progetto

**MarciFit** è una web app personale per il tracking di fitness e nutrizione, con UI in italiano.

| Aspetto | Dettaglio |
|---|---|
| Stack | Vanilla JS + HTML + CSS (no framework) |
| Storage | `localStorage` (nessun backend) |
| Server dev | Python 3, porta `8788` |
| Lingua UI | Italiano |

### File principali

| File | Righe | Ruolo |
|---|---|---|
| `app.js` | ~1725 | State globale (`const S`), event handlers, navigazione, modal, template pasti, food logging, barcode scanner |
| `uiComponents.js` | ~1295 | Rendering UI, generazione HTML componenti, form helpers |
| `nutritionLogic.js` | ~565 | Calcolo macro, statistiche, helpers date, database alimenti, integrazione API ricerca OFF |
| `storage.js` | ~129 | Persistenza localStorage, serializzazione, debouncing save |
| `style.css` | ~1119 | Design tokens, layout responsive, stili componenti |
| `index.html` | ~320 | Struttura HTML principale, nav bar, container view |
| `start.html` | ~4865 | Versione alternativa/completa con stili inline |
| `diagnostic.html` | — | Tool di debug |

### Funzionalità principali

- **Oggi** — tracking pasti giornalieri con strip macro calorie/P/C/F
- **Piano** — template pasti (colazione/pranzo/cena), pianificazione settimanale
- **Stats** — grafici avanzamento, misurazioni corporee
- **Profilo** — impostazioni utente, obiettivi (Bulk/Cut/Mantenimento), misure corpo

### Design System

- **Palette**: sfondo `#eeecea` (beige caldo), testo `#17140e`, accent ON `#1a6b3f` (verde), accent OFF `#7a5009` (marrone)
- **Font**: Lora (brand), JetBrains Mono (dati nutrizionali), Manrope (UI)

---

## Stato Attuale

> Ultima modifica: 2026-03-19 (sessione 13)

- Progetto funzionante con le 4 view principali operative
- **Versioni asset correnti**: `style.css?v=53`, `uiComponents.js?v=60`, `app.js?v=60`, `nutritionLogic.js?v=45` — incrementare ad ogni cambio significativo
- **Navbar**: Lucide SVG icons (calendar-days, utensils, bar-chart-2, user, printer). `.nav` sticky top con brand mobile, `.nav-tabs` bottom su mobile / top centrata su desktop
- **Layout mobile**: bottom tab bar stile iOS, brand bar in alto (48px sticky), tastiera aperta → `kb-open` nasconde nav-tabs
- **Greeting**: frase motivazionale quotidiana (Lora italic) + alert engine condizionale (supplementi/mezzogiorno/serali)
- **Macro strip**: card hero kcal + 3 card macro (P/C/F) con barre colorate e resto mancante
- **Pasti extra**: "Merenda" e "Spuntino" attivabili per-day, salvati in `S.extraMeals[dateKey]`
- **Cibi Preferiti**: `S.favoriteFoods[]` persistente, usati per suggerimenti alimentari negli alert serali
- **Barcode scanner**: BarcodeDetector + Quagga fallback, 3 letture consecutive richieste, camera 1920×1080
- **Edit grammatura**: matita inline nelle log row, live preview kcal nel modal
- **Click macro card**: breakdown per pasto del nutriente selezionato
- **Calorie rimanenti**: mostrate nel gram picker durante l'aggiunta di un alimento

---

## Bug Noti

> Aggiungere bug con formato: **[DATA] Titolo** — descrizione, file coinvolti, priorità

_Nessun bug noto documentato al momento._

---

## Implementazioni in Corso / Feature Future

> Aggiungere feature WIP con formato: **[DATA] Feature** — stato, file coinvolti, note

- **⚠️ [FUTURA] Gestione tolleranza alert**: soglie kcal/proteine da Profilo > Impostazioni alert. Attualmente hardcoded in `renderTodayLog()`: `ALERT_KCAL_ERR=300`, `ALERT_KCAL_WARN=150`, `ALERT_PROT_WARN=20g`.

---

## Layout & Responsive

### Strategia navbar
- `.nav-tabs` è **fuori** dal `.nav` nel DOM — necessario perché `backdrop-filter` sul `.nav` rompe `position: fixed` dei figli
- **Desktop**: `.nav-tabs` è `position: fixed; top: 0; left: 50%; transform: translateX(-50%); height: 56px` — galleggia centrata sulla top bar
- **Mobile (≤600px)**: `.nav-tabs` diventa `position: fixed; bottom: 0` — bottom tab bar stile iOS
- **Mobile nav brand**: `.nav` è `position:sticky;top:0` (48px, `padding: 0 16px`), solo logo + nome, `.nav-actions` nascosto. Non serve `margin-top` su `.view` — il sticky è nel document flow.
- Attivo su mobile: solo colore verde (`--on`), no pill background
- `env(safe-area-inset-bottom)` gestisce il notch/home indicator iPhone
- **Tastiera aperta**: classe `kb-open` su `<body>` tramite JS `focusin`/`focusout` → `.kb-open .nav-tabs { display:none }` e `.kb-open .view { padding-bottom:16px }`

### Cache CSS
- `style.css?v=N` — incrementare N ad ogni cambio CSS significativo per forzare reload nel preview browser (Chromium aggressivo sulla cache)
- Hard reload JS se `window.location.reload()` non basta: `location.href = location.href.split('?')[0] + '?bust=' + Date.now()`

### Preview System (Claude Code)
- **Problema macOS sandbox**: `preview_start` lancia Python in un processo sandboxed che non può leggere da `~/Desktop`. Soluzione: il server serve da `/tmp/marcifit/` (accessibile al sandbox).
- **Server script**: `/tmp/marcifit_server.py` — serve da `/tmp/marcifit/` con `functools.partial(SimpleHTTPRequestHandler, directory='/tmp/marcifit')` (NON usare `os.chdir` + `os.getcwd`, causerebbe PermissionError nel sandbox).
- **Sync obbligatorio prima di ogni screenshot**: eseguire sempre questo comando Bash prima di `preview_screenshot`:
  ```bash
  rsync -a --delete /Users/federicomarci/Desktop/MarciFit/ /tmp/marcifit/ --exclude='.git' --exclude='.claude'
  ```
- **Avvio sessione**: se `preview_start` fallisce per porta occupata → `kill $(lsof -ti :8788)` poi riprovare.

---

## Architettura & Convenzioni

### State management
- Stato globale centralizzato in `const S` dentro `app.js`
- Salvataggio via `storage.js` con debouncing per evitare write eccessive su localStorage

### Pattern UI
- Componenti renderizzati come stringhe HTML in `uiComponents.js`, iniettati via `innerHTML`
- Event delegation per elementi dinamici
- `generateAssistantMessage()` è **RIMOSSA** — usare `getDailyQuote()` + `generateAlerts()` in `uiComponents.js`

### Dati
- Tutto persiste in `localStorage` — nessuna chiamata server per i dati utente
- Misurazioni corporee: append-only (mai sovrascritte)
- Template pasti separati dal log giornaliero
- `S.checked` è globale (chiavi `on-0`, `on-1`...) — non è date-scoped. Il fallback "pasto spuntato senza log → usa piano come stima" in `renderMacroStrip()` è protetto da `isToday`

### File `start.html`
- Versione alternativa con tutto inline — non è il file principale di sviluppo
- Il file principale è `index.html`

---

## Comandi Utili

```bash
# Avviare il server di sviluppo
python3 -m http.server 8788

# Oppure tramite il launch.json Claude
# Server configurato in .claude/launch.json su porta 8788
```

App accessibile su: `http://localhost:8788`

---

## Ricerca Alimenti — Architettura OFF

- **Endpoint search**: `it.openfoodfacts.net/cgi/search.pl?search_terms=...&search_simple=1&action=process&json=1&page_size=30`
- **Endpoint barcode**: `world.openfoodfacts.org/api/v0/product/{barcode}.json` (~400ms). Struttura: `data.status === 1 ? data.product : null`. ⚠️ NON usare `cgi/search.pl?code=` per barcode — restituisce sempre 0 risultati.
- **AbortController**: `_offAbort` cancella ricerche precedenti; `_searchVersion` counter scarta callback stale
- **Ranking 5 fattori**: name match +3, starts-with +2, brand +1, coverage bonus +3, IT label +1
- **Progressive retry**: se 0 risultati e query ≥3 parole → retry senza ultima parola
- **"Mostra più"**: primi 8 OFF visibili, resto in `<div style="display:none">` con bottone toggle inline
- **Debounce**: 400ms su tutti i search handler

---

## Note per la Prossima Sessione

> Solo note pendenti, non storico. Rimuovere quando risolte.

- CSS: sezione `/* NOTES */` duplicata rimossa (c'erano due blocchi — uno ~riga 587, uno ~riga 837. Il secondo è stato rimosso.)
- `.stat-i` (icona info "i") non è nested in `.tg-stat` — usare `.stat-i` come selettore diretto
- I tooltips BMI/BMR/TDEE usano `showTip()`/`hideTip()` con `onmouseenter`/`onmouseleave` sui `.tg-stat-card`
- **Logo PNG gotcha**: PNG con sfondo opaco — `mix-blend-mode:screen/multiply` non funziona su sfondo beige. Per logo immagine: esportare **sempre PNG con sfondo trasparente**.

---

## Storico Sessioni

### Sessione 1 — Audit UI/UX (2026-03-18)
- `.nav` nascosta su mobile — navigazione solo via bottom tab bar
- Nome pasto visibile: `.mc-top { flex-wrap: wrap }` su mobile → badge va a riga separata
- Note textarea: font cambiato da JetBrains Mono a Manrope
- Profilo tabella: label da `--muted` a `--ink2` (contrasto migliorato), colonna ridotta a 96px
- Pulsante Stampa in azioni giornata: emoji → Lucide icon + testo "Stampa"

### Sessione 2 — Brand mobile & calendario picker (2026-03-18)
- **Brand mobile**: `.nav` ora visibile su mobile (48px) con solo logo MF + "MarciFit", `.nav-actions` nascosto
- **Stats mini-card row**: `renderGreeting()` usa `.tg-stats-row` con 4 `.tg-stat-card` (BMI, BMR, TDEE, Peso) — poi rimossa in sessione 3
- **Calendario picker**: tap sul titolo data apre modal con selezione mese/anno (`openCalPicker()`, `renderCalPicker()`, `pickerGoMonth()`). Limite ±26 settimane rimosso da `calMove()`
- **Badge target due righe**: `.mc-target-badge` flex-direction:column con `.mc-badge-kcal` e `.mc-badge-macros`
- **Note focus-within**: tag nascosti di default, animati in view con CSS `:focus-within`
- **Macro strip colori**: `rc='ok'` verde (rem>0), `rc='err'` rosso (rem<0), `rc='warn'` (rem < 15% target)

### Sessione 3 — Breathing room & UX (2026-03-18)
- **Card calendario+macro**: `.today-section-card` wrappa `.cal-nav` + `.week-cal` + `.macro-strip`
- **Alert slim**: `alert_()` produce `.alert-slim` con `.alert-dot`. Alert SOLO dopo le 20:00 o date passate
- **BMI pill inline**: BMI/BMR/TDEE in unica pill `.tg-bmi-pill` nella riga `.tg-extras`. Mini-card row rimossa
- `.nav` diventa `position:sticky;top:0` — non serve più `margin-top` su `.view`
- Meal card in today mode: `.mc-pills` non renderizzate (ridondanti). In edit mode restano
- `.mc-add-btn` tondo con colori pastello (`#e8f0fb` bg, `#5b82b8` icon)
- `.mc-target-badge` blocco centrato a larghezza piena con label "OBIETTIVO"

### Sessione 4 — Bugfix mobile (2026-03-18)
- **iOS zoom fix**: `font-size:16px` su `.food-search-input` in `@media (max-width:600px)`
- **Bottone duplicato "Carica dal piano"**: rimosso da `nutritionLogic.js`, resta solo in `uiComponents.js`
- `renderFoodDropdown(results, resEl, onSelectFn, extraHTML)` — 4° param `extraHTML` non usarlo per "Carica dal piano"

### Sessione 5 — Macro strip redesign & bugfix (2026-03-18)
- **Macro strip redesign**: card hero kcal (`.ms-kcal-card`) + 3 card macro (`.ms-macros-row` → `.ms-macro-card.prot/carb/fat`) con emoji (🥩🍚🧈)
- **Calendario spostato sotto il recap**: ordine in `today-section-card` → titolo → macro strip → divisore → cal-nav → week-cal
- **Bug S.checked**: fallback in `renderMacroStrip()` protetto da `isToday` per evitare stime errate su date passate
- **Goal badge**: rimosso da `.tg-extras`, ora in `.tg-right` sotto chip "Giorno ON/OFF"

### Sessione 6 — Extra meals, calendario & logo (2026-03-18)
- **Pasti extra**: "Merenda" e "Spuntino" attivabili per-day con pulsante tratteggiato. Salvati in `S.extraMeals[dateKey]`
- **Calendario dot → linea**: `border-top: 2px solid var(--on)` sopra il numero del giorno
- **`.mc-badge-row`**: `justify-content:flex-end` nelle card extra senza badge target

### Sessione 7 — Barcode scanner + mobile fixes (2026-03-18)
- **Barcode endpoint corretto**: `world.openfoodfacts.org/api/v0/product/{barcode}.json`, struttura `data.status === 1 ? data.product : null`
- **`showBcResult` fix**: rimossa riga `getElementById('bc-confirm-btn').onclick` — il pulsante usa già `onclick` inline
- **Barcode multi-read**: 3 letture consecutive identiche richieste prima di accettare
- **Quagga**: intervallo 150ms, size 800, `halfSample:false`, filtro confidence `avgErr < 0.25`
- **Camera**: risoluzione 1920×1080
- **Zoom disabilitato**: viewport `maximum-scale=1.0,user-scalable=no`
- **Bottom nav + tastiera**: classe `kb-open` su `<body>` via `focusin`/`focusout`

### Sessione 8 — Greeting redesign + Alert Engine + Cibi Preferiti (2026-03-19)
- **Greeting ridisegnato**: frase motivazionale quotidiana + alert engine (rimossi BMI pill, streak/score, chips macro)
- **`getDailyQuote(dateKey)`**: pool 40 frasi / 4 categorie, selezione stabile 24h via `dayOfYear % pool.length`
- **`generateAlerts(type, h, dateKey)`**: max 3 alert — supplementi (h≥8), mezzogiorno (h≥12), serali (h≥20 o data passata)
- **`suggestFood(remK,remP,remC,remF)`**: legge `S.favoriteFoods`, seleziona 1-2 cibi ottimali
- **`S.favoriteFoods = []`**: schema `{id, name, kcal100, p100, c100, f100, typicalGrams}`
- **Funzioni `app.js`**: `addFavoriteFood()`, `removeFavoriteFood(id)`, `_toggleFfForm()`, `openFoodSuggestion()`
- **CSS aggiunto**: `.tg-quote*`, `.tg-alert*`, `.tg-alert-suggest`, `.ff-*`, `.sug-food-*`, `.sug-total`
- **`generateAssistantMessage()` RIMOSSA** — non usarla mai più

### Sessione 9 — Alert rossi, streak badge, Cibi Preferiti search/barcode (2026-03-19)
- **Alert supplementi → rosso**: `.tg-alert-supp` usa `background:#fef2f2;border:1px solid #fca5a5;color:var(--red)`
- **Override-dot inline**: `<span>` inline dentro `.wc-badge` (5px amber dot) invece di `<div>` absolute
- **Streak badge nel greeting**: `calcStreak()` + `streakBadgeStyle()` wired in `renderGreeting()` tg-right
- **`_bcMode = 'log' | 'ff'`**: barcode modal riutilizzabile in contesti diversi. `openBarcodeForFf()` setta `_bcMode='ff'`
- **Cibi Preferiti search**: `onFfSearch(inp)` → `searchFoods()` → `_ffSearchResults[]`. `selectFfFood(i)` → `fillFfFromProduct(item)`
- **Versioni**: `style.css?v=46`, `uiComponents.js?v=52`, `app.js?v=54`

### Sessione 13 — Fix UX: edit icon, kcal pasto, cibi preferiti, tracking obiettivo (2026-03-19)
- **Icona rinomina più vicina al nome**: `.mc-name` e `.mc-rename-btn` wrappati in `.mc-name-group` (`display:inline-flex;gap:3px;flex:1`). Rimosso `flex:1` da `.mc-name`. L'icona matita appare immediatamente a destra del testo del nome.
- **Kcal rimanenti per pasto nel gram picker**: il problema era che `nutritionLogic.js` aveva ancora `?v=44` in index.html — il browser caricava la versione precedente senza la modifica. Aggiornato a `?v=45`. Ora mostra "PASTO: X kcal rim. · GIORNO: Y kcal rim." entrambi dinamici.
- **Cibi Preferiti scrollabili**: aggiunto `max-height:260px;overflow-y:auto;padding-right:4px` a `.ff-list`. La lista non allunga più la pagina.
- **Rimosso tracking settimane/obiettivo**: rimosso `goalBadge` da `renderGreeting()` (era "Sett. X · Bulk/Cut/Mantenimento"). Rimossa chiamata a `renderGoalCard()` da `renderProfile()`. In `setGoalPhase()`: rimosso `if (!S.goal.startDate) S.goal.startDate = localDate()`. Il selettore Bulk/Cut/Mantieni nel Profilo rimane (necessario per i calcoli kcal).
- **⚠️ NOTA**: `S.goal.targetWeight` è usato in `drawChart()` in `uiComponents.js` per la proiezione peso (riga target nel grafico). Senza input UI è solo `null`. Implementare in futuro con il sistema di tracking più serio.
- **Versioni**: `style.css?v=53`, `uiComponents.js?v=60`, `app.js?v=60`, `nutritionLogic.js?v=45`.

### Sessione 12 — Fix UX tab Oggi: hover, integratori, gram picker, rinomina pasto (2026-03-19)
- **App apre sempre su oggi**: `S.selDate = null` all'inizio di `initAll()` — previene che un selDate salvato in localStorage venga ripristinato.
- **Integratori di oggi rimosso**: `renderSuppToday()` ora fa solo `el.style.display='none'; return;` — sezione ridondante con l'alert engine nel greeting.
- **Hover tooltip chiude correttamente**: debounce in `hideTip()` ridotto da 400ms a 80ms. 80ms è ancora abbastanza per prevenire la falsa chiusura da touch (~50ms) ma permette il mouseleave su desktop.
- **Kcal rimanenti per pasto nel gram picker**: `showGramPicker()` ora accetta 4° param `mealCtx = { mealIdx, dateKey }`. Calcola `_mealTgtK` (target proporzionale del pasto = stessa formula del targetBadge: TDEE-scaled) e `_mealEatenK` (già loggato nel pasto). Mostra "Pasto: X kcal rim. · Giorno: Y kcal rim." nella riga `.fsr-rem-row`. `onLogFoodSearch` passa `{ mealIdx, dateKey }` come 4° arg.
- **"Carica dal piano" rimosso**: eliminato il blocco `!hasLog ? <button mc-log-from-plan>` da `mealCardHTML()` in `uiComponents.js`.
- **Rinomina pasto**: matita `.mc-rename-btn` accanto a `.mc-name` in today mode (visibile solo su hover della card). Chiama `renameMeal(type, mealIdx)` in `app.js` → `showDayModal` con input pre-selezionato. Al confirm: `S.meals[type][mealIdx].name = val; save(); renderTodayLog()`.
- **CSS aggiunto**: `.mc-rename-btn` (opacità 0, visibile su `.mc:hover`), `.fsr-meal-rem-val`, `.fsr-rem-sep`.
- **Versioni**: `style.css?v=52`, `uiComponents.js?v=59`, `app.js?v=59`.

### Sessione 11 — Tooltip informativi nel Fabbisogno (Profilo) (2026-03-19)
- **Pulsanti (i) inline** accanto a BMR, PAL, TDEE nel blocco fabbisogno. Generati nella template string di `_updateFabbisognoPreview()` in `app.js` con SVG Lucide-style inline.
- **Row obiettivo**: sopra "Giorno ON/OFF" aggiunta `.fab-goal-header` con nome fase (`Bulk — Massa` / `Cut — Definizione` / `Mantenimento`) e pulsante pill "perché questi valori?" (`.fab-info-btn--goal`).
- **4 funzioni tip** aggiunte in `uiComponents.js` dopo `hideTip()`: `showFabBmrTip`, `showFabPalTip`, `showFabTdeeTip`, `showFabGoalTip`. Usano il pattern `showTip(id, anchor)` esistente.
- **`showFabGoalTip`**: legge `S.goal.phase` direttamente (S è globale) e mostra delta ON/OFF + nota + proteine target specifici per la fase corrente.
- **4 tip divs** aggiunti in `index.html`: `tip-fab-bmr`, `tip-fab-pal`, `tip-fab-tdee`, `tip-fab-goal`.
- **CSS aggiunto**: `.fab-goal-header`, `.fab-goal-phase`, `.fab-info-btn`, `.fab-info-btn--goal`, override `display:inline-flex` su `.fab-label`.
- **Versioni**: `style.css?v=51`, `uiComponents.js?v=58`, `app.js?v=58`.

### Sessione 10 — Edit grammatura, macro breakdown, calorie rimanenti (2026-03-19)
- **Matita edit grammatura**: `.fir-edit` (pencil SVG) nella log row. `editLogItem(dateKey, mealIdx, itemIdx)` apre modal con live preview kcal. Al confirm: aggiorna `grams`, chiama `save()` + `refreshMealCard()`
- **Click macro card → breakdown**: `openMacroDetail(macroKey)` mostra breakdown per pasto del nutriente selezionato (`.md-meal-block` / `.md-food-row` / `.md-meal-total`)
- **Calorie rimanenti nel gram picker**: `showGramPicker()` calcola `_remK`. Riga `.fsr-rem-row` aggiornata live da `updateCalc(g)` con classe ok/warn/err
- **CSS aggiunto**: `.fir-edit`, `.edit-gram-*`, `.md-*`, `.fsr-rem-row`, `.fsr-rem-lbl`, `.fsr-rem-val`
