import {
  createBot,
  startBot,
  Intents,
  InteractionTypes,
  ApplicationCommandOptionTypes,
  type Bot,
  type Interaction,
} from "@discordeno/mod.ts";

import { load } from "std/dotenv/mod.ts";
import { askClaude, askChatGPT, askGemini, askAll } from "./src/ai.ts";

// Load .env file
await load({ export: true });

const token = Deno.env.get("DISCORD_TOKEN");
if (!token) {
  console.error("❌ DISCORD_TOKEN is required! Copy .env.example to .env and add your token.");
  Deno.exit(1);
}

console.log("🚀 Starting Disrupt...");

const bot = createBot({
  token,
  intents: Intents.Guilds,
  events: {
    ready: (bot, payload) => {
      console.log(`✅ ${payload.user.username} is online!`);
      registerCommands(bot);
    },
    interactionCreate: async (bot, interaction) => {
      await handleInteraction(bot, interaction);
    },
  },
});

// Register slash commands
async function registerCommands(bot: Bot) {
  const commands = [
    {
      name: "claude",
      description: "Ask Claude (Anthropic)",
      options: [
        {
          name: "prompt",
          description: "Your question or prompt",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
      ],
    },
    {
      name: "gpt",
      description: "Ask ChatGPT (OpenAI)",
      options: [
        {
          name: "prompt",
          description: "Your question or prompt",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
      ],
    },
    {
      name: "gemini",
      description: "Ask Gemini (Google)",
      options: [
        {
          name: "prompt",
          description: "Your question or prompt",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
      ],
    },
    {
      name: "askall",
      description: "Ask all three AI models and compare responses",
      options: [
        {
          name: "prompt",
          description: "Your question or prompt",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
      ],
    },
  ];

  try {
    await bot.helpers.upsertGlobalApplicationCommands(commands);
    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
}

// Handle slash command interactions
async function handleInteraction(bot: Bot, interaction: Interaction) {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const commandName = interaction.data?.name;
  const options = interaction.data?.options || [];
  const prompt = options.find((o) => o.name === "prompt")?.value as string;

  if (!prompt) {
    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
      type: 4,
      data: { content: "❌ Please provide a prompt!" },
    });
    return;
  }

  // Defer the response (AI calls can take a few seconds)
  await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
    type: 5, // Deferred response
  });

  try {
    let responseContent: string;

    switch (commandName) {
      case "claude": {
        const result = await askClaude(prompt);
        responseContent = formatResponse("Claude", prompt, result.content, result.error);
        break;
      }
      case "gpt": {
        const result = await askChatGPT(prompt);
        responseContent = formatResponse("ChatGPT", prompt, result.content, result.error);
        break;
      }
      case "gemini": {
        const result = await askGemini(prompt);
        responseContent = formatResponse("Gemini", prompt, result.content, result.error);
        break;
      }
      case "askall": {
        const results = await askAll(prompt);
        responseContent = formatAllResponses(prompt, results);
        break;
      }
      default:
        responseContent = "❌ Unknown command";
    }

    // Discord has a 2000 char limit, so truncate if needed
    if (responseContent.length > 2000) {
      responseContent = responseContent.substring(0, 1997) + "...";
    }

    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      content: responseContent,
    });
  } catch (error) {
    console.error("Error handling command:", error);
    await bot.helpers.editOriginalInteractionResponse(interaction.token, {
      content: `❌ Error: ${String(error)}`,
    });
  }
}

function formatResponse(model: string, prompt: string, content: string, error?: string): string {
  if (error) {
    return `**${model}** ❌\n\`\`\`${error}\`\`\``;
  }
  return `**${model}**\n>>> ${content}`;
}

function formatAllResponses(prompt: string, results: { model: string; content: string; error?: string }[]): string {
  const lines = [`**Prompt:** ${prompt}\n`];
  
  for (const result of results) {
    if (result.error) {
      lines.push(`**${result.model}** ❌ ${result.error}\n`);
    } else {
      // Truncate each response to ~500 chars for askall
      const truncated = result.content.length > 500 
        ? result.content.substring(0, 497) + "..." 
        : result.content;
      lines.push(`**${result.model}**\n${truncated}\n`);
    }
  }
  
  return lines.join("\n");
}

// Start the bot
await startBot(bot);
