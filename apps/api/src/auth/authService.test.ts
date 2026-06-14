import { describe, expect, it, vi } from "vitest";
import { MissingEnvError } from "../config/env";
import { createAuthService } from "./authService";

const userRepository = () => ({
  findByEmail: vi.fn(),
  createUser: vi.fn()
});

describe("auth service", () => {
  it("hashes passwords before storing a new user and returns a JWT", async () => {
    const repo = userRepository();
    repo.findByEmail.mockResolvedValue(null);
    repo.createUser.mockResolvedValue({
      id: "user_1",
      email: "ada@example.com",
      passwordHash: "$2a$hash"
    });

    const service = createAuthService({
      userRepository: repo,
      jwtSecret: "test-secret"
    });

    const result = await service.signUp({
      email: "ada@example.com",
      password: "CorrectHorse123!"
    });

    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        passwordHash: expect.not.stringContaining("CorrectHorse123!")
      })
    );
    expect(result).toMatchObject({
      user: { id: "user_1", email: "ada@example.com" },
      token: expect.any(String)
    });
  });

  it("rejects duplicate email signups before writing", async () => {
    const repo = userRepository();
    repo.findByEmail.mockResolvedValue({
      id: "user_1",
      email: "ada@example.com",
      passwordHash: "$2a$hash"
    });

    const service = createAuthService({
      userRepository: repo,
      jwtSecret: "test-secret"
    });

    await expect(
      service.signUp({
        email: "ada@example.com",
        password: "CorrectHorse123!"
      })
    ).rejects.toThrow(/already exists/i);
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it("logs in an existing user with a matching password and returns a JWT", async () => {
    const repo = userRepository();
    repo.findByEmail.mockResolvedValue(null);
    repo.createUser.mockImplementation(async (input) => ({
      id: "user_1",
      ...input
    }));
    const service = createAuthService({
      userRepository: repo,
      jwtSecret: "test-secret"
    });
    const signUp = await service.signUp({
      email: "ada@example.com",
      password: "CorrectHorse123!"
    });
    const created = repo.createUser.mock.calls[0][0];

    repo.findByEmail.mockResolvedValue({
      id: signUp.user.id,
      email: created.email,
      passwordHash: created.passwordHash
    });

    const result = await service.login({
      email: "ada@example.com",
      password: "CorrectHorse123!"
    });

    expect(result).toMatchObject({
      user: { email: "ada@example.com" },
      token: expect.any(String)
    });
  });

  it("rejects login when the password does not match", async () => {
    const repo = userRepository();
    repo.findByEmail.mockResolvedValue(null);
    repo.createUser.mockImplementation(async (input) => ({
      id: "user_1",
      ...input
    }));
    const service = createAuthService({
      userRepository: repo,
      jwtSecret: "test-secret"
    });
    await service.signUp({
      email: "ada@example.com",
      password: "CorrectHorse123!"
    });
    const created = repo.createUser.mock.calls[0][0];
    repo.findByEmail.mockResolvedValue({
      id: "user_1",
      email: created.email,
      passwordHash: created.passwordHash
    });

    await expect(
      service.login({
        email: "ada@example.com",
        password: "wrong-password"
      })
    ).rejects.toThrow(/invalid credentials/i);
  });

  it("fails fast with a helpful error when JWT secret is missing", () => {
    expect(() =>
      createAuthService({
        userRepository: userRepository(),
        jwtSecret: ""
      })
    ).toThrow(MissingEnvError);
  });
});
