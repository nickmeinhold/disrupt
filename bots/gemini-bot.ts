// Gemini Bot - handles /gemini command

import { ApplicationCommandOptionTypes } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { gemini } from "../src/ai/index.ts";

const commands = [
  {
    name: "gemini",
    description: "Ask Gemini (Google)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
];

console.log("🚀 Starting Gemini Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_GEMINI",
  aiClient: gemini,
  commands,
  botIdentifier: "Gemini",
});

await startAIBot(bot);
