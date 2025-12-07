import type { AIClient, AIResponse } from "./types.ts";

export class Claude implements AIClient {
  name = "Claude";

  async ask(prompt: string): Promise<AIResponse> {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return { model: this.name, content: "", error: "ANTHROPIC_API_KEY not set" };

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        return { model: this.name, content: "", error: `API error: ${res.status}` };
      }

      const data = await res.json();
      return { model: this.name, content: data.content?.[0]?.text || "No response" };
    } catch (e) {
      return { model: this.name, content: "", error: String(e) };
    }
  }
}
