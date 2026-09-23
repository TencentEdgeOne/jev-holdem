import { buildHoldemRequest } from "./holdem.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest({ request, env }) {
  const incoming = new URL(request.url);
  if (request.method !== "POST" || !incoming.pathname.endsWith("/v1/systemone")) {
    return json({ error: "not_found" }, 404);
  }

  const baseUrl = String(env.AI_GATEWAY_BASE_URL || "").replace(/\/$/, "");
  const apiKey = env.AI_GATEWAY_API_KEY;
  if (!baseUrl || !apiKey) {
    return json(
      { error: "missing_gateway_env", message: "Set AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY" },
      500,
    );
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 20_000) return json({ error: "invalid_holdem_state", message: "请求过大" }, 400);
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return json({ error: "invalid_holdem_state", message: "请求不是 JSON" }, 400);
  }

  const built = buildHoldemRequest(payload);
  if (built.error) return json({ error: "invalid_holdem_state", message: built.error }, 400);

  try {
    const upstream = await fetch(`${baseUrl}/systemone`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(built.body),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "jev_request_failed", message }, 502);
  }
}

export default onRequest;
