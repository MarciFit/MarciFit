# MarciFit - Stato Attuale e Roadmap Migliorie

## Obiettivo del documento

Fare un punto della situazione dell'app allo stato attuale su tre fronti:

- debug e affidabilita
- qualita UI
- qualita UX

e definire una sequenza di migliorie future da valutare insieme, senza perdere la direzione prodotto gia molto chiara dell'app.

## Snapshot rapido

### Punti forti

- L'app ha gia una personalita precisa: non sembra un template generico, ma un prodotto cucito su un uso reale.
- La direzione UX e buona: `Oggi`, `Piano`, `Stats`, `Profilo` sono quattro aree comprensibili e coerenti.
- Il tono dei testi e utile: molte microcopy spiegano bene cosa fare e perche.
- Esistono gia alcuni guardrail tecnici: `window.onerror`, `diagnostic.html`, migrazioni in `initAll()`, `saveSoon()`.
- C'e gia una sensibilita mobile: media queries, gestione tastiera con `visualViewport`, bottom flow ottimizzato per task rapidi.

### Debiti principali

- La codebase e molto concentrata in pochi file monolitici.
- Non esiste una suite test reale.
- L'osservabilita dei bug e minima: molti errori vengono silenziati.
- L'accessibilita e fragile: molti `onclick` inline, semantica limitata, focus states non sistematici.
- La UX ha tanta ricchezza, ma in alcuni punti rischia sovraccarico cognitivo.

## Stato attuale: valutazione debug

### 1. Osservabilita

Situazione:

- `window.onerror` mostra un overlay utile in sviluppo.
- `diagnostic.html` aiuta a capire se il bootstrap JS fallisce.
- `save()` e `loadSaved()` in [storage.js](/Users/federicomarci/Desktop/MarciFit/storage.js) catturano errori senza loggarli.

Valutazione:

- Bene per il debug locale veloce.
- Debole per diagnosi serie: se `localStorage` fallisce o il JSON e corrotto, oggi non sappiamo quasi nulla.

Rischio:

- bug silenziosi
- stato incoerente difficile da ricostruire
- regressioni introdotte senza segnali chiari

### 2. Testabilita

Situazione:

- `package.json` non ha test reali; `npm test` fallisce volutamente.
- Esistono script Playwright di preview, ma non una batteria di test di regressione.

Valutazione:

- oggi il progetto dipende soprattutto da verifica manuale
- il rischio cresce molto ogni volta che si tocca `app.js`, `uiComponents.js` o `style.css`

Nota pratica:

- Ho provato a eseguire le preview Playwright, ma nel sandbox attuale il browser headless viene bloccato da permessi macOS. Quindi la lettura visuale automatica completa non e ancora disponibile in questo turno.

### 3. Architettura e manutenzione

Situazione:

- [app.js](/Users/federicomarci/Desktop/MarciFit/app.js): 2511 righe
- [uiComponents.js](/Users/federicomarci/Desktop/MarciFit/uiComponents.js): 3433 righe
- [style.css](/Users/federicomarci/Desktop/MarciFit/style.css): 3382 righe
- [nutritionLogic.js](/Users/federicomarci/Desktop/MarciFit/nutritionLogic.js): 1282 righe

Valutazione:

- La logica esiste ed e viva, ma il costo di modifica sta salendo.
- Stato, rendering, eventi, migrazioni, fetch esterni e utilita convivono in zone molto dense.
- L'uso diffuso di `innerHTML` e handler inline rende il codice rapido da evolvere, ma piu delicato da rifattorizzare.

Giudizio debug complessivo:

- **funziona come prodotto personale avanzato**
- **non e ancora abbastanza robusto come base per crescere velocemente senza regressioni**

## Stato attuale: valutazione UI

### Punti forti UI

- Identita visiva coerente e riconoscibile.
- Buon uso di tipografia, palette e superfici.
- Le card principali hanno gerarchia visiva leggibile.
- Il tab `Today` sembra essere la parte piu curata e con il miglior focus.

### Criticita UI

#### 1. Densita elevata

In diverse aree compaiono tanti blocchi informativi ravvicinati:

- dashboard giorno
- focus del momento
- timeline pasti
- supporto giornata
- note
- helper nel piano
- stats con molte sezioni consecutive

Effetto:

- percezione premium, ma anche possibile fatica visiva
- rischio che le CTA importanti si perdano tra elementi secondari

#### 2. Eterogeneita dei pattern

Nel progetto convivono:

- card molto rifinite
- modali e pannelli piu spartani
- diversi bottoni con stili inline
- diversi livelli di rifinitura fra sezioni

Effetto:

- alcune parti sembrano "prodotto"
- altre sembrano ancora "strumento interno evoluto"

#### 3. Responsiveness da consolidare

Ci sono media query e accorgimenti mobile, quindi la base c'e.
Pero la presenza di:

- nav sticky/fixed
- molte card con contenuto dinamico
- sezioni molto dense
- modali e scanner barcode

rende importante una revisione visiva reale su iPhone e desktop largo.

Giudizio UI complessivo:

- **molto sopra la media per un'app custom non framework-heavy**
- **serve un passaggio di design system leggero per uniformare i dettagli**

## Stato attuale: valutazione UX

### Punti forti UX

- La struttura per intenti e chiara.
- `Today` orienta bene verso le azioni del giorno.
- La presenza di note, acqua, integratori e focus del momento aumenta il valore pratico.
- La roadmap `Stats` gia presente nel file [stats-redesign-plan.md](/Users/federicomarci/Desktop/MarciFit/stats-redesign-plan.md) va nella direzione giusta: meno log sparsi, piu dashboard decisionale.

### Criticita UX

#### 1. Sovraccarico cognitivo

L'app offre molto, ma non sempre distingue con forza:

- cosa e prioritario adesso
- cosa e secondario
- cosa e configurazione rara
- cosa e tracking quotidiano

Questo e il principale rischio UX attuale.

#### 2. Troppe azioni distribuite

Molte azioni passano da:

- click su card
- piccoli bottoni contestuali
- elementi testuali cliccabili
- modali
- drawer

Per un utente esperto va bene. Per una UX piu solida e prevedibile, conviene ridurre i pattern attivi.

#### 3. Accessibilita limitata

L'uso ampio di `onclick` inline e `innerHTML` dinamico suggerisce alcune fragilita:

- navigazione tastiera non garantita ovunque
- screen reader non sempre aiutati da ruoli/etichette coerenti
- stati attivi e focus non uniformi

Giudizio UX complessivo:

- **molto buona come app personale operativa**
- **da semplificare nei percorsi principali per diventare piu stabile e meno faticosa**

## Priorita consigliate

### Priorita 1 - Stabilita prima di nuove feature

Da fare prima di allargare ulteriormente il prodotto.

- aggiungere logging minimo strutturato per `save`, `loadSaved`, fetch barcode/OpenFoodFacts
- introdurre una modalita debug attivabile
- creare 5-8 smoke test reali sui flussi essenziali
- definire una checklist di regressione manuale breve

Impatto:

- riduce il rischio di rompere l'app
- velocizza qualunque lavoro successivo

### Priorita 2 - Snellire l'architettura

- separare stato, bootstrap, modali, barcode, note, stats e profile in moduli piu piccoli
- iniziare da estrazioni non rischiose
- ridurre gradualmente gli handler inline

Impatto:

- codice piu leggibile
- debugging piu rapido
- cambi UI piu sicuri

### Priorita 3 - Razionalizzare la UX del tab Oggi

- rafforzare una sola CTA principale per momento della giornata
- comprimere elementi secondari dietro pattern piu calmi
- rivedere ordine e peso visivo di supporto, note, alert e focus

Impatto:

- meno fatica
- piu immediatezza
- app piu "daily-use"

### Priorita 4 - Portare Stats a livello dashboard

La direzione e gia tracciata nel documento esistente.

- separare lettura e inserimento dati
- ridurre il rumore
- dare insight narrativi e azioni rapide contestuali

Impatto:

- aumenta il valore percepito dell'app
- rende i dati piu utili, non solo archiviati

### Priorita 5 - Accessibilita e rifinitura UI

- audit di focus, tab order, aria-label, semantica modali
- uniformare pulsanti, chip, badge, empty states, form secondari
- introdurre qualche regola base di design system

Impatto:

- esperienza piu coerente
- meno edge case
- migliore qualita percepita

## Roadmap a step

## Step 0 - Baseline e verifica

Obiettivo:

capire con precisione cosa si rompe oggi e cosa no

Task:

- attivare log debug non invasivi
- definire 1 documento di smoke test
- verificare bootstrap, storage, barcode, stats, import/export

Output atteso:

- checklist affidabile
- lista bug reali riproducibili

## Step 1 - Hardening tecnico

Obiettivo:

mettere in sicurezza l'app attuale

Task:

- gestire errori con messaggi e log migliori
- evitare swallow totale delle eccezioni critiche
- creare preview/test minimi per `Today`, `Piano`, `Stats`, `Profilo`

Output atteso:

- meno regressioni invisibili
- debugging piu rapido

## Step 2 - Refactor strutturale leggero

Obiettivo:

ridurre la pressione dei file monolitici

Task:

- estrarre moduli per view
- estrarre eventi/modali
- centralizzare helper UI

Output atteso:

- codice piu facile da toccare
- minore paura di modificare

## Step 3 - UX pass principale

Obiettivo:

rendere piu chiaro cosa fare subito in ogni schermata

Task:

- semplificare `Today`
- ridurre azioni concorrenti
- migliorare empty states e stati parziali

Output atteso:

- flusso quotidiano piu netto
- minor carico mentale

## Step 4 - Stats redesign

Obiettivo:

trasformare `Stats` in dashboard decisionale

Task:

- implementare struttura prevista nel piano esistente
- spostare gli input secondari in azioni rapide o pannelli comprimibili
- introdurre insight testuali con priorita chiare

Output atteso:

- tab molto piu utile e leggibile

## Step 5 - Accessibility e polish

Obiettivo:

portare il prodotto a un livello piu maturo

Task:

- audit tastiera
- audit screen reader
- uniformazione stili e componenti secondari

Output atteso:

- esperienza piu coerente e robusta

## Cose che non farei subito

- riscrivere tutto in framework
- redesign completo visivo senza prima consolidare i flussi
- aggiungere molte nuove feature prima della baseline debug
- inseguire micro-ottimizzazioni CSS premature

## Raccomandazione finale

La mossa piu intelligente adesso non e aggiungere subito altra complessita, ma fare un mini ciclo di consolidamento:

1. baseline debug
2. smoke test
3. hardening storage/fetch/errori
4. semplificazione UX di `Today`
5. redesign `Stats`

Se seguiamo quest'ordine, ogni miglioria successiva costera meno e rendera l'app piu credibile, piu stabile e piu piacevole da usare.

## Checkpoint attuale - 20 marzo 2026

### Stato generale

Rispetto alla valutazione iniziale, l'app e uscita dalla fase "prodotto promettente ma fragile".

Oggi il quadro e questo:

- la base tecnica e piu credibile
- i flussi principali sono coperti da smoke test reali
- `Today` e `Stats` sono state migliorate davvero lato mobile UX
- barcode e search cibi hanno finalmente un piano tecnico e una prima implementazione concreta

Il progetto resta artigianale e ancora denso in alcune aree, ma non e piu appeso quasi solo alla verifica manuale.

### Stato del piano

#### Step 0 - Baseline debug e regressione

Stato: **completato**

Fatto:

- debug mode attivabile per storage e fetch
- logging minimo su persistenza, import/export e chiamate esterne
- checklist operativa in [step-0-baseline-checklist.md](/Users/federicomarci/Desktop/MarciFit/step-0-baseline-checklist.md)
- smoke test reali eseguiti:
  - `smoke:core`
  - `smoke:dataflow`
  - `smoke:storage`

Valutazione:

questo e stato il cambio di fase piu importante, perche ha abbassato il rischio di regressioni invisibili.

#### Step 1 - Hardening tecnico minimo

Stato: **sostanzialmente completato**

Fatto:

- gestione piu esplicita di localStorage corrotto
- validazione import JSON
- messaggi utente piu chiari sui casi di errore dati
- hardening dei fetch esterni
- lock scroll corretto sui modal
- interazioni locali piu fluide in `Today` senza refresh pesanti della view

Valutazione:

non e ancora "enterprise-grade", ma come base per iterare bene oggi e piu che sufficiente.

#### Step 2 - Snellimento architettura

Stato: **molto avanzato**

Gia estratto:

- [debugTools.js](/Users/federicomarci/Desktop/MarciFit/debugTools.js)
- [barcodeTools.js](/Users/federicomarci/Desktop/MarciFit/barcodeTools.js)
- [bootstrapTools.js](/Users/federicomarci/Desktop/MarciFit/bootstrapTools.js)

Migliorie strutturali aggiuntive:

- logica barcode separata dal resto dell'app
- bootstrap e recovery stato piu leggibili
- responsabilita di debug/storage piu chiare

Ancora da fare:

- ridurre ulteriormente la densita di `app.js`
- alleggerire alcuni blocchi UI ancora molto concentrati
- iniziare a ridurre in modo sistematico gli `onclick` inline

Valutazione:

il refactor non e concluso, ma non siamo piu in una codebase bloccata.

#### Step 3 - UX pass principale

Stato: **molto avanzato**

Fatto su `Today`:

- support panel meno dominante
- acqua + integratori piu compatti
- note piu quiet e meno invasive
- `Focus del momento` rafforzato come CTA primaria
- alert ridisegnati e resi piu chiari
- card `avvisi da leggere` dentro dashboard
- `Salti rapidi` rimossi
- interazioni su alert e add-food rese piu fluide
- ritorno automatico al meal card corretto dopo inserimento cibo

Valutazione:

`Today` oggi e una tab molto piu leggibile, molto piu mobile-first e piu coerente con l'uso quotidiano.

#### Step 4 - Stats redesign

Stato: **molto avanzato**

Fatto:

- gerarchia piu chiara nella lettura del periodo
- forte riduzione della verticalita su mobile
- uso molto migliore dello spazio orizzontale nelle card interne
- `Misure`, `Aderenza`, `Pattern utili`, `Azioni rapide` e `Andamento peso` compattate
- migliore distinzione tra insight principali e azioni secondarie

Valutazione:

`Stats` non e piu una raccolta di moduli impilati, ma una dashboard mobile-first molto piu matura.

#### Step 5 - Accessibility e polish

Stato: **parzialmente avviato, ma ancora aperto**

Gia migliorato:

- diversi flussi mobile-first e modal hanno comportamento piu corretto
- alcuni stati visivi e transizioni sono piu puliti e coerenti

Ancora debole:

- audit tastiera reale
- audit screen reader
- semantica e focus management sistematici
- riduzione seria degli handler inline

Valutazione:

resta il fronte piu scoperto dell'app, insieme alla rifinitura finale del barcode camera.

### Nuove aree strategiche aperte

#### Barcode

Stato: **step 1 completato, step 2 ancora aperto**

Fatto:

- lookup piu robusto
- distinzione tra `timeout`, `offline`, `provider_error`, `not found`
- fallback UX immediati
- retry breve e messaggistica piu corretta

Restante principale:

- ROI reale
- scan multi-pass
- stabilizzazione migliore della lettura camera

Documento di riferimento:

- [barcode-improvement-plan.md](/Users/federicomarci/Desktop/MarciFit/barcode-improvement-plan.md)

#### Search cibi

Stato: **fortemente avanzata**

Fatto:

- cache query realmente usata
- abort per contesto
- gestione piu pulita degli esiti OFF
- query rewriting
- sinonimi minimi
- ranking v2 con confidence
- apprendimento locale dalle scelte utente

Restante principale:

- taratura reale dei pesi sulle query quotidiane dell'utente
- ulteriore affinamento dell'intent parsing nei casi piu ambigui

Documento di riferimento:

- [food-search-improvement-plan.md](/Users/federicomarci/Desktop/MarciFit/food-search-improvement-plan.md)

### Priorita raccomandate da qui

Ordine consigliato adesso:

1. completare bene il barcode lato detection camera
2. fare tuning reale della search cibi con una shortlist di query quotidiane
3. aprire il primo ciclo serio di accessibilita
4. continuare il refactor delle zone ancora troppo dense
5. solo dopo, valutare nuove feature piu ampie

### Giudizio aggiornato

All'inizio il prodotto aveva gia identita e valore, ma dipendeva ancora troppo da:

- verifica manuale
- file molto concentrati
- flussi esterni fragili

Ora il quadro e questo:

- **debug/affidabilita: da fragile a buono**
- **UI: da buona ma disomogenea a molto piu coerente**
- **UX: da ricca ma affollata a chiaramente piu leggibile e mobile-first**
- **motori fragili (barcode/search): da punti deboli opachi a aree tecnicamente governate**

In sintesi:

la direzione del piano scritto in questo documento era corretta, e oggi possiamo dire che le priorita principali sono state rispettate quasi nell'ordine giusto.
