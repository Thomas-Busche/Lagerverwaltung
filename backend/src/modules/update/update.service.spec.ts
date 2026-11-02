import { EventEmitter } from "events";

import { UpdateService } from "./update.service";

type Handler = (res: EventEmitter & { statusCode: number; headers: Record<string, string>; resume: () => void }) => void;

const mockGet = jest.fn();
jest.mock("https", () => ({ get: (...args: unknown[]) => mockGet(...args) }));

const respond = (statusCode: number, body: string, headers: Record<string, string> = {}) =>
  (_options: unknown, handler: Handler) => {
    const res = Object.assign(new EventEmitter(), { statusCode, headers, resume: jest.fn() });
    const req = Object.assign(new EventEmitter(), { setTimeout: jest.fn(), destroy: jest.fn() });
    process.nextTick(() => {
      handler(res);
      res.emit("data", body);
      res.emit("end");
    });
    return req;
  };

describe("UpdateService tag lookup", () => {
  beforeEach(() => mockGet.mockReset());

  it("follows the GitHub redirect of a moved repository", async () => {
    mockGet
      .mockImplementationOnce(respond(301, "{}", { location: "https://api.github.com/repositories/1/tags" }))
      .mockImplementationOnce(respond(200, JSON.stringify([{ name: "v4.8.3" }, { name: "v4.8.2" }])));

    const status = await new UpdateService().getStatus(true);

    expect(status.error).toBeNull();
    expect(status.latestVersion).toBe("4.8.3");
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[1][0]).toMatchObject({ hostname: "api.github.com", path: "/repositories/1/tags" });
  });

  it("refuses redirects to other hosts", async () => {
    mockGet.mockImplementationOnce(respond(301, "{}", { location: "https://evil.example/tags" }));

    const status = await new UpdateService().getStatus(true);

    expect(status.error).toContain("Weiterleitung");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("reports an API error instead of claiming there are no tags", async () => {
    mockGet.mockImplementationOnce(respond(403, JSON.stringify({ message: "API rate limit exceeded" })));

    const status = await new UpdateService().getStatus(true);

    expect(status.error).toContain("HTTP 403");
  });

  it("reports an empty tag list", async () => {
    mockGet.mockImplementationOnce(respond(200, "[]"));

    const status = await new UpdateService().getStatus(true);

    expect(status.error).toBe("Keine Tags im Repository gefunden");
  });
});
