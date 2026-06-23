"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { clsx } from "clsx";

export type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
};

type Props<T extends { id: string }> = {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  filterBar?: React.ReactNode;
  title?: string;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  filterBar,
  title,
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        {/* Top row: title + add button */}
        <div className="flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>}
          {onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
            >
              <Plus size={14} /> Add
            </button>
          )}
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
              sorted.map((row) => (
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
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400">
        {sorted.length} of {data.length} record{data.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
