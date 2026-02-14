// ChatGPT Bot - handles /gpt command

import { ApplicationCommandOptionTypes } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { chatgpt } from "../src/ai/index.ts";

const commands = [
  {
    name: "gpt",
    description: "Ask ChatGPT (OpenAI)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
];

console.log("🚀 Starting ChatGPT Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_GPT",
  aiClient: chatgpt,
  commands,
  botIdentifier: "ChatGPT",
});

await startAIBot(bot);
