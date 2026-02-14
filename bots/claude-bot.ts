// Claude Bot - handles /claude command

import { ApplicationCommandOptionTypes } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { claude } from "../src/ai/index.ts";

const commands = [
  {
    name: "claude",
    description: "Ask Claude (Anthropic)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
];

console.log("🚀 Starting Claude Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_CLAUDE",
  aiClient: claude,
  commands,
  botIdentifier: "Claude",
});

await startAIBot(bot);
