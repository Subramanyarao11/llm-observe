import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

const STATUS_TO_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "VALIDATION_ERROR",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
  [HttpStatus.SERVICE_UNAVAILABLE]: "SERVICE_UNAVAILABLE",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "INTERNAL_ERROR",
};

@Catch()
export class StructuredErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (
        typeof response === "object" &&
        response !== null &&
        "code" in response &&
        "message" in response
      ) {
        reply.status(status).send(response);
        return;
      }

      const message =
        typeof response === "string"
          ? response
          : Array.isArray((response as { message?: unknown }).message)
            ? ((response as { message: string[] }).message.join(", ") ??
              exception.message)
            : ((response as { message?: string }).message ?? exception.message);

      reply.status(status).send({
        code:
          status === HttpStatus.BAD_REQUEST &&
          typeof response === "object" &&
          response !== null &&
          Array.isArray((response as { message?: unknown }).message)
            ? "VALIDATION_ERROR"
            : (STATUS_TO_CODE[status] ?? "HTTP_ERROR"),
        message,
      });
      return;
    }

    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }
}
