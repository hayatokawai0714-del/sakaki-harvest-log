const encoder = new TextEncoder();

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

async function constantTimeEqual(first, second) {
  const [firstDigest, secondDigest] = await Promise.all([sha256(first), sha256(second)]);
  let difference = 0;
  for (let index = 0; index < firstDigest.length; index += 1) {
    difference |= firstDigest[index] ^ secondDigest[index];
  }
  return difference === 0;
}

export async function authenticateRequest(request, env) {
  const configuredSecret = typeof env?.APP_SECRET === "string" ? env.APP_SECRET : "";
  if (!configuredSecret) {
    return {
      status: 500,
      body: { ok: false, code: "missing_app_secret", error: "APP_SECRET is not configured." },
    };
  }

  const providedSecret = request?.headers?.get("X-App-Key") || "";
  if (!providedSecret || !(await constantTimeEqual(providedSecret, configuredSecret))) {
    return {
      status: 401,
      body: { ok: false, code: "unauthorized", error: "Unauthorized." },
    };
  }
  return null;
}
