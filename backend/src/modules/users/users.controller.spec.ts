import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { UsersController } from "./users.controller";

jest.mock("../auth/guards/jwt-auth.guard", () => ({ JwtAuthGuard: class {} }));
jest.mock("../auth/guards/roles.guard", () => ({ RolesGuard: class {} }));
jest.mock("../access-control/guards/permissions.guard", () => ({ PermissionsGuard: class {} }));
jest.mock("./dto/update-user.dto", () => ({ UpdateUserDto: class {} }));
jest.mock("../logging/services/logging.service", () => ({ LoggingService: class {} }));
jest.mock("./users.service", () => ({ UsersService: class {} }));
jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

const branchManager = { id: "m1", role: "MANAGER", branchId: "b1" };

const setup = (target: { id: string; role: string; branchId: string | null }) => {
  const usersService = {
    findOneById: jest.fn().mockResolvedValue(target),
    update: jest.fn().mockResolvedValue(target),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const logging = { logSecurity: jest.fn() };
  return { usersService, controller: new UsersController(usersService as never, logging as never) };
};

describe("UsersController branch isolation", () => {
  it("blocks update of a foreign-branch user", async () => {
    const { controller, usersService } = setup({ id: "u2", role: "WAREHOUSE", branchId: "b2" });
    await expect(controller.update("u2", { displayName: "x" }, branchManager as never)).rejects.toThrow(NotFoundException);
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it("blocks setting branchId to null on an own-branch user", async () => {
    const { controller, usersService } = setup({ id: "u3", role: "WAREHOUSE", branchId: "b1" });
    await expect(controller.update("u3", { branchId: null }, branchManager as never)).rejects.toThrow(ForbiddenException);
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it("blocks creating a branch-less or foreign-branch user", () => {
    const { controller } = setup({ id: "u3", role: "WAREHOUSE", branchId: "b1" });
    const dto = { username: "a", password: "p", displayName: "a", role: "MANAGER" as const };
    expect(() => controller.create({ ...dto, branchId: null }, branchManager as never)).toThrow(ForbiddenException);
    expect(() => controller.create({ ...dto, branchId: "b2" }, branchManager as never)).toThrow(ForbiddenException);
  });

  it("blocks delete of a foreign-branch user", async () => {
    const { controller, usersService } = setup({ id: "u2", role: "WAREHOUSE", branchId: null });
    await expect(controller.remove("u2", branchManager as never)).rejects.toThrow(NotFoundException);
    expect(usersService.remove).not.toHaveBeenCalled();
  });

  it("allows super-admin to move a user across branches", async () => {
    const { controller, usersService } = setup({ id: "u2", role: "WAREHOUSE", branchId: "b2" });
    await controller.update("u2", { branchId: null }, { id: "s", role: "MANAGER", branchId: null } as never);
    expect(usersService.update).toHaveBeenCalled();
  });
});
