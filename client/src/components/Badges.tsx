import { clsx } from "clsx";

const healthColors: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  STALE: "bg-yellow-100 text-yellow-700",
  AT_RISK: "bg-orange-100 text-orange-700",
  CLOSED_WON: "bg-green-100 text-green-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
};

const stageColors: Record<string, string> = {
  QUALIFICATION: "bg-gray-100 text-gray-600",
  DISCOVERY: "bg-sky-100 text-sky-700",
  PROPOSAL_SENT: "bg-indigo-100 text-indigo-700",
  NEGOTIATION: "bg-purple-100 text-purple-700",
  CONTRACT_REVIEW: "bg-violet-100 text-violet-700",
  CLOSED_WON: "bg-green-100 text-green-700",
  CLOSED_LOST: "bg-red-100 text-red-700",
  ON_HOLD: "bg-gray-100 text-gray-500",
};

const priorityColors: Record<string, string> = {
  URGENT: "bg-red-600 text-white",
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-green-100 text-green-700",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};

const invoiceColors: Record<string, string> = {
  NOT_INVOICED: "bg-gray-100 text-gray-500",
  INVOICED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium", map[value] ?? "bg-gray-100 text-gray-500")}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export const DealHealthBadge = ({ value }: { value: string }) => <Badge value={value} map={healthColors} />;
export const DealStageBadge = ({ value }: { value: string }) => <Badge value={value} map={stageColors} />;
export const PriorityBadge = ({ value }: { value: string }) => <Badge value={value} map={priorityColors} />;
export const TaskStatusBadge = ({ value }: { value: string }) => <Badge value={value} map={statusColors} />;
export const InvoiceStatusBadge = ({ value }: { value: string }) => <Badge value={value} map={invoiceColors} />;
