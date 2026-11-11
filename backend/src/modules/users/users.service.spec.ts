import { ConflictException } from "@nestjs/common";

import { UsersService } from "./users.service";

jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));
jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hashed"), compare: jest.fn() }));

const dto = { username: "lager1", password: "geheim123", displayName: "Lager 1", role: "WAREHOUSE" as const };

const setup = (existingUser: unknown) => {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(existingUser),
    create: jest.fn((entity: Record<string, unknown>) => entity),
    save: jest.fn((entity: Record<string, unknown>) => Promise.resolve({ id: "u1", ...entity })),
  };
  const locationRepo = { find: jest.fn().mockResolvedValue([]) };
  const service = new UsersService(userRepo as never, locationRepo as never, {} as never, {} as never);
  return { service, userRepo };
};

describe("UsersService.create", () => {
  it("rejects a duplicate username with 409 Conflict instead of a generic error", async () => {
    const { service, userRepo } = setup({ id: "existing", username: "lager1" });

    const result = service.create(dto);

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toMatchObject({ status: 409, message: "Benutzername bereits vergeben" });
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("stores only the password hash for a new username", async () => {
    const { service, userRepo } = setup(null);

    await service.create(dto);

    const saved = userRepo.save.mock.calls[0][0];
    expect(saved).toMatchObject({ username: "lager1", passwordHash: "hashed", branchId: null, email: null });
    expect(saved).not.toHaveProperty("password");
  });
});
