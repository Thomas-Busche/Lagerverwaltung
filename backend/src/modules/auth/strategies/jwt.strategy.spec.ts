import { JwtStrategy } from "./jwt.strategy";

jest.mock("@nestjs/config", () => ({ ConfigService: class {} }));
jest.mock("passport-jwt", () => ({ ExtractJwt: { fromAuthHeaderAsBearerToken: () => undefined }, Strategy: class {} }));
jest.mock("../../users/users.service", () => ({ UsersService: class {} }));
jest.mock("@nestjs/passport", () => ({
  PassportStrategy: () => class {},
}));

const makeStrategy = (findOneById: jest.Mock) =>
  new JwtStrategy({ getOrThrow: () => "secret" } as never, { findOneById } as never);

describe("JwtStrategy token type check", () => {
  it.each(["mfa-challenge", "mfa-setup", "refresh"])("rejects %s tokens", async (tokenType) => {
    const findOneById = jest.fn();
    const result = await makeStrategy(findOneById).validate({ sub: "u1", tokenType });
    expect(result).toBeNull();
    expect(findOneById).not.toHaveBeenCalled();
  });

  it("accepts a normal access token", async () => {
    const findOneById = jest.fn().mockResolvedValue({ id: "u1", locations: [{ id: "l1" }] });
    const result = await makeStrategy(findOneById).validate({ sub: "u1" });
    expect(result).toMatchObject({ id: "u1", locationIds: ["l1"] });
  });
});
