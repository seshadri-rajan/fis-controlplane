import { useState, useEffect } from "react";

import type {
    Dag,
    DagStatus,
    DagRun,
    Task,
    TaskDetails
} from "./types";

import {
    taskData,
    runHistoryData,
    runTaskHistoryData,
    taskDetailsData,
    dagDependencyData
} from "./data";
import DependencyTable from "./DependencyTable";
import RunHistoryTasks from "./RunHistoryTasks";

// ==========================================
// PROPS
// ==========================================

interface ResultsPanelProps {
    filteredData: Dag[];
    selectedDag: Dag | null;
    onSelectDag: (dag: Dag) => void;
    onCloseDrawer: () => void;
}

// ==========================================
// FILTER TYPES
// ==========================================

interface ColumnFilters {
    status: string;
    dagName: string;
    taskName: string;
    taskStatus: string;
    businessUnit: string;
    startTime: string;
    duration: string;
}

const initialFilters: ColumnFilters = {
    status: "",
    dagName: "",
    taskName: "",
    taskStatus: "",
    businessUnit: "",
    startTime: "",
    duration: ""
};

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
// SUMMARY CARDS
// ==========================================

function SummaryCards({ data }: { data: Dag[] }) {

    const cards = [
        {
            label: "Total",
            count: data.length,
            color: "text-slate-900",
            border: "border-slate-200"
        },
        {
            label: "Success",
            count: data.filter(x => x.status === "Success").length,
            color: "text-green-700",
            border: "border-green-200"
        },
        {
            label: "Failed",
            count: data.filter(x => x.status === "Failed").length,
            color: "text-red-700",
            border: "border-red-200"
        },
        {
            label: "In Progress",
            count: data.filter(x => x.status === "In Progress").length,
            color: "text-blue-700",
            border: "border-blue-200"
        },
        {
            label: "Paused",
            count: data.filter(x => x.status === "Paused").length,
            color: "text-amber-700",
            border: "border-amber-200"
        },
        {
            label: "Inactive",
            count: data.filter(x => x.status === "Inactive").length,
            color: "text-slate-700",
            border: "border-slate-200"
        }
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">

            {cards.map(card => (

                <div
                    key={card.label}
                    className={`bg-white rounded-xl border ${card.border} shadow-sm p-3`}
                >

                    <p className="text-xs font-medium text-slate-500">
                        {card.label}
                    </p>

                    <h2 className={`text-2xl font-bold mt-2 ${card.color}`}>
                        {card.count}
                    </h2>

                </div>

            ))}

        </div>
    );
}

// ==========================================
// TASK TABLE
// ==========================================

function TaskTable({
    tasks,
    onTaskClick
}: {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}) {

    return (
        <div className="border border-slate-200 rounded-lg overflow-auto max-h-[300px]">

            <table className="w-full min-w-[600px] text-left border-collapse">

                <thead className="sticky top-0 z-10 bg-slate-100">

                    <tr>
                        {[
                            "Task Name",
                            "Hierarchy level",
                            "Status",
                            "Start Time",
                            "End Time",
                            "Duration"
                        ].map(heading => (

                            <th
                                key={heading}
                                className="px-3 py-3 text-xs font-semibold text-slate-600 uppercase whitespace-nowrap"
                            >
                                {heading}
                            </th>

                        ))}
                    </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                    {tasks.map(task => {

                        const color =
                            task.status === "Success"
                                ? "bg-green-100 text-green-700"
                                : task.status === "Failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700";

                        return (

                            <tr key={task.id} className="hover:bg-slate-50">

                                {/* CLICKABLE TASK NAME */}

                                <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">

                                    <button
                                        type="button"
                                        onClick={() => onTaskClick(task)}
                                        className="text-indigo-600 hover:text-indigo-800 hover:underline font-semibold"
                                    >
                                        {task.name}
                                    </button>

                                </td>
                                <td className="px-3 py-3">

                                    {task.hierarchyLevel}

                                </td>

                                <td className="px-3 py-3">

                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${color}`}>
                                        {task.status}
                                    </span>

                                </td>

                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                    {task.startTime}
                                </td>

                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                    {task.endTime}
                                </td>

                                <td className="px-3 py-3 text-sm whitespace-nowrap">
                                    {task.duration}
                                </td>

                            </tr>

                        );

                    })}

                    {tasks.length === 0 && (

                        <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                                No tasks available.
                            </td>
                        </tr>

                    )}

                </tbody>

            </table>

        </div>
    );
}


function DagDrawer({
    dag,
    onClose,
    onOpenHistoricalTasks,
    activeTab,
    setActiveTab,
    onOpenTaskPopup
}: {
    dag: Dag;
    onClose: () => void;
    onOpenHistoricalTasks: (run: DagRun) => void;
    onOpenTaskPopup: (dag: Dag, task: Task) => void;
    activeTab: "overview" | "tasks" | "history" | "dependency";
    setActiveTab: (
        tab: "overview" | "tasks" | "history" | "dependency"
    ) => void;
}) {

    const tasks = taskData[dag.id] || [];
    const history = runHistoryData[dag.id] || [];

    const details = [
        ["DAG Name", dag.name],
        ["Business Unit", dag.businessUnit],
        ["Owner", dag.owner],
        ["Bundle Name", dag.startedBy],
        ["Run ID", dag.runId],
        ["Start Time", dag.date],
        ["End Time", dag.endTime],
        ["Duration", dag.duration]
    ];

    const dependencies = dagDependencyData[String(dag.id)] || {
        upstream: [],
        downstream: []
    };

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "tasks", label: "Task List" },
        { id: "history", label: "Run History" },
        { id: "dependency", label: "Dependency" }
    ] as const;

    return (

        <aside className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-w-0 h-full overflow-hidden">

            {/* HEADER */}

            <div className="px-4 py-3 border-b border-slate-200 shrink-0">

                <div className="flex justify-between items-center gap-2">

                    <h2 className="text-sm font-bold text-slate-800">
                        DAG Information
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1 text-xl"
                    >
                        ×
                    </button>

                </div>

                <div className="flex justify-between items-center gap-2 mt-2">

                    <p className="text-sm font-semibold text-indigo-600 truncate">
                        DAG Name: {dag.name}
                    </p>

                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 whitespace-nowrap">
                        {dag.status}
                    </span>

                </div>

            </div>

            {/* TABS */}

            <div className="flex border-b border-slate-200 shrink-0">

                {tabs.map(tab => (

                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-2 py-3 text-xs font-semibold transition whitespace-nowrap ${activeTab === tab.id
                            ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                            : "text-slate-500 hover:bg-slate-50"
                            }`}
                    >
                        {tab.label}
                    </button>

                ))}

            </div>

            {/* TAB CONTENT */}

            <div className="flex-1 min-h-0 overflow-y-auto p-4">

                {/* OVERVIEW */}

                {activeTab === "overview" && (

                    <div>

                        <h3 className="text-sm font-bold text-slate-800 mb-4">
                            Execution Details
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                            {details.map(([label, value]) => (

                                <div
                                    key={label}
                                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 min-w-0"
                                >

                                    <p className="text-xs text-slate-500 mb-1">
                                        {label}
                                    </p>

                                    <p className="text-sm font-bold text-slate-800 break-words">
                                        {value || "N/A"}
                                    </p>

                                </div>

                            ))}

                        </div>

                    </div>

                )}

                {/* TASK LIST */}

                {activeTab === "tasks" && (

                    <div>

                        <div className="flex justify-between items-center mb-4">

                            <h3 className="text-sm font-bold text-slate-800">
                                Task Information
                            </h3>

                            <span className="text-xs font-semibold text-indigo-600">
                                Total: {tasks.length}
                            </span>

                        </div>

                        <TaskTable tasks={tasks} onTaskClick={(task) => onOpenTaskPopup(dag, task)} />

                    </div>

                )}

                {/* RUN HISTORY */}

                {activeTab === "history" && (

                    <div>

                        <div className="flex justify-between items-center mb-4">

                            <h3 className="text-sm font-bold text-slate-800">
                                Previous Runs
                            </h3>

                            <span className="text-xs font-semibold text-indigo-600">
                                Total: {history.length}
                            </span>

                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-lg">

                            <table className="w-full min-w-[650px] text-left">

                                <thead className="bg-slate-50">

                                    <tr>
                                        {[
                                            "Status",
                                            "Run ID",
                                            "Start Time",
                                            "Duration",
                                            "Task List"
                                        ].map(heading => (

                                            <th
                                                key={heading}
                                                className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap"
                                            >
                                                {heading}
                                            </th>

                                        ))}
                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {history.length > 0 ? history.map(run => (

                                        <tr key={run.runId} className="hover:bg-slate-50">

                                            <td className="px-3 py-3">

                                                <span className={`text-xs font-semibold ${run.status === "Success"
                                                    ? "text-green-700"
                                                    : run.status === "Failed"
                                                        ? "text-red-700"
                                                        : "text-blue-700"
                                                    }`}>
                                                    {run.status}
                                                </span>

                                            </td>

                                            <td className="px-3 py-3 text-xs font-medium whitespace-nowrap">
                                                {run.runId}
                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                {run.date}
                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                {run.duration}
                                            </td>

                                            <td className="px-3 py-3">

                                                <button
                                                    type="button"
                                                    onClick={() => onOpenHistoricalTasks(run)}
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline whitespace-nowrap"
                                                >
                                                    View Tasks
                                                </button>

                                            </td>

                                        </tr>

                                    )) : (

                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="text-center py-8 text-sm text-slate-500"
                                            >
                                                No previous runs found.
                                            </td>
                                        </tr>

                                    )}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}


                {/* DEPENDENCY */}

                {activeTab === "dependency" && (
                    <DependencyTable
                        dependencies={dependencies}
                    />
                )}



            </div>

        </aside>

    );
}
// ==========================================
// TASK INFORMATION DRAWER
// ==========================================

function TaskDrawer({
    dag,
    task,
    taskDetails,
    onClose,
    activeTab,
    setActiveTab
}: {
    dag: Dag;
    task: Task;
    taskDetails: TaskDetails;
    onClose: () => void;
    activeTab: "overview" | "history" | "dependency";
    setActiveTab: (
        tab: "overview" | "history" | "dependency"
    ) => void;
}) {

    const history = runTaskHistoryData[dag.id] || [];
    const dependencies = dagDependencyData[String(dag.id)] || {
        upstream: [],
        downstream: []
    };


    const taskdInfoDtails = [
        ["Owner", taskDetails.owner],
        ["Description", taskDetails.description],
        ["Category", taskDetails.category],
        ["Command", taskDetails.command],
        ["Profile", taskDetails.profile],
        ["Host Name", taskDetails.hostname],
        ["Maximum Run Time (Minutes)", taskDetails.runTime],
        ["Critical Path", taskDetails.citicalPath],
        ["SLO", taskDetails.slo],
        ["Severity", taskDetails.severity],
        ["Support Group", taskDetails.supportGroup]
    ];

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "history", label: "Run History" },
        { id: "dependency", label: "Dependency" }
    ] as const;

    return (

        <aside className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-w-0 h-full overflow-hidden">

            {/* HEADER */}

            <div className="px-4 py-3 border-b border-slate-200 shrink-0">

                <div className="flex justify-between items-center gap-2">

                    <h2 className="text-sm font-bold text-slate-800">
                        Task Information
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-500 hover:bg-slate-100 rounded-lg px-2 py-1 text-xl"
                    >
                        ×
                    </button>

                </div>

                <div className="flex justify-between items-center gap-2 mt-2">

                    <p className="text-sm font-semibold text-indigo-600 truncate">
                        Task Name: {task.name}
                    </p>

                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 whitespace-nowrap">
                        {task.dagTaskStatus}
                    </span>

                </div>

            </div>

            {/* TABS */}

            <div className="flex border-b border-slate-200 shrink-0">

                {tabs.map(tab => (

                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 px-2 py-3 text-xs font-semibold transition whitespace-nowrap ${activeTab === tab.id
                            ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
                            : "text-slate-500 hover:bg-slate-50"
                            }`}
                    >
                        {tab.label}
                    </button>

                ))}

            </div>

            {/* TAB CONTENT */}

            <div className="flex-1 min-h-0 overflow-y-auto p-4">

                {/* OVERVIEW */}

                {activeTab === "overview" && (

                    <div>

                        <h3 className="text-sm font-bold text-slate-800 mb-4">
                            Task Execution Details
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                            {taskdInfoDtails.map(([label, value]) => (

                                <div
                                    key={label}
                                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 min-w-0"
                                >

                                    <p className="text-xs text-slate-500 mb-1">
                                        {label}
                                    </p>

                                    <p className="text-sm font-bold text-slate-800 break-words">
                                        {value || "N/A"}
                                    </p>

                                </div>

                            ))}

                        </div>

                    </div>

                )}

                {/* RUN HISTORY */}

                {activeTab === "history" && (

                    <div>

                        <div className="flex justify-between items-center mb-4">

                            <h3 className="text-sm font-bold text-slate-800">
                                Previous Runs
                            </h3>

                            <span className="text-xs font-semibold text-indigo-600">
                                Total: {history.length}
                            </span>

                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded-lg">

                            <table className="w-full min-w-[450px] text-left">

                                <thead className="bg-slate-50">

                                    <tr>
                                        {[
                                            "Status",
                                            "Task ID",
                                            "Start Time",
                                            "Duration"
                                        ].map(heading => (

                                            <th
                                                key={heading}
                                                className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap"
                                            >
                                                {heading}
                                            </th>

                                        ))}
                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {history.length > 0 ? history.map(run => (

                                        <tr key={run.runId}>

                                            <td className="px-3 py-3 text-xs font-semibold">

                                                <span className={
                                                    run.status === "Success"
                                                        ? "text-green-700"
                                                        : run.status === "Failed"
                                                            ? "text-red-700"
                                                            : "text-blue-700"
                                                }>
                                                    {run.status}
                                                </span>

                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                {run.taskId}
                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                {run.date}
                                            </td>

                                            <td className="px-3 py-3 text-xs whitespace-nowrap">
                                                {run.duration}
                                            </td>

                                        </tr>

                                    )) : (

                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="text-center py-8 text-sm text-slate-500"
                                            >
                                                No previous runs found.
                                            </td>
                                        </tr>

                                    )}

                                </tbody>

                            </table>

                        </div>

                    </div>

                )}

                {/* DEPENDENCY */}

                {activeTab === "dependency" && (

                    <DependencyTable
                        dependencies={dependencies}
                    />

                )}

            </div>

        </aside>

    );
}
// ==========================================
// MAIN RESULTS PANEL
// ==========================================

export default function ResultsPanel({
    filteredData,
    selectedDag,
    onSelectDag,
    onCloseDrawer
}: ResultsPanelProps) {

    // ==========================================
    // FILTER STATE
    // ==========================================

    const [filters, setFilters] = useState<ColumnFilters>({
        ...initialFilters
    });

    // ==========================================
    // PAGINATION STATE
    // ==========================================

    const [currentPage, setCurrentPage] = useState(1);

    const pageSize = 10;

    const [sortConfig, setSortConfig] = useState<{
        key: keyof Dag;
        direction: "asc" | "desc";
    }>({
        key: "name",
        direction: "asc"
    });

    // ==========================================
    // HANDLE COLUMN SORTING
    // ==========================================

    const handleSort = (key: keyof Dag) => {

        setSortConfig(previous => ({
            key,
            direction:
                previous.key === key && previous.direction === "asc"
                    ? "desc"
                    : "asc"
        }));

    };



    // ==========================================
    // HISTORICAL RUN STATE
    // ==========================================

    const [selectedHistoricalRun, setSelectedHistoricalRun] =
        useState<DagRun | null>(null);

    // ==========================================
    // DRAWER TAB STATE
    // ==========================================

    const [activeDrawerTab, setActiveDrawerTab] = useState<
        "overview" | "tasks" | "history" | "dependency"
    >("overview");

    // ==========================================
    // SELECTED TASK STATE
    // ==========================================

    const [selectedTask, setSelectedTask] = useState<{
        dag: Dag;
        task: Task;
        taskDetails: TaskDetails;
    } | null>(null);

    const [popupTask, setPopupTask] = useState<{
        dag: Dag;
        task: Task;
        taskDetails: TaskDetails;
    } | null>(null);

    const [popupTaskTab, setPopupTaskTab] = useState<
        "overview" | "history" | "dependency"
    >("overview");
    // ==========================================
    // UPDATE FILTER
    // ==========================================

    const handleFilterChange = (
        field: keyof ColumnFilters,
        value: string
    ) => {

        setFilters(previous => ({
            ...previous,
            [field]: value
        }));

        setCurrentPage(1);
    };

    // ==========================================
    // CLEAR ALL FILTERS
    // ==========================================

    const handleClearFilters = () => {

        setFilters({
            ...initialFilters
        });

        setCurrentPage(1);
    };

    // ==========================================
    // CHECK ACTIVE FILTERS
    // ==========================================

    const hasActiveFilters = Object.values(filters).some(
        value => value.trim() !== ""
    );

    // ==========================================
    // COMBINED FILTERING LOGIC
    // ==========================================

    const searchedData = filteredData.filter(item => {

        const matchesStatus =
            !filters.status ||
            item.status === filters.status;

        const matchesDagName =
            !filters.dagName ||
            item.name?.toLowerCase().includes(
                filters.dagName.toLowerCase()
            );

        const matchesTaskName =
            !filters.taskName ||
            item.dagTaskName?.toLowerCase().includes(
                filters.taskName.toLowerCase()
            );
        const matchesTaskStatus =
            !filters.taskStatus ||
            item.dagTaskStatus === filters.taskStatus;

        const matchesBusinessUnit =
            !filters.businessUnit ||
            item.businessUnit?.toLowerCase().includes(
                filters.businessUnit.toLowerCase()
            );

        const matchesStartTime =
            !filters.startTime ||
            item.date?.toLowerCase().includes(
                filters.startTime.toLowerCase()
            );

        const matchesDuration =
            !filters.duration ||
            item.duration?.toLowerCase().includes(
                filters.duration.toLowerCase()
            );

        return (
            matchesStatus &&
            matchesDagName &&
            matchesTaskName &&
            matchesTaskStatus &&
            matchesBusinessUnit &&
            matchesStartTime &&
            matchesDuration
        );

    });

    // ==========================================
    // SORT FILTERED DATA
    // ==========================================

    const sortedData = [...searchedData].sort((a, b) => {

        const valueA = a[sortConfig.key];
        const valueB = b[sortConfig.key];

        if (valueA == null) return 1;
        if (valueB == null) return -1;

        let comparison = 0;

        if (sortConfig.key === "date") {

            comparison =
                new Date(String(valueA)).getTime() -
                new Date(String(valueB)).getTime();

        } else if (sortConfig.key === "duration") {

            const getDuration = (value: unknown) => {
                const match = String(value).match(/\d+(\.\d+)?/);
                return match ? Number(match[0]) : 0;
            };

            comparison = getDuration(valueA) - getDuration(valueB);

        } else {

            comparison = String(valueA).localeCompare(
                String(valueB),
                undefined,
                {
                    numeric: true,
                    sensitivity: "base"
                }
            );

        }

        return sortConfig.direction === "asc"
            ? comparison
            : -comparison;

    });

    // ==========================================
    // PAGINATION CALCULATIONS
    // ==========================================

    const totalPages = Math.ceil(
        sortedData.length / pageSize
    );

    const startIndex = (currentPage - 1) * pageSize;


    const currentData = sortedData.slice(
        startIndex,
        startIndex + pageSize
    );

    // ==========================================
    // OPEN TASK DRAWER AS POPUP FROM DAG DRAWER
    // ==========================================

    const handleOpenTaskPopup = (dag: Dag, task: Task) => {

        const details =
            taskDetailsData[task.name] || {
                task_id: String(task.id),
                owner: "N/A",
                description: "No description available",
                category: "N/A",
                command: "No command available",
                profile: "No profile available",
                hostname: "No hostname available",
                runTime: "N/A",
                citicalPath: "N/A",
                slo: "N/A",
                severity: "N/A",
                supportGroup: "N/A"
            };

        setPopupTask({
            dag,
            task,
            taskDetails: details
        });

    };

    // ==========================================
    // OPEN TASK DRAWER
    // ==========================================

    const handleSelectTask = (
        dag: Dag,
        task: Task | null
    ) => {


        const selected = task || {
            id: 1,
            name: `${dag.name}_Task_1`,
            status: dag.status,
            startTime: dag.date,
            endTime: dag.endTime,
            duration: dag.duration
        } as Task;

        console.log("Selected DAG:", dag);
        console.log("Selected Task:", task);
        console.log("Selected Task:", selected.name);
        const details =
            taskDetailsData[selected.name] || {
                task_id: String(selected.id),
                command: "No command available",
                profile: "No profile available",
                hostname: "No hostname available",
                task_type: "No task type available"
            };

        onCloseDrawer();

        setSelectedTask({
            dag,
            task: selected,
            taskDetails: details
        });

        setActiveDrawerTab("overview");

        setSelectedHistoricalRun(null);
    };

    // ==========================================
    // CLOSE TASK DRAWER
    // ==========================================

    const handleCloseTaskDrawer = () => {
        setSelectedTask(null);
    };

    // ==========================================
    // OPEN DAG DRAWER
    // ==========================================

    const handleSelectDag = (dag: Dag) => {

        setSelectedTask(null);

        onSelectDag(dag);

        setActiveDrawerTab("overview");

        setSelectedHistoricalRun(null);
    };

    // ==========================================
    // RESET PAGINATION ON FILTER CHANGE
    // ==========================================

    useEffect(() => {

        setCurrentPage(1);

    }, [filters, filteredData]);

    // ==========================================
    // RESET ON NEW SEARCH
    // ==========================================

    useEffect(() => {

        setSelectedTask(null);
        setSelectedHistoricalRun(null);

    }, [filteredData]);

    // ==========================================
    // PROTECT CURRENT PAGE
    // ==========================================

    useEffect(() => {

        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }

    }, [currentPage, totalPages]);

    // ==========================================
    // HISTORICAL TASK SCREEN
    // ==========================================

    if (selectedHistoricalRun) {

        return (

            <div className="mt-6">

                <RunHistoryTasks
                    run={selectedHistoricalRun}
                    onBack={() => {

                        setSelectedHistoricalRun(null);

                        setActiveDrawerTab("history");

                    }}
                />

            </div>

        );

    }

    // ==========================================
    // MAIN UI RETURN
    // CONTINUES IN PART 5 AND PART 6
    // ==========================================
    return (

        <div className="mt-5">

            {/* SUMMARY CARDS */}

            <SummaryCards data={filteredData} />

            {/* TABLE AND DRAWER */}

            <div
                className={`grid gap-3 items-start ${selectedDag || selectedTask
                    ? "grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
                    : "grid-cols-1"
                    }`}
            >

                {/* =====================================
                    LEFT TABLE
                ===================================== */}

                <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-0 h-[550px] overflow-hidden">

                    <div className="min-w-0 overflow-x-auto flex-1">

                        <table className="w-full min-w-[850px] table-fixed text-left border-collapse">

                            {/* =====================================
                                TABLE HEADER
                            ===================================== */}

                            <thead className="bg-slate-50 border-b border-slate-200">

                                <tr>

                                    {[
                                        { label: "DAG STATUS", key: "status" },
                                        { label: "DAG NAME", key: "name" },
                                        { label: "TASK NAME", key: "dagTaskName" },
                                        { label: "TASK STATUS", key: "dagTaskStatus" },
                                        { label: "BUSINESS UNIT", key: "businessUnit" },
                                        { label: "START TIME", key: "date" },
                                        { label: "DURATION", key: "duration" }
                                    ].map(column => (

                                        <th
                                            key={column.key}
                                            className="px-2 py-3 text-xs font-semibold text-slate-500"
                                        >

                                            <button
                                                type="button"
                                                onClick={() => handleSort(column.key as keyof Dag)}
                                                className="flex items-center gap-1 hover:text-indigo-600 whitespace-nowrap"
                                            >

                                                {column.label}

                                                <span className="text-indigo-600 font-bold">

                                                    {sortConfig.key === column.key
                                                        ? sortConfig.direction === "asc"
                                                            ? "↑"
                                                            : "↓"
                                                        : "↕"}

                                                </span>

                                            </button>

                                        </th>

                                    ))}

                                </tr>

                                {/* =====================================
                                    SIX COLUMN FILTERS
                                ===================================== */}

                                <tr className="bg-white border-b border-slate-200">

                                    {/* STATUS FILTER */}

                                    <th className="px-2 py-2">

                                        <select
                                            value={filters.status}
                                            onChange={e =>
                                                handleFilterChange(
                                                    "status",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full min-w-0 border border-slate-300 rounded-md px-1 py-2 text-xs font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                        >

                                            <option value="">
                                                All Status
                                            </option>

                                            <option value="Success">
                                                Success
                                            </option>

                                            <option value="Failed">
                                                Failed
                                            </option>

                                            <option value="In Progress">
                                                In Progress
                                            </option>

                                            <option value="Paused">
                                                Paused
                                            </option>

                                            <option value="Inactive">
                                                Inactive
                                            </option>

                                        </select>

                                    </th>

                                    {/* DAG NAME FILTER */}

                                    <th className="px-2 py-2">

                                        <input
                                            type="text"
                                            value={filters.dagName}
                                            onChange={e =>
                                                handleFilterChange(
                                                    "dagName",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Search DAG..."
                                            className="w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-indigo-400"
                                        />

                                    </th>

                                    {/* TASK NAME FILTER */}

                                    <th className="px-2 py-2">

                                        <input
                                            type="text"
                                            value={filters.taskName}
                                            onChange={e =>
                                                handleFilterChange(
                                                    "taskName",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Search Task..."
                                            className="w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-indigo-400"
                                        />

                                    </th>
                                    {/* Task STATUS FILTER */}

                                    <th className="px-2 py-2">

                                        <select
                                            value={filters.taskStatus}
                                            onChange={e =>
                                                handleFilterChange(
                                                    "taskStatus",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full min-w-0 border border-slate-300 rounded-md px-1 py-2 text-xs font-normal text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                                        >

                                            <option value="">
                                                All Status
                                            </option>

                                            <option value="Success">
                                                Success
                                            </option>

                                            <option value="Failed">
                                                Failed
                                            </option>

                                            <option value="Up For Retry">
                                                Up For Retry
                                            </option>

                                            <option value="Upstream Failed">
                                                Upstream Failed
                                            </option>

                                            <option value="Up For Reschedule">
                                                Up For Reschedule
                                            </option>

                                            <option value="Skipped">
                                                Skipped
                                            </option>

                                            <option value="Running">
                                                Running
                                            </option>

                                            <option value="Scheduled">
                                                Scheduled
                                            </option>

                                            <option value="Deferred">
                                                Deferred
                                            </option>

                                            <option value="Restarting">
                                                Restarting
                                            </option>

                                            <option value="Removed">
                                                Removed
                                            </option>

                                        </select>

                                    </th>

                                    {/* BUSINESS UNIT FILTER */}

                                    <th className="px-2 py-2">

                                        <input
                                            type="text"
                                            value={filters.businessUnit}
                                            onChange={e =>
                                                handleFilterChange(
                                                    "businessUnit",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Search Unit..."
                                            className="w-full min-w-0 border border-slate-300 rounded-md px-2 py-2 text-xs font-normal outline-none focus:ring-2 focus:ring-indigo-400"
                                        />

                                    </th>

                                    {/* START TIME FILTER */}



                                    {/* DURATION FILTER */}



                                </tr>

                            </thead>

                            {/* =====================================
                                TABLE BODY
                            ===================================== */}

                            <tbody className="divide-y divide-slate-100">

                                {currentData.length > 0 ? (

                                    currentData.map(item => (

                                        <tr
                                            key={item.id}
                                            className="hover:bg-indigo-50/50 transition"
                                        >

                                            {/* STATUS */}

                                            <td className="px-2 py-3">

                                                <span className="flex items-center gap-1.5 text-xs">

                                                    <span
                                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[item.status]
                                                            }`}
                                                    />

                                                    <span className="truncate">
                                                        {item.status}
                                                    </span>

                                                </span>

                                            </td>

                                            {/* DAG NAME */}

                                            <td className="px-2 py-3">

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleSelectDag(item)
                                                    }
                                                    className="text-xs font-semibold text-indigo-600 cursor-pointer hover:underline text-left"
                                                >
                                                    {item.name}
                                                </button>

                                            </td>

                                            {/* TASK NAME */}

                                            <td className="px-2 py-3">

                                                {item.dagTaskName ? (

                                                    <button
                                                        type="button"
                                                        onClick={() => {

                                                            const tasks =
                                                                taskData[item.id] || [];

                                                            const matchingTask =
                                                                tasks.find(
                                                                    task =>
                                                                        task.name ===
                                                                        item.dagTaskName
                                                                );

                                                            handleSelectTask(
                                                                item,
                                                                matchingTask ||
                                                                tasks[0] ||
                                                                null
                                                            );

                                                        }}
                                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-left"
                                                    >
                                                        {item.dagTaskName}
                                                    </button>

                                                ) : (

                                                    <span className="text-xs text-slate-400">
                                                        N/A
                                                    </span>

                                                )}

                                            </td>

                                            {/* STATUS */}

                                            <td className="px-2 py-3">
                                                {item.dagTaskName ? (
                                                    <span className="flex items-center gap-1.5 text-xs">

                                                        <span className="truncate">
                                                            {item.dagTaskStatus}
                                                        </span>

                                                    </span>
                                                ) : (

                                                    <span className="text-xs text-slate-400">
                                                        N/A
                                                    </span>

                                                )}
                                            </td>


                                            {/* BUSINESS UNIT */}

                                            <td className="px-2 py-3 text-xs text-slate-600 truncate">
                                                {item.businessUnit}
                                            </td>

                                            {/* START TIME */}

                                            <td className="px-2 py-3 text-xs text-slate-600 truncate">
                                                {item.date}
                                            </td>

                                            {/* DURATION */}

                                            <td className="px-2 py-3 text-xs text-slate-600 truncate">
                                                {item.duration}
                                            </td>

                                        </tr>

                                    ))

                                ) : (

                                    <tr>

                                        <td
                                            colSpan={6}
                                            className="px-4 py-8 text-center text-sm text-slate-500"
                                        >
                                            No records found. Try different search filters.
                                        </td>

                                    </tr>

                                )}

                            </tbody>

                        </table>

                    </div>
                    {/* =====================================
                        PAGINATION FOOTER
                    ===================================== */}

                    <div className="px-3 py-3 border-t border-slate-200 mt-auto shrink-0">

                        {/* CLEAR FILTERS */}

                        <div className="flex justify-end mb-3">

                            <button
                                type="button"
                                onClick={handleClearFilters}
                                disabled={!hasActiveFilters}
                                className="px-3 py-1.5 rounded-md border border-indigo-300 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Clear All Filters
                            </button>

                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">

                            {/* RECORD COUNT */}

                            <p className="text-xs text-slate-500">

                                {searchedData.length === 0
                                    ? "0–0 of 0"
                                    : `${startIndex + 1}–${Math.min(
                                        startIndex + pageSize,
                                        searchedData.length
                                    )} of ${searchedData.length}`}

                            </p>

                            {/* NUMBERED PAGINATION */}

                            <div className="flex items-center gap-1 flex-wrap">

                                {/* PREVIOUS */}

                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() =>
                                        setCurrentPage(p => p - 1)
                                    }
                                    className="px-2 py-1.5 rounded border border-slate-300 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                                >
                                    Previous
                                </button>

                                {/* PAGE NUMBERS */}

                                {Array.from(
                                    { length: totalPages },
                                    (_, index) => index + 1
                                ).map(page => (

                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() =>
                                            setCurrentPage(page)
                                        }
                                        className={`w-7 h-7 rounded text-xs font-semibold ${currentPage === page
                                            ? "bg-indigo-600 text-white"
                                            : "border border-slate-300 text-slate-700 hover:bg-indigo-50"
                                            }`}
                                    >
                                        {page}
                                    </button>

                                ))}

                                {/* NEXT */}

                                <button
                                    type="button"
                                    disabled={
                                        currentPage >= totalPages ||
                                        totalPages === 0
                                    }
                                    onClick={() =>
                                        setCurrentPage(p => p + 1)
                                    }
                                    className="px-2 py-1.5 rounded border border-slate-300 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                                >
                                    Next
                                </button>

                            </div>

                        </div>

                    </div>

                </section>

                {/* =====================================
                    RIGHT SIDE DRAWER
                ===================================== */}

                {(selectedDag || selectedTask) && (

                    <div className="h-[550px] min-w-0 w-full self-start sticky top-4">

                        {/* TASK DRAWER */}

                        {selectedTask ? (

                            <TaskDrawer
                                dag={selectedTask.dag}
                                task={selectedTask.task}
                                taskDetails={selectedTask.taskDetails}
                                onClose={handleCloseTaskDrawer}
                                activeTab={
                                    activeDrawerTab === "overview"
                                        ? "overview"
                                        : activeDrawerTab === "dependency" ? "dependency" : "history"
                                }
                                setActiveTab={setActiveDrawerTab}
                            />

                        ) : selectedDag ? (

                            /* DAG DRAWER */

                            <DagDrawer
                                dag={selectedDag}
                                onClose={onCloseDrawer}
                                onOpenHistoricalTasks={(run) => {
                                    setSelectedHistoricalRun(run);
                                }}
                                activeTab={activeDrawerTab}
                                setActiveTab={setActiveDrawerTab}
                                onOpenTaskPopup={handleOpenTaskPopup}
                            />

                        ) : null}

                    </div>

                )}

                {/* =====================================
    TASK DRAWER POPUP
    OPENED FROM DAG TASK LIST
===================================== */}

                {popupTask && (

                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">

                        {/* POPUP CONTAINER */}

                        <div className="relative w-full max-w-4xl h-[85vh] max-h-[690px]">

                            <TaskDrawer
                                dag={popupTask.dag}
                                task={popupTask.task}
                                taskDetails={popupTask.taskDetails}
                                onClose={() => setPopupTask(null)}
                                activeTab={popupTaskTab}
                                setActiveTab={(tab) => {
                                    setPopupTaskTab(tab);
                                }}
                            />

                        </div>

                    </div>

                )}

            </div>

        </div>

    );

}