// Grok Bot - handles /grok, /grok-serious, /grok-chaos commands

import { ApplicationCommandOptionTypes, type Bot, type Interaction } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { grokFunny, grokSerious, grokChaos } from "../src/ai/index.ts";
import { format, edit } from "../src/shared/discord-utils.ts";

const commands = [
  {
    name: "grok",
    description: "Ask Grok - witty and sarcastic (xAI)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "grok-serious",
    description: "Ask Grok - analytical and direct (xAI)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "grok-chaos",
    description: "Ask Grok - chaotic devil's advocate (xAI)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
];

async function handleCommand(bot: Bot, interaction: Interaction, name: string, options: Map<string, unknown>): Promise<boolean> {
  // Handle personality variants
  if (name === "grok-serious" || name === "grok-chaos") {
    const prompt = options.get("prompt") as string;

    if (!prompt) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide a prompt!" },
      });
      return true;
    }

    // Defer response
    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      const client = name === "grok-serious" ? grokSerious : grokChaos;
      const response = await client.ask(prompt);
      await edit(bot, interaction, format(response));
    } catch (e) {
      console.error("Grok error:", e);
      await edit(bot, interaction, `❌ Error: ${e}`);
    }

    return true;
  }

  // Let default handler process /grok (uses grokFunny as default)
  return false;
}

console.log("🚀 Starting Grok Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_GROK",
  aiClient: grokFunny, // Default personality for debates and /grok
  commands,
  botIdentifier: "Grok",
  onCommand: handleCommand,
});

await startAIBot(bot);
