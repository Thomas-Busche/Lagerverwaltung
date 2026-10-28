import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Response } from "express";

/**
 * Keeps HttpException responses (incl. ValidationPipe messages) untouched and hides
 * everything else behind a generic 500, so stack traces never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    // WebSocket/RPC contexts have their own handling; only touch HTTP here.
    if (host.getType() !== "http") {
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === "string" ? { statusCode: status, message: body } : body,
      );
      return;
    }

    // Log name + stack only: never the request body, headers or error payloads that may carry PII/tokens.
    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(`Unbehandelter Fehler: ${error?.name ?? "UnknownError"}`, error?.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Interner Serverfehler",
    });
  }
}
