# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Disrupt consists of 4 separate Discord bots (Disruption, Claude, ChatGPT, Gemini), each running as an independent process with its own Discord bot token. Written in TypeScript using Deno with discordeno v18.

**Disruption bot** is the orchestrator and includes:
- AI debates between bots
- Image generation with DALL-E 3
- **Watermarking**: Invisible DFT-based watermarks that survive print-and-scan
- **Firebase Auth**: Discord users are automatically linked to Firebase accounts

## Commands

```bash
# Run individual bots
deno task disruption  # Disruption bot (orchestrator)
deno task claude      # Claude bot
deno task gpt         # ChatGPT bot
deno task gemini      # Gemini bot

# Run all bots at once
deno task all

# Run disruption bot directly
deno run --allow-all bots/disruption-bot.ts

# Type-check
deno check bots/*.ts
```

## Environment Variables

Required in `.env`:

```sh
# Discord bot tokens
DISCORD_TOKEN_DISRUPTION=...
DISCORD_TOKEN_CLAUDE=...
DISCORD_TOKEN_GPT=...
DISCORD_TOKEN_GEMINI=...
# AI API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...

# Firebase (for watermarking)
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
FIREBASE_PROJECT_ID=watermarking-4a428          # optional, has default
FIREBASE_STORAGE_BUCKET=watermarking-4a428.firebasestorage.app  # optional, has default

# Optional: Guild ID for instant command updates
DISCORD_GUILD_ID=your_server_id
```

## Architecture

```text
bots/
  disruption-bot.ts # Orchestrator: /debate, /imagine, /watermark, /detect
  claude-bot.ts     # Claude: responds in debates
  gpt-bot.ts        # ChatGPT: /gpt command
  gemini-bot.ts     # Gemini: responds in debates
src/
  ai/               # AI provider clients
    types.ts        # AIClient and AIResponse interfaces
    index.ts        # Singleton instances, exports
    claude.ts       # Anthropic Claude client
    chatgpt.ts      # OpenAI ChatGPT client
    gemini.ts       # Google Gemini client
  shared/           # Common bot utilities
    bot-factory.ts  # createAIBot() - common bot setup
    debate-protocol.ts  # Message format for cross-bot debates
    discord-utils.ts    # format(), edit(), respond() helpers
  image.ts          # DALL-E 3 image generation
  watermark.ts      # Firebase + watermarking integration (REST APIs)
```

## Watermarking Feature

### Commands

| Command | Description |
|---------|-------------|
| `/watermark image:<file> message:<text> [strength:1-10]` | Embed invisible watermark |
| `/detect original:<file> marked:<file>` | Extract hidden message |

### Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. User runs /watermark with image and message                     │
│  2. Bot authenticates user (creates Firebase Auth account)          │
│  3. Image uploaded to GCS, task created in Firestore                │
│  4. Bot responds immediately, polls in background                   │
│  5. Progress updates posted at 10%, 20%, ... intervals              │
│  6. Final result posted with original + watermarked images          │
└─────────────────────────────────────────────────────────────────────┘
```

### Firebase Integration

Uses **REST APIs** for Deno compatibility (no gRPC/npm issues):
- **Firestore REST API** for document operations
- **GCS JSON API** for image uploads
- **Identity Toolkit API** for Firebase Auth

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users/{firebaseUid}` | User profile with Discord ID |
| `discordUsers/{discordId}` | Index for Discord → Firebase UID lookup |
| `originalImages/{docId}` | Uploaded original images |
| `markedImages/{docId}` | Watermarked image results |
| `tasks/{taskId}` | Backend processing queue |

### Firebase Auth

Discord users are automatically linked to Firebase Auth:
1. First command: Creates Firebase user with Discord username
2. Stores mapping in `discordUsers/{discordId}` → `{firebaseUid}`
3. Subsequent commands: Looks up existing Firebase UID
4. All storage paths use Firebase UID

This enables future web app sign-in with Discord OAuth.

## Firebase Project

Backend processing uses: `watermarking-4a428`
- Cloud Run: `https://watermarking-backend-78940960204.us-central1.run.app`
- Storage: `watermarking-4a428.firebasestorage.app`

The backend needs to be "woken up" (scales from zero) before processing tasks.

## Key Patterns

- **AIClient interface**: All AI providers implement `{ name: string; ask(prompt: string): Promise<AIResponse> }`.
- **Debate protocol**: Bots coordinate via Discord messages with `[NEXT: BotName]` metadata.
- **Background polling**: Watermark commands respond immediately, poll in background, post updates.
- **REST-only Firebase**: Uses fetch() for all Firebase operations to avoid Deno npm compatibility issues.

## Debate Flow

1. `/debate` command posts a `[DEBATE_START]` message and Claude's opening
2. Each turn message includes `[NEXT: BotName]` indicating whose turn is next
3. All bots watch channel messages; when a bot sees its name in `NEXT:`, it takes its turn
4. Continues until all rounds complete (`NEXT: END`)
