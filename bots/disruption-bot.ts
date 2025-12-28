// Disruption Bot - orchestrates AI debates and other multi-bot interactions

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
import { claude } from "../src/ai/index.ts";
import { formatDebateStart, formatTurnMessage, getNextParticipant, DEBATE_PARTICIPANTS } from "../src/shared/debate-protocol.ts";
import { edit } from "../src/shared/discord-utils.ts";

await load({ export: true });

const token = Deno.env.get("DISCORD_TOKEN_DISRUPTION");
if (!token) {
  console.error("❌ DISCORD_TOKEN_DISRUPTION is required!");
  Deno.exit(1);
}

const commands = [
  {
    name: "debate",
    description: "Start an AI debate on a topic",
    options: [
      { name: "topic", description: "The topic to debate", type: ApplicationCommandOptionTypes.String, required: true },
      { name: "rounds", description: "Number of rounds (1-5)", type: ApplicationCommandOptionTypes.Integer, required: false },
    ],
  },
];

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

async function handleInteraction(bot: Bot, interaction: Interaction) {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const name = interaction.data?.name;
  const options = new Map<string, unknown>();
  for (const opt of interaction.data?.options || []) {
    options.set(opt.name, opt.value);
  }

  if (name === "debate") {
    const topic = options.get("topic") as string;
    const rounds = Math.min(5, Math.max(1, (options.get("rounds") as number) || 2));

    if (!topic) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide a topic!" },
      });
      return;
    }

    // Defer response
    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      // Post debate start message
      const startMsg = formatDebateStart(topic, rounds, "Claude");
      await edit(bot, interaction, startMsg);

      // Generate Claude's opening turn
      const others = DEBATE_PARTICIPANTS.filter((p) => p !== "Claude").join(", ");
      const openerPrompt = `You're in a lively debate with ${others}. The topic is: "${topic}". You are an opinionated and confrontational AI. You often disagree with others but you always give strong arguments to back up your claims. You speak in a casual and informal style. You don't use long sentences or "big words". You avoid cliches and truisms. Your goal is to challenge their belief system. Keep your responses short, limited to 2-3 sentences. Don't introduce yourself.`;

      const response = await claude.ask(openerPrompt);
      if (response.error) {
        await bot.helpers.sendMessage(interaction.channelId!, { content: `**Claude:** ❌ ${response.error}` });
        return;
      }

      // Post Claude's opener with next turn indicator
      const nextBot = getNextParticipant("Claude", 1, rounds);
      const turnMsg = formatTurnMessage("Claude", response.content, 1, nextBot, rounds);
      await bot.helpers.sendMessage(interaction.channelId!, { content: turnMsg });
    } catch (e) {
      console.error("Debate error:", e);
      await edit(bot, interaction, `❌ Error starting debate: ${e}`);
    }
  }
}

const bot = createBot({
  token,
  intents: Intents.Guilds | Intents.GuildMessages,
  events: {
    ready: async (bot, payload) => {
      console.log(`✅ ${payload.user.username} (Disruption) is online!`);
      await registerCommands(bot);
    },
    interactionCreate: (bot, interaction) => handleInteraction(bot, interaction),
  },
});

console.log("🚀 Starting Disruption Bot...");
await startBot(bot);
