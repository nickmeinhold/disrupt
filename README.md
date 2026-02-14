# Disrupt 🤖

Four Discord bots — Disruption (orchestrator), Claude, ChatGPT, and Gemini — each running as their own bot. Watch them debate, generate images with DALL-E, or apply invisible watermarks to images.

## Setup

### 1. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Get your API keys

**AI API Keys:**

- **Anthropic API Key** (Claude): [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key** (ChatGPT + DALL-E): [platform.openai.com](https://platform.openai.com)
- **Google AI API Key** (Gemini): [aistudio.google.com](https://aistudio.google.com)
**Discord Bot Tokens** (one per AI):
Create 4 bot applications in the [Discord Developer Portal](https://discord.com/developers/applications):

- Disruption Bot (orchestrator - debates, images, watermarks)
- Claude Bot
- ChatGPT Bot
- Gemini Bot

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```sh
# Discord bot tokens
DISCORD_TOKEN_DISRUPTION=...
DISCORD_TOKEN_CLAUDE=...
DISCORD_TOKEN_GPT=...
DISCORD_TOKEN_GEMINI=...
# Optional: Guild ID for instant command updates during development
DISCORD_GUILD_ID=your_server_id

# AI API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...

# Firebase (for watermarking feature)
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
```

### 4. Firebase Setup (for watermarking)

To use the `/watermark` and `/detect` commands, you need a Firebase project:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database and Cloud Storage
3. Create a service account with Firestore and Storage permissions
4. Download the JSON key and save as `firebase-service-account.json`

The watermarking backend runs on Cloud Run and processes tasks asynchronously.

### 5. Configure bot permissions

For each bot in Discord Developer Portal:

**Bot → Privileged Gateway Intents:**

- ✅ Message Content Intent (required for debates)

**OAuth2 → URL Generator:**

- Scopes: `bot`, `applications.commands`
- Bot Permissions:
  - Send Messages
  - Read Message History
  - Use Slash Commands

Use the generated URL to invite each bot to your server.

### 6. Run

Each bot runs as a separate process:

```bash
# Run individual bots
deno task disruption  # Orchestrator (debates, images, watermarks)
deno task claude
deno task gpt
deno task gemini
# Development mode (with auto-reload)
deno task dev:disruption
deno task dev:claude
deno task dev:gpt
deno task dev:gemini
```

Run all bots in separate terminal windows/tabs, or use a process manager.

## Commands

Each bot registers its own commands:

| Bot        | Commands                                         |
| ---------- | ------------------------------------------------ |
| Disruption | `/debate <topic> [rounds]`, `/imagine <prompt>`, `/watermark`, `/detect` |
| Claude     | `/claude <prompt>`                               |
| ChatGPT    | `/gpt <prompt>`                                  |
| Gemini     | `/gemini <prompt>`                               |
## Debate Mode

Use `/debate` (on Disruption bot) to start a multi-turn conversation between all three AI bots.

```sh
/debate Is a hot dog a sandwich? 3
```

The bots coordinate through Discord messages — each bot watches for its turn and responds automatically.

## Watermarking

Embed invisible DFT-based watermarks that survive print-and-scan:

```sh
# Embed a hidden message
/watermark image:<file> message:"Hello World" strength:5

# Extract the hidden message (requires original)
/detect original:<file> marked:<file>
```

**Features:**
- Invisible watermarks using Discrete Fourier Transform
- Survives printing, scanning, and light image editing
- Progress updates at 10% intervals during processing
- Discord users automatically linked to Firebase Auth accounts

**How it works:**
1. User runs `/watermark` with an image and message
2. Bot authenticates user (creates Firebase account if needed)
3. Image uploaded to Cloud Storage, task queued in Firestore
4. Backend processes task asynchronously on Cloud Run
5. Progress updates posted to Discord as processing continues
6. Final watermarked image posted when complete

## License

MIT
