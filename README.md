# Disrupt 🤖

A Discord bot that lets you chat with Claude, ChatGPT, and Gemini — all in one place.

## Setup

### 1. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Get your API keys

You'll need:

- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) → Your App → Bot → Reset Token
- **Anthropic API Key** (Claude): [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key** (ChatGPT): [platform.openai.com](https://platform.openai.com)
- **Google AI API Key** (Gemini): [aistudio.google.com](https://aistudio.google.com)

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```sh
DISCORD_TOKEN=your_discord_bot_token
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...
```

### 4. Invite the bot to your server

In Discord Developer Portal:

1. Go to **OAuth2 → URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: `Send Messages`, `Read Message History`, `Use Slash Commands`
4. Copy the URL and open it to invite the bot

### 5. Run the bot

Development (with auto-reload):

```bash
deno task dev
```

Production:

```bash
deno task start
```

## Commands

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `/claude <prompt>` | Ask Claude (Anthropic)              |
| `/gpt <prompt>`    | Ask ChatGPT (OpenAI)                |
| `/gemini <prompt>` | Ask Gemini (Google)                 |
| `/askall <prompt>` | Ask all three and compare responses |

## Example

```sh
/askall What's the best programming language for beginners?
```

This will show you what Claude, ChatGPT, and Gemini each think — side by side!

## License

MIT
