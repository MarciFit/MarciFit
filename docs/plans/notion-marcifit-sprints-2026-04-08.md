# MarciFit — Sprint Prompt Backlog

## Sprint 1 — Stabilizzazione account, sync e ingresso app

**Obiettivo**
Rendere affidabile il flusso di accesso tra browser Safari, web app salvata in Home e profilo cloud, evitando reset apparenti, onboarding riaperto e stato vuoto dopo login o import.

**Prompt**
Lavora su MarciFit con focus totale su `authSync.js`, `storage.js`, `app.js`, `debugTools.js` e UI account in `uiComponents.js` / `style.css`. Obiettivo: hardenizzare il bootstrap account e la sincronizzazione tra stato locale e cloud, soprattutto nel passaggio Safari -> web app Home su iPhone. Elimina i punti in cui login riuscito e stato app possono divergere, riduci al minimo i reload completi, migliora la gestione dei conflitti locale/cloud e aggiungi una diagnostica chiara ma leggera nella card account. Voglio che un utente autenticato capisca subito se sta lavorando su dati locali, cloud o guest, e che il primo ingresso nella web app Home non sembri un “nuovo account” se esiste già uno stato valido. Mantieni il design attuale, ma rendi il copy molto più comprensibile. Chiudi il lavoro con verifiche concrete su import, logout/login, onboarding e cache per-account.

**Definition of done**
- Login e signup non riaprono onboarding se esiste già uno stato significativo.
- La web app Home mostra lo stesso profilo dell’account o spiega chiaramente perché non può farlo.
- Import JSON con account attivo finisce nello storage corretto e prova la sync cloud.
- La card account spiega in modo semplice contesto, stato sync e sorgente dei dati.
- Smoke storage/core verdi e pass manuale documentato per Safari/Home.

## Sprint 2 — Backup, import/export e recupero dati

**Obiettivo**
Trasformare backup e ripristino in un flusso affidabile, comprensibile e sicuro anche per utenti non tecnici.

**Prompt**
Lavora sul sistema di backup di MarciFit con focus su `storage.js`, `authSync.js`, `debugTools.js`, `app.js` e card `Profilo > Dati & backup`. Obiettivo: migliorare export, import, naming file, validazione, messaggi di errore e recupero guidato dei dati. Quando un JSON è valido, l’utente deve vedere subito cosa sta per caricare, a quale profilo appartiene e su quale account/dispositivo verrà applicato. Se qualcosa non va, il messaggio deve spiegare se il problema è formato file, conflitto cloud, storage locale o profilo errato. Mantieni il design esistente ma porta il flusso a livello “backup serio”, con più trasparenza e meno ambiguità.

**Definition of done**
- Export con nome file corretto per utente/account.
- Import con conferma chiara del profilo trovato nel JSON.
- Errori distinti tra JSON invalido, sync fallita, cloud non raggiungibile e stato incompatibile.
- Possibilità di capire se il backup è stato applicato solo in locale o anche nel cloud.
- Smoke storage aggiornato sui casi limite più importanti.

## Sprint 3 — Riapertura intelligente della tab Piano

**Obiettivo**
Rendere `Piano` utile già adesso con template forti, mentre helper pasto e cibi abituali restano in teaser credibili finché non saranno pronti davvero.

**Prompt**
Lavora su `Piano` con focus su `uiComponents.js`, `app.js`, `templateEngine.js`, `mealHelperEngine.js`, `mealTaxonomy.js`, `style.css` e `index.html`. L’obiettivo è consolidare la tab come libreria template affidabile e preparare bene la riapertura futura di helper pasto e cibi abituali. Mantieni attivo solo ciò che è davvero pronto, rafforza la UX dei template, rendi i placeholder “In arrivo” compatti e desiderabili, e prepara una struttura tecnica che permetta di riattivare gradualmente le funzionalità oggi sospese senza riscrivere tutto. Se ci sono engine o logiche oggi scollegati ma costosi, valuta come modularizzarli meglio.

**Definition of done**
- Template ancora più facili da salvare, filtrare e riusare.
- Placeholder di helper/cibi abituali chiari, leggeri e coerenti col design.
- Struttura tecnica pronta per riattivazione incrementale.
- Nessuna CTA che prometta feature non ancora affidabili.
- Smoke dataflow/Piano allineato al comportamento reale della tab.

## Sprint 4 — Mobile readability e densità informativa

**Obiettivo**
Continuare il lavoro di leggibilità mobile fino a raggiungere uno standard da app nativa: testo leggibile, gerarchie chiare e interazioni semplici senza perdere l’identità visiva di MarciFit.

**Prompt**
Lavora sulla qualità d’uso mobile di MarciFit con focus su `style.css`, `uiComponents.js`, `index.html` e tutte le card principali di `Oggi`, `Stats`, `Piano` e `Profilo`. Non cambiare il design system di base, ma migliora leggibilità, spacing, font sizing, densità dei contenuti e priorità visive seguendo standard mobile app. Le card devono restare ordinate, più facili da leggere e con tap target comodi. Evita di “gonfiare” la UI: cerca chiarezza e compattezza insieme. Dove serve, alleggerisci i blocchi secondari e fai emergere meglio i dati importanti.

**Definition of done**
- Nessuna card chiave risulta affollata o con testo troppo piccolo su iPhone.
- Le CTA principali emergono subito.
- Titoli, sottotitoli, badge e note hanno gerarchie stabili.
- Le card `Today`, `Stats` e `Profilo` sono leggibili anche in scroll rapido.
- Preview mobile aggiornata e pass visuale coerente su tutte le view.

## Sprint 5 — Meal logging più ricco e più veloce

**Obiettivo**
Rendere il log dei pasti più informativo e più rapido da usare, con contesto nutrizionale chiaro e meno passaggi mentali per l’utente.

**Prompt**
Lavora sull’esperienza di logging cibi in MarciFit con focus su `uiComponents.js`, `nutritionLogic.js`, `barcodeTools.js`, `app.js` e `style.css`. Partendo dal pulsante info `(i)` e dal recap nutrizionale nel gram picker, estendi l’esperienza per rendere il logging più chiaro, veloce e rassicurante. Migliora la lettura dei valori nutrizionali dei singoli alimenti, il feedback quando si modificano i grammi, la coerenza tra log, gram picker e riepilogo macro, e individua piccoli attriti che oggi rallentano l’inserimento. L’obiettivo è avvicinare l’esperienza a una food diary moderna, ma mantenendo il linguaggio visivo MarciFit.

**Definition of done**
- Recap nutrizionali coerenti tra log, picker e modal.
- Modifica grammatura più intuitiva e leggibile.
- Miglior feedback sulle conseguenze nutrizionali dell’aggiunta/modifica.
- Nessuna regressione su barcode, log, extra meals e template load.
- Smoke core ancora verde sui flussi principali.

## Sprint 6 — Stats più utili e meno “dashboard”

**Obiettivo**
Trasformare `Stats` in una sezione di lettura pratica, con insight azionabili e meno sensazione da report statico.

**Prompt**
Lavora sulla tab `Stats` con focus su `uiComponents.js`, `nutritionLogic.js`, `app.js`, `style.css` e gli script preview dedicati. Obiettivo: far diventare la sezione statistiche più utile per decidere cosa fare, non solo per osservare numeri. Migliora il rapporto tra peso, misure, aderenza e pattern; chiarisci meglio le letture; rendi più forti i collegamenti tra insight e azione successiva. Non introdurre complessità visiva inutile: voglio una tab più matura, più leggibile e più coach-like.

**Definition of done**
- Insight e metriche raccontano una storia chiara del periodo.
- Peso, misure e aderenza dialogano meglio tra loro.
- CTA e quick actions restano coerenti e non invasive.
- Layout mobile/desktop pulito e leggibile.
- Preview stats aggiornata e smoke dataflow ancora verde.

## Sprint 7 — Debug, osservabilità e QA prodotto

**Obiettivo**
Fare un pass strutturale di affidabilità, così i bug emergono prima e l’app è più semplice da mantenere mentre crescono feature e utenti test.

**Prompt**
Lavora sull’osservabilità di MarciFit con focus su `debugTools.js`, `storage.js`, `authSync.js`, `app.js`, gli smoke in `scripts/` e i documenti operativi sotto `docs/`. Obiettivo: aumentare visibilità su errori, bootstrap, import/export, sync, rendering critici e regressioni UI. Aggiungi log utili ma non rumorosi, migliora i messaggi di errore per l’utente, e amplia dove serve la copertura smoke per le aree oggi più fragili: account/sync, import, Piano ridotto, Stats actions e flussi Today più delicati. Voglio una base più robusta prima di riaprire funzionalità più ambiziose.

**Definition of done**
- Errori importanti più visibili e classificabili.
- Flussi critici coperti meglio da smoke e check tecnici.
- Diagnostica attivabile senza sporcare l’esperienza utente normale.
- Documentazione di test/manual QA aggiornata.

## Sprint 8 — Studio di fattibilità integrazioni future

**Obiettivo**
Preparare le prossime scelte prodotto su basi tecniche solide, senza implementare troppo presto funzioni che richiedono architetture diverse.

**Prompt**
Prepara uno studio tecnico/prodotto per le integrazioni future di MarciFit con focus su due temi: dati attività da iPhone/Salute e possibili espansioni del piano alimentare come lista della spesa, assistenza meal helper avanzata e riapertura cibi abituali. Non implementare tutto: voglio una proposta concreta che distingua cosa è fattibile in web app pura, cosa richiede wrapper nativo o backend dedicato, e quale sequenza ha più senso per valore prodotto vs costo tecnico. Usa il codice attuale come base reale, non come esercizio teorico.

**Definition of done**
- Roadmap chiara tra “fattibile subito”, “da preparare” e “non realistico in web app pura”.
- Dipendenze tecniche e rischi ben esplicitati.
- Priorità di prodotto coerenti con lo stato reale di MarciFit.
