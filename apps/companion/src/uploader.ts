import type { LiveSnapshot } from "@alfons/shared";

export type UploadResult = "ok" | "unauthorized" | "rate-limited" | "rejected" | "network-error";

/** Sendet Snapshots an /api/live/ingest. Kein Queueing: nur der neueste Stand zählt. */
export class Uploader {
  private inflight = false;
  private backoffUntil = 0;

  constructor(
    private readonly server: string,
    private readonly token: string,
  ) {}

  async send(snapshot: LiveSnapshot, force = false): Promise<UploadResult | "skipped"> {
    if (!force && (this.inflight || Date.now() < this.backoffUntil)) return "skipped";
    this.inflight = true;
    try {
      const res = await fetch(new URL("/api/live/ingest", this.server), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return "ok";
      if (res.status === 401) return "unauthorized";
      if (res.status === 429) {
        this.backoffUntil = Date.now() + Number(res.headers.get("retry-after") ?? 1) * 1000;
        return "rate-limited";
      }
      console.warn(`[upload] ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return "rejected";
    } catch {
      this.backoffUntil = Date.now() + 3000;
      return "network-error";
    } finally {
      this.inflight = false;
    }
  }
}
