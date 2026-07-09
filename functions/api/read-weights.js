const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "https://sakaki-harvest-log.pages.dev",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-app-key",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function authorize(request, env) {
  if (!env.APP_SECRET) {
    return json({ ok: false, code: "missing_app_secret", error: "APP_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("X-App-Key") !== env.APP_SECRET) {
    return json({ ok: false, code: "unauthorized", error: "Unauthorized." }, { status: 401 });
  }
  return null;
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

function safeMessage(value) {
  return String(value || "").replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}

function adviceForStatus(status) {
  if (status === 401 || status === 403) return "API key or project permissions may be invalid.";
  if (status === 429) return "Rate limit or account balance may need checking.";
  if (status >= 500) return "OpenAI API returned a server-side error.";
  return "Check the OpenAI API request settings.";
}

function openAiErrorResponse(openaiResponse, responseText, parsedResponse) {
  const apiError = parsedResponse?.error || {};
  const status = openaiResponse.status;
  return json({
    ok: false,
    error: "Image recognition API failed.",
    code: "openai_api_error",
    openai: {
      status,
      statusText: openaiResponse.statusText || "",
      type: safeMessage(apiError.type),
      code: safeMessage(apiError.code),
      message: safeMessage(apiError.message || responseText || openaiResponse.statusText),
      advice: adviceForStatus(status),
    },
  }, { status: 502 });
}

export async function onRequest({ request, env }) {
  if (!env.APP_SECRET) return authorize(request, env);
  if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });

  const authError = authorize(request, env);
  if (authError) return authError;

  if (request.method !== "POST") {
    return json({ ok: false, code: "method_not_allowed", error: "Send an image with POST.", status: 405 }, { status: 405 });
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({
      ok: false,
      code: "missing_openai_api_key",
      error: "Image reading is not configured. Set OPENAI_API_KEY.",
      status: 500,
    }, { status: 500 });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, code: "request_json_parse_failed", error: "Request JSON could not be parsed.", status: 400 }, { status: 400 });
    }
    const image = String(body?.image || "");
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image)) {
      return json({ ok: false, code: "invalid_image_data", error: "Image data was not found.", status: 400 }, { status: 400 });
    }
    if (estimateBase64Bytes(image) > MAX_IMAGE_BYTES) {
      return json({ ok: false, code: "image_too_large", error: "Image is too large. Please send a smaller image.", status: 413 }, { status: 413 });
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
            { type: "input_image", image_url: image, detail: "high" },
          ],
        }],
        temperature: 0,
        max_output_tokens: 700,
      }),
    });

    const responseText = await openaiResponse.text();
    const parsedResponse = parseJsonFromText(responseText);
    if (!openaiResponse.ok) {
      return openAiErrorResponse(openaiResponse, responseText, parsedResponse);
    }
    if (!parsedResponse) {
      return json({
        ok: false,
        code: "openai_json_parse_failed",
        error: "OpenAI response JSON could not be parsed.",
        openai: {
          status: openaiResponse.status,
          statusText: openaiResponse.statusText || "",
          message: safeMessage(responseText),
        },
      }, { status: 502 });
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
  } catch (error) {
    return json({
      ok: false,
      code: "read_weights_unhandled_error",
      error: "Could not read the image. Please retake it or enter weights manually.",
      message: safeMessage(error?.message || error),
      status: 500,
    }, { status: 500 });
  }
}
