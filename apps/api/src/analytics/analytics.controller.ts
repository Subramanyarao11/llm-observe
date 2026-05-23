import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("latency")
  latency(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    return this.analyticsService.latency(window);
  }

  @Get("throughput")
  throughput(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    return this.analyticsService.throughput(window);
  }

  @Get("errors")
  errors(@Query("window") window: "1h" | "24h" | "7d" = "24h") {
    return this.analyticsService.errors(window);
  }

  @Get("summary")
  summary() {
    return this.analyticsService.summary();
  }
}
