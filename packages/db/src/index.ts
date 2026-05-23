import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "./generated/client/index.js";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export { PrismaClient, Prisma } from "./generated/client/index.js";
export type {
  Conversation,
  InferenceLog,
  Message,
} from "./generated/client/index.js";
export { PrismaModule } from "./prisma.module.js";
