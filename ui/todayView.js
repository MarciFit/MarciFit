/* MarciFit Today rendering and daily support UI. */

function getGreetingSubtext(h, type, streak) {
  // Streak milestones hanno priorità massima
  const milestones = [100, 60, 30, 14, 7];
  for (const m of milestones) {
    if (streak === m) {
      if (m === 100) return '🏆 100 giorni di streak · leggendario!';
      if (m === 60)  return '🌟 60 giorni di streak · straordinario!';
      if (m === 30)  return '🎉 Un mese intero di streak · ottimo!';
      if (m === 14)  return '🎉 Due settimane di fila · continua così!';
      if (m === 7)   return '🎉 Una settimana di streak · inizia bene!';
    }
  }
  if (h < 12) {
    // Mattina
    if (type === 'on') {
      return streak > 5 ? '🔥 Tienila accesa · allenamento oggi' : 'Buona giornata di allenamento 💪';
    } else {
      return 'Riposa bene · il recupero è parte del piano';
    }
  } else if (h < 18) {
    // Pomeriggio
    if (type === 'on') return 'Hai ancora tempo per portare a casa la giornata';
    return streak >= 5 ? 'Streak positiva · continua così' : 'Giorno Rest · ricarica le energie';
  } else {
    // Sera
    if (streak >= 5) return 'Ottima continuità · si vede nel tempo';
    return type === 'on' ? 'Giornata di allenamento quasi conclusa' : 'Buon recupero · a domani';
  }
}

// ─── Spunto scientifico giornaliero ──────────────────────────────────────────
function getDailyScienceTip(dateKey, dayType='on', phase='mantieni') {
  const SCIENCE_TIPS = [
    {
      topic: 'Bulk intelligente',
      phases: ['bulk'],
      contexts: ['on'],
      text: 'In bulk non serve esagerare: un surplus moderato tende a sostenere meglio la crescita limitando il grasso in eccesso.',
      source: '',
    },
    {
      topic: 'Bulk + carboidrati',
      phases: ['bulk'],
      contexts: ['on'],
      text: 'In fase di bulk, tenere i carboidrati adeguati nelle giornate di allenamento aiuta volume, performance e recupero tra sedute ravvicinate.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Recupero in bulk',
      phases: ['bulk'],
      contexts: ['off'],
      text: 'Nel giorno Rest di bulk non conviene tagliare troppo: proteine e calorie coerenti aiutano a trasformare il lavoro accumulato in recupero e adattamento.',
      source: '',
    },
    {
      topic: 'Cut e proteine',
      phases: ['cut'],
      contexts: ['on', 'off'],
      text: 'In cut, tenere le proteine alte e il deficit moderato aiuta a difendere meglio la massa magra e rende la dieta piu sostenibile.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Cut e training',
      phases: ['cut'],
      contexts: ['on'],
      text: 'In fase di cut, concentrare una quota utile di carboidrati vicino all allenamento puo aiutare a salvare qualita della seduta e percezione di energia.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Cut e fame',
      phases: ['cut'],
      contexts: ['off'],
      text: 'Nei giorni OFF di cut, fibra, proteine e cibi sazianti aiutano piu della restrizione estrema: l obiettivo e restare aderente per settimane.',
      source: 'Rebello et al., 2016',
      learnMore: { label: 'Scopri di piu', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4757923/' },
    },
    {
      topic: 'Mantenimento',
      phases: ['mantieni'],
      contexts: ['on', 'off'],
      text: 'Mantenere non significa mangiare a caso: vuol dire tenere performance, recupero e peso abbastanza stabili nel tempo con intake coerente.',
      source: '',
    },
    {
      topic: 'Mantenimento attivo',
      phases: ['mantieni'],
      contexts: ['on'],
      text: 'Anche in mantenimento, proteine adeguate e carboidrati ben distribuiti aiutano a sostenere sedute buone e una composizione corporea piu stabile.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Mantenimento e recupero',
      phases: ['mantieni'],
      contexts: ['off'],
      text: 'Nel giorno Rest di mantenimento non serve inseguire il minimo calorico: meglio restare regolari e dare spazio a recupero, sonno e aderenza.',
      source: '',
    },
    {
      topic: 'Proteine',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Per chi si allena con costanza, circa 1.4–2.0 g/kg/die di proteine coprono gia la maggior parte dei bisogni per mantenimento e crescita muscolare.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Distribuzione',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Una quota di proteine di alta qualita da circa 20-40 g per pasto, distribuita ogni 3-4 ore, e una strategia pratica per stimolare piu volte la sintesi proteica nella giornata.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Timing',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Allenamento di forza e proteine sono sinergici: mangiarle prima o dopo la seduta va bene, ma conta di piu la qualita dell intera giornata rispetto al minuto esatto.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Carboidrati',
      phases: ['bulk', 'mantieni'],
      contexts: ['on'],
      text: 'Nelle giornate con allenamenti intensi o voluminosi, carboidrati adeguati aiutano a sostenere glicogeno, qualita della seduta e recupero tra le serie.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0189-4' },
    },
    {
      topic: 'Creatina',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'La creatina monoidrato resta uno dei supplementi con evidenza piu solida: migliora la capacita di lavoro ad alta intensita e puo aumentare gli adattamenti nel tempo.',
      source: 'Kreider et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0173-z' },
    },
    {
      topic: 'Sonno',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Dormire poco non pesa solo sulla testa: puo ridurre la sintesi proteica muscolare e peggiorare il contesto ormonale del giorno dopo.',
      source: 'Lamon et al., 2021',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/33400856/' },
    },
    {
      topic: 'Proteine serali',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'Una quota di proteine prima di dormire puo aumentare la sintesi proteica notturna e sostenere meglio il recupero se ti alleni con regolarita.',
      source: 'Snijders et al., 2015',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/25926415/' },
    },
    {
      topic: 'Fibra e fame',
      phases: ['cut', 'mantieni'],
      contexts: ['off'],
      text: 'La fibra, soprattutto quella solubile, tende a rallentare lo svuotamento gastrico e ad aumentare la sazieta: utile quando vuoi controllare meglio fame e aderenza.',
      source: 'Rebello et al., 2016',
      learnMore: { label: 'Scopri di piu', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4757923/' },
    },
    {
      topic: 'Idratazione',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Anche una disidratazione intorno al 2-3% del peso corporeo puo abbassare potenza e qualita della prestazione, soprattutto negli sforzi intensi.',
      source: 'Judelson et al., 2008',
      learnMore: { label: 'Scopri di piu', href: 'https://pubmed.ncbi.nlm.nih.gov/18550960/' },
    },
    {
      topic: 'Cut intelligente',
      phases: ['cut'],
      contexts: ['on', 'off'],
      text: 'Quando sei in deficit, piu e aggressivo piu diventa difficile tenere alta la performance e preservare massa magra: meglio un taglio moderato e sostenibile.',
      source: 'Aragon et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0174-y' },
    },
    {
      topic: 'Recupero',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['off'],
      text: 'Il giorno Rest non e una pausa dal progresso: e il momento in cui sonno, calorie e proteine trasformano lo stimolo dell allenamento in adattamento.',
      source: '',
    },
    {
      topic: 'Finestra anabolica',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'La finestra post workout non si chiude in pochi minuti: il muscolo resta piu sensibile alle proteine per molte ore dopo la seduta.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Resistenza',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on'],
      text: 'Se fai endurance o sessioni molto lunghe, i carboidrati restano la priorita per la performance; una quota di proteine aiuta piu sul recupero che sul cronometro.',
      source: 'Jager et al., JISSN, 2017',
      learnMore: { label: 'Scopri di piu', href: 'https://link.springer.com/article/10.1186/s12970-017-0177-8' },
    },
    {
      topic: 'Stimolo + cibo',
      phases: ['bulk', 'cut', 'mantieni'],
      contexts: ['on', 'off'],
      text: 'L allenamento fornisce il segnale, ma senza energia e proteine adeguate l ipertrofia resta limitata: stimolo, nutrizione e recupero devono viaggiare insieme.',
      source: '',
    },
  ];

  const d = dateKey || localDate(new Date());
  const targetDate = new Date(`${d}T12:00:00`);
  const base = new Date(`${d.slice(0,4)}-01-01T12:00:00`);
  const dayOfYear = Math.round((targetDate - base) / 86400000);
  const normalizedPhase = ['bulk', 'cut', 'mantieni'].includes(phase) ? phase : 'mantieni';
  const matchesContext = tip => !tip.contexts || tip.contexts.includes(dayType);
  const matchesPhase = tip => !tip.phases || tip.phases.includes(normalizedPhase);

  const phaseSpecificPool = SCIENCE_TIPS.filter(tip =>
    matchesContext(tip) && matchesPhase(tip) && Array.isArray(tip.phases) && tip.phases.length === 1
  );
  const phaseAwarePool = SCIENCE_TIPS.filter(tip =>
    matchesContext(tip) && matchesPhase(tip) && Array.isArray(tip.phases)
  );
  const contextPool = SCIENCE_TIPS.filter(tip => matchesContext(tip) && !Array.isArray(tip.phases));
  const genericPool = SCIENCE_TIPS.filter(tip => matchesContext(tip) && matchesPhase(tip));
  const pool = phaseSpecificPool.length
    ? phaseSpecificPool
    : (phaseAwarePool.length ? phaseAwarePool : (contextPool.length ? contextPool : genericPool));
  const phaseOffset = { bulk: 0, cut: 5, mantieni: 9 }[normalizedPhase] || 0;
  const dayOffset = dayType === 'off' ? 2 : 0;
  return pool[(dayOfYear + phaseOffset + dayOffset) % pool.length];
}

function getGreetingSummaryWaterTarget(type) {
  const info = typeof getWaterTargetInfo === 'function'
    ? getWaterTargetInfo(S.selDate || localDate(), type)
    : null;
  if (info) return info.glasses;
  const peso = S.anagrafica?.peso || 0;
  const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
  const totalMl = baseMl + (type === 'on' ? 350 : 0);
  return Math.max(6, Math.round(totalMl / 250));
}

function getWaterTargetInfo(dateKey = null, type = null) {
  const key = dateKey || S.selDate || localDate();
  const dayType = type || getTrackedDayType(key, getScheduledDayType(key));
  const peso = S.anagrafica?.peso || 0;
  const baseMl = peso > 0 ? Math.round(peso * 35) : 2000;
  const bonusMl = dayType === 'on' ? 350 : 0;
  const autoMl = baseMl + bonusMl;
  const override = Number(S.waterTargetOverrides?.[key]);
  const isManual = Number.isFinite(override) && override >= 1000 && override <= 6000;
  const totalMl = isManual ? Math.round(override) : autoMl;
  return {
    key,
    dayType,
    baseMl,
    bonusMl,
    autoMl,
    totalMl,
    isManual,
    glasses: Math.max(6, Math.round(totalMl / 250)),
  };
}

function formatGreetingSummaryDelta(delta, unit = '', okThreshold = 0) {
  const rounded = unit === 'kcal'
    ? Math.round(delta)
    : Math.round(delta * 10) / 10;
  if (Math.abs(rounded) <= okThreshold) return 'In linea';
  const sign = rounded > 0 ? '+' : '';
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${sign}${value}${unit}`;
}

function getGreetingSummaryToneLabel(tone) {
  if (tone === 'ok') return 'In linea';
  if (tone === 'warn') return 'Da rifinire';
  return 'Focus';
}

function getGreetingSummaryMetricTone(metric, values = {}) {
  const { delta = 0, target = 0, eaten = 0, type = 'off', total = 0, done = 0 } = values;
  const safeTarget = Math.max(0, Number(target) || 0);
  const ratio = safeTarget > 0 ? eaten / safeTarget : 1;
  const absRatio = safeTarget > 0 ? Math.abs(delta) / safeTarget : 0;

  switch (metric) {
    case 'kcal':
      if (Math.abs(delta) <= 200 || absRatio <= 0.08) return 'ok';
      if (Math.abs(delta) <= 320 || absRatio <= 0.14) return 'warn';
      return 'err';
    case 'protein':
      if (delta >= -35 || ratio >= 0.95) return 'ok';
      if (delta >= -45 || ratio >= 0.85) return 'warn';
      return 'err';
    case 'carbs':
      if (delta >= -40 || ratio >= 0.95) return 'ok';
      if (type === 'on') return (delta >= -65 || ratio >= 0.82) ? 'warn' : 'err';
      return (delta >= -70 || ratio >= 0.72) ? 'warn' : 'err';
    case 'fat':
      if (Math.abs(delta) <= 15 || (ratio >= 0.85 && ratio <= 1.25)) return 'ok';
      if (Math.abs(delta) <= 25 || (ratio >= 0.7 && ratio <= 1.4)) return 'warn';
      return 'err';
    case 'water':
      if (ratio >= 1) return 'ok';
      if (target - eaten <= 2 || ratio >= 0.75) return 'warn';
      return 'err';
    case 'supplements':
      if (!total) return 'soft';
      if (done >= total) return 'ok';
      if (done / total >= 0.5) return 'warn';
      return 'err';
    default:
      return 'soft';
  }
}

function getGreetingSummaryHeadline(tone, issues) {
  const topIssue = issues[0] || null;
  if (!topIssue) return 'Giornata centrata';
  if (topIssue.key === 'kcal-high') return 'Surplus sopra il previsto';
  if (tone === 'warn') return 'Quasi in target';
  if (topIssue.key === 'hydration') return 'Idratazione indietro';
  if (topIssue.key === 'supplements') return 'Routine da completare';
  return 'Sei sotto target su punti chiave';
}

function getGreetingSummaryCoaching(summary) {
  const topIssue = summary.issues[0] || null;
  if (!topIssue) return '';

  if (topIssue.key === 'protein') {
    if (summary.deltaP <= -25 && summary.waterTone !== 'ok') {
      const waterNeed = Math.max(0, summary.waterTarget - summary.waterCount);
      const closingGlasses = Math.min(waterNeed, 2);
      return `Chiudi con una quota proteica semplice${closingGlasses > 0 ? ` e ${closingGlasses} ${closingGlasses === 1 ? 'bicchiere' : 'bicchieri'} d acqua` : ''} per avvicinarti meglio al target.`;
    }
    return 'Buona base oggi: ti manca soprattutto la quota proteica finale.';
  }
  if (topIssue.key === 'carbs') {
    return summary.type === 'on'
      ? 'Workout day discreto, ma i carboidrati sono rimasti bassi per sostenere meglio recupero e performance.'
      : 'Carbo ancora un po indietro: domani possiamo distribuirli meglio senza forzare la chiusura della sera.';
  }
  if (topIssue.key === 'hydration') {
    const waterNeed = Math.max(0, summary.waterTarget - summary.waterCount);
    const closingGlasses = Math.min(waterNeed, 2);
    return closingGlasses > 0
      ? `Mancano ${closingGlasses} ${closingGlasses === 1 ? 'bicchiere' : 'bicchieri'} per chiudere l acqua.`
      : 'Acqua ancora da chiudere.';
  }
  if (topIssue.key === 'supplements') {
    if (summary.pendingSuppNames.length === 1) {
      return `Routine quasi completa: ti manca ancora ${summary.pendingSuppNames[0]}.`;
    }
    return `Routine quasi completa: restano ${summary.pendingSuppCount} integratori attivi da segnare.`;
  }
  if (topIssue.key === 'kcal-high') {
    return 'Energia sopra il previsto: se succede spesso, controlliamo meglio densita calorica e extras.';
  }
  if (topIssue.key === 'kcal-low') {
    if (summary.proteinTone !== 'ok') {
      return 'Se vuoi chiuderla meglio, punta su una quota proteica semplice con un po di energia facile da completare.';
    }
    return 'Sei ancora sotto target: una chiusura semplice e digeribile puo aiutarti a non restare troppo indietro.';
  }
  if (topIssue.key === 'fat') {
    return summary.deltaF < 0
      ? 'I grassi sono rimasti bassi: basta un piccolo extra di grassi buoni per riequilibrare senza appesantire.'
      : 'Grassi un po sopra il solito: domani possiamo alleggerire condimenti ed extras senza irrigidire la giornata.';
  }
  return '';
}

function getGreetingSummaryHighlight(label, value, tone = 'soft') {
  return { label, value, tone };
}

function getGreetingSummaryPrimaryInsight(summary) {
  const topIssue = summary.issues[0] || null;
  if (!topIssue) {
    return {
      key: 'centered',
      eyebrow: 'Segnale chiave',
      title: 'Hai chiuso una giornata ben centrata.',
      body: summary.cheat?.extraKcal
        ? 'Nonostante il margine extra, il quadro finale resta leggibile e sotto controllo.'
        : 'Target, ritmo e chiusura serale raccontano una giornata pulita e coerente.',
    };
  }
  if (topIssue.key === 'kcal-high') {
    return {
      key: 'kcal-high',
      eyebrow: 'Segnale chiave',
      title: 'Sei finito sopra il previsto.',
      body: summary.cheat?.extraKcal
        ? 'Il margine extra spiega parte dello scarto, ma conviene tenere d occhio extras e densita calorica.'
        : 'Il punto da leggere non e il caos della giornata, ma l energia finale salita oltre il ritmo giusto.',
    };
  }
  if (topIssue.key === 'kcal-low') {
    return {
      key: 'kcal-low',
      eyebrow: 'Segnale chiave',
      title: 'La giornata e rimasta corta.',
      body: summary.proteinTone !== 'ok'
        ? 'Non manca tutto: manca soprattutto una chiusura piu completa tra energia e quota proteica.'
        : 'Il quadro e ordinato, ma l energia finale e rimasta sotto il livello che volevamo davvero.',
    };
  }
  if (topIssue.key === 'protein') {
    return {
      key: 'protein',
      eyebrow: 'Segnale chiave',
      title: 'Ti manca soprattutto la quota proteica.',
      body: 'La giornata non e da rifare: il punto vero da leggere e la proteina finale rimasta indietro.',
    };
  }
  if (topIssue.key === 'carbs') {
    return {
      key: 'carbs',
      eyebrow: 'Segnale chiave',
      title: 'I carboidrati sono rimasti indietro.',
      body: summary.type === 'on'
        ? 'In un workout day questo pesa di piu su recupero e feeling generale della chiusura.'
        : 'Il resto puo essere anche pulito, ma il carburante della giornata e rimasto sotto ritmo.',
    };
  }
  if (topIssue.key === 'hydration') {
    return {
      key: 'hydration',
      eyebrow: 'Segnale chiave',
      title: 'Acqua da chiudere.',
      body: 'La giornata resta buona: manca solo qualche bicchiere.',
    };
  }
  if (topIssue.key === 'supplements') {
    return {
      key: 'supplements',
      eyebrow: 'Segnale chiave',
      title: 'Resta da chiudere la routine.',
      body: 'Il quadro della giornata e quasi completo: il dettaglio mancante e soprattutto organizzativo.',
    };
  }
  if (topIssue.key === 'fat') {
    return {
      key: 'fat',
      eyebrow: 'Segnale chiave',
      title: 'I grassi sono usciti un po dal ritmo.',
      body: summary.deltaF < 0
        ? 'Non serve stravolgere la lettura: basta notare che i grassi sono rimasti troppo bassi.'
        : 'Il resto puo anche essere ordinato, ma i grassi hanno spinto piu del necessario.',
    };
  }
  return {
    key: 'general',
    eyebrow: 'Segnale chiave',
    title: summary.headline || 'Riepilogo giornata',
    body: summary.coaching || 'Il recap serale mette a fuoco il punto davvero importante della giornata.',
  };
}

function getGreetingSummarySecondaryHighlights(summary) {
  const highlights = [];
  const push = item => {
    if (!item || highlights.some(existing => existing.label === item.label)) return;
    highlights.push(item);
  };
  const energyDelta = formatGreetingSummaryDelta(summary.deltaK, ' kcal', 200);
  const proteinDelta = formatGreetingSummaryDelta(summary.deltaP, 'g', 35);
  const carbDelta = formatGreetingSummaryDelta(summary.deltaC, 'g', 40);
  const fatDelta = formatGreetingSummaryDelta(summary.deltaF, 'g', 15);
  const routineValue = summary.activeSuppCount ? `${summary.doneSuppCount}/${summary.activeSuppCount}` : 'Nessuna';

  switch (summary.primaryInsight?.key) {
    case 'centered':
      push(getGreetingSummaryHighlight('Energia', energyDelta, 'ok'));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
    case 'kcal-high':
    case 'kcal-low':
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      if (summary.cheat?.extraKcal) push(getGreetingSummaryHighlight('Extra', `+${Math.round(summary.cheat.extraKcal)} kcal`, 'warn'));
      else push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      break;
    case 'protein':
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      break;
    case 'carbs':
      push(getGreetingSummaryHighlight('Carbo', carbDelta, summary.carbTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      break;
    case 'hydration':
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
    case 'supplements':
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      break;
    case 'fat':
      push(getGreetingSummaryHighlight('Grassi', fatDelta, summary.fatTone));
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Proteine', proteinDelta, summary.proteinTone));
      break;
    default:
      push(getGreetingSummaryHighlight('Energia', energyDelta, summary.kcalTone));
      push(getGreetingSummaryHighlight('Acqua', `${summary.waterCount}/${summary.waterTarget}`, summary.waterTone));
      push(getGreetingSummaryHighlight('Routine', routineValue, summary.suppTone));
      break;
  }

  return highlights.slice(0, 3);
}

function buildGreetingDailySummary(dateKey, type, now = new Date()) {
  const key = dateKey || S.selDate || localDate(now);
  const resolvedType = getTrackedDayType(key, type || getScheduledDayType(key));
  const ctx = buildAlertContext(resolvedType, now.getHours(), key);
  const completion = getDayCompletion(key, resolvedType);
  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(key) : null;
  const effectiveTargetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(key, resolvedType)
    : ctx.tgtK;
  const dayLog = ctx.dayLog || {};
  const mealSlots = alertMealSlots(resolvedType, dayLog);
  const waterTarget = getGreetingSummaryWaterTarget(resolvedType);
  const waterCount = completion.waterCount || 0;
  const supplements = Array.isArray(S.supplements)
    ? S.supplements.filter(s => s && typeof s === 'object')
    : [];
  const checkedSuppValues = Array.isArray(S.suppChecked?.[key]) ? S.suppChecked[key] : [];
  const activeSupps = supplements.filter(s => s.active);
  const checkedSupps = new Set(checkedSuppValues);
  const doneSuppCount = activeSupps.filter(s => checkedSupps.has(s.id)).length;
  const pendingSupps = activeSupps.filter(s => !checkedSupps.has(s.id));
  const targetK = Math.max(0, Number(effectiveTargetK) || 0);
  const targetP = Math.max(0, Number(ctx.tgtP) || 0);
  const targetC = Math.max(0, Number(ctx.tgtC) || 0);
  const targetF = Math.max(0, Number(ctx.tgtF) || 0);
  const deltaK = Math.round(ctx.eK - targetK);
  const deltaP = Math.round((ctx.eP - targetP) * 10) / 10;
  const deltaC = Math.round((ctx.eC - targetC) * 10) / 10;
  const deltaF = Math.round((ctx.eF - targetF) * 10) / 10;
  const todayKey = localDate(now);
  const isToday = key === todayKey;
  const isPast = key < todayKey;
  const isFuture = key > todayKey;
  const dinnerLogged = mealSlots.hasDinnerSlot ? mealSlots.hasDinner : false;
  const afterEveningWindow = isToday && ((now.getHours() * 60) + now.getMinutes() >= ((19 * 60) + 30));
  const hasEnoughData = completion.done > 0 || !!cheat;
  const phaseLabel = { bulk: 'Bulk', cut: 'Cut', mantieni: 'Mantenimento' }[S.goal?.phase || 'mantieni'] || 'Mantenimento';
  const dayTypeLabel = resolvedType === 'on' ? 'Giorno di allenamento' : 'Giorno di recupero';

  const kcalTone = getGreetingSummaryMetricTone('kcal', {
    delta: deltaK,
    eaten: ctx.eK,
    target: targetK,
  });
  const proteinTone = getGreetingSummaryMetricTone('protein', {
    delta: deltaP,
    eaten: ctx.eP,
    target: targetP,
  });
  const carbTone = getGreetingSummaryMetricTone('carbs', {
    delta: deltaC,
    eaten: ctx.eC,
    target: targetC,
    type: resolvedType,
  });
  const fatTone = getGreetingSummaryMetricTone('fat', {
    delta: deltaF,
    eaten: ctx.eF,
    target: targetF,
  });
  const waterTone = getGreetingSummaryMetricTone('water', {
    delta: waterCount - waterTarget,
    eaten: waterCount,
    target: waterTarget,
  });
  const suppTone = getGreetingSummaryMetricTone('supplements', {
    total: activeSupps.length,
    done: doneSuppCount,
  });

  const issues = [];
  if (kcalTone !== 'ok') {
    issues.push({
      key: deltaK > 0 ? 'kcal-high' : 'kcal-low',
      tone: kcalTone,
      score: deltaK > 0 ? (kcalTone === 'err' ? 96 : 72) : (kcalTone === 'err' ? 88 : 60),
    });
  }
  if (proteinTone !== 'ok' && deltaP < 0) {
    issues.push({ key: 'protein', tone: proteinTone, score: proteinTone === 'err' ? 94 : 78 });
  }
  if (carbTone !== 'ok' && deltaC < 0) {
    issues.push({ key: 'carbs', tone: carbTone, score: resolvedType === 'on' ? (carbTone === 'err' ? 90 : 74) : (carbTone === 'err' ? 58 : 42) });
  }
  if (waterTone !== 'ok') {
    issues.push({ key: 'hydration', tone: waterTone, score: waterTone === 'err' ? 82 : 54 });
  }
  if (suppTone !== 'ok' && suppTone !== 'soft') {
    issues.push({ key: 'supplements', tone: suppTone, score: suppTone === 'err' ? 68 : 48 });
  }
  if (fatTone !== 'ok') {
    issues.push({ key: 'fat', tone: fatTone, score: fatTone === 'err' ? 40 : 18 });
  }
  issues.sort((a, b) => b.score - a.score);

  const tone = issues.length
    ? (issues.some(issue => issue.tone === 'err') ? 'err' : 'warn')
    : 'ok';
  const headline = getGreetingSummaryHeadline(tone, issues);
  const coaching = tone === 'ok' ? '' : getGreetingSummaryCoaching({
    issues,
    type: resolvedType,
    deltaP,
    deltaF,
    proteinTone,
    waterTone,
    waterTarget,
    waterCount,
    pendingSuppCount: pendingSupps.length,
    pendingSuppNames: pendingSupps.map(s => s.name),
  });
  const primaryInsight = getGreetingSummaryPrimaryInsight({
    type: resolvedType,
    headline,
    coaching,
    cheat,
    issues,
    deltaF,
    proteinTone,
  });
  const secondaryHighlights = getGreetingSummarySecondaryHighlights({
    type: resolvedType,
    cheat,
    primaryInsight,
    waterCount,
    waterTarget,
    activeSuppCount: activeSupps.length,
    doneSuppCount,
    deltaK,
    deltaP,
    deltaC,
    deltaF,
    targetK,
    kcalTone,
    proteinTone,
    carbTone,
    fatTone,
    waterTone,
    suppTone,
  });
  const closingMessage = tone === 'ok'
    ? (cheat?.extraKcal
        ? 'Hai margine per leggere la giornata senza allarmismi: domani basta tornare al ritmo normale.'
        : 'Una chiusura cosi rende piu semplice anche il giorno dopo.')
    : coaching;

  return {
    key,
    type: resolvedType,
    phaseLabel,
    dayTypeLabel,
    tone,
    toneLabel: getGreetingSummaryToneLabel(tone),
    headline,
    coaching,
    primaryInsight,
    secondaryHighlights,
    closingMessage,
    cheat,
    waterCount,
    waterTarget,
    pendingSuppCount: pendingSupps.length,
    pendingSuppNames: pendingSupps.map(s => s.name),
    doneSuppCount,
    activeSuppCount: activeSupps.length,
    deltaK,
    deltaP,
    deltaC,
    deltaF,
    kcalTone,
    proteinTone,
    carbTone,
    fatTone,
    waterTone,
    suppTone,
    issues,
    dinnerLogged,
    afterEveningWindow,
    isToday,
    isPast,
    isFuture,
    hasEnoughData,
    metrics: [
      { label: 'Kcal', value: formatGreetingSummaryDelta(deltaK, ' kcal', 200), tone: kcalTone },
      { label: 'Proteine', value: formatGreetingSummaryDelta(deltaP, 'g', 35), tone: proteinTone },
      { label: 'Carbo', value: formatGreetingSummaryDelta(deltaC, 'g', 40), tone: carbTone },
      { label: 'Grassi', value: formatGreetingSummaryDelta(deltaF, 'g', 15), tone: fatTone },
      { label: 'Acqua', value: `${waterCount}/${waterTarget}`, tone: waterTone },
      { label: 'Integratori', value: activeSupps.length ? `${doneSuppCount}/${activeSupps.length}` : 'Nessuno', tone: suppTone },
    ],
  };
}

function shouldShowGreetingDailySummary(dateKey, type, now = new Date(), summaryModel = null) {
  const summary = summaryModel || buildGreetingDailySummary(dateKey, type, now);
  if (!summary.hasEnoughData || summary.isFuture) return false;
  if (summary.isPast) return true;
  return summary.dinnerLogged || summary.afterEveningWindow;
}

function renderGreetingDailySummaryCard(summary) {
  const toneClass = summary.tone || 'ok';
  const pills = [
    `<span class="tg-summary-pill is-${toneClass}">${htmlEsc(summary.toneLabel)}</span>`,
  ];
  if (summary.cheat?.extraKcal) {
    pills.push(`<span class="tg-summary-pill is-cheat">Extra +${Math.round(summary.cheat.extraKcal)} kcal</span>`);
  }

  return `<div class="tg-summary tg-summary-compact is-${toneClass}">
    <div class="tg-summary-top">
      <div class="tg-summary-head">
        <div class="tg-summary-kicker">Riepilogo giornata</div>
        <div class="tg-summary-title">${htmlEsc(summary.headline)}</div>
      </div>
      <div class="tg-summary-pill-row">${pills.join('')}</div>
    </div>
    <div class="tg-summary-highlights">
      ${(summary.secondaryHighlights || []).map(item => `<div class="tg-summary-highlight is-${item.tone || 'soft'}">
        <span class="tg-summary-highlight-label">${htmlEsc(item.label)}</span>
        <span class="tg-summary-highlight-value">${htmlEsc(item.value)}</span>
      </div>`).join('')}
    </div>
    ${summary.closingMessage ? `<div class="tg-summary-note">${htmlEsc(summary.closingMessage)}</div>` : ''}
  </div>`;
}

// ─── Alert engine ─────────────────────────────────────────────────────────────
function supplementWindow(when) {
  const slot = String(when || '').toLowerCase();
  if (slot.includes('matt')) return { start: 8, end: 12 };
  if (slot.includes('pranzo') || slot.includes('mezz')) return { start: 12, end: 15 };
  if (slot.includes('pomer')) return { start: 15, end: 18 };
  if (slot.includes('sera') || slot.includes('notte')) return { start: 19, end: 22 };
  return { start: 8, end: 22 };
}
function supplementLabel(when) {
  const slot = String(when || '').toLowerCase();
  if (slot.includes('matt')) return 'stamattina';
  if (slot.includes('pranzo') || slot.includes('mezz')) return 'a pranzo';
  if (slot.includes('pomer')) return 'nel pomeriggio';
  if (slot.includes('sera') || slot.includes('notte')) return 'stasera';
  return 'oggi';
}
function phaseFromHour(h) {
  if (h < 8) return 'early';
  if (h < 12) return 'morning';
  if (h < 17) return 'midday';
  if (h < 20) return 'late';
  return 'end';
}
function parseMealTimeRange(timeText) {
  const text = String(timeText || '').trim();
  if (!text) return null;

  const hmMatches = [...text.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (!hmMatches.length) return null;

  const toMinutes = match => (parseInt(match[1], 10) * 60) + parseInt(match[2], 10);
  const start = toMinutes(hmMatches[0]);
  const end = hmMatches[1] ? toMinutes(hmMatches[1]) : start;

  return { start, end };
}
function mealStatus(h, dueHour, overdueHour) {
  if (h < dueHour) return 'upcoming';
  if (h < overdueHour) return 'due';
  return 'overdue';
}
function alertMealSlots(type, dayLog) {
  const meals = S.meals[type] || [];
  const slots = { breakfast: -1, lunch: -1, dinner: -1 };
  meals.forEach((meal, i) => {
    const name = String(meal?.name || '').toLowerCase();
    if (slots.breakfast === -1 && (name.includes('colazione') || name.includes('breakfast'))) slots.breakfast = i;
    if (slots.lunch === -1 && (name.includes('pranzo') || name.includes('mensa'))) slots.lunch = i;
    if (slots.dinner === -1 && name.includes('cena')) slots.dinner = i;
  });
  const hasLogForIndex = idx => idx >= 0 && Array.isArray(dayLog[idx]) && dayLog[idx].length > 0;
  return {
    loggedMealsCount: Object.values(dayLog).filter(items => Array.isArray(items) && items.length > 0).length,
    breakfastIndex: slots.breakfast,
    lunchIndex: slots.lunch,
    dinnerIndex: slots.dinner,
    hasBreakfastSlot: slots.breakfast >= 0,
    hasLunchSlot: slots.lunch >= 0,
    hasDinnerSlot: slots.dinner >= 0,
    hasBreakfast: hasLogForIndex(slots.breakfast),
    hasLunch: hasLogForIndex(slots.lunch),
    hasDinner: hasLogForIndex(slots.dinner),
  };
}
function buildAlertContext(type, h, dateKey) {
  const tgt = S.macro[type] || {};
  const tgtK = tgt.k || 0, tgtP = tgt.p || 0, tgtC = tgt.c || 0, tgtF = tgt.f || 0;
  const dayLog = S.foodLog[dateKey] || {};
  let eK = 0, eP = 0, eC = 0, eF = 0;
  Object.values(dayLog).forEach(items => {
    if (!Array.isArray(items)) return;
    items.forEach(it => {
      const g = it.grams / 100;
      eK += Math.round(it.kcal100 * g);
      eP += it.p100 * g;
      eC += it.c100 * g;
      eF += it.f100 * g;
    });
  });
  eP = Math.round(eP * 10) / 10;
  eC = Math.round(eC * 10) / 10;
  eF = Math.round(eF * 10) / 10;

  const remK = Math.round(tgtK - eK);
  const remP = Math.round((tgtP - eP) * 10) / 10;
  const remC = Math.round((tgtC - eC) * 10) / 10;
  const remF = Math.round((tgtF - eF) * 10) / 10;
  const pct = tgtK > 0 ? Math.round(eK / tgtK * 100) : 0;
  const todayStr = localDate(new Date());
  const isToday = !dateKey || dateKey === todayStr;
  const isPast = !!dateKey && dateKey < todayStr;
  const meals = alertMealSlots(type, dayLog);
  const suppChecked = (S.suppChecked && S.suppChecked[dateKey]) || [];
  const pendingSupps = (S.supplements || [])
    .filter(s => s.active)
    .filter(s => !suppChecked.includes(s.id));
  const suppDueNow = pendingSupps.filter(s => {
    const window = supplementWindow(s.when);
    return isToday && h >= window.start && h < window.end;
  });
  const suppOverdue = pendingSupps.filter(s => {
    const window = supplementWindow(s.when);
    return isToday && h >= window.end && h < 24;
  });
  const timePhase = isPast ? 'past' : phaseFromHour(h);
  const breakfastStatus = meals.hasBreakfastSlot ? mealStatus(h, 8, 11) : null;
  const lunchStatus = meals.hasLunchSlot ? mealStatus(h, 12, 15) : null;
  const dinnerStatus = meals.hasDinnerSlot ? mealStatus(h, 19, 21) : null;

  return {
    type, h, dateKey, dayLog, isToday, isPast,
    tgtK, tgtP, tgtC, tgtF,
    eK, eP, eC, eF,
    remK, remP, remC, remF, pct,
    loggedMealsCount: meals.loggedMealsCount,
    breakfastIndex: meals.breakfastIndex,
    lunchIndex: meals.lunchIndex,
    dinnerIndex: meals.dinnerIndex,
    hasBreakfastSlot: meals.hasBreakfastSlot,
    hasLunchSlot: meals.hasLunchSlot,
    hasDinnerSlot: meals.hasDinnerSlot,
    breakfastStatus,
    lunchStatus,
    dinnerStatus,
    timePhase,
    hasBreakfast: meals.hasBreakfast,
    hasLunch: meals.hasLunch,
    hasDinner: meals.hasDinner,
    suppDueNow,
    suppOverdue,
    hasFavoriteFoods: (S.favoriteFoods || []).length > 0,
  };
}
function finalizeAlerts(alerts, maxAlerts = 2) {
  const sorted = alerts.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const seenGroups = new Set();
  const out = [];
  for (const alert of sorted) {
    const group = alert.dedupeGroup || alert.id || `${alert.type}-${alert.text}`;
    if (seenGroups.has(group)) continue;
    if (alert.type === 'ok' && sorted.some(a => a !== alert && (a.type === 'warn' || a.type === 'err'))) continue;
    seenGroups.add(group);
    out.push(alert);
    if (out.length >= maxAlerts) break;
  }
  return out;
}
function buildCombinedDeficitAlert(ctx) {
  const deficits = [];
  if (ctx.remK > 200) deficits.push({ key: 'k', label: `${ctx.remK} kcal`, severity: ctx.remK > 350 ? 2 : 1 });
  if (ctx.remP > 25) deficits.push({ key: 'p', label: `${ctx.remP}g proteine`, severity: ctx.remP > 40 ? 2 : 1 });
  if (ctx.type === 'on' ? ctx.remC > 70 : ctx.remC > 55) {
    deficits.push({ key: 'c', label: `${ctx.remC}g carbo`, severity: ctx.remC > 100 ? 2 : 1 });
  }
  if (ctx.remF > 12) deficits.push({ key: 'f', label: `${ctx.remF}g grassi`, severity: ctx.remF > 20 ? 2 : 1 });
  if (deficits.length < 2) return null;

  const topDeficits = deficits.slice(0, 3);
  const type = topDeficits.some(d => d.severity >= 2) ? 'err' : 'warn';
  const intro = 'Sei sotto target su piu fronti';
  return {
    id: 'combined-deficit',
    type,
    icon: '📉',
    priority: 72,
    dedupeGroup: 'macro-recovery',
    text: `${intro}: ${topDeficits.map(d => d.label).join(' · ')}`,
    hasSuggest: true,
    remK: Math.max(0, ctx.remK),
    remP: Math.max(0, ctx.remP),
    remC: Math.max(0, ctx.remC),
    remF: Math.max(0, ctx.remF),
  };
}
function generateAlerts(type, h, dateKey, maxAlerts = 2) {
  const ctx = buildAlertContext(type, h, dateKey);
  if (!ctx.tgtK) return [];

  const alerts = [];

  const suppAlert = ctx.suppOverdue[0] || ctx.suppDueNow[0];
  if (suppAlert) {
    const doseStr = suppAlert.dose && suppAlert.dose !== '---' ? ` · ${suppAlert.dose}` : '';
    const isOverdue = ctx.suppOverdue.some(s => s.id === suppAlert.id);
    alerts.push({
      id: `supp-${suppAlert.id}`,
      type: 'supp',
      icon: '💊',
      priority: isOverdue ? 100 : 95,
      dedupeGroup: 'supp',
      text: isOverdue
        ? `${suppAlert.name}${doseStr} non ancora presa ${supplementLabel(suppAlert.when)}`
        : `${suppAlert.name}${doseStr} da prendere ${supplementLabel(suppAlert.when)}`,
      ctaLabel: 'Segna come presa',
      ctaAction: `toggleSuppAndReveal('${suppAlert.id}')`,
    });
  }

  if (ctx.isToday && ctx.timePhase === 'midday' && ctx.loggedMealsCount === 0) {
    alerts.push({
      id: 'no-meals',
      type: 'warn',
      icon: '🕒',
      priority: 90,
      dedupeGroup: 'meal-intake',
      text: 'Non hai ancora loggato pasti oggi',
      ctaLabel: 'Apri il primo pasto',
      ctaAction: `openPianoMeals('mc-${type}-0')`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'late' && ctx.loggedMealsCount === 0) {
    alerts.push({
      id: 'too-few-meals-evening',
      type: 'err',
      icon: '🍽️',
      priority: 88,
      dedupeGroup: 'meal-intake',
      text: 'Oggi non hai ancora registrato pasti',
      ctaLabel: 'Vai ai pasti',
      ctaAction: `openPianoMeals()`,
    });
  } else if (ctx.isToday && ctx.hasLunchSlot && ctx.lunchStatus === 'overdue' && !ctx.hasLunch && ctx.loggedMealsCount > 0 && ctx.timePhase !== 'late' && ctx.timePhase !== 'end') {
    alerts.push({
      id: 'missing-lunch',
      type: 'warn',
      icon: '🍽️',
      priority: 82,
      dedupeGroup: 'meal-intake',
      text: 'Pranzo non ancora registrato',
      ctaLabel: 'Vai al pranzo',
      ctaAction: `openPianoMeals('mc-${type}-${ctx.lunchIndex}')`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'midday' && ctx.loggedMealsCount > 0 && ctx.pct < 25) {
    alerts.push({
      id: 'low-intake-midday',
      type: 'warn',
      icon: '⚠️',
      priority: 75,
      dedupeGroup: 'meal-intake',
      text: `Apporto ancora basso per quest'ora: ${ctx.eK} kcal finora`,
      ctaLabel: 'Vai al prossimo pasto',
      ctaAction: `openPianoMeals()`,
    });
  } else if (ctx.isToday && ctx.timePhase === 'late' && ctx.loggedMealsCount <= 1 && ctx.pct < 45) {
    alerts.push({
      id: 'low-intake-late',
      type: 'warn',
      icon: '⚠️',
      priority: 78,
      dedupeGroup: 'meal-intake',
      text: `Giornata ancora indietro: ${ctx.eK} kcal e ${ctx.loggedMealsCount} past${ctx.loggedMealsCount === 1 ? 'o' : 'i'} loggati`,
      ctaLabel: 'Completa il prossimo pasto',
      ctaAction: `openPianoMeals()`,
    });
  }

  if (ctx.isPast || ctx.timePhase === 'end') {
    if (ctx.loggedMealsCount <= 1 && ctx.remK > 250) {
      alerts.push({
        id: 'too-few-meals-evening',
        type: ctx.loggedMealsCount === 0 ? 'err' : 'warn',
        icon: '🍽️',
        priority: 85,
        dedupeGroup: 'evening-intake',
        text: ctx.loggedMealsCount === 0
          ? 'Fine giornata senza pasti loggati'
          : `Hai loggato solo ${ctx.loggedMealsCount} pasto oggi`,
      });
    }

    const combinedDeficitAlert = buildCombinedDeficitAlert(ctx);
    if (combinedDeficitAlert) {
      alerts.push(combinedDeficitAlert);
    } else if (ctx.remP > 25) {
      alerts.push({
        id: 'low-protein',
        type: ctx.remP > 40 ? 'err' : 'warn',
        icon: '🥩',
        priority: 70,
        dedupeGroup: 'macro-recovery',
        text: `Proteine basse: mancano ${ctx.remP}g`,
        hasSuggest: true,
        remK: Math.max(0, ctx.remK),
        remP: ctx.remP,
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    }
    if (ctx.type === 'on' && ctx.remC > 70 && ctx.remP <= 25) {
      alerts.push({
        id: 'low-carbs-on',
        type: 'warn',
        icon: '🍚',
        priority: 65,
        dedupeGroup: 'macro-recovery',
        text: `Carboidrati bassi per un giorno Workout: mancano ${ctx.remC}g`,
        hasSuggest: true,
        remK: Math.max(0, ctx.remK),
        remP: Math.max(0, ctx.remP),
        remC: ctx.remC,
        remF: Math.max(0, ctx.remF),
      });
    }
    if (!combinedDeficitAlert && ctx.remK > 350) {
      alerts.push({
        id: 'low-kcal-err',
        type: 'err',
        icon: '🔥',
        priority: 55,
        dedupeGroup: 'energy-recovery',
        text: `Sei sotto target di ${ctx.remK} kcal`,
        hasSuggest: true,
        remK: ctx.remK,
        remP: Math.max(0, ctx.remP),
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    } else if (!combinedDeficitAlert && ctx.remK > 200) {
      alerts.push({
        id: 'low-kcal-warn',
        type: 'warn',
        icon: '🔥',
        priority: 50,
        dedupeGroup: 'energy-recovery',
        text: `Sei ancora sotto target di ${ctx.remK} kcal`,
        hasSuggest: true,
        remK: ctx.remK,
        remP: Math.max(0, ctx.remP),
        remC: Math.max(0, ctx.remC),
        remF: Math.max(0, ctx.remF),
      });
    }

    if (ctx.remK < -450) {
      alerts.push({
        id: 'surplus-err',
        type: 'err',
        icon: '⚠️',
        priority: 52,
        dedupeGroup: 'surplus',
        text: `Sei sopra target di ${Math.abs(ctx.remK)} kcal`,
      });
    } else if (ctx.remK < -250) {
      alerts.push({
        id: 'surplus-warn',
        type: 'warn',
        icon: '⚠️',
        priority: 48,
        dedupeGroup: 'surplus',
        text: `Leggero surplus: +${Math.abs(ctx.remK)} kcal`,
      });
    }

    if (ctx.pct >= 93 && Math.abs(ctx.remP) <= 15 && Math.abs(ctx.remK) <= 150) {
      alerts.push({
        id: 'day-centered',
        type: 'ok',
        icon: '✅',
        priority: 10,
        dedupeGroup: 'success',
        text: 'Giornata centrata: target quasi perfetto',
      });
    }
  }

  return finalizeAlerts(alerts, maxAlerts);
}

function summarizeAlertNames(items, max = 2) {
  const names = [];
  const seen = new Set();
  items.forEach(item => {
    const name = String(item?.name || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  });
  if (!names.length) return '';
  if (names.length <= max) return names.join(' · ');
  return `${names.slice(0, max).join(' · ')} · +${names.length - max}`;
}

function buildSupportAlertGroups(type, dateKey) {
  const hour = new Date().getHours();
  const ctx = buildAlertContext(type, hour, dateKey);
  const rawAlerts = generateAlerts(type, hour, dateKey, Infinity);
  const groups = [];

  const supplementMap = new Map();
  [...ctx.suppOverdue, ...ctx.suppDueNow].forEach(supp => {
    if (!supplementMap.has(supp.id)) supplementMap.set(supp.id, supp);
  });
  const supplementItems = Array.from(supplementMap.values());
  if (supplementItems.length) {
    const firstSupp = supplementItems[0];
    const suppText = supplementItems.length === 1
      ? `${firstSupp.name}${firstSupp.dose && firstSupp.dose !== '---' ? ` · ${firstSupp.dose}` : ''} da segnare`
      : `${supplementItems.length} integratori da segnare: ${summarizeAlertNames(supplementItems, 2)}`;
    groups.push({
      id: 'support-supp',
      type: 'supp',
      icon: '💊',
      priority: ctx.suppOverdue.length ? 100 : 95,
      text: suppText,
      ctaLabel: 'Segna ora',
      ctaAction: `revealTodaySupplement('${firstSupp.id}')`,
    });
  }

  const trackingIds = new Set(['no-meals', 'missing-lunch', 'low-intake-midday', 'low-intake-late', 'too-few-meals-evening']);
  const trackingAlerts = rawAlerts.filter(alert => trackingIds.has(alert.id));
  if (trackingAlerts.length) {
    const trackingType = trackingAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn';
    let trackingText = 'Sei indietro con i pasti di oggi';
    if (trackingAlerts.some(alert => alert.id === 'no-meals')) {
      trackingText = 'Non hai ancora registrato pasti oggi';
    } else if (trackingAlerts.some(alert => alert.id === 'missing-lunch')) {
      trackingText = 'Ti manca ancora il pranzo';
    } else if (trackingAlerts.some(alert => alert.id === 'too-few-meals-evening')) {
      trackingText = ctx.loggedMealsCount === 0
        ? 'Oggi non hai ancora registrato pasti'
        : `Hai registrato solo ${ctx.loggedMealsCount} ${ctx.loggedMealsCount === 1 ? 'pasto' : 'pasti'}`;
    } else if (trackingAlerts.some(alert => alert.id === 'low-intake-late')) {
      trackingText = `Per quest'ora hai registrato poco: ${ctx.eK} kcal`;
    } else if (trackingAlerts.some(alert => alert.id === 'low-intake-midday')) {
      trackingText = `Per ora hai registrato solo ${ctx.eK} kcal`;
    }
    groups.push({
      id: 'support-tracking',
      type: trackingType,
      icon: trackingAlerts[0]?.icon || '🍽️',
      priority: Math.max(...trackingAlerts.map(alert => alert.priority || 0), 80),
      text: trackingText,
      ctaLabel: 'Vai ai pasti',
      ctaAction: `openPianoMeals()`,
    });
  }

  const macroIds = new Set(['combined-deficit', 'low-protein', 'low-carbs-on', 'low-kcal-err', 'low-kcal-warn']);
  const macroAlerts = rawAlerts.filter(alert => macroIds.has(alert.id));
  if (macroAlerts.length) {
    const macroParts = [];
    if (ctx.remK > 200) macroParts.push(`-${ctx.remK} kcal`);
    if (ctx.remP > 20) macroParts.push(`-${ctx.remP}g proteine`);
    if ((ctx.type === 'on' && ctx.remC > 45) || (ctx.type !== 'on' && ctx.remC > 55)) macroParts.push(`-${ctx.remC}g carbo`);
    if (ctx.remF > 12) macroParts.push(`-${ctx.remF}g grassi`);
    groups.push({
      id: 'combined-deficit',
      type: macroAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn',
      icon: '📉',
      priority: Math.max(...macroAlerts.map(alert => alert.priority || 0), 72),
      text: macroParts.length ? `Ti mancano ancora ${macroParts.slice(0, 3).join(' · ')}` : 'Sei ancora sotto target su piu macro',
      hasSuggest: true,
      remK: Math.max(0, ctx.remK),
      remP: Math.max(0, ctx.remP),
      remC: Math.max(0, ctx.remC),
      remF: Math.max(0, ctx.remF),
    });
  }

  const surplusAlerts = rawAlerts.filter(alert => alert.id === 'surplus-err' || alert.id === 'surplus-warn');
  if (surplusAlerts.length) {
    groups.push({
      id: surplusAlerts[0].id,
      type: surplusAlerts.some(alert => alert.type === 'err') ? 'err' : 'warn',
      icon: '⚠️',
      priority: Math.max(...surplusAlerts.map(alert => alert.priority || 0), 48),
      text: `Sei sopra il target di ${Math.abs(ctx.remK)} kcal`,
    });
  }

  if (!groups.length) {
    const okAlert = rawAlerts.find(alert => alert.id === 'day-centered');
    if (okAlert) groups.push(okAlert);
  }

  return groups.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function splitTodayAlerts(type, dateKey) {
  const hour = new Date().getHours();
  const alerts = generateAlerts(type, hour, dateKey, Infinity);
  const orderedAlerts = buildSupportAlertGroups(type, dateKey);
  const resolveAction = alert => {
    if (!alert) return '';
    if (String(alert.id || '').startsWith('supp-')) {
      const suppId = alert.id.replace(/^supp-/, '');
      return `revealTodaySupplement('${suppId}')`;
    }
    if (alert.ctaAction) return alert.ctaAction;
    if (alert.hasSuggest) {
      return `openFoodSuggestion(${alert.remK||0},${alert.remP||0},${alert.remC||0},${alert.remF||0})`;
    }
    return '';
  };
  const supportAlerts = orderedAlerts.filter(a => a.type === 'supp' || String(a.id || '').startsWith('supp-'));
  const focusIds = new Set(['no-meals', 'missing-lunch', 'low-intake-midday', 'low-intake-late', 'too-few-meals-evening']);
  const focusAlerts = alerts.filter(a => focusIds.has(a.id));
  const statusAlerts = alerts.filter(a => a.type === 'ok');
  const signals = [...orderedAlerts, ...statusAlerts].slice(0, 2).map(alert => ({
    tone: alert.type === 'err' || alert.type === 'supp' ? 'err' : alert.type === 'warn' ? 'warn' : 'ok',
    text: alert.type === 'supp'
      ? 'Integratore da segnare'
      : alert.id === 'day-centered'
        ? 'Giornata in linea'
        : alert.text,
    action: resolveAction(alert),
  }));

  return {
    orderedAlerts,
    signals,
    focusAlert: focusAlerts[0] || null,
    supportAlert: supportAlerts[0] || null,
  };
}

// ─── Suggerimento cibo intelligente ──────────────────────────────────────────
function suggestFood(remK, remP, remC, remF) {
  const foods = S.favoriteFoods || [];
  if (!foods.length) return null;

  const protPriority = remP > 20;
  const carbPriority = remC > 50 && !protPriority;

  const scored = foods.map(f => {
    const typK = Math.round(f.kcal100 * f.typicalGrams / 100);
    let score = 0;
    if (protPriority)      score = (f.p100 / Math.max(f.kcal100, 1)) * 100;
    else if (carbPriority) score = (f.c100 / Math.max(f.kcal100, 1)) * 100;
    else                   score = 100 - Math.abs(typK - remK / 2) / Math.max(remK, 1) * 100;
    return { ...f, score, typK };
  }).sort((a, b) => b.score - a.score);

  const picks = [];
  let cumK = 0;
  for (const f of scored) {
    if (picks.length >= 2) break;
    let grams = f.typicalGrams;
    // Scala la porzione se serve per non sforare troppo
    if (f.typK > 0 && remK > 0 && cumK + f.typK > remK * 1.2) {
      grams = Math.max(20, Math.round((remK - cumK) * 100 / f.kcal100 / 10) * 10);
    }
    const k = Math.round(f.kcal100 * grams / 100);
    const p = Math.round(f.p100 * grams / 100 * 10) / 10;
    const c = Math.round(f.c100 * grams / 100 * 10) / 10;
    if (k <= 0) continue;
    picks.push({ ...f, grams, k, p, c });
    cumK += k;
    if (cumK >= remK * 0.8 && remK > 0) break;
  }

  if (!picks.length) return null;
  const totalK = picks.reduce((s, p) => s + p.k, 0);
  const totalP = Math.round(picks.reduce((s, p) => s + p.p, 0) * 10) / 10;
  const totalC = Math.round(picks.reduce((s, p) => s + p.c, 0) * 10) / 10;
  return { picks, totalK, totalP, totalC };
}

function streakBadgeStyle(streak) {
  if (streak >= 100) return { emoji: '🏆', tier: 'legend' };
  if (streak >= 30)  return { emoji: '🌟', tier: 'elite' };
  if (streak >= 7)   return { emoji: '🔥', tier: 'hot' };
  if (streak > 0)    return { emoji: '🔥', tier: 'warm' };
  return { emoji: '🔥', tier: 'idle' };
}

function renderGreetingAlerts(type, dateKey) {
  const model = splitTodayAlerts(type, dateKey);
  const alerts = model.orderedAlerts || [];
  if (!alerts.length) return '';
  return `<div class="tg-alerts-list">
    ${alerts.map((alert, idx) => renderTodayAlertHTML(alert, {
      compact: true,
      idx,
      supportMode: true,
      eyebrow: idx === 0 ? 'Da gestire ora' : 'Da controllare',
      className: 'today-context-alert-hero'
    })).join('')}
  </div>`;
}

function renderGreeting(type, now) {
  const greetingEl = document.getElementById('today-greeting');
  if (!greetingEl) return;
  const DAYS   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                  'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const dateKey = S.selDate || localDate(now);
  const resolvedType = getTrackedDayType(dateKey, type || getScheduledDayType(dateKey));
  const viewDate = new Date(`${dateKey}T12:00:00`);
  const isTodayView = dateKey === localDate(now);
  const h = now.getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const profiloRows = Array.isArray(S.profilo) ? S.profilo : [];
  const nomeCompleto = S.anagrafica?.nome || profiloRows.find(r=>r.l==='Nome')?.v || 'Atleta';
  const nome = nomeCompleto.split(' ')[0];

  // Aggiorna nav-sub con il nome
  const navSub = document.getElementById('nav-sub');
  if (navSub) navSub.textContent = nomeCompleto;

  // Aggiorna i tooltip BMI/BMR/TDEE (tooltip DOM rimane, non mostrato nel greeting)
  const peso = S.anagrafica?.peso || 0;
  const alt  = S.anagrafica?.altezza || 0;
  const eta  = S.anagrafica?.eta || 0;
  if (peso > 0 && alt > 0) {
    const bmi  = (peso / (alt/100)**2).toFixed(1);
    const bmiN = parseFloat(bmi);
    const bmiLbl = bmiN < 18.5 ? 'sottopeso' : bmiN < 25 ? 'normopeso' : bmiN < 30 ? 'sovrappeso' : 'obeso';
    const bmr  = S.anagrafica ? calcBMR(S.anagrafica) : null;
    const nutrition = S.anagrafica ? computeNutrition(S.anagrafica, S.goal) : null;
    const tdee = nutrition?.tdee || null;
    const bmiPct = Math.min(Math.max(((bmiN-15)/25)*100, 1), 99).toFixed(1);
    setTimeout(() => {
      const tipBmi = document.getElementById('tip-bmi');
      if (tipBmi) tipBmi.innerHTML = `<div class="tip-title">BMI · Indice di Massa Corporea</div>
        <div class="tip-desc">Rapporto peso/altezza²: <strong>${peso} / (${(alt/100).toFixed(2)})² = ${bmi}</strong> · ${bmiLbl}.<br>
        Indicatore generale, non distingue muscolo da grasso.</div>
        ${bmr ? `<div class="tip-desc" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--b1)"><strong>BMR</strong> ${bmr} kcal/die &nbsp;·&nbsp; <strong>TDEE</strong> ~${tdee} kcal/die</div>` : ''}
        <div class="bmi-ruler">
          <div class="bmi-track"><div class="bmi-needle" style="left:${bmiPct}%"></div></div>
          <div class="bmi-labels">
            <span class="bmi-label" style="left:0%">15</span><span class="bmi-label" style="left:14%">18.5</span>
            <span class="bmi-label" style="left:40%">25</span><span class="bmi-label" style="left:60%">30</span>
            <span class="bmi-label" style="left:100%">40</span>
          </div>
          <div class="bmi-zones">
            <span class="bmi-zone z-low">Sottopeso &lt;18.5</span><span class="bmi-zone z-ok">Normopeso 18.5–24.9</span>
            <span class="bmi-zone z-mid">Sovrappeso 25–29.9</span><span class="bmi-zone z-hi">Obeso ≥ 30</span>
          </div>
        </div>`;
      const tipBmr = document.getElementById('tip-bmr');
      if (tipBmr && bmr) {
        const bf = S.anagrafica?.grassoCorporeo;
        const usesKatch = bf != null && bf >= 3 && bf <= 60;
        tipBmr.innerHTML = `<div class="tip-title">BMR · Metabolismo Basale</div>
        <div class="tip-desc">Calorie bruciate a <strong>completo riposo</strong>.<br>
        ${usesKatch
          ? `Formula Katch-McArdle: <strong>370 + 21.6 × massa magra = ${bmr} kcal</strong>`
          : `Formula Mifflin-St Jeor: <strong>${S.anagrafica?.sesso === 'f' ? `10×${peso} + 6.25×${alt} − 5×${eta} − 161` : `10×${peso} + 6.25×${alt} − 5×${eta} + 5`} = ${bmr} kcal</strong>`}</div>`;
      }
      const tipTdee = document.getElementById('tip-tdee');
      if (tipTdee && tdee && nutrition) {
        const surplus = S.macro.on.k - tdee;
        const range = nutrition.tdeeRange ? `${nutrition.tdeeRange.low}–${nutrition.tdeeRange.high}` : `${tdee}`;
        tipTdee.innerHTML = `<div class="tip-title">TDEE · Fabbisogno Calorico Totale</div>
          <div class="tip-desc">(BMR + NEAT + EAT) / (1 − TEF) = <strong>~${tdee} kcal/die</strong>.<br>
          Stima iniziale realistica: <strong>${range} kcal/die</strong>.<br>
          ${nutrition.calibration?.offsetKcal ? `Auto-calibrazione 14 giorni: <strong>${nutrition.calibration.offsetKcal > 0 ? '+' : ''}${nutrition.calibration.offsetKcal} kcal</strong>.<br>` : ''}
          Il tuo piano ON (<strong>${S.macro.on.k} kcal</strong>) prevede un surplus di <strong style="color:${surplus>0?'var(--on)':'var(--red)'}"> ${surplus>0?'+':''}${surplus} kcal</strong>.</div>`;
      }
    }, 0);
  }

  // Streak badge
  const streak = calcStreak();
  const sbs = streakBadgeStyle(streak);
  const streakBadge = `<span class="tg-streak tg-streak-${sbs.tier}${streak === 0 ? ' is-zero' : ''}" onmouseenter="showTip('tip-streak',this)" onmouseleave="hideTip('tip-streak')">
    <span class="tg-streak-icon" aria-hidden="true">${sbs.emoji}</span>
    <span class="tg-streak-copy">
      <span class="tg-streak-label">${streak > 0 ? 'Continuita' : 'Continuita pronta'}</span>
      <span class="tg-streak-val">${streak} ${streak === 1 ? 'giorno' : 'giorni'}</span>
    </span>
  </span>`;
  setTimeout(() => {
    const tipStreak = document.getElementById('tip-streak');
    if (!tipStreak) return;
    if (streak > 0) {
      tipStreak.innerHTML = `<div class="tip-title">${sbs.emoji} Streak · ${streak} ${streak===1?'giorno':'giorni'} consecutivi</div>
        <div class="tip-desc">Hai registrato almeno un'attivita per <strong>${streak} ${streak===1?'giorno':'giorni'} di fila</strong>. Continua cosi!</div>`;
    } else {
      tipStreak.innerHTML = `<div class="tip-title">${sbs.emoji} Streak · pronta a partire</div>
        <div class="tip-desc">Aggiungi un cibo, segna un integratore o registra acqua oggi per accendere la tua streak.</div>`;
    }
  }, 0);

  const isOn = resolvedType === 'on';
  const dayModeLabel = isOn ? 'Workout' : 'Rest';
  // Badge fase obiettivo rimosso (tracking settimane rimandato a implementazione futura)
  let goalBadge = '';

  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  let greetingSummary = null;
  let showDailySummary = false;
  let greetingBodyHTML = renderGreetingAlerts(resolvedType, dateKey);
  try {
    greetingSummary = buildGreetingDailySummary(dateKey, resolvedType, now);
    showDailySummary = shouldShowGreetingDailySummary(dateKey, resolvedType, now, greetingSummary);
    if (showDailySummary) greetingBodyHTML = renderGreetingDailySummaryCard(greetingSummary);
  } catch (err) {
    console.error('Greeting daily summary fallback', err);
  }

  if (greetingEl) {
    greetingEl.dataset.dayState = resolvedType;
    greetingEl.classList.remove('is-on', 'is-off', 'has-cheat', 'is-on-cheat', 'is-off-cheat');
    greetingEl.classList.add(isOn ? 'is-on' : 'is-off');
    if (cheat) {
      greetingEl.classList.add('has-cheat', isOn ? 'is-on-cheat' : 'is-off-cheat');
    }
  }
  const dateLine = `${isTodayView ? 'Oggi' : 'Giornata selezionata'} · ${DAYS[viewDate.getDay()]} ${viewDate.getDate()} ${MONTHS[viewDate.getMonth()]}`;
  const cheatLine = cheat
    ? `<button class="tg-editorial-extra" onclick="focusTodayCheat()" title="Apri dettaglio sgarro">
        <span class="tg-editorial-extra-dot"></span>
        <span>Extra attivo</span>
      </button>`
    : '';
  const greetingBodyBlock = '';

  document.getElementById('today-greeting').innerHTML = `
    <div class="tg-hero-main">
      <div class="tg-hero-copy">
        <div class="tg-editorial-rail"></div>
        <div class="tg-editorial-head">
          <div class="tg-editorial-date">${htmlEsc(dateLine)}</div>
          <div class="tg-editorial-mode ${isOn ? 'is-on' : 'is-off'}">
            <span class="tg-editorial-dot"></span>
            <span>${dayModeLabel}</span>
          </div>
        </div>
        <div class="tg-compact-main">
          <div class="tg-hello">${htmlEsc(saluto)}, <em>${htmlEsc(nome)}</em></div>
        </div>
        <div class="tg-subtext">${htmlEsc(getGreetingSubtext(h, resolvedType, streak))}</div>
        <div class="tg-editorial-foot">
          <div class="tg-streak-row">${streakBadge}</div>
          ${cheatLine}
        </div>
      </div>
    </div>
    ${greetingBodyBlock}`;
}

function renderTodaySignals(type, dateKey) {
  const el = document.getElementById('today-signal-row');
  if (!el) return;
  el.innerHTML = '';
  return;
  const scheduledType = getScheduledDayType(dateKey);
  const trackedType = getTrackedDayType(dateKey, type);
  const dayModeLabel = value => value === 'on' ? 'Workout' : 'Rest';
  const dayModeIcon = value => value === 'on' ? '🏃' : '🧍';
  const scheduledKcal = S.macro?.[scheduledType]?.k || 0;
  const trackedKcal = S.macro?.[trackedType]?.k || 0;
  const hasOverride = scheduledType !== trackedType;
  const overrideMeta = hasOverride
    ? `<div class="today-signal-note">
        <div class="today-signal-primary">
          <div class="today-signal-title">Hai cambiato ritmo</div>
          <div class="today-signal-main">
            <span class="today-signal-mode is-scheduled"><span class="today-signal-mode-icon">${dayModeIcon(scheduledType)}</span><span>${dayModeLabel(scheduledType)}</span></span>
            <span class="today-signal-arrow" aria-hidden="true">→</span>
            <span class="today-signal-mode is-tracked"><span class="today-signal-mode-icon">${dayModeIcon(trackedType)}</span><span>${dayModeLabel(trackedType)}</span></span>
          </div>
          <div class="today-signal-copy">Da ${dayModeLabel(scheduledType)} a ${dayModeLabel(trackedType)}.</div>
        </div>
        <div class="today-signal-aside">
          <div>Target di oggi aggiornati di conseguenza.</div>
          <div class="today-signal-kcal">${scheduledKcal} kcal <span aria-hidden="true">→</span> ${trackedKcal} kcal</div>
        </div>
      </div>`
    : '';

  if (!hasOverride) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `<div class="today-signal-actions">
    <div class="today-signal-status">${overrideMeta}</div>
  </div>`;
}

function renderDashboardAlertSummary(type, dateKey) {
  const el = document.getElementById('today-alerts-summary');
  if (!el) return;
  el.innerHTML = '';
}

function renderTodayQuickActions(type, dateKey) {
  const el = document.getElementById('today-quick-actions');
  if (!el) return;
  const mealState = getCurrentMealState(type, dateKey);
  const hasMealFocus = mealState.index !== -1;
  const mealLabel = hasMealFocus
    ? (mealState.kind === 'now' ? 'Pasto attuale' : 'Prossimo pasto')
    : 'Apri pasti';
  const mealMeta = hasMealFocus
    ? htmlEsc(mealState.name || '')
    : 'Vai alla timeline';
  const firstActiveSupp = (S.supplements || []).find(s => s.active)?.id || null;
  const suppAction = firstActiveSupp
    ? `revealTodaySupplement('${firstActiveSupp}')`
    : `document.querySelector('.today-support-panel')?.scrollIntoView({behavior:'smooth',block:'start'})`;
  const checkedSupps = new Set((S.suppChecked?.[dateKey]) || []);
  const pendingSupps = (S.supplements || []).filter(s => s.active && !checkedSupps.has(s.id)).length;
  const mealAction = hasMealFocus
    ? `openPianoMeals('${mealState.isExtra ? `mc-extra-${mealState.key}` : `mc-${type}-${mealState.key}`}')`
    : `openPianoMeals()`;
  const waterCount = (S.water?.[dateKey]) || 0;
  const waterTarget = getWaterTargetInfo(dateKey).glasses;
  const noteValue = (S.notes?.[dateKey] || '').trim();
  el.innerHTML = `
    <div class="today-quick-actions-head support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Dashboard</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">Vai dritto al punto</div>
        </div>
        <div class="support-mini-sub today-quick-actions-sub">Pasto, acqua, routine e note sempre a un tocco.</div>
      </div>
    </div>
    <div class="today-quick-actions">
      <button class="today-quick-btn is-primary" onclick="${mealAction}">
        <span class="today-quick-ico">🍽️</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">${mealLabel}</span>
          <span class="today-quick-meta">${mealMeta}</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="addWaterAndReveal(1)">
        <span class="today-quick-ico">💧</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">+ Acqua</span>
          <span class="today-quick-meta">${waterCount}/${waterTarget} bicchieri</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="${suppAction}">
        <span class="today-quick-ico">💊</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">Routine</span>
          <span class="today-quick-meta">${pendingSupps > 0 ? `${pendingSupps} da segnare` : 'Tutto in ordine'}</span>
        </span>
      </button>
      <button class="today-quick-btn" onclick="focusTodayNotes()">
        <span class="today-quick-ico">📝</span>
        <span class="today-quick-copy">
          <span class="today-quick-label">Note</span>
          <span class="today-quick-meta">${noteValue ? 'Apri nota del giorno' : 'Scrivi promemoria'}</span>
        </span>
      </button>
    </div>`;
}

function renderSupportAlerts(type, dateKey) {
  const el = document.getElementById('today-support-alerts');
  if (!el) return;
  el.innerHTML = '';
}

function getTodayAlertTitle(alert) {
  if (!alert) return 'Supporto giornata';
  if (alert.id === 'support-supp') return 'Integratori da segnare';
  if (alert.id === 'support-tracking') return 'Pasti da registrare';
  if (alert.type === 'supp' || String(alert.id || '').startsWith('supp-')) return 'Integratore da segnare';
  switch (alert.id) {
    case 'no-meals':
      return 'Pasti non registrati';
    case 'missing-lunch':
      return 'Pranzo da registrare';
    case 'low-intake-midday':
    case 'low-intake-late':
    case 'too-few-meals-evening':
      return 'Tracking in ritardo';
    case 'combined-deficit':
      return 'Macro da recuperare';
    case 'low-protein':
      return 'Proteine da recuperare';
    case 'low-carbs-on':
      return 'Carbo da recuperare';
    case 'low-kcal-err':
    case 'low-kcal-warn':
      return 'Calorie da recuperare';
    case 'surplus-err':
    case 'surplus-warn':
      return 'Apporto sopra target';
    case 'day-centered':
      return 'Giornata in linea';
    default:
      if (alert.type === 'err') return 'Attenzione';
      if (alert.type === 'warn') return 'Da monitorare';
      return 'Supporto giornata';
  }
}

function buildTodayAlertButtons(alert, { supportMode = false, hasFavFoods = (S.favoriteFoods || []).length > 0 } = {}) {
  const buttons = [];
  if (alert?.ctaLabel && alert?.ctaAction) {
    const action = supportMode && String(alert.id || '').startsWith('supp-')
      ? `resolveSupportSupplementAlert('${String(alert.id || '').replace(/^supp-/, '')}', this)`
      : alert.ctaAction;
    buttons.push(`<button class="today-context-alert-btn" onclick="${action}">${alert.ctaLabel}</button>`);
  }
  if (alert?.hasSuggest && hasFavFoods) {
    buttons.push(`<button class="today-context-alert-btn is-secondary" onclick="openFoodSuggestion(${alert.remK||0},${alert.remP||0},${alert.remC||0},${alert.remF||0})">Vedi cosa mangiare</button>`);
  }
  return buttons;
}

function renderTodayAlertHTML(alert, { compact = false, idx = 0, supportMode = false, eyebrow, hasFavFoods = (S.favoriteFoods || []).length > 0, extraButtons = [], className = '' } = {}) {
  const buttons = [...buildTodayAlertButtons(alert, { supportMode, hasFavFoods }), ...extraButtons];
  const title = getTodayAlertTitle(alert);
  const eyebrowText = eyebrow || (compact ? (idx === 0 ? 'Priorita di oggi' : 'Da controllare') : 'Segnale del momento');
  const hasInlineAction = buttons.length === 1;
  const icon = alert?.icon || '!';
  return `
    <div class="today-context-alert${compact ? ' today-context-alert-support today-context-alert-support-compact' : ''}${className ? ` ${className}` : ''}">
      <div class="today-context-alert-shell">
        <div class="today-context-alert-icon" aria-hidden="true">${icon}</div>
        <div class="today-context-alert-content${hasInlineAction ? ' has-inline-action' : ''}">
          <div class="today-context-alert-body">
            <div class="today-context-alert-head">
              <div class="today-context-alert-kicker">${eyebrowText}</div>
              <div class="today-context-alert-title">${title}</div>
            </div>
            <div class="today-context-alert-main">${alert.text}</div>
          </div>
          ${hasInlineAction ? `<div class="today-context-alert-inline-action">${buttons[0]}</div>` : ''}
          ${buttons.length > 1 ? `<div class="today-context-alert-actions">${buttons.join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
}

function renderWeekCal(now) {
  const DOW_NAMES = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const ON_SET = new Set(S.onDays);
  const targets = [
    { title: 'cal-title', prev: 'cal-prev', next: 'cal-next', meta: 'week-cal-meta', grid: 'week-cal' },
    { title: 'piano-cal-title', prev: 'piano-cal-prev', next: 'piano-cal-next', meta: 'piano-week-cal-meta', grid: 'piano-week-cal' },
  ];

  // Monday of *current real* week
  const todayDow = now.getDay();
  const todayMonOff = todayDow === 0 ? -6 : 1 - todayDow;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + todayMonOff);
  thisMonday.setHours(0,0,0,0);

  // Monday of *displayed* week (offset by S.calOffset weeks)
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() + S.calOffset * 7);

  // Title: "17?23 Mar 2025" or "31 Mar ? 6 Apr"
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
  const mM = MONTHS_SHORT[monday.getMonth()], sM = MONTHS_SHORT[sun.getMonth()];
  const titleStr = monday.getMonth() === sun.getMonth()
    ? `${monday.getDate()}–${sun.getDate()} ${mM} ${sun.getFullYear()}`
    : `${monday.getDate()} ${mM} – ${sun.getDate()} ${sM} ${sun.getFullYear()}`;
  const todayStr = localDate(now);
  // init selDate to today if not set
  if (!S.selDate) S.selDate = todayStr;
  const dayModels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dow    = d.getDay();
    const dStr   = localDate(d);
    const isTod  = dStr === todayStr;
    const isSel  = dStr === S.selDate;
    const isPast = d < now && !isTod;
    const dayInfo = S.doneByDate[dStr];
    const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dStr) : null;
    const isFull  = !!dayInfo && dayInfo.done > 0 && dayInfo.total > 0 && dayInfo.done >= dayInfo.total;
    const hasDone = !!dayInfo && (dayInfo.activityCount || 0) > 0;
    const isPartial = hasDone && !isFull;

    // Visual type: if meals were logged for this day, use that type.
    // If no dayInfo but this is the currently viewed date, use S.day (reflects manual ON/OFF toggle).
    // Otherwise fall back to the scheduled ON/OFF from onDays.
    const scheduledOn = ON_SET.has(dow);
    const isViewedDate = dStr === (S.selDate || todayStr);
    const visualOn = dayInfo ? dayInfo.type === 'on' : (isViewedDate ? S.day === 'on' : scheduledOn);
    // Type to pass when clicking (what plan to show)
    const clickType = visualOn ? 'on' : 'off';
    const hasOverride = !!(dayInfo && dayInfo.hasTypeOverride);
    const typeLabel = visualOn ? 'Workout' : 'Rest';
    const typeLabelCompact = visualOn ? 'Work' : 'Rest';
    const overrideTitle = hasOverride
      ? `${typeLabel} scelto al posto di ${scheduledOn ? 'Workout' : 'Rest'}`
      : '';

    const cls = [
      'wc-day',
      visualOn ? 'wc-on' : 'wc-off',
      hasOverride ? 'has-override' : '',
      cheat ? 'has-cheat' : '',
      isFull ? 'is-full' : '',
      isPartial ? 'is-partial' : '',
      isTod  ? 'today' : '',
      isSel  ? 'sel'   : '',
      isPast ? 'past'  : '',
    ].filter(Boolean).join(' ');

    const doneTitle = [
      dayInfo?.total > 0 ? `${dayInfo.done}/${dayInfo.total} pasti` : '',
      dayInfo?.cheatDone > 0 ? `sgarro +${cheat?.extraKcal || 0} kcal` : '',
      dayInfo?.suppDone > 0 ? `${dayInfo.suppDone} integratori` : '',
      dayInfo?.waterCount > 0 ? `${dayInfo.waterCount} bicchieri` : '',
    ].filter(Boolean).join(' · ');

    const cellTitle = [
      d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
      typeLabel,
      hasOverride ? overrideTitle : '',
      cheat ? `Sgarro +${cheat.extraKcal || 0} kcal` : '',
      doneTitle,
    ].filter(Boolean).join(' · ');

    return {
      d,
      dStr,
      clickType,
      cls,
      isTod,
      visualOn,
      hasOverride,
      cheat,
      hasDone,
      isFull,
      isPartial,
      typeLabel,
      typeLabelCompact,
      overrideTitle,
      doneTitle,
      cellTitle,
      dowLabel: DOW_NAMES[i],
      dateNum: d.getDate(),
    };
  });

  const daysHtml = dayModels.map(day => {
    const typeRail = `<div class="wc-done ${day.visualOn ? 'workout' : 'rest'}" title="${day.typeLabel}"></div>`;
    const eventDots = [
      day.hasOverride ? `<span class="wc-marker wc-marker-override" title="${day.overrideTitle}"></span>` : '',
      day.cheat ? `<span class="wc-marker wc-marker-cheat" title="Sgarro +${day.cheat.extraKcal || 0} kcal"></span>` : '',
    ].filter(Boolean).join('');
    return `<div class="${day.cls}" data-date="${day.dStr}" data-day-type="${day.clickType}" onclick="calSelectDay('${day.dStr}','${day.clickType}')" title="${day.cellTitle}">
      ${typeRail}
      <div class="wc-top">
        <div class="wc-name">${day.dowLabel}</div>
      </div>
      <div class="wc-markers">${eventDots}</div>
      <div class="wc-num-wrap">
        <div class="wc-num">${day.dateNum}</div>
      </div>
    </div>`;
  }).join('');

  targets.forEach(target => {
    const gridEl = document.getElementById(target.grid);
    if (!gridEl) return;
    const titleEl = document.getElementById(target.title);
    if (titleEl) {
      titleEl.textContent = titleStr;
      titleEl.title = 'Scegli mese e anno';
    }
    // Prev/next buttons always enabled (no week limit)
    const prevBtn = document.getElementById(target.prev);
    const nextBtn = document.getElementById(target.next);
    if (prevBtn) prevBtn.classList.remove('disabled');
    if (nextBtn) nextBtn.classList.remove('disabled');

    const weekMetaEl = document.getElementById(target.meta);
    if (weekMetaEl) weekMetaEl.innerHTML = '';
    gridEl.innerHTML = daysHtml;
    if (typeof attachWeekCalendarSwipe === 'function') attachWeekCalendarSwipe(gridEl);
  });
}
function renderMacroStrip(type, meals, tgt) {
  const dateKey = S.selDate || localDate();
  const dayLog  = S.foodLog[dateKey] || {};
  let eK=0, eP=0, eC=0, eF=0;

  meals.forEach((_,i) => {
    const logItems = dayLog[i] || [];
    if (logItems.length) {
      logItems.forEach(it => {
        const g = it.grams/100;
        eK += Math.round(it.kcal100*g);
        eP += it.p100*g;
        eC += it.c100*g;
        eF += it.f100*g;
      });
    }
  });

  // Pasti extra opzionali
  const _activeExtra = S.extraMealsActive?.[dateKey] || {};
  Object.keys(_activeExtra).forEach(xKey => {
    (dayLog[xKey] || []).forEach(it => {
      const g = it.grams / 100;
      eK += Math.round(it.kcal100 * g);
      eP += it.p100 * g;
      eC += it.c100 * g;
      eF += it.f100 * g;
    });
  });

  eP=Math.round(eP*10)/10;
  eC=Math.round(eC*10)/10;
  eF=Math.round(eF*10)/10;

  let cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  let cheatChanged = false;
  if (typeof reconcileAutoCheatMeal === 'function') {
    const reconciliation = reconcileAutoCheatMeal(dateKey, type, eK);
    if (reconciliation) {
      cheatChanged = !!reconciliation.changed;
      cheat = reconciliation.cheat || null;
    }
  }
  const effectiveTargetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(dateKey, type)
    : tgt.k;
  const cheatExtraK = cheat?.extraKcal || 0;
  const baseTargetK = Math.max(0, tgt.k || 0);

  const el = document.getElementById('macro-strip');
  if (!el) return {eK,eP,eC,eF, cheatChanged};

  // --- Kcal hero ---
  const kPct = effectiveTargetK > 0 ? Math.min(eK / effectiveTargetK, 1) * 100 : 0;
  const kRem = effectiveTargetK - eK;
  const kOkWindow = Math.max(150, Math.round(effectiveTargetK * 0.1));
  const kRc  = Math.abs(kRem) <= kOkWindow
    ? 'ok'
    : kRem < 0
      ? (eK > effectiveTargetK * 1.15 ? 'err' : 'warn')
      : 'missing';
  const kRt  = kRem <= 0
    ? (eK > effectiveTargetK && kRc !== 'ok' ? `+${Math.round(eK - effectiveTargetK)} kcal oltre` : 'In linea con il target')
    : `${Math.abs(Math.round(kRem))} kcal mancanti`;
  const basePct = effectiveTargetK > 0 ? Math.min(baseTargetK / effectiveTargetK, 1) * 100 : 0;
  const extraPct = effectiveTargetK > 0 ? Math.min(cheatExtraK / effectiveTargetK, 1) * 100 : 0;
  const eatenPct = effectiveTargetK > 0 ? Math.min(eK / effectiveTargetK, 1) * 100 : 0;
  const redStartPct = Math.max(0, 100 - extraPct);
  const fillStyle = cheatExtraK > 0
    ? `background:
        linear-gradient(90deg,
          var(--${kRc === 'err' ? 'red' : kRc === 'warn' ? 'amber' : 'on'}) 0%,
          var(--${kRc === 'err' ? 'red' : kRc === 'warn' ? 'amber' : 'on'}) ${Math.min(eatenPct, redStartPct)}%,
          ${eK > baseTargetK ? (kRc === 'err' ? 'var(--red)' : 'var(--amber)') : 'var(--on)'} ${Math.min(eatenPct, redStartPct)}%,
          ${eK > baseTargetK ? (kRc === 'err' ? 'var(--red)' : 'var(--amber)') : 'var(--on)'} ${eatenPct}%,
          transparent ${eatenPct}%,
          transparent 100%)`
    : '';
  const cheatTailHTML = cheatExtraK > 0
    ? `<div class="ms-kcal-cheat-tail" style="left:${basePct}%;width:${extraPct}%"></div>`
    : '';

  // --- Macro 3 card ---
  const macros = [
    { cls:'prot', icon:'🥩', lbl:'Proteine', eaten:eP, tgt:tgt.p, unit:'g' },
    { cls:'carb', icon:'🍚', lbl:'Carb',     eaten:eC, tgt:tgt.c, unit:'g' },
    { cls:'fat',  icon:'🧈', lbl:'Grassi',   eaten:eF, tgt:tgt.f, unit:'g' },
  ];
  const macroCards = macros.map(m => {
    const pct = m.tgt > 0 ? Math.min(m.eaten / m.tgt, 1) * 100 : 0;
    const rem = m.tgt - m.eaten;
    const okWindow = Math.max(8, Math.round((m.tgt || 0) * 0.16));
    const rc  = Math.abs(rem) <= okWindow
      ? 'ok'
      : rem < 0
        ? (m.eaten > m.tgt * 1.22 ? 'err' : 'warn')
        : 'missing';
    const diff = Math.abs(Math.round(rem));
    const rt  = rem <= 0
      ? (m.eaten > m.tgt && rc !== 'ok' ? `+${Math.round(m.eaten - m.tgt)}g oltre` : 'Target centrato')
      : `${diff}g mancanti`;
    return `<div class="ms-macro-card ${m.cls}" onclick="openMacroDetail('${m.cls}')" title="Vedi dettaglio ${m.lbl.toLowerCase()}">
      <div class="ms-macro-top">
        <div class="ms-macro-icon">${m.icon}</div>
        <div class="ms-macro-lbl">${m.lbl}</div>
      </div>
      <div class="ms-macro-val">${m.eaten}<span class="ms-macro-unit">${m.unit}</span></div>
      <div class="ms-macro-bar"><div class="ms-macro-fill" style="width:${pct}%"></div></div>
      <div class="ms-macro-meta">
        <div class="ms-macro-target">Target ${m.tgt}${m.unit}</div>
        <div class="ms-macro-rem ${rc}">${rt}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="ms-kcal-card" onclick="openMacroDetail('kcal')" title="Vedi dettaglio calorie">
      <div class="ms-kcal-head">
        <div class="ms-kcal-kicker">Energia di oggi</div>
        <div class="ms-kcal-target-chip">Target ${effectiveTargetK.toLocaleString('it-IT')} kcal</div>
      </div>
      <div class="ms-kcal-top">
        <div class="ms-kcal-eaten">
          <span class="ms-kcal-icon">🔥</span>
          <span class="ms-kcal-val">${eK.toLocaleString('it-IT')}</span>
          <span class="ms-kcal-unit">kcal</span>
        </div>
        <div class="ms-kcal-rem ${kRc}">${kRt}</div>
      </div>
      <div class="ms-kcal-bar">
        ${cheatTailHTML}
        <div class="ms-kcal-fill ${kRc}" style="width:${kPct}%;${fillStyle}"></div>
      </div>
      <div class="ms-kcal-target">${cheat ? `Target aggiornato: <span class="ms-kcal-boost">${tgt.k.toLocaleString('it-IT')} base + ${cheat.extraKcal} sgarro</span>` : 'Il target si aggiorna in tempo reale sulla giornata attiva.'}</div>
    </div>
    <div class="ms-macros-row">${macroCards}</div>`;

  return {eK, eP, eC, eF, cheatChanged};
}
function renderCheatWidget() {
  const el = document.getElementById('cheat-widget');
  if (!el) return;
  const dateKey = S.selDate || localDate();
  const dayType = getTrackedDayType(dateKey, getScheduledDayType(dateKey));
  const cheat = typeof getCheatMealForDate === 'function' ? getCheatMealForDate(dateKey) : null;
  const weeklyCount = typeof getWeekCheatCount === 'function' ? getWeekCheatCount(dateKey) : 0;
  const weeklyLimit = typeof getCheatWeeklyLimit === 'function' ? getCheatWeeklyLimit() : 2;
  const targetK = typeof getEffectiveKcalTarget === 'function'
    ? getEffectiveKcalTarget(dateKey, dayType)
    : (S.macro?.[dayType]?.k || 0);
  const dayTypeLabel = dayType === 'on' ? 'Workout' : 'Rest';

  if (!cheat) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  el.innerHTML = `<div class="cheat-widget support-mini-card${cheat ? ' active' : ''}" id="today-cheat-card">
    <div class="cheat-top support-mini-head">
      <div class="support-mini-head-copy">
        <div class="support-mini-kicker">Supporto aderenza</div>
        <div class="support-mini-title-row">
          <div class="support-mini-title">🔥 Margine extra</div>
          <span class="support-mini-state danger${weeklyCount >= weeklyLimit ? ' is-limit' : ''}">${weeklyCount}/${weeklyLimit} sett.</span>
        </div>
        <div class="support-mini-sub">Oggi hai superato il target base, quindi allarghiamo il margine della giornata.</div>
      </div>
    </div>
    <div class="cheat-meta">
      <span class="support-mini-chip danger">${dayTypeLabel}</span>
      <span class="cheat-meta-text">Nuovo riferimento di oggi: ${targetK.toLocaleString('it-IT')} kcal</span>
    </div>
    <div class="cheat-copy">Cosi il riepilogo resta piu realistico e semplice da leggere.</div>
    <div class="cheat-auto-note">E gia tutto salvato: tu pensa solo al resto della giornata.</div>
  </div>`;
}
function renderToday() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const now   = new Date();

  updateTodayDashboardHeading(now);
  renderGreeting(type, now);
  renderWeekCal(now);
  if (typeof attachTodaySwipe === 'function') attachTodaySwipe();
  renderTodayLog(); // dashboard + support surfaces; meal cards live in Piano
  // Notes
  const noteKey   = S.selDate || localDate(now);
  const noteInput = document.getElementById('notes-input');
  if (noteInput && !noteInput.dataset.loaded) {
    noteInput.value = S.notes[noteKey] || '';
    noteInput.dataset.loaded = '1';
    noteInput.dataset.key = noteKey;
  }
  renderNotes();
  renderCheatWidget();
  renderSuppToday();
  checkWeeklyCheckin();
}

function updateTodayDashboardHeading(now = new Date()) {
  const titleEl = document.getElementById('today-recap-title');
  const subEl = document.getElementById('today-dashboard-sub');
  if (!titleEl && !subEl) return;
  const dateKey = S.selDate || localDate(now);
  const isTodayView = dateKey === localDate(now);
  const viewDate = new Date(`${dateKey}T12:00:00`);
  const label = viewDate.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const niceLabel = label.charAt(0).toUpperCase() + label.slice(1);
  if (titleEl) titleEl.textContent = isTodayView ? 'Riepilogo' : `Riepilogo ${niceLabel}`;
  if (subEl) subEl.textContent = isTodayView
    ? 'Energia, macro e pasti in una lettura rapida.'
    : 'Energia, macro e pasti della giornata selezionata.';
}

function getCurrentMealState(type, dateKey) {
  const isTodayView = !S.selDate || S.selDate === localDate();
  if (!isTodayView) return { index: -1, kind: 'none' };

  const candidates = getMealTimelineCandidates(type, dateKey);

  const nowMins = new Date().getHours()*60 + new Date().getMinutes();
  for (const candidate of candidates) {
    const range = parseMealTimeRange(candidate.time);
    if (!range) continue;
    if (nowMins >= range.start - 15 && nowMins <= range.end + 90) return { ...candidate, kind: 'now' };
  }

  let nextCandidate = null;
  let minDiff = Infinity;
  for (const candidate of candidates) {
    const range = parseMealTimeRange(candidate.time);
    if (!range) continue;
    if (range.start > nowMins && range.start - nowMins < minDiff) {
      minDiff = range.start - nowMins;
      nextCandidate = candidate;
    }
  }
  return nextCandidate ? { ...nextCandidate, kind: 'next' } : { index: -1, kind: 'none' };
}

function buildTodayPrimaryMealAction(type, mealState, dateKey) {
  const meals = S.meals?.[type] || [];
  const dayLog = S.foodLog?.[dateKey] || {};
  const isTodayView = !S.selDate || S.selDate === localDate();
  const completion = typeof getDayCompletion === 'function'
    ? getDayCompletion(dateKey, type)
    : { done: 0, total: meals.length || 0 };
  const firstIncompleteIdx = meals.findIndex((_, idx) => !(dayLog[idx] || []).length);
  let selected = null;

  if (mealState && mealState.kind !== 'none' && mealState.key != null) {
    selected = { key: mealState.key, isExtra: !!mealState.isExtra, kind: mealState.kind };
  } else if (firstIncompleteIdx >= 0) {
    selected = { key: firstIncompleteIdx, isExtra: false, kind: isTodayView ? 'todo' : 'selected' };
  } else if (meals.length) {
    selected = { key: Math.max(0, meals.length - 1), isExtra: false, kind: 'done' };
  }

  if (!selected) return null;

  const extraDef = selected.isExtra ? EXTRA_MEALS[selected.key] : null;
  const meal = selected.isExtra ? extraDef : (meals[selected.key] || {});
  const mealName = meal?.name || (selected.isExtra ? 'Pasto extra' : 'Pasto');
  const mealTime = meal?.time || '';
  const logItems = dayLog[selected.key] || [];
  const logged = logItems.reduce((acc, it) => {
    const g = (Number(it.grams || 0) || 0) / 100;
    return {
      kcal: acc.kcal + Math.round((Number(it.kcal100 || 0) || 0) * g),
      p: Math.round((acc.p + (Number(it.p100 || 0) || 0) * g) * 10) / 10,
      c: Math.round((acc.c + (Number(it.c100 || 0) || 0) * g) * 10) / 10,
      f: Math.round((acc.f + (Number(it.f100 || 0) || 0) * g) * 10) / 10,
    };
  }, { kcal: 0, p: 0, c: 0, f: 0 });
  const plan = selected.isExtra
    ? { kcal: 0, p: 0, c: 0, f: 0 }
    : (typeof mealMacros === 'function' ? mealMacros(meal) : { kcal: meal?.kcal || 0, p: meal?.p || 0, c: meal?.c || 0, f: meal?.f || 0 });
  const mealType = typeof getMealTypeFromName === 'function'
    ? getMealTypeFromName(mealName)
    : '';
  const templateMatches = typeof getMealTemplateMatches === 'function'
    ? getMealTemplateMatches(mealType)
    : [];
  const domKey = selected.isExtra ? `extra-${selected.key}` : `${type}-${selected.key}`;
  const statusLabel = selected.kind === 'now'
    ? 'Adesso'
    : selected.kind === 'next'
      ? 'Prossimo'
      : selected.kind === 'done'
        ? 'Completato'
        : isTodayView ? 'Da fare' : 'Giornata selezionata';
  const foodCount = logItems.length;
  const progressPct = plan.kcal > 0 ? Math.min(100, Math.round(logged.kcal / plan.kcal * 100)) : (foodCount ? 100 : 0);
  const remainingKcal = plan.kcal ? Math.max(0, Math.round(plan.kcal - logged.kcal)) : 0;
  const summary = foodCount
    ? `${foodCount} ${foodCount === 1 ? 'alimento' : 'alimenti'} registrati`
    : 'Nessun alimento registrato';
  const targetSummary = plan.kcal
    ? `${logged.kcal} / ${Math.round(plan.kcal)} kcal${remainingKcal ? ` · ${remainingKcal} mancanti` : ''}`
    : `${logged.kcal} kcal registrate`;

  return {
    ...selected,
    domKey,
    mealName,
    mealTime,
    mealType,
    statusLabel,
    summary,
    targetSummary,
    logged,
    plan,
    progressPct,
    templateCount: templateMatches.length,
    completion,
  };
}

function renderCurrentMealFocus(type, mealState, dateKey, alertModel = null) {
  const el = document.getElementById('current-meal-focus');
  if (!el) return;
  const action = buildTodayPrimaryMealAction(type, mealState, dateKey);
  if (!action) {
    el.innerHTML = '';
    el.style.display = 'none';
    el.className = 'current-meal-focus';
    return;
  }
  el.style.display = '';
  el.className = `current-meal-focus ${action.kind || 'todo'}`;
  const templateBtn = action.templateCount
    ? `<button class="current-meal-secondary" onclick="openMealTemplatePicker('${encInlineArg(dateKey)}','${encInlineArg(action.key)}','${encInlineArg(action.mealType || '')}','${encInlineArg(action.mealName)}');event.stopPropagation()">Template</button>`
    : `<button class="current-meal-secondary" onclick="goView('piano');event.stopPropagation()">Pasto</button>`;
  const mealIcon = action.mealType === 'colazione' ? '🥣'
    : action.mealType === 'pranzo' ? '🍽️'
      : action.mealType === 'cena' ? '🌙'
        : action.isExtra ? '🍎' : '🍽️';
  const metaLine = `${action.mealTime ? `${action.mealTime} · ` : ''}${action.summary}`;
  const planKcal = Math.round(action.plan.kcal || 0);
  const kcalLine = planKcal
    ? `${action.logged.kcal}/${planKcal}`
    : `${action.logged.kcal}`;
  el.innerHTML = `
    <div class="current-meal-primary">
      <div class="current-meal-primary-top">
        <div class="current-meal-eyebrow">Log rapido</div>
        <span class="current-meal-pill ${action.kind}">${action.statusLabel}</span>
      </div>
      <div class="current-meal-primary-main">
        <div class="current-meal-icon">${mealIcon}</div>
        <div class="current-meal-copy">
          <div class="current-meal-title">${htmlEsc(action.mealName)}</div>
          <div class="current-meal-meta">${htmlEsc(metaLine)}</div>
        </div>
        <div class="current-meal-kcal">
          <strong>${htmlEsc(kcalLine)}</strong>
          <span>kcal</span>
        </div>
      </div>
      <div class="current-meal-meter">
        <div class="current-meal-meter-bar"><div style="width:${action.progressPct}%"></div></div>
        <div class="current-meal-meter-foot">${htmlEsc(action.targetSummary)}</div>
      </div>
      <div class="current-meal-actions">
        <button class="current-meal-btn current-meal-btn-main" onclick="toggleLogSearch('${action.domKey}');event.stopPropagation()">
          <span class="current-meal-plus">+</span>
          <span>Aggiungi alimento</span>
        </button>
        ${templateBtn}
      </div>
    </div>`;
}

// Partial render ? only what changes when log items are added/removed
// Skips greeting and calendar (expensive, unnecessary for log changes)
function renderTodayLog() {
  const type  = S.day;
  const meals = S.meals[type];
  const tgt   = S.macro[type];
  const dateKey = S.selDate || localDate();
  const {eK, eP, eC, eF, cheatChanged} = renderMacroStrip(type, meals, tgt);
  renderCheatWidget();
  renderWater();

  // Determine current meal index based on time (only for today's view)
  const mealState = getCurrentMealState(type, dateKey);
  const currentMealIdx = mealState.isExtra ? -1 : mealState.key;
  const alertModel = splitTodayAlerts(type, dateKey);

  const _visibleExtra = getVisibleExtraMealKeys(dateKey);
  let _mealsHTML = '';
  meals.forEach((_, i) => {
    _mealsHTML += mealCardHTML(type, i, 'today', i === currentMealIdx, mealState.kind);
    if (i === 0) {
      _mealsHTML += _visibleExtra.has('merenda')
        ? extraMealCardHTML('merenda', dateKey)
        : extraMealAddBtnHTML('merenda', 'Merenda');
    }
    if (i === meals.length - 1) {
      _mealsHTML += _visibleExtra.has('spuntino')
        ? extraMealCardHTML('spuntino', dateKey)
        : extraMealAddBtnHTML('spuntino', 'Spuntino');
    }
  });
  const mealsEl = document.getElementById('meals-today');
  if (mealsEl) mealsEl.innerHTML = _mealsHTML;
  renderCurrentMealFocus(type, mealState, dateKey, alertModel);
  renderDashboardAlertSummary(type, dateKey);
  renderTodaySignals(type, dateKey);
  renderSupportAlerts(type, dateKey);

  // Progress: count meals with at least one logged item
  const completion = getDayCompletion(dateKey, type);
  const dpLabel = document.getElementById('dp-label');
  const dpFill  = document.getElementById('dp-fill');
  if (dpLabel) dpLabel.textContent = `${completion.done} su ${completion.total} completati`;
  if (dpFill)  dpFill.style.width  = `${completion.total ? (completion.done/completion.total)*100 : 0}%`;
  if (cheatChanged) refreshTodayDerivedViews({ greeting: true, calendar: true, stats: true });
}
function renderNotes() {
  const entries = Object.entries(S.notes)
    .filter(([,v]) => v && v.trim())
    .sort((a,b) => b[0].localeCompare(a[0])).slice(0, 20);
  const el = document.getElementById('notes-prev');
  if (!el) return;
  if (!entries.length) {
    el.innerHTML = `<div class="notes-empty-state">Ancora nessuna nota. Scrivi qui quello che vuoi ritrovare piu tardi.</div>`;
    return;
  }
  el.innerHTML = `<button class="notes-diary-btn" onclick="openNotesDiary()">Apri diario note<span>${entries.length}</span></button>`;
}
