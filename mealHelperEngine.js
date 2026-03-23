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

  function getMealHelperEligibility({ mealType, favoriteFoods }) {
    const foods = normalizeFavoriteFoods(favoriteFoods || []);
    const compatibleFoods = foods.filter(food => food.helperEligible !== false && isFoodCompatibleWithMeal(food, mealType));
    const coverage = getMealCoverage(compatibleFoods, mealType);
    let available = false;

    if (mealType === 'colazione') {
      available = (coverage.breakfast_base + coverage.dairy) >= 2 && (coverage.dairy + coverage.snack_protein) >= 1;
    } else if (mealType === 'pranzo' || mealType === 'cena') {
      available = coverage.proteina_main >= 1 && coverage.carb_main >= 1;
    } else if (mealType === 'spuntino') {
      available = (coverage.snack_protein + coverage.dairy) >= 1 && (coverage.fruit + coverage.breakfast_base + coverage.carb_main) >= 1;
    }

    const missingRoles = Object.keys(coverage).filter(key => coverage[key] === 0);
    const suggestions = getMissingCoverageSuggestions(mealType, coverage);
    const score = Math.min(100, compatibleFoods.length * 12 + Object.values(coverage).filter(Boolean).length * 8);
    return {
      available,
      score,
      compatibleFoods,
      coverage,
      missingRoles,
      suggestions,
      reasons: available ? [] : [`Servono piu cibi compatibili con ${mealType}.`],
    };
  }

  function selectByRole(foods, roles = []) {
    return foods.find(food => (food.foodRoles || []).some(role => roles.includes(role))) || null;
  }

  function buildHumanMealSkeleton(mealType, foods) {
    if (mealType === 'colazione') {
      return [
        selectByRole(foods, ['breakfast_base']),
        selectByRole(foods, ['dairy', 'snack_protein']),
        selectByRole(foods, ['fruit', 'fat_source']),
      ].filter(Boolean);
    }
    if (mealType === 'pranzo' || mealType === 'cena') {
      return [
        selectByRole(foods, ['carb_main']),
        selectByRole(foods, ['proteina_main']),
        selectByRole(foods, ['vegetable', 'fat_source']),
      ].filter(Boolean);
    }
    if (mealType === 'spuntino') {
      return [
        selectByRole(foods, ['snack_protein', 'dairy']),
        selectByRole(foods, ['fruit', 'breakfast_base', 'carb_main']),
      ].filter(Boolean);
    }
    return foods.slice(0, 3);
  }

  function materializeMealItems(baseFoods, targetKcal) {
    if (!baseFoods.length) return [];
    const baseSplit = Math.max(1, Math.round(targetKcal / baseFoods.length));
    return baseFoods.map(food => {
      const rawGrams = Number(food.typicalGrams || food.portionGrams || 100) || 100;
      const kcal100 = Number(food.kcal100 || 0) || 1;
      const desired = Math.max(rawGrams, (baseSplit / kcal100) * 100);
      const grams = normalizeServing(food, desired);
      return {
        id: food.id,
        name: food.name,
        grams,
        kcal100: Number(food.kcal100 || 0),
        p100: Number(food.p100 || 0),
        c100: Number(food.c100 || 0),
        f100: Number(food.f100 || 0),
        typicalGrams: Number(food.typicalGrams || 0) || null,
      };
    });
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

  function generateMealSuggestion({ mealType, targetKcal, targetMacros, favoriteFoods }) {
    const eligibility = getMealHelperEligibility({ mealType, favoriteFoods });
    if (!eligibility.available) {
      return { eligibility, suggestions: [] };
    }
    const skeletonFoods = buildHumanMealSkeleton(mealType, eligibility.compatibleFoods);
    const items = materializeMealItems(skeletonFoods, targetKcal || targetMacros?.k || 0);
    const macros = computeMealMacros(items);
    const score = scoreMealCandidate(macros, targetMacros || { k: targetKcal || 0, p: 0, c: 0, f: 0 });
    return {
      eligibility,
      suggestions: [{
        title: `Bozza ${mealType}`,
        summary: summarizeMeal(items, mealType),
        items,
        macros,
        score,
        source: 'favorites',
      }],
    };
  }

  window.normalizeServing = normalizeServing;
  window.getMealHelperEligibility = getMealHelperEligibility;
  window.generateMealSuggestion = generateMealSuggestion;
})();
