
import React, { Fragment, useState } from "react";

// ==========================================
// TYPES
// ==========================================

type DagStatus =
  | "Success"
  | "Failed"
  | "In Progress"
  | "Paused"
  | "Inactive";

interface Dag {
  id: number;
  status: DagStatus;
  name: string;
  class: string;
  date: string;
  duration: string;
  owner: string;
  startedBy: string;
  runId: string;
  endTime: string;
}

interface Task {
  id: number;
  name: string;
  status: string;
  owner: string;
  startTime: string;
  endTime: string;
  duration: string;
}

// ==========================================
// DAG DUMMY DATA
// ==========================================

const dummyData: Dag[] = [
  { id: 1, status: "Success", name: "DAG1", class: "Unit A", date: "2026-10-01 12:34", duration: "45m 12s", owner: "John Smith", startedBy: "Tst1233", runId: "RUN001", endTime: "2026-10-01 13:19" },
  { id: 2, status: "Failed", name: "DAG2", class: "Unit B", date: "2026-10-03 09:45", duration: "47m 12s", owner: "David Lee", startedBy: "Tst1233", runId: "RUN002", endTime: "2026-10-03 10:32" },
  { id: 15, status: "In Progress", name: "DAG15", class: "Unit P", date: "2026-10-15 14:34", duration: "-", owner: "John Smith", startedBy: "Tst1233", runId: "RUN015", endTime: "-" },
  { id: 16, status: "Paused", name: "DAG16", class: "Unit F", date: "-", duration: "-", owner: "David Lee", startedBy: "DTst1233", runId: "RUN016", endTime: "-" },
  { id: 17, status: "Inactive", name: "DAG17", class: "Unit A", date: "-", duration: "-", owner: "John Smith", startedBy: "Tst1233", runId: "RUN017", endTime: "-" },
  { id: 18, status: "Paused", name: "DAG18", class: "Unit A", date: "-", duration: "-", owner: "Mary Jones", startedBy: "Tst1233", runId: "RUN018", endTime: "-" },
  { id: 3, status: "Success", name: "DAG3", class: "Unit A", date: "2026-10-05 08:15", duration: "55m 12s", owner: "John Smith", startedBy: "Tst1233", runId: "RUN003", endTime: "2026-10-05 09:10" },
  { id: 4, status: "Failed", name: "DAG4", class: "Unit A", date: "2026-10-07 07:56", duration: "35m 12s", owner: "Mary Jones", startedBy: "Tst1233", runId: "RUN004", endTime: "2026-10-07 08:31" },
  { id: 5, status: "Success", name: "DAG5", class: "Unit A", date: "2026-10-09 20:30", duration: "55m 12s", owner: "John Smith", startedBy: "Tst1233", runId: "RUN005", endTime: "2026-10-09 21:25" },
  { id: 6, status: "Failed", name: "DAG6", class: "Unit F", date: "2026-10-11 15:20", duration: "25m 12s", owner: "David Lee", startedBy: "DTst1233", runId: "RUN006", endTime: "2026-10-11 15:45" },
  { id: 7, status: "Success", name: "DAG7", class: "Unit A", date: "2026-10-12 13:40", duration: "25m 12s", owner: "John Smith", startedBy: "Tst1233", runId: "RUN007", endTime: "2026-10-12 14:05" },
  { id: 8, status: "Failed", name: "DAG8", class: "Unit A", date: "2026-10-14 15:43", duration: "45m 12s", owner: "Mary Jones", startedBy: "Tst1233", runId: "RUN008", endTime: "2026-10-14 16:28" },
  { id: 9, status: "Success", name: "DAG9", class: "Unit I", date: "2026-10-16 18:40", duration: "54m 12s", owner: "David Lee", startedBy: "Tst1233", runId: "RUN009", endTime: "2026-10-16 19:34" },
  { id: 10, status: "Failed", name: "DAG10", class: "Unit A", date: "2026-10-18 17:10", duration: "15m 12s", owner: "John Smith", startedBy: "JTst1233h", runId: "RUN010", endTime: "2026-10-18 17:25" },
  { id: 11, status: "Success", name: "DAG11", class: "Unit K", date: "2026-10-19 03:03", duration: "65m 12s", owner: "David Lee", startedBy: "Tst1233", runId: "RUN011", endTime: "2026-10-19 04:08" },
  { id: 12, status: "Success", name: "DAG12", class: "Unit A", date: "2026-10-20 08:20", duration: "45m 12s", owner: "John Smith", startedBy: "Tst1233", runId: "RUN012", endTime: "2026-10-20 09:05" },
  { id: 13, status: "Success", name: "DAG13", class: "Unit M", date: "2026-10-04 13:58", duration: "45m 12s", owner: "Mary Jones", startedBy: "Tst1233", runId: "RUN013", endTime: "2026-10-04 14:43" },
  { id: 14, status: "Failed", name: "DAG14", class: "Unit A", date: "2026-10-08 12:00", duration: "45m 12s", owner: "David Lee", startedBy: "Tst1233", runId: "RUN014", endTime: "2026-10-08 12:45" },
  { id: 19, status: "Inactive", name: "DAG19", class: "Unit I", date: "-", duration: "-", owner: "David Lee", startedBy: "Tst1233", runId: "RUN019", endTime: "-" }
];

// ==========================================
// TASK DUMMY DATA
// 25 TASKS PER DAG
// ==========================================

const taskData: Record<number, Task[]> = Object.fromEntries(
  dummyData.map((dag) => [
    dag.id,
    Array.from({ length: 25 }, (_, index): Task => {
      let taskStatus = "Success";

      if (dag.status === "Failed" && index === 4) {
        taskStatus = "Failed";
      } else if (
        (dag.status === "Failed" && index > 4) ||
        (dag.status === "In Progress" && index > 2)
      ) {
        taskStatus = "In Progress";
      }

      return {
        id: index + 1,
        name: `${dag.name}_Task_${index + 1}`,
        status: taskStatus,
        owner: index % 2 === 0 ? "Data Team" : "ETL Team",
        startTime: `12:${String(index + 1).padStart(2, "0")}`,
        endTime:
          taskStatus === "In Progress"
            ? "-"
            : `17:${String(index + 2).padStart(2, "0")}`,
        duration:
          taskStatus === "In Progress"
            ? "-"
            : `${5 + index}m ${index + 10}s`
      };
    })
  ])
);

// ==========================================
// HTML ESCAPE HELPER
// ==========================================

const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char] || char);

// ==========================================
// OPEN TASK DETAILS IN NEW WINDOW
// ==========================================

const openTaskWindow = (item: Dag) => {
  const tasks = taskData[item.id] || [];

  const taskRows = tasks.map((task) => {
    const statusClass =
      task.status === "Success"
        ? "bg-green-100 text-green-700"
        : task.status === "Failed"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700";

    return `
      <tr class="hover:bg-slate-50">
        <td class="px-4 py-3 border-b border-slate-100">${escapeHtml(task.id)}</td>
        <td class="px-4 py-3 border-b border-slate-100">${escapeHtml(task.name)}</td>
        <td class="px-4 py-3 border-b border-slate-100">
          <span class="inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">
            ${escapeHtml(task.status)}
          </span>
        </td>
        <td class="px-4 py-3 border-b border-slate-100">${escapeHtml(task.startTime)}</td>
        <td class="px-4 py-3 border-b border-slate-100">${escapeHtml(task.endTime)}</td>
        <td class="px-4 py-3 border-b border-slate-100">${escapeHtml(task.duration)}</td>
      </tr>
    `;
  }).join("");

  const taskWindow = window.open(
    "",
    "_blank",
    "width=1200,height=800,resizable=yes"
  );

  if (!taskWindow) {
    alert("Please allow pop-ups for this application.");
    return;
  }

  const dag = {
    name: escapeHtml(item.name),
    unit: escapeHtml(item.class),
    owner: escapeHtml(item.owner),
    startedBy: escapeHtml(item.startedBy),
    runId: escapeHtml(item.runId),
    status: escapeHtml(item.status),
    startTime: escapeHtml(item.date),
    endTime: escapeHtml(item.endTime),
    duration: escapeHtml(item.duration)
  };

  taskWindow.document.open();

  taskWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <title>${dag.name} - Task Details</title>

      <script src="https://cdn.tailwindcss.com"></script>

      <style>
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
        }

        body {
          overflow: hidden;
        }

        .task-scroll::-webkit-scrollbar {
          width: 9px;
          height: 9px;
        }

        .task-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .task-scroll::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 10px;
        }

        .task-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      </style>
    </head>

    <body class="bg-slate-50 text-slate-800 font-sans">

      <main class="h-screen flex flex-col gap-4 p-4 md:p-6">

        <!-- PAGE HEADER -->

        <div class="shrink-0">
          <h1 class="text-2xl font-bold text-slate-900">
            Task Execution Details
          </h1>

          <p class="text-sm text-slate-500 mt-1">
            ${dag.name} | ${dag.unit} | ${dag.runId}
          </p>
        </div>

        <!-- TASK TABLE CARD -->

        <section class="bg-white rounded-xl border border-slate-200 p-4 md:p-5 flex flex-col flex-1 min-h-0 overflow-hidden">

          <div class="shrink-0 mb-4">
            <h3 class="text-lg font-semibold text-slate-900">
              Task Execution Records
            </h3>

            <span class="text-sm text-slate-500">
              Total Tasks: ${tasks.length}
            </span>
          </div>

          <!-- SCROLLABLE TABLE -->

          <div class="task-scroll flex-1 min-h-0 overflow-auto border border-slate-200 rounded-lg">

            <table class="w-full min-w-[750px] text-left border-collapse">

              <thead class="sticky top-0 z-10 bg-slate-100 text-slate-600 text-xs uppercase">
                <tr>
                  <th class="px-4 py-3 font-semibold">Task ID</th>
                  <th class="px-4 py-3 font-semibold">Task Name</th>
                  <th class="px-4 py-3 font-semibold">Status</th>
                  <th class="px-4 py-3 font-semibold">Start Time</th>
                  <th class="px-4 py-3 font-semibold">End Time</th>
                  <th class="px-4 py-3 font-semibold">Duration</th>
                </tr>
              </thead>

              <tbody class="text-sm text-slate-700">
                ${taskRows}
              </tbody>

            </table>

          </div>

        </section>

      </main>

    </body>
    </html>
  `);

  taskWindow.document.close();
};

// ==========================================
// MAIN CONTROL PLANE COMPONENT
// ==========================================

export default function MetadataPage() {

  // ==========================================
  // SEARCH FILTERS
  // ==========================================

  const [dagName, setDagName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [status, setStatus] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ==========================================
  // RESULTS
  // ==========================================

  const [hasSearched, setHasSearched] = useState(false);
  const [filteredData, setFilteredData] = useState<Dag[]>([]);

  // ==========================================
  // PAGINATION
  // ==========================================

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // ==========================================
  // EXPANDED ROW
  // ==========================================

  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ==========================================
  // WILDCARD SEARCH HELPER
  // ==========================================

  const matchesWildcard = (value: string, search: string) => {
    if (!search.trim()) return true;

    const escaped = search
      .trim()
      .toLowerCase()
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");

    return new RegExp(`^${escaped}$`).test(value.toLowerCase());
  };

  // ==========================================
  // SEARCH FUNCTION
  // ==========================================

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const results = dummyData.filter((item) => {

      const matchesDag = matchesWildcard(
        item.name,
        dagName
      );

      const matchesUnit = matchesWildcard(
        item.class,
        unitName
      );

      const tasks = taskData[item.id] || [];

      const matchesTask =
        !taskName.trim() ||
        tasks.some((task) =>
          matchesWildcard(task.name, taskName)
        );

      const matchesStatus =
        status === "All" || item.status === status;

      const itemDate = item.date.substring(0, 10);

      const matchesStartDate =
        !startDate || (itemDate !== "-" && itemDate >= startDate);

      const matchesEndDate =
        !endDate || (itemDate !== "-" && itemDate <= endDate);

      return (
        matchesDag &&
        matchesUnit &&
        matchesTask &&
        matchesStatus &&
        matchesStartDate &&
        matchesEndDate
      );
    });

    setFilteredData(results);
    setCurrentPage(1);
    setExpandedRow(null);
    setHasSearched(true);
  };

  // ==========================================
  // RESET FUNCTION
  // ==========================================

  const handleReset = () => {
    setDagName("");
    setUnitName("");
    setTaskName("");
    setStatus("All");
    setStartDate("");
    setEndDate("");

    setFilteredData([]);
    setCurrentPage(1);
    setExpandedRow(null);
    setHasSearched(false);
  };

  // ==========================================
  // EXPAND / COLLAPSE ROW
  // ==========================================

  const toggleRow = (id: number) => {
    setExpandedRow((previous) =>
      previous === id ? null : id
    );
  };

  // ==========================================
  // PAGINATION CALCULATIONS
  // ==========================================

  const totalPages = Math.ceil(
    filteredData.length / pageSize
  );

  const startIndex = (currentPage - 1) * pageSize;

  const currentData = filteredData.slice(
    startIndex,
    startIndex + pageSize
  );

  // ==========================================
  // SUMMARY COUNTS
  // ==========================================

  const activeCount = filteredData.filter(
    (item) => item.status === "Success"
  ).length;

  const failedCount = filteredData.filter(
    (item) => item.status === "Failed"
  ).length;

  const pendingCount = filteredData.filter(
    (item) => item.status === "In Progress"
  ).length;

  const paused = filteredData.filter(
    (item) => item.status === "Paused"
  ).length;

  const inActive = filteredData.filter(
    (item) => item.status === "Inactive"
  ).length;

  // ==========================================
  // STATUS COLORS
  // ==========================================

  const statusColors: Record<DagStatus, string> = {
    Success: "bg-green-500",
    Failed: "bg-red-500",
    "In Progress": "bg-blue-500",
    Paused: "bg-amber-500",
    Inactive: "bg-slate-400"
  };

  // ==========================================
  // JSX START
  // ==========================================

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">

      {/* Remaining JSX continues in Part 4 */}

      {/* HEADER */}


      <main className="w-full  py-5">

        {/* SEARCH FORM */}
        <div>
        <form
          className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6"
          onSubmit={handleSearch}
        >

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* DAG NAME */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="dagName"
                className="text-sm font-semibold text-slate-700"
              >
                DAG Name

                <span className="relative inline-flex ml-2 group">
                  <span className="text-slate-400 cursor-help">
                    ⓘ
                  </span>

                  <span className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs rounded-lg p-3 z-20 shadow-lg">
                    Use * as a wildcard to search for multiple DAG names.
                    For example, DAG* matches all DAG names starting with DAG.
                  </span>
                </span>
              </label>

              <input
                id="dagName"
                type="text"
                placeholder="Enter DAG name"
                value={dagName}
                onChange={(e) => setDagName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* BUSINESS UNIT */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="unitName"
                className="text-sm font-semibold text-slate-700"
              >
                Business Unit Name
              </label>

              <input
                id="unitName"
                type="text"
                placeholder="Enter business unit"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* TASK NAME */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="taskName"
                className="text-sm font-semibold text-slate-700"
              >
                Task Name
              </label>

              <input
                id="taskName"
                type="text"
                placeholder="Enter task name"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* STATUS */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="status"
                className="text-sm font-semibold text-slate-700"
              >
                Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="All">All Status</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="In Progress">In Progress</option>
                <option value="Paused">Paused</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* FROM DATE */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="startDate"
                className="text-sm font-semibold text-slate-700"
              >
                From Date
              </label>

              <input
                id="startDate"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* TO DATE */}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="endDate"
                className="text-sm font-semibold text-slate-700"
              >
                To Date
              </label>

              <input
                id="endDate"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

          </div>

          {/* SEARCH AND RESET BUTTONS */}

          <div className="flex flex-wrap justify-end gap-3 mt-6 pt-5 border-t border-slate-100">

            <button
              type="button"
              onClick={handleReset}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
            >
              Reset
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
            >
              Search
            </button>

          </div>

        </form>
        </div>

        {/* DISPLAY RESULTS AFTER SEARCH */}

        {hasSearched && (
          <>

            {/* SUMMARY CARDS */}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">

              {/* TOTAL */}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-sm font-medium text-slate-500">
                  Total
                </p>

                <h2 className="text-3xl font-bold text-slate-900 mt-2">
                  {filteredData.length}
                </h2>
              </div>

              {/* SUCCESS */}

              <div className="bg-white rounded-xl border border-green-200 shadow-sm p-4">
                <p className="text-sm font-medium text-green-600">
                  Success
                </p>

                <h2 className="text-3xl font-bold text-green-700 mt-2">
                  {activeCount}
                </h2>
              </div>

              {/* FAILED */}

              <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4">
                <p className="text-sm font-medium text-red-600">
                  Failed
                </p>

                <h2 className="text-3xl font-bold text-red-700 mt-2">
                  {failedCount}
                </h2>
              </div>

              {/* IN PROGRESS */}

              <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
                <p className="text-sm font-medium text-blue-600">
                  In Progress
                </p>

                <h2 className="text-3xl font-bold text-blue-700 mt-2">
                  {pendingCount}
                </h2>
              </div>

              {/* PAUSED */}

              <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
                <p className="text-sm font-medium text-amber-600">
                  Paused
                </p>

                <h2 className="text-3xl font-bold text-amber-700 mt-2">
                  {paused}
                </h2>
              </div>

              {/* INACTIVE */}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-sm font-medium text-slate-500">
                  Inactive
                </p>

                <h2 className="text-3xl font-bold text-slate-700 mt-2">
                  {inActive}
                </h2>
              </div>

            </div>

            {/* DAG TABLE CONTINUES IN PART 5 */}


            {/* ==================================
                DAG RESULTS TABLE
            ================================== */}

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm mt-6 overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px] text-left">

                  {/* TABLE HEADER */}

                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-4 w-12"></th>

                      <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                        Status
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                        DAG Name
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                        Business Unit
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                        Start Time
                      </th>

                      <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase">
                        Duration
                      </th>
                    </tr>
                  </thead>

                  {/* TABLE BODY */}

                  <tbody className="divide-y divide-slate-100">

                    {currentData.length > 0 ? (

                      currentData.map((item) => (

                        <Fragment key={item.id}>

                          {/* MAIN DAG ROW */}

                          <tr
                            className={`cursor-pointer transition hover:bg-indigo-50/40 ${expandedRow === item.id
                              ? "bg-indigo-50/50"
                              : ""
                              }`}
                            onClick={() => toggleRow(item.id)}
                            aria-expanded={expandedRow === item.id}
                          >

                            <td className="px-5 py-4 text-center">
                              <span className="text-xs text-slate-500">
                                {expandedRow === item.id ? "▼" : "▶"}
                              </span>
                            </td>

                            {/* STATUS */}

                            <td className="px-5 py-4">
                              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 whitespace-nowrap">

                                <span
                                  className={`w-3.5 h-3.5 rounded-full ${statusColors[item.status]}`}
                                />

                                {item.status}

                              </span>
                            </td>

                            {/* DAG NAME */}

                            <td className="px-5 py-4">
                              <span className="text-sm font-semibold text-indigo-600">
                                {item.name}
                              </span>
                            </td>

                            {/* BUSINESS UNIT */}

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {item.class}
                            </td>

                            {/* START TIME */}

                            <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {item.date}
                            </td>

                            {/* DURATION */}

                            <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {item.duration}
                            </td>

                          </tr>

                          {/* EXPANDED JOB INFORMATION */}

                          {expandedRow === item.id && (

                            <tr className="bg-slate-50/80">

                              <td colSpan={6} className="px-5 py-5">

                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">

                                  <h3 className="text-base font-bold text-slate-800 mb-5">
                                    DAG Information
                                  </h3>

                                  {/* JOB DETAILS GRID */}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        DAG Name
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.name}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Business Unit
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.class}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Bundle Name
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.startedBy}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Run ID
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.runId}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Execution Status
                                      </label>

                                      <strong className="text-sm text-slate-800">
                                        {item.status}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Start Time
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.date}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        End Time
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.endTime}
                                      </strong>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-500">
                                        Duration
                                      </label>
                                      <strong className="text-sm text-slate-800">
                                        {item.duration}
                                      </strong>
                                    </div>

                                  </div>

                                  {/* TASK ACTION */}

                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-slate-100">

                                    <span className="text-sm text-slate-500">
                                      Total Tasks:{" "}
                                      <strong className="text-slate-800">
                                        {taskData[item.id].length}
                                      </strong>
                                    </span>

                                    {[
                                      "In Progress",
                                      "Success",
                                      "Failed"
                                    ].includes(item.status) && (

                                        <button
                                          type="button"
                                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openTaskWindow(item);
                                          }}
                                        >
                                          View Tasks →
                                        </button>

                                      )}

                                  </div>

                                </div>

                              </td>

                            </tr>

                          )}

                        </Fragment>

                      ))

                    ) : (

                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-slate-500"
                        >
                          No records found. Try different search filters.
                        </td>
                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

              {/* PAGINATION CONTINUES IN PART 6 */}


              {/* ==================================
                  PAGINATION
              ================================== */}

              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-slate-200">

                {/* ROWS PER PAGE */}

                <div className="flex items-center gap-2 text-sm text-slate-600">

                  <label htmlFor="pageSize">
                    Rows per page:
                  </label>

                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                      setExpandedRow(null);
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>

                </div>

                {/* PAGINATION INFO */}

                <div className="text-sm text-slate-500">

                  {filteredData.length === 0
                    ? "0–0 of 0"
                    : `${startIndex + 1}–${Math.min(
                      startIndex + pageSize,
                      filteredData.length
                    )} of ${filteredData.length}`}

                </div>

                {/* PAGINATION BUTTONS */}

                {/* PAGINATION BUTTONS */}

                <div className="flex items-center gap-2">

                  {/* PREVIOUS */}

                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((p) => p - 1);
                      setExpandedRow(null);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {/* PAGE NUMBERS */}

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => {
                          setCurrentPage(page);
                          setExpandedRow(null);
                        }}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${currentPage === page
                            ? "bg-indigo-600 text-white border border-indigo-600"
                            : "border border-slate-300 text-slate-700 hover:bg-indigo-50"
                          }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  {/* NEXT */}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages || totalPages === 0}
                    onClick={() => {
                      setCurrentPage((p) => p + 1);
                      setExpandedRow(null);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>

                </div>

              </div>

            </section>

          </>
        )}

      </main>

    </div>
  );
}
