# Cosmetics — Hats, Weapons & Auras

Countryballs → pick a ball → **Hat** / **Weapon** / **Aura** rows.

Hats & weapons unlock via **Gacha** (`doc/gacha.md`). Auras may be starter-owned. Defaults (“None” / “Default”) are always available.

## Hats

### Caps
| Hat | Notes |
|-----|--------|
| None | Default |
| Officer Cap | Allied service cap (flipped) |
| Straw Hat | Wide brim |

### Mini countryballs (on your head)
| Hat |
|-----|
| Little USA |
| Little Japan |
| Little Russia |
| Little Kazakhstan |
| Little Belarus |
| Little Ukraine |

Equip: `cosmetics.hatId`. Ownership: `roster.inventory.hats[]`.

## Weapons

Skins are **fighter-locked** (`cosmetics.weaponId`).

| id | Name | Fighter | Art |
|----|------|---------|-----|
| (default) | Default | — | Starter weapon |
| `wpn_deagle_gold` | Gold Deagle | USA | `assets/weapons/deagle_gold.png` |
| `wpn_katana_blue` | Blue Katana | Japan | `assets/weapons/katana_blue.png` |
| `wpn_katana_rainbow` | Rainbow Katana | Japan | `assets/weapons/katana_rainbow.webp` |
| `wpn_absolut_ice` | Ice Absolut | Russia | Fallback to starter until custom PNG |

Ownership: `roster.inventory.weapons[]`. **Bots stay on default weapons.**

## Auras

Saved as `cosmetics.effectId`. Ownership: `roster.inventory.effects[]`.

| id | Name | Notes |
|----|------|--------|
| (default) | Default | No aura |
| `wrath_of_the_gods` | Wrath of the Gods | **Starter unlocked.** Soft red glow + slight visual float; red melee trails; USA charged = red bullet; plunge = red lightning; finisher KO = 3 red cross lines then red explode; Russia Brotherhood minions inherit the aura |

No damage buff from auras (v1).

## Later
- More auras / gacha auras  
- Ice Absolut custom art  
