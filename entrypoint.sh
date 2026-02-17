#!/bin/sh
set -e

# Forward SIGTERM/SIGINT to all child processes
trap 'kill $(jobs -p) 2>/dev/null; wait' SIGTERM SIGINT

# Start all 4 bots as background processes
deno run --allow-all bots/disruption-bot.ts &
deno run --allow-all bots/claude-bot.ts &
deno run --allow-all bots/gpt-bot.ts &
deno run --allow-all bots/gemini-bot.ts &

# Wait for all background processes
wait
