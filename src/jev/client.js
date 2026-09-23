const URL = "/typesafe/v1/systemone";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function systemOne({ state }) {
  let delay = 400;
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (res.status === 429 || res.status === 529) {
      lastErr = new Error(`Jev ${res.status} 限流，正在重试`);
      await sleep(delay);
      delay *= 2;
      continue;
    }
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (res.status === 401) throw new Error("API Key 无效");
    if (!res.ok) {
      const detail =
        typeof body === "string"
          ? body.slice(0, 400)
          : JSON.stringify(body).slice(0, 400);
      throw new Error(`Jev ${res.status}: ${detail}`);
    }
    return body;
  }
  throw lastErr || new Error("Jev 请求失败");
}
