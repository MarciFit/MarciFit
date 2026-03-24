// mealTaxonomy.js - tassonomia cibi/pasti per il nuovo motore Piano

(function() {
  const MEAL_TYPES = ['colazione', 'spuntino', 'pranzo', 'cena', 'prewo', 'postwo', 'altro'];

  const KEYWORDS = {
    colazione: ['yogurt', 'latte', 'avena', 'muesli', 'cereali', 'corn flakes', 'cornflakes', 'fette biscottate', 'biscotti', 'marmellata', 'crema spalmabile', 'burro d arachidi', 'burro di arachidi', 'pancake', 'cappuccino', 'caffe latte', 'granola'],
    spuntino: ['banana', 'mela', 'barretta', 'whey', 'frutta secca', 'mandorle', 'noci', 'cracker', 'gallette', 'yogurt', 'skyr'],
    pranzo: ['pasta', 'riso', 'pollo', 'tacchino', 'hamburger', 'pane', 'tonno', 'farro', 'cous cous', 'couscous', 'bresaola', 'piadina'],
    cena: ['pollo', 'tacchino', 'manzo', 'hamburger', 'salmone', 'uova', 'pane', 'patate', 'riso', 'pesce', 'orata', 'branzino', 'frittata'],
    prewo: ['banana', 'gallette', 'pane', 'miele', 'riso', 'cereali'],
    postwo: ['whey', 'riso', 'pollo', 'skyr', 'yogurt greco', 'banana']
  };

  const ROLE_KEYWORDS = {
    proteina_main: ['pollo', 'tacchino', 'manzo', 'hamburger', 'tonno', 'salmone', 'uova', 'albume', 'bresaola', 'fiocchi di latte', 'skyr', 'yogurt greco', 'whey'],
    carb_main: ['pasta', 'riso', 'patate', 'pane', 'farro', 'cous cous', 'couscous', 'piadina', 'wrap'],
    breakfast_base: ['avena', 'cereali', 'corn flakes', 'cornflakes', 'fette biscottate', 'pane', 'granola', 'muesli', 'biscotti'],
    dairy: ['yogurt', 'skyr', 'latte', 'fiocchi di latte', 'parmigiano', 'mozzarella', 'burrata', 'stracciatella', 'ricotta'],
    fruit: ['banana', 'mela', 'pera', 'frutti di bosco', 'kiwi', 'fragole', 'arancia'],
    vegetable: ['zucchine', 'insalata', 'spinaci', 'pomodori', 'verdure', 'broccoli', 'melanzane'],
    fat_source: ['olio', 'olio evo', 'avocado', 'burro d arachidi', 'burro di arachidi', 'frutta secca', 'mandorle', 'noci'],
    snack_protein: ['whey', 'barretta', 'skyr', 'yogurt greco', 'fiocchi di latte']
  };

  const MANUAL_ROLE_MAP = {
    base: ['carb_main', 'breakfast_base'],
    proteina: ['proteina_main'],
    latticino: ['dairy'],
    frutta: ['fruit'],
    contorno: ['vegetable'],
    condimento: ['fat_source'],
  };

  const SNACK_ONLY_KEYWORDS = ['barretta', 'whey', 'cracker', 'gallette', 'frutta secca', 'mandorle', 'noci', 'banana', 'mela', 'pera'];
  const BREAKFAST_ONLY_KEYWORDS = ['cereali', 'corn flakes', 'cornflakes', 'muesli', 'granola', 'fette biscottate', 'biscotti', 'marmellata', 'pancake', 'latte', 'cappuccino'];
  const MAIN_MEAL_KEYWORDS = ['mozzarella', 'burrata', 'stracciatella', 'ricotta', 'olio', 'olio evo', 'zucchine', 'melanzane', 'insalata', 'verdure', 'broccoli', 'cavolfiore', 'bastoncini', 'merluzzo', 'pesce', 'salmone', 'tonno', 'pollo', 'tacchino', 'manzo', 'hamburger', 'pasta', 'riso', 'patate', 'pane', 'piadina', 'wrap', 'orata', 'branzino', 'frittata', 'uova'];
  const SNACK_EXCLUSION_KEYWORDS = ['mozzarella', 'burrata', 'stracciatella', 'olio', 'zucchine', 'melanzane', 'insalata', 'verdure', 'broccoli', 'cavolfiore', 'bastoncini', 'merluzzo', 'pesce', 'salmone', 'tonno', 'hamburger', 'pollo', 'tacchino', 'manzo', 'uova', 'frittata'];

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function inferMealTypeFromLabel(label) {
    const text = normalizeText(label);
    if (text.includes('colazione')) return 'colazione';
    if (text.includes('spuntino') || text.includes('merenda')) return 'spuntino';
    if (text.includes('pranzo')) return 'pranzo';
    if (text.includes('cena')) return 'cena';
    return 'altro';
  }

  function inferMealTagsForFood(food) {
    const text = normalizeText(food?.name);
    const roleSet = new Set(inferFoodRoles(food));
    const typicalGrams = Number(food?.typicalGrams || food?.portionGrams || 0) || 0;
    const kcal100 = Number(food?.kcal100 || 0) || 0;
    const p100 = Number(food?.p100 || 0) || 0;
    const c100 = Number(food?.c100 || 0) || 0;
    const f100 = Number(food?.f100 || 0) || 0;

    const hasKeyword = list => list.some(keyword => text.includes(normalizeText(keyword)));
    const isBreakfastOnly = hasKeyword(BREAKFAST_ONLY_KEYWORDS);
    const isSnackOnly = hasKeyword(SNACK_ONLY_KEYWORDS);
    const isMainMealFood = hasKeyword(MAIN_MEAL_KEYWORDS)
      || roleSet.has('proteina_main')
      || roleSet.has('carb_main')
      || roleSet.has('vegetable')
      || roleSet.has('fat_source');
    const excludeSnack = hasKeyword(SNACK_EXCLUSION_KEYWORDS)
      || roleSet.has('vegetable')
      || (roleSet.has('fat_source') && !isSnackOnly)
      || (roleSet.has('proteina_main') && typicalGrams >= 90);

    if (isBreakfastOnly) return ['colazione'];
    if (isSnackOnly && !isMainMealFood) return ['spuntino'];
    if (excludeSnack && isMainMealFood) return ['pranzo', 'cena'];

    const matches = Object.entries(KEYWORDS)
      .filter(([, keywords]) => keywords.some(keyword => text.includes(normalizeText(keyword))))
      .map(([mealType]) => mealType);

    if (matches.length) {
      const filteredMatches = matches.filter(tag => !(tag === 'spuntino' && excludeSnack));
      if (filteredMatches.length) return [...new Set(filteredMatches)];
      return [...new Set(matches)];
    }

    if ((kcal100 || 0) <= 120 && p100 >= 8 && !excludeSnack && !isMainMealFood) return ['colazione', 'spuntino', 'postwo'];
    if (typicalGrams >= 120 && c100 >= 25) return ['pranzo', 'cena'];
    if (isMainMealFood) return ['pranzo', 'cena'];
    if (roleSet.has('dairy') && !excludeSnack) return ['colazione', 'spuntino'];
    if (roleSet.has('fruit') && !excludeSnack) return ['colazione', 'spuntino', 'prewo'];
    if (f100 >= 40 && excludeSnack) return ['pranzo', 'cena'];
    return ['spuntino'];
  }

  function sanitizeManualFoodRoles(value) {
    return Array.isArray(value)
      ? value.filter(role => role in MANUAL_ROLE_MAP)
      : [];
  }

  function expandManualFoodRoles(manualRoles) {
    return [...new Set(sanitizeManualFoodRoles(manualRoles).flatMap(role => MANUAL_ROLE_MAP[role] || []))];
  }

  function inferFoodRolesFromKeywords(food) {
    const text = normalizeText(food?.name);
    const roles = Object.entries(ROLE_KEYWORDS)
      .filter(([, keywords]) => keywords.some(keyword => text.includes(normalizeText(keyword))))
      .map(([role]) => role);

    if (roles.length) return [...new Set(roles)];
    if ((food?.p100 || 0) >= 18 && (food?.c100 || 0) <= 15) return ['proteina_main'];
    if ((food?.c100 || 0) >= 45 && (food?.f100 || 0) <= 12) return ['carb_main'];
    if ((food?.f100 || 0) >= 40) return ['fat_source'];
    return [];
  }

  function inferFoodRoles(food) {
    const manualRoles = expandManualFoodRoles(food?.manualFoodRoles);
    if (manualRoles.length) return manualRoles;
    return inferFoodRolesFromKeywords(food);
  }

  function inferPortionMeta(food) {
    const text = normalizeText(food?.name);
    const quantityText = normalizeText(food?.quantity || food?.portionLabel || '');
    const grams = Number(food?.portionGrams || food?.typicalGrams || 0) || 0;
    const unitLike = ['uovo', 'uova', 'galletta', 'fetta biscottata', 'fette biscottate', 'fetta', 'fette'];
    const packLike = ['hamburger', 'barretta', 'yogurt', 'skyr', 'wrap', 'piadina', 'panino'];

    if (packLike.some(keyword => text.includes(keyword)) && grams >= 80) {
      return {
        portionMode: 'pack',
        portionGrams: grams || 100,
        portionStepGrams: grams || 100,
        minServingGrams: grams || 100,
        maxServingGrams: Math.max(grams || 100, (grams || 100) * 2),
        allowFractionalServing: false,
      };
    }

    if (unitLike.some(keyword => text.includes(keyword)) || quantityText.includes('pezzo')) {
      const unitGrams = grams || 30;
      return {
        portionMode: 'unit',
        portionGrams: unitGrams,
        portionStepGrams: unitGrams,
        minServingGrams: unitGrams,
        maxServingGrams: Math.max(unitGrams * 4, 120),
        allowFractionalServing: false,
      };
    }

    return {
      portionMode: 'free',
      portionGrams: grams || 100,
      portionStepGrams: 10,
      minServingGrams: Math.max(20, Math.min(grams || 100, 80)),
      maxServingGrams: Math.max(grams || 100, 300),
      allowFractionalServing: true,
    };
  }

  function applyRolePortionCaps(food, portionMeta, roles = []) {
    if ((portionMeta?.portionMode || 'free') !== 'free') return portionMeta;
    const text = normalizeText(food?.name);
    const roleSet = new Set(roles || []);
    let caps = null;

    if (text.includes('olio')) {
      caps = { min: 5, max: 20, step: 5 };
    } else if (roleSet.has('vegetable')) {
      caps = { min: 80, max: 250, step: 20 };
    } else if (roleSet.has('fat_source')) {
      caps = { min: 10, max: 30, step: 5 };
    } else if (roleSet.has('proteina_main')) {
      caps = { min: 90, max: 220, step: 10 };
    } else if (roleSet.has('carb_main')) {
      caps = { min: 40, max: 140, step: 10 };
    } else if (roleSet.has('dairy')) {
      caps = { min: 80, max: 200, step: 10 };
    } else if (roleSet.has('fruit')) {
      caps = { min: 100, max: 250, step: 25 };
    }

    if (!caps) return portionMeta;

    const basePortion = Number(portionMeta?.portionGrams || food?.typicalGrams || 100) || 100;
    const minServing = Math.max(5, Number(caps.min || 5));
    const maxServing = Math.max(minServing, Number(caps.max || minServing));
    return {
      ...portionMeta,
      portionGrams: Math.min(maxServing, Math.max(minServing, basePortion)),
      portionStepGrams: Number(caps.step || portionMeta?.portionStepGrams || 10) || 10,
      minServingGrams: minServing,
      maxServingGrams: maxServing,
    };
  }

  function enrichFavoriteFood(food) {
    const manualFoodRoles = sanitizeManualFoodRoles(food?.manualFoodRoles);
    const inferredFoodRoles = inferFoodRolesFromKeywords(food);
    const effectiveRoles = manualFoodRoles.length
      ? expandManualFoodRoles(manualFoodRoles)
      : (Array.isArray(food?.foodRoles) && food.foodRoles.length ? food.foodRoles : inferredFoodRoles);
    const portionMeta = applyRolePortionCaps(food, inferPortionMeta(food), effectiveRoles);
    const manualMealTags = Array.isArray(food?.manualMealTags)
      ? food.manualMealTags.filter(tag => MEAL_TYPES.includes(tag))
      : [];
    const inferredMealTags = inferMealTagsForFood(food);
    return {
      ...food,
      inferredMealTags,
      inferredFoodRoles,
      manualMealTags,
      manualFoodRoles,
      mealTags: manualMealTags.length
        ? manualMealTags
        : (Array.isArray(food?.mealTags) && food.mealTags.length ? food.mealTags : inferredMealTags),
      foodRoles: effectiveRoles,
      helperEligible: food?.helperEligible !== false,
      ...portionMeta,
      portionMode: food?.portionMode || portionMeta.portionMode,
      portionGrams: Number(food?.portionGrams || portionMeta.portionGrams || 0) || portionMeta.portionGrams,
      portionStepGrams: Number(food?.portionStepGrams || portionMeta.portionStepGrams || 10) || 10,
      minServingGrams: Number(food?.minServingGrams || portionMeta.minServingGrams || 20) || 20,
      maxServingGrams: Number(food?.maxServingGrams || portionMeta.maxServingGrams || 300) || 300,
      allowFractionalServing: typeof food?.allowFractionalServing === 'boolean' ? food.allowFractionalServing : portionMeta.allowFractionalServing,
    };
  }

  function normalizeFavoriteFoods(foods) {
    return (foods || []).map(enrichFavoriteFood);
  }

  function isFoodCompatibleWithMeal(food, mealType) {
    const tags = Array.isArray(food?.mealTags) ? food.mealTags : inferMealTagsForFood(food);
    return tags.includes(mealType);
  }

  function getMissingCoverageSuggestions(mealType, coverage) {
    if (mealType === 'colazione') {
      const items = [];
      if (!coverage.breakfast_base) items.push('2-3 basi colazione come avena, cereali o fette biscottate');
      if (!coverage.dairy && !coverage.snack_protein) items.push('1-2 proteine da colazione come yogurt greco o skyr');
      if (!coverage.fruit) items.push('1-2 frutti facili come banana o mela');
      return items;
    }
    if (mealType === 'pranzo' || mealType === 'cena') {
      const items = [];
      if (!coverage.proteina_main) items.push('almeno 2 proteine principali come pollo, tonno, hamburger o uova');
      if (!coverage.carb_main) items.push('2 basi carbo come pasta, riso, pane o patate');
      if (!coverage.vegetable) items.push('qualche contorno o verdura semplice');
      return items;
    }
    if (mealType === 'spuntino') {
      const items = [];
      if (!coverage.snack_protein && !coverage.dairy) items.push('1-2 snack proteici come yogurt, skyr o whey');
      if (!coverage.fruit && !coverage.breakfast_base) items.push('qualche frutto o base leggera come gallette');
      return items;
    }
    return [];
  }

  window.MEAL_TYPES = MEAL_TYPES;
  window.MANUAL_FOOD_ROLE_KEYS = Object.keys(MANUAL_ROLE_MAP);
  window.inferMealTypeFromLabel = inferMealTypeFromLabel;
  window.inferMealTagsForFood = inferMealTagsForFood;
  window.inferFoodRolesForFood = inferFoodRoles;
  window.expandManualFoodRoles = expandManualFoodRoles;
  window.inferPortionMetaForFood = inferPortionMeta;
  window.enrichFavoriteFood = enrichFavoriteFood;
  window.normalizeFavoriteFoods = normalizeFavoriteFoods;
  window.isFoodCompatibleWithMeal = isFoodCompatibleWithMeal;
  window.getMissingCoverageSuggestions = getMissingCoverageSuggestions;
})();
