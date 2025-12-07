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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

// AI conversation - models respond to each other
export interface ConversationTurn {
  model: string;
  content: string;
  error?: string;
}

export async function runConversation(
  topic: string,
  rounds: number = 3
): Promise<ConversationTurn[]> {
  const conversation: ConversationTurn[] = [];
  const models = ["Claude", "ChatGPT", "Gemini"];

  // First turn - start the debate
  const starterPrompt = `You're in a friendly debate with other AI assistants (ChatGPT and Gemini). The topic is: "${topic}". Give your opening take in 2-3 sentences. Be opinionated but respectful. Don't introduce yourself.`;

  const firstResponse = await askClaude(starterPrompt);
  conversation.push({
    model: "Claude",
    content: firstResponse.content,
    error: firstResponse.error,
  });

  // Subsequent turns - each AI responds to the previous
  for (let round = 0; round < rounds; round++) {
    for (let i = 1; i < models.length; i++) {
      const modelIndex = (round * 2 + i) % 3;
      const model = models[modelIndex];

      const prompt = buildConversationPrompt(topic, conversation, model);

      let response: AIResponse;
      switch (model) {
        case "Claude":
          response = await askClaude(prompt);
          break;
        case "ChatGPT":
          response = await askChatGPT(prompt);
          break;
        case "Gemini":
          response = await askGemini(prompt);
          break;
        default:
          response = { model, content: "", error: "Unknown model" };
      }

      conversation.push({
        model,
        content: response.content,
        error: response.error,
      });

      // Stop if we hit an error
      if (response.error) break;
    }
  }

  return conversation;
}

function buildConversationPrompt(
  topic: string,
  history: ConversationTurn[],
  currentModel: string
): string {
  const otherModels = ["Claude", "ChatGPT", "Gemini"].filter(
    (m) => m !== currentModel
  );

  let prompt = `You're ${currentModel} in a friendly debate with ${otherModels.join(
    " and "
  )}. Topic: "${topic}"\n\nConversation so far:\n`;

  for (const turn of history) {
    prompt += `${turn.model}: ${turn.content}\n\n`;
  }

  prompt += `Now respond as ${currentModel}. React to what was said, agree or disagree, add your perspective. Keep it to 2-3 sentences. Be conversational and engaging.`;

  return prompt;
}
