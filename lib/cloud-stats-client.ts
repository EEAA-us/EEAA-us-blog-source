"use client";

export type CloudStatsIdentity = { browserId: string; sessionId: string };

function persistentId(storage: Storage, key: string) {
  let id = storage.getItem(key);
  if (!id) { id = crypto.randomUUID(); storage.setItem(key, id); }
  return id;
}

export function getCloudStatsIdentity(): CloudStatsIdentity {
  return {
    browserId: persistentId(localStorage, "cloud-stats-browser-v1"),
    sessionId: persistentId(sessionStorage, "cloud-stats-session-v1"),
  };
}

export async function recordArticleView(id: number): Promise<{ views: number; likes: number }> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid article id");
  const identity = getCloudStatsIdentity();
  const response = await fetch(`/api/posts/${id}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...identity, eventId: crypto.randomUUID() }),
  });
  if (!response.ok) throw new Error(`Could not record article view (${response.status})`);
  return response.json();
}
