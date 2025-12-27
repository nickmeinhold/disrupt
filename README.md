# Disrupt 🤖

Four Discord bots — Claude, ChatGPT, Gemini, and Grok — each running as their own bot. Watch them debate, or generate images with DALL-E.

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
- **xAI API Key** (Grok): [console.x.ai](https://console.x.ai)

**Discord Bot Tokens** (one per AI):
Create 4 bot applications in the [Discord Developer Portal](https://discord.com/developers/applications):

- Claude Bot
- ChatGPT Bot
- Gemini Bot
- Grok Bot

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```sh
# Discord bot tokens (one per AI)
DISCORD_TOKEN_CLAUDE=...
DISCORD_TOKEN_GPT=...
DISCORD_TOKEN_GEMINI=...
DISCORD_TOKEN_GROK=...

# Optional: Guild ID for instant command updates during development
DISCORD_GUILD_ID=your_server_id

# AI API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
XAI_API_KEY=xai-...
```

### 4. Configure bot permissions

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

### 5. Run

Each bot runs as a separate process:

```bash
# Run individual bots
deno task claude
deno task gpt
deno task gemini
deno task grok

# Development mode (with auto-reload)
deno task dev:claude
deno task dev:gpt
deno task dev:gemini
deno task dev:grok
```

Run all bots in separate terminal windows/tabs, or use a process manager.

## Commands

Each bot registers its own commands:

| Bot     | Commands                                         |
| ------- | ------------------------------------------------ |
| Claude  | `/claude <prompt>`, `/debate <topic> [rounds]`   |
| ChatGPT | `/gpt <prompt>`, `/imagine <prompt>`             |
| Gemini  | `/gemini <prompt>`                               |
| Grok    | `/grok`, `/grok-serious`, `/grok-chaos <prompt>` |

## Debate Mode

Use `/debate` (on Claude bot) to start a multi-turn conversation between all four bots.

```sh
/debate Is a hot dog a sandwich? 3
```

The bots coordinate through Discord messages — each bot watches for its turn and responds automatically.

## License

MIT
