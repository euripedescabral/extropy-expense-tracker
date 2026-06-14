type ReportBreakdownInput = {
  categoryId: string;
  categoryName: string;
  totalCents: number;
  percentage: number;
};

type ReportViewModelInput = {
  monthlyTotalCents: number;
  breakdown: ReportBreakdownInput[];
  locale: string;
  currency: string;
};

const formatCents = (cents: number, locale: string, currency: string) =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(cents / 100);

export const buildReportViewModel = (input: ReportViewModelInput) => {
  const rows = input.breakdown.map((item) => ({
    label: item.categoryName,
    amount: formatCents(item.totalCents, input.locale, input.currency),
    percentageLabel: `${item.percentage.toFixed(1)}%`
  }));

  return {
    monthlyTotal: formatCents(input.monthlyTotalCents, input.locale, input.currency),
    rows,
    ...(rows.length === 0 ? { emptyMessage: "No expenses found for this period." } : {})
  };
};
