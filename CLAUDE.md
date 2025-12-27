# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Disrupt consists of 4 separate Discord bots (Claude, ChatGPT, Gemini, Grok), each running as an independent process with its own Discord bot token. Written in TypeScript using the Deno runtime.

## Commands

```bash
# Run individual bots
deno task claude    # Claude bot
deno task gpt       # ChatGPT bot
deno task gemini    # Gemini bot
deno task grok      # Grok bot

# Development mode with auto-reload
deno task dev:claude
deno task dev:gpt
deno task dev:gemini
deno task dev:grok
```

## Architecture

```text
bots/
  claude-bot.ts     # Claude: /claude, /debate (debate coordinator)
  gpt-bot.ts        # ChatGPT: /gpt, /imagine
  gemini-bot.ts     # Gemini: /gemini
  grok-bot.ts       # Grok: /grok, /grok-serious, /grok-chaos
src/
  ai/               # Shared AI clients (unchanged from single-bot)
    types.ts        # AIClient and AIResponse interfaces
    index.ts        # Singleton instances, exports
    claude.ts       # Anthropic Claude client
    chatgpt.ts      # OpenAI ChatGPT client
    gemini.ts       # Google Gemini client
    grok.ts         # xAI Grok with 3 personality modes
  shared/           # Common bot utilities
    bot-factory.ts  # createAIBot() - common bot setup with debate watching
    debate-protocol.ts  # Message format parsing for cross-bot debates
    discord-utils.ts    # format(), edit(), respond() helpers
  image.ts          # DALL-E 3 image generation
```

### Key Patterns

- **AIClient interface**: All AI providers implement `{ name: string; ask(prompt: string): Promise<AIResponse> }`.
- **Bot factory**: `createAIBot()` in `bot-factory.ts` creates a Discord bot with common event handlers and debate message watching.
- **Debate protocol**: Bots coordinate debates via Discord messages with structured metadata (`[DEBATE_TURN | Round: N | NEXT: BotName]`).
- **Separate tokens**: Each bot needs its own Discord token (`DISCORD_TOKEN_CLAUDE`, `DISCORD_TOKEN_GPT`, etc.).
- **Required Discord permissions**: Send Messages, Read Message History, Use Slash Commands, plus Message Content Intent enabled.

### Debate Flow

1. `/debate` command on Claude bot posts a `[DEBATE_START]` message and Claude's opening
2. Each turn message includes `[NEXT: BotName]` indicating whose turn is next
3. All bots watch channel messages; when a bot sees its name in `NEXT:`, it takes its turn
4. Continues until all rounds complete (`NEXT: END`)
