**Supabase Setup**

1. Crea un progetto su Supabase.
2. In `Authentication > Providers`, lascia attivo `Email`.
3. In `Authentication > URL Configuration`, aggiungi l'URL che userai in locale se necessario.
4. Apri `SQL Editor` e incolla il contenuto di [supabase-schema.sql](/Users/federicomarci/Desktop/MarciFit/supabase-schema.sql).
5. Esegui lo script.
6. Vai in `Project Settings > API`.
7. Copia:
   - `Project URL`
   - `anon public key`
8. Apri MarciFit.
9. Vai in `Profilo > Account`.
10. Inserisci `Project URL` e `anon key`.
11. Premi `Salva configurazione`.
12. Usa `Crea account` o `Accedi` dal gateway iniziale.

**Cosa succede dopo**

- `profiles` salva dati base account.
- `app_state` salva lo snapshot JSON dell'app.
- se Supabase è attivo, MarciFit usa il cloud per login e sync.
- se Supabase non è attivo, resta il fallback locale mock.

**Nota MVP**

- il sync usa una logica semplice `last write wins`
- lo stato completo app è salvato in `app_state.state_json`
- la cache locale per account resta attiva anche con Supabase
