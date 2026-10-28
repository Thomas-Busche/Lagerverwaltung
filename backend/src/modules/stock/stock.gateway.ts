import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { buildAllowedOrigins } from '../../common/cors-origins';
import { extractSocketToken, WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { UsersService } from '../users/users.service';

import { StockService } from './stock.service';

export interface QuickBookingEntry {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  mode: 'CHECKOUT' | 'CHECKIN';
  locationId?: string;
  locationName?: string;
  reference?: string;
}

export interface SocketUser {
  id: string;
  role: string;
  branchId: string | null;
  vehicleId: string | null;
  locationIds: string[];
}

// Super-admins (no branch) receive the broadcasts of every branch.
export const ALL_BRANCHES_ROOM = 'branch:all';
export const branchRoom = (branchId: string) => `branch:${branchId}`;

@WebSocketGateway({
  namespace: '/stock',
  cors: {
    origin: buildAllowedOrigins(),
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
@Injectable()
export class StockGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(StockGateway.name);

  @WebSocketServer()
  server?: Server;

  // Speichert den aktuellen Buchungszustand pro User (userId → Liste)
  private readonly quickbookState = new Map<string, QuickBookingEntry[]>();

  constructor(
    private readonly stockService: StockService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  // Runs before the 'connection' event, so no message can arrive from an unauthenticated socket.
  afterInit(server: Server) {
    server.use((client, next) => {
      this.authenticate(client).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  /** Verifies the access token and stores the DB-backed user in client.data. */
  async authenticate(client: Socket): Promise<SocketUser> {
    const token = extractSocketToken(client);
    if (!token) throw new Error('Unauthorized');
    const payload = this.jwtService.verify<{ sub?: string; tokenType?: string }>(token, {
      secret: this.configService.get<string>('auth.jwtSecret'),
    });
    // Refresh / MFA tokens share the signing secret but must never open a socket.
    if (payload.tokenType || !payload.sub) throw new Error('Unauthorized');
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) throw new Error('Unauthorized');
    const socketUser: SocketUser = {
      id: user.id,
      role: user.role,
      branchId: user.branchId ?? null,
      vehicleId: user.vehicleId ?? null,
      locationIds: user.locations?.map((l) => l.id) ?? [],
    };
    (client.data as { user?: SocketUser }).user = socketUser;
    return socketUser;
  }

  private getUser(client: Socket): SocketUser | undefined {
    return (client.data as { user?: SocketUser }).user;
  }

  handleConnection(client: Socket) {
    const user = this.getUser(client);
    if (!user) {
      client.disconnect(true);
      return;
    }
    void client.join(user.branchId ? branchRoom(user.branchId) : ALL_BRANCHES_ROOM);
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  // ── Restock ───────────────────────────────────────────────────────────────

  @SubscribeMessage('subscribeRestock')
  async handleSubscribeRestock(client: Socket) {
    const user = this.getUser(client);
    if (!user) return;
    const overview = await this.stockService.getRestockOverview({ status: 'OPEN' }, user.branchId, user.locationIds);
    client.emit('restockUpdate', overview);
  }

  // With a branchId the event goes to that branch (+ super-admins). Without one the origin is unknown,
  // so every authenticated socket gets the payload-free refresh hint.
  private emitToBranch(event: string, branchId?: string | null) {
    if (!this.server) {
      this.logger.warn(`Kein Socket-Server verfuegbar, ${event} nicht gesendet`);
      return;
    }
    const target = branchId ? this.server.to([branchRoom(branchId), ALL_BRANCHES_ROOM]) : this.server;
    target.emit(event, { refresh: true });
  }

  broadcastRestockUpdate(branchId?: string | null) {
    this.emitToBranch('restock:updated', branchId);
  }

  // Signalisiert, dass sich Lagerbestand (Ist-Bestand) geaendert hat, damit
  // z.B. eine bereits geoeffnete Artikeldaten-Seite live nachziehen kann,
  // statt nur beim naechsten manuellen Neuladen aktuell zu sein.
  broadcastItemsUpdated(branchId?: string | null) {
    this.emitToBranch('items:updated', branchId);
  }

  // ── Schnellbuchung Echtzeit-Sync ──────────────────────────────────────────
  // The user id always comes from the authenticated socket; a client-supplied userId
  // would let anyone join or overwrite another user's booking list.

  /** Gerät tritt dem Room des Users bei und erhält sofort den aktuellen Stand. */
  @SubscribeMessage('quickbook:join')
  async handleQuickbookJoin(@ConnectedSocket() client: Socket) {
    const userId = this.getUser(client)?.id;
    if (!userId) return;
    await client.join(`quickbook:${userId}`);
    client.emit('quickbook:state', { list: this.quickbookState.get(userId) ?? [] });
    this.logger.debug(`quickbook:join userId=${userId} socketId=${client.id}`);
  }

  /** Ein Gerät sendet die aktualisierte Liste → Server speichert und broadcastet. */
  @SubscribeMessage('quickbook:update')
  handleQuickbookUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { list: QuickBookingEntry[] },
  ) {
    const userId = this.getUser(client)?.id;
    if (!userId) return;
    const list = data?.list ?? [];
    this.quickbookState.set(userId, list);
    // Allen anderen Geräten im Room senden (excludes sender)
    client.to(`quickbook:${userId}`).emit('quickbook:state', { list });
  }

  /** Buchung abgeschlossen – Liste auf allen Geräten leeren. */
  @SubscribeMessage('quickbook:booked')
  handleQuickbookBooked(@ConnectedSocket() client: Socket) {
    const userId = this.getUser(client)?.id;
    if (!userId) return;
    this.quickbookState.delete(userId);
    client.to(`quickbook:${userId}`).emit('quickbook:booked');
  }

  /** Manuelles Löschen der Liste auf allen Geräten. */
  @SubscribeMessage('quickbook:clear')
  handleQuickbookClear(@ConnectedSocket() client: Socket) {
    const userId = this.getUser(client)?.id;
    if (!userId) return;
    this.quickbookState.delete(userId);
    client.to(`quickbook:${userId}`).emit('quickbook:cleared');
  }

  /** Vorgangsnummer an alle anderen Geräte im Room übertragen. */
  @SubscribeMessage('quickbook:reference')
  handleQuickbookReference(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { reference: string },
  ) {
    const userId = this.getUser(client)?.id;
    if (!userId) return;
    client.to(`quickbook:${userId}`).emit('quickbook:reference', { reference: data?.reference });
  }
}
