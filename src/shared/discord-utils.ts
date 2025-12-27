// Discord utility functions shared across bots

import type { Bot, Interaction } from "@discordeno/mod.ts";
import type { AIResponse } from "../ai/types.ts";

// Format an AI response for display
export function format(r: AIResponse): string {
  return r.error ? `**${r.model}** ❌ ${r.error}` : `**${r.model}**\n>>> ${r.content}`;
}

// Send an immediate response to an interaction
export function respond(bot: Bot, interaction: Interaction, content: string) {
  return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
    type: 4,
    data: { content },
  });
}

// Edit the deferred response
export function edit(bot: Bot, interaction: Interaction, content: string) {
  return bot.helpers.editOriginalInteractionResponse(interaction.token, {
    content: content.slice(0, 2000),
  });
}

// Discord's message character limit
export const DISCORD_CHAR_LIMIT = 2000;
