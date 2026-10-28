// The installed Nest packages are ESM; stub everything except the gateway under test.
jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));
jest.mock("@nestjs/jwt", () => ({ JwtService: class {} }));
jest.mock("../../common/guards/ws-jwt.guard", () => ({
  WsJwtGuard: class {},
  extractSocketToken: (client: { handshake: { auth: { token?: string } } }) => client.handshake.auth.token,
}));
jest.mock("../users/users.service", () => ({ UsersService: class {} }));
jest.mock("./stock.service", () => ({ StockService: class {} }));

import { StockGateway } from "./stock.gateway";

const SECRET = "test-secret";

const createGateway = (verify: (token: string) => unknown, user: unknown = { id: "u1", role: "MANAGER", branchId: "b1", vehicleId: null, locations: [] }) => {
  const jwtService = { verify: jest.fn((token: string) => verify(token)) };
  const configService = { get: jest.fn(() => SECRET) };
  const usersService = { findOneById: jest.fn(async () => user) };
  const gateway = new StockGateway({} as never, jwtService as never, configService as never, usersService as never);
  return { gateway, usersService };
};

const socket = (token?: string) =>
  ({ handshake: { auth: token ? { token } : {}, headers: {} }, data: {}, disconnect: jest.fn(), join: jest.fn() }) as never;

describe("StockGateway authentication", () => {
  it("rejects a connection without token", async () => {
    const { gateway } = createGateway(() => ({ sub: "u1" }));
    await expect(gateway.authenticate(socket())).rejects.toThrow("Unauthorized");
  });

  it("rejects refresh and mfa tokens", async () => {
    const { gateway, usersService } = createGateway(() => ({ sub: "u1", tokenType: "refresh" }));
    await expect(gateway.authenticate(socket("t"))).rejects.toThrow("Unauthorized");
    expect(usersService.findOneById).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    const { gateway } = createGateway(() => {
      throw new Error("invalid signature");
    });
    await expect(gateway.authenticate(socket("t"))).rejects.toThrow();
  });

  it("stores the DB user in client.data for a valid access token", async () => {
    const { gateway } = createGateway(() => ({ sub: "u1" }));
    const client = socket("t");
    await gateway.authenticate(client);
    expect((client as { data: { user: { id: string; branchId: string } } }).data.user).toMatchObject({ id: "u1", branchId: "b1" });
  });

  it("disconnects a socket that reaches handleConnection unauthenticated", () => {
    const { gateway } = createGateway(() => ({ sub: "u1" }));
    const client = socket();
    gateway.handleConnection(client);
    expect((client as { disconnect: jest.Mock }).disconnect).toHaveBeenCalledWith(true);
  });

  it("joins the branch room of an authenticated user", async () => {
    const { gateway } = createGateway(() => ({ sub: "u1" }));
    const client = socket("t");
    await gateway.authenticate(client);
    gateway.handleConnection(client);
    expect((client as { join: jest.Mock }).join).toHaveBeenCalledWith("branch:b1");
  });
});
