# Gacha

Spend **coins** (from countryball level-ups) to unlock pool items.

## Costs

| Pull | Coins |
|------|------:|
| ×1 | 100 |
| ×10 | 1000 |

Same rate — no 10-pull discount. Duplicates refund **+20 coins** each.

## How to open

Title → **Gacha** → Pull ×1 / Pull ×10 → cards deal face-down (polandball back) → click to flip / **Flip all**.

## Starter ownership (new accounts)

- **USA** owned  
- **Japan** / **Russia** locked until pulled  
- Hats: none owned (equip “None” only)  
- Weapon skins: empty until pulled  

Legacy saves (roster version &lt; 3): keep previous fighter ownership; keep any already-equipped hat in inventory.

## Dev

Username **Carrot** (password **Carrot** when registering) has **infinite coins** — pulls never deduct. UI shows ∞.

## Pool (relative weights)

| id | type | name | weight |
|----|------|------|-------:|
| officer_cap | cosmetic | Officer Cap | 18 |
| straw | cosmetic | Straw Hat | 18 |
| usa_buddy | cosmetic | Little USA | 12 |
| japan_buddy | cosmetic | Little Japan | 12 |
| russia_buddy | cosmetic | Little Russia | 12 |
| kz_buddy | cosmetic | Little Kazakhstan | 12 |
| belarus_buddy | cosmetic | Little Belarus | 12 |
| ukraine_buddy | cosmetic | Little Ukraine | 12 |
| japan | character | Japan | 8 |
| russia | character | Russia | 8 |
| wpn_deagle_gold | weapon | Gold Deagle | 10 |
| wpn_katana_blue | weapon | Blue Katana | 10 |
| wpn_absolut_ice | weapon | Ice Absolut | 10 |

Gold Deagle card art: `code/assets/weapons/deagle_gold.png` (from `Weapons/Only via gatcha/`).

## Inventory

Stored on roster JSON (cloud + local):

```json
{
  "version": 3,
  "coins": 0,
  "inventory": { "hats": [], "weapons": [] },
  "balls": { "usa": { "owned": true }, "japan": { "owned": false }, "russia": { "owned": false } }
}
```

- Cosmetics: must own hat to equip (Countryballs picker greys locked).  
- Characters: setup fighter buttons disabled until owned.  
- Weapons: inventory only for now (no arena skin swap yet).

## Files

- `code/js/gacha.js` — pool + pull  
- `code/js/gacha-ui.js` — screen  
- `code/js/countryballs.js` — inventory helpers / spendCoins  
