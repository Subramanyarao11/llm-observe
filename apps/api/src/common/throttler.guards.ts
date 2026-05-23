import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

type RequestLike = {
  ip?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

@Injectable()
export class ChatThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestLike): Promise<string> {
    const sessionId = req.query?.sessionId ?? req.body?.sessionId;
    if (typeof sessionId === "string" && sessionId.length > 0) {
      return `chat:${sessionId}`;
    }
    return req.ip ?? "unknown";
  }
}

@Injectable()
export class IngestThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestLike): Promise<string> {
    return `ingest:${req.ip ?? "unknown"}`;
  }
}
