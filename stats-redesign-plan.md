# Stats Tab Redesign

## Obiettivo

Ripensare la tab `Stats` come dashboard di lettura e decisione, non come raccolta di input sparsi.

La schermata deve aiutare l'utente a capire:

1. se il percorso sta andando nella direzione giusta
2. cosa e cambiato nel periodo recente
3. quali azioni concrete hanno piu impatto adesso

## Problema attuale

La tab corrente:

- mette sullo stesso piano insight, form e log grezzi
- apre con metriche troppo deboli (`streak`, `aderenza`) per raccontare davvero l'andamento
- porta l'utente verso l'inserimento dati prima della lettura
- mostra peso, misure e aderenza senza una gerarchia narrativa
- usa sezioni utili singolarmente ma non orchestrate in una dashboard chiara

## Principi di redesign

- Prima capire, poi agire
- Poche sezioni forti, ciascuna con una domanda precisa
- Un solo filtro temporale che governa tutta la tab
- Insight testuali in linguaggio umano, non solo numeri
- Stato vuoto utile e incoraggiante
- Separazione netta tra:
  - andamento fisico
  - comportamento / aderenza
  - azioni rapide

## Nuova architettura della tab

Ordine dall'alto verso il basso:

1. Header + filtro periodo
2. Hero insight
3. Trend peso
4. Misure e composizione
5. Aderenza e costanza
6. Pattern automatici
7. Azioni rapide

## 1. Header + filtro periodo

### Contenuto

- Titolo: `Statistiche`
- Sottotitolo dinamico:
  - `Ultimi 30 giorni`
  - `Ultime 8 settimane`
  - `Panoramica completa`
- Filtro periodo a chip:
  - `7G`
  - `30G`
  - `8 SETT`
  - `TOTALE`

### Scopo

Allineare tutta la pagina a un contesto temporale unico. Oggi ogni blocco usa implicitamente finestre diverse o nessuna finestra chiara.

### Dati necessari

- nuovo stato: `S.statsRange`
- range supportati:
  - `7d`
  - `30d`
  - `8w`
  - `all`

## 2. Hero insight

### Domanda a cui risponde

`Come sta andando, in sintesi?`

### Layout

- card hero orizzontale o verticale forte
- headline singola
- testo di supporto
- 3 KPI primari

### KPI primari

1. `Trend peso`
   - esempio: `-0.8 kg`
   - label: `nel periodo`

2. `Aderenza reale`
   - esempio: `76%`
   - label: `giorni con attivita`

3. `Costanza`
   - esempio: `5/7`
   - label: `media giorni attivi`

### Insight headline

Esempi:

- `Trend stabile e aderenza solida`
- `Buona costanza, ma dati peso ancora scarsi`
- `Aderenza in calo rispetto al periodo precedente`
- `Peso in salita coerente con la fase di bulk`

### Regole di composizione insight

- usare fase obiettivo (`bulk`, `cut`, `mantieni`)
- incrociare:
  - delta peso
  - numero pesate nel range
  - aderenza
  - confronto col range precedente se disponibile

### Dati derivati richiesti

- `weightDelta`
- `weighInCount`
- `adherenceRate`
- `activeDays`
- `periodVsPreviousDelta`

## 3. Trend peso

### Domanda a cui risponde

`Il peso si sta muovendo come previsto?`

### Layout

- card sezione principale
- header con:
  - titolo `Andamento peso`
  - stat inline `X pesate nel periodo`
- grafico
- strip di metriche sotto al grafico
- breve lettura testuale

### Grafico

Mostrare:

- linea peso reale
- media mobile leggera se ci sono almeno 4 pesate
- linea target se `goal.targetWeight` esiste
- niente proiezione aggressiva di default

### Metriche sotto al grafico

- `Attuale`
- `Variazione`
- `Media periodo`
- `Target` oppure `Distanza target`

### Lettura testuale

Esempi:

- `Peso in lieve calo ma ancora dentro una fluttuazione normale`
- `Trend in crescita coerente con il bulk`
- `Non ci sono abbastanza pesate per leggere un trend affidabile`

### Decisioni UX

- il log grezzo delle pesate non deve stare aperto in pagina come oggi
- se serve, renderlo comprimibile: `Mostra cronologia`
- il form di inserimento peso va spostato in `Azioni rapide`

### Dati derivati richiesti

- `getWeightEntriesForRange(range)`
- `getWeightDeltaForRange(range)`
- `getWeightAverageForRange(range)`
- `getWeightRollingAverage(entries, window = 3)`
- `getWeightTrendSummary(range)`

## 4. Misure e composizione

### Domanda a cui risponde

`Sta cambiando solo il peso o anche la composizione?`

### Layout

- sezione con grid di 4-6 mini card
- ogni card per una misura:
  - `Vita`
  - `Fianchi`
  - `Petto`
  - `Braccio`
  - `Coscia`
  - opzionale `Peso` solo se serve confronto allineato

### Card singola

Ogni card mostra:

- valore piu recente nel periodo
- delta rispetto all'inizio del periodo
- micro-etichetta interpretativa

Esempi:

- `-1.5 cm` `Vita` `segnale positivo in cut`
- `+0.4 cm` `Braccio` `crescita moderata`

### Insight di sezione

Frase breve che interpreta il quadro nel contesto della fase:

- in `cut`: peso giu + vita giu = bene
- in `bulk`: peso su + vita quasi stabile = bene
- in `bulk`: peso su + vita su troppo = da monitorare

### Decisioni UX

- abbandonare il solo confronto `prima vs ultima` assoluto
- privilegiare confronto nel range selezionato
- se dati insufficienti: mostrare card educate con `Manca una seconda rilevazione`

### Dati derivati richiesti

- `getMeasurementsForRange(range)`
- `getMeasurementDelta(key, range)`
- `getBodyCompInsight(range, phase)`

## 5. Aderenza e costanza

### Domanda a cui risponde

`Quanto e stato solido il comportamento?`

### Layout

- heatmap compatta e ben etichettata
- 3 metriche principali
- breakdown secondario

### Metriche principali

- `Giorni completi`
- `Giorni parziali`
- `Giorni senza attivita`

### Breakdown secondario

- `Pasti`
- `Acqua`
- `Integratori`

### Heatmap

Tenere l'idea attuale, ma migliorare:

- legenda piu sintetica
- tooltip piu chiari
- focus sul range selezionato
- se `all`, mostrare gli ultimi 12-16 settimane

### Decisioni UX

- l'attuale sezione `Distribuzione ON / OFF` non e abbastanza forte per stare da sola
- puo essere assorbita come metrica secondaria dentro questa sezione
- se mantenuta, deve rispondere a una domanda precisa:
  - `stai vivendo il piano come programmato?`

### Dati derivati richiesti

- `getCompletionEntriesForRange(range)`
- `getAdherenceStats(range)`
- `getHydrationStats(range)`
- `getSupplementStats(range)`
- `getOnOffBalance(range)`

## 6. Pattern automatici

### Domanda a cui risponde

`Cosa emerge dai dati che non si vede subito?`

### Layout

- lista di 2-4 insight cards brevi

### Esempi di pattern

- `Le giornate OFF sono piu consistenti delle ON`
- `Nel weekend l'aderenza cala`
- `Registri spesso i pasti ma raramente il peso`
- `L'acqua e il comportamento meno costante`
- `Le ultime 2 settimane sono migliori delle 2 precedenti`

### Regole

- mostrare solo pattern supportati da abbastanza dati
- niente frasi generiche o motivazionali
- se non c'e abbastanza base dati, mostrare una sola card:
  - `Man mano che registri peso e misure, qui appariranno pattern utili`

### Dati derivati richiesti

- `getStatsPatterns(range)`

## 7. Azioni rapide

### Domanda a cui risponde

`Cosa posso fare adesso?`

### Layout

- sezione finale
- 2 blocchi:
  - `Registra peso`
  - `Registra misurazioni`
- opzionale:
  - `Apri check-in`
  - `Mostra cronologia pesate`

### Decisione chiave

Gli input restano nella tab, ma non aprono la pagina.

## Stati vuoti

### Nessun dato quasi totale

Mostrare:

- headline: `Qui vedrai come evolve il tuo percorso`
- testo: `Inizia registrando peso, misure o attivita giornaliere per costruire una lettura utile nel tempo.`
- CTA:
  - `Registra il primo peso`
  - `Apri Oggi`

### Solo attivita ma niente peso

- mostrare hero + aderenza
- sezione peso in stato vuoto guidato

### Peso presente ma misure assenti

- mostrare trend peso normalmente
- sezione misure con invito a registrare almeno due rilevazioni

## Tono dei testi

- semplice
- concreto
- mai giudicante
- orientato alla lettura del dato

Preferire:

- `dati ancora scarsi`
- `trend da confermare`
- `segnale positivo`
- `da monitorare`

Evitare:

- `male`
- `scarso rendimento`
- `fallimento`

## Mappa implementativa nel codice attuale

### File coinvolti

- `/Users/federicomarci/Desktop/MarciFit/index.html`
- `/Users/federicomarci/Desktop/MarciFit/uiComponents.js`
- `/Users/federicomarci/Desktop/MarciFit/style.css`
- `/Users/federicomarci/Desktop/MarciFit/app.js`
- opzionale `/Users/federicomarci/Desktop/MarciFit/storage.js`

### `index.html`

Sostituire la struttura della view `stats` con nuovi mount point:

- `stats-toolbar`
- `stats-hero`
- `stats-weight`
- `stats-measurements`
- `stats-adherence`
- `stats-patterns`
- `stats-actions`

### `app.js`

Aggiungere:

- `statsRange: '30d'` nello state
- helper di range temporale
- funzioni di aggregazione dati
- eventuale handler `setStatsRange(range)`

### `storage.js`

Includere `statsRange` tra le chiavi persistite

### `uiComponents.js`

Smontare l'attuale `renderStats()` in renderer piu piccoli:

- `renderStatsToolbar()`
- `renderStatsHero(rangeData)`
- `renderStatsWeight(rangeData)`
- `renderStatsMeasurements(rangeData)`
- `renderStatsAdherence(rangeData)`
- `renderStatsPatterns(rangeData)`
- `renderStatsActions()`

e mantenere `renderStats()` come orchestratore.

### `style.css`

Creare un linguaggio visivo dedicato alla dashboard stats:

- hero card
- toolbar chips
- metric cards
- insight cards
- sezione principale grafico
- action cards finali

## Range data: struttura consigliata

Preparare un unico oggetto derivato per evitare calcoli sparsi nei renderer.

Esempio:

```js
{
  range: '30d',
  label: 'Ultimi 30 giorni',
  from: '2026-02-19',
  to: '2026-03-20',
  weight: {
    entries: [],
    count: 0,
    current: null,
    start: null,
    delta: null,
    average: null,
    rolling: [],
    target: null,
    targetDiff: null,
    insight: ''
  },
  measurements: {
    latest: {},
    deltas: {},
    count: 0,
    insight: ''
  },
  adherence: {
    totalDays: 0,
    activeDays: 0,
    fullDays: 0,
    partialDays: 0,
    emptyDays: 0,
    adherenceRate: 0,
    hydrationRate: 0,
    supplementRate: 0,
    onDays: 0,
    offDays: 0
  },
  patterns: []
}
```

## Priorita di implementazione

### Fase 1

- introdurre `statsRange`
- creare aggregatore `getStatsRangeData(range)`
- rifare struttura HTML della tab

### Fase 2

- costruire hero + trend peso
- spostare input peso in fondo

### Fase 3

- costruire sezione misure
- sostituire `prima vs ultima` con confronto sul range

### Fase 4

- rifare aderenza
- inglobare o rimuovere `ON/OFF ratio`

### Fase 5

- aggiungere pattern automatici
- rifinitura visual e microcopy

## Decisioni consigliate da prendere ora

- mantenere la heatmap: si
- tenere ON/OFF ratio come sezione autonoma: no
- mostrare il log pesate completo aperto: no
- lasciare i form in alto: no
- introdurre filtro periodo unico: si
- usare insight testuali: si

## Criteri di successo

La nuova tab funziona se:

- in 5 secondi si capisce il punto della situazione
- in 15 secondi si capisce dove intervenire
- con pochi dati la schermata resta utile
- la tab sembra una dashboard, non un modulo
- ogni sezione risponde a una sola domanda chiara
