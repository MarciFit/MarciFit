// templateEngine.js - utilita template per la nuova tab Piano

(function() {
  function normalizeMealType(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('colazione')) return 'colazione';
    if (text.includes('spuntino') || text.includes('merenda')) return 'spuntino';
    if (text.includes('snack')) return 'spuntino';
    if (text.includes('pranzo')) return 'pranzo';
    if (text.includes('cena')) return 'cena';
    return 'altro';
  }

  function normalizeTemplateMealTypes(template) {
    const rawValues = [];
    if (Array.isArray(template?.mealTypes)) rawValues.push(...template.mealTypes);
    if (template?.mealType) rawValues.push(template.mealType);
    if (template?.tag) rawValues.push(template.tag);
    if (!rawValues.length && template?.name) rawValues.push(template.name);
    const normalized = rawValues
      .map(normalizeMealType)
      .filter(Boolean);
    return [...new Set(normalized)];
  }

  function getTemplateMealType(template) {
    return normalizeTemplateMealTypes(template)[0] || 'altro';
  }

  function getTemplateCountsByMealType(templates = []) {
    return templates.reduce((acc, template) => {
      const mealTypes = normalizeTemplateMealTypes(template);
      if (!mealTypes.length) {
        acc.altro = (acc.altro || 0) + 1;
        return acc;
      }
      mealTypes.forEach(mealType => {
        acc[mealType] = (acc[mealType] || 0) + 1;
      });
      return acc;
    }, {});
  }

  function filterTemplatesByMealType(templates = [], mealType = 'all') {
    if (!mealType || mealType === 'all') return [...templates];
    const normalizedFilter = normalizeMealType(mealType);
    return templates.filter(template => normalizeTemplateMealTypes(template).includes(normalizedFilter));
  }

  function templateMatchesMealType(template, mealType) {
    if (!mealType || mealType === 'all') return true;
    return normalizeTemplateMealTypes(template).includes(normalizeMealType(mealType));
  }

  function scoreTemplateForMeal(template, context = {}) {
    let score = 0;
    const templateMealTypes = normalizeTemplateMealTypes(template);
    if (templateMealTypes.includes(normalizeMealType(context.mealType || ''))) score += 30;
    if (context.favoriteFoodNames?.length) {
      const itemNames = (template.items || []).map(item => String(item.name || '').toLowerCase());
      score += context.favoriteFoodNames.filter(name => itemNames.includes(name)).length * 10;
    }
    score += Number(template.usageCount || 0) * 2;
    if (template.pinned) score += 20;
    return score;
  }

  function sortTemplatesForContext(templates = [], context = {}) {
    return [...templates].sort((a, b) => {
      const scoreDiff = scoreTemplateForMeal(b, context) - scoreTemplateForMeal(a, context);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'it');
    });
  }

  function getUsefulTemplatesNow(templates = [], context = {}) {
    const filtered = filterTemplatesByMealType(templates, context.mealType || 'all');
    return sortTemplatesForContext(filtered, context).slice(0, 8);
  }

  function computeTemplateMacros(items = []) {
    return items.reduce((acc, item) => {
      const grams = Number(item.grams || 0);
      const factor = grams / 100;
      acc.k += Math.round(Number(item.kcal100 || 0) * factor);
      acc.p += Number(item.p100 || 0) * factor;
      acc.c += Number(item.c100 || 0) * factor;
      acc.f += Number(item.f100 || 0) * factor;
      return acc;
    }, { k: 0, p: 0, c: 0, f: 0 });
  }

  function scaleTemplateItems(items = [], multiplier = 1) {
    const safeMultiplier = Math.max(0.05, Number(multiplier) || 1);
    return (items || []).map(item => ({
      ...item,
      grams: Math.max(1, Math.round(Number(item.grams || 0) * safeMultiplier)),
    }));
  }

  function getTemplatePortionOptions() {
    return [
      { value: 1, label: 'Intero', hint: '100%' },
      { value: 0.75, label: '3/4', hint: '75%' },
      { value: 0.5, label: 'Meta', hint: '50%' },
      { value: 0.25, label: '1/4', hint: '25%' },
      { value: 1.5, label: '1,5x', hint: '150%' },
      { value: 2, label: 'Doppio', hint: '200%' },
    ];
  }

  window.normalizeTemplateMealTypes = normalizeTemplateMealTypes;
  window.getTemplateMealType = getTemplateMealType;
  window.getTemplateCountsByMealType = getTemplateCountsByMealType;
  window.filterTemplatesByMealType = filterTemplatesByMealType;
  window.templateMatchesMealType = templateMatchesMealType;
  window.sortTemplatesForContext = sortTemplatesForContext;
  window.getUsefulTemplatesNow = getUsefulTemplatesNow;
  window.computeTemplateMacros = computeTemplateMacros;
  window.scaleTemplateItems = scaleTemplateItems;
  window.getTemplatePortionOptions = getTemplatePortionOptions;
})();
