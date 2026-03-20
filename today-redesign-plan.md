# Today View - Audit e Mini Roadmap

## Obiettivo

Ridurre il carico cognitivo della view `Today` senza perdere le funzionalita gia utili.

L'idea non e rifare la schermata da zero, ma chiarire:

- cosa guardare subito
- cosa fare adesso
- cosa usare come supporto secondario

## Stato attuale

La struttura di `Today` oggi e:

1. greeting
2. dashboard giorno
3. quick actions + signal row
4. focus del momento
5. timeline pasti
6. support panel
7. alert supporto
8. integratori
9. acqua
10. note

## Punti forti

- il focus del momento e concettualmente molto forte
- il support panel tiene vicine le azioni quotidiane utili
- la timeline pasti resta il cuore della schermata
- note, acqua e integratori hanno senso nel contesto del giorno

## Problema principale

Ci sono troppe aree che chiedono attenzione con peso simile:

- dashboard
- quick actions
- signal row
- focus del momento
- support alert
- acqua
- integratori
- note

Risultato:

- l'utente capisce che la schermata e ricca
- ma non e sempre chiarissimo quale sia il passo piu importante da fare adesso

## Diagnosi UX

### 1. Ridondanza di priorita

`today-quick-actions`, `today-signal-row`, `current-meal-focus` e `today-support-alerts` competono tra loro.

Molti segnali sono validi, ma non tutti devono essere visivamente "forti" nello stesso momento.

### 2. Support panel troppo largo come responsabilita

Dentro `today-support-panel` convivono:

- alert
- integratori
- acqua
- note

Sono tutti utili, ma appartengono a tre livelli diversi:

- alert contestuali
- azioni rapide giornaliere
- memoria/testo libero

### 3. Note troppo importanti visivamente rispetto alla frequenza d'uso

Le note sono utili, ma oggi occupano tanto spazio stabile nella stessa card che contiene supporto operativo.

### 4. CTA primaria non abbastanza unica

Il focus del momento e la CTA migliore, ma intorno esistono molte altre azioni con peso simile.

## Direzione consigliata

## Principio 1

Una sola area deve guidare l'azione immediata:

- `Focus del momento`

## Principio 2

Gli elementi di supporto devono stare in un blocco piu calmo e comprimibile mentalmente:

- acqua
- integratori
- note

## Principio 3

Gli alert non devono vivere in due posti con la stessa forza.

Meglio:

- un segnale principale vicino al focus
- il resto nel supporto, ma con tono secondario

## Mini roadmap

## Pass 1 - Riordino gerarchico

Obiettivo:

chiarire la sequenza visiva della giornata

Interventi:

- lasciare dashboard e recap in alto
- mantenere `Focus del momento` come unico blocco CTA forte
- rendere `quick actions` e `signal row` piu compatti
- alleggerire il support panel

## Pass 2 - Support panel piu leggibile

Obiettivo:

trasformare il supporto in un blocco rapido, non in un secondo centro di gravita

Interventi:

- mettere acqua e integratori nella stessa riga o griglia compatta
- spostare le note in un sottomodulo piu discreto
- ridurre il peso visivo degli alert secondari

## Pass 3 - Note meno invasive

Obiettivo:

mantenere utilita senza occupare troppo spazio costante

Interventi:

- compattezza iniziale maggiore
- storico note piu discreto
- microcopy piu breve

## Pass 4 - Pulizia del codice Today

Obiettivo:

far corrispondere la nuova gerarchia a componenti piu chiari

Interventi:

- helper separato per support panel
- helper separato per notes
- helper separato per hydration/supplements cluster

## Prima implementazione consigliata

Se facciamo un primo pass subito, io farei questo:

1. tenere intatti `dashboard` e `timeline`
2. lasciare forte `current-meal-focus`
3. trasformare `today-support-panel` in:

- header breve
- riga compatta `acqua + integratori`
- alert secondari solo se davvero presenti
- note in card piu leggera e visivamente secondaria

## Impatto atteso

- schermata piu facile da leggere
- CTA primaria piu evidente
- meno sensazione di "troppo tutto insieme"
- codice Today piu modulare
