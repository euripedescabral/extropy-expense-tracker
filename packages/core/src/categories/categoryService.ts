export type Category = {
  id: string;
  userId: string;
  name: string;
  kind: "system" | "custom";
};

export type CustomCategoryInput = {
  userId: string;
  name: string;
};

const defaultCategoryNames = ["Food", "Transport", "Entertainment", "Utilities", "Health"] as const;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const seedDefaultCategories = (userId: string): Category[] =>
  defaultCategoryNames.map((name) => ({
    id: slugify(name),
    userId,
    name,
    kind: "system"
  }));

export const addCustomCategory = (
  existing: readonly Category[],
  input: CustomCategoryInput
): Category[] => {
  const name = input.name.trim();

  if (!name) {
    throw new Error("category name is required");
  }

  const duplicate = existing.some(
    (category) =>
      category.userId === input.userId && category.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    throw new Error("duplicate category name");
  }

  return [
    ...existing,
    {
      id: slugify(name),
      userId: input.userId,
      name,
      kind: "custom"
    }
  ];
};
