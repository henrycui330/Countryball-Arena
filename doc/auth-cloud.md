# Cloud login & saves (Supabase)

Progress (roster, XP, coins) is stored in **Supabase**, so clearing your browser does not wipe your account.

## You must do this once (Auth setting)

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/trtoyhdwawgrfafrvygj/auth/providers)
2. **Authentication → Providers → Email**
3. Turn **OFF** “Confirm email”
4. Save

Without that, Register may create an account but not sign you in (no mailbox for the fake `@players.countryball-arena.local` emails).

Optional: SQL already applied via migration; backup copy is `doc/supabase-migration.sql`.

## How to use

1. Open the game (`code/index.html`)
2. **Register** — username (3–24 letters/numbers/`_`), password, confirm password
3. Play → KO foes → XP/levels/coins sync to the cloud (~1s after changes)
4. **Log out** on the title screen
5. **Login** later (even after clearing site data) → progress returns

**Import:** Countryballs page → “Import old browser progress into this account” (one-time lift from old `localStorage`).

## What is saved

- Owned Countryballs levels / XP / cosmetics slots  
- Coin bank  

## Files

| File | Role |
|------|------|
| `code/js/supabase-config.js` | Project URL + anon key |
| `code/js/auth.js` | Login/register + cloud pull/push |
| `code/js/auth-ui.js` | Auth screens |
| `code/js/main.js` | Boot gate (must be logged in) |

Username maps to a synthetic email for Supabase Auth (`you@players.countryball-arena.local`). Only the **anon** key is in the frontend.
