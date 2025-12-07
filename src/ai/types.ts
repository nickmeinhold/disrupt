export interface AIResponse {
  model: string;
  content: string;
  error?: string;
}

export interface AIClient {
  name: string;
  ask(prompt: string): Promise<AIResponse>;
}
