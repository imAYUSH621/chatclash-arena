# ChatClash Arena

ChatClash Arena is a colorful Twitch chat battle royale. Viewers use chat commands to drop blob avatars into an animated arena, attack rivals, heal, and vote for chaos events. Add `/overlay` as an OBS browser source to show the live game.

The game is authoritative on the Node.js server. The canvas page receives state snapshots over Socket.IO and renders them. Player wins and kills are stored in `data/leaderboard.json`.

## 60-second quick start

Requirements: Node.js 18 or newer and npm.

```sh
npm install
CHANNEL=somechannel npm start
```

Replace `somechannel` with any live Twitch channel's login name (without `#`). Open [http://localhost:3000/overlay](http://localhost:3000/overlay). Anonymous Twitch IRC login is used automatically, so you do not need a Twitch account, app registration, or token to watch chat and play. In that channel, type `!join`. Arena bots fill out matches with fewer than six players.

The lobby lasts 60 seconds, then a battle runs for three minutes by default. When the battle ends, a new 60-second lobby opens.

## OBS browser source

1. Start ChatClash Arena on the computer that runs OBS.
2. In OBS, choose **Sources → + → Browser**.
3. Set the URL to `http://localhost:3000/overlay`.
4. Set the browser source width and height to your scene resolution (for example, 1920 × 1080).
5. Select **Refresh browser when scene becomes active** if you want the overlay to reconnect when switching scenes.

The page fills its source dimensions. For a remote OBS machine, use the server computer's reachable LAN address in place of `localhost` and allow inbound access to the configured port.

## Commands

| Chat command | Effect |
| --- | --- |
| `!join` or `!play` | Join the lobby. Your avatar spawns as soon as the next round starts. |
| `!attack @username` | During battle, deal 18–30 damage to a living player. Ten-second per-player cooldown. |
| `!heal` | Restore up to 28 HP during battle. Thirty-second per-player cooldown. |
| `!chaos` | Vote for a channel-wide event. Five distinct votes within 15 seconds trigger one. |

Chaos events include a meteor strike, health shuffle, speed burst, and gravity flip. The safe ring shrinks during the battle and hurts players outside it. When time expires, the remaining avatar with the most HP wins. The winner receives an on-overlay crown celebration and is recorded on the leaderboard.

## Let the bot post to chat (optional)

By default, IRC is anonymous and read-only. To enable round and winner announcements in Twitch chat, provide a chat OAuth token and the login name for its account:

```sh
CHANNEL=somechannel TWITCH_NICK=mybot TWITCH_OAUTH=oauth-token npm start
```

`TWITCH_OAUTH` may be supplied with or without the `oauth:` prefix. Keep the token private and do not commit it. Chat posting is enabled only when both `TWITCH_OAUTH` and `TWITCH_NICK` are set. Without both values, the overlay and anonymous chat listener still work normally.

## Judge it instantly, without an account

Install dependencies, then point `CHANNEL` at any live Twitch channel:

```sh
npm install
CHANNEL=somechannel npm start
```

Visit `http://localhost:3000/overlay`. You can watch the bot-filled rounds immediately. To see real chat commands in action, type `!join`, `!attack @username`, `!heal`, or `!chaos` in the selected channel's chat using an existing viewer account; the app itself never asks the operator or judges to log in. For five chaos votes, have five viewers type `!chaos` within the 15-second vote window.

## Configuration

Set values as environment variables or pass CLI flags (for example, `--channel somechannel --round-seconds 120`). Environment variables take precedence over defaults; a CLI flag takes precedence over the matching environment value.

| Setting | Default | Description |
| --- | --- | --- |
| `CHANNEL` / `--channel` | Required | Twitch channel login name; `#` prefix is accepted. |
| `PORT` / `--port` | `3000` | HTTP and Socket.IO listening port. |
| `LOBBY_SECONDS` / `--lobby-seconds` | `60` | Duration of each lobby. |
| `ROUND_SECONDS` / `--round-seconds` | `180` | Maximum battle duration. |
| `MIN_PLAYERS` / `--min-players` | `6` | Bot fill target when fewer avatars are in the arena. |
| `TICK_MS` / `--tick-ms` | `100` | Authoritative game update interval. |
| `TWITCH_NICK` | unset | Twitch login associated with the optional OAuth token. |
| `TWITCH_OAUTH` | unset | Optional Twitch chat OAuth token; enables chat announcements with `TWITCH_NICK`. |
| `LEADERBOARD_FILE` | `data/leaderboard.json` | Local leaderboard JSON file location. |

Copy `.env.example` as a reference. The app intentionally has no dotenv dependency; export the variables in your shell or configure them in your process manager.

## Development

```sh
npm install
CHANNEL=somechannel npm start
```

Project layout:

```text
config.js              Configuration and CLI flags
src/chat.js            Twitch IRC over TLS
src/game/arena.js      Authoritative round and arena state
src/game/entities.js   Avatar entity creation
src/game/events.js     Chaos event selection
src/server.js          Express and Socket.IO server
src/index.js           Starts the chat listener and web server together
public/overlay.html    Canvas overlay
```

## Built with OpenAI Codex

This hackathon project was built with OpenAI Codex by translating the gameplay brief into a runnable Node.js app, separating IRC, authoritative game state, the realtime web server, and the canvas overlay into small modules, then documenting the zero-account quick start and optional bot setup. Codex was used as a coding assistant; the project runs locally with open-source npm packages and does not depend on a hosted AI service.

## License

MIT. See [LICENSE](LICENSE).
