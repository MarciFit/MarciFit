# MarciFit - Step 0 Baseline Checklist

## Scopo

Creare una baseline operativa per:

- verificare velocemente che l'app non si sia rotta
- identificare i flussi piu fragili
- avere un criterio comune prima di fare refactor o nuove feature

Questo documento e pensato come checklist di lavoro, non come analisi teorica.

## Stato della baseline oggi

### Verificato in questo passaggio

- struttura del progetto e file chiave mappati
- presenza di guardrail di bootstrap (`window.onerror`, `diagnostic.html`)
- assenza di suite test reale in [package.json](/Users/federicomarci/Desktop/MarciFit/package.json)
- presenza di script preview Playwright in [scripts/preview-today.mjs](/Users/federicomarci/Desktop/MarciFit/scripts/preview-today.mjs) e [scripts/preview-stats.mjs](/Users/federicomarci/Desktop/MarciFit/scripts/preview-stats.mjs)
- principali aree funzionali localizzate (`Today`, `Piano`, `Stats`, `Profilo`, barcode, storage, import/export)

### Limite noto del passaggio

- le preview Playwright non sono eseguibili nel sandbox corrente per blocco permessi macOS sul browser headless

Impatto:

- la baseline attuale e forte lato codice e flussi
- la validazione visuale automatica va completata appena abbiamo permesso di eseguire il browser fuori sandbox

## Debug mode disponibile

E ora disponibile una modalita debug minima per vedere in console:

- operazioni di `localStorage`
- import/export JSON
- fetch OpenFoodFacts e barcode

Attivazione:

- aprire l'app con `?debug=1`
- oppure lanciare in console `enableMarciFitDebug()`

Disattivazione:

- aprire l'app con `?debug=0`
- oppure lanciare in console `disableMarciFitDebug()`

## Smoke test minimo consigliato

Questa e la checklist minima da eseguire dopo ogni modifica significativa.

## 1. Bootstrap app

Obiettivo:

verificare che l'app si apra senza errori JS bloccanti

Passi:

1. aprire `index.html`
2. controllare che la navbar e le 4 tab siano visibili
3. verificare che non compaia l'overlay `_err`
4. aprire anche `diagnostic.html`
5. confermare che `storage.js`, `nutritionLogic.js`, `uiComponents.js`, `app.js` risultino caricati
6. confermare che `initAll()` completi senza throw

Esito atteso:

- nessun errore bloccante al bootstrap

## 2. Navigazione principale

Obiettivo:

verificare che la navigazione fra viste richiami i render corretti

Passi:

1. cliccare `Oggi`
2. cliccare `Piano`
3. cliccare `Stats`
4. cliccare `Profilo`
5. tornare su `Oggi`

Esito atteso:

- ogni view si apre correttamente
- nessuna schermata bianca
- nessun contenuto palesemente non renderizzato

## 3. Tracking rapido in Oggi

Obiettivo:

validare il flusso piu frequente dell'app

Passi:

1. aprire un pasto in `Oggi`
2. aggiungere un alimento
3. modificare la grammatura
4. rimuovere un alimento
5. aumentare e diminuire acqua
6. segnare e deselezionare un integratore
7. scrivere una nota breve

Esito atteso:

- macro, progressione giornata e card correlate si aggiornano
- nessuna perdita di sincronizzazione visibile
- i dati restano dopo refresh

## 4. Piano pasti

Obiettivo:

verificare editing e coerenza del piano

Passi:

1. aprire `Piano`
2. modificare nome o orario di un pasto
3. cambiare o aggiungere ingredienti
4. aprire helper meal planner
5. creare un template semplice
6. ricaricare il template su un pasto

Esito atteso:

- il piano si aggiorna senza rompere `Oggi`
- le macro di riepilogo restano coerenti

## 5. Stats

Obiettivo:

verificare che la dashboard dati sia stabile

Passi:

1. aprire `Stats`
2. cambiare range temporale
3. aggiungere un peso
4. aprire inserimento misure e salvare almeno un dato
5. ricontrollare hero, grafico, metriche e heatmap

Esito atteso:

- nessun errore di rendering
- i nuovi dati entrano nel riepilogo corretto

## 6. Profilo

Obiettivo:

verificare i dati strutturali e il ricalcolo fabbisogno

Passi:

1. aprire `Profilo`
2. modificare dati anagrafici
3. cambiare fase obiettivo
4. salvare il profilo
5. verificare aggiornamento macro `ON/OFF`

Esito atteso:

- nessun valore incoerente
- i target giornalieri si aggiornano

## 7. Storage e persistenza

Obiettivo:

verificare che i dati non si corrompano nei casi normali

Passi:

1. fare alcune modifiche su `Oggi`, `Piano`, `Stats`, `Profilo`
2. ricaricare la pagina
3. verificare che lo stato torni correttamente
4. esportare JSON
5. reimportare JSON

Esito atteso:

- persistenza coerente
- nessun reset inatteso

## 8. Barcode e ricerca cibi

Obiettivo:

verificare il flusso esterno piu fragile

Passi:

1. aprire scanner barcode
2. verificare apertura modal e stato fotocamera
3. simulare o usare ricerca testuale se barcode non disponibile
4. selezionare un alimento
5. aggiungerlo al log o ai preferiti

Esito atteso:

- il fallback di ricerca funziona
- gli errori rete o permessi non bloccano l'app

## Rischi principali emersi

## R1 - Errori silenziosi di storage

Area:

- [storage.js](/Users/federicomarci/Desktop/MarciFit/storage.js)

Segnale:

- `save()` e parti di `loadSaved()` assorbono errori senza log

Rischio:

- dati non salvati o ripristinati senza evidenza chiara

Priorita:

- alta

## R2 - Regressioni da file monolitici

Aree:

- [app.js](/Users/federicomarci/Desktop/MarciFit/app.js)
- [uiComponents.js](/Users/federicomarci/Desktop/MarciFit/uiComponents.js)
- [style.css](/Users/federicomarci/Desktop/MarciFit/style.css)

Segnale:

- molto codice concentrato, rendering ed eventi mescolati

Rischio:

- una modifica locale rompe flussi lontani

Priorita:

- alta

## R3 - Fragilita dei flussi esterni

Aree:

- fetch OpenFoodFacts
- fotocamera barcode
- preview browser automation

Segnale:

- dipendenze da rete, permessi browser, API native

Rischio:

- UX bloccata o parziale in scenari reali

Priorita:

- alta

## R4 - Accessibilita non garantita

Aree:

- markup con molti `onclick`
- modali
- componenti generati con `innerHTML`

Rischio:

- navigazione tastiera fragile
- semantica incompleta

Priorita:

- media alta

## R5 - Sovraccarico cognitivo in Today e Stats

Aree:

- `Today`
- `Stats`

Rischio:

- l'utente non capisce subito l'azione principale

Priorita:

- media alta

## Bug/controlli da aprire subito

Questi non sono bug confermati al 100%, ma check mirati da eseguire nel prossimo passaggio.

- verificare se errori `localStorage` vengono persi del tutto in condizioni degradate
- verificare se `weightLog` e `measurements` possono duplicare il peso nello stesso giorno
- verificare se il cambio di fase in `Profilo` aggiorna sempre in modo coerente tutte le view aperte
- verificare gli edge case del barcode quando la camera viene negata o interrotta
- verificare che note, acqua e integratori non lascino `doneByDate` in stato incoerente

## Deliverable del prossimo step

Per chiudere davvero `Step 0`, i prossimi output utili sono:

1. una checklist manuale ancora piu compatta da 2 minuti
2. 5-8 smoke test automatici
3. un piccolo logger debug attivabile
4. una sessione di review visuale reale desktop + mobile

## Smoke test automatico disponibile

E ora presente un primo smoke test core in [scripts/smoke-core.mjs](/Users/federicomarci/Desktop/MarciFit/scripts/smoke-core.mjs).

Cosa verifica:

- bootstrap dell'app
- passaggio fra `Today`, `Piano`, `Stats`, `Profilo`
- persistenza minima di nota + acqua dopo reload

Comando:

- `npm test`
- oppure `npm run smoke:core`

Nota:

- nel sandbox corrente il browser Playwright resta bloccato dai permessi macOS, quindi il test e pronto ma va eseguito in un ambiente con browser headless consentito

E ora presente anche un secondo smoke test dataflow in [scripts/smoke-dataflow.mjs](/Users/federicomarci/Desktop/MarciFit/scripts/smoke-dataflow.mjs).

Cosa verifica:

- `Stats`: aggiunta peso e misurazioni
- `Piano`: rendering summary + libreria template
- `Profilo`: export/import JSON

Comando:

- `npm run smoke:dataflow`

E ora presente anche un terzo smoke test storage edge in [scripts/smoke-storage-edges.mjs](/Users/federicomarci/Desktop/MarciFit/scripts/smoke-storage-edges.mjs).

Cosa verifica:

- localStorage corrotto al bootstrap
- import JSON con struttura invalida

Comando:

- `npm run smoke:storage`

## Raccomandazione operativa

Il prossimo lavoro che conviene fare subito e:

1. aggiungere un logger debug minimo su storage e fetch
2. creare la checklist breve "prima di chiudere una modifica"
3. preparare i primi smoke test automatici su bootstrap, tab principali e persistenza

Con questa base, ogni intervento successivo su UI, UX o refactor costera meno e sara molto piu sicuro.
