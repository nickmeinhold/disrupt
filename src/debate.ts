// AI debate/conversation logic

import { askClaude, askChatGPT, askGemini, type AIResponse } from "./ai.ts";

export interface ConversationTurn {
  model: string;
  content: string;
  error?: string;
}

const MODELS = ["Claude", "ChatGPT", "Gemini"] as const;

export async function runDebate(
  topic: string,
  rounds: number,
  onTurn: (turn: ConversationTurn) => Promise<void>
): Promise<void> {
  const history: ConversationTurn[] = [];

  // Claude opens the debate
  const opener = await askClaude(buildOpenerPrompt(topic));
  const firstTurn = { model: "Claude", content: opener.content, error: opener.error };
  history.push(firstTurn);
  await onTurn(firstTurn);

  // Subsequent turns
  for (let round = 0; round < rounds; round++) {
    for (let i = 1; i < MODELS.length; i++) {
      const modelIndex = (round * 2 + i) % 3;
      const model = MODELS[modelIndex];

      const response = await askModel(model, buildResponsePrompt(topic, history, model));
      const turn = { model, content: response.content, error: response.error };
      history.push(turn);
      await onTurn(turn);

      if (response.error) return;
    }
  }
}

function askModel(model: string, prompt: string): Promise<AIResponse> {
  switch (model) {
    case "Claude": return askClaude(prompt);
    case "ChatGPT": return askChatGPT(prompt);
    case "Gemini": return askGemini(prompt);
    default: return Promise.resolve({ model, content: "", error: "Unknown model" });
  }
}

function buildOpenerPrompt(topic: string): string {
  return `You're in a friendly debate with other AI assistants (ChatGPT and Gemini). The topic is: "${topic}". Give your opening take in 2-3 sentences. Be opinionated but respectful. Don't introduce yourself.`;
}

function buildResponsePrompt(topic: string, history: ConversationTurn[], model: string): string {
  const others = MODELS.filter((m) => m !== model).join(" and ");
  let prompt = `You're ${model} in a friendly debate with ${others}. Topic: "${topic}"\n\nConversation so far:\n`;

  for (const turn of history) {
    prompt += `${turn.model}: ${turn.content}\n\n`;
  }

  prompt += `Now respond as ${model}. React to what was said, agree or disagree, add your perspective. Keep it to 2-3 sentences. Be conversational and engaging.`;
  return prompt;
}
