import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from "@nestjs/common";

import { AllExceptionsFilter } from "./all-exceptions.filter";

const createHost = (type = "http") => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    getType: () => type,
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
};

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  beforeEach(() => {
    jest.spyOn(filter["logger"], "error").mockImplementation(() => undefined);
  });

  it("hides stack and message of unknown errors", () => {
    const { host, status, json } = createHost();
    const error = new Error("SELECT * FROM users failed at /app/secret.js");
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: "Interner Serverfehler" });
    expect(JSON.stringify(json.mock.calls)).not.toContain("secret");
    expect(filter["logger"].error).toHaveBeenCalled();
  });

  it("passes HttpException bodies through unchanged", () => {
    const { host, status, json } = createHost();
    const body = { statusCode: 400, message: ["name darf nicht leer sein"], error: "Bad Request" };
    filter.catch(new BadRequestException(body), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(body);
  });

  it("wraps string HttpException responses", () => {
    const { host, status, json } = createHost();
    filter.catch(new HttpException("Nicht erlaubt", 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ statusCode: 403, message: "Nicht erlaubt" });
  });

  it("ignores non-http contexts", () => {
    const { host, status } = createHost("ws");
    filter.catch(new Error("x"), host);
    expect(status).not.toHaveBeenCalled();
  });
});
