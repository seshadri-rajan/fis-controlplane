
import React, { useMemo, useState } from "react";

interface DependencyItem {
    source: string;
    dag_id: string | null;
    task_ids: string[];
}

interface Dependencies {
    upstream: DependencyItem[];
    downstream: DependencyItem[];
}

interface DependencyTableProps {
    dependencies: Dependencies;
}

export default function DependencyTable({
    dependencies
}: DependencyTableProps) {

    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const pageSize = 20;

    // COMBINE UPSTREAM AND DOWNSTREAM
    const dependencyRows = [
        ...dependencies.upstream.map((item, index) => ({
            ...item,
            type: "Upstream" as const,
            rowId: `upstream-${index}`
        })),

        ...dependencies.downstream.map((item, index) => ({
            ...item,
            type: "Downstream" as const,
            rowId: `downstream-${index}`
        }))
    ];

    // EXPAND / COLLAPSE
    const handleExpand = (rowId: string) => {
        setExpandedRow(previous =>
            previous === rowId ? null : rowId
        );
        setCurrentPage(1);
    };

    // SELECTED DEPENDENCY
    const selectedDependency = dependencyRows.find(
        item => item.rowId === expandedRow
    );

    // TASK IDS
    const filteredTasks = useMemo(() => {
        if (!selectedDependency) return [];

        return selectedDependency.task_ids;
    }, [selectedDependency]);

    // PAGINATION
    const totalPages = Math.ceil(filteredTasks.length / pageSize);

    const startIndex = (currentPage - 1) * pageSize;

    const currentTasks = filteredTasks.slice(
        startIndex,
        startIndex + pageSize
    );

    return (
        <div className="space-y-4">

            <div className="border border-slate-200 rounded-lg overflow-hidden">

                {/* HEADER */}
                <div className="px-3 py-3 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-800">
                        DAG Dependencies
                    </h3>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">

                    <table className="w-full min-w-[600px] text-left border-collapse">

                        <thead className="bg-slate-100">
                            <tr>
                                <th className="px-3 py-3 text-xs font-semibold text-slate-600">
                                    Dependency
                                </th>

                                <th className="px-3 py-3 text-xs font-semibold text-slate-600">
                                    Source
                                </th>

                                <th className="px-3 py-3 text-xs font-semibold text-slate-600">
                                    DAG ID
                                </th>

                                <th className="px-3 py-3 text-xs font-semibold text-slate-600 text-center">
                                    Task Count
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">

                            {dependencyRows.length > 0 ? (

                                dependencyRows.map(item => {

                                    const isExpanded =
                                        expandedRow === item.rowId;

                                    return (
                                        <React.Fragment key={item.rowId}>

                                            {/* MAIN ROW */}
                                            <tr
                                                onClick={() => handleExpand(item.rowId)}
                                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                                            >

                                                {/* DEPENDENCY WITH EXPAND */}
                                                <td className="px-3 py-3">

                                                    <div className="flex items-center gap-2">

                                                        <span className="text-slate-500 text-xs">
                                                            {isExpanded ? "▼" : "▶"}
                                                        </span>

                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            item.type === "Upstream"
                                                                ? "bg-blue-100 text-blue-700"
                                                                : "bg-green-100 text-green-700"
                                                        }`}>
                                                            {item.type}
                                                        </span>


                                                    </div>

                                                </td>

                                                <td className="px-3 py-3 text-sm text-slate-700">
                                                    {item.source || "N/A"}
                                                </td>

                                                <td className="px-3 py-3 text-sm text-slate-700 break-all">
                                                    {item.dag_id || "N/A"}
                                                </td>

                                                <td className="px-3 py-3 text-center">

                                                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                                                        {item.task_ids.length}
                                                    </span>

                                                </td>

                                            </tr>

                                            {/* EXPANDED TASK DETAILS */}
                                            {isExpanded && (

                                                <tr>

                                                    <td
                                                        colSpan={4}
                                                        className="p-3 bg-slate-50"
                                                    >

                                                        <div className="border border-slate-200 bg-white rounded-lg p-3 space-y-3">

                                                            {/* TASK HEADER */}
                                                            <div className="flex justify-between items-center">

                                                                <div>
                                                                    <h4 className="text-sm font-bold text-slate-800">
                                                                        Task IDs
                                                                    </h4>

                                                                    <p className="text-xs text-slate-500 mt-1">
                                                                        {item.dag_id || "No DAG ID"}
                                                                        {" · "}
                                                                        {item.task_ids.length} tasks
                                                                    </p>
                                                                </div>

                                                                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                                                                    {item.task_ids.length}
                                                                </span>

                                                            </div>

                                                            {/* TASK LIST */}
                                                            <div className="border border-slate-200 rounded-lg p-2 max-h-[220px] overflow-y-auto">

                                                                {currentTasks.length > 0 ? (

                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

                                                                        {currentTasks.map((taskId, index) => (

                                                                            <div
                                                                                key={`${taskId}-${startIndex + index}`}
                                                                                className="px-2 py-2 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium break-all"
                                                                            >
                                                                                {taskId}
                                                                            </div>

                                                                        ))}

                                                                    </div>

                                                                ) : (

                                                                    <p className="text-center text-xs text-slate-500 py-6">
                                                                        No task IDs found.
                                                                    </p>

                                                                )}

                                                            </div>

                                                            {/* PAGINATION */}
                                                            <div className="flex flex-wrap justify-between items-center gap-2">

                                                                <p className="text-xs text-slate-500">
                                                                    {filteredTasks.length === 0
                                                                        ? "0–0 of 0"
                                                                        : `${startIndex + 1}–${Math.min(
                                                                            startIndex + pageSize,
                                                                            filteredTasks.length
                                                                        )} of ${filteredTasks.length}`
                                                                    }
                                                                </p>

                                                                <div className="flex items-center gap-2">

                                                                    <button
                                                                        type="button"
                                                                        disabled={currentPage === 1}
                                                                        onClick={() => setCurrentPage(p => p - 1)}
                                                                        className="px-2 py-1 rounded border text-xs disabled:opacity-40"
                                                                    >
                                                                        Previous
                                                                    </button>

                                                                    <span className="text-xs text-slate-600">
                                                                        {totalPages === 0 ? 0 : currentPage} / {totalPages}
                                                                    </span>

                                                                    <button
                                                                        type="button"
                                                                        disabled={currentPage >= totalPages}
                                                                        onClick={() => setCurrentPage(p => p + 1)}
                                                                        className="px-2 py-1 rounded border text-xs disabled:opacity-40"
                                                                    >
                                                                        Next
                                                                    </button>

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </td>

                                                </tr>

                                            )}

                                        </React.Fragment>
                                    );
                                })

                            ) : (

                                <tr>
                                    <td
                                        colSpan={4}
                                        className="text-center py-8 text-sm text-slate-500"
                                    >
                                        No dependencies found.
                                    </td>
                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

                {/* FOOTER */}
                <div className="px-3 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">

                    <span className="text-xs font-semibold text-indigo-600">
                        Total Dependencies: {dependencyRows.length}
                    </span>

                </div>

            </div>

        </div>
    );
}
