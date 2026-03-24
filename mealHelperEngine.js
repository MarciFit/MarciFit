// mealHelperEngine.js - motore base helper pasti realistici

(function() {
  function normalizeServing(food, desiredGrams) {
    const target = Math.max(0, Number(desiredGrams || 0));
    const mode = food?.portionMode || 'free';
    const portionGrams = Number(food?.portionGrams || food?.typicalGrams || 100) || 100;
    const step = Number(food?.portionStepGrams || 10) || 10;
    const min = Number(food?.minServingGrams || 20) || 20;
    const max = Number(food?.maxServingGrams || Math.max(min, portionGrams)) || Math.max(min, portionGrams);

    if (mode === 'pack') {
      if (target <= 0) return portionGrams;
      const units = Math.max(1, Math.round(target / portionGrams));
      return Math.min(max, Math.max(min, units * portionGrams));
    }

    if (mode === 'unit') {
      const units = Math.max(1, Math.round(target / portionGrams));
      return Math.min(max, Math.max(min, units * portionGrams));
    }

    const rounded = Math.round(Math.max(min, target) / step) * step;
    return Math.min(max, Math.max(min, rounded));
  }

  function getMealCoverage(foods, mealType) {
    const coverage = {
      breakfast_base: 0,
      dairy: 0,
      proteina_main: 0,
      carb_main: 0,
      fruit: 0,
      vegetable: 0,
      snack_protein: 0,
      fat_source: 0,
    };
    foods.filter(food => isFoodCompatibleWithMeal(food, mealType)).forEach(food => {
      (food.foodRoles || []).forEach(role => {
        if (role in coverage) coverage[role] += 1;
      });
    });
    return coverage;
  }

  function countCoveredRoles(coverage) {
    return Object.values(coverage || {}).filter(value => value > 0).length;
  }

  function getMealCoverageSpec(mealType) {
    if (mealType === 'colazione') {
      return [
        { key: 'base', label: 'Base', required: true, roles: ['breakfast_base', 'dairy'] },
        { key: 'proteina', label: 'Proteina', required: true, roles: ['dairy', 'snack_protein'] },
        { key: 'frutta_topping', label: 'Frutta o topping', required: false, roles: ['fruit', 'fat_source'] },
      ];
    }
    if (mealType === 'spuntino') {
      return [
        { key: 'base', label: 'Base leggera', required: true, roles: ['fruit', 'breakfast_base', 'carb_main'] },
        { key: 'proteina', label: 'Proteina', required: true, roles: ['snack_protein', 'dairy'] },
        { key: 'extra', label: 'Extra', required: false, roles: ['fat_source'] },
      ];
    }
    if (mealType === 'pranzo' || mealType === 'cena') {
      return [
        { key: 'base', label: 'Base', required: true, roles: ['carb_main'] },
        { key: 'proteina', label: 'Proteina', required: true, roles: ['proteina_main', 'dairy'] },
        { key: 'contorno', label: 'Contorno', required: false, roles: ['vegetable', 'fruit'] },
        { key: 'condimento', label: 'Condimento', required: false, roles: ['fat_source'] },
      ];
    }
    return [];
  }

  function getMealCoverageHighlights(mealType, coverage = {}) {
    return getMealCoverageSpec(mealType).map(slot => {
      const count = slot.roles.reduce((sum, role) => sum + Number(coverage?.[role] || 0), 0);
      return {
        key: slot.key,
        label: slot.label,
        required: !!slot.required,
        count,
        ready: count > 0,
      };
    });
  }

  function formatHighlightList(items = []) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} e ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  }

  function getRoleAwareCoverageSuggestions(mealType, coverageHighlights = []) {
    const ready = coverageHighlights.filter(item => item.ready);
    const missingRequired = coverageHighlights.filter(item => item.required && !item.ready);
    const missingOptional = coverageHighlights.filter(item => !item.required && !item.ready);
    const readyLabels = ready.map(item => item.label.toLowerCase());
    const suggestions = [];

    if (missingRequired.length) {
      if (readyLabels.length) {
        suggestions.push(`Hai gia ${formatHighlightList(readyLabels)}. Ora ti manca ${formatHighlightList(missingRequired.map(item => item.label.toLowerCase()))}.`);
      }
      missingRequired.forEach(item => {
        if (mealType === 'colazione' && item.key === 'base') suggestions.push('Per la colazione ti serve una base vera come avena, cereali o fette biscottate.');
        else if (mealType === 'colazione' && item.key === 'proteina') suggestions.push('Per la colazione aggiungi una proteina semplice come yogurt greco, skyr o latte.');
        else if ((mealType === 'pranzo' || mealType === 'cena') && item.key === 'base') suggestions.push(`Per ${mealType} ti serve una base come pane, riso, pasta o patate.`);
        else if ((mealType === 'pranzo' || mealType === 'cena') && item.key === 'proteina') suggestions.push(`Per ${mealType} ti serve una proteina vera come pollo, tonno, uova o affettato magro.`);
        else if (mealType === 'spuntino' && item.key === 'base') suggestions.push('Per lo snack serve una base leggera come frutta, gallette o pane.');
        else if (mealType === 'spuntino' && item.key === 'proteina') suggestions.push('Per lo snack aggiungi una proteina pratica come yogurt, skyr o whey.');
      });
    } else if (missingOptional.length) {
      suggestions.push(`Hai gia ${formatHighlightList(readyLabels)}. Per renderlo piu credibile manca solo ${formatHighlightList(missingOptional.map(item => item.label.toLowerCase()))}.`);
    } else if (readyLabels.length) {
      suggestions.push(`Hai gia ${formatHighlightList(readyLabels)}. Il planner puo costruire una bozza credibile.`);
    }

    return suggestions.slice(0, 3);
  }

  function getMealHelperEligibility({ mealType, favoriteFoods }) {
    const foods = normalizeFavoriteFoods(favoriteFoods || []);
    const compatibleFoods = foods.filter(food => food.helperEligible !== false && isFoodCompatibleWithMeal(food, mealType));
    const coverage = getMealCoverage(compatibleFoods, mealType);
    const coverageHighlights = getMealCoverageHighlights(mealType, coverage);
    const compatibleCount = compatibleFoods.length;
    const coveredRoles = countCoveredRoles(coverage);
    let available = false;

    if (mealType === 'colazione') {
      const hasBreakfastBase = (coverage.breakfast_base + coverage.dairy) >= 1;
      const hasProteinOrDairy = (coverage.dairy + coverage.snack_protein) >= 1;
      available = compatibleCount >= 2 && hasBreakfastBase && hasProteinOrDairy;
    } else if (mealType === 'pranzo' || mealType === 'cena') {
      const hasMainProtein = (coverage.proteina_main + coverage.dairy) >= 1;
      const hasMainCarb = coverage.carb_main >= 1;
      available = compatibleCount >= 2 && hasMainProtein && hasMainCarb;
    } else if (mealType === 'spuntino') {
      const hasSnackBase = (coverage.fruit + coverage.breakfast_base + coverage.carb_main) >= 1;
      const hasSnackProtein = (coverage.snack_protein + coverage.dairy) >= 1;
      available = compatibleCount >= 2 && (hasSnackBase || hasSnackProtein) && coveredRoles >= 2;
    }

    const missingRoles = Object.keys(coverage).filter(key => coverage[key] === 0);
    const suggestions = getRoleAwareCoverageSuggestions(mealType, coverageHighlights);
    const score = Math.min(100, compatibleCount * 14 + coveredRoles * 8);
    return {
      available,
      score,
      compatibleFoods,
      coverage,
      coverageHighlights,
      compatibleCount,
      coveredRoles,
      missingRoles,
      suggestions,
      reasons: available ? [] : [`Servono piu cibi compatibili con ${mealType}.`],
    };
  }

  function selectByRole(foods, roles = []) {
    for (const role of roles) {
      const found = foods.find(food => (food.foodRoles || []).includes(role));
      if (found) return found;
    }
    return null;
  }

  function buildHumanMealSkeleton(mealType, foods, preferredFoods = []) {
    const skeleton = [];
    const usedIds = new Set();
    const selected = (preferredFoods || [])
      .filter(food => food && !usedIds.has(food.id))
      .slice(0, 3);

    selected.forEach(food => {
      skeleton.push(food);
      usedIds.add(food.id);
    });

    const fillRole = (roles = []) => {
      const candidate = selectByRole(
        foods.filter(food => !usedIds.has(food.id)),
        roles
      );
      if (candidate) {
        skeleton.push(candidate);
        usedIds.add(candidate.id);
      }
    };

    const hasAnyRole = (roles = []) => skeleton.some(food => (food.foodRoles || []).some(role => roles.includes(role)));

    if (mealType === 'colazione') {
      if (!hasAnyRole(['breakfast_base', 'dairy'])) fillRole(['breakfast_base']);
      if (!hasAnyRole(['dairy', 'snack_protein'])) fillRole(['dairy', 'snack_protein']);
      if (!hasAnyRole(['fruit', 'fat_source'])) fillRole(['fruit', 'fat_source']);
      return skeleton;
    }
    if (mealType === 'pranzo' || mealType === 'cena') {
      if (!hasAnyRole(['carb_main'])) fillRole(['carb_main']);
      if (!hasAnyRole(['proteina_main', 'dairy'])) fillRole(['proteina_main', 'dairy']);
      if (!hasAnyRole(['vegetable', 'fruit', 'fat_source'])) fillRole(['vegetable', 'fruit', 'fat_source']);
      return skeleton;
    }
    if (mealType === 'spuntino') {
      if (!hasAnyRole(['snack_protein', 'dairy'])) fillRole(['snack_protein', 'dairy']);
      if (!hasAnyRole(['fruit', 'breakfast_base', 'carb_main'])) fillRole(['fruit', 'breakfast_base', 'carb_main']);
      return skeleton;
    }
    return skeleton.length ? skeleton : foods.slice(0, 3);
  }

  function getAllocationRole(food, mealType) {
    const roles = Array.isArray(food?.foodRoles) ? food.foodRoles : [];
    const byMeal = mealType === 'colazione'
      ? ['breakfast_base', 'dairy', 'snack_protein', 'fruit', 'fat_source', 'carb_main']
      : mealType === 'spuntino'
        ? ['snack_protein', 'dairy', 'fruit', 'breakfast_base', 'carb_main', 'fat_source']
        : ['carb_main', 'proteina_main', 'dairy', 'vegetable', 'fat_source', 'fruit'];
    return byMeal.find(role => roles.includes(role)) || roles[0] || 'altro';
  }

  function getRoleBudgetWeights(mealType) {
    if (mealType === 'colazione') {
      return {
        breakfast_base: 0.42,
        dairy: 0.34,
        snack_protein: 0.30,
        fruit: 0.14,
        fat_source: 0.08,
        carb_main: 0.34,
      };
    }
    if (mealType === 'spuntino') {
      return {
        snack_protein: 0.42,
        dairy: 0.36,
        fruit: 0.22,
        breakfast_base: 0.24,
        carb_main: 0.28,
        fat_source: 0.08,
      };
    }
    return {
      carb_main: 0.42,
      proteina_main: 0.38,
      dairy: 0.34,
      vegetable: 0.08,
      fat_source: 0.06,
      fruit: 0.12,
    };
  }

  function getNormalizedAllocationWeights(baseFoods, mealType) {
    const roleWeights = getRoleBudgetWeights(mealType);
    const weights = baseFoods.map(food => {
      const allocRole = getAllocationRole(food, mealType);
      const weight = Number(roleWeights[allocRole] || 0.2) || 0.2;
      return { food, allocRole, weight };
    });
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    return weights.map(entry => ({
      ...entry,
      weight: entry.weight / total,
    }));
  }

  function seedDesiredGrams(food, targetKcal, mealType, budgetWeight, isPreferred = false) {
    const rawGrams = Number(food?.typicalGrams || food?.portionGrams || 100) || 100;
    const kcal100 = Number(food?.kcal100 || 0) || 1;
    const allocRole = getAllocationRole(food, mealType);
    const desiredKcal = Math.max(1, Number(targetKcal || 0) * Number(budgetWeight || 0));
    const text = String(food?.name || '').toLowerCase();

    if (isPreferred) {
      if (allocRole === 'fat_source') {
        if (text.includes('olio')) return Math.max(5, Math.min(15, rawGrams));
        return Math.max(10, Math.min(25, rawGrams));
      }
      if (allocRole === 'vegetable') {
        return Math.max(rawGrams, 120);
      }
      return rawGrams;
    }

    if (allocRole === 'fat_source') {
      if (text.includes('olio')) return Math.max(5, Math.min(15, desiredKcal / 9));
      return Math.max(10, Math.min(25, (desiredKcal / kcal100) * 100));
    }
    if (allocRole === 'vegetable') {
      return Math.max(rawGrams, Math.min(220, (desiredKcal / kcal100) * 100));
    }

    return Math.max(rawGrams, (desiredKcal / kcal100) * 100);
  }

  function buildMealItem(food, grams, allocRole, isPreferred = false) {
    return {
      id: food.id,
      name: food.name,
      grams,
      kcal100: Number(food.kcal100 || 0),
      p100: Number(food.p100 || 0),
      c100: Number(food.c100 || 0),
      f100: Number(food.f100 || 0),
      typicalGrams: Number(food.typicalGrams || 0) || null,
      foodRoles: Array.isArray(food.foodRoles) ? food.foodRoles.slice() : [],
      allocRole,
      portionMode: food?.portionMode || 'free',
      portionGrams: Number(food?.portionGrams || food?.typicalGrams || 100) || 100,
      portionStepGrams: Number(food?.portionStepGrams || 10) || 10,
      minServingGrams: Number(food?.minServingGrams || 20) || 20,
      maxServingGrams: Number(food?.maxServingGrams || 300) || 300,
      isPreferred,
    };
  }

  function normalizeServingDown(food, desiredGrams) {
    const target = Math.max(0, Number(desiredGrams || 0));
    const mode = food?.portionMode || 'free';
    const portionGrams = Number(food?.portionGrams || food?.typicalGrams || 100) || 100;
    const step = Number(food?.portionStepGrams || 10) || 10;
    const min = Number(food?.minServingGrams || 20) || 20;
    const max = Number(food?.maxServingGrams || Math.max(min, portionGrams)) || Math.max(min, portionGrams);

    if (mode === 'pack' || mode === 'unit') {
      const units = Math.max(1, Math.floor(Math.max(min, target) / portionGrams));
      return Math.min(max, Math.max(min, units * portionGrams));
    }

    const floored = Math.floor(Math.max(min, target) / step) * step;
    return Math.min(max, Math.max(min, floored || min));
  }

  function trimMealItemsToTarget(items, targetKcal, mealType) {
    let current = computeMealMacros(items).kcal;
    let overflow = Math.max(0, current - Number(targetKcal || 0));
    if (overflow <= 25) return items;

    const priorities = mealType === 'colazione'
      ? ['fat_source', 'fruit', 'breakfast_base', 'dairy', 'snack_protein']
      : mealType === 'spuntino'
        ? ['fat_source', 'fruit', 'carb_main', 'breakfast_base', 'dairy', 'snack_protein']
        : ['fat_source', 'fruit', 'vegetable', 'carb_main', 'dairy', 'proteina_main'];

    const trimmedItems = items.map(item => ({ ...item }));
    for (const role of priorities) {
      const roleItems = trimmedItems
        .filter(entry => entry.allocRole === role)
        .sort((a, b) => Number(Boolean(a.isPreferred)) - Number(Boolean(b.isPreferred)));
      for (const item of roleItems) {
        if (overflow <= 25) break;
        const kcal100 = Number(item.kcal100 || 0) || 0;
        if (kcal100 <= 0) continue;
        const minGrams = Number(item.minServingGrams || 20) || 20;
        const currentGrams = Number(item.grams || 0) || 0;
        if (currentGrams <= minGrams) continue;
        const reducibleGrams = currentGrams - minGrams;
        if (reducibleGrams <= 0) continue;
        const desiredLessGrams = (overflow / kcal100) * 100;
        const desiredGrams = Math.max(minGrams, currentGrams - desiredLessGrams);
        const nextGrams = Math.min(currentGrams, normalizeServingDown(item, desiredGrams));
        if (nextGrams >= currentGrams) continue;
        const reducedKcal = Math.round(kcal100 * (currentGrams - nextGrams) / 100);
        item.grams = nextGrams;
        overflow = Math.max(0, overflow - reducedKcal);
      }
      if (overflow <= 25) break;
    }
    return trimmedItems;
  }

  function tuneMealItemsToTarget(items, targetKcal, mealType) {
    const priorities = mealType === 'colazione'
      ? ['breakfast_base', 'dairy', 'snack_protein', 'fruit', 'fat_source']
      : mealType === 'spuntino'
        ? ['snack_protein', 'dairy', 'breakfast_base', 'carb_main', 'fruit', 'fat_source']
        : ['carb_main', 'proteina_main', 'dairy', 'fruit', 'fat_source'];
    let current = computeMealMacros(items).kcal;
    let remaining = Math.max(0, Number(targetKcal || 0) - current);
    if (remaining <= 25) return items;

    const tunedItems = items.map(item => ({ ...item }));
    for (const role of priorities) {
      const roleItems = tunedItems
        .filter(entry => entry.allocRole === role)
        .sort((a, b) => Number(Boolean(a.isPreferred)) - Number(Boolean(b.isPreferred)));
      for (const item of roleItems) {
        if (remaining <= 25) break;
        const kcal100 = Number(item.kcal100 || 0) || 0;
        if (kcal100 <= 0) continue;
        const maxGrams = Number(item.maxServingGrams || item.grams || 0) || item.grams || 0;
        const roomGrams = Math.max(0, maxGrams - Number(item.grams || 0));
        if (roomGrams <= 0) continue;
        const desiredExtraGrams = (remaining / kcal100) * 100;
        const desiredGrams = Number(item.grams || 0) + desiredExtraGrams;
        const nextGrams = Math.min(maxGrams, normalizeServing(item, desiredGrams));
        if (nextGrams <= Number(item.grams || 0)) continue;
        const addedKcal = Math.round(kcal100 * (nextGrams - Number(item.grams || 0)) / 100);
        item.grams = nextGrams;
        remaining = Math.max(0, remaining - addedKcal);
      }
      if (remaining <= 25) break;
    }
    return tunedItems;
  }

  function materializeMealItems(baseFoods, targetKcal, mealType, preferredFoodIds = []) {
    if (!baseFoods.length) return [];
    const preferredIds = new Set(Array.isArray(preferredFoodIds) ? preferredFoodIds : []);
    const weightedFoods = getNormalizedAllocationWeights(baseFoods, mealType);
    const seededItems = weightedFoods.map(({ food, allocRole, weight }) => {
      const isPreferred = preferredIds.has(food.id);
      const desired = seedDesiredGrams(food, targetKcal, mealType, weight, isPreferred);
      const grams = normalizeServing(food, desired);
      return buildMealItem(food, grams, allocRole, isPreferred);
    });
    const trimmedItems = trimMealItemsToTarget(seededItems, targetKcal, mealType);
    return tuneMealItemsToTarget(trimmedItems, targetKcal, mealType);
  }

  function summarizeMeal(items, mealType) {
    if (mealType === 'colazione') return 'Combinazione da colazione costruita con alimenti che usi davvero.';
    if (mealType === 'pranzo') return 'Pranzo semplice e realistico con base, proteina e complemento.';
    if (mealType === 'cena') return 'Cena bilanciata, pensata per essere plausibile e facile da usare.';
    if (mealType === 'spuntino') return 'Spuntino pratico che resta coerente con il tuo target.';
    return 'Pasto costruito partendo dai tuoi cibi piu abituali.';
  }

  function computeMealMacros(items = []) {
    return items.reduce((acc, item) => {
      const factor = Number(item.grams || 0) / 100;
      acc.kcal += Math.round(Number(item.kcal100 || 0) * factor);
      acc.p += Number(item.p100 || 0) * factor;
      acc.c += Number(item.c100 || 0) * factor;
      acc.f += Number(item.f100 || 0) * factor;
      return acc;
    }, { kcal: 0, p: 0, c: 0, f: 0 });
  }

  function scoreMealCandidate(macros, targetMacros) {
    const kcalDelta = Math.abs((macros.kcal || 0) - (targetMacros?.k || 0));
    const pDelta = Math.abs((macros.p || 0) - (targetMacros?.p || 0));
    const cDelta = Math.abs((macros.c || 0) - (targetMacros?.c || 0));
    const fDelta = Math.abs((macros.f || 0) - (targetMacros?.f || 0));
    const penalty = Math.min(65, kcalDelta * 0.06 + pDelta * 0.9 + cDelta * 0.35 + fDelta * 0.6);
    return Math.max(35, Math.round(100 - penalty));
  }

  function validateMealCandidate(items, targetMacros) {
    const macros = computeMealMacros(items);
    const targetK = Number(targetMacros?.k || 0) || 0;
    const kcalTolerance = Math.max(80, Math.round(targetK * 0.12));
    const hasOversizedCondiment = items.some(item => {
      const roles = Array.isArray(item.foodRoles) ? item.foodRoles : [];
      const text = String(item.name || '').toLowerCase();
      return roles.includes('fat_source') && text.includes('olio') && Number(item.grams || 0) > 20;
    });

    if (hasOversizedCondiment) {
      return {
        valid: false,
        reason: 'Il condimento e troppo alto per un pasto realistico. Aggiungi un contorno o una base migliore.',
        macros,
      };
    }

    if (targetK && macros.kcal > (targetK + kcalTolerance)) {
      return {
        valid: false,
        reason: 'Questa bozza va troppo sopra il target del pasto. Meglio fermarsi che proporre un pasto sbagliato.',
        macros,
      };
    }

    return { valid: true, macros };
  }

  function generateMealSuggestion({ mealType, targetKcal, targetMacros, favoriteFoods, preferredFoodIds = [] }) {
    const eligibility = getMealHelperEligibility({ mealType, favoriteFoods });
    if (!eligibility.available) {
      return { eligibility, suggestions: [] };
    }
    const selectedFoods = eligibility.compatibleFoods.filter(food => preferredFoodIds.includes(food.id));
    const skeletonFoods = buildHumanMealSkeleton(mealType, eligibility.compatibleFoods, selectedFoods);
    const items = materializeMealItems(skeletonFoods, targetKcal || targetMacros?.k || 0, mealType, preferredFoodIds);
    const validation = validateMealCandidate(items, targetMacros || { k: targetKcal || 0, p: 0, c: 0, f: 0 });
    if (!validation.valid) {
      return { eligibility, suggestions: [], unavailableReason: validation.reason };
    }
    const macros = validation.macros;
    const score = scoreMealCandidate(macros, targetMacros || { k: targetKcal || 0, p: 0, c: 0, f: 0 });
    return {
      eligibility,
      suggestions: [{
        title: `Bozza ${mealType}`,
        summary: selectedFoods.length
          ? `Bozza costruita partendo da ${selectedFoods.map(food => food.name).slice(0, 2).join(' e ')}.`
          : summarizeMeal(items, mealType),
        items,
        macros,
        score,
        source: 'favorites',
      }],
    };
  }

  window.normalizeServing = normalizeServing;
  window.getMealHelperEligibility = getMealHelperEligibility;
  window.getMealCoverageHighlights = getMealCoverageHighlights;
  window.generateMealSuggestion = generateMealSuggestion;
})();
