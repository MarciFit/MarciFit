# Piano Migliorie Barcode

## Obiettivo

Rendere il flusso barcode molto piu affidabile in tre aree distinte:

1. rilevazione del codice dalla camera
2. riconoscimento stabile del numero letto
3. ricerca del prodotto con fallback intelligenti e messaggi corretti

L'obiettivo non e solo "scannerizzare di piu", ma ridurre gli errori percepiti dall'utente e separare bene:

- barcode non letto
- barcode letto ma prodotto non trovato
- servizio esterno lento o non raggiungibile

## Stato Attuale

### Detection camera

Il flusso attuale in [barcodeTools.js](/Users/federicomarci/Desktop/MarciFit/barcodeTools.js) usa:

- `BarcodeDetector` se disponibile
- `Quagga.decodeSingle(...)` come fallback
- conferma con 2 letture consecutive uguali
- stream camera a `1920x1080`

Limiti attuali osservati:

- il riquadro scanner e solo visivo, non guida davvero l'algoritmo
- la lettura avviene su frame intero, senza strategia multi-zona
- non esiste una pipeline di tentativi progressivi
- non esistono zoom dinamico, crop ROI, o preprocess espliciti
- un barcode piccolo o leggermente fuori area viene perso facilmente

### Lookup prodotto

Il lookup attuale usa un solo endpoint:

- Open Food Facts product lookup per barcode

Limiti attuali:

- timeout a 5 secondi
- nessun provider alternativo
- nessun retry breve
- messaggio `Errore di rete` troppo generico
- nessuna distinzione chiara tra:
  - OFF lento
  - OFF irraggiungibile
  - prodotto assente in OFF
  - prodotto presente ma dati nutrizionali insufficienti

## Diagnosi Dei Problemi Segnalati

### 1. "Il barcode deve stare perfettamente nel riquadro"

La sensazione utente e reale. Anche se il frame non e tecnicamente usato come crop, il sistema attuale non aiuta abbastanza quando:

- il codice e piccolo
- l'inquadratura e troppo ampia
- il contrasto e basso
- l'angolo non e ottimale
- il codice non resta fermo per abbastanza frame utili

Quindi oggi manca una strategia robusta di acquisizione.

### 2. "Riso basmati Prix non trovato e messaggio di errore rete"

Questo problema puo nascere da due casi diversi:

1. il barcode viene letto correttamente ma Open Food Facts non risponde entro timeout o fallisce
2. il barcode viene letto correttamente ma il prodotto non e presente o non ha dati sufficienti

Nel flusso attuale questi casi non sono spiegati bene all'utente, quindi il messaggio finale puo risultare fuorviante.

## Principio Di Progetto

Il barcode va trattato come una pipeline a stati, non come una singola chiamata scanner -> fetch.

Pipeline proposta:

1. acquisizione camera
2. detection candidata
3. stabilizzazione del codice letto
4. validazione formato barcode
5. lookup prodotto
6. fallback guidato
7. caching locale

## Algoritmo Proposto

## Fase A — Scan Engine Multi-Pass

### Step A1. ROI reale invece di solo frame estetico

Il riquadro centrale deve diventare una vera regione preferita di scan.

Strategia:

- pass 1: scan nel ROI centrale
- pass 2: scan su una ROI allargata
- pass 3: scan su frame intero

Obiettivo:

- priorita alla zona dove guidiamo l'utente
- fallback su area piu ampia se il codice non e perfettamente centrato

### Step A2. Ladder di decoding

Per ogni ciclo di scansione:

1. `BarcodeDetector` su ROI centrale
2. `BarcodeDetector` su ROI estesa
3. `Quagga` su snapshot centrale
4. `Quagga` su snapshot intero

Questo evita di affidarsi a un solo tentativo uniforme.

### Step A3. Stabilizzazione con score invece di sole 2 letture uguali

Oggi basta lo stesso codice 2 volte. E poco controllato.

Meglio usare una finestra breve, ad esempio ultimi 6 frame:

- ogni lettura valida aggiunge punteggio
- una lettura uguale in ROI centrale pesa di piu
- una lettura Quagga con buona confidence pesa di piu
- una lettura sporca o incoerente pesa meno

Il barcode viene confermato quando supera una soglia, ad esempio:

- score `>= 3.5`

Vantaggi:

- meno falsi negativi
- meno dipendenza dal perfetto allineamento
- migliore stabilita percepita

### Step A4. Retry adattivo

Se dopo alcuni secondi non troviamo nulla:

- allarghiamo automaticamente la ROI
- aumentiamo la frequenza di tentativi
- mostriamo un suggerimento utile:
  - `Avvicina il codice`
  - `Inclina leggermente il prodotto`
  - `Prova piu luce`

Questi hint devono cambiare in base al tempo di mancata rilevazione.

## Fase B — Lookup Prodotto Robusto

### Step B1. Distinguere bene gli esiti

Il lookup deve produrre stati espliciti:

- `found`
- `not_found`
- `timeout`
- `offline`
- `provider_error`
- `insufficient_product_data`

Questo e fondamentale per non mostrare piu `Errore di rete` quando il problema non e la rete.

### Step B2. Retry breve prima del fallimento

Proposta:

- primo tentativo con timeout 4s
- secondo tentativo con timeout 6s

Solo dopo il secondo tentativo mostriamo errore provider.

### Step B3. Fallback di prodotto non trovato

Se barcode letto ma prodotto assente:

- mostrare il numero barcode confermato
- proporre subito:
  - ricerca testuale
  - inserimento manuale
  - salvataggio alimento manuale con barcode associato

Questo trasforma un fallimento in un flusso recuperabile.

### Step B4. Cache barcode locale persistente

Oggi esiste una cache runtime, ma non una cache persistente veramente orientata al barcode.

Serve:

- cache persistente per `barcode -> prodotto`
- cache persistente per `barcode -> alimento manuale creato dall'utente`

Vantaggi:

- prodotti gia letti disponibili offline o quasi istantaneamente
- riduzione della dipendenza da Open Food Facts

## Fase C — UX Scanner

## Obiettivo UX

L'utente deve capire sempre in che stato si trova il sistema.

### Stati UI proposti

- `Sto cercando il barcode...`
- `Barcode quasi agganciato...`
- `Barcode letto: 8001234567890`
- `Cerco il prodotto...`
- `Prodotto trovato`
- `Barcode letto ma prodotto non trovato`
- `Servizio lento, provo di nuovo...`

### Migliorie UX consigliate

- animazione del frame quando una lettura e promettente
- testo che spiega che il frame centrale e preferito ma non esclusivo
- CTA sempre visibile per ricerca manuale
- CTA per inserimento barcode manuale

## Roadmap Consigliata

## Step 0 — Strumentazione

Prima di migliorare l'algoritmo, tracciare questi eventi:

- tempo apertura scanner -> primo barcode letto
- barcode letto ma lookup fallito
- barcode letto ma prodotto assente
- numero medio di tentativi prima della conferma
- fonte lettura:
  - BarcodeDetector ROI
  - BarcodeDetector full frame
  - Quagga ROI
  - Quagga full frame

## Step 1 — Correzione lookup e messaging

Priorita massima, perche oggi genera frustrazione anche quando il barcode e stato letto.

Da fare:

- distinguere `timeout`, `provider error`, `not found`
- retry breve automatico
- messaggi UX corretti
- CTA immediate di fallback

## Step 2 — ROI reale e scan multi-pass

Da fare:

- crop ROI centrale
- fallback ROI estesa
- fallback full frame
- astrazione `scanBarcode()` con pipeline unica

Questo e il punto chiave per far smettere la sensazione "deve stare perfettamente nel quadrato".

## Step 3 — Stabilizzazione intelligente

Da fare:

- buffer delle ultime letture
- score di conferma
- pesi diversi per ROI e confidence

## Step 4 — Cache persistente barcode

Da fare:

- persistenza in storage
- priorita alla cache locale prima del fetch esterno
- supporto a prodotti creati manualmente dall'utente

## Step 5 — Fallback premium

Da fare:

- inserimento manuale barcode
- creazione alimento manuale precompilata col barcode
- suggerimento ricerca testuale sul nome

## Test Da Prevedere

### Test funzionali

- barcode valido trovato in cache
- barcode valido trovato su OFF
- barcode valido non presente su OFF
- timeout OFF
- offline reale
- chiusura scanner durante lookup

### Test UX mobile

- prodotto vicino ma non perfettamente centrato
- codice piccolo
- codice su confezione lucida
- luce bassa
- barcode inclinato

### Metriche target

- conferma barcode in meno di 1.5s nei casi facili
- miglioramento netto dei casi letti fuori centro
- riduzione drastica dei falsi `errore rete`

## Priorita Consigliata

Ordine migliore:

1. migliorare lookup/messaggi
2. introdurre ROI reale + multi-pass
3. introdurre stabilizzazione a score
4. aggiungere cache persistente
5. aggiungere fallback manuale premium

## Conclusione

Il problema barcode non e uno solo.

Oggi abbiamo:

- scanner troppo semplice lato detection
- lookup troppo fragile lato rete/provider
- messaggistica che mescola errori diversi

La direzione giusta non e "rendere il riquadro piu preciso", ma progettare una pipeline robusta, mobile-first e tollerante:

- legge bene anche senza allineamento perfetto
- distingue bene il tipo di errore
- recupera subito quando il provider esterno non aiuta
