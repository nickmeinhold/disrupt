// AI API clients

export interface AIResponse {
  model: string;
  content: string;
  error?: string;
}

export async function askClaude(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { model: "Claude", content: "", error: "ANTHROPIC_API_KEY not set" };

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
      return { model: "Claude", content: "", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    return { model: "Claude", content: data.content?.[0]?.text || "No response" };
  } catch (e) {
    return { model: "Claude", content: "", error: String(e) };
  }
}

export async function askChatGPT(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { model: "ChatGPT", content: "", error: "OPENAI_API_KEY not set" };

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
      return { model: "ChatGPT", content: "", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    return { model: "ChatGPT", content: data.choices?.[0]?.message?.content || "No response" };
  } catch (e) {
    return { model: "ChatGPT", content: "", error: String(e) };
  }
}

export async function askGemini(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) return { model: "Gemini", content: "", error: "GOOGLE_AI_API_KEY not set" };

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
      return { model: "Gemini", content: "", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    return { model: "Gemini", content: data.candidates?.[0]?.content?.parts?.[0]?.text || "No response" };
  } catch (e) {
    return { model: "Gemini", content: "", error: String(e) };
  }
}

export function askAll(prompt: string): Promise<AIResponse[]> {
  return Promise.all([askClaude(prompt), askChatGPT(prompt), askGemini(prompt)]);
}

export interface ImageResponse {
  imageUrl: string;
  revisedPrompt?: string;
  error?: string;
}

export async function generateImage(prompt: string): Promise<ImageResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { imageUrl: "", error: "OPENAI_API_KEY not set" };

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1024" }),
    });

    if (!res.ok) {
      return { imageUrl: "", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return { imageUrl: "", error: "No image URL in response" };

    return { imageUrl, revisedPrompt: data.data?.[0]?.revised_prompt };
  } catch (e) {
    return { imageUrl: "", error: String(e) };
  }
}
