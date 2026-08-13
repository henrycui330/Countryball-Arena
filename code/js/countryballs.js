/**
 * Countryballs roster — owned balls, levels, display stats.
 * Fight KO → XP → level-up → coin rewards (cosmetics/gacha later).
 * Levels do not affect arena combat yet.
 */
window.CBCountryballs = (function () {
  const STORAGE_KEY = "cb-arena-roster";
  const MAX_LEVEL = 50;

  const CATALOG = {
    usa: {
      id: "usa",
      name: "USA",
      sprite: "assets/usa.png",
      baseAtk: 16,
      blurb: "Deagle bash · charged spin-shot · cash toss · eagle ult",
      special: "Cash Toss",
      ultimate: "Eagle Strike",
    },
    japan: {
      id: "japan",
      name: "Japan",
      sprite: "assets/japan.png",
      baseAtk: 18,
      blurb: "Katana strike · shove-stab · shuriken · cinema ult",
      special: "Shuriken",
      ultimate: "Lightning Stab",
    },
    russia: {
      id: "russia",
      name: "Russia",
      sprite: "assets/russia.png",
      baseAtk: 17,
      blurb: "Absolut bash · stun barrage · drink · brotherhood ult",
      special: "Drink",
      ultimate: "Brotherhood",
    },
    france: {
      id: "france",
      name: "France",
      sprite: "assets/france.png",
      baseAtk: 17,
      blurb: "Baguette strike · throw · wine spill · guided slams",
      special: "Wine Spill",
      ultimate: "Guided Baguettes",
    },
    uk: {
      id: "uk",
      name: "UK",
      sprite: "assets/uk.png",
      baseAtk: 16,
      blurb: "Umbrella bash · teacup toss · acid rain · warship",
      special: "Acid Rain",
      ultimate: "Warship",
    },
  };

  const KO_XP = {
    dummy: 30,
    easy: 40,
    medium: 55,
    hard: 75,
  };

  let roster = null;
  let lastAward = null;

  function emptyCosmetics() {
    return { hatId: null, weaponId: null, effectId: null };
  }

  function emptyInventory() {
    return { hats: [], weapons: [], effects: [] };
  }

  function makeBall(id, extras) {
    const cat = CATALOG[id];
    if (!cat) return null;
    const e = extras || {};
    const ownedDefault = id === "usa"; // starter only USA when not specified in seed
    return {
      id: cat.id,
      name: cat.name,
      owned: e.owned != null ? !!e.owned : ownedDefault,
      level: clampLevel(e.level != null ? e.level : 1),
      xp: Math.max(0, Math.floor(e.xp != null ? e.xp : 0)),
      cosmetics: Object.assign(emptyCosmetics(), e.cosmetics || {}),
    };
  }

  function clampLevel(n) {
    return Math.max(1, Math.min(MAX_LEVEL, Math.floor(n || 1)));
  }

  function xpToNext(level) {
    const lv = clampLevel(level);
    if (lv >= MAX_LEVEL) return 0;
    return 40 + lv * 25;
  }

  function coinsForLevel(level) {
    return 20 + clampLevel(level) * 5;
  }

  function seedRoster() {
    return {
      version: 3,
      coins: 0,
      settings: {
        tutorialCompleted: false,
      },
      inventory: (function () {
        const inv = emptyInventory();
        inv.effects.push("uncle_sam");
        inv.effects.push("void_shroud");
        inv.effects.push("solar_aegis");
        inv.effects.push("wrath_of_the_gods");
        inv.hats.push("beret");
        inv.hats.push("tophat");
        return inv;
      })(),
      balls: {
        usa: makeBall("usa", { owned: true }),
        japan: makeBall("japan", { owned: false }),
        russia: makeBall("russia", { owned: false }),
        france: makeBall("france", { owned: false }),
        uk: makeBall("uk", { owned: false }),
      },
    };
  }

  function normalizeSettings(raw, hadSettingsKey) {
    // Existing cloud saves without settings: treat tutorial as done (don't force vets).
    // Brand-new seeds include settings.tutorialCompleted = false.
    const completed = hadSettingsKey
      ? !!(raw && raw.tutorialCompleted)
      : true;
    return { tutorialCompleted: completed };
  }

  function normalizeInventory(raw, balls) {
    const inv = emptyInventory();
    if (raw && typeof raw === "object") {
      if (Array.isArray(raw.hats)) {
        raw.hats.forEach(function (h) {
          if (h && inv.hats.indexOf(h) < 0 && h !== "samurai") inv.hats.push(String(h));
        });
      }
      if (Array.isArray(raw.weapons)) {
        raw.weapons.forEach(function (w) {
          if (w && inv.weapons.indexOf(w) < 0) inv.weapons.push(String(w));
        });
      }
      if (Array.isArray(raw.effects)) {
        raw.effects.forEach(function (e) {
          if (e && inv.effects.indexOf(e) < 0) inv.effects.push(String(e));
        });
      }
    }
    // Migration: keep equipped hats usable
    if (balls) {
      Object.keys(balls).forEach(function (id) {
        const hat = balls[id] && balls[id].cosmetics && balls[id].cosmetics.hatId;
        if (hat && hat !== "samurai" && inv.hats.indexOf(hat) < 0) {
          inv.hats.push(hat);
        }
        const fx = balls[id] && balls[id].cosmetics && balls[id].cosmetics.effectId;
        if (fx && inv.effects.indexOf(fx) < 0) inv.effects.push(fx);
      });
    }
    // Starter auras always owned
    if (inv.effects.indexOf("uncle_sam") < 0) inv.effects.push("uncle_sam");
    if (inv.effects.indexOf("void_shroud") < 0) inv.effects.push("void_shroud");
    if (inv.effects.indexOf("solar_aegis") < 0) inv.effects.push("solar_aegis");
    if (inv.effects.indexOf("wrath_of_the_gods") < 0) inv.effects.push("wrath_of_the_gods");
    if (inv.hats.indexOf("beret") < 0) inv.hats.push("beret");
    if (inv.hats.indexOf("tophat") < 0) inv.hats.push("tophat");
    return inv;
  }

  function normalize(data) {
    if (!data || typeof data !== "object") return seedRoster();
    const balls = {};
    Object.keys(CATALOG).forEach(function (id) {
      const raw = data.balls && data.balls[id];
      if (raw && typeof raw === "object") {
        // Legacy saves (no inventory / v<3): keep prior owned defaults (all true)
        let owned;
        if (typeof raw.owned === "boolean") {
          owned = raw.owned;
        } else if (data.version >= 3) {
          owned = id === "usa";
        } else {
          owned = true; // pre-gacha saves
        }
        balls[id] = makeBall(id, {
          owned: owned,
          level: raw.level,
          xp: raw.xp,
          cosmetics: raw.cosmetics,
        });
      } else if (data.version >= 3) {
        balls[id] = makeBall(id, { owned: id === "usa" });
      } else {
        balls[id] = makeBall(id, { owned: true });
      }
    });
    return {
      version: 3,
      coins: Math.max(0, Math.floor(data.coins != null ? data.coins : 0)),
      settings: normalizeSettings(
        data.settings,
        data && Object.prototype.hasOwnProperty.call(data, "settings")
      ),
      inventory: normalizeInventory(data.inventory, balls),
      balls: balls,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        roster = seedRoster();
        save();
        console.log("[CBCountryballs] seeded starter roster");
        return roster;
      }
      roster = normalize(JSON.parse(raw));
      console.log("[CBCountryballs] loaded roster coins=" + roster.coins);
      return roster;
    } catch (err) {
      console.warn("[CBCountryballs] load failed, reseeding", err);
      roster = seedRoster();
      save();
      return roster;
    }
  }

  function save() {
    if (!roster) roster = seedRoster();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
    } catch (err) {
      console.warn("[CBCountryballs] save failed", err);
    }
    if (window.CBAuth && typeof CBAuth.scheduleCloudSave === "function") {
      CBAuth.scheduleCloudSave();
    }
  }

  function getRosterSnapshot() {
    ensure();
    return JSON.parse(JSON.stringify(roster));
  }

  function setHat(ballId, hatId) {
    ensure();
    const ball = roster.balls[ballId];
    if (!ball || !ball.owned) {
      console.warn("[CBCountryballs] setHat: bad ball", ballId);
      return { ok: false, error: "ball" };
    }
    if (!ball.cosmetics) ball.cosmetics = emptyCosmetics();
    const id =
      hatId == null || hatId === "" || hatId === "none" ? null : String(hatId);
    if (id && window.CBCosmetics && !CBCosmetics.isHatId(id)) {
      return { ok: false, error: "unknown hat" };
    }
    if (id && !ownsHat(id)) {
      return { ok: false, error: "locked" };
    }
    ball.cosmetics.hatId = id;
    save();
    console.log("[CBCountryballs] hat", ballId, "=", id);
    return { ok: true, hatId: id, ball: ball };
  }

  function getInventory() {
    ensure();
    if (!roster.inventory) roster.inventory = emptyInventory();
    return roster.inventory;
  }

  function ownsHat(hatId) {
    if (!hatId || hatId === "none") return true;
    const inv = getInventory();
    return inv.hats.indexOf(hatId) >= 0;
  }

  function ownsWeapon(weaponId) {
    if (!weaponId) return false;
    const inv = getInventory();
    return inv.weapons.indexOf(weaponId) >= 0;
  }

  function isCharacterOwned(id) {
    // Gacha parked: all roster fighters playable (cosmetics stay locked).
    if (window.CBGacha && CBGacha.ENABLED === false) {
      if (id === "usa" || id === "japan" || id === "russia" || id === "france" || id === "uk") return true;
    }
    const b = getBall(id);
    return !!(b && b.owned);
  }

  function hasInfiniteCoins() {
    const u =
      (window.CBAuth && CBAuth.getUsername && CBAuth.getUsername()) || "";
    return String(u).trim().toLowerCase() === "carrot";
  }

  function formatCoins(n) {
    if (hasInfiniteCoins() || n === Infinity) return "∞";
    return String(n == null ? 0 : n);
  }

  function spendCoins(amount) {
    ensure();
    if (hasInfiniteCoins()) {
      console.log("[CBCountryballs] spendCoins skipped (dev infinite: Carrot)");
      return { ok: true, coins: Infinity, infinite: true };
    }
    const n = Math.max(0, Math.floor(amount || 0));
    if (roster.coins < n) return { ok: false, error: "coins", coins: roster.coins };
    roster.coins -= n;
    save();
    return { ok: true, coins: roster.coins };
  }

  function addCoins(amount) {
    ensure();
    if (hasInfiniteCoins()) return Infinity;
    const n = Math.max(0, Math.floor(amount || 0));
    roster.coins += n;
    save();
    return roster.coins;
  }

  function unlockHat(hatId) {
    ensure();
    if (!hatId || hatId === "none" || hatId === "samurai") {
      return { ok: false, duplicate: false };
    }
    const inv = getInventory();
    if (inv.hats.indexOf(hatId) >= 0) {
      return { ok: true, duplicate: true };
    }
    inv.hats.push(hatId);
    save();
    return { ok: true, duplicate: false };
  }

  function unlockWeapon(weaponId) {
    ensure();
    if (!weaponId) return { ok: false, duplicate: false };
    const inv = getInventory();
    if (inv.weapons.indexOf(weaponId) >= 0) {
      return { ok: true, duplicate: true };
    }
    inv.weapons.push(weaponId);
    save();
    return { ok: true, duplicate: false };
  }

  function unlockCharacter(id) {
    ensure();
    const ball = roster.balls[id];
    if (!ball) return { ok: false, duplicate: false };
    if (ball.owned) return { ok: true, duplicate: true };
    ball.owned = true;
    save();
    return { ok: true, duplicate: false };
  }

  function setWeapon(ballId, weaponId) {
    ensure();
    const ball = roster.balls[ballId];
    if (!ball || !ball.owned) {
      console.warn("[CBCountryballs] setWeapon: bad ball", ballId);
      return { ok: false, error: "ball" };
    }
    if (!ball.cosmetics) ball.cosmetics = emptyCosmetics();
    const id =
      weaponId == null || weaponId === "" || weaponId === "none"
        ? null
        : String(weaponId);
    if (id) {
      if (window.CBCosmetics && !CBCosmetics.isWeaponId(id)) {
        return { ok: false, error: "unknown weapon" };
      }
      if (!ownsWeapon(id)) {
        return { ok: false, error: "locked" };
      }
      const w = window.CBCosmetics && CBCosmetics.getWeapon(id);
      if (w && w.fighter && w.fighter !== ballId) {
        return { ok: false, error: "wrong fighter" };
      }
    }
    ball.cosmetics.weaponId = id;
    save();
    console.log("[CBCountryballs] weapon", ballId, "=", id);
    return { ok: true, weaponId: id, ball: ball };
  }

  function getWeaponId(ballId) {
    const ball = getBall(ballId);
    if (!ball || !ball.cosmetics) return null;
    const id = ball.cosmetics.weaponId || null;
    if (!id) return null;
    if (!ownsWeapon(id)) return null;
    if (window.CBCosmetics) {
      const w = CBCosmetics.getWeapon(id);
      if (!w || w.id === "none") return null;
      if (w.fighter && w.fighter !== ballId) return null;
    }
    return id;
  }

  function getHatId(ballId) {
    const ball = getBall(ballId);
    if (!ball || !ball.cosmetics) return null;
    const id = ball.cosmetics.hatId || null;
    if (id === "samurai") return null; // removed from catalog
    return id;
  }

  function ownsEffect(effectId) {
    if (!effectId || effectId === "none") return true;
    const inv = getInventory();
    if (!inv.effects) inv.effects = [];
    return inv.effects.indexOf(effectId) >= 0;
  }

  function unlockEffect(effectId) {
    ensure();
    if (!effectId || effectId === "none") return { ok: false, duplicate: false };
    const inv = getInventory();
    if (!inv.effects) inv.effects = [];
    if (inv.effects.indexOf(effectId) >= 0) {
      return { ok: true, duplicate: true };
    }
    inv.effects.push(effectId);
    save();
    return { ok: true, duplicate: false };
  }

  function setEffect(ballId, effectId) {
    ensure();
    const ball = roster.balls[ballId];
    if (!ball || !ball.owned) {
      console.warn("[CBCountryballs] setEffect: bad ball", ballId);
      return { ok: false, error: "ball" };
    }
    if (!ball.cosmetics) ball.cosmetics = emptyCosmetics();
    const id =
      effectId == null || effectId === "" || effectId === "none"
        ? null
        : String(effectId);
    if (id) {
      if (window.CBCosmetics && !CBCosmetics.isEffectId(id)) {
        return { ok: false, error: "unknown effect" };
      }
      if (!ownsEffect(id)) {
        return { ok: false, error: "locked" };
      }
    }
    ball.cosmetics.effectId = id;
    save();
    console.log("[CBCountryballs] effect", ballId, "=", id);
    return { ok: true, effectId: id, ball: ball };
  }

  function getEffectId(ballId) {
    const ball = getBall(ballId);
    if (!ball || !ball.cosmetics) return null;
    const id = ball.cosmetics.effectId || null;
    if (!id) return null;
    if (!ownsEffect(id)) return null;
    if (window.CBCosmetics && !CBCosmetics.isEffectId(id)) return null;
    return id;
  }

  function hasWrath(ballId) {
    return getEffectId(ballId) === "wrath_of_the_gods";
  }

  /** Replace in-memory + local cache from cloud JSON (no cloud re-upload loop). */
  function hydrateFromCloud(data) {
    roster = normalize(data);
    const unlocked = grantPlayableFightersWhenGachaOff();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
    } catch (err) {
      console.warn("[CBCountryballs] hydrate local cache failed", err);
    }
    if (unlocked && window.CBAuth && typeof CBAuth.scheduleCloudSave === "function") {
      CBAuth.scheduleCloudSave();
      console.log("[CBCountryballs] gacha off — unlocked fighters after cloud hydrate");
    }
    console.log(
      "[CBCountryballs] hydrated from cloud coins=" + (roster.coins || 0)
    );
    return roster;
  }

  /** Read raw localStorage without mutating cloud-linked state. */
  function readLocalCacheOnly() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function grantPlayableFightersWhenGachaOff() {
    if (!(window.CBGacha && CBGacha.ENABLED === false)) return false;
    if (!roster || !roster.balls) return false;
    let changed = false;
    ["usa", "japan", "russia", "france", "uk"].forEach(function (id) {
      const b = roster.balls[id];
      if (b && !b.owned) {
        b.owned = true;
        changed = true;
      }
    });
    return changed;
  }

  function ensure() {
    if (!roster) load();
    if (grantPlayableFightersWhenGachaOff()) {
      save();
      console.log("[CBCountryballs] gacha off — unlocked all roster fighters");
    }
    return roster;
  }

  function getCoins() {
    ensure();
    if (hasInfiniteCoins()) return Infinity;
    return roster.coins || 0;
  }

  function getCatalog(id) {
    return CATALOG[id] || null;
  }

  function getBall(id) {
    ensure();
    return roster.balls[id] || null;
  }

  function listOwned() {
    ensure();
    return Object.keys(CATALOG)
      .map(function (id) {
        return roster.balls[id];
      })
      .filter(function (b) {
        return b && b.owned;
      });
  }

  function computeStats(ball) {
    if (!ball) return null;
    const cat = CATALOG[ball.id];
    if (!cat) return null;
    const level = clampLevel(ball.level);
    const xp = Math.max(0, Math.floor(ball.xp || 0));
    const need = xpToNext(level);
    return {
      id: ball.id,
      name: cat.name,
      sprite: cat.sprite,
      level: level,
      xp: xp,
      xpToNext: need,
      xpProgress: need > 0 ? Math.min(1, xp / need) : 1,
      maxHp: 100 + (level - 1) * 4,
      atk: cat.baseAtk + (level - 1),
      special: cat.special,
      ultimate: cat.ultimate,
      blurb: cat.blurb,
      cosmetics: ball.cosmetics || emptyCosmetics(),
      hatId: (function () {
        const h = (ball.cosmetics && ball.cosmetics.hatId) || null;
        return h === "samurai" ? null : h;
      })(),
      weaponId: getWeaponId(ball.id),
      effectId: getEffectId(ball.id),
      maxLevel: MAX_LEVEL,
    };
  }

  function addXp(ballId, amount) {
    ensure();
    const ball = roster.balls[ballId];
    if (!ball || !ball.owned) {
      console.warn("[CBCountryballs] addXp: unknown/unowned", ballId);
      return null;
    }
    const xpGain = Math.max(0, Math.floor(amount || 0));
    if (xpGain <= 0) {
      return {
        ballId: ballId,
        xpGain: 0,
        levelsGained: 0,
        rewards: [],
        level: ball.level,
        coins: roster.coins,
        stats: computeStats(ball),
        summary: "No XP",
      };
    }

    const levelBefore = ball.level;
    ball.xp += xpGain;
    let levelsGained = 0;
    const rewards = [];

    while (ball.level < MAX_LEVEL) {
      const need = xpToNext(ball.level);
      if (ball.xp < need) break;
      ball.xp -= need;
      ball.level += 1;
      levelsGained += 1;
      const coinAmt = coinsForLevel(ball.level);
      roster.coins += coinAmt;
      rewards.push({
        type: "coins",
        amount: coinAmt,
        level: ball.level,
        label: "+" + coinAmt + " coins (reached Lv " + ball.level + ")",
      });
      console.log(
        "[CBCountryballs] LEVEL UP " +
          ballId +
          " → " +
          ball.level +
          " reward +" +
          coinAmt +
          " coins"
      );
    }
    if (ball.level >= MAX_LEVEL) ball.xp = 0;

    save();
    const coinTotal = rewards.reduce(function (s, r) {
      return s + r.amount;
    }, 0);
    let summary = "+" + xpGain + " XP · " + (CATALOG[ballId] || {}).name;
    if (levelsGained > 0) {
      summary +=
        " · LEVEL UP" +
        (levelsGained > 1 ? " ×" + levelsGained : "") +
        " → Lv " +
        ball.level;
      summary += " · +" + coinTotal + " coins";
    }

    const result = {
      ballId: ballId,
      name: (CATALOG[ballId] || {}).name || ballId,
      xpGain: xpGain,
      levelsGained: levelsGained,
      levelBefore: levelBefore,
      level: ball.level,
      rewards: rewards,
      coinsGained: coinTotal,
      coins: roster.coins,
      stats: computeStats(ball),
      summary: summary,
    };
    lastAward = result;
    console.log("[CBCountryballs] award", summary, "bank=" + roster.coins);
    return result;
  }

  function xpForKo(config) {
    const c = config || {};
    const opp = c.opponent || "dummy";
    const base = KO_XP[opp] != null ? KO_XP[opp] : 30;
    const bonus = c.matchType === "custom" ? 10 : 0;
    return base + bonus;
  }

  /** Call when you KO the foe (stock or unlimited). */
  function awardFoeKo(config) {
    const c = config || {};
    const fighter =
      c.fighter === "japan" ||
      c.fighter === "russia" ||
      c.fighter === "france" ||
      c.fighter === "uk"
        ? c.fighter
        : "usa";
    return addXp(fighter, xpForKo(c));
  }

  function getLastAward() {
    return lastAward;
  }

  function formatAward(award) {
    if (!award) return "";
    return award.summary || "";
  }

  function resetToSeed() {
    roster = seedRoster();
    lastAward = null;
    save();
    console.log("[CBCountryballs] reset to seed");
    return roster;
  }

  function getSettings() {
    ensure();
    if (!roster.settings) {
      roster.settings = { tutorialCompleted: true };
    }
    return roster.settings;
  }

  function hasCompletedTutorial() {
    return !!getSettings().tutorialCompleted;
  }

  function setTutorialCompleted(done) {
    ensure();
    getSettings().tutorialCompleted = !!done;
    save();
    console.log("[CBCountryballs] tutorialCompleted=", !!done);
    return { ok: true };
  }

  load();

  return {
    STORAGE_KEY,
    MAX_LEVEL,
    CATALOG,
    KO_XP,
    load,
    save,
    ensure,
    getCatalog,
    getBall,
    listOwned,
    computeStats,
    xpToNext,
    coinsForLevel,
    getCoins,
    formatCoins,
    hasInfiniteCoins,
    addXp,
    xpForKo,
    awardFoeKo,
    getLastAward,
    formatAward,
    resetToSeed,
    getRosterSnapshot,
    hydrateFromCloud,
    readLocalCacheOnly,
    setHat,
    getHatId,
    setWeapon,
    getWeaponId,
    setEffect,
    getEffectId,
    hasWrath,
    getInventory,
    ownsHat,
    ownsWeapon,
    ownsEffect,
    isCharacterOwned,
    spendCoins,
    addCoins,
    unlockHat,
    unlockWeapon,
    unlockEffect,
    unlockCharacter,
    getSettings,
    hasCompletedTutorial,
    setTutorialCompleted,
  };
})();
