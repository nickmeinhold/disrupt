import {
  createBot,
  startBot,
  Intents,
  InteractionTypes,
  ApplicationCommandOptionTypes,
  type Bot,
  type Interaction,
} from "https://deno.land/x/discordeno@18.0.1/mod.ts";

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import {
  askClaude,
  askChatGPT,
  askGemini,
  askAll,
  runConversation,
  generateImage,
} from "./src/ai.ts";

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
  intents: Intents.Guilds | Intents.GuildMessages,
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
    {
      name: "debate",
      description: "Watch the AIs debate a topic with each other",
      options: [
        {
          name: "topic",
          description: "The topic for the AIs to debate",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
        {
          name: "rounds",
          description: "Number of rounds (1-5, default 2)",
          type: ApplicationCommandOptionTypes.Integer,
          required: false,
        },
      ],
    },
    {
      name: "imagine",
      description: "Generate an image with DALL-E 3",
      options: [
        {
          name: "prompt",
          description: "Describe the image you want to create",
          type: ApplicationCommandOptionTypes.String,
          required: true,
        },
      ],
    },
  ];

  try {
    // Use guild commands for instant updates (replace with your server ID)
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (guildId) {
      await bot.helpers.upsertGuildApplicationCommands(BigInt(guildId), commands);
      console.log("✅ Slash commands registered to guild!");
    } else {
      await bot.helpers.upsertGlobalApplicationCommands(commands);
      console.log("✅ Slash commands registered globally (may take up to 1 hour)!");
    }
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
}

// Handle slash command interactions
async function handleInteraction(bot: Bot, interaction: Interaction) {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const commandName = interaction.data?.name;
  const options = interaction.data?.options || [];
  const prompt = (options.find((o) => o.name === "prompt")?.value ||
    options.find((o) => o.name === "topic")?.value) as string;

  if (!prompt) {
    await bot.helpers.sendInteractionResponse(
      interaction.id,
      interaction.token,
      {
        type: 4,
        data: { content: "❌ Please provide a prompt!" },
      }
    );
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
      case "debate": {
        const rounds = Math.min(
          5,
          Math.max(
            1,
            (options.find((o) => o.name === "rounds")?.value as number) || 2
          )
        );
        const conversation = await runConversation(prompt, rounds);

        // Send header as initial response
        await bot.helpers.editOriginalInteractionResponse(interaction.token, {
          content: `🎙️ **AI Debate: ${prompt}**`,
        });

        // Send each turn as a separate message to the channel
        const channelId = interaction.channelId!;
        for (const turn of conversation) {
          const msg = turn.error
            ? `**${turn.model}:** ❌ ${turn.error}`
            : `**${turn.model}:** ${turn.content.slice(0, 1980)}`;

          await bot.helpers.sendMessage(channelId, { content: msg });
        }
        return; // Skip the normal response handling
      }
      case "imagine": {
        const result = await generateImage(prompt);

        if (result.error) {
          responseContent = `❌ Image generation failed: ${result.error}`;
        } else {
          // Send the image as an embed
          await bot.helpers.editOriginalInteractionResponse(interaction.token, {
            content: `🎨 **Prompt:** ${prompt}`,
            embeds: [
              {
                image: { url: result.imageUrl },
                footer: result.revisedPrompt
                  ? { text: `DALL-E revised: ${result.revisedPrompt.slice(0, 200)}` }
                  : undefined,
              },
            ],
          });
          return; // Skip the normal response handling
        }
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
