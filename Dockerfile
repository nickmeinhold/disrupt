FROM denoland/deno:2.6.10

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY deno.json deno.lock ./

# Copy source files
COPY src/ src/
COPY bots/ bots/

# Cache dependencies for all 4 bot entrypoints
RUN deno cache --allow-import bots/disruption-bot.ts bots/claude-bot.ts bots/gpt-bot.ts bots/gemini-bot.ts

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
