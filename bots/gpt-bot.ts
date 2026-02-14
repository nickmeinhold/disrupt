// ChatGPT Bot - handles /gpt and /imagine commands

import { ApplicationCommandOptionTypes, type Bot, type Interaction } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { chatgpt } from "../src/ai/index.ts";
import { generateImage } from "../src/image.ts";
import { edit } from "../src/shared/discord-utils.ts";

const commands = [
  {
    name: "gpt",
    description: "Ask ChatGPT (OpenAI)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "imagine",
    description: "Generate an image with DALL-E 3",
    options: [
      { name: "prompt", description: "Describe the image", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
];

async function handleCommand(bot: Bot, interaction: Interaction, name: string, options: Map<string, unknown>): Promise<boolean> {
  if (name === "imagine") {
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
      const result = await generateImage(prompt);
      if (result.error || !result.imageData) {
        await edit(bot, interaction, `❌ ${result.error || "No image generated"}`);
        return true;
      }

      const content = result.revisedPrompt
        ? `🎨 **Prompt:** ${prompt}\n_${result.revisedPrompt.slice(0, 200)}_`
        : `🎨 **Prompt:** ${prompt}`;

      // Edit to show completion, then send image as follow-up
      await edit(bot, interaction, content);
      await bot.helpers.sendMessage(interaction.channelId!, {
        file: {
          name: "image.png",
          blob: new Blob([result.imageData as BlobPart], { type: "image/png" }),
        },
      });
    } catch (e) {
      console.error("Imagine error:", e);
      await edit(bot, interaction, `❌ Error: ${e}`);
    }

    return true;
  }

  // Let default handler process /gpt
  return false;
}

console.log("🚀 Starting ChatGPT Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_GPT",
  aiClient: chatgpt,
  commands,
  botIdentifier: "ChatGPT",
  onCommand: handleCommand,
});

await startAIBot(bot);
