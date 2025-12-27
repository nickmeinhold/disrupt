// Claude Bot - handles /claude and /debate commands

import { ApplicationCommandOptionTypes, type Bot, type Interaction } from "@discordeno/mod.ts";
import { createAIBot, startAIBot } from "../src/shared/bot-factory.ts";
import { claude } from "../src/ai/index.ts";
import { formatDebateStart, formatTurnMessage, getNextParticipant, DEBATE_PARTICIPANTS } from "../src/shared/debate-protocol.ts";
import { edit } from "../src/shared/discord-utils.ts";

const commands = [
  {
    name: "claude",
    description: "Ask Claude (Anthropic)",
    options: [
      { name: "prompt", description: "Your question or prompt", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "debate",
    description: "Start an AI debate on a topic",
    options: [
      { name: "topic", description: "The topic to debate", type: ApplicationCommandOptionTypes.String, required: true },
      { name: "rounds", description: "Number of rounds (1-5)", type: ApplicationCommandOptionTypes.Integer, required: false },
    ],
  },
];

async function handleCommand(bot: Bot, interaction: Interaction, name: string, options: Map<string, unknown>): Promise<boolean> {
  if (name === "debate") {
    const topic = options.get("topic") as string;
    const rounds = Math.min(5, Math.max(1, (options.get("rounds") as number) || 2));

    if (!topic) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide a topic!" },
      });
      return true;
    }

    // Defer response
    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      // Post debate start message
      const startMsg = formatDebateStart(topic, rounds, "Claude");
      await edit(bot, interaction, startMsg);

      // Claude opens the debate
      const others = DEBATE_PARTICIPANTS.filter((p) => p !== "Claude").join(", ");
      const openerPrompt = `You're in a lively debate with ${others}. The topic is: "${topic}". You are an opinionated and confrontational AI. You often disagree with others but you always give strong arguments to back up your claims. You speak in a casual and informal style. You don't use long sentences or "big words". You avoid cliches and truisms. Your goal is to challenge their belief system. Keep your responses short, limited to 2-3 sentences. Don't introduce yourself.`;

      const response = await claude.ask(openerPrompt);
      if (response.error) {
        await bot.helpers.sendMessage(interaction.channelId!, { content: `**Claude:** ❌ ${response.error}` });
        return true;
      }

      // Post Claude's opener with next turn indicator
      const nextBot = getNextParticipant("Claude", 1, rounds);
      const turnMsg = formatTurnMessage("Claude", response.content, 1, nextBot, rounds);
      await bot.helpers.sendMessage(interaction.channelId!, { content: turnMsg });
    } catch (e) {
      console.error("Debate error:", e);
      await edit(bot, interaction, `❌ Error starting debate: ${e}`);
    }

    return true;
  }

  // Let default handler process /claude
  return false;
}

console.log("🚀 Starting Claude Bot...");
const bot = await createAIBot({
  tokenEnvVar: "DISCORD_TOKEN_CLAUDE",
  aiClient: claude,
  commands,
  botIdentifier: "Claude",
  onCommand: handleCommand,
});

await startAIBot(bot);
