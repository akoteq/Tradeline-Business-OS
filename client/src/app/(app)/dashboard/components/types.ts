export type Metric = "closedWon" | "active" | "received" | "tasksCompleted" | "tasksOverdue";

export type CompanyDash = {
  company: { key: string; name: string; slug: string; dealSource: string };
  source: "BAPX" | "TRADELINE" | "COMPANY";
  total: number;
  active: number;
  closedWon: number;
  byStage: { dealStage: string; count: number }[];
  byHealth: { dealHealth: string; count: number }[];
  byPayment?: { status: string; count: number }[];
  invoice: { status: string; count: number }[];
  revenue: { revenuePotential: number; revenueReceived: number; outstanding: number };
  topDeals: { id: string; businessName: string; dealStage: string; dealHealth: string; paymentStatus?: string | null; received: number; potential: number; invoiceStatus: string }[];
  tasks: { open: number; overdue: number; completed: number };
  /**
   * Period comparison. Optional until the API ships it. With it, flow numbers
   * (won, money in, tasks done) show this period and carry a trend; without
   * it they read "All time" and show no trend. Nothing is guessed.
   */
  period?: {
    label: string;        // "This month"
    compareLabel: string; // "last month"
    current: Partial<Record<Metric, number>>;
    previous: Partial<Record<Metric, number>>;
  };
  /** Net profit, burn rate and ROI are computed nightly. Optional until that job ships. */
  finance?: {
    netProfit: number;
    burnRate: number;
    roi: number;
    totalInvested: number;
    expensesByCategory: { category: string; amount: number }[];
  };
  /** Staff-managed prospects, private by default. Scoping happens server-side. */
  leads?: { id: string; businessName: string; stage: string; estimatedValue: number; ownerName: string; visibility: "private" | "public" }[];
  /** Task-level detail. Optional until the task list endpoint is wired. */
  taskList?: { id: string; title: string; assigneeName: string; dueDate: string; status: "OPEN" | "OVERDUE" | "COMPLETED" }[];
};
