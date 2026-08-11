# Smoke check — v0 (Tasks 1–6)

Date: 2026-08-10

## Automated (script/syntax)
- [x] All expected files under `code/` present
- [x] `assets/usa.png` exists and non-empty
- [x] JS files parse with Node (`new Function` / syntax check)

## Manual (please confirm in browser)
- [ ] Main menu shows title **Countryball PVP** and Play
- [ ] Play opens arena with sky/hills background
- [ ] USA sprite moves with WASD
- [ ] **J** fires Freedom Blast; hits dummy / reduces HP
- [ ] **K** Eagle Strike dash with red/blue trail
- [ ] **L** Stars Barrage rains stars
- [ ] Esc / Menu returns to main menu
- [ ] No console errors on load

## How to run
Double-open `code/index.html`, or from project root:

```bash
cd code && python3 -m http.server 8080
```

Then visit http://localhost:8080
