# Audit UI/UX Tab Oggi

Data audit: 20 marzo 2026
Focus: vista mobile-first della tab `Oggi`

## Screenshot card

### Greeting
![Greeting](/Users/federicomarci/Desktop/MarciFit/.codex-previews/today-cards/01-greeting.png)

### Dashboard del giorno
![Dashboard](/Users/federicomarci/Desktop/MarciFit/.codex-previews/today-cards/02-dashboard.png)

### Focus del momento
![Focus](/Users/federicomarci/Desktop/MarciFit/.codex-previews/today-cards/03-focus.png)

### Meal card 
![Meal 1](/Users/federicomarci/Desktop/MarciFit/.codex-previews/today-cards/04-meal-card-1.png)

### Supporto giornata
![Supporto](/Users/federicomarci/Desktop/MarciFit/.codex-previews/today-cards/07-support-panel.png)

## Valutazione sintetica

- La tab ha una buona identita e una gerarchia ormai chiara.
- Le parti migliori oggi sono `Greeting`, `Dashboard` e `Focus del momento`.
- Il limite principale non e la mancanza di componenti, ma il peso visivo troppo simile tra blocchi diversi.
- La pagina e leggibile, ma puo ancora diventare piu premium e piu rapida da scansionare.

## Migliorie proposte

### 1. Greeting: piu hero, meno box informativo

Stato:
- il mood e premium
- la frase del giorno e gradevole
- il blocco pero e ancora leggermente alto per una vista mobile che deve portare subito all'azione

Interventi:
- ridurre del 15-20% l'altezza della quote card
- dare piu contrasto al titolo principale e meno peso alla riga descrittiva
- trasformare `Giorno ON` e `Streak` in due chip piu allineate e meno distanti
- aggiungere una micro animazione di profondita solo sul cambio stato, non continua

### 2. Dashboard: ottima struttura, ma troppo “vuota” dentro

Stato:
- `Avvisi da leggere` e posizionata bene
- `Riepilogo giornata` ha buona chiarezza, ma tanto spazio verticale
- `Settimana` e elegante ma molto ariosa

Interventi:
- comprimere `Riepilogo giornata`
- mettere `kcal + stato target` in una fascia unica
- portare `proteine / carb / grassi` in una riga ancora piu stretta
- integrare il progresso pasti nella stessa superficie, senza terzo blocco separato
- su `Settimana`, ridurre padding interno delle day-cell e alleggerire il testo `ON/OFF`

### 3. Focus del momento: forte, ma puo essere ancora piu diretto

Stato:
- e la card giusta da tenere centrale
- ha buona gerarchia e buona CTA
- l'alert rosso dentro il focus compete ancora con il supporto giornata

Interventi:
- sostituire l'alert rosso interno con un “risk chip” orizzontale piu asciutto
- portare il bottone principale piu vicino all'insight
- rendere `Pasto avviato / Ancora da loggare` piu simile a uno stato compatto, non a una sotto-card piena

### 4. Meal cards: la parte con piu margine reale

Stato:
- sono pulite e comprensibili
- pero sono ancora molto verticali
- il box `Obiettivo` occupa parecchio spazio in rapporto all'informazione

Interventi:
- trasformare il box `Obiettivo` in una barra interna piu bassa
- allineare `kcal` e macro in una sola riga densa
- rendere il pulsante `+` meno isolato e piu integrato nella header row
- far emergere meglio lo stato del pasto:
  - vuoto
  - iniziato
  - quasi completo
  - completo

### 5. Supporto giornata: utile, ma oggi ancora un po troppo ansiogeno

Stato:
- la logica e giusta: tutto il supporto e in basso
- gli alert rossi sono molto chiari
- la pila di alert full-red rende pero la sezione pesante e ripetitiva

Interventi:
- lasciare rosso pieno solo il primo alert ad alta priorita
- il secondo alert puo diventare `warn` ambra o soft red
- rendere `Idratazione` piu interattiva e meno piatta
- rendere `Routine integratori` piu “system status” e meno lista passiva

### 6. Note del giorno: corrette, ma ancora troppo neutre

Stato:
- il tono calmo e coerente
- il blocco pero sembra un placeholder piu che una feature viva

Interventi:
- aggiungere una riga guida piu editoriale
- introdurre stato vuoto piu curato
- aggiungere un micro badge contestuale quando c'e gia una nota salvata

## Priorita consigliate

1. Compattare `Riepilogo giornata`
2. Ridisegnare `Meal cards` in chiave piu orizzontale
3. Alleggerire l'alert nel `Focus del momento`
4. Raffinare `Supporto giornata`
5. Fare polish finale su `Greeting` e `Note`

## Direzione design consigliata

- Gerarchia: un solo vero hero, una sola vera CTA primaria
- Densita: piu informazioni per riga, meno box dentro box
- Tono: premium calmo, non clinico
- Colore: rosso forte solo quando serve davvero
- Microcopy: piu corto, piu diretto, piu operativo
