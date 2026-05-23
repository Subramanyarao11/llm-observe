import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import type { Provider } from "@llm-observe/types";

export class CreateConversationDto {
  @IsEnum(["openai", "anthropic", "gemini"])
  provider!: Provider;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class ListConversationsDto {
  @IsOptional()
  @IsEnum(["active", "cancelled", "completed"])
  status?: string;

  @IsOptional()
  @IsEnum(["openai", "anthropic", "gemini"])
  provider?: Provider;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class ChatDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  sessionId!: string;

  @IsEnum(["openai", "anthropic", "gemini"])
  provider!: Provider;

  @IsString()
  model!: string;

  @IsString()
  content!: string;
}

export class StreamQueryDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  sessionId!: string;

  @IsEnum(["openai", "anthropic", "gemini"])
  provider!: Provider;

  @IsString()
  model!: string;

  @IsString()
  content!: string;
}
