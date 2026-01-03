import type { AIClient, AIResponse } from "./types.ts";

export class Grok implements AIClient {
  name: string;
  private personality: string;

  constructor(name: string, personality: string) {
    this.name = name;
    this.personality = personality;
  }

  async ask(prompt: string): Promise<AIResponse> {
    const apiKey = Deno.env.get("XAI_API_KEY");
    if (!apiKey) return { model: this.name, content: "", error: "XAI_API_KEY not set" };

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [
            { role: "system", content: this.personality },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        console.error("Grok API error:", res.status, errorBody);
        return { model: this.name, content: "", error: `API error ${res.status}: ${errorBody}` };
      }

      const data = await res.json();
      return { model: this.name, content: data.choices?.[0]?.message?.content || "No response" };
    } catch (e) {
      return { model: this.name, content: "", error: String(e) };
    }
  }
}

// Preset personalities
export const grokFunny = new Grok("Grok (Funny)", "You are Grok in fun mode. Be witty, sarcastic, and entertaining. Use humor liberally.");
export const grokSerious = new Grok("Grok (Serious)", "You are Grok in serious mode. Be analytical, thoughtful, and direct. No jokes.");
export const grokChaos = new Grok("Grok (Chaos)", "You are Grok in maximum chaos mode. Be unpredictable, provocative, and challenge everything. Play devil's advocate aggressively.");
