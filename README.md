# Disrupt 🤖

A Discord bot that lets you chat with Claude, ChatGPT, Gemini, and Grok — all in one place. Watch them debate, or generate images with DALL-E.

## Setup

### 1. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Get your API keys

- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications)
- **Anthropic API Key** (Claude): [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key** (ChatGPT + DALL-E): [platform.openai.com](https://platform.openai.com)
- **Google AI API Key** (Gemini): [aistudio.google.com](https://aistudio.google.com)
- **xAI API Key** (Grok): [console.x.ai](https://console.x.ai)

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```sh
DISCORD_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_server_id  # Optional: for instant command updates
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
XAI_API_KEY=xai-...
```

### 4. Invite the bot

In Discord Developer Portal → OAuth2 → URL Generator:
- Scopes: `bot`, `applications.commands`
- Permissions: `Send Messages`, `Use Slash Commands`

### 5. Run

```bash
deno task dev   # Development with auto-reload
deno task start # Production
```

## Commands

| Command                    | Description                           |
| -------------------------- | ------------------------------------- |
| `/claude <prompt>`         | Ask Claude (Anthropic)                |
| `/gpt <prompt>`            | Ask ChatGPT (OpenAI)                  |
| `/gemini <prompt>`         | Ask Gemini (Google)                   |
| `/grok <prompt>`           | Ask Grok - witty and sarcastic        |
| `/grok-serious <prompt>`   | Ask Grok - analytical and direct      |
| `/grok-chaos <prompt>`     | Ask Grok - chaotic devil's advocate   |
| `/askall <prompt>`         | Ask all AIs and compare               |
| `/debate <topic> [rounds]` | Watch AIs debate (1-5 rounds)         |
| `/imagine <prompt>`        | Generate image with DALL-E 3          |

## Debate Mode

`/debate` starts a multi-turn conversation between:
- Claude, ChatGPT, Gemini, Grok (Funny), and Grok (Chaos)

```
/debate Is a hot dog a sandwich? 3
```

## License

MIT
