# Piano Migliorie Ricerca Cibi

## Obiettivo

Rendere la ricerca cibi piu affidabile, piu pertinente e piu veloce in tre aree:

1. qualita dei risultati
2. stabilita del flusso di ricerca
3. esperienza utente quando i dati esterni non aiutano

L'obiettivo non e solo "trovare piu risultati", ma ottenere:

- risultati giusti piu in alto
- meno risultati rumorosi
- meno dipendenza percepita da Open Food Facts
- fallback migliori quando la ricerca esterna fallisce

## Stato Attuale

La ricerca attuale vive soprattutto in [nutritionLogic.js](/Users/federicomarci/Desktop/MarciFit/nutritionLogic.js).

Pipeline attuale:

1. normalizzazione query
2. match locale su `customFoods` + `FOOD_DB`
3. aggiunta dei recenti da `foodLog`
4. fetch Open Food Facts in background
5. merge + ranking + dedupe
6. render dropdown

Questa base e gia buona, ma ha limiti concreti.

## Criticita Reali Emersi Dal Codice

### 1. Cache query scritta ma non realmente sfruttata

In [nutritionLogic.js](/Users/federicomarci/Desktop/MarciFit/nutritionLogic.js) i risultati OFF vengono salvati in `S.foodCache`, ma la ricerca non parte davvero da quella cache nelle query successive.

Conseguenze:

- spreco di fetch ripetuti
- risultati esterni non abbastanza reattivi
- poco vantaggio cumulativo dall'uso dell'app

### 2. Abort globale tra contesti diversi

L'`AbortController` attuale e globale (`_offAbort`), quindi una ricerca in un contesto puo cancellarne un'altra in un altro contesto.

Conseguenze:

- instabilita percepita
- risultati che spariscono o non arrivano
- comportamento potenzialmente incoerente tra:
  - log pasto
  - piano
  - template
  - preferiti

### 3. Matching troppo permissivo in alcuni casi

`hasQueryMatch(...)` accetta match anche solo su un token presente in nome o brand.

Conseguenze:

- risultati poco pertinenti quando la query e composta
- prodotti con brand giusto ma nome sbagliato che possono restare troppo alti
- rumore specialmente su query generiche o ibride tipo:
  - `riso prix`
  - `pollo lidl`
  - `yogurt greco proteico`

### 4. Ranking buono ma ancora poco “intent-aware”

Lo scoring attuale e ricco, ma non classifica davvero il tipo di query.

Manca una distinzione forte tra:

- ingrediente semplice
- prodotto branded
- piatto composto
- variante descrittiva
- query con formato/attributi (`integrale`, `basmati`, `0%`, `proteico`)

Conseguenze:

- ranking corretto in media, ma non abbastanza “intelligente” nei casi ambigui

### 5. Dipendenza eccessiva da un solo provider esterno

La ricerca esterna usa solo Open Food Facts.

Conseguenze:

- se OFF e lento, la search sembra “debole”
- se OFF non ha il prodotto, il sistema perde molto valore
- i messaggi attuali separano poco i vari fallimenti

### 6. Query rewriting ancora troppo semplice

Oggi il retry OFF accorcia solo la query togliendo l'ultima parola.

Questo e utile, ma insufficiente.

Mancano strategie come:

- rimozione brand opzionale
- rimozione attributi deboli
- sinonimi
- singular/plural tolerance
- normalizzazione smart di varianti comuni

### 7. UI dropdown ancora poco esplicativa sul “perche” di un risultato

La UI mostra bene i risultati, ma non aiuta abbastanza a distinguere:

- match locale forte
- recente
- esterno
- brand-based match
- fallback manuale consigliato

## Principio Di Progetto

La ricerca cibi va trattata come un motore a livelli:

1. intent parsing
2. retrieval multi-sorgente
3. ranking contestuale
4. fallback progressivo
5. apprendimento locale

Non basta migliorare il ranking finale se le sorgenti e la query non vengono preparate bene.

## Architettura Proposta

## Fase A — Query Understanding

### Step A1. Classificazione intent query

Per ogni input, classificare la query in uno di questi tipi:

- `whole_food`
- `branded_product`
- `dish_like`
- `attribute_first`
- `generic_short`

Esempi:

- `banana` -> `whole_food`
- `riso basmati prix` -> `branded_product`
- `yogurt greco proteico` -> `attribute_first`
- `pasta tonno` -> `dish_like`

Questo permette di cambiare retrieval e ranking in modo piu intelligente.

### Step A2. Query rewriting strutturato

Generare varianti della query, non solo una query accorciata.

Ordine consigliato:

1. query originale
2. query senza brand
3. query senza attributi deboli
4. query compatta “core food”
5. query per brand only se serve

Esempio:

`riso basmati prix`

diventa:

- `riso basmati prix`
- `riso basmati`
- `basmati`
- `prix riso`

Non tutte da usare sempre: dipende dal tipo di query.

### Step A3. Dizionario sinonimi e alias

Serve una mappa leggera e locale per equivalenze comuni:

- `greco` <-> `greek`
- `tonno al naturale` <-> `tonno`
- `fiocchi di latte` <-> `cottage cheese`
- `avena` <-> `oats`
- `petto di pollo` <-> `pollo`

Non deve essere enorme: basta coprire i casi reali piu frequenti.

## Fase B — Retrieval Multi-Sorgente

### Step B1. Riordinare le sorgenti con priorita vera

Ordine suggerito:

1. cache query locale
2. custom foods
3. recenti effettivi
4. preferiti rilevanti
5. database locale `FOOD_DB`
6. Open Food Facts

Nota importante:

Oggi i preferiti aiutano il planner, ma non sono integrati davvero come sorgente primaria nella ricerca standard. Vale la pena usarli anche qui.

### Step B2. Cache locale realmente attiva

La cache va usata non solo in scrittura ma in retrieval.

Da fare:

- leggere `S.foodCache[queryKey]` prima del fetch
- usare TTL o freshness soft
- mostrare subito risultati cache mentre il refresh esterno avviene in background

Effetto:

- ricerca piu veloce
- meno dipendenza percepita dalla rete
- esperienza progressiva molto piu forte

### Step B3. Abort per contesto, non globale

Ogni area di ricerca deve avere il suo controller:

- `meal-log`
- `piano`
- `template`
- `favorite-foods`

Questo evita interferenze tra input diversi.

## Fase C — Ranking Più Intelligente

### Step C1. Separare nome vs brand nel ranking

Il brand e utile, ma non deve salvare un match debole sul nome.

Regola:

- match forte sul nome domina sempre
- brand aggiunge valore solo se il nome ha almeno una copertura minima

### Step C2. Bonus per attributi nutrizionali rilevanti

Serve premiare match come:

- `0%`
- `proteico`
- `integrale`
- `basmati`
- `senza zuccheri`

Questi token non vanno trattati come parole qualsiasi.

### Step C3. Penalizzazione rumore di catalogo

OFF contiene spesso nomi lunghi, rumorosi o promozionali.

Serve penalizzare:

- nomi troppo verbosi
- prodotti con troppe parole irrilevanti
- brand-only matches
- prodotti con nutrizionali sospetti o incompleti

### Step C4. Ranking context-aware

Il contesto dovrebbe influenzare i risultati.

Esempi:

- nel log pasto, favorire cibi gia usati da quell'utente
- nei preferiti, favorire prodotti stabili e branded
- nel piano, favorire ingredienti composabili

## Fase D — UX della Ricerca

## Obiettivo UX

L'utente deve capire:

- cosa sto vedendo
- quanto il sistema e sicuro
- cosa fare se non trova il prodotto giusto

### Step D1. Stati piu chiari

Stati consigliati:

- `Cerco nei tuoi cibi e nei recenti...`
- `Sto ampliando la ricerca su Open Food Facts...`
- `Ho trovato risultati locali`
- `OFF non disponibile, continuo con risultati locali`
- `Nessun match convincente, prova ricerca piu semplice`

### Step D2. Evidenza della fonte

Le fonti vanno rese piu leggibili:

- `Personale`
- `Recente`
- `Preferito`
- `Open Food Facts`
- `Cache`

### Step D3. Empty state guidato

Se non troviamo nulla di buono:

- suggerire query semplificata
- mostrare CTA manuale piu forte
- proporre barcode se ha senso

### Step D4. Progressive reveal migliore

Se abbiamo gia buoni risultati locali:

- mostrarli subito
- non dare l'impressione di “ricerca incompleta” se OFF e lento
- trattare OFF come arricchimento, non come dipendenza principale

## Fase E — Provider Esterno e Robustezza

### Step E1. Distinguere esiti OFF

Come per il barcode, servono stati espliciti:

- `ok`
- `timeout`
- `offline`
- `provider_error`
- `no_results`

### Step E2. Retry esterno più intelligente

Per OFF:

1. query originale
2. query rewritten
3. retry breve solo se il provider e lento

### Step E3. Uso migliore dei risultati OFF

Non tutti i risultati OFF vanno trattati allo stesso modo.

Serve una classificazione minima:

- high confidence
- medium confidence
- low confidence

Possibile uso:

- high confidence subito visibili
- medium dopo i locali
- low confidence sotto “altri risultati”

## Roadmap Consigliata

## Step 0 — Strumentazione

Aggiungere metriche minime:

- tempo primo risultato locale
- tempo arrivo OFF
- query con zero risultati
- query con scelta manuale
- query con click sul primo risultato
- query riscritta che ha avuto successo

## Step 1 — Stabilizzazione architetturale

Priorita massima:

- cache realmente letta
- abort controller per contesto
- separazione esiti OFF

Questo migliora subito robustezza e percezione.

## Step 2 — Query rewriting e synonyms

Da fare:

- varianti query
- rimozione brand opzionale
- dizionario sinonimi minimo

Qui recuperiamo molta qualità reale su casi quotidiani.

## Step 3 — Ranking v2

Da fare:

- piu peso a intent e attributi
- meno peso a brand isolato
- confidence buckets

## Step 4 — UX risultati

Da fare:

- etichette fonte piu chiare
- stati di loading/fallback migliori
- empty state guidati

## Step 5 — Apprendimento locale

Da fare:

- boost automatico dei cibi scelti spesso
- cronologia query utile
- cache persistente piu intelligente

## Test Da Prevedere

### Query semplici

- `banana`
- `riso`
- `yogurt`

### Query branded

- `riso basmati prix`
- `yogurt greco fage`
- `tonno rio mare`

### Query descrittive

- `yogurt greco proteico`
- `pane integrale`
- `latte senza lattosio`

### Query ambigue

- `pollo`
- `cracker`
- `cereali`

### Test di robustezza

- due ricerche in parallelo in contesti diversi
- OFF lento
- OFF offline
- risultati locali disponibili ma OFF fallisce

## Metriche Target

- primo risultato locale in meno di 150 ms percepiti
- riduzione netta delle query senza esito utile
- meno fallimenti percepiti dovuti a OFF
- miglioramento del click sul primo o secondo risultato
- riduzione del ricorso al manuale per query comuni

## Priorita Consigliata

Ordine migliore:

1. cache reale + abort per contesto + status OFF
2. query rewriting
3. ranking v2 intent-aware
4. UX risultati
5. apprendimento locale

## Conclusione

La ricerca cibi oggi ha gia una buona base, ma soffre di tre limiti strutturali:

- retrieval ancora poco robusto
- ranking non abbastanza guidato dall'intento
- UX che non valorizza bene i risultati locali e i fallback

La direzione giusta e costruire un motore piu tollerante e progressivo:

- parte dai dati migliori che gia abbiamo
- usa OFF come arricchimento, non come stampella unica
- capisce meglio cosa l'utente intende davvero cercare
