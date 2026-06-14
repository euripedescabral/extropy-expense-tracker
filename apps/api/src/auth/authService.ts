type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

type UserRepository = {
  findByEmail(email: string): Promise<UserRecord | null>;
  createUser(input: { email: string; passwordHash: string }): Promise<UserRecord>;
};

type AuthServiceDependencies = {
  userRepository: UserRepository;
  jwtSecret: string;
};

type SignUpInput = {
  email: string;
  password: string;
};

type LoginInput = SignUpInput;

export const createAuthService = (dependencies: AuthServiceDependencies) => {
  if (!dependencies.jwtSecret) {
    throw new MissingEnvError("JWT_SECRET");
  }

  const issueSession = (user: UserRecord) => ({
    user: {
      id: user.id,
      email: user.email
    },
    token: jwt.sign({ sub: user.id, email: user.email }, dependencies.jwtSecret, {
      expiresIn: "1h"
    })
  });

  return {
    signUp: async (input: SignUpInput) => {
      const email = normalizeEmail(input.email);
      const existing = await dependencies.userRepository.findByEmail(email);

      if (existing) {
        throw new Error("User already exists");
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await dependencies.userRepository.createUser({
        email,
        passwordHash
      });

      return issueSession(user);
    },
    login: async (input: LoginInput) => {
      const email = normalizeEmail(input.email);
      const user = await dependencies.userRepository.findByEmail(email);
      const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

      if (!user || !passwordMatches) {
        throw new Error("Invalid credentials");
      }

      return issueSession(user);
    }
  };
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MissingEnvError } from "../config/env";
