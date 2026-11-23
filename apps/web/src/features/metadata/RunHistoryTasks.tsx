
import type { DagRun } from "./types";
import { runTaskData } from "./data";

interface RunHistoryTasksProps {
  run: DagRun;
  onBack: () => void;
}

export default function RunHistoryTasks({
  run,
  onBack
}: RunHistoryTasksProps) {

  const tasks = runTaskData[run.runId] || [];

  const statusColor = (status: string) => {
    if (status === "Success") return "bg-green-100 text-green-700";
    if (status === "Failed") return "bg-red-100 text-red-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">

      {/* HEADER */}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">

        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Historical Run Tasks
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            {run.name} | Run ID: {run.runId}
          </p>
        </div>

        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50"
        >
          ← Back to Run History
        </button>

      </div>

      {/* RUN DETAILS */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

        {[
          ["DAG Name", run.name],
          ["Run ID", run.runId],
          ["Status", run.status],
          ["Duration", run.duration]
        ].map(([label, value]) => (

          <div
            key={label}
            className="p-3 bg-slate-50 border border-slate-100 rounded-lg"
          >
            <p className="text-xs text-slate-500 mb-1">
              {label}
            </p>

            <p className="text-sm font-bold text-slate-800 break-words">
              {value}
            </p>
          </div>

        ))}

      </div>

      {/* TASK TABLE */}

      <div className="border border-slate-200 rounded-lg overflow-x-auto">

        <table className="w-full min-w-[700px] text-left">

          <thead className="bg-slate-50">
            <tr>
              {[
                "Task Name",
                "Status",
                "Start Time",
                "End Time",
                "Duration"
              ].map(heading => (
                <th
                  key={heading}
                  className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">

            {tasks.length > 0 ? tasks.map(task => (

              <tr key={task.id} className="hover:bg-slate-50">

                <td className="px-4 py-3 text-sm font-medium">
                  {task.name}
                </td>

                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor(task.status)}`}>
                    {task.status}
                  </span>
                </td>

                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {task.startTime}
                </td>

                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {task.endTime}
                </td>

                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {task.duration}
                </td>

              </tr>

            )) : (

              <tr>
                <td
                  colSpan={7}
                  className="text-center py-10 text-sm text-slate-500"
                >
                  No tasks available for this run.
                </td>
              </tr>

            )}

          </tbody>

        </table>

      </div>

      <p className="text-xs text-slate-500 mt-3">
        Total Tasks: {tasks.length}
      </p>

    </div>
  );
}
