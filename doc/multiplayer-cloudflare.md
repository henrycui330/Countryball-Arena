# Cloudflare Multiplayer Setup

This is the free deployment path for Countryball Arena multiplayer.

## What you get

- WebSocket multiplayer endpoint on Cloudflare Workers
- Durable Object room server
- Up to 4 players per room
- No local Node server required

## One-time setup

1. Open a terminal
2. Go to the server folder:

```bash
cd "/Users/cheesydonut/Documents/Countryball PVP/code/server"
```

3. Install dependencies:

```bash
npm install
```

4. Log in to Cloudflare:

```bash
npx wrangler login
```

This opens a browser window. Approve it.

## Deploy

From the same `code/server` folder, run:

```bash
npm run cf:deploy
```

When deploy finishes, Cloudflare prints a URL like:

```text
https://countryball-arena-multiplayer.<your-subdomain>.workers.dev
```

## Put it into the game

1. Open the game
2. Click `Multiplayer`
3. In `Server URL`, paste:

```text
wss://countryball-arena-multiplayer.<your-subdomain>.workers.dev/ws
```

4. Click `Connect`
5. Player 1 clicks `Host Room`
6. Player 2 pastes the room code and clicks `Join`

## Useful checks

Health URL:

```text
https://countryball-arena-multiplayer.<your-subdomain>.workers.dev/health
```

It should return JSON with `"ok": true`.

## Notes

- The current room capacity is 4.
- Current multiplayer implementation supports lobby + presence + remote state relay foundations.
- Full multiplayer combat still depends on later sync/combat steps.
