// DALL-E image generation

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
