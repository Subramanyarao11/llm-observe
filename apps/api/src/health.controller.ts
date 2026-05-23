import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health() {
    const result = await this.healthService.check();
    if (result.status === "degraded") {
      throw new HttpException(
        {
          code: "SERVICE_UNAVAILABLE",
          message: "One or more dependencies are unavailable",
          dependencies: {
            postgres: result.postgres,
            redis: result.redis,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return result;
  }
}
