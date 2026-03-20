// ─────────────────────────────────────────────────────────────────────────────
// storage.js  –  Persistenza dati (localStorage) e import/export
// Dipendenze: S (state object), mealMacros(), mealIngrText(), esc() da nutritionLogic.js
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'piano_federico_v2';
let _saveTimer;

// Salva lo stato su localStorage
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e) {}
}

// Salvataggio debounced (evita scritture eccessive durante l'editing)
function saveSoon() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 400);
}

// Carica lo stato da localStorage; restituisce true se trovato
function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);

    // Chiavi dati utente – sempre ripristinate
    const USER_KEYS = [
      'checked','altSel','weightLog','notes','noteSearch','profHist',
      'profilo','anagrafica','macro','meals','alts','onDays','calOffset','selDate',
      'doneByDate','measurements','goal','supplements','suppChecked','statsRange',
      'lastCheckin','foodCache','foodLog','templates','customFoods','water',
      'favoriteFoods','mealPlanner'
    ];
    USER_KEYS.forEach(k => { if (k in saved) S[k] = saved[k]; });

    // day/planTab: ripristina solo se valore valido
    if (saved.day === 'on' || saved.day === 'off') S.day = saved.day;
    if (saved.planTab === 'on' || saved.planTab === 'off') S.planTab = saved.planTab;

    // Guardrail: onDays sempre array non vuoto
    if (!Array.isArray(S.onDays) || S.onDays.length === 0) S.onDays = [1, 3, 5];

    // Guardrail: noteSearch sempre stringa
    if (typeof S.noteSearch !== 'string') S.noteSearch = '';

    return true;
  } catch(e) {
    return false;
  }
}

// Cancella tutti i dati e ricarica la pagina
function clearStorage() {
  showDayModal({
    icon: '🗑️',
    title: 'Reset tutti i dati',
    body: 'Questa operazione <strong>cancella definitivamente</strong> tutti i dati salvati (piani, log, misurazioni, profilo) e riporta l\'app ai valori originali.<br><br>L\'operazione non è reversibile.',
    danger: true,
    onConfirm: () => {
      localStorage.removeItem(LS_KEY);
      location.reload();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export / Import JSON
// ─────────────────────────────────────────────────────────────────────────────

function exportJSON() {
  dl(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }), 'piano_federico.json');
  toast('💾  Salvato');
}

function loadJSON() {
  document.getElementById('fi').click();
}

function onLoad(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      Object.assign(S, JSON.parse(ev.target.result));
      save();
      initAll();
      toast('📂  Caricato');
    } catch {
      toast('❌  Errore JSON');
    }
  };
  r.readAsText(f);
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Python
// ─────────────────────────────────────────────────────────────────────────────

function exportPy() {
  const mo = S.macro.on, mf = S.macro.off;
  const py = `#!/usr/bin/env python3
# Piano Alimentare – ${new Date().toLocaleDateString('it-IT')}
MACRO_ON ={'p':${mo.p},'c':${mo.c},'f':${mo.f},'k':${mo.k}}
MACRO_OFF={'p':${mf.p},'c':${mf.c},'f':${mf.f},'k':${mf.k}}
PASTI_ON=[${S.meals.on.map((m) => {
    const mm = mealMacros(m);
    return `\n    ('${m.icon}','${esc(m.name)}','${esc(m.time)}','${esc(mealIngrText(m))}',${mm.kcal},${mm.p},${mm.c},${mm.f})`;
  }).join(',')}
]
PASTI_OFF=[${S.meals.off.map((m) => {
    const mm = mealMacros(m);
    return `\n    ('${m.icon}','${esc(m.name)}','${esc(m.time)}','${esc(mealIngrText(m))}',${mm.kcal},${mm.p},${mm.c},${mm.f})`;
  }).join(',')}
]
if __name__=='__main__':
    for t,meals,macro in[('ON',PASTI_ON,MACRO_ON),('OFF',PASTI_OFF,MACRO_OFF)]:
        print(f"\\nGiorno {t}: {macro['k']} kcal | P {macro['p']}g C {macro['c']}g F {macro['f']}g")
        for m in meals: print(f"  {m[1]}: {m[4]} kcal")
`;
  dl(new Blob([py], { type: 'text/plain' }), 'piano_aggiornato.py');
  toast('⬇️  Python scaricato');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility download
// ─────────────────────────────────────────────────────────────────────────────

function dl(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
