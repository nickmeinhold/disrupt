import type { AIClient, AIResponse } from "./types.ts";

export interface SearchResponse extends AIResponse {
  sources?: { title: string; url: string }[];
}

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

  async search(query: string): Promise<SearchResponse> {
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) return { model: this.name, content: "", error: "GOOGLE_AI_API_KEY not set" };

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: query }] }],
            tools: [{ google_search: {} }],
          }),
        }
      );

      if (!res.ok) {
        return { model: this.name, content: "", error: `API error: ${res.status}` };
      }

      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

      // Extract sources from grounding metadata
      const sources: { title: string; url: string }[] = [];
      const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        for (const chunk of chunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, url: chunk.web.uri });
          }
        }
      }

      return { model: this.name, content, sources };
    } catch (e) {
      return { model: this.name, content: "", error: String(e) };
    }
  }
}
