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
| `app.js` | ~3000 | State globale (`const S`), event handlers, navigazione, modal, onboarding, log peso e calibrazione target |
| `uiComponents.js` | ~4100 | Rendering UI, componenti HTML, card Today/Piano/Stats/Profilo, tooltip e form helpers |
| `nutritionLogic.js` | ~1800 | Motore nutrizione, TDEE, macro, statistiche, helper date, planner pasti, ranking ricerca |
| `storage.js` | ~174 | Persistenza `localStorage`, import/export JSON/Python, recovery stato |
| `style.css` | ~3854 | Design tokens, layout responsive, stili completi dell'app |
| `index.html` | ~401 | Shell principale dell'app, view container, modal, script includes |
| `barcodeTools.js` | ~931 | Scanner barcode, lookup OFF, integrazione con log/template |
| `bootstrapTools.js` | ~141 | Migrazioni e normalizzazione stato in bootstrap |
| `debugTools.js` | ~115 | Debug mode, wrapper fetch, validazione import/storage status |
| `diagnostic.html` | ~39 | Tool minimale di caricamento script / init |
| `docs/` | n/a | Roadmap, audit, checklist e materiale Supabase non runtime |

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

> Ultima modifica: 2026-03-23 (sessione 28)

- Progetto funzionante con le 4 view principali operative
- **Versioni asset correnti**: `style.css?v=132`, `uiComponents.js?v=105`, `app.js?v=87`, `nutritionLogic.js?v=55`, `storage.js?v=37`, `barcodeTools.js?v=14`, `debugTools.js?v=4`, `bootstrapTools.js?v=5` — incrementare ad ogni cambio significativo
- **Navbar**: Lucide SVG icons (calendar-days, utensils, bar-chart-2, user, printer). `.nav` sticky top con brand mobile, `.nav-tabs` bottom su mobile / top centrata su desktop
- **Layout mobile**: bottom tab bar stile iOS, brand bar in alto (48px sticky), tastiera aperta → `kb-open` nasconde nav-tabs
- **Greeting**: frase motivazionale quotidiana (Lora italic) + alert engine contestuale con CTA
- **Macro strip**: card hero kcal + 3 card macro (P/C/F) con barre colorate e resto mancante
- **Pasti extra**: "Merenda" e "Spuntino" attivabili per-day, visibili anche da log reale; stato UI in `S.extraMealsActive[dateKey]`
- **Cibi Preferiti**: `S.favoriteFoods[]` persistente, usati per suggerimenti alimentari negli alert serali
- **Barcode scanner**: BarcodeDetector + Quagga fallback, stabilizzazione rapida con score adattivo, fallback anticipato, camera 1920×1080
- **Edit grammatura**: matita inline nelle log row, live preview kcal nel modal
- **Click macro card**: breakdown per pasto del nutriente selezionato
- **Calorie rimanenti**: mostrate nel gram picker durante l'aggiunta di un alimento
- **Completion model unificato**: giorno compilato solo con attività reali (`foodLog`, acqua, integratori). Checkbox pasti deprecated e non più fonte di verità
- **Focus del momento**: card singola con un solo CTA verso il pasto e insight sintetico su stato/log del pasto
- **Stato vuoto premium rimosso**: non esiste più la card "Oggi è ancora da accendere"
- **Preview live locale**: `live-preview.html` con watch file-based, memoria di tab/scroll e toggle opzionale per `preview-state.json`
- **Tab Piano semplificata**: la vista segue direttamente `S.day` (giorno attivo di `Oggi`), senza più toggle ON/OFF dedicato
- **Quadro giornaliero più compatto**: in `Piano` resta solo `Target giorno`, con mini-stat compatti (`Stato kcal`, `Stato macro`, `Pasto in focus`, `Template utili`) e tooltip reali
- **Planner pasti più guidato**: flow `Scegli > Dai contesto > Usa`, preset rapidi, opzioni compatte e card macro mini orizzontali
- **Template library orientata al contesto**: contatori in alto, ordinamento privilegiando i template coerenti col pasto in focus
- **Quick actions in Oggi**: blocco azioni rapide sotto la dashboard (`Pasto attuale/prossimo`, `+ Acqua`, `Routine`, `Note`) con micro-contesto utile
- **Acqua premium animation**: la progress bar della card acqua anima davvero dal valore precedente al successivo con sheen/glow quando si preme `+`
- **Tooltip piano reali**: gli info button del `Quadro giornaliero` usano `showTip()` con `tip-piano-summary`, non solo il `title` nativo
- **Smoke suite disponibile**: `smoke:core`, `smoke:dataflow`, `smoke:storage` presenti e tutti verdi in sessione 24
- **Nota struttura**: `start.html` non è più presente in root; lo sviluppo attuale passa da `index.html` + preview/smoke scripts
- **Integratori unificati in Oggi**: la gestione vive solo nella card `Routine integratori` della tab `Oggi`; `Profilo` non mostra più una card separata
- **Motore nutrizione aggiornato**: TDEE ora basato su `BMR + NEAT + EAT + TEF`, non piu solo `BMR × PAL`
- **Passi medi giornalieri**: campo opzionale in profilo/onboarding usato per classificare meglio il `NEAT`
- **Calibrazione 14 giorni**: aggiustamento automatico conservativo dei target kcal in base al trend peso recente
- **Root ripulita**: roadmap, audit, checklist e materiale Supabase sono stati spostati sotto `docs/`

---

## Bug Noti

> Aggiungere bug con formato: **[DATA] Titolo** — descrizione, file coinvolti, priorità

- **[2026-03-23] Smoke Playwright in sandbox macOS** — gli script Playwright headless possono fallire per permessi Mach port / browser launch, quindi i test E2E non sono sempre affidabili dentro l'ambiente Codex sandboxato. File coinvolti: `scripts/*.mjs`, ambiente locale. Priorità: media.

---

## Implementazioni in Corso / Feature Future

> Aggiungere feature WIP con formato: **[DATA] Feature** — stato, file coinvolti, note

- **⚠️ [FUTURA] Gestione tolleranza alert**: soglie kcal/proteine da Profilo > Impostazioni alert. Attualmente hardcoded in `renderTodayLog()`: `ALERT_KCAL_ERR=300`, `ALERT_KCAL_WARN=150`, `ALERT_PROT_WARN=20g`.
- **⚠️ [FUTURA] Lista della spesa**: da collegare alla tab `Piano`, idealmente come output dei template e del planner pasti.
- **⚠️ [FUTURA] Planner pasti ancora più assistito**: possibili CTA contestuali tipo `Sistema questo pasto`, suggerimenti auto sul pasto più debole e modalità `minimo sforzo`.

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
- **Live preview principale**: aprire `http://127.0.0.1:8788/live-preview.html`
- **Server locale**: `python3 server.py` dalla root del progetto
- **Watch-based refresh**: la preview non ricarica a intervalli fissi; interroga `/__preview_status` e refresha solo quando cambiano file rilevanti (`.html`, `.css`, `.js`, `.json`, `.mjs`)
- **Preservazione stato preview**: la pagina live tenta di mantenere tab corrente e scroll dopo il refresh; mette in pausa il watch mentre l'utente interagisce
- **Preview state opzionale**: creare `preview-state.json` in root per simulare scenari dedicati; `preview-state.example.json` contiene uno scheletro iniziale
- **Screenshot Playwright**: `npm run preview:today` genera `.codex-previews/today-desktop.png` e `.codex-previews/today-mobile.png`
- **Script utili**:
  ```bash
  npm run preview:serve
  npm run preview:today
  ```
- **Nota sandbox macOS**: browser headless e bind socket locale possono richiedere esecuzione con permessi estesi dall'ambiente Codex

---

## Architettura & Convenzioni

### State management
- Stato globale centralizzato in `const S` dentro `app.js`
- Salvataggio via `storage.js` con debouncing per evitare write eccessive su localStorage

### Pattern UI
- Componenti renderizzati come stringhe HTML in `uiComponents.js`, iniettati via `innerHTML`
- Event delegation per elementi dinamici
- `generateAssistantMessage()` è **RIMOSSA** — usare `getDailyQuote()` + `generateAlerts()` in `uiComponents.js`
- Guardrail copy prodotto: tutto cio che riguarda infrastruttura, setup, stati interni e limiti temporanei resta fuori dalla UI utente; applicare sempre la checklist in `docs/checklists/product-copy-guardrails.md`

### Dati
- Tutto persiste in `localStorage` — nessuna chiamata server per i dati utente
- Misurazioni corporee: append-only (mai sovrascritte)
- Template pasti separati dal log giornaliero
- Storage key locale: `piano_federico_v2`
- `doneByDate` è derivato dal completion model reale e può contenere anche `hasTypeOverride` per override ON/OFF senza attività
- `S.checked` / checkbox pasti sono da considerare deprecate: non usarle per progress, streak, calendario o alert
- `S.anagrafica.passiGiornalieri` è opzionale; se presente influenza la stima del `NEAT`
- `S.goal.calibrationOffsetKcal` e `S.goal.calibrationMeta` tengono traccia della taratura automatica su 14 giorni

### Struttura docs
- `docs/plans/` contiene roadmap e piani di lavoro
- `docs/audits/` contiene audit, analisi e dump di ricerca
- `docs/checklists/` contiene checklist operative
- `docs/checklists/product-copy-guardrails.md` e la checklist permanente per copy e microcopy di prodotto
- `docs/supabase/` contiene setup e schema del backend opzionale

### File `start.html`
- Riferimento legacy: il file non è più presente in root
- Il file principale di sviluppo resta `index.html`

---

## Comandi Utili

```bash
# Avviare il server di sviluppo
python3 server.py

# Live preview watch-based
open http://127.0.0.1:8788/live-preview.html

# Screenshot desktop/mobile della tab Oggi
npm run preview:today

# Screenshot desktop/mobile della tab Stats
npm run preview:stats

# Smoke test principali
npm run smoke:core
npm run smoke:dataflow
npm run smoke:storage
```

App accessibile su: `http://localhost:8788`

---

## Ricerca Alimenti — Architettura OFF

- **Endpoint search**: `it.openfoodfacts.net/cgi/search.pl?search_terms=...&search_simple=1&action=process&json=1&page_size=30`
- **Endpoint barcode**: `world.openfoodfacts.net/api/v0/product/{barcode}.json?fields=code,product_name,product_name_it,product_name_en,generic_name,generic_name_it,brands,quantity,nutriments`
- **AbortController**: `_offAbort` cancella ricerche precedenti; `_searchVersion` counter scarta callback stale
- **Normalizzazione query**: `normalizeFoodText()` + `tokenizeFoodText()` + `removeWeakTokens()` + `buildFoodQueryContext()`
- **Ranking centralizzato**: `scoreFoodResult()` usato per locale, recenti e OFF; segnali principali = exact/contains, coverage token, bigram, brand, qualità nutrizionale, priorità source
- **Deduplica robusta**: `getFoodDedupeKey()` + `dedupeFoodResults()` (nome normalizzato + brand + kcal arrotondate)
- **Whole-food tuning**: `WHOLE_FOOD_TERMS` + `COMPOUND_FOOD_TERMS` + `wholeFoodQueryAdjustment()` per favorire query semplici tipo `banana`, `mela`, `pollo`, `riso`
- **Progressive retry**: se 0 risultati e query ≥3 parole → retry senza ultima parola
- **"Mostra più"**: primi 5 risultati locali/recenti e primi 5 OFF visibili, resto dietro bottone toggle inline
- **Debounce**: 400ms su tutti i search handler
- **Barcode cache**: `_bcProductCache[barcode]` per evitare refetch sullo stesso codice
- **Fallback nutrimenti barcode**: kcal da `energy-kcal_100g`, altrimenti `energy-kj_100g`/`energy_100g`, altrimenti formula da macro
- **Scanner barcode**: conferma ridotta a 2 letture consecutive identiche; su miss riprende la scansione senza rifare `getUserMedia`

---

## Note per la Prossima Sessione

> Solo note pendenti, non storico. Rimuovere quando risolte.

- **Smoke integratori/import/edit**: `smoke:core` ora copre mount + add da `Profilo`, coerenza data per `renderSuppToday()` e preview live del modal `edit grammatura`; `smoke:storage` copre anche import con shape `macro` invalida.
- **Stats preview**: esiste `scripts/preview-stats.mjs` con stato demo ricco; usare `npm run preview:stats` prima di toccare layout/gerarchia della tab `Stats`.
- **Logo PNG gotcha**: PNG con sfondo opaco — `mix-blend-mode:screen/multiply` non funziona su sfondo beige. Per logo immagine: esportare **sempre PNG con sfondo trasparente**.
- **Documentazione di lavoro**: nuove roadmap, audit o checklist vanno messe direttamente in `docs/`, non in root.

---

## Storico Sessioni

### Sessione 28 — Motore science-based + hardening stato + riordino root (2026-03-23)
- **TDEE a componenti**: il motore passa a `Mifflin/Katch + NEAT + EAT + TEF`, con macro impostati tramite proteine e grassi per kg e carboidrati in residuo.
- **Passi e calibrazione**: introdotti `passiGiornalieri` nel profilo e una calibrazione automatica a 14 giorni sui target kcal basata sul trend peso.
- **Persistenza hardenizzata**: bootstrap e validazione import ora conoscono anche `passiGiornalieri`, `goal.calibrationOffsetKcal` e `goal.calibrationMeta`.
- **Directory pulita**: roadmap, audit, checklist e file Supabase spostati in `docs/`, con riferimenti interni aggiornati.

### Sessione 27 — Rifinitura gram picker + chiusura UX inserimento cibi (2026-03-21)
- **Gram picker rifatto**: separata visivamente la parte informativa del cibo dalla parte operativa di input grammatura. Ora il pannello mostra brand, badge sorgente/verifica, macro per `100g`, riepilogo live della quantita scelta e area input piu chiara.
- **UX piu leggibile**: aggiunte emoji anche alle macro del picker, titolo esplicito `Valori nutrizionali per 100g` e gerarchia visiva piu user friendly senza spostare le chips porzione.
- **Mobile ottimizzato**: ridotti padding e altezza complessiva, macro grid resa piu densa e riga `grammi + kcal + Aggiungi` compressa per recuperare spazio verticale.
- **Stato finale**: il lavoro sul gram picker e considerato chiuso; eventuali ritocchi futuri sono solo cosmetici minori.

### Sessione 26 — Sgarro controllato settimanale (2026-03-21)
- **Offset kcal dedicato**: introdotti `cheatMealsByDate` e `cheatConfig` nello stato. Lo sgarro non entra nel `foodLog`, ma alza solo il target kcal del giorno, lasciando invariati i macro target.
- **Formula automatica**: default a `+12%` del target kcal del giorno, arrotondato a step da 25 kcal e limitato tra `250` e `450` kcal. Limite settimanale iniziale: `2`, con hard cap tecnico `3`.
- **UI Today + calendario**: aggiunta card `Sgarro controllato` nella sezione supporto, mostrata solo quando lo sgarro e attivo. Il calendario settimanale mostra ora un marker rosso sui giorni con sgarro, riposizionato lontano dalla label `OGGI`.
- **Attivazione automatica**: se l intake reale supera il target kcal base del giorno di almeno `250 kcal`, lo sgarro si attiva da solo (`source: auto_surplus`) e la card compare nel support panel con spiegazione del trigger.
- **Persistenza e test**: storage/import validano e persistono i nuovi nodi; `smoke:core` copre add/rimozione sgarro, aggiornamento target kcal, marker calendario e blocco del terzo sgarro nella stessa settimana.

### Sessione 25 — Cache-bust preview + smoke fallback barcode (2026-03-21)
- **Preview forzata**: bumpati i version tag in `index.html` per `debugTools.js`, `storage.js`, `uiComponents.js`, `app.js` e `barcodeTools.js`, cosi le preview locali ricaricano con certezza gli asset aggiornati dopo gli ultimi fix.
- **Barcode fallback coperto in smoke**: `smoke:core` ora verifica il caso `NotAllowedError` su `getUserMedia()`, controlla che compaiano testo errore e CTA "Usa ricerca testuale", poi conferma apertura e focus della search inline sul pasto corretto.

### Sessione 24 — Hardening day-type ops + fix edit grammatura (2026-03-21)
- **Azioni su pasti rese piu consistenti**: aggiunto `resolveDayTypeForDate(dateKey)` in `app.js` e usato per log food, barcode, clear/remove/edit item e caricamento template, cosi sync/rerender non dipendono piu ciecamente da `S.day` quando l'azione nasce da una `dateKey` esplicita.
- **Edit grammatura davvero live**: rimosso lo script inline dal body del modal `showDayModal()`; la preview kcal usa ora un binder document-level (`bindEditGramPreview()`), compatibile con contenuti inseriti via `innerHTML`.
- **Smoke core esteso**: aggiunti check sul modal di edit grammatura (`#edit-gram-calc` si aggiorna davvero) oltre ai test gia presenti su integratori.

### Sessione 23 — Fix integratori + hardening import (2026-03-21)
- **Integratori stabilizzati**: ripristinato il mount `supps-card` in `Profilo`, eliminati gli id duplicati dei form tra `Oggi` e `Profilo`, introdotti scope separati (`today` / `profile`) per apertura e submit.
- **Data selezionata rispettata**: `renderSuppToday()` legge ora `S.selDate || localDate()`, quindi il support panel resta coerente con il giorno in vista.
- **Alert macro corretti**: `macroAlerts()` usa finalmente `type` invece di `S.planTab` per i confronti ON/OFF.
- **Import più sicuro**: validazione JSON estesa a `anagrafica`, `macro`, `goal`, `mealPlanner`, `foodLog`, `supplements` e altri nodi; l'import applica solo chiavi utente note tramite helper condiviso, senza più `Object.assign(S, parsed)` indiscriminato.
- **Test aggiornati**: `smoke:core`, `smoke:dataflow`, `smoke:storage` verdi; aggiunti check su integratori da `Profilo`, coerenza `S.selDate` e import strutturalmente invalido.

### Sessione 22 — Audit CLAUDE + debugging generico (2026-03-21)
- **`CLAUDE.md` riallineato**: aggiornati file principali, conteggi indicativi, script utili e nota sul fatto che `start.html` non è più presente in root.
- **Smoke test confermati**: `npm run smoke:core`, `npm run smoke:dataflow` e `npm run smoke:storage` eseguiti con esito positivo.
- **Bug documentati**: emersi 4 problemi attuali da prioritizzare subito: form integratori con id duplicati tra `Oggi` e `Profilo`, `Routine integratori` non agganciata a `S.selDate`, `macroAlerts()` che usa `S.planTab` al posto del `type` iterato, validazione import JSON troppo permissiva.


### Sessione 21 — Testi scanner barcode resi stabili (2026-03-20)
- **Stage barcode monotoni**: `_setBarcodeScanStage()` in `barcodeTools.js` non permette piu regressi di stato (`quagga` non torna a `full`, `full` non torna a `wide`), evitando il continuo alternarsi dei testi nel modal.
- **Hint meno nervoso**: il messaggio `Barcode quasi agganciato` non mostra piu il codice candidato frame-per-frame, cosi il testo resta stabile anche quando il detector cambia proposta durante l'aggancio.
- **Cache busting**: aggiornato `index.html` a `barcodeTools.js?v=12` per distribuire subito il fix dei messaggi.

### Sessione 20 — Stabilizzato layout modal barcode (2026-03-20)
- **Flicker ridotto**: `_setBarcodeStatus()` in `barcodeTools.js` non riscrive piu DOM e classi quando messaggio e tono sono identici, evitando repaint inutili durante il loop di scansione.
- **Spazio status riservato**: `.bc-status` in `style.css` ora ha altezza minima piu generosa e centratura flex, cosi i messaggi scanner non fanno piu saltare continuamente l'altezza del modal.
- **Cache busting**: aggiornati `style.css?v=61` e `barcodeTools.js?v=11` in `index.html` per far arrivare subito i fix UI ai client.

### Sessione 19 — Switch dominio OFF per barcode (2026-03-20)
- **Stesso provider, dominio piu rapido**: il lookup barcode in `barcodeTools.js` passa da `world.openfoodfacts.org` a `world.openfoodfacts.net`, mantenendo invariato il provider Open Food Facts e la forma dell'endpoint `v0`.
- **Cache busting**: aggiornato `index.html` a `barcodeTools.js?v=10` per forzare il reload del modulo barcode sui client.
- **Motivazione pratica**: test sul barcode `4056489905783` hanno mostrato circa `12s` su `.org` contro circa `0.5s` su `.net`, a parita di payload utile.

### Sessione 18 — Barcode scanner reso piu reattivo (2026-03-20)
- **Scanner velocizzato**: ridotta la soglia di conferma del codice in `barcodeTools.js` per tornare a un aggancio rapido quando le letture sono buone, senza eliminare la stabilizzazione.
- **Fallback anticipato**: Quagga parte prima quando `BarcodeDetector` non aggancia subito; inoltre evita il pass full-frame piu costoso nel loop ibrido e torna a `size:800` con reader focalizzati su EAN/UPC.
- **Lookup OFF piu corto**: rimosso il singolo timeout lunghissimo (26s). Ora il barcode fa due tentativi brevi (4s + 6s) con messaggio esplicito di retry se Open Food Facts e lento.
- **Cache busting**: aggiornato `index.html` a `barcodeTools.js?v=9` per evitare che il browser continui a usare la versione lenta del modulo barcode.

### Sessione 17 — Semplificazione tab Piano + rifiniture Oggi (2026-03-20)
- **Tab Piano ripensata**: eliminato il toggle ON/OFF dedicato; la vista segue direttamente `S.day` deciso in `Oggi`. `renderPiano()` usa `S.day` come fonte primaria del tipo giorno.
- **Quadro giornaliero semplificato**: rimosso `Totale piano`, mantenuto solo `Target giorno`; rimossa anche la riga finale `Mancano oggi...` per evitare ridondanza.
- **Mini-stat in Piano**: `Stato kcal`, `Stato macro`, `Pasto in focus`, `Template utili` convertiti in mini-card compatte con tooltip reali (`tip-piano-summary`) e info icon SVG.
- **Bugfix logica stato kcal/macro**: gli stati non leggono più il piano scritto, ma il log reale della giornata (`getLoggedDayMacros(dateKey)`). Se non ci sono cibi inseriti, il fabbisogno risulta correttamente tutto da coprire.
- **Planner pasti compattato**: target macro in card mini orizzontali, preset più minimal, opzioni separate dal blocco azioni (`Genera suggerimenti` / `Reset`), helper meno verticale.
- **Template library contestuale**: aggiunti contatori di libreria e ordinamento che privilegia i template coerenti col pasto attualmente in focus.
- **Quick actions nella tab Oggi**: aggiunto blocco scorciatoie sotto la dashboard con CTA rapide verso pasto corrente/prossimo, acqua, routine e note.
- **Water widget premium**: progress bar acqua con animazione reale dal valore precedente al nuovo valore, glow leggero e sheen al click su `+`.

### Sessione 16 — Redesign tab Stats, redesign tab Oggi e alert contestuali (2026-03-20)
- **Tab Stats rifatta per gerarchia**: introdotti `statsRange` persistente, toolbar `7d/30d/8w/all`, hero insight, nuova sezione peso e blocchi separati per `Misure e composizione`, `Aderenza e costanza`, `Pattern utili`, `Azioni rapide`.
- **Range data centralizzato**: in `uiComponents.js` aggiunti helper per bounds periodo, trend peso, medie mobili, confronto col periodo precedente, misure nel range, breakdown aderenza (`mealRate`, `hydrationRate`, `supplementRate`, `weekendAdherenceRate`) e pattern automatici.
- **Weight chart pulito**: rimossa la proiezione aggressiva dal grafico peso; ora mostra linea reale, rolling average e target. Cronologia pesate collassabile.
- **Heatmap Stats allineata al range**: `renderHeatmap(data)` non usa più una finestra fissa separata; ora segue il range selezionato (con limite max sul caso `all`).
- **Stats preview dedicata**: aggiunti `scripts/preview-stats.mjs` e script `npm run preview:stats` per screenshot Playwright desktop/mobile della tab `Stats`.
- **Tab Oggi ridisegnata**: unificati `Riepilogo giornata` + `Settimana` in `Dashboard del giorno`; aggiunti `Timeline pasti` e `Supporto giornata`; mantenuto esplicitamente l'ordine temporale dei pasti.
- **Greeting definitivo**: ridotte dimensioni e spazi del blocco hero (`tg-hello`, meta row, chip ON/OFF, streak, quote) per renderlo più editoriale e meno dominante rispetto alla dashboard.
- **Alert fuori dal greeting**: gli alert non vivono più nella hero. Nuovo modello: `signal row` nella dashboard, `context alert` dentro `Focus del momento`, `support alert` dentro `Supporto giornata`.
- **Alert cliccabili**: i segnali nella dashboard possono portare al punto di risoluzione; esempio integratori → `revealTodaySupplement(id)` evidenzia il blocco corretto nel support panel.
- **Integratori spostati da Piano a Oggi**: rimossa la sezione Integratori dalla tab `Piano`; `Supporto giornata` ora contiene mini manager completo per segnare, aggiungere e disattivare integratori (`renderSuppToday()` + form inline `supp-form`).
- **Preview-first workflow confermato**: per redesign su `Today` e `Stats` è stato usato sistematicamente Playwright (`preview:today` / `preview:stats`) prima di considerare chiuso ogni sprint.

### Sessione 15 — Completion model, preview live e cleanup tab Oggi (2026-03-20)
- **Completion model reale**: giorno compilato solo con attività concrete (`foodLog`, acqua, integratori). `S.checked`/checkbox pasti non guidano più streak, calendario, progress o alert
- **`getDayCompletion()` introdotta**: fonte unica per progress della giornata, calendario e streak. `doneByDate` salva anche `activityCount`, `hasActivity`, `suppDone`, `waterCount`, `hasTypeOverride`
- **Extra meals robuste**: `merenda/spuntino` contano anche quando presenti solo nel log reale, non solo in `extraMealsActive`
- **Override ON/OFF persistente**: il cambio ON/OFF resta salvato anche senza attività; il calendario mostra il dot arancione di override senza contare il giorno come completato
- **Score rimosso**: eliminati `calcWeekScore()`, tooltip score e riferimenti UI correlati
- **Alert engine rivisto**: fasi temporali (`early/morning/midday/late/end`), supplementi due/overdue, alert combinato "piu fronti", CTA integrate nel greeting
- **Focus del momento**: include extra meals, ora ha un solo CTA verso il pasto e un insight stateful sul pasto; rimosse shortcut acqua/creatina
- **Card vuota rimossa**: eliminato lo stato vuoto "Oggi e ancora da accendere"
- **Preview live**: aggiunti `live-preview.html`, `preview-state.example.json`, watch endpoint `/__preview_status` in `server.py`, memoria di tab/scroll e refresh solo su file change

### Sessione 14 — Ricerca cibi: ranking, whole-food, UI e barcode polish (2026-03-19)
- **Greeting tab Oggi compattato**: data spostata accanto ai badge nel `tg-head-row` e spacing ridotto per evitare vuoti tra data e saluto.
- **Ricerca cibi rifatta lato motore**: aggiunti in `nutritionLogic.js` `normalizeFoodText()`, `buildFoodQueryContext()`, `buildFoodResultContext()`, `scoreFoodResult()`, `dedupeFoodResults()`, `getFoodDedupeKey()`. `searchFoods()` e `fetchOFF()` ora usano ranking/deduplica unificati.
- **Whole-food boost**: query semplici tipo `banana` / `mela` / `pollo` / `riso` riconosciute tramite `WHOLE_FOOD_TERMS`; prodotti composti (`chips`, `snack`, `dessert`, `bevanda`, ecc.) penalizzati con `COMPOUND_FOOD_TERMS`.
- **Dropdown risultati più compatto**: primi 5 locali/recenti e primi 5 OFF visibili, poi bottone `Mostra più risultati`.
- **Restyling risultati ricerca**: `style.css` aggiornato per `.food-search-results`, `.fsr-item`, `.fsr-show-more`, `.fsr-gram-row`, `.mf-form` — cards più pulite, badge migliori, stato selezionato più leggibile.
- **Barcode migliorato**: cache per barcode (`_bcProductCache`), parsing nutrimenti più robusto (`_buildFoodItemFromBarcodeProduct()`), timeout fetch ridotto a 5s con `AbortController`, resume scan senza riaprire la camera, stop stream quando il prodotto viene trovato.
- **Barcode modal ridisegnato**: `index.html` ripulito dagli inline style del modal e nuove classi CSS `.bc-*` in `style.css` per shell, header, frame camera, status e result card.

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
- **Alert slim**: rimossi dalla view Oggi perché ridondanti rispetto agli alert già presenti nel greeting
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
- **Barcode endpoint corretto**: `world.openfoodfacts.net/api/v0/product/{barcode}.json`, struttura `data.status === 1 ? data.product : null`
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
