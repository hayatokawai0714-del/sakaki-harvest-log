const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function estimateBase64Bytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function sanitizeWeight(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d(?:\.\d{1,2})?$/.test(raw)) return null;
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0.1 || number > 9.99) return null;
  return Math.round(number * 100) / 100;
}

function sanitizeWeights(values) {
  if (!Array.isArray(values)) return [];
  return values.map(sanitizeWeight).filter((value) => value !== null);
}

function outputText(responseBody) {
  if (typeof responseBody?.output_text === "string") return responseBody.output_text;
  const parts = [];
  for (const item of responseBody?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function parseJsonFromText(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });
  if (request.method !== "POST") return json({ ok: false, error: "Send an image with POST." }, { status: 405 });

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: "Image reading is not configured. Set OPENAI_API_KEY." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const image = String(body?.image || "");
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) {
      return json({ ok: false, error: "Image data was not found." }, { status: 400 });
    }
    if (estimateBase64Bytes(image) > MAX_IMAGE_BYTES) {
      return json({ ok: false, error: "Image is too large. Please send a smaller image." }, { status: 413 });
    }

    const prompt = [
      "Read only harvest weight numbers from a handwritten whiteboard photo.",
      "The weights are written vertically. Treat one visible line as one kg weight.",
      "Return only numbers that look like kg weights from 0.1 to 9.99.",
      "Exclude impossible values such as 12, 444, 4.4.4, 0, and values >= 10.",
      "Do not remove duplicates because the same weight can appear on multiple bundles.",
      "Return JSON only with this shape:",
      '{"ok":true,"weights":[1.3,2.02,2.52],"rawText":"recognized text","warnings":[]}',
    ].join("\n");

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image },
          ],
        }],
        temperature: 0,
        max_output_tokens: 700,
      }),
    });

    const responseText = await openaiResponse.text();
    const parsedResponse = parseJsonFromText(responseText);
    if (!openaiResponse.ok) {
      return json({ ok: false, error: "Image recognition API failed." }, { status: 502 });
    }

    const text = outputText(parsedResponse);
    const parsedOutput = parseJsonFromText(text) || {};
    const weights = sanitizeWeights(parsedOutput.weights);
    const warnings = Array.isArray(parsedOutput.warnings) ? parsedOutput.warnings.map(String).slice(0, 10) : [];

    return json({
      ok: true,
      weights,
      rawText: String(parsedOutput.rawText || parsedOutput.raw_text || text || "").slice(0, 2000),
      warnings,
    });
  } catch {
    return json({ ok: false, error: "Could not read the image. Please retake it or enter weights manually." }, { status: 500 });
  }
}
