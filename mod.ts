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

import { askClaude, askChatGPT, askGemini, askAll, generateImage } from "./src/ai.ts";
import { runDebate } from "./src/debate.ts";

// Load .env file
await load({ export: true });

const token = Deno.env.get("DISCORD_TOKEN");
if (!token) {
  console.error("❌ DISCORD_TOKEN is required!");
  Deno.exit(1);
}

// Slash command definitions
const commands = [
  { name: "claude", description: "Ask Claude (Anthropic)", options: [promptOption()] },
  { name: "gpt", description: "Ask ChatGPT (OpenAI)", options: [promptOption()] },
  { name: "gemini", description: "Ask Gemini (Google)", options: [promptOption()] },
  { name: "askall", description: "Ask all three AI models", options: [promptOption()] },
  { name: "imagine", description: "Generate an image with DALL-E 3", options: [promptOption("Describe the image")] },
  {
    name: "debate",
    description: "Watch the AIs debate a topic",
    options: [
      { name: "topic", description: "The topic to debate", type: ApplicationCommandOptionTypes.String, required: true },
      { name: "rounds", description: "Number of rounds (1-5)", type: ApplicationCommandOptionTypes.Integer, required: false },
    ],
  },
];

function promptOption(desc = "Your question or prompt") {
  return { name: "prompt", description: desc, type: ApplicationCommandOptionTypes.String, required: true };
}

// Bot setup
const bot = createBot({
  token,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: (bot, payload) => {
      console.log(`✅ ${payload.user.username} is online!`);
      registerCommands(bot);
    },
    interactionCreate: (bot, interaction) => handleCommand(bot, interaction),
  },
});

async function registerCommands(bot: Bot) {
  try {
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (guildId) {
      await bot.helpers.upsertGuildApplicationCommands(BigInt(guildId), commands);
      console.log("✅ Commands registered to guild");
    } else {
      await bot.helpers.upsertGlobalApplicationCommands(commands);
      console.log("✅ Commands registered globally");
    }
  } catch (e) {
    console.error("❌ Failed to register commands:", e);
  }
}

async function handleCommand(bot: Bot, interaction: Interaction) {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const name = interaction.data?.name;
  const options = interaction.data?.options || [];
  const prompt = (options.find((o) => o.name === "prompt")?.value ||
    options.find((o) => o.name === "topic")?.value) as string;

  if (!prompt) {
    return respond(bot, interaction, "❌ Please provide a prompt!");
  }

  // Defer response (AI calls take time)
  await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

  try {
    switch (name) {
      case "claude": {
        const r = await askClaude(prompt);
        return edit(bot, interaction, format(r));
      }
      case "gpt": {
        const r = await askChatGPT(prompt);
        return edit(bot, interaction, format(r));
      }
      case "gemini": {
        const r = await askGemini(prompt);
        return edit(bot, interaction, format(r));
      }
      case "askall": {
        const results = await askAll(prompt);
        const text = results.map((r) => format(r)).join("\n\n");
        return edit(bot, interaction, `**Prompt:** ${prompt}\n\n${text}`);
      }
      case "debate": {
        const rounds = Math.min(5, Math.max(1, (options.find((o) => o.name === "rounds")?.value as number) || 2));
        await edit(bot, interaction, `🎙️ **AI Debate: ${prompt}**`);

        await runDebate(prompt, rounds, async (turn) => {
          const msg = turn.error ? `**${turn.model}:** ❌ ${turn.error}` : `**${turn.model}:** ${turn.content.slice(0, 1980)}`;
          await bot.helpers.sendMessage(interaction.channelId!, { content: msg });
        });
        return;
      }
      case "imagine": {
        const r = await generateImage(prompt);
        if (r.error) return edit(bot, interaction, `❌ ${r.error}`);

        return bot.helpers.editOriginalInteractionResponse(interaction.token, {
          content: `🎨 **Prompt:** ${prompt}`,
          embeds: [{ image: { url: r.imageUrl }, footer: r.revisedPrompt ? { text: r.revisedPrompt.slice(0, 200) } : undefined }],
        });
      }
      default:
        return edit(bot, interaction, "❌ Unknown command");
    }
  } catch (e) {
    console.error("Command error:", e);
    return edit(bot, interaction, `❌ Error: ${e}`);
  }
}

function format(r: { model: string; content: string; error?: string }): string {
  return r.error ? `**${r.model}** ❌ ${r.error}` : `**${r.model}**\n>>> ${r.content}`;
}

function respond(bot: Bot, i: Interaction, content: string) {
  return bot.helpers.sendInteractionResponse(i.id, i.token, { type: 4, data: { content } });
}

function edit(bot: Bot, i: Interaction, content: string) {
  return bot.helpers.editOriginalInteractionResponse(i.token, { content: content.slice(0, 2000) });
}

console.log("🚀 Starting Disrupt...");
await startBot(bot);
