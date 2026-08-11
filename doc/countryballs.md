# Countryballs

Title screen → **Countryballs**.

## What it is
A **stats viewer** for your owned countryballs (USA, Japan, Russia), plus a **coin bank** for rewards.

## How to level up
1. Fight with a fighter (setup → Fight!).
2. **KO the foe** — that fighter gains XP.
3. Fill the XP bar → **level up** → earn **coins**.

XP shows as an arena status toast after each KO. On a full match win (lives mode), the celebration screen also shows your last award.

### XP per KO
| Opponent | Quick | Custom (+10) |
|----------|-------|----------------|
| Dummy | 30 | 40 |
| Easy | 40 | 50 |
| Medium | 55 | 65 |
| Hard | 75 | 85 |

XP to next level: `40 + level × 25` (max level 50).

### Level-up reward
**Coins** = `20 + newLevel × 5` (banked for future gacha / cosmetics).

## Stats (display)
| Field | Meaning |
|--------|---------|
| Level | 1–50 |
| XP | Toward next level |
| HP | `100 + (level − 1) × 4` |
| Atk | Fighter base melee + `(level − 1)` |

Levels do **not** change arena combat yet. Data is in `localStorage` (`cb-arena-roster`).

## Coming later
- Gacha spends coins for hats / weapons / auras  
- Equipping cosmetics  
- Wiring levels into arena HP/damage  
