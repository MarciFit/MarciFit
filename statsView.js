/* MarciFit Stats rendering and stats data shaping. */

function getStatsRangeBounds(range) {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  let start = new Date(end);
  let label = 'Ultimi 30 giorni';

  if (range === '7d') {
    start.setDate(end.getDate() - 6);
    label = 'Ultimi 7 giorni';
  } else if (range === '30d') {
    start.setDate(end.getDate() - 29);
    label = 'Ultimi 30 giorni';
  } else if (range === '8w') {
    start.setDate(end.getDate() - 55);
    label = 'Ultime 8 settimane';
  } else {
    label = 'Panoramica completa';
    const candidates = [];
    (S.weightLog || []).forEach(entry => {
      const parsed = parseWeightLogDate(entry.date);
      if (parsed) candidates.push(parsed);
    });
    (S.measurements || []).forEach(entry => {
      if (entry?.date) candidates.push(new Date(entry.date + 'T12:00:00'));
    });
    Object.keys(S.doneByDate || {}).forEach(key => candidates.push(new Date(key + 'T12:00:00')));
    start = candidates.length
      ? new Date(Math.min(...candidates.map(d => d.getTime())))
      : new Date(end);
  }

  start.setHours(12, 0, 0, 0);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return { range, label, start, end, days };
}

function getPreviousRangeBounds(bounds) {
  if (!bounds || bounds.range === 'all') return null;
  const prevEnd = new Date(bounds.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(12, 0, 0, 0);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (bounds.days - 1));
  prevStart.setHours(12, 0, 0, 0);
  return { start: prevStart, end: prevEnd, days: bounds.days };
}

function getWeightEntriesForBounds(bounds) {
  return (S.weightLog || [])
    .map((entry, idx) => {
      const dt = parseWeightLogDate(entry.date);
      return dt ? {
        ...entry,
        srcIndex: idx,
        dt,
        dateKey: localDate(dt),
        shortLabel: String(entry.date || '').slice(0, 5),
      } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dt - b.dt)
    .filter(entry => entry.dt >= bounds.start && entry.dt <= bounds.end);
}

function getRollingWeightValues(entries, windowSize = 3) {
  return entries.map((entry, idx) => {
    const slice = entries.slice(Math.max(0, idx - windowSize + 1), idx + 1);
    return {
      dt: entry.dt,
      val: slice.reduce((sum, item) => sum + item.val, 0) / slice.length,
    };
  });
}

function getCompletionStatsForBounds(bounds) {
  let activeDays = 0;
  let fullDays = 0;
  let partialDays = 0;
  let emptyDays = 0;
  let hydrationDays = 0;
  let supplementDays = 0;
  let onDays = 0;
  let offDays = 0;
  let mealDoneTotal = 0;
  let mealTargetTotal = 0;
  let weekendActiveDays = 0;
  let weekendDays = 0;

  const cursor = new Date(bounds.start);
  while (cursor <= bounds.end) {
    const key = localDate(cursor);
    const info = S.doneByDate?.[key];
    const hasActivity = !!info?.hasActivity;
    const isFull = !!(info && info.total > 0 && info.done >= info.total);
    const trackedType = info?.type || getScheduledDayType(key);
    const dow = cursor.getDay();

    if (trackedType === 'on') onDays++;
    if (trackedType === 'off') offDays++;
    if (hasActivity) activeDays++;
    if (isFull) fullDays++;
    else if (hasActivity) partialDays++;
    else emptyDays++;
    if ((info?.waterCount || 0) > 0) hydrationDays++;
    if ((info?.suppDone || 0) > 0) supplementDays++;
    mealDoneTotal += info?.done || 0;
    mealTargetTotal += info?.total || 0;
    if (dow === 0 || dow === 6) {
      weekendDays++;
      if (hasActivity) weekendActiveDays++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDays = bounds.days;
  return {
    totalDays,
    activeDays,
    fullDays,
    partialDays,
    emptyDays,
    adherenceRate: totalDays ? Math.round(activeDays / totalDays * 100) : 0,
    hydrationRate: totalDays ? Math.round(hydrationDays / totalDays * 100) : 0,
    supplementRate: totalDays ? Math.round(supplementDays / totalDays * 100) : 0,
    mealRate: mealTargetTotal ? Math.round(mealDoneTotal / mealTargetTotal * 100) : 0,
    weekendAdherenceRate: weekendDays ? Math.round(weekendActiveDays / weekendDays * 100) : 0,
    onDays,
    offDays,
  };
}

function getMeasurementsForBounds(bounds) {
  return (S.measurements || [])
    .map((entry, idx) => ({
      ...entry,
      _idx: idx,
      _dt: entry?.date ? new Date(entry.date + 'T12:00:00') : null,
    }))
    .filter(entry => entry._dt && entry._dt >= bounds.start && entry._dt <= bounds.end)
    .sort((a, b) => a._dt - b._dt);
}

function getMeasurementSnapshot(entries, key) {
  const withValue = entries.filter(entry => entry[key] != null);
  if (!withValue.length) return { first: null, last: null, delta: null };
  const first = withValue[0];
  const last = withValue[withValue.length - 1];
  const delta = first !== last ? +(last[key] - first[key]).toFixed(1) : null;
  return { first, last, delta };
}

function getMeasurementReading(key, delta, phase) {
  if (delta == null) return 'serve una seconda rilevazione';
  if (Math.abs(delta) < 0.2) return 'quasi stabile nel periodo';
  if (key === 'vita' && phase === 'cut' && delta < 0) return 'segnale positivo in cut';
  if (key === 'vita' && phase === 'bulk' && delta <= 0.5) return 'vita sotto controllo';
  if (key === 'braccio' && phase === 'bulk' && delta > 0) return 'crescita moderata';
  if (key === 'petto' && delta > 0) return 'volume in aumento';
  if (delta < 0) return 'riduzione nel periodo';
  return 'variazione da monitorare';
}

function getMeasurementsInsight(phase, weightDelta, deltas) {
  const vitaDelta = deltas.vita?.delta;
  if (phase === 'cut' && (weightDelta || 0) < 0 && vitaDelta != null && vitaDelta < 0) {
    return 'Peso e vita scendono insieme nel periodo: il segnale e coerente con una perdita guidata piu dalla composizione che dal caso.';
  }
  if (phase === 'bulk' && (weightDelta || 0) > 0 && vitaDelta != null && vitaDelta <= 0.5) {
    return 'Il peso sale senza una crescita marcata della vita: per ora il bulk resta sotto controllo.';
  }
  if (vitaDelta != null && vitaDelta > 1) {
    return 'La vita sta salendo in modo piu evidente delle altre misure: e il primo punto da monitorare nel prossimo periodo.';
  }
  return 'Le misure corporee aggiungono contesto al peso: con piu rilevazioni nel range questa lettura diventera ancora piu utile.';
}

function computeStatsConsistencyScore(adherence, streak) {
  const adherencePart = Math.round((adherence?.adherenceRate || 0) * 0.55);
  const mealPart = Math.round((adherence?.mealRate || 0) * 0.2);
  const hydrationPart = Math.round((adherence?.hydrationRate || 0) * 0.1);
  const supplementPart = Math.round((adherence?.supplementRate || 0) * 0.05);
  const streakPart = Math.round((Math.min(14, Math.max(0, streak || 0)) / 14) * 100 * 0.1);
  return Math.max(0, Math.min(100, adherencePart + mealPart + hydrationPart + supplementPart + streakPart));
}

function getStatsScoreLabel(score) {
  if (score >= 85) return 'Ottimo';
  if (score >= 70) return 'Buono';
  if (score >= 55) return 'Da consolidare';
  return 'Instabile';
}

function getWeightInsight(weight, adherenceRate) {
  if (!weight.count) return 'Mancano pesate nel periodo selezionato, quindi la lettura del trend e ancora da costruire.';
  if (weight.count === 1) return 'C e una sola pesata nel periodo: utile come riferimento, ma non basta ancora per leggere un trend affidabile.';
  if (Math.abs(weight.delta || 0) < 0.3) return 'Il peso e sostanzialmente stabile nel periodo: bene se sei in mantenimento, da monitorare se vuoi un cambio piu netto.';
  if (S.goal?.phase === 'cut' && (weight.delta || 0) < 0) return 'Il peso sta scendendo in modo coerente con una fase di cut, senza oscillazioni anomale.';
  if (S.goal?.phase === 'bulk' && (weight.delta || 0) > 0) return 'Il trend e in salita e resta coerente con una fase di bulk.';
  if (adherenceRate < 45) return 'Il trend esiste, ma la costanza del periodo e troppo bassa per leggerlo con grande fiducia.';
  return 'Il peso si sta muovendo nel periodo, ma va letto insieme a misure e aderenza prima di trarre conclusioni.';
}

function getStatsHero(data) {
  const prevAdh = data.previous?.adherence?.adherenceRate ?? null;
  const adherenceTrend = prevAdh == null ? null : data.adherence.adherenceRate - prevAdh;
  const phase = S.goal?.phase || 'mantieni';
  const weightDelta = data.weight.delta || 0;

  if (!data.weight.count && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'soft',
      title: 'Costanza buona, ma trend peso ancora da costruire',
      body: 'Stai alimentando abbastanza dati di aderenza. Serve solo piu continuita nelle pesate per trasformare la tab in una lettura davvero utile.',
    };
  }
  if (phase === 'cut' && weightDelta < -0.3 && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'ok',
      title: 'Trend coerente con la fase di cut',
      body: 'Il peso si sta muovendo nella direzione attesa e il livello di aderenza sostiene il segnale.',
    };
  }
  if (phase === 'bulk' && weightDelta > 0.3 && data.adherence.adherenceRate >= 60) {
    return {
      tone: 'ok',
      title: 'Peso in crescita coerente con il bulk',
      body: 'Il periodo mostra sia movimento sul peso sia una base di costanza abbastanza solida da renderlo leggibile.',
    };
  }
  if (data.adherence.adherenceRate < 45) {
    return {
      tone: 'warn',
      title: 'Il collo di bottiglia ora e la costanza',
      body: 'Prima di interpretare troppo il fisico, conviene rendere piu regolare il comportamento quotidiano nel piano.',
    };
  }
  if (adherenceTrend != null && adherenceTrend >= 10) {
    return {
      tone: 'ok',
      title: 'Le ultime settimane mostrano piu solidita',
      body: 'L aderenza e migliorata rispetto al periodo precedente, quindi i prossimi dati avranno piu valore decisionale.',
    };
  }
  return {
    tone: 'soft',
    title: 'Panoramica stabile, con segnali da consolidare',
    body: 'La base dati e gia utile. Il prossimo salto di qualita verra da continuita nelle pesate e dal confronto con le misure corporee.',
  };
}

function getStatsDailyLogTotals(dateKey) {
  const dayLog = S.foodLog?.[dateKey] || {};
  return Object.values(dayLog).reduce((acc, items) => {
    if (!Array.isArray(items)) return acc;
    items.forEach(item => {
      const grams = Number(item?.grams || 0) / 100;
      acc.k += Math.round((Number(item?.kcal100 || 0) || 0) * grams);
      acc.p += (Number(item?.p100 || 0) || 0) * grams;
      acc.c += (Number(item?.c100 || 0) || 0) * grams;
      acc.f += (Number(item?.f100 || 0) || 0) * grams;
    });
    return acc;
  }, { k: 0, p: 0, c: 0, f: 0 });
}

function getStatsMacroSummary(bounds) {
  const days = [];
  const cursor = new Date(bounds.start);
  while (cursor <= bounds.end) {
    const key = localDate(cursor);
    const type = typeof resolveDayTypeForDate === 'function'
      ? resolveDayTypeForDate(key)
      : getTrackedDayType(key, getScheduledDayType(key));
    const totals = getStatsDailyLogTotals(key);
    const targetK = typeof getEffectiveKcalTarget === 'function'
      ? getEffectiveKcalTarget(key, type)
      : (S.macro?.[type]?.k || 0);
    const hasLog = totals.k > 0;
    const deltaK = hasLog && targetK ? Math.round(totals.k - targetK) : null;
    const isAligned = deltaK != null && Math.abs(deltaK) <= Math.max(180, Math.round(targetK * 0.12));
    days.push({
      key,
      type,
      targetK,
      totals,
      deltaK,
      hasLog,
      isAligned,
      info: S.doneByDate?.[key] || null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const loggedDays = days.filter(day => day.hasLog);
  const onLogged = loggedDays.filter(day => day.type === 'on');
  const offLogged = loggedDays.filter(day => day.type === 'off');
  const avg = list => list.length
    ? Math.round(list.reduce((sum, day) => sum + day.totals.k, 0) / list.length)
    : null;
  return {
    days,
    loggedDays: loggedDays.length,
    kcalAlignedDays: loggedDays.filter(day => day.isAligned).length,
    avgLoggedKcal: avg(loggedDays),
    avgOnKcal: avg(onLogged),
    avgOffKcal: avg(offLogged),
    onLoggedDays: onLogged.length,
    offLoggedDays: offLogged.length,
  };
}

function getStatsDataCoverage(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const measurementSnapshots = Object.values(data.measurements?.deltas || {});
  const readableMeasurementDeltas = measurementSnapshots.filter(snapshot => snapshot?.delta != null).length;
  const weightReliable = data.weight.count >= 2;
  const weightStrong = data.weight.count >= 3;
  const measuresReadable = data.measurements.count >= 2 && readableMeasurementDeltas >= 1;
  const behaviorReadable =
    data.adherence.activeDays >= Math.max(4, Math.round(data.bounds.days * 0.35))
    || data.macro.loggedDays >= Math.max(3, Math.round(data.bounds.days * 0.25));
  const recoveryReadable =
    (data.adherence.onDays + data.adherence.offDays) >= Math.max(6, Math.round(data.bounds.days * 0.45))
    && (data.adherence.activeDays >= Math.max(4, Math.round(data.bounds.days * 0.25)) || data.macro.loggedDays >= 3);
  const physicalReadable = weightReliable && measuresReadable;
  const quality = physicalReadable
    ? (weightStrong && readableMeasurementDeltas >= 2 ? 'forte' : 'utile')
    : (behaviorReadable || recoveryReadable ? 'utile' : 'iniziale');
  return {
    weightReliable,
    weightStrong,
    measuresReadable,
    readableMeasurementDeltas,
    physicalReadable,
    behaviorReadable,
    recoveryReadable,
    quality,
  };
}

function getStatsPrimaryModule(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const coverage = data.coverage || getStatsDataCoverage(range, data);
  if (coverage.physicalReadable) return 'physical';
  if (coverage.recoveryReadable && coverage.behaviorReadable) return 'recovery';
  if (coverage.behaviorReadable) return 'behavior';
  if (coverage.recoveryReadable) return 'recovery';
  return 'behavior';
}

function getStatsNextBestAction(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const coverage = data.coverage || getStatsDataCoverage(range, data);
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  if (!coverage.weightReliable) {
    return {
      title: 'Metti dentro 2-3 pesate',
      body: 'Con un minimo di continuita il fisico smette di essere rumoroso e la lettura diventa molto piu concreta.',
      ctaLabel: 'Aggiungi peso',
      onClick: `openStatsQuickAction('stats-actions-weight-form-shell','w-in')`,
      icon: '⚖️',
    };
  }
  if (!coverage.measuresReadable) {
    return {
      title: 'Completa una seconda rilevazione misure',
      body: 'Basta poco per capire se il peso si sta muovendo insieme alla composizione oppure no.',
      ctaLabel: 'Nuova rilevazione',
      onClick: 'openMeasurementEntry()',
      icon: '📏',
    };
  }
  if (data.adherence.hydrationRate <= 45 && data.adherence.activeDays >= 4) {
    return {
      title: 'Rendi piu stabile l acqua',
      body: 'Tra i segnali del periodo e il comportamento che cede per primo: sistemarlo pulisce tutto il resto.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '💧',
    };
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    return {
      title: 'Proteggi meglio il weekend',
      body: 'Il ritmo si rompe soprattutto li: basta ridurre lo scarto per dare piu stabilita a tutto il periodo.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '📅',
    };
  }
  if (alignmentRate && alignmentRate < 45) {
    return {
      title: 'Allinea meglio le kcal ai giorni attivi',
      body: 'Il comportamento c e, ma il ritmo calorico e ancora poco coerente tra giornate diverse.',
      ctaLabel: 'Torna a oggi',
      onClick: `goView('today')`,
      icon: '🔥',
    };
  }
  return {
    title: 'Rivedi il quadro e poi resta regolare',
    body: 'Hai gia abbastanza dati: adesso il vantaggio arriva dal tenere il ritmo, non dall aggiungere complessita.',
    ctaLabel: 'Apri profilo',
    onClick: `goView('profilo')`,
    icon: '🧭',
  };
}

function getStatsHeroAction(range = (S.statsRange || '30d'), primaryModule = null, resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const moduleKey = primaryModule || data.primaryModule || getStatsPrimaryModule(range, data);
  const nextAction = data.nextAction || getStatsNextBestAction(range, data);
  const moduleLabel = moduleKey === 'physical'
    ? 'peso + misure'
    : moduleKey === 'recovery'
      ? 'allenamento + recovery'
      : 'aderenza + routine';
  return {
    label: `Focus attivo: ${moduleLabel}`,
    body: `In questo periodo il segnale piu leggibile arriva da ${moduleLabel}. ${nextAction.body}`,
  };
}

function getStatsBehaviorSummary(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  if (data.adherence.activeDays < Math.max(4, Math.round(data.bounds.days * 0.25))) {
    return {
      title: 'Il ritmo c e solo a tratti',
      body: 'Prima di leggere troppo i dettagli conviene semplicemente dare piu continuita ai giorni registrati.',
      coach: 'La priorita non e essere perfetto: e rendere il periodo abbastanza leggibile da fidarti della dashboard.',
      weakestLabel: 'Giorni attivi',
      weakestValue: `${data.adherence.activeDays}/${data.adherence.totalDays}`,
      alignmentRate,
    };
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    return {
      title: 'La settimana regge, il weekend rompe il ritmo',
      body: 'Il comportamento nei giorni feriali e gia abbastanza solido: il punto vero da sistemare e il passaggio al weekend.',
      coach: 'Difendere 1-2 decisioni chiave nel weekend vale piu che inseguire la precisione ogni giorno.',
      weakestLabel: 'Weekend',
      weakestValue: `${data.adherence.weekendAdherenceRate}%`,
      alignmentRate,
    };
  }
  if (data.adherence.hydrationRate <= 45) {
    return {
      title: 'La routine piu fragile resta l acqua',
      body: 'Il resto del piano tiene meglio dell idratazione: sistemare quello rende la giornata piu pulita e prevedibile.',
      coach: 'Quando l acqua parte bene, spesso anche il resto della routine diventa piu facile da seguire.',
      weakestLabel: 'Acqua',
      weakestValue: `${data.adherence.hydrationRate}%`,
      alignmentRate,
    };
  }
  if (alignmentRate && alignmentRate < 45) {
    return {
      title: 'Le giornate ci sono, ma il ritmo kcal e ancora irregolare',
      body: 'Stai registrando abbastanza, pero le kcal restano spesso troppo lontane dal riferimento del giorno.',
      coach: 'Qui non serve piu controllo: serve una chiusura piu semplice e ripetibile nei giorni in cui resti indietro.',
      weakestLabel: 'Kcal in linea',
      weakestValue: `${alignmentRate}%`,
      alignmentRate,
    };
  }
  return {
    title: 'La routine e abbastanza leggibile',
    body: 'Il periodo mostra un comportamento gia utile da leggere: ora il margine viene dal consolidare i punti meno automatici.',
    coach: 'Quando la routine tiene, anche il fisico diventa molto piu semplice da interpretare.',
    weakestLabel: 'Giorni completi',
    weakestValue: `${data.adherence.fullDays}`,
    alignmentRate,
  };
}

function getStatsRecoverySummary(range = (S.statsRange || '30d'), resolvedData = null) {
  const data = resolvedData?.bounds ? resolvedData : getStatsRangeData(range);
  const onOffDiff = (data.macro.avgOnKcal != null && data.macro.avgOffKcal != null)
    ? data.macro.avgOnKcal - data.macro.avgOffKcal
    : null;
  const theoreticalOnPct = Math.round((S.onDays?.length || 0) / 7 * 100);
  const actualOnPct = Math.round(data.adherence.onDays / Math.max(1, data.adherence.onDays + data.adherence.offDays) * 100);
  if (onOffDiff != null && onOffDiff >= 120) {
    return {
      title: 'Workout e Rest hanno una separazione energetica leggibile',
      body: 'Le giornate di allenamento ricevono piu energia delle rest: il setup e abbastanza coerente con il ritmo settimanale.',
      coach: 'Mantieni semplice questa differenza: e uno dei segnali pratici piu utili che hai gia dentro l app.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  if (onOffDiff != null && onOffDiff < 80) {
    return {
      title: 'Workout e Rest oggi si assomigliano troppo',
      body: 'Il ritmo settimanale c e, ma dal lato kcal le giornate stanno diventando troppo piatte per aiutarti davvero.',
      coach: 'Non serve estremizzare: basta rendere un po piu netta la differenza tra allenamento e recupero.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  if (data.adherence.onDays < 2 || data.adherence.offDays < 2) {
    return {
      title: 'Il recupero e ancora poco leggibile nel periodo scelto',
      body: 'Ci sono ancora pochi giorni Workout/Rest distinti per capire se il ritmo settimanale ti sta aiutando davvero.',
      coach: 'Con qualche giornata in piu la lettura Workout/Rest diventa molto piu concreta.',
      onOffDiff,
      theoreticalOnPct,
      actualOnPct,
    };
  }
  return {
    title: 'Il ritmo allenamento-recupero e presente ma non ancora forte',
    body: 'La distribuzione settimanale e leggibile, ma il beneficio pratico dipende da quanto riesci a farla sentire anche nella routine.',
    coach: 'Qui conta piu la coerenza che la precisione: Workout e Rest devono essere diversi in modo semplice.',
    onOffDiff,
    theoreticalOnPct,
    actualOnPct,
  };
}

function getStatsPatterns(data) {
  const patterns = [];
  const weekendGap = data.adherence.adherenceRate - data.adherence.weekendAdherenceRate;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  const onOffDiff = (data.macro.avgOnKcal != null && data.macro.avgOffKcal != null)
    ? data.macro.avgOnKcal - data.macro.avgOffKcal
    : null;
  if (data.primaryModule === 'physical') {
    if ((S.goal?.phase === 'cut') && (data.weight.delta || 0) < 0 && data.measurements.deltas.vita?.delta != null && data.measurements.deltas.vita.delta < 0) {
      patterns.push('Peso e vita scendono insieme: il segnale del periodo e pulito, quindi non complicare quello che sta gia funzionando.');
    } else if ((S.goal?.phase === 'bulk') && (data.weight.delta || 0) > 0 && data.measurements.deltas.vita?.delta != null && data.measurements.deltas.vita.delta <= 0.5) {
      patterns.push('Il bulk sta salendo senza allargare troppo la vita: il setup e sotto controllo piu di quanto sembri.');
    } else {
      patterns.push('Il fisico e finalmente leggibile: usa questa finestra per confermare il trend, non per inseguire micro-correzioni ogni giorno.');
    }
  }
  if (weekendGap >= 15 && data.adherence.weekendAdherenceRate > 0) {
    patterns.push('Il punto piu chiaro da sistemare resta il weekend: difendere li il ritmo vale piu di migliorare i giorni gia solidi.');
  } else if (data.adherence.hydrationRate <= 45 && data.adherence.activeDays >= 4) {
    patterns.push('Tra i comportamenti registrati, l acqua e ancora il segnale piu instabile: e li che puoi recuperare ordine senza sforzo alto.');
  } else if (alignmentRate && alignmentRate < 45) {
    patterns.push('Stai registrando abbastanza, ma le kcal restano spesso fuori traccia: una chiusura piu semplice la sera avrebbe impatto immediato.');
  }
  if (onOffDiff != null && onOffDiff < 80 && data.primaryModule !== 'physical') {
    patterns.push('ON e OFF sono troppo simili dal lato energia: rendere piu netta quella differenza darebbe piu senso a tutto il ritmo settimanale.');
  }
  if (data.nextAction?.title) {
    patterns.push(`Priorita pratica: ${data.nextAction.title.toLowerCase()}.`);
  }
  if (!patterns.length) {
    patterns.push('La base dati e gia abbastanza coerente: il vantaggio adesso viene dal restare regolare, non dal cercare nuovi numeri.');
  }
  return [...new Set(patterns)].slice(0, 3);
}

function getStatsRangeData(range = (S.statsRange || '30d')) {
  const bounds = getStatsRangeBounds(range);
  const previousBounds = getPreviousRangeBounds(bounds);
  const weightEntries = getWeightEntriesForBounds(bounds);
  const weightVals = weightEntries.map(entry => entry.val);
  const weightCurrent = weightVals.length ? weightVals[weightVals.length - 1] : null;
  const weightStart = weightVals.length ? weightVals[0] : null;
  const weightDelta = weightVals.length > 1 ? +(weightCurrent - weightStart).toFixed(1) : null;
  const weightAverage = weightVals.length
    ? +(weightVals.reduce((sum, val) => sum + val, 0) / weightVals.length).toFixed(1)
    : null;
  const targetWeight = S.goal?.targetWeight != null ? Number(S.goal.targetWeight) : null;
  const targetDiff = (targetWeight != null && weightCurrent != null)
    ? +(weightCurrent - targetWeight).toFixed(1)
    : null;
  const adherence = getCompletionStatsForBounds(bounds);
  const previous = previousBounds ? {
    adherence: getCompletionStatsForBounds(previousBounds),
  } : null;
  const weight = {
    entries: weightEntries,
    count: weightEntries.length,
    current: weightCurrent,
    start: weightStart,
    delta: weightDelta,
    average: weightAverage,
    rolling: getRollingWeightValues(weightEntries),
    target: targetWeight,
    targetDiff,
    insight: '',
  };
  weight.insight = getWeightInsight(weight, adherence.adherenceRate);
  const avgActivePerWeek = Math.max(0, Math.min(7, Math.round(adherence.activeDays / Math.max(1, bounds.days / 7))));
  const streak = calcStreak();
  const consistencyScore = computeStatsConsistencyScore(adherence, streak);
  const macro = getStatsMacroSummary(bounds);
  const hero = getStatsHero({ bounds, weight, adherence, previous, macro });
  const measurementEntries = getMeasurementsForBounds(bounds);
  const measurementKeys = ['vita', 'fianchi', 'petto', 'braccio', 'coscia'];
  const measurements = {
    entries: measurementEntries,
    deltas: Object.fromEntries(measurementKeys.map(key => [key, getMeasurementSnapshot(measurementEntries, key)])),
  };
  measurements.count = measurementEntries.length;
  measurements.insight = getMeasurementsInsight(S.goal?.phase || 'mantieni', weight.delta, measurements.deltas);
  const data = {
    bounds,
    hero,
    weight,
    adherence,
    measurements,
    macro,
    previous,
    kpis: {
      weightValue: weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`,
      adherenceValue: `${adherence.adherenceRate}%`,
      consistencyValue: `${avgActivePerWeek}/7`,
      scoreValue: consistencyScore,
      scoreLabel: getStatsScoreLabel(consistencyScore),
    },
  };
  data.coverage = getStatsDataCoverage(range, data);
  data.primaryModule = getStatsPrimaryModule(range, data);
  data.behaviorSummary = getStatsBehaviorSummary(range, data);
  data.recoverySummary = getStatsRecoverySummary(range, data);
  data.nextAction = getStatsNextBestAction(range, data);
  data.heroAction = getStatsHeroAction(range, data.primaryModule, data);
  data.patterns = getStatsPatterns(data);
  return data;
}

function renderStatsToolbar(data) {
  const el = document.getElementById('stats-toolbar');
  if (!el) return;
  const OPTIONS = [
    { key: '7d', label: '7G' },
    { key: '30d', label: '30G' },
    { key: '8w', label: '8 SETT' },
    { key: 'all', label: 'TOTALE' },
  ];
  const focusLabel = data.primaryModule === 'physical'
    ? 'Peso e misure'
    : data.primaryModule === 'recovery'
      ? 'Allenamento e recovery'
      : 'Aderenza e routine';
  el.innerHTML = `
    <div class="stats-toolbar-card">
      <div class="stats-toolbar">
        <div class="stats-toolbar-copy support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Leggi un periodo alla volta</div>
            <span class="support-mini-state progress">${data.bounds.label}</span>
          </div>
          <div class="support-mini-sub stats-toolbar-note">In questo periodo il segnale piu utile arriva da ${focusLabel.toLowerCase()}.</div>
        </div>
        <div class="stats-toolbar-side">
          <div class="stats-toolbar-quickstats">
            <div class="stats-toolbar-stat support-mini-card">
              <span class="stats-toolbar-stat-label">Focus</span>
              <strong>${focusLabel}</strong>
            </div>
            <div class="stats-toolbar-stat support-mini-card">
              <span class="stats-toolbar-stat-label">Qualita dati</span>
              <strong>${data.coverage.quality}</strong>
            </div>
          </div>
          <div class="stats-range-chips" role="tablist" aria-label="Seleziona periodo statistiche">
            ${OPTIONS.map(opt => `
              <button class="stats-range-chip${data.bounds.range === opt.key ? ' active' : ''}" onclick="setStatsRange('${opt.key}')">${opt.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

function renderStatsHero(data) {
  const el = document.getElementById('stats-summary');
  if (!el) return;
  const toneClass = data.hero.tone === 'ok' ? ' tone-ok' : data.hero.tone === 'warn' ? ' tone-warn' : '';
  const signalLabel = data.primaryModule === 'physical'
    ? 'Fisico leggibile'
    : data.primaryModule === 'recovery'
      ? 'Recovery leggibile'
      : 'Routine leggibile';
  el.innerHTML = `
    <div class="stats-hero stats-decision-hero${toneClass}">
      <div class="stats-hero-copy">
        <div class="support-mini-kicker">Stats</div>
        <div class="stats-hero-title-row">
          <div class="stats-hero-title">${data.hero.title}</div>
        </div>
        <div class="stats-hero-body support-mini-sub">${data.hero.body}</div>
        <div class="stats-hero-meta">
          <div class="stats-hero-meta-chip">Periodo · ${data.bounds.label}</div>
          <div class="stats-hero-meta-chip">Segnale · ${signalLabel}</div>
          <div class="stats-hero-meta-chip">Qualita dati · ${data.coverage.quality}</div>
        </div>
        <div class="stats-decision-strip">
          <div class="stats-decision-strip-copy">
            <div class="stats-decision-kicker">${data.heroAction.label}</div>
            <div class="stats-decision-body">${data.heroAction.body}</div>
          </div>
          <button class="stats-head-action-btn stats-hero-action-btn" onclick="${data.nextAction.onClick}">${data.nextAction.ctaLabel}</button>
        </div>
      </div>
      <div class="stats-kpis stats-kpis-decision">
        <div class="sc-card">
          <div class="sc-kicker">Priorita</div>
          <div class="sc-val">${data.nextAction.icon}</div>
          <div class="sc-lbl">${data.nextAction.title}</div>
          <div class="sc-sub">${data.nextAction.body}</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Aderenza</div>
          <div class="sc-val${data.adherence.adherenceRate >= 70 ? ' ok' : data.adherence.adherenceRate >= 45 ? ' warn' : ' err'}">${data.kpis.adherenceValue}</div>
          <div class="sc-lbl">${data.adherence.activeDays}/${data.adherence.totalDays} giorni attivi</div>
          <div class="sc-sub">quanto il periodo e leggibile nella pratica</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Ritmo</div>
          <div class="sc-val${data.kpis.scoreValue >= 70 ? ' ok' : data.kpis.scoreValue >= 55 ? ' warn' : ' err'}">${data.kpis.scoreValue}</div>
          <div class="sc-lbl">${data.kpis.scoreLabel}</div>
          <div class="sc-sub">sintesi di costanza, acqua, pasti e routine</div>
        </div>
      </div>
    </div>`;
}

function toggleWeightLog() {
  toggleStatsSection('stats-actions-weight-log-shell', true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleStatsSection(id, forceOpen = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (forceOpen) el.classList.add('open');
  else el.classList.toggle('open');
}

function openMeasurementEntry() {
  toggleStatsSection('stats-actions-measurements-form-shell', true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('m-vita')?.focus(), 180);
}

function openStatsQuickAction(panelId, focusId = '') {
  toggleStatsSection(panelId, true);
  document.getElementById('stats-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (focusId) setTimeout(() => document.getElementById(focusId)?.focus(), 180);
}

function renderStatsPhysicalModule(data) {
  const el = document.getElementById('stats-weight');
  if (!el) return;
  const weight = data.weight;
  const vitaDelta = data.measurements.deltas.vita?.delta;
  const targetText = weight.target == null
    ? 'Aggiungi un target nel profilo per leggere meglio il trend.'
    : weight.targetDiff == null
      ? `Target impostato a ${weight.target} kg.`
      : `Distanza dal target: ${weight.targetDiff > 0 ? '+' : ''}${weight.targetDiff.toFixed(1)} kg.`;
  el.innerHTML = `
    <div class="stats-panel stats-panel-weight stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Peso + misure</div>
            <span class="support-mini-state done">segnale principale</span>
          </div>
          <div class="support-mini-sub">Qui il fisico e abbastanza popolato da dirti se il periodo sta andando nella direzione giusta.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="openStatsQuickAction('stats-actions-weight-form-shell','w-in')">Aggiungi peso</button>
          <button class="stats-inline-btn" onclick="openStatsQuickAction('stats-actions-weight-log-shell')">Cronologia peso</button>
          <button class="stats-inline-btn" onclick="openStatsQuickAction('stats-actions-measurements-log-shell')">Cronologia misure</button>
        </div>
      </div>
      <div class="stats-glance-row stats-glance-row-weight">
        <div class="stats-glance-chip"><span>Attuale</span><strong>${weight.current != null ? `${weight.current.toFixed(1)} kg` : '—'}</strong></div>
        <div class="stats-glance-chip${weight.delta != null && Math.abs(weight.delta) >= 0.3 ? ' is-accent' : ''}"><span>Trend</span><strong>${weight.delta == null ? 'n/d' : `${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} kg`}</strong></div>
        <div class="stats-glance-chip${vitaDelta != null && vitaDelta <= 0 ? ' is-accent' : ''}"><span>Vita</span><strong>${vitaDelta == null ? 'n/d' : `${vitaDelta > 0 ? '+' : ''}${vitaDelta.toFixed(1)} cm`}</strong></div>
        <div class="stats-glance-chip"><span>Rilevazioni</span><strong>${data.measurements.count}</strong></div>
      </div>
      <div class="chart-box stats-chart-box">
        <div class="stats-weight-main">
          <div class="stats-weight-chart-area">
            <canvas id="w-canvas" style="width:100%;height:180px"></canvas>
          </div>
          <div class="stats-weight-reading">
            <div class="stats-weight-reading-title">Come sta andando</div>
            <div class="stats-weight-reading-body">${weight.insight}</div>
            <div class="stats-weight-reading-note">${targetText}</div>
          </div>
        </div>
        <div class="stats-measure-strip">
          <div class="stats-measure-strip-head">
            <div class="stats-weight-reading-title">Composizione nel periodo</div>
            <button class="stats-inline-btn stats-inline-btn-soft" onclick="openMeasurementEntry()">Nuova rilevazione</button>
          </div>
          <div class="measure-cards">
            ${Object.entries({ vita:'Vita', fianchi:'Fianchi', petto:'Petto', braccio:'Braccio dx', coscia:'Coscia' }).map(([key, label]) => {
              const snapshot = data.measurements.deltas[key];
              const last = snapshot?.last?.[key];
              const delta = snapshot?.delta;
              const tone = delta == null || Math.abs(delta) < 0.2 ? '' : delta < 0 ? ' neg' : ' pos';
              return `<div class="measure-card">
                <div class="measure-card-label">${label}</div>
                <div class="measure-card-value">${last != null ? `${last.toFixed(1)} cm` : '—'}</div>
                <div class="measure-card-delta${tone}">${delta == null ? 'n/d' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} cm`}</div>
                <div class="measure-card-note">${getMeasurementReading(key, delta, S.goal?.phase || 'mantieni')}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
  drawChart(weight.entries, { targetWeight: weight.target, rolling: weight.rolling });
}

function renderStatsBehaviorModule(data, targetId = 'stats-weight') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const behavior = data.behaviorSummary;
  const alignmentRate = data.macro.loggedDays
    ? Math.round(data.macro.kcalAlignedDays / Math.max(1, data.macro.loggedDays) * 100)
    : 0;
  el.innerHTML = `
    <div class="stats-panel stats-panel-adherence stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Aderenza + routine</div>
            <span class="support-mini-state ${targetId === 'stats-weight' ? 'done' : 'pending'}">${targetId === 'stats-weight' ? 'segnale principale' : 'supporto'}</span>
          </div>
          <div class="support-mini-sub">Quando il fisico non basta ancora, qui capisci dove il piano regge e dove no.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="goView('today')">Torna a oggi</button>
        </div>
      </div>
      <div class="stats-insight-strip">
        <div class="stats-insight-title">${behavior.title}</div>
        <div class="stats-insight-body">${behavior.body}</div>
        <div class="stats-weight-reading-note">${behavior.coach}</div>
      </div>
      <div class="stats-kpis stats-kpis-adh">
        <div class="sc-card">
          <div class="sc-kicker">Completi</div>
          <div class="sc-val ok">${data.adherence.fullDays}</div>
          <div class="sc-lbl">giorni pieni</div>
          <div class="sc-sub">quelli in cui il piano ha tenuto davvero</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Kcal in linea</div>
          <div class="sc-val${alignmentRate >= 60 ? ' ok' : alignmentRate >= 40 ? ' warn' : ' err'}">${alignmentRate || 'n/d'}${alignmentRate ? '%' : ''}</div>
          <div class="sc-lbl">giorni loggati</div>
          <div class="sc-sub">quanto spesso le kcal seguono il riferimento</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">${behavior.weakestLabel}</div>
          <div class="sc-val${data.adherence.hydrationRate <= 45 ? ' warn' : ''}">${behavior.weakestValue}</div>
          <div class="sc-lbl">collo di bottiglia</div>
          <div class="sc-sub">il punto da consolidare prima degli altri</div>
        </div>
      </div>
      <div class="adherence-breakdown adherence-breakdown-rail">
        <div class="adh-chip"><span>Pasti</span><strong>${data.adherence.mealRate}%</strong></div>
        <div class="adh-chip"><span>Acqua</span><strong>${data.adherence.hydrationRate}%</strong></div>
        <div class="adh-chip"><span>Integratori</span><strong>${data.adherence.supplementRate}%</strong></div>
        <div class="adh-chip"><span>Weekend</span><strong>${data.adherence.weekendAdherenceRate}%</strong></div>
      </div>
      <div class="stats-adherence-lower">
        <div class="stats-heatmap-wrap" id="stats-heatmap"></div>
        <div class="stats-ratio-wrap" id="stats-ratio"></div>
      </div>
    </div>`;
  renderHeatmap(data);
  renderRatio(data);
}

function renderStatsRecoveryModule(data, targetId = 'stats-weight') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const recovery = data.recoverySummary;
  const onOffDiff = recovery.onOffDiff != null ? `${recovery.onOffDiff > 0 ? '+' : ''}${recovery.onOffDiff} kcal` : 'n/d';
  el.innerHTML = `
    <div class="stats-panel stats-panel-patterns stats-module-shell">
      <div class="stats-panel-head support-mini-head">
        <div class="support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Allenamento + recovery</div>
            <span class="support-mini-state ${targetId === 'stats-weight' ? 'done' : 'pending'}">${targetId === 'stats-weight' ? 'segnale principale' : 'supporto'}</span>
          </div>
          <div class="support-mini-sub">Qui leggi se i giorni Workout e Rest stanno davvero lavorando in squadra.</div>
        </div>
        <div class="stats-inline-actions">
          <button class="stats-head-action-btn" onclick="goView('today')">Torna a oggi</button>
        </div>
      </div>
      <div class="stats-insight-strip">
        <div class="stats-insight-title">${recovery.title}</div>
        <div class="stats-insight-body">${recovery.body}</div>
        <div class="stats-weight-reading-note">${recovery.coach}</div>
      </div>
      <div class="stats-kpis stats-kpis-adh">
        <div class="sc-card">
          <div class="sc-kicker">Distribuzione</div>
          <div class="sc-val">${recovery.actualOnPct}%</div>
          <div class="sc-lbl">giorni Workout reali</div>
          <div class="sc-sub">teorico ${recovery.theoreticalOnPct}% dal calendario</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Differenza kcal</div>
          <div class="sc-val${recovery.onOffDiff != null && recovery.onOffDiff >= 120 ? ' ok' : recovery.onOffDiff != null && recovery.onOffDiff < 80 ? ' warn' : ''}">${onOffDiff}</div>
          <div class="sc-lbl">ON vs OFF</div>
          <div class="sc-sub">quanto il ritmo energetico cambia davvero</div>
        </div>
        <div class="sc-card">
          <div class="sc-kicker">Completi</div>
          <div class="sc-val">${data.adherence.fullDays}</div>
          <div class="sc-lbl">giorni pieni</div>
          <div class="sc-sub">quanti giorni hanno davvero chiuso il cerchio</div>
        </div>
      </div>
      <div class="stats-adherence-lower">
        <div class="stats-heatmap-wrap" id="stats-heatmap"></div>
        <div class="stats-ratio-wrap" id="stats-ratio"></div>
      </div>
    </div>`;
  renderHeatmap(data);
  renderRatio(data);
}

function renderStatsSupportModule(data) {
  const el = document.getElementById('stats-measurements');
  if (!el) return;
  const supportModule = data.primaryModule === 'physical'
    ? (data.coverage.behaviorReadable ? 'behavior' : data.coverage.recoveryReadable ? 'recovery' : 'none')
    : data.primaryModule === 'recovery'
      ? (data.coverage.behaviorReadable ? 'behavior' : data.coverage.weightReliable ? 'teaser' : 'none')
      : (data.coverage.recoveryReadable ? 'recovery' : data.coverage.weightReliable ? 'teaser' : 'none');
  if (supportModule === 'behavior') {
    renderStatsBehaviorModule(data, 'stats-measurements');
    return;
  }
  if (supportModule === 'recovery') {
    renderStatsRecoveryModule(data, 'stats-measurements');
    return;
  }
  if (supportModule === 'teaser') {
    el.innerHTML = `
      <div class="stats-panel stats-panel-measurements stats-module-shell">
        <div class="stats-panel-head support-mini-head">
          <div class="support-mini-head-copy">
            <div class="support-mini-kicker">Stats</div>
            <div class="support-mini-title-row">
              <div class="support-mini-title">Fisico ancora leggero, ma gia vicino</div>
              <span class="support-mini-state idle">supporto</span>
            </div>
            <div class="support-mini-sub">Il peso sta iniziando a parlare, ma manca ancora abbastanza contesto per usarlo come segnale principale.</div>
          </div>
          <div class="stats-inline-actions">
            <button class="stats-head-action-btn" onclick="openStatsQuickAction('stats-actions-weight-form-shell','w-in')">Aggiungi peso</button>
            <button class="stats-inline-btn" onclick="openMeasurementEntry()">Nuova rilevazione</button>
          </div>
        </div>
        <div class="stats-glance-row">
          <div class="stats-glance-chip"><span>Pesate</span><strong>${data.weight.count}</strong></div>
          <div class="stats-glance-chip"><span>Trend</span><strong>${data.kpis.weightValue}</strong></div>
          <div class="stats-glance-chip"><span>Rilevazioni</span><strong>${data.measurements.count}</strong></div>
        </div>
        <div class="stats-weight-reading">
          <div class="stats-weight-reading-title">Lettura</div>
          <div class="stats-weight-reading-body">Un altro piccolo blocco di dati fisici basta per far salire peso e misure a segnale principale.</div>
        </div>
      </div>`;
    return;
  }
  el.innerHTML = '';
}

function renderStatsPatterns(data) {
  const el = document.getElementById('stats-patterns');
  if (!el) return;
  el.innerHTML = `
    <div class="stats-panel stats-panel-patterns">
      <div class="stats-patterns-layout">
        <div class="stats-patterns-side support-mini-head-copy">
          <div class="support-mini-kicker">Stats</div>
          <div class="support-mini-title-row">
            <div class="support-mini-title">Pattern utili</div>
            <span class="support-mini-state idle">${data.bounds.label}</span>
          </div>
          <div class="support-mini-sub">Tre segnali al massimo, tutti pensati per decidere cosa fare adesso.</div>
          <div class="stats-patterns-note">Se questa sezione diventa lunga, sta fallendo: qui devono restare solo le priorita pratiche.</div>
        </div>
        <div class="stats-patterns-main">
          <div class="pattern-card pattern-card-featured">
            <div class="pattern-card-kicker">Insight del periodo</div>
            <div class="pattern-card-stack">
              ${(data.patterns || []).map(text => `<div class="pattern-card-line">${text}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderStatsWeightLog(bounds) {
  const weightEntries = [...getWeightEntriesForBounds(bounds)].reverse();
  if (!weightEntries.length) {
    return `<div class="stats-form-note">Ancora nessuna pesata nel periodo.</div>`;
  }
  return `
    <div class="w-log open">
      <div class="w-log-title">Cronologia peso · puoi correggere o eliminare ogni riga</div>
      ${weightEntries.map((entry, ri, arr) => {
        const prev = arr[ri + 1];
        const delta = prev ? +(entry.val - prev.val).toFixed(1) : null;
        const deltaHtml = delta == null
          ? ''
          : `<span class="w-delta ${delta > 0 ? 'd-pos' : delta < 0 ? 'd-neg' : 'd-neu'}">${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg</span>`;
        return `<div class="w-log-item">
          <span class="w-log-date">${entry.date}</span>
          <span class="w-log-val">${entry.val.toFixed(1)} kg</span>
          ${deltaHtml}
          <div class="stats-row-actions">
            <button class="stats-row-btn" onclick="editWeight(${entry.srcIndex})">Modifica</button>
            <button class="stats-row-btn danger" onclick="delWeight(${entry.srcIndex})">Elimina</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderStatsActions(data) {
  const el = document.getElementById('stats-actions');
  if (!el) return;
  el.innerHTML = `
    <div class="stats-actions-card">
      <div class="stats-actions-stack">
        <div class="stats-action-row stats-action-row-primary">
          <div class="stats-action-copy">
            <div class="stats-actions-title">Prossimo passo</div>
            <div class="stats-actions-note">${data.nextAction.title}. ${data.nextAction.body}</div>
          </div>
          <div class="stats-action-control">
            <button class="w-btn" onclick="${data.nextAction.onClick}">${data.nextAction.ctaLabel}</button>
          </div>
        </div>
        <div class="stats-actions-grid">
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Peso</div>
              <div class="stats-actions-note">Aggiungi una pesata o riapri la cronologia solo quando ti serve.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="toggleStatsSection('stats-actions-weight-form-shell')">Nuovo peso</button>
              <button class="stats-inline-btn" onclick="toggleStatsSection('stats-actions-weight-log-shell')">Cronologia</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Misure</div>
              <div class="stats-actions-note">Le rilevazioni restano qui sotto, fuori dalla lettura principale della tab.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="toggleStatsSection('stats-actions-measurements-form-shell')">Nuova rilevazione</button>
              <button class="stats-inline-btn" onclick="toggleStatsSection('stats-actions-measurements-log-shell')">Cronologia</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Obiettivo</div>
              <div class="stats-actions-note">Se il quadro ti sembra fuori fase, rivedi prima obiettivo e setup di base.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="goView('profilo')">Apri profilo</button>
            </div>
          </div>
          <div class="stats-action-row">
            <div class="stats-action-copy">
              <div class="stats-actions-title">Giornata attiva</div>
              <div class="stats-actions-note">Quando hai capito il quadro, torna subito su oggi e chiudi il prossimo passo utile.</div>
            </div>
            <div class="stats-action-control">
              <button class="stats-secondary-btn" onclick="goView('today')">Torna a oggi</button>
            </div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-weight-form-shell">
          <div class="stats-action-block">
            <div class="stats-actions-title">Nuovo peso</div>
            <div class="stats-actions-note">Una pesata semplice vale piu di una stima mentale.</div>
            <div class="stats-weight-entry">
              <div class="weight-entry">
                <input class="w-input" type="number" id="w-in" step="0.1" placeholder="64.0">
                <span class="stats-inline-unit">kg</span>
                <button class="w-btn" onclick="addWeight()">Salva peso</button>
              </div>
            </div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-weight-log-shell">
          <div class="stats-action-block">${renderStatsWeightLog(data.bounds)}</div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-measurements-form-shell">
          <div class="stats-action-block">
            <div id="stats-actions-measurements-entry"></div>
          </div>
        </div>
        <div class="stats-collapsible stats-actions-collapsible" id="stats-actions-measurements-log-shell">
          <div class="stats-action-block">
            <div id="stats-actions-measurements-log"></div>
          </div>
        </div>
      </div>
    </div>`;
  renderMeasurementsForm(data.bounds, 'stats-actions-measurements-entry', 'stats-actions-measurements-log');
}

function renderStatsComingSoon() {
  const sub = document.getElementById('stats-sub');
  if (sub) sub.textContent = 'Qui arriveranno trend peso, aderenza e misure quando avremo dati sufficienti.';
  const toolbar = document.getElementById('stats-toolbar');
  const summary = document.getElementById('stats-summary');
  const weight = document.getElementById('stats-weight');
  const measurements = document.getElementById('stats-measurements');
  const adherence = document.getElementById('stats-adherence');
  const patterns = document.getElementById('stats-patterns');
  const actions = document.getElementById('stats-actions');
  if (toolbar) toolbar.innerHTML = '';
  if (weight) weight.innerHTML = '';
  if (measurements) measurements.innerHTML = '';
  if (adherence) adherence.innerHTML = '';
  if (patterns) patterns.innerHTML = '';
  if (actions) actions.innerHTML = '';
  if (summary) {
    const lastWeight = (S.weightLog || [])
      .filter(entry => Number.isFinite(Number(entry?.val)))
      .slice(-1)[0] || null;
    const lastMeasurement = (S.measurements || [])
      .filter(entry => entry && Object.values(entry).some(value => typeof value === 'number' && Number.isFinite(value)))
      .slice(-1)[0] || null;
    const statCards = [
      lastWeight ? `<div class="stats-coming-data-card">
        <span>Ultimo peso</span>
        <strong>${Number(lastWeight.val).toFixed(1)} kg</strong>
        <em>${htmlEsc(lastWeight.date || 'Ultima rilevazione')}</em>
      </div>` : '',
      lastMeasurement ? `<div class="stats-coming-data-card">
        <span>Ultima misura</span>
        <strong>${htmlEsc(lastMeasurement.date || 'Registrata')}</strong>
        <em>Pronta per i prossimi trend</em>
      </div>` : '',
    ].filter(Boolean).join('');
    summary.innerHTML = `<div class="stats-coming-card stats-coming-card-lite">
      <div class="stats-coming-top">
        <span class="stats-coming-pill"><span class="stats-coming-pill-dot"></span>In preparazione</span>
      </div>
      <div class="stats-coming-body stats-coming-body-lite">
        <div>
          <div class="stats-coming-title">Statistiche</div>
          <div class="stats-coming-text">Qui arriveranno trend peso, aderenza e misure quando avremo dati sufficienti.</div>
        </div>
        ${statCards ? `<div class="stats-coming-data-grid">${statCards}</div>` : `<div class="stats-coming-data-empty">Aggiungi peso e misure dal profilo per iniziare a costruire i trend.</div>`}
      </div>
    </div>`;
  }
}

function renderStatsDashboard() {
  const data = getStatsRangeData(S.statsRange || '30d');
  document.getElementById('stats-sub').textContent = `${data.bounds.label} · prima leggi il segnale giusto, poi decidi il prossimo passo`;
  document.getElementById('stats-adherence').innerHTML = '';
  renderStatsToolbar(data);
  renderStatsHero(data);
  if (data.primaryModule === 'physical') renderStatsPhysicalModule(data);
  else if (data.primaryModule === 'recovery') renderStatsRecoveryModule(data);
  else renderStatsBehaviorModule(data);
  renderStatsSupportModule(data);
  renderStatsPatterns(data);
  renderStatsActions(data);
}
function renderStats() {
  renderStatsDashboard();
}
