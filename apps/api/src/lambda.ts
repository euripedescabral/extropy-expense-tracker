import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { addCustomCategory } from "@expense-tracker/core";
import { createAuthService } from "./auth/authService";
import { verifyAuthToken, type AuthClaims } from "./auth/token";
import { MissingEnvError, requireEnv } from "./config/env";
import { createExpenseHandler } from "./expenses/createExpenseHandler";
import { updateExpenseHandler } from "./expenses/updateExpenseHandler";
import { createDynamoRepositories } from "./repositories/dynamo";
import { empty, json, parseJsonBody, readBearerToken, type HttpResponse } from "./http";

type Repositories = ReturnType<typeof createDynamoRepositories>;

type AppDependencies = {
  jwtSecret: string;
  userRepository: Repositories["users"];
  expenseRepository: Repositories["expenses"];
  categoryRepository: Repositories["categories"];
};

type AuthenticatedHandler = (claims: AuthClaims) => Promise<HttpResponse>;

export const createAppHandler = (dependencies: AppDependencies) => {
  const authService = createAuthService({
    userRepository: dependencies.userRepository,
    jwtSecret: dependencies.jwtSecret
  });
  const verifyToken = (token: string) => verifyAuthToken(token, dependencies.jwtSecret);
  const createExpense = createExpenseHandler({
    expenseRepository: dependencies.expenseRepository,
    verifyToken
  });
  const updateExpense = updateExpenseHandler({
    expenseRepository: dependencies.expenseRepository,
    verifyToken
  });

  const withAuth = async (
    event: APIGatewayProxyEventV2,
    next: AuthenticatedHandler
  ): Promise<HttpResponse> => {
    const token = readBearerToken(event.headers);

    if (!token) {
      return json(401, { error: "Authentication required" });
    }

    try {
      return await next(verifyToken(token));
    } catch {
      return json(401, { error: "Authentication required" });
    }
  };

  return async (event: APIGatewayProxyEventV2): Promise<HttpResponse> => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === "OPTIONS") {
      return empty(204);
    }

    try {
      if (method === "POST" && path === "/auth/signup") {
        const session = await authService.signUp(
          parseJsonBody(event.body) as Parameters<typeof authService.signUp>[0]
        );

        return json(201, session);
      }

      if (method === "POST" && path === "/auth/login") {
        return json(
          200,
          await authService.login(parseJsonBody(event.body) as Parameters<typeof authService.login>[0])
        );
      }

      if (method === "GET" && path === "/categories") {
        return withAuth(event, async (claims) =>
          json(200, await dependencies.categoryRepository.list(claims.userId))
        );
      }

      if (method === "POST" && path === "/categories") {
        return withAuth(event, async (claims) => {
          const body = parseJsonBody(event.body) as { name?: string };
          const existing = await dependencies.categoryRepository.list(claims.userId);
          const nextCategories = addCustomCategory(existing, {
            userId: claims.userId,
            name: body.name ?? ""
          });
          const created = nextCategories.find(
            (category) =>
              category.kind === "custom" &&
              category.userId === claims.userId &&
              category.name.toLowerCase() === body.name?.trim().toLowerCase()
          );

          if (!created) {
            return json(400, { error: "Invalid category" });
          }

          return json(201, await dependencies.categoryRepository.create(created));
        });
      }

      if (method === "GET" && path === "/expenses") {
        return withAuth(event, async (claims) =>
          json(200, await dependencies.expenseRepository.list(claims.userId))
        );
      }

      if (method === "POST" && path === "/expenses") {
        return createExpense(event);
      }

      const expenseId = path.match(/^\/expenses\/([^/]+)$/)?.[1];

      if (expenseId && method === "PUT") {
        return updateExpense({
          ...event,
          pathParameters: {
            id: expenseId
          }
        });
      }

      if (expenseId && method === "DELETE") {
        return withAuth(event, async (claims) => {
          await dependencies.expenseRepository.delete({
            userId: claims.userId,
            id: expenseId
          });

          return empty(204);
        });
      }

      return json(404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof MissingEnvError ? error.message : "Request failed";

      return json(400, { error: message });
    }
  };
};

let deployedHandler: ReturnType<typeof createAppHandler> | null = null;

const getDeployedHandler = () => {
  if (!deployedHandler) {
    const repositories = createDynamoRepositories({
      tableName: requireEnv("DYNAMODB_TABLE_NAME")
    });

    deployedHandler = createAppHandler({
      jwtSecret: requireEnv("JWT_SECRET"),
      userRepository: repositories.users,
      expenseRepository: repositories.expenses,
      categoryRepository: repositories.categories
    });
  }

  return deployedHandler;
};

export const handler = async (event: APIGatewayProxyEventV2) => getDeployedHandler()(event);
