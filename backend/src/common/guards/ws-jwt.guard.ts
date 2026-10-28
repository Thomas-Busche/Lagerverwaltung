import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";

export function extractSocketToken(client: Socket): string | undefined {
  const authHeaderRaw = client.handshake?.auth?.token as string | undefined;
  const authHeader: string | undefined = authHeaderRaw || client.handshake?.headers?.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = extractSocketToken(client);
      if (!token) throw new WsException("Unauthorized");
      const payload = this.jwtService.verify<{ tokenType?: string }>(token, {
        secret: this.configService.get<string>("auth.jwtSecret"),
      });
      // Refresh / MFA tokens are signed with the same secret but are not access tokens.
      if (payload.tokenType) throw new WsException("Unauthorized");
      // Do not overwrite the user resolved at connection time (it carries vehicleId from the DB).
      const data = client.data as { user?: unknown };
      data.user ??= payload;
      return true;
    } catch {
      throw new WsException("Unauthorized");
    }
  }
}
