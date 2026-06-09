# Safari / Home Account Pass

Checklist manuale rapida per verificare il passaggio `Safari -> web app Home` su iPhone senza far sembrare il profilo un account nuovo.

## 1. Safari con account gia esistente

1. Apri MarciFit in Safari su iPhone.
2. Accedi con un account che abbia gia dati significativi.
3. Verifica in `Profilo > Account`:
   - card con `Profilo collegato`
   - `Dati` coerenti (`Cloud + cache account` oppure `Cache account`)
   - `Contesto` = `Browser`
   - nessun onboarding riaperto

Esito atteso:
- nome profilo, peso e stato account coerenti con il cloud
- la card account spiega chiaramente da dove arriva il profilo

## 2. Primo avvio dalla Home

1. Da Safari usa `Condividi > Aggiungi a Home`.
2. Apri la web app salvata in Home.
3. Vai in `Profilo > Account`.

Esito atteso:
- se la sessione e gia disponibile anche in Home, vedi lo stesso profilo di Safari
- se la sessione non e ancora disponibile, la card spiega che la web app Home puo richiedere un accesso la prima volta
- il contesto mostrato e `Web app Home`
- la card non lascia intendere genericamente `nuovo account`: spiega se sei `Guest`, `Solo locale` o `Cloud`

## 3. Login dalla Home

1. Se in Home vedi `Guest`, premi `Accedi o crea profilo`.
2. Accedi con lo stesso account usato in Safari.

Esito atteso:
- il profilo corretto si apre senza riaprire onboarding se esiste gia uno stato significativo
- se esistono copie diverse locale/cloud, compare la scelta chiara tra `Questo dispositivo` e `Cloud account`
- dopo la scelta, la card account aggiorna `Dati`, `Ingresso` e stato sync

## 4. Logout e rientro

1. Dalla web app Home premi `Esci`.
2. Verifica che torni subito il gateway auth, senza affidarsi a un reload pieno.
3. Accedi di nuovo con lo stesso account.

Esito atteso:
- il gateway login si riapre subito
- al nuovo accesso ritrovi la cache per-account corretta
- onboarding non riappare se il profilo aveva gia stato valido

## 5. Import con account attivo

1. Con account attivo, vai in `Profilo` e importa un JSON valido.
2. Attendi il toast finale.
3. Controlla la card account.

Esito atteso:
- i dati importati finiscono nella cache del profilo attivo, non nello spazio guest
- parte un tentativo di sync cloud
- la card account continua a mostrare il contesto giusto e aggiorna lo stato sync

## 6. Cose da annotare se qualcosa non torna

- `Dati` mostrati nella card account
- `Contesto` mostrato nella card account
- `Ingresso` mostrato nella card account
- se il problema succede in `Browser` o `Web app Home`
- se compare una scelta conflitto tra `Questo dispositivo` e `Cloud account`
