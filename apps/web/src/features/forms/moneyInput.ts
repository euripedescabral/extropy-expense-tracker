const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const parseLooseMoney = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");

  if (!cleaned || !/\d/.test(cleaned)) {
    return null;
  }

  const [rawDollars, ...rawCentsParts] = cleaned.split(".");
  const dollars = rawDollars.replace(/^0+(?=\d)/, "") || "0";
  const cents = rawCentsParts.join("").slice(0, 2).padEnd(2, "0");
  const amountCents = Number(dollars) * 100 + Number(cents);

  if (!Number.isSafeInteger(amountCents)) {
    return null;
  }

  return amountCents;
};

export const normalizeMoneyInputValue = (value: string) => {
  const amountCents = parseLooseMoney(value);

  if (amountCents === null) {
    return "";
  }

  return `${Math.trunc(amountCents / 100)}.${String(amountCents % 100).padStart(2, "0")}`;
};

export const formatMoneyInputValue = (value: string) => {
  const amountCents = parseLooseMoney(value);

  if (amountCents === null) {
    return "";
  }

  return currencyFormatter.format(amountCents / 100);
};
