// AI debate/conversation logic

import { clients } from "./ai/index.ts";

export interface ConversationTurn {
  model: string;
  content: string;
  error?: string;
}

export async function runDebate(
  topic: string,
  rounds: number,
  onTurn: (turn: ConversationTurn) => Promise<void>
): Promise<void> {
  const history: ConversationTurn[] = [];
  const participants = clients.map((c) => c.name);

  // First client opens the debate
  const opener = clients[0];
  const openerResponse = await opener.ask(buildOpenerPrompt(topic, participants));
  const firstTurn = { model: opener.name, content: openerResponse.content, error: openerResponse.error };
  history.push(firstTurn);
  await onTurn(firstTurn);

  if (openerResponse.error) return;

  // Each round, every other client gets a turn
  for (let round = 0; round < rounds; round++) {
    for (let i = 1; i < clients.length; i++) {
      const client = clients[(round + i) % clients.length];

      const response = await client.ask(buildResponsePrompt(topic, history, client.name, participants));
      const turn = { model: client.name, content: response.content, error: response.error };
      history.push(turn);
      await onTurn(turn);

      if (response.error) return;
    }
  }
}

function buildOpenerPrompt(topic: string, participants: string[]): string {
  const others = participants.slice(1).join(", ");
  return `You're in a lively debate with ${others}. The topic is: "${topic}". Give your opening take in 2-3 sentences. Be opinionated and engaging. Don't introduce yourself.`;
}

function buildResponsePrompt(topic: string, history: ConversationTurn[], model: string, participants: string[]): string {
  const others = participants.filter((n) => n !== model).join(", ");
  let prompt = `You're ${model} in a lively debate with ${others}. Topic: "${topic}"\n\nConversation so far:\n`;

  for (const turn of history) {
    prompt += `${turn.model}: ${turn.content}\n\n`;
  }

  prompt += `Now respond as ${model}. React to what was said, agree or disagree, add your perspective. Keep it to 2-3 sentences. Be conversational and engaging.`;
  return prompt;
}
