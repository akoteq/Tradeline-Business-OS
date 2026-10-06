"use client";

import { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Plus, Pencil, Trash2, Download } from "lucide-react";
import { clsx } from "clsx";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  /** Plain-text value used for CSV export. Falls back to the raw field value if omitted. */
  exportValue?: (row: T) => string | number;
};

function defaultExportValue<T>(row: T, key: string): string {
  const v = (row as Record<string, unknown>)[key];
  if (v == null) return "";
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    return typeof obj.name === "string" ? obj.name : "";
  }
  return String(v);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Props<T extends { id: string }> = {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Hides the edit/delete buttons on rows the viewer can only read. Defaults to every row. */
  canEditRow?: (row: T) => boolean;
  filterBar?: React.ReactNode;
  title?: string;
  /** Initial rows per page. Defaults to 25. */
  pageSize?: number;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  canEditRow,
  filterBar,
  title,
  pageSize: initialPageSize = 25,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = data.filter((row) => {
    if (!search) return true;
    return JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  });

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  // Pagination — reset to the first page whenever the result set or ordering changes
  useEffect(() => { setPage(1); }, [search, sortKey, sortDir, pageSize]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  const handleExport = () => {
    const headerRow = columns.map((c) => csvEscape(c.label)).join(",");
    const dataRows = sorted.map((row) =>
      columns
        .map((c) => csvEscape(c.exportValue ? c.exportValue(row) : defaultExportValue(row, String(c.key))))
        .join(",")
    );
    const csv = [headerRow, ...dataRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title ?? "export").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        {/* Top row: title + add button */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {title && <h2 className="font-semibold text-gray-800 text-sm truncate min-w-0">{title}</h2>}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              disabled={sorted.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Download size={14} /> Export
            </button>
            {onAdd && (
              <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Bottom row: filters + search */}
        <div className="flex flex-col sm:flex-row gap-2">
          {filterBar && (
            <div className="flex gap-2 flex-wrap flex-1">{filterBar}</div>
          )}
          <div className="relative w-full sm:w-48 shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={col.width ? { width: col.width } : undefined}
                  className={clsx(
                    "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:text-gray-800 select-none"
                  )}
                  onClick={() => col.sortable && toggleSort(String(col.key))}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-3 py-2.5 w-20" />}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-gray-400">
                  No records found
                </td>
              </tr>
            ) : (
              paginated.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3 py-2.5 text-gray-700 max-w-xs truncate">
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[String(col.key)] ?? "")}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {canEditRow && !canEditRow(row) ? null : <>
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        </>}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between gap-3 flex-wrap text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
            {sorted.length !== data.length && ` (filtered from ${data.length})`}
          </span>
          <label className="flex items-center gap-1">
            Rows:
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-0.5 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} /> Prev
          </button>
          <span className="px-2">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-0.5 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
