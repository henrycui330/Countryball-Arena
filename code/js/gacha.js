/**
 * Gacha — spend coins to unlock cosmetics, characters, weapons.
 * Parked: ENABLED = false removes pulls from the live game (code kept for later).
 */
window.CBGacha = (function () {
  const ENABLED = false;
  const COST_ONE = 100;
  const COST_TEN = 1000;
  const DUP_REFUND = 20;

  const POOL = [
    { id: "officer_cap", type: "cosmetic", name: "Officer Cap", weight: 18 },
    { id: "straw", type: "cosmetic", name: "Straw Hat", weight: 18 },
    { id: "beret", type: "cosmetic", name: "Beret", weight: 18 },
    { id: "tophat", type: "cosmetic", name: "Top Hat", weight: 18 },
    { id: "usa_buddy", type: "cosmetic", name: "Little USA", weight: 12 },
    { id: "japan_buddy", type: "cosmetic", name: "Little Japan", weight: 12 },
    { id: "russia_buddy", type: "cosmetic", name: "Little Russia", weight: 12 },
    { id: "kz_buddy", type: "cosmetic", name: "Little Kazakhstan", weight: 12 },
    { id: "belarus_buddy", type: "cosmetic", name: "Little Belarus", weight: 12 },
    { id: "ukraine_buddy", type: "cosmetic", name: "Little Ukraine", weight: 12 },
    { id: "japan", type: "character", name: "Japan", weight: 8 },
    { id: "russia", type: "character", name: "Russia", weight: 8 },
    { id: "wpn_deagle_gold", type: "weapon", name: "Gold Deagle", weight: 10 },
    { id: "wpn_katana_blue", type: "weapon", name: "Blue Katana", weight: 10 },
    { id: "wpn_katana_rainbow", type: "weapon", name: "Rainbow Katana", weight: 8 },
    { id: "wpn_absolut_ice", type: "weapon", name: "Ice Absolut", weight: 10 },
  ];

  let totalWeight = 0;
  POOL.forEach(function (p) {
    totalWeight += p.weight;
  });

  function rollOne() {
    let r = Math.random() * totalWeight;
    for (let i = 0; i < POOL.length; i++) {
      r -= POOL[i].weight;
      if (r <= 0) return POOL[i];
    }
    return POOL[POOL.length - 1];
  }

  function grant(entry) {
    const CB = window.CBCountryballs;
    if (!CB) return { ok: false, error: "no roster" };

    let result = { ok: false, duplicate: false };
    if (entry.type === "cosmetic") {
      result = CB.unlockHat(entry.id);
    } else if (entry.type === "character") {
      result = CB.unlockCharacter(entry.id);
    } else if (entry.type === "weapon") {
      result = CB.unlockWeapon(entry.id);
    }

    let refund = 0;
    if (result.duplicate) {
      refund = DUP_REFUND;
      CB.addCoins(refund);
    }

    return {
      id: entry.id,
      type: entry.type,
      name: entry.name,
      duplicate: !!result.duplicate,
      refund: refund,
      new: !result.duplicate,
    };
  }

  function pull(count) {
    if (!ENABLED) {
      return { ok: false, error: "Gacha is temporarily disabled." };
    }
    const CB = window.CBCountryballs;
    if (!CB) return { ok: false, error: "Roster not ready" };

    const n = count === 10 ? 10 : 1;
    const cost = n === 10 ? COST_TEN : COST_ONE;
    const spent = CB.spendCoins(cost);
    if (!spent.ok) {
      return {
        ok: false,
        error: "Not enough coins (need " + cost + ", have " + CB.getCoins() + ")",
        coins: CB.getCoins(),
      };
    }

    const results = [];
    for (let i = 0; i < n; i++) {
      results.push(grant(rollOne()));
    }

    console.log(
      "[CBGacha] pulled ×" + n + " cost=" + cost + " coins=" + CB.getCoins()
    );
    return {
      ok: true,
      count: n,
      cost: cost,
      results: results,
      coins: CB.getCoins(),
    };
  }

  function getPool() {
    return POOL.slice();
  }

  return {
    ENABLED,
    COST_ONE,
    COST_TEN,
    DUP_REFUND,
    pull,
    getPool,
    pullOne: function () {
      return pull(1);
    },
    pullTen: function () {
      return pull(10);
    },
  };
})();
