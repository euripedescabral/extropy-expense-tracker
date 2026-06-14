import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import { seedDefaultCategories, type Budget, type Category, type Expense } from "@expense-tracker/core";

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
};

type DynamoRepositoriesInput = {
  tableName: string;
  documentClient?: DynamoDBDocumentClient;
};

const userPk = (email: string) => `USER_EMAIL#${email}`;
const userSk = "PROFILE";
const accountPk = (userId: string) => `USER#${userId}`;
const expenseSk = (id: string) => `EXPENSE#${id}`;
const categorySk = (id: string) => `CATEGORY#${id}`;
const budgetSk = (categoryId: string) => `BUDGET#${categoryId}`;

export const toPublicExpense = (item: Expense): Expense => ({
  id: item.id,
  userId: item.userId,
  amountCents: item.amountCents,
  description: item.description,
  categoryId: item.categoryId,
  occurredOn: item.occurredOn
});

export const toPublicCategory = (item: Category): Category => ({
  id: item.id,
  userId: item.userId,
  name: item.name,
  kind: item.kind
});

export const toPublicBudget = (item: Budget): Budget => ({
  userId: item.userId,
  categoryId: item.categoryId,
  monthlyLimitCents: item.monthlyLimitCents
});

export const createDynamoRepositories = (input: DynamoRepositoriesInput) => {
  const documentClient =
    input.documentClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const getItem = async <T>(key: { pk: string; sk: string }) => {
    const result = await documentClient.send(
      new GetCommand({
        TableName: input.tableName,
        Key: key
      })
    );

    return (result.Item as T | undefined) ?? null;
  };

  const putItem = async (item: Record<string, unknown>, conditionExpression?: string) => {
    await documentClient.send(
      new PutCommand({
        TableName: input.tableName,
        Item: item,
        ConditionExpression: conditionExpression
      })
    );
  };

  const queryUserItems = async <T>(userId: string, sortKeyPrefix: string) => {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: input.tableName,
        KeyConditionExpression: "pk = :pk and begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": accountPk(userId),
          ":sk": sortKeyPrefix
        }
      })
    );

    return (result.Items ?? []) as T[];
  };

  return {
    users: {
      findByEmail: async (email: string) =>
        getItem<UserRecord>({
          pk: userPk(email),
          sk: userSk
        }),
      createUser: async (userInput: { email: string; passwordHash: string }) => {
        const id: string = randomUUID();
        const user = {
          id,
          email: userInput.email,
          passwordHash: userInput.passwordHash
        };

        await putItem({
          pk: userPk(user.email),
          sk: userSk,
          ...user
        }, "attribute_not_exists(pk)");

        return user;
      }
    },
    expenses: {
      list: async (userId: string) =>
        queryUserItems<Expense>(userId, "EXPENSE#").then((expenses) =>
          expenses
            .map(toPublicExpense)
            .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn))
        ),
      create: async (expenseInput: Omit<Expense, "id">) => {
        const id: string = randomUUID();
        const expense = {
          id,
          ...expenseInput
        };

        await putItem({
          pk: accountPk(expense.userId),
          sk: expenseSk(expense.id),
          ...expense
        }, "attribute_not_exists(pk)");

        return expense;
      },
      update: async (expense: Expense) => {
        await putItem({
          pk: accountPk(expense.userId),
          sk: expenseSk(expense.id),
          ...expense
        }, "attribute_exists(pk)");

        return expense;
      },
      delete: async (deleteInput: { userId: string; id: string }) => {
        await documentClient.send(
          new DeleteCommand({
            TableName: input.tableName,
            Key: {
              pk: accountPk(deleteInput.userId),
              sk: expenseSk(deleteInput.id)
            }
          })
        );
      }
    },
    categories: {
      list: async (userId: string) => [
        ...seedDefaultCategories(userId),
        ...(await queryUserItems<Category>(userId, "CATEGORY#")).map(toPublicCategory)
      ],
      create: async (category: Category) => {
        await putItem({
          pk: accountPk(category.userId),
          sk: categorySk(category.id),
          ...category
        }, "attribute_not_exists(pk)");

        return category;
      }
    },
    budgets: {
      list: async (userId: string) =>
        queryUserItems<Budget>(userId, "BUDGET#").then((budgets) =>
          budgets.map(toPublicBudget).sort((left, right) => left.categoryId.localeCompare(right.categoryId))
        ),
      upsert: async (budget: Budget) => {
        await putItem({
          pk: accountPk(budget.userId),
          sk: budgetSk(budget.categoryId),
          ...budget
        });

        return budget;
      }
    }
  };
};
