type ExpenseRepository = {
  create(input: {
    userId: string;
    amountCents: number;
    description: string;
    categoryId: string;
    occurredOn: string;
  }): Promise<unknown>;
};

type CreateExpenseHandlerDependencies = {
  expenseRepository: ExpenseRepository;
  verifyToken(token: string): { userId: string };
};

type ApiEvent = {
  headers?: Record<string, string | undefined>;
  body?: string | null;
};

export const createExpenseHandler =
  (dependencies: CreateExpenseHandlerDependencies) =>
  async (event: ApiEvent): Promise<{ statusCode: number; body: string }> => {
    const authorization = event.headers?.authorization ?? event.headers?.Authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

    if (!token) {
      return json(401, { error: "Authentication required" });
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
      const created = await dependencies.expenseRepository.create({
        userId: claims.userId,
        ...normalized
      });

      return json(201, created);
    } catch {
      return json(400, {
        error: "Invalid expense",
        fields: ["amount", "description", "categoryId", "occurredOn"]
      });
    }
  };

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  body: JSON.stringify(body)
});
import { normalizeExpenseInput } from "@expense-tracker/core";
