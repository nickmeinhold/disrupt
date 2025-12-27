# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Disrupt is a Discord bot written in TypeScript using the Deno runtime. It integrates multiple AI providers (Claude, ChatGPT, Gemini, Grok) and allows users to chat with them individually, compare responses, or watch them debate topics.

## Commands

```bash
deno task dev    # Run with auto-reload (development)
deno task start  # Run in production
```

Deno permissions used: `--allow-net`, `--allow-env`, `--allow-read`, `--allow-import`

## Architecture

```
mod.ts              # Entry point: Discord bot setup, slash command routing
src/
  ai/
    types.ts        # AIClient and AIResponse interfaces
    index.ts        # Singleton instances, clients array, askAll()
    claude.ts       # Anthropic Claude client
    chatgpt.ts      # OpenAI ChatGPT client
    gemini.ts       # Google Gemini client
    grok.ts         # xAI Grok client with 3 personality modes
  debate.ts         # Multi-turn AI debate orchestration
  image.ts          # DALL-E 3 image generation
```

### Key Patterns

- **AIClient interface**: All AI providers implement `{ name: string; ask(prompt: string): Promise<AIResponse> }`. Add new providers by implementing this interface.
- **Singleton instances**: AI clients are instantiated once in `src/ai/index.ts` and reused.
- **clients array**: Used for debates and `/askall`. Modify this array to change which AIs participate.
- **Debate flow**: Opens with first client, then rounds through remaining clients. Waits 5s between turns to collect user messages from the channel.

### Discord Integration

- Commands are registered guild-specific (fast, for dev) if `DISCORD_GUILD_ID` is set, otherwise globally (1hr propagation).
- Responses are truncated to 2000 chars (Discord limit).
- Debate mode monitors the channel for human messages between AI turns.
