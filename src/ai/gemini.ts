import type { AIClient, AIResponse } from "./types.ts";

export class Gemini implements AIClient {
  name = "Gemini";

  async ask(prompt: string): Promise<AIResponse> {
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) return { model: this.name, content: "", error: "GOOGLE_AI_API_KEY not set" };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (!res.ok) {
        return { model: this.name, content: "", error: `API error: ${res.status}` };
      }

      const data = await res.json();
      return { model: this.name, content: data.candidates?.[0]?.content?.parts?.[0]?.text || "No response" };
    } catch (e) {
      return { model: this.name, content: "", error: String(e) };
    }
  }
}
