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

> Ultima modifica: 2026-03-18 (sessione 7)

- Progetto funzionante con le 4 view principali operative
- **Navbar aggiornata**: icone emoji sostituite con Lucide SVG icons (calendar-days, utensils, bar-chart-2, user, printer)
- **Mobile-first layout**: bottom tab bar su mobile (≤600px), top tab bar centrata fisso su desktop
- CSS `?v=45`, `uiComponents.js?v=51`, `app.js?v=53` — versioni attuali (incrementare ad ogni cambio significativo)

**Audit UI/UX (sessione 1, 2026-03-18):**
- `.nav` nascosta su mobile — navigazione solo via bottom tab bar
- Nome pasto visibile: `.mc-top { flex-wrap: wrap }` su mobile → badge va a riga separata
- Note textarea: font cambiato da JetBrains Mono a Manrope
- Profilo tabella: label da `--muted` a `--ink2` (contrasto migliorato), colonna ridotta a 96px
- Pulsante Stampa in azioni giornata: emoji → Lucide icon + testo "Stampa"

**Miglioramenti UI (sessione 2, 2026-03-18):**
- **Brand mobile**: `.nav` ora visibile su mobile (48px) con solo logo MF + "MarciFit", `.nav-actions` nascosto. `margin-top:48px` su `.view` mobile per compensare.
- **Stats mini-card row**: `renderGreeting()` ora usa `.tg-stats-row` con 4 `.tg-stat-card` (BMI, BMR, TDEE, Peso) in una riga orizzontale scrollabile. Vecchi `.tg-stat` rimossi.
- **Calendario picker**: tap sul titolo data apre modal con selezione mese/anno (`openCalPicker()`, `renderCalPicker()`, `pickerGoMonth()`). Limite ±26 settimane rimosso da `calMove()`. Picker con griglia 4×3 mesi + nav anno.
- **Badge target due righe**: `.mc-target-badge` ora flex-direction:column con `.mc-badge-kcal` (kcal, 11px) e `.mc-badge-macros` (P/C/G, 9px grigio).
- **Note focus-within**: tag nascosti di default, animati in view quando `.notes-input-group` è in focus (CSS `:focus-within`). Campo ricerca con icona Lucide `search`.
- **Macro strip colori corretti**: `rc='ok'` (verde) quando rem>0 (sotto target), `rc='err'` (rosso) quando rem<0 (sopra target), `rc='warn'` quando rem < 15% del target.

---

## Bug Noti

> Aggiungere bug con formato: **[DATA] Titolo** — descrizione, file coinvolti, priorità

_Nessun bug noto documentato al momento._

---

## Implementazioni in Corso

> Aggiungere feature WIP con formato: **[DATA] Feature** — stato, file coinvolti, note

_Nessuna implementazione in corso al momento._

---

## Layout & Responsive

### Strategia navbar
- `.nav-tabs` è **fuori** dal `.nav` nel DOM — necessario perché `backdrop-filter` sul `.nav` rompe `position: fixed` dei figli
- **Desktop**: `.nav-tabs` è `position: fixed; top: 0; left: 50%; transform: translateX(-50%); height: 56px` — galleggia centrata sulla top bar
- **Mobile (≤600px)**: `.nav-tabs` diventa `position: fixed; bottom: 0` — bottom tab bar stile iOS
- **Mobile nav brand**: `.nav` visibile su mobile (48px, `padding: 0 16px`), solo logo + nome, `.nav-actions` nascosto
- `.view` su mobile ha `margin-top: 48px` per compensare la nav brand visibile
- Attivo su mobile: solo colore verde (`--on`), no pill background
- `env(safe-area-inset-bottom)` gestisce il notch/home indicator iPhone
- **Tastiera aperta**: classe `kb-open` su `<body>` tramite JS `focusin`/`focusout` → `.nav-tabs` nascosta, `.view` padding ridotto a 16px

### Cache CSS
- `style.css?v=N` — incrementare N ad ogni cambio CSS significativo per forzare reload nel preview browser (Chromium aggressivo sulla cache)

### Preview System (Claude Code)
- **Problema macOS sandbox**: `preview_start` lancia Python in un processo sandboxed che non può leggere da `~/Desktop`. Soluzione: il server serve da `/tmp/marcifit/` (accessibile al sandbox).
- **Server script**: `/tmp/marcifit_server.py` — serve da `/tmp/marcifit/` con `functools.partial(SimpleHTTPRequestHandler, directory='/tmp/marcifit')` (NON usare `os.chdir` + `os.getcwd`, causerebbe PermissionError nel sandbox).
- **Sync obbligatorio prima di ogni screenshot**: eseguire sempre questo comando Bash prima di `preview_screenshot`:
  ```bash
  rsync -a --delete /Users/federicomarci/Desktop/MarciFit/ /tmp/marcifit/ --exclude='.git' --exclude='.claude'
  ```
- **Avvio sessione**: se `preview_start` fallisce per porta occupata → `kill $(lsof -ti :8788)` poi riprovare.

## Architettura & Convenzioni

### State management
- Stato globale centralizzato in `const S` dentro `app.js`
- Salvataggio via `storage.js` con debouncing per evitare write eccessive su localStorage

### Pattern UI
- Componenti renderizzati come stringhe HTML in `uiComponents.js`, iniettati via `innerHTML`
- Event delegation per elementi dinamici

### Dati
- Tutto persiste in `localStorage` — nessuna chiamata server per i dati utente
- Misurazioni corporee: append-only (mai sovrascritte)
- Template pasti separati dal log giornaliero

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
- **Endpoint barcode**: `it.openfoodfacts.net/cgi/search.pl?code={barcode}&action=process&json=1` → `data.products?.[0]` (NON `data.product` — endpoint `world.openfoodfacts.org` va in timeout)
- **AbortController**: `_offAbort` cancella ricerche precedenti; `_searchVersion` counter scarta callback stale
- **Ranking 5 fattori**: name match +3, starts-with +2, brand +1, coverage bonus +3, IT label +1
- **Progressive retry**: se 0 risultati e query ≥3 parole → retry senza ultima parola
- **"Mostra più"**: primi 8 OFF visibili, resto in `<div style="display:none">` con bottone toggle inline
- **Debounce**: 400ms su tutti i search handler

## Note per la Prossima Sessione

> Aggiungere qui context, decisioni pendenti, cose da ricordare

- Il CSS ha una sezione duplicate notes rimossa (c'erano due blocchi `/* NOTES */` — uno intorno a riga 587, uno intorno a 837. Il secondo è stato rimosso.)
- `.stat-i` (icona info "i") non è più nested in `.tg-stat` — usare `.stat-i` come selettore diretto (aggiornato in sessione 2)
- I tooltips BMI/BMR/TDEE funzionano ancora: usano `showTip()`/`hideTip()` con `onmouseenter`/`onmouseleave` sui `.tg-stat-card`
**Sessione 3 — Breathing room & UX (2026-03-18):**
- **Card calendario+macro**: `.today-section-card` wrappa `.cal-nav` + `.week-cal` + `.macro-strip`. Stesso stile di `.today-greeting` (bianco, border-radius 16px, shadow).
- **Alert slim**: `alert_()` ora produce `.alert-slim` con `.alert-dot` colorato (rosso/ambra) invece dei box a larghezza piena. Gli alert appaiono SOLO dopo le 20:00 o su date passate (`isViewingPast || nowHour >= 20`). Soglie: `ALERT_KCAL_ERR=300`, `ALERT_KCAL_WARN=150`, `ALERT_PROT_WARN=20g`.
- **BMI pill inline**: BMI/BMR/TDEE ora in un'unica pill nella riga `.tg-extras` (accanto a streak/score). Classe `.tg-bmi-pill` con main line (BMI + label) e sub line (BMR · ~TDEE). Mini-card row (`.tg-stats-row`) rimossa. Peso rimosso.
- **⚠️ FEATURE FUTURA**: Gestione tolleranza alert (soglie kcal/proteine) da Profilo > Impostazioni alert. Le soglie sono hardcoded in `renderTodayLog()` come costanti `ALERT_KCAL_ERR`, `ALERT_KCAL_WARN`, `ALERT_PROT_WARN`.
- `.nav` è `position:sticky;top:0` — su mobile non serve `margin-top` sul `.view`, il sticky nav è già nel document flow
- Meal card in today mode: `.mc-pills` non vengono renderizzate (dati ridondanti con Apporto Reale). In edit mode i pills restano.
- `.mc-add-btn` ora è tondo con colori pastello (`#e8f0fb` bg, `#5b82b8` icon, `#c8d9f0` border), SVG "+" inside
- `.mc-target-badge` è ora un blocco centrato a larghezza piena con label "OBIETTIVO", kcal grande, macros sotto

**Sessione 5 — Macro strip redesign & bugfix (2026-03-18):**
- **Macro strip redesign**: sostituita la griglia 4-card con struttura a 2 livelli. Card hero kcal (`.ms-kcal-card`) con numero grande + barra progresso + "obiettivo: X kcal". Sotto: 3 card macro (`.ms-macros-row` → `.ms-macro-card.prot/carb/fat`) con emoji (🥩🍚🧈), mini barra colorata, resto mancante.
- **Calendario spostato sotto il recap**: in `today-section-card` l'ordine è ora: titolo "RIEPILOGO GIORNATA" → macro strip → divisore → cal-nav → week-cal.
- **Bug S.checked non date-scoped**: `S.checked` è globale (chiavi `on-0`, `on-1`...), non legato alla data. Il fallback "pasto spuntato senza log → usa piano come stima" in `renderMacroStrip()` ora è protetto da `isToday` — non si applica a date passate/future.
- **Goal badge spostato**: rimosso da `.tg-extras` (causava overflow con 4 badge), ora è in `.tg-right` sotto il chip "Giorno ON/OFF" (flex-column, align-items:flex-end). Separatore corretto `·` (era `?`).
- **Hard reload JS cache**: se `window.location.reload()` non basta, usare `location.href = location.href.split('?')[0] + '?bust=' + Date.now()`.

**Sessione 6 — Extra meals, calendario & logo (2026-03-18):**
- **Pasti extra opzionali**: "Merenda" (tra colazione e pranzo) e "Spuntino" (dopo cena) attivabili per-day. Pulsante tratteggiato `+ Merenda` / `+ Spuntino` per attivare. Attivazione salvata in `S.extraMeals[dateKey]`. Non persistono al giorno successivo.
- **Calendario dot → linea**: giorni compilati mostrano linea verde sottile sopra il numero (`border-top: 2px solid var(--on)`) invece del pallino sovrapposto.
- **`.mc-badge-row` con solo `mc-add-btn`**: senza targetBadge il `+` si allinea a sinistra. Fix: `justify-content:flex-end` sul `.mc-badge-row` nelle card extra senza badge target.
- **Logo PNG — gotcha**: PNG con sfondo nero opaco (canvas 1536×1024), `mix-blend-mode:screen/multiply` non funziona su sfondo beige. Ripristinato logo testuale. **Per logo immagine: esportare sempre PNG con sfondo trasparente.**
- **CLAUDE.md**: aggiornare automaticamente dopo ogni sessione con modifiche significative.

**Sessione 7 — Barcode scanner + mobile fixes (2026-03-18):**
- **Barcode endpoint**: `world.openfoodfacts.org/api/v0/product/{barcode}.json` (~400ms). La struttura è `data.status === 1 ? data.product : null` (non `data.products[0]`). `cgi/search.pl?code=` restituisce sempre 0 risultati — non usarlo per lookup barcode.
- **`showBcResult` fix**: rimossa la riga `document.getElementById('bc-confirm-btn').onclick = confirmBarcodeItem` — il pulsante nel HTML usa già `onclick="confirmBarcodeItem()"` inline, non ha `id="bc-confirm-btn"`.
- **Barcode multi-read confirmation**: BarcodeDetector e Quagga ora richiedono **3 letture consecutive identiche** prima di accettare un barcode. Elimina false letture da frame mosso/sfocato.
- **Quagga migliorato**: intervallo 400ms → 150ms, size 640 → 800, `halfSample:false`, filtro confidence (`avgErr < 0.25` su `decodedCodes`).
- **Camera risoluzione**: `1280×720` → `1920×1080` per migliore lettura barcode piccoli.
- **Zoom disabilitato**: viewport meta `maximum-scale=1.0,user-scalable=no` — previene pinch-zoom e double-tap zoom su mobile.
- **Bottom nav + tastiera**: aggiunto listener `focusin`/`focusout` (in `app.js` dopo `initAll()`) che aggiunge/rimuove classe `kb-open` su `<body>`. In CSS (`@media ≤600px`): `.kb-open .nav-tabs { display:none }` e `.kb-open .view { padding-bottom:16px }`. La barra non sale più sopra la tastiera.

**Sessione 8 — Greeting redesign + Alert Engine + Cibi Preferiti (2026-03-19):**
- **Greeting ridisegnato**: rimossi BMI pill, streak/score badge, chips macro (ridondanti con strip sotto). Sostituiti con frase motivazionale quotidiana (Lora italic) + alert engine condizionale.
- **`getDailyQuote(dateKey)`** in `uiComponents.js`: pool 40 frasi / 4 categorie (Mindset/Scienza/Recupero/Nutrizione), selezione stabile 24h via `dayOfYear % pool.length`.
- **`generateAlerts(type, h, dateKey)`** in `uiComponents.js`: max 3 alert per priorità — supplementi (h≥8), mezzogiorno (h≥12, pct<20%), serali (h≥20 o data passata: kcal/prot/carb). Array `{type, icon, text, hasSuggest, remK, remP, remC, remF}`.
- **`suggestFood(remK, remP, remC, remF)`** in `uiComponents.js`: legge `S.favoriteFoods`, seleziona 1-2 cibi ottimali per deficit dominante, scala porzione se necessario.
- **`S.favoriteFoods = []`** in `app.js`: campo persistente. Schema: `{id, name, kcal100, p100, c100, f100, typicalGrams}`.
- **Funzioni `app.js`**: `addFavoriteFood()`, `removeFavoriteFood(id)`, `_toggleFfForm()`, `openFoodSuggestion(remK,remP,remC,remF)` (apre `showDayModal` `noButtons:true` con cibi suggeriti).
- **Sezione "Cibi Preferiti"** in `renderAnagrafica()`: lista + form inline dashed (nome + kcal/P/C/G per 100g + porzione tipica) con toggle show/hide.
- **Alert "Vedi cosa mangiare →"**: `hasSuggest:true` + `S.favoriteFoods` vuoto → mostra "Aggiungi cibi preferiti →".
- **CSS aggiunto**: `.tg-quote*`, `.tg-alert*`, `.tg-alert-suggest`, `.ff-*`, `.sug-food-*`, `.sug-total` (prima di `@media print`).
- **`generateAssistantMessage()` RIMOSSA** — sostituita da `getDailyQuote()` + `generateAlerts()`. Non riferirla in futuro.

**Sessione 9 — Alert rossi, streak badge, override-dot inline, Cibi Preferiti search/barcode (2026-03-19):**
- **Alert supplementi → rosso**: `.tg-alert-supp` ora usa `background:#fef2f2;border:1px solid #fca5a5;color:var(--red)` (era viola).
- **Override-dot inline**: rimosso `<div>` absolute-positioned nel calendario, sostituito con `<span>` inline dentro `.wc-badge` (5px amber dot). `.wc-badge` ora ha `display:flex;align-items:center;justify-content:center`.
- **Streak badge nel greeting**: `calcStreak()` + `streakBadgeStyle()` (già in nutritionLogic.js / uiComponents.js) wired in `renderGreeting()` tg-right. `#tip-streak` div già in index.html riga 286 — popolare in setTimeout block.
- **`_bcMode = 'log' | 'ff'`** in app.js: pattern per riutilizzare il barcode modal in contesti diversi. `openBarcodeForFf()` setta `_bcMode='ff'`; `showBcResult()` brancha su `_bcMode` — se `'ff'` chiama `fillFfFromProduct()` e chiude; `closeBarcode()` resetta sempre `_bcMode='log'`.
- **Cibi Preferiti search**: `onFfSearch(inp)` debounce 400ms → `searchFoods()` → `_ffSearchResults[]`. `selectFfFood(i)` → `fillFfFromProduct(item)` compila tutti i campi del form.
- **CSS fix Grassi**: `align-items:end` su `.ff-add-grid` allinea inputs in basso anche quando il label "Grassi / 100G" va a capo. `margin-top:12px` su `.ff-add-row` per spazio prima dei bottoni.
- **Versioni correnti**: `style.css?v=46`, `uiComponents.js?v=52`, `app.js?v=54`.

**Sessione 4 — Bugfix mobile (2026-03-18):**
- **iOS zoom fix**: iOS Safari zooma su `<input>` con `font-size < 16px`. Fix: `font-size:16px` nella media query `@media (max-width:600px)` su `.food-search-input`.
- **Bottone duplicato "Carica dal piano"**: era generato sia staticamente in `uiComponents.js` (template `mc-log-panel`) sia dinamicamente in `nutritionLogic.js` (`onLogFoodSearch` → `extra` passato a `renderFoodDropdown`). Rimosso da `nutritionLogic.js`, resta solo in `uiComponents.js`.
- **`renderFoodDropdown(results, resEl, onSelectFn, extraHTML)`** — il 4° param `extraHTML` esiste ancora ma non usarlo per "Carica dal piano" (già nel template statico). Usarlo solo per contenuti specifici ai risultati.
- **Porta 8788 occupata**: se `preview_start` fallisce, usare `lsof -i :8788` + `kill <PID>` per liberare la porta prima di riavviare.
