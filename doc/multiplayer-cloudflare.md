# Multiplayer (kids-friendly)

## Play

1. Open the game (GitHub Pages or local).
2. Title → **Multiplayer** (its own page).
3. One player: **Host a Room** → share the big **5-digit code**.
4. Friends: **Join with Code** → type the code.
5. Pick fighter → **I'm Ready** → host presses **Start Fight**.

No server URL pasting. The game already points at the Cloudflare Worker.

## Live server

- Health: `https://countryball-arena-multiplayer.henrycui330.workers.dev/health`
- WebSocket: `wss://countryball-arena-multiplayer.henrycui330.workers.dev/ws`

## Local server (optional)

```bash
cd code/server
npm install
npm run start
```

Uses `ws://localhost:8080` when the game is opened on localhost **and** `FIXED_MULTIPLAYER_WS_URL` is empty. Production builds keep the Cloudflare URL.

## Redeploy Worker

```bash
cd code/server
npm run cf:deploy
```

## Notes

- Max **4** players per room.
- Host picks the map.
- Combat is peer-relayed (position + hit events). Expect casual sync, not tournament netcode.
- If `workers.dev` fails to load, turn off Clash/VPN fake-IP for `*.workers.dev`.
