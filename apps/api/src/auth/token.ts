import jwt from "jsonwebtoken";

export type AuthClaims = {
  userId: string;
  email: string;
};

type JwtPayload = {
  sub?: string;
  email?: string;
};

export const verifyAuthToken = (token: string, jwtSecret: string): AuthClaims => {
  const payload = jwt.verify(token, jwtSecret) as JwtPayload;

  if (!payload.sub || !payload.email) {
    throw new Error("Invalid token");
  }

  return {
    userId: payload.sub,
    email: payload.email
  };
};
