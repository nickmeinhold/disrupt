// Debate message parsing and formatting for cross-bot coordination

export const DEBATE_PARTICIPANTS = ["Claude", "ChatGPT", "Gemini"];

export interface DebateTurn {
  speaker: string;
  content: string;
  round: number;
  turn: number;
  next: string | null;
}

export interface DebateStart {
  topic: string;
  rounds: number;
}

// Parse a debate turn message
// Format: **Speaker:** content
// [DEBATE_TURN | Round: N | Turn: M | NEXT: BotName]
export function parseDebateTurn(message: string): DebateTurn | null {
  const speakerMatch = message.match(/^\*\*(\w+):\*\*\s*(.+?)(?=\n\[DEBATE_TURN|$)/s);
  if (!speakerMatch) return null;

  const metaMatch = message.match(/\[DEBATE_TURN\s*\|\s*Round:\s*(\d+)\s*\|\s*Turn:\s*(\d+)\s*\|\s*NEXT:\s*(\w+|END)\]/);
  if (!metaMatch) return null;

  return {
    speaker: speakerMatch[1],
    content: speakerMatch[2].trim(),
    round: parseInt(metaMatch[1]),
    turn: parseInt(metaMatch[2]),
    next: metaMatch[3] === "END" ? null : metaMatch[3],
  };
}

// Check if message is a debate start
// Format: [DEBATE_START | Topic: ... | Rounds: N | NEXT: BotName]
export function isDebateStart(message: string): DebateStart | null {
  const match = message.match(/\[DEBATE_START\s*\|\s*Topic:\s*(.+?)\s*\|\s*Rounds:\s*(\d+)\s*\|/);
  if (!match) return null;

  return {
    topic: match[1],
    rounds: parseInt(match[2]),
  };
}

// Format a debate start message
export function formatDebateStart(topic: string, rounds: number, firstBot: string): string {
  return `🎙️ **AI Debate Starting!**

**Topic:** ${topic}
**Rounds:** ${rounds}
**Participants:** ${DEBATE_PARTICIPANTS.join(", ")}

_Jump in! Your messages will be included._

[DEBATE_START | Topic: ${topic} | Rounds: ${rounds} | NEXT: ${firstBot}]`;
}

// Format a debate turn message
export function formatTurnMessage(
  speaker: string,
  content: string,
  round: number,
  next: string | null,
  totalRounds: number
): string {
  const turnInRound = DEBATE_PARTICIPANTS.indexOf(speaker) + 1;
  const nextIndicator = next || "END";

  let msg = `**${speaker}:** ${content.slice(0, 1900)}`;

  if (!next) {
    msg += `\n\n🏁 **Debate Complete!** (${totalRounds} rounds)`;
  }

  msg += `\n[DEBATE_TURN | Round: ${round} | Turn: ${turnInRound} | NEXT: ${nextIndicator}]`;

  return msg;
}

// Get the next participant in the debate
export function getNextParticipant(current: string, round: number, totalRounds: number): string | null {
  const currentIndex = DEBATE_PARTICIPANTS.indexOf(current);
  if (currentIndex === -1) return null;

  const nextIndex = currentIndex + 1;

  // If we've gone through all participants in this round
  if (nextIndex >= DEBATE_PARTICIPANTS.length) {
    // Check if we have more rounds
    if (round >= totalRounds) {
      return null; // Debate is over
    }
    // Start next round with first participant
    return DEBATE_PARTICIPANTS[0];
  }

  return DEBATE_PARTICIPANTS[nextIndex];
}

// Format human participation in debate
export function formatHumanMessage(username: string, content: string): string {
  return `🗣️ **[HUMAN] ${username}:** ${content}`;
}
