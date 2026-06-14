export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-allow-methods": "OPTIONS,GET,POST,PUT,DELETE"
};

export const json = (statusCode: number, body: unknown): HttpResponse => ({
  statusCode,
  headers: {
    ...corsHeaders,
    "content-type": "application/json"
  },
  body: JSON.stringify(body)
});

export const empty = (statusCode: number): HttpResponse => ({
  statusCode,
  headers: corsHeaders,
  body: ""
});

export const parseJsonBody = (body?: string | null) =>
  body ? (JSON.parse(body) as unknown) : {};

export const readBearerToken = (headers?: Record<string, string | undefined>) => {
  const authorization = headers?.authorization ?? headers?.Authorization;

  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
};
