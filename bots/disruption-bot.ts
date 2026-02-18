// Disruption Bot - orchestrates AI debates, image generation, and watermarking

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
import { claude, gemini } from "../src/ai/index.ts";
import { formatDebateStart, formatDebateStartWithContext, formatTurnMessage, getNextParticipant, parseDebateTurn, isDebateStart, DEBATE_PARTICIPANTS } from "../src/shared/debate-protocol.ts";
import { edit } from "../src/shared/discord-utils.ts";
import { generateImage } from "../src/image.ts";
import {
  initializeWatermarking,
  getOrCreateFirebaseUser,
  uploadImageToStorage,
  uploadDetectionImages,
  createMarkingTask,
  createDetectionTask,
  pollForMarkingResultWithProgress,
  pollForDetectionResult,
} from "../src/watermark.ts";

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
  {
    name: "imagine",
    description: "Generate an image with DALL-E 3",
    options: [
      { name: "prompt", description: "Describe the image", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "watermark",
    description: "Apply an invisible watermark to an image",
    options: [
      { name: "image", description: "The image to watermark", type: ApplicationCommandOptionTypes.Attachment, required: true },
      { name: "message", description: "Hidden message to embed", type: ApplicationCommandOptionTypes.String, required: true },
      { name: "strength", description: "Watermark strength 1-10 (default 5)", type: ApplicationCommandOptionTypes.Integer, required: false, minValue: 1, maxValue: 10 },
    ],
  },
  {
    name: "search",
    description: "Search the web and get an AI-powered answer",
    options: [
      { name: "query", description: "What to search for", type: ApplicationCommandOptionTypes.String, required: true },
    ],
  },
  {
    name: "detect",
    description: "Detect and extract a watermark from an image",
    options: [
      { name: "original", description: "The original unwatermarked image", type: ApplicationCommandOptionTypes.Attachment, required: true },
      { name: "marked", description: "The watermarked image to analyze", type: ApplicationCommandOptionTypes.Attachment, required: true },
    ],
  },
];

const URL_REGEX = /https?:\/\/[^\s>)]+/g;

async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DisruptBot/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = await res.text();
    // Strip HTML tags, scripts, styles, and decode entities
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000); // Cap at 4000 chars
  } catch (e) {
    console.error(`Failed to fetch URL ${url}:`, e);
    return null;
  }
}

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
      // Check if topic contains a URL and fetch content
      const urls = topic.match(URL_REGEX);
      let articleContext = "";
      let startMsg: string;

      if (urls && urls.length > 0) {
        await edit(bot, interaction, "📖 Reading article...");
        const content = await fetchUrlContent(urls[0]);
        if (content) {
          articleContext = content;
          startMsg = formatDebateStartWithContext(topic, rounds, "Claude", urls[0], articleContext.slice(0, 500));
        } else {
          startMsg = formatDebateStart(topic, rounds, "Claude");
        }
      } else {
        startMsg = formatDebateStart(topic, rounds, "Claude");
      }

      // Post debate start message
      await edit(bot, interaction, startMsg);

      // Generate Claude's opening turn
      const others = DEBATE_PARTICIPANTS.filter((p) => p !== "Claude").join(", ");
      let openerPrompt = `You're in a lively debate with ${others}. The topic is: "${topic}". You are an opinionated and confrontational AI. You often disagree with others but you always give strong arguments to back up your claims. You speak in a casual and informal style. You don't use long sentences or "big words". You avoid cliches and truisms. Your goal is to challenge their belief system. Keep your responses short, limited to 2-3 sentences. Don't introduce yourself.`;

      if (articleContext) {
        openerPrompt += `\n\nHere is the article content to debate:\n${articleContext}`;
      }

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

  if (name === "imagine") {
    const prompt = options.get("prompt") as string;

    if (!prompt) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide a prompt!" },
      });
      return;
    }

    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      const result = await generateImage(prompt);
      if (result.error || !result.imageData) {
        await edit(bot, interaction, `❌ ${result.error || "No image generated"}`);
        return;
      }

      const content = result.revisedPrompt
        ? `🎨 **Prompt:** ${prompt}\n_${result.revisedPrompt.slice(0, 200)}_`
        : `🎨 **Prompt:** ${prompt}`;

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
  }

  if (name === "search") {
    const query = options.get("query") as string;

    if (!query) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide a search query!" },
      });
      return;
    }

    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      const result = await gemini.search(query);
      if (result.error) {
        await edit(bot, interaction, `❌ ${result.error}`);
        return;
      }

      let response = `🔍 **${query}**\n\n${result.content.slice(0, 1800)}`;

      if (result.sources && result.sources.length > 0) {
        const uniqueSources = result.sources.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i).slice(0, 5);
        response += "\n\n**Sources:**\n" + uniqueSources.map(s => `- [${s.title}](${s.url})`).join("\n");
      }

      await edit(bot, interaction, response);
    } catch (e) {
      console.error("Search error:", e);
      await edit(bot, interaction, `❌ Error: ${e}`);
    }
  }

  if (name === "watermark") {
    const attachmentId = options.get("image") as string;
    const message = options.get("message") as string;
    const strength = (options.get("strength") as number) ?? 5;

    // Resolve attachment from interaction data
    const resolved = interaction.data?.resolved;
    const attachment = resolved?.attachments?.get(BigInt(attachmentId));

    if (!attachment?.url || !message) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide an image and message!" },
      });
      return;
    }

    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      console.log(`[watermark] Fetching image from Discord: ${attachment.url}`);
      const response = await fetch(attachment.url);
      if (!response.ok) {
        await edit(bot, interaction, `❌ Failed to fetch image from Discord (${response.status})`);
        return;
      }
      const imageBuffer = new Uint8Array(await response.arrayBuffer());
      console.log(`[watermark] Image fetched, size: ${imageBuffer.length} bytes`);

      const requestId = `${Date.now()}`;

      // Get or create Firebase Auth user for this Discord user
      await edit(bot, interaction, "🔐 Authenticating...");
      const userId = await getOrCreateFirebaseUser(
        String(interaction.user.id),
        interaction.user.username
      );

      await edit(bot, interaction, "📤 Uploading image...");
      console.log(`[watermark] Uploading to GCS...`);
      const { gcsPath, originalImageId } = await uploadImageToStorage(
        userId,
        requestId,
        attachment.filename,
        imageBuffer
      );
      console.log(`[watermark] Upload complete: ${gcsPath}`);

      console.log(`[watermark] Creating marking task...`);
      const { taskId, markedImageId } = await createMarkingTask({
        userId,
        originalImageId,
        imageName: attachment.filename,
        imagePath: gcsPath,
        message,
        strength,
      });

      // Respond immediately - don't block
      await edit(bot, interaction,
        `⏳ **Watermarking started!**\n` +
        `**Message:** \`${message}\`\n` +
        `**Strength:** ${strength}\n\n` +
        `I'll update progress and post the result when ready...`
      );

      const channelId = interaction.channelId!;
      const userMention = `<@${interaction.user.id}>`;

      // Poll in background with progress updates
      let lastUpdatePercent = -1;
      let progressMessageId: bigint | undefined;

      pollForMarkingResultWithProgress(
        taskId,
        markedImageId,
        async (progress) => {
          try {
            if (progress.status === "completed" && progress.servingUrl) {
              // Final result - post watermarked image
              console.log(`[watermark] Complete! Fetching result...`);
              const watermarkedResponse = await fetch(progress.servingUrl);
              const watermarkedBuffer = await watermarkedResponse.arrayBuffer();

              // Delete progress message if exists
              if (progressMessageId) {
                try {
                  await bot.helpers.deleteMessage(channelId, progressMessageId);
                } catch { /* ignore */ }
              }

              await bot.helpers.sendMessage(channelId, {
                content: `${userMention} ✅ **Watermark complete!**\n**Message:** \`${message}\``,
              });

              await bot.helpers.sendMessage(channelId, {
                content: "**Original:**",
                file: {
                  name: "original.png",
                  blob: new Blob([imageBuffer], { type: "image/png" }),
                },
              });

              await bot.helpers.sendMessage(channelId, {
                content: "**Watermarked:**",
                file: {
                  name: "watermarked.png",
                  blob: new Blob([watermarkedBuffer], { type: "image/png" }),
                },
              });
            } else if (progress.percent !== undefined && progress.percent > lastUpdatePercent) {
              // Progress update at 10% intervals
              lastUpdatePercent = Math.floor(progress.percent / 10) * 10;
              const progressBar = "█".repeat(Math.floor(progress.percent / 10)) + "░".repeat(10 - Math.floor(progress.percent / 10));
              const progressText = `⏳ **Watermarking...** [${progressBar}] ${progress.percent}%\n${progress.progress || ""}`;

              console.log(`[watermark] Progress: ${progress.percent}%`);

              if (progressMessageId) {
                await bot.helpers.editMessage(channelId, progressMessageId, { content: progressText });
              } else {
                const msg = await bot.helpers.sendMessage(channelId, { content: progressText });
                progressMessageId = msg.id;
              }
            }
          } catch (e) {
            console.error("[watermark] Progress update error:", e);
          }
        }
      ).then(async (result) => {
        if (!result.success) {
          await bot.helpers.sendMessage(channelId, {
            content: `${userMention} ❌ **Watermarking failed:** ${result.error || "Unknown error"}`,
          });
        }
      }).catch(async (e) => {
        console.error("[watermark] Background poll error:", e);
        await bot.helpers.sendMessage(channelId, {
          content: `${userMention} ❌ **Watermarking error:** ${e}`,
        });
      });

    } catch (e) {
      console.error("Watermark error:", e);
      await edit(bot, interaction, `❌ Error: ${e}`);
    }
  }

  if (name === "detect") {
    const originalId = options.get("original") as string;
    const markedId = options.get("marked") as string;

    // Resolve attachments from interaction data
    const resolved = interaction.data?.resolved;
    const original = resolved?.attachments?.get(BigInt(originalId));
    const marked = resolved?.attachments?.get(BigInt(markedId));

    if (!original?.url || !marked?.url) {
      await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
        type: 4,
        data: { content: "❌ Please provide both original and marked images!" },
      });
      return;
    }

    await bot.helpers.sendInteractionResponse(interaction.id, interaction.token, { type: 5 });

    try {
      // Get or create Firebase Auth user for this Discord user
      await edit(bot, interaction, "🔐 Authenticating...");
      const userId = await getOrCreateFirebaseUser(
        String(interaction.user.id),
        interaction.user.username
      );
      const requestId = `detect-${Date.now()}`;

      const [originalResponse, markedResponse] = await Promise.all([
        fetch(original.url),
        fetch(marked.url),
      ]);

      const originalBuffer = new Uint8Array(await originalResponse.arrayBuffer());
      const markedBuffer = new Uint8Array(await markedResponse.arrayBuffer());

      await edit(bot, interaction, "📤 Uploading images...");
      const { originalPath, markedPath } = await uploadDetectionImages(
        userId,
        requestId,
        originalBuffer,
        markedBuffer
      );

      await edit(bot, interaction, "🔍 Starting detection...");
      await createDetectionTask(userId, requestId, originalPath, markedPath);

      await edit(bot, interaction, "⏳ Analyzing image...");
      const result = await pollForDetectionResult(userId, requestId);

      if (result.success && result.message) {
        await edit(bot, interaction,
          `✅ **Watermark Detected!**\n` +
          `**Message:** \`${result.message}\`\n` +
          `**Confidence:** ${result.confidence?.toFixed(2) || "N/A"}`
        );
      } else if (result.success && !result.message) {
        await edit(bot, interaction, "ℹ️ No watermark detected in this image.");
      } else {
        await edit(bot, interaction, `❌ Detection failed: ${result.error || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Detection error:", e);
      await edit(bot, interaction, `❌ Error: ${e}`);
    }
  }
}

// Initialize watermarking service if credentials are available
if (Deno.env.get("FIREBASE_SERVICE_ACCOUNT")) {
  await initializeWatermarking();
}

async function handleDebateConsensus(bot: Bot, message: { channelId: bigint; authorId: bigint; content: string }) {
  // Ignore our own messages
  if (message.authorId === bot.id) return;

  // Check if this is a debate turn meant for us (consensus check)
  const turn = parseDebateTurn(message.content);
  if (!turn || turn.next !== "Disruption") return;

  console.log("🧑‍⚖️ Disruption checking for consensus...");

  // Fetch recent history
  const msgs = await bot.helpers.getMessages(message.channelId, { limit: 50 });
  const history: { speaker: string; content: string }[] = [];
  let topic = "";
  let totalRounds = 2;

  for (const m of [...msgs.values()].reverse()) {
    const startInfo = isDebateStart(m.content);
    if (startInfo) {
      topic = startInfo.topic;
      totalRounds = startInfo.rounds;
      history.length = 0;
    }
    const turnInfo = parseDebateTurn(m.content);
    if (turnInfo) {
      history.push({ speaker: turnInfo.speaker, content: turnInfo.content });
    }
  }

  if (!topic || history.length === 0) return;

  // Ask Claude to judge consensus
  const debateText = history.map(h => `${h.speaker}: ${h.content}`).join("\n\n");
  const judgePrompt = `You are a debate moderator. Analyze this debate and determine if the participants have reached consensus.

Topic: "${topic}"

${debateText}

Have the participants reached a clear consensus or agreement? Respond with EXACTLY one of these formats:
- If consensus: "CONSENSUS: [one sentence summary of what they agree on]"
- If no consensus: "NO_CONSENSUS: [one sentence on the key disagreement]"`;

  try {
    const response = await claude.ask(judgePrompt);
    if (response.error) {
      console.error("Consensus check error:", response.error);
      // Continue the debate on error
      const nextRound = turn.round + 1;
      const continueMsg = formatTurnMessage("Disruption", "Let's continue...", nextRound, DEBATE_PARTICIPANTS[0], totalRounds);
      await bot.helpers.sendMessage(message.channelId, { content: continueMsg });
      return;
    }

    const isConsensus = response.content.trim().startsWith("CONSENSUS:");

    if (isConsensus) {
      const summary = response.content.trim().replace("CONSENSUS:", "").trim();
      await bot.helpers.sendMessage(message.channelId, {
        content: `🧑‍⚖️ **Consensus Reached!**\n\n${summary}\n\n🏁 **Debate Complete!** (ended early — round ${turn.round} of ${totalRounds})\n[DEBATE_TURN | Round: ${turn.round} | Turn: 0 | NEXT: END]`,
      });
    } else {
      // No consensus — continue to next round (if rounds remain)
      const disagreement = response.content.trim().replace("NO_CONSENSUS:", "").trim();
      const nextRound = turn.round + 1;

      if (nextRound > totalRounds) {
        await bot.helpers.sendMessage(message.channelId, {
          content: `🧑‍⚖️ **No consensus reached.**\n\n${disagreement}\n\n🏁 **Debate Complete!** (${totalRounds} rounds)\n[DEBATE_TURN | Round: ${turn.round} | Turn: 0 | NEXT: END]`,
        });
        return;
      }

      const continueMsg = formatTurnMessage("Disruption", `Still no consensus: ${disagreement} — let's hear more!`, nextRound, DEBATE_PARTICIPANTS[0], totalRounds);
      await bot.helpers.sendMessage(message.channelId, { content: continueMsg });
      console.log(`🧑‍⚖️ No consensus after round ${turn.round}, continuing to round ${nextRound}`);
    }
  } catch (e) {
    console.error("Consensus check error:", e);
  }
}

const bot = createBot({
  token,
  intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
  events: {
    ready: async (bot, payload) => {
      console.log(`✅ ${payload.user.username} (Disruption) is online!`);
      await registerCommands(bot);
    },
    interactionCreate: (bot, interaction) => handleInteraction(bot, interaction),
    messageCreate: (bot, message) => handleDebateConsensus(bot, message),
  },
});

console.log("🚀 Starting Disruption Bot...");
await startBot(bot);
