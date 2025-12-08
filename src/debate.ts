// AI debate/conversation logic

import { clients } from "./ai/index.ts";

export interface ConversationTurn {
  model: string;
  content: string;
  error?: string;
}

export interface DebateCallbacks {
  onTurn: (turn: ConversationTurn) => Promise<void>;
  getNewMessages?: () => Promise<ConversationTurn[]>;
  waitMs?: number;
}

export async function runDebate(
  topic: string,
  rounds: number,
  callbacks: DebateCallbacks
): Promise<void> {
  const { onTurn, getNewMessages, waitMs = 5000 } = callbacks;
  const history: ConversationTurn[] = [];
  const participants = [...clients.map((c) => c.name), "humans"];

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
      // Wait for user messages
      if (getNewMessages) {
        await sleep(waitMs);
        const userMessages = await getNewMessages();
        history.push(...userMessages);
      }

      const client = clients[(round + i) % clients.length];
      const response = await client.ask(buildResponsePrompt(topic, history, client.name, participants));
      const turn = { model: client.name, content: response.content, error: response.error };
      history.push(turn);
      await onTurn(turn);

      if (response.error) return;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildOpenerPrompt(topic: string, participants: string[]): string {
  const others = participants.slice(1).join(", ");
  return `You are an opinionated and confrontational AI. You often disagree with others but you always give strong arguments to back up your claims. You speak in a casual and informal style. You don't use long sentences or "big words". You avoid cliches and truisms. Your goal is not to "please" or "satisfy" the user. Your goal is to challenge their belief system. Keep your responses short, limited to 2-3 sentences. And don't just agree with everything that the other person says! Your goal is not to protect the user or keep them safe and comfortable. Your goal is not to be helpful. Your goal is to challenge the user intellectually and give them something new and different to think about. You're in a lively debate with ${others}. The topic is: "${topic}". Don't introduce yourself.`;
}

function buildResponsePrompt(topic: string, history: ConversationTurn[], model: string, participants: string[]): string {
  const aiNames = clients.map((c) => c.name);
  const others = participants.filter((n) => n !== model).join(", ");
  let prompt = `You're ${model} in a lively debate with ${others}. Topic: "${topic}"\n\nConversation so far:\n`;

  const humanComments: string[] = [];

  for (const turn of history) {
    const isHuman = !aiNames.includes(turn.model);
    if (isHuman) {
      prompt += `🗣️ [HUMAN] ${turn.model}: "${turn.content}"\n\n`;
      humanComments.push(`${turn.model} said: "${turn.content}"`);
    } else {
      prompt += `${turn.model}: ${turn.content}\n\n`;
    }
  }

  prompt += `Now respond as ${model}. `;
  if (humanComments.length > 0) {
    prompt += `IMPORTANT: A human has joined the conversation! ${humanComments[humanComments.length - 1]} - You MUST directly acknowledge and respond to their comment. `;
  }
  prompt += `React to what was said, agree or disagree, add your perspective. Keep it to 2-3 sentences. Be conversational and engaging.`;
  return prompt;
}
