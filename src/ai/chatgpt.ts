import type { AIClient, AIResponse } from "./types.ts";

export class ChatGPT implements AIClient {
  name = "ChatGPT";

  async ask(prompt: string): Promise<AIResponse> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return { model: this.name, content: "", error: "OPENAI_API_KEY not set" };

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        return { model: this.name, content: "", error: `API error: ${res.status}` };
      }

      const data = await res.json();
      return { model: this.name, content: data.choices?.[0]?.message?.content || "No response" };
    } catch (e) {
      return { model: this.name, content: "", error: String(e) };
    }
  }
}
