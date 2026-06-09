# Product Copy Guardrails

## Regola permanente

Tutto cio che riguarda infrastruttura, stati interni, setup, diagnostica, limiti temporanei o funzioni non ancora pronte resta nel perimetro sviluppo e non entra nell'interfaccia utente.

In UI non devono comparire, salvo casi davvero indispensabili, parole o concetti come:

- locale
- cloud
- sync / sincronizzazione tecnica
- backend
- debug
- Supabase
- mock
- TODO / WIP / beta / coming soon tecnico
- feature non pronta / non rifinita / da sistemare

Se una funzione non e pronta:

- si nasconde
- oppure si mostra come anteprima pulita, desiderabile e non difensiva
- ma non si racconta all'utente il motivo tecnico

## Checklist UX copy

- Il testo parla di valore utente, azione successiva o rassicurazione.
- L'utente capisce in 2-3 secondi cosa puo fare adesso.
- CTA, badge, helper text ed empty state usano parole brevi e concrete.
- Gli errori spiegano l'effetto e il prossimo passo, non l'implementazione.
- I dettagli tecnici stanno solo in dev mode, log o strumenti interni.
- I vendor, i provider e i modelli di storage non vengono nominati in UI.
- Le sezioni sospese non sembrano rotte: o spariscono o diventano teaser puliti.
- Nessun copy promette una funzione che oggi non regge bene l'uso reale.
- Import, export, reset e recupero dati parlano in termini utente: copia, dati, profilo, riparti.
- Prima di chiudere una feature, fai un pass mirato su titoli, CTA, toast, modal, badge, helper text ed empty state.

## Mini review finale

Prima del merge o del rilascio:

- fai grep di termini sensibili nei file toccati
- controlla i render condizionali e i toast, non solo i titoli statici
- verifica che eventuali controlli interni siano visibili solo in dev mode
