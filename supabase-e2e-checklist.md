**Supabase E2E Checklist**

Usa questa checklist dopo aver completato i passaggi in [supabase-setup.md](/Users/federicomarci/Desktop/MarciFit/supabase-setup.md).

**A. Configurazione**

1. Apri MarciFit.
2. Vai in `Profilo > Account`.
3. Inserisci `Project URL`.
4. Inserisci `anon key`.
5. Premi `Salva configurazione`.
6. Verifica che compaia il messaggio di conferma.
7. Verifica che la card Account mostri `Supabase pronto` se sei guest.

Esito atteso:
- nessun errore in pagina
- la configurazione resta salvata dopo reload

**B. Signup reale**

1. Resetta i dati oppure usa una sessione nuova.
2. Dal gateway iniziale premi `Crea account`.
3. Inserisci email valida.
4. Inserisci password di almeno 8 caratteri.
5. Conferma password.
6. Completa la registrazione.

Esito atteso:
- accesso completato senza errori
- l’app ricarica correttamente
- in `Profilo > Account` compare `Profilo connesso`
- provider mostrato: `Supabase`

Controllo Supabase:
- in `Authentication > Users` compare il nuovo utente

**C. Profilo base cloud**

1. Dopo il signup, vai in Supabase.
2. Apri `Table Editor > profiles`.
3. Cerca la riga del tuo `user_id`.

Esito atteso:
- esiste una riga in `profiles`
- `email` è valorizzata
- `name` è valorizzato

**D. Primo sync stato**

1. Nell’app modifica qualcosa di semplice:
   - nome profilo
   - goal
   - acqua
   - un pasto
2. Vai in `Profilo > Account`.
3. Premi `Sincronizza ora`.

Esito atteso:
- toast di conferma
- nella card account compare `Ultimo sync`

Controllo Supabase:
- in `Table Editor > app_state` esiste una riga per `user_id`
- `state_json` contiene dati dell’app

**E. Reload stesso dispositivo**

1. Ricarica la pagina.
2. Accedi di nuovo se necessario.

Esito atteso:
- stato account mantenuto
- dati app ancora presenti
- nessuna regressione onboarding/gateway

**F. Login reale**

1. Fai `Logout`.
2. Premi `Accedi`.
3. Inserisci la stessa email/password.

Esito atteso:
- login completato
- provider mostrato: `Supabase`
- dati precedenti recuperati correttamente

**G. Recupero da cloud**

1. Dopo aver sincronizzato, chiudi la pagina.
2. Apri l’app in una sessione pulita o altro browser/dispositivo.
3. Configura gli stessi `Project URL` e `anon key` se necessario.
4. Accedi con lo stesso account.

Esito atteso:
- l’app recupera lo stato cloud
- meals, profilo, note e impostazioni tornano visibili

**H. Guest non rotto**

1. Fai logout.
2. Apri il gateway.
3. Premi `Continua senza account`.

Esito atteso:
- onboarding ancora funzionante
- uso locale ancora possibile
- nessun obbligo di login

**I. Errori comuni da controllare**

- `Signup` crea l’utente in Auth ma non scrive in `profiles`
  - controlla le policy RLS e lo script SQL
- `Sincronizza ora` fallisce
  - controlla `app_state` e policy RLS
- login riuscito ma stato non caricato
  - controlla che esista la riga in `app_state`
  - controlla `updated_at`
- la card Account continua a mostrare fallback locale
  - controlla URL/anon key
  - controlla che il client Supabase sia caricato

**J. Criteri di accettazione MVP**

- signup reale funzionante
- login reale funzionante
- logout funzionante
- `profiles` scritto correttamente
- `app_state` scritto correttamente
- sync manuale funzionante
- recupero stato dopo reload funzionante
- fallback guest ancora funzionante
