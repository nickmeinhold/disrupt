// Common bot creation logic for all AI bots

import {
  createBot,
  startBot,
  Intents,
  InteractionTypes,
  type Bot,
  type Interaction,
  type CreateApplicationCommand,
} from "@discordeno/mod.ts";
import { load } from "std/dotenv/mod.ts";
import type { AIClient } from "../ai/types.ts";
import { parseDebateTurn, isDebateStart, formatTurnMessage, getNextParticipant, DEBATE_PARTICIPANTS } from "./debate-protocol.ts";
import { format, edit } from "./discord-utils.ts";

export interface BotConfig {
  tokenEnvVar: string;
  aiClient: AIClient;
  commands: CreateApplicationCommand[];
  botIdentifier: string;
  onCommand?: (bot: Bot, interaction: Interaction, name: string, options: Map<string, unknown>) => Promise<boolean>;
}

export async function createAIBot(config: BotConfig): Promise<Bot> {
  await load({ export: true });

  const token = Deno.env.get(config.tokenEnvVar);
  if (!token) {
    console.error(`❌ ${config.tokenEnvVar} is required!`);
    Deno.exit(1);
  }

  const bot = createBot({
    token,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
    events: {
      ready: async (bot, payload) => {
        console.log(`✅ ${payload.user.username} (${config.botIdentifier}) is online!`);
        await registerCommands(bot, config.commands);
      },
      interactionCreate: (bot, interaction) => handleInteraction(bot, interaction, config),
      messageCreate: (bot, message) => handleDebateMessage(bot, message, config),
    },
  });

  return bot;
}

export async function startAIBot(bot: Bot): Promise<void> {
  await startBot(bot);
}

async function registerCommands(bot: Bot, commands: CreateApplicationCommand[]) {
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

async function handleInteraction(bot: Bot, interaction: Interaction, config: BotConfig) {
  if (interaction.type !== InteractionTypes.ApplicationCommand) return;

  const name = interaction.data?.name;
  const options = new Map<string, unknown>();
  for (const opt of interaction.data?.options || []) {
    options.set(opt.name, opt.value);
  }

  // Let the bot handle custom commands first
  if (config.onCommand) {
    const handled = await config.onCommand(bot, interaction, name || "", options);
    if (handled) return;
  }

  // Default: simple AI query command
  const prompt = options.get("prompt") as string;
  if (!prompt) {
    return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
      type: 4,
      data: { content: "❌ Please provide a prompt!" },
    });
  }

  // Defer response
  await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

  try {
    const response = await config.aiClient.ask(prompt);
    await edit(bot, interaction, format(response));
  } catch (e) {
    console.error("Command error:", e);
    await edit(bot, interaction, `❌ Error: ${e}`);
  }
}

async function handleDebateMessage(bot: Bot, message: { channelId: bigint; authorId: bigint; content: string }, config: BotConfig) {
  // Ignore our own messages
  if (message.authorId === bot.id) return;

  // Check if this is a debate turn message meant for us
  const turn = parseDebateTurn(message.content);
  if (!turn || turn.next !== config.botIdentifier) return;

  console.log(`🎙️ ${config.botIdentifier}'s turn in debate!`);

  // Fetch recent message history for context
  const msgs = await bot.helpers.getMessages(message.channelId, { limit: 50 });
  const history: { model: string; content: string }[] = [];
  let topic = "";
  let round = 1;
  let totalRounds = 2;
  let articleContext = "";

  for (const m of [...msgs.values()].reverse()) {
    // Check for debate start — reset history to only track current debate
    const startInfo = isDebateStart(m.content);
    if (startInfo) {
      topic = startInfo.topic;
      totalRounds = startInfo.rounds;
      articleContext = startInfo.articleContext || "";
      history.length = 0;
    }

    // Parse debate turns for history
    const turnInfo = parseDebateTurn(m.content);
    if (turnInfo) {
      history.push({ model: turnInfo.speaker, content: turnInfo.content });
      round = turnInfo.round;
    }
  }

  if (!topic) {
    console.log(`⚠️ Could not find debate topic in ${msgs.size} messages, skipping turn`);
    return;
  }

  // Compute round from participant turns only (exclude Disruption moderator turns)
  const participantTurns = history.filter(h => DEBATE_PARTICIPANTS.includes(h.model)).length;
  const myTurnNumber = participantTurns + 1;
  round = Math.ceil(myTurnNumber / DEBATE_PARTICIPANTS.length);

  // Build prompt with context
  const others = DEBATE_PARTICIPANTS.filter((p) => p !== config.botIdentifier).join(", ");
  let prompt = `You're ${config.botIdentifier} in a lively debate with ${others}. Topic: "${topic}"\n\nConversation so far:\n`;

  for (const h of history) {
    prompt += `${h.model}: ${h.content}\n\n`;
  }

  if (articleContext) {
    prompt += `Article content being debated:\n${articleContext}\n\n`;
  }

  prompt += `Now respond as ${config.botIdentifier}. React to what was said, agree or disagree, add your perspective. Keep it to 2-3 sentences. Be conversational and engaging.`;

  try {
    const response = await config.aiClient.ask(prompt);
    if (response.error) {
      await bot.helpers.sendMessage(message.channelId, { content: `**${config.botIdentifier}:** ❌ ${response.error}` });
      return;
    }

    // Determine next participant
    const nextBot = getNextParticipant(config.botIdentifier, round, totalRounds);
    const formattedMsg = formatTurnMessage(config.botIdentifier, response.content, round, nextBot, totalRounds);

    await bot.helpers.sendMessage(message.channelId, { content: formattedMsg });
  } catch (e) {
    console.error("Debate turn error:", e);
  }
}
