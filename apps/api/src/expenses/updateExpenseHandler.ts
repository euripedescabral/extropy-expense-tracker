import { normalizeExpenseInput } from "@expense-tracker/core";
import { json, type HttpResponse } from "../http";

type ExpenseRepository = {
  update(input: {
    id: string;
    userId: string;
    amountCents: number;
    description: string;
    categoryId: string;
    occurredOn: string;
  }): Promise<unknown>;
};

type UpdateExpenseHandlerDependencies = {
  expenseRepository: ExpenseRepository;
  verifyToken(token: string): { userId: string };
};

type ApiEvent = {
  headers?: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  body?: string | null;
};

export const updateExpenseHandler =
  (dependencies: UpdateExpenseHandlerDependencies) =>
  async (event: ApiEvent): Promise<HttpResponse> => {
    const authorization = event.headers?.authorization ?? event.headers?.Authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

    if (!token) {
      return json(401, { error: "Authentication required" });
    }

    const id = event.pathParameters?.id;

    if (!id) {
      return json(400, { error: "Expense id is required" });
    }

    const claims = dependencies.verifyToken(token);

    try {
      const body = event.body ? (JSON.parse(event.body) as unknown) : {};
      const normalized = normalizeExpenseInput(
        body as {
          amount: string;
          description: string;
          categoryId: string;
          occurredOn: string;
        }
      );
      const updated = await dependencies.expenseRepository.update({
        id,
        userId: claims.userId,
        ...normalized
      });

      return json(200, updated);
    } catch {
      return json(400, {
        error: "Invalid expense",
        fields: ["amount", "description", "categoryId", "occurredOn"]
      });
    }
  };
