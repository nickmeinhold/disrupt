// API clients for Claude, ChatGPT, and Gemini

export interface AIResponse {
  model: string;
  content: string;
  error?: string;
}

// Claude (Anthropic)
export async function askClaude(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { model: "Claude", content: "", error: "ANTHROPIC_API_KEY not set" };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!response.ok) {
      const error = await response.text();
      return { model: "Claude", content: "", error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "No response";
    return { model: "Claude", content };
  } catch (error) {
    return { model: "Claude", content: "", error: String(error) };
  }
}

// ChatGPT (OpenAI)
export async function askChatGPT(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return { model: "ChatGPT", content: "", error: "OPENAI_API_KEY not set" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { model: "ChatGPT", content: "", error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No response";
    return { model: "ChatGPT", content };
  } catch (error) {
    return { model: "ChatGPT", content: "", error: String(error) };
  }
}

// Gemini (Google AI)
export async function askGemini(prompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    return { model: "Gemini", content: "", error: "GOOGLE_AI_API_KEY not set" };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { model: "Gemini", content: "", error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
    return { model: "Gemini", content };
  } catch (error) {
    return { model: "Gemini", content: "", error: String(error) };
  }
}

// Ask all three models in parallel
export async function askAll(prompt: string): Promise<AIResponse[]> {
  const results = await Promise.all([
    askClaude(prompt),
    askChatGPT(prompt),
    askGemini(prompt),
  ]);
  return results;
}
