// templateEngine.js - utilita template per la nuova tab Piano

(function() {
  function normalizeMealType(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('colazione')) return 'colazione';
    if (text.includes('spuntino') || text.includes('merenda')) return 'spuntino';
    if (text.includes('pranzo')) return 'pranzo';
    if (text.includes('cena')) return 'cena';
    return 'altro';
  }

  function getTemplateMealType(template) {
    return normalizeMealType(template?.mealType || template?.tag || template?.name || '');
  }

  function getTemplateCountsByMealType(templates = []) {
    return templates.reduce((acc, template) => {
      const mealType = getTemplateMealType(template);
      acc[mealType] = (acc[mealType] || 0) + 1;
      return acc;
    }, {});
  }

  function filterTemplatesByMealType(templates = [], mealType = 'all') {
    if (!mealType || mealType === 'all') return [...templates];
    return templates.filter(template => getTemplateMealType(template) === mealType);
  }

  function scoreTemplateForMeal(template, context = {}) {
    let score = 0;
    const templateMealType = getTemplateMealType(template);
    if (templateMealType === context.mealType) score += 30;
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

  window.getTemplateMealType = getTemplateMealType;
  window.getTemplateCountsByMealType = getTemplateCountsByMealType;
  window.filterTemplatesByMealType = filterTemplatesByMealType;
  window.sortTemplatesForContext = sortTemplatesForContext;
  window.getUsefulTemplatesNow = getUsefulTemplatesNow;
  window.computeTemplateMacros = computeTemplateMacros;
})();
