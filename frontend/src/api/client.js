const BASE = "/api";

async function j(path, opts) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  health: () => j("/health"),
  examples: () => j("/examples"),
  metrics: () => j("/metrics"),
  chat: (message, session_id) =>
    j("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id }),
    }),
};
