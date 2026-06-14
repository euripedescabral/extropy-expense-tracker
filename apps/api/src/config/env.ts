export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "MissingEnvError";
  }
}

export const requireEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new MissingEnvError(name);
  }

  return value;
};
