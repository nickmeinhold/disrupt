export type { AIClient, AIResponse } from "./types.ts";
export { Claude } from "./claude.ts";
export { ChatGPT } from "./chatgpt.ts";
export { Gemini } from "./gemini.ts";

import { Claude } from "./claude.ts";
import { ChatGPT } from "./chatgpt.ts";
import { Gemini } from "./gemini.ts";
import type { AIResponse } from "./types.ts";

// Singleton instances
export const claude = new Claude();
export const chatgpt = new ChatGPT();
export const gemini = new Gemini();

export const clients = [claude, chatgpt, gemini];

export function askAll(prompt: string): Promise<AIResponse[]> {
  return Promise.all(clients.map((c) => c.ask(prompt)));
}
