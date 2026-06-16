"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { PriorityBadge } from "@/components/Badges";

type ConsolidatedRecord = {
  id: string;
  serialNo: number | null;
  businessName: string;
  contactPerson: string | null;
  emailPhone: string | null;
  region: string | null;
  valueChain: string | null;
  dealValue: number | null;
  priority: string | null;
  pipelineStatus: string | null;
  duplicateFlag: boolean;
  sourceFirm: string | null;
  assignedBdo: string | null;
};

export default function ConsolidatedPage() {
  const { data = [], isLoading } = useQuery<ConsolidatedRecord[]>({ queryKey: ["consolidated"], queryFn: () => fetcher("/consolidated") });

  const duplicates = data.filter((r) => r.duplicateFlag).length;

  const columns = [
    { key: "serialNo", label: "#", sortable: true, width: "50px" },
    { key: "businessName", label: "Business / SME", sortable: true },
    { key: "contactPerson", label: "Contact" },
    { key: "emailPhone", label: "Email / Phone" },
    { key: "region", label: "Region", sortable: true },
    { key: "valueChain", label: "Value Chain", sortable: true },
    { key: "dealValue", label: "Deal Value", render: (r: ConsolidatedRecord) => r.dealValue ? `GHS ${r.dealValue.toLocaleString()}` : "—", sortable: true },
    { key: "priority", label: "Priority", render: (r: ConsolidatedRecord) => r.priority ? <PriorityBadge value={r.priority} /> : <span className="text-gray-400">—</span> },
    { key: "pipelineStatus", label: "Pipeline Status" },
    { key: "duplicateFlag", label: "Duplicate", render: (r: ConsolidatedRecord) => r.duplicateFlag ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Duplicate</span> : <span className="text-gray-400">—</span> },
    { key: "sourceFirm", label: "Source", render: (r: ConsolidatedRecord) => r.sourceFirm ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.sourceFirm === "TRADELINE" ? "bg-indigo-100 text-indigo-700" : "bg-green-100 text-green-700"}`}>{r.sourceFirm}</span> : "—" },
    { key: "assignedBdo", label: "BDO" },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consolidated Registry</h1>
          <p className="text-sm text-gray-500">Master deduplication database — all leads across both companies</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
          <div className="text-xs text-red-600 font-medium">Duplicates</div>
          <div className="font-bold text-red-700">{duplicates}</div>
        </div>
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} title={`${data.length} records`} />
    </div>
  );
}
