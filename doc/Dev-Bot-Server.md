# Dev Easy Bot server

Local multiplayer practice against an **Easy Bot** guest.

## Run

```bash
cd code/server
npm run dev:bot
```

Opens:

- Game: `http://127.0.0.1:5500/`
- WebSocket: `ws://127.0.0.1:8080`
- Fixed room code: **12346**

## Play

1. Open the game URL (must be localhost so the client uses `ws://127.0.0.1:8080`, not the live Cloudflare worker).
2. Multiplayer → **Join** → code **12346** (or press **Host** — same room).
3. You are **Host**. **Easy Bot** auto-joins as Guest and readies.
4. Press **Start**.

## Notes

- Bot uses easy Absolut-style melee (~12) + weak ranged pokes.
- Restart this server if a match gets stuck (`Ctrl+C`, then `npm run dev:bot` again).
- Production Cloudflare Worker is unchanged; this file is local-only.
- **"Room not found" for 12346:** you were talking to production. Hard-refresh; console should log `ws url ws://127.0.0.1:8080`.
