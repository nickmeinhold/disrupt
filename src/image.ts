// DALL-E image generation

export interface ImageResponse {
  imageData?: Uint8Array;
  revisedPrompt?: string;
  error?: string;
}

export async function generateImage(prompt: string): Promise<ImageResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { error: "OPENAI_API_KEY not set" };

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
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `API error: ${res.status}`;
      return { error: errorMsg };
    }

    const data = await res.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return { error: "No image URL in response" };

    // Download the image since DALL-E URLs are temporary
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return { error: "Failed to download image" };
    const imageData = new Uint8Array(await imageRes.arrayBuffer());

    return { imageData, revisedPrompt: data.data?.[0]?.revised_prompt };
  } catch (e) {
    return { error: String(e) };
  }
}
