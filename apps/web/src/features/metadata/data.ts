
import type { Dag, Task } from "./types";
import type { DagRun, RunTask, TaskRunHistory, TaskDetails, DagDependencies } from "./types";

export const dummyData: Dag[] = [
  { id: 1, status: "Success", name: "DAG_1", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-01 12:34", duration: "45m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN001", applicationId: "1", endTime: "2026-10-01 13:19" },
  { id: 2, status: "Failed", name: "DAG_2", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-03 09:45", duration: "47m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN002", applicationId: "2", endTime: "2026-10-03 10:32" },
  { id: 15, status: "In Progress", name: "DAG_15", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-15 14:34", duration: "-", owner: "TEST", startedBy: "Tst1233", runId: "RUN015", applicationId: "3", endTime: "-" },
  { id: 16, status: "Paused", name: "DAG_16", dagTaskName: "", dagTaskStatus: "", businessUnit: "LAB", date: "-", duration: "-", owner: "Test2", startedBy: "DTst1233", runId: "RUN016", applicationId: "12342225", endTime: "-" },
  { id: 17, status: "Inactive", name: "DAG_17", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "-", duration: "-", owner: "TEST", startedBy: "Tst1233", runId: "RUN017", applicationId: "21211", endTime: "-" },
  { id: 18, status: "Paused", name: "DAG_18", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN018", applicationId: "123432325", endTime: "-" },
  { id: 3, status: "Success", name: "DAG_3", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-05 08:15", duration: "55m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN003", applicationId: "1234221", endTime: "2026-10-05 09:10" },
  { id: 4, status: "Failed", name: "DAG_4", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-07 07:56", duration: "35m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN004", applicationId: "1343432345", endTime: "2026-10-07 08:31" },
  { id: 5, status: "Success", name: "DAG_5", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-09 20:30", duration: "55m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN005", applicationId: "121213345", endTime: "2026-10-09 21:25" },
  { id: 6, status: "Failed", name: "DAG_6", dagTaskName: "", dagTaskStatus: "", businessUnit: "LAB", date: "2026-10-11 15:20", duration: "25m 12s", owner: "Test2", startedBy: "DTst1233", runId: "RUN006", applicationId: "33432", endTime: "2026-10-11 15:45" },
  { id: 7, status: "Success", name: "DAG_7", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-12 13:40", duration: "25m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN007", applicationId: "321212345", endTime: "2026-10-12 14:05" },
  { id: 8, status: "Failed", name: "DAG_8", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-14 15:43", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN008", applicationId: "2", endTime: "2026-10-14 16:28" },
  { id: 9, status: "Success", name: "DAG_9", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-16 18:40", duration: "54m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN009", applicationId: "122345", endTime: "2026-10-16 19:34" },
  { id: 10, status: "Failed", name: "DAG_10", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-18 17:10", duration: "15m 12s", owner: "TEST", startedBy: "JTst1233h", runId: "RUN010", applicationId: "12345", endTime: "2026-10-18 17:25" },
  { id: 11, status: "Success", name: "DAG_11", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-19 03:03", duration: "65m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN011", applicationId: "12345", endTime: "2026-10-19 04:08" },
  { id: 12, status: "Success", name: "DAG_12", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-20 08:20", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN012", applicationId: "12345", endTime: "2026-10-20 09:05" },
  { id: 13, status: "Success", name: "DAG_13", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-04 13:58", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN013", applicationId: "12345", endTime: "2026-10-04 14:43" },
  { id: 14, status: "Failed", name: "DAG_14", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-08 12:00", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN014", applicationId: "12345", endTime: "2026-10-08 12:45" },
  { id: 19, status: "Inactive", name: "DAG_19", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN019", applicationId: "12345", endTime: "-" },
  { id: 20, status: "Failed", name: "DAG_20", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-18 17:10", duration: "15m 12s", owner: "TEST", startedBy: "JTst1233h", runId: "RUN010", applicationId: "12345", endTime: "2026-10-18 17:25" },
  { id: 21, status: "Success", name: "DAG_21", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-19 03:03", duration: "65m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN011", applicationId: "12345", endTime: "2026-10-19 04:08" },
  { id: 22, status: "Success", name: "DAG_22", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-20 08:20", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN012", applicationId: "12345", endTime: "2026-10-20 09:05" },
  { id: 23, status: "Success", name: "DAG_23", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "2026-10-04 13:58", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN013", applicationId: "12345", endTime: "2026-10-04 14:43" },
  { id: 24, status: "Failed", name: "DAG_24", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-08 12:00", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN014", applicationId: "12345", endTime: "2026-10-08 12:45" },
  { id: 25, status: "Inactive", name: "DAG_25", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN019", applicationId: "12345", endTime: "-" },
  { id: 26, status: "Failed", name: "DAG1_12", dagTaskName: "", dagTaskStatus: "", businessUnit: "FFIO", date: "2026-10-08 12:00", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN014", applicationId: "12345", endTime: "2026-10-08 12:45" },
  { id: 27, status: "Inactive", name: "DAG1_131", dagTaskName: "", dagTaskStatus: "", businessUnit: "AMT", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN019", applicationId: "12345", endTime: "-" }
];

export const dummyDagTaskData: Dag[] = [
  { id: 1, status: "Success", name: "DAG_1", dagTaskName: "Task1", dagTaskStatus: "Success", businessUnit: "FFIO", date: "2026-10-01 12:34", duration: "45m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN001", applicationId: "1", endTime: "2026-10-01 13:19" },
  { id: 2, status: "Failed", name: "DAG_2", dagTaskName: "Task1", dagTaskStatus: "Failed", businessUnit: "AMT", date: "2026-10-03 09:45", duration: "47m 12s", owner: "Test", startedBy: "Tst1233", runId: "RUN002", applicationId: "2", endTime: "2026-10-03 10:32" },
  { id: 15, status: "In Progress", name: "DAG_15", dagTaskName: "Task1", dagTaskStatus: "Success", businessUnit: "AMT", date: "2026-10-15 14:34", duration: "-", owner: "TEST", startedBy: "Tst1233", runId: "RUN015", applicationId: "3", endTime: "-" },
  { id: 16, status: "Paused", name: "DAG_16", dagTaskName: "Task3", dagTaskStatus: "Failed", businessUnit: "LAB", date: "-", duration: "-", owner: "Test2", startedBy: "DTst1233", runId: "RUN016", applicationId: "4", endTime: "-" },
  { id: 17, status: "Inactive", name: "DAG_17", dagTaskName: "Task1", dagTaskStatus: "Success", businessUnit: "FFIO", date: "-", duration: "-", owner: "TEST", startedBy: "Tst1233", runId: "RUN017", applicationId: "5", endTime: "-" },
  { id: 18, status: "Paused", name: "DAG_18", dagTaskName: "Task1", dagTaskStatus: "Up For Retry", businessUnit: "FFIO", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN018", applicationId: "12345", endTime: "-" },
  { id: 3, status: "Success", name: "DAG_3", dagTaskName: "", dagTaskStatus: "Upstream Failed", businessUnit: "FFIO", date: "2026-10-05 08:15", duration: "55m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN003", applicationId: "12345", endTime: "2026-10-05 09:10" },
  { id: 4, status: "Failed", name: "DAG_4", dagTaskName: "Task1", dagTaskStatus: "Upstream Failed", businessUnit: "FFIO", date: "2026-10-07 07:56", duration: "35m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN004", applicationId: "12345", endTime: "2026-10-07 08:31" },
  { id: 5, status: "Success", name: "DAG_5", dagTaskName: "Task5", dagTaskStatus: "Success", businessUnit: "FFIO", date: "2026-10-09 20:30", duration: "55m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN005", applicationId: "12345", endTime: "2026-10-09 21:25" },
  { id: 6, status: "Failed", name: "DAG_6", dagTaskName: "Task2", dagTaskStatus: "Up For Retry", businessUnit: "LAB", date: "2026-10-11 15:20", duration: "25m 12s", owner: "Test2", startedBy: "DTst1233", runId: "RUN006", applicationId: "12345", endTime: "2026-10-11 15:45" },
  { id: 7, status: "Success", name: "DAG_7", dagTaskName: "Task1", dagTaskStatus: "Success", businessUnit: "FFIO", date: "2026-10-12 13:40", duration: "25m 12s", owner: "TEST", startedBy: "Tst1233", runId: "RUN007", applicationId: "12345", endTime: "2026-10-12 14:05" },
  { id: 8, status: "Failed", name: "DAG_8", dagTaskName: "Task6", dagTaskStatus: "Upstream Failed", businessUnit: "FFIO", date: "2026-10-14 15:43", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN008", applicationId: "12345", endTime: "2026-10-14 16:28" },
  { id: 9, status: "Success", name: "DAG_9", dagTaskName: "Task7", dagTaskStatus: "Success", businessUnit: "AMT", date: "2026-10-16 18:40", duration: "54m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN009", applicationId: "12345", endTime: "2026-10-16 19:34" },
  { id: 10, status: "Failed", name: "DAG_10", dagTaskName: "Task8", dagTaskStatus: "Skipped", businessUnit: "FFIO", date: "2026-10-18 17:10", duration: "15m 12s", owner: "TEST", startedBy: "JTst1233h", runId: "RUN010", applicationId: "12345", endTime: "2026-10-18 17:25" },
  { id: 11, status: "Success", name: "DAG_11", dagTaskName: "Task8", dagTaskStatus: "Success", businessUnit: "AMT", date: "2026-10-19 03:03", duration: "65m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN011", applicationId: "12345", endTime: "2026-10-19 04:08" },
  { id: 12, status: "Success", name: "DAG_12", dagTaskName: "Task10", dagTaskStatus: "Success", businessUnit: "FFIO", date: "2026-10-20 08:20", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN012", applicationId: "12345", endTime: "2026-10-20 09:05" },
  { id: 13, status: "Success", name: "DAG_13", dagTaskName: "Task11", dagTaskStatus: "Success", businessUnit: "AMT", date: "2026-10-04 13:58", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN013", applicationId: "12345", endTime: "2026-10-04 14:43" },
  { id: 14, status: "Failed", name: "DAG_14", dagTaskName: "Task12", dagTaskStatus: "Skipped", businessUnit: "FFIO", date: "2026-10-08 12:00", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN014", applicationId: "12345", endTime: "2026-10-08 12:45" },
  { id: 19, status: "Inactive", name: "DAG_19", dagTaskName: "Task13", dagTaskStatus: "Success", businessUnit: "AMT", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN019", applicationId: "12345", endTime: "-" },
  { id: 20, status: "Failed", name: "DAG_20", dagTaskName: "Task8", dagTaskStatus: "Running", businessUnit: "FFIO", date: "2026-10-18 17:10", duration: "15m 12s", owner: "TEST", startedBy: "JTst1233h", runId: "RUN010", applicationId: "12345", endTime: "2026-10-18 17:25" },
  { id: 21, status: "Success", name: "DAG_21", dagTaskName: "Task9", dagTaskStatus: "Success", businessUnit: "AMT", date: "2026-10-19 03:03", duration: "65m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN011", applicationId: "12345", endTime: "2026-10-19 04:08" },
  { id: 22, status: "Success", name: "DAG_22", dagTaskName: "Task10", dagTaskStatus: "Running", businessUnit: "FFIO", date: "2026-10-20 08:20", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN012", applicationId: "12345", endTime: "2026-10-20 09:05" },
  { id: 23, status: "Success", name: "DAG_23", dagTaskName: "Task11", dagTaskStatus: "Skipped", businessUnit: "AMT", date: "2026-10-04 13:58", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN013", applicationId: "12345", endTime: "2026-10-04 14:43" },
  { id: 24, status: "Failed", name: "DAG_24", dagTaskName: "Task12", dagTaskStatus: "Running", businessUnit: "FFIO", date: "2026-10-08 12:00", duration: "45m 12s", owner: "Test2", startedBy: "Tst1233", runId: "RUN014", applicationId: "12345", endTime: "2026-10-08 12:45" },
  { id: 25, status: "Inactive", name: "DAG_25", dagTaskName: "Task13", dagTaskStatus: "Running", businessUnit: "AMT", date: "-", duration: "-", owner: "Test2", startedBy: "Tst1233", runId: "RUN019", applicationId: "12345", endTime: "-" }

];


export const taskData: Record<number, Task[]> =
  Object.fromEntries(
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

        const matchingDagTask = dummyDagTaskData.find(
          (item) => item.id === dag.id
        );

        return {
          id: index + 1,
          name: `${dag.name}_Task_${index + 1}`,
          hierarchyLevel: "2",
          status: taskStatus,
          owner: index % 2 === 0
            ? "Data Team"
            : "ETL Team",
          startTime: `12:${String(index + 1).padStart(2, "0")}`,
          endTime:
            taskStatus === "In Progress"
              ? "-"
              : `17:${String(index + 2).padStart(2, "0")}`,
          duration:
            taskStatus === "In Progress"
              ? "-"
              : `${5 + index}m ${index + 10}s`,
          dagTaskStatus: matchingDagTask?.dagTaskStatus ?? ""
        };
      })
    ])
  );


export const matchesWildcard = (
  value: string,
  search: string
): boolean => {

  if (!search.trim()) return true;

  const escaped = search
    .trim()
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`).test(
    value.toLowerCase()
  );
};


export const runHistoryData: Record<number, DagRun[]> = {

  1: [
    {
      id: 101,
      dagId: 1,
      runId: "RUN001",
      status: "Success",
      name: "DAG1",
      class: "Unit A",
      date: "2026-10-01 12:34",
      duration: "45m 12s",
      owner: "TEST",
      startedBy: "Tst1233",
      endTime: "2026-10-01 13:19"
    },
    {
      id: 102,
      dagId: 1,
      runId: "RUN020",
      status: "Failed",
      name: "DAG1",
      class: "Unit A",
      date: "2026-09-30 10:20",
      duration: "25m 10s",
      owner: "TEST",
      startedBy: "Tst1233",
      endTime: "2026-09-30 10:45"
    },
    {
      id: 103,
      dagId: 1,
      runId: "RUN021",
      status: "Success",
      name: "DAG1",
      class: "Unit A",
      date: "2026-09-29 08:30",
      duration: "40m 15s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-09-29 09:10"
    }
  ],

  2: [
    {
      id: 201,
      dagId: 2,
      runId: "RUN002",
      status: "Failed",
      name: "DAG2",
      class: "Unit B",
      date: "2026-10-03 09:45",
      duration: "47m 12s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-10-03 10:32"
    },
    {
      id: 202,
      dagId: 2,
      runId: "RUN022",
      status: "Success",
      name: "DAG2",
      class: "Unit B",
      date: "2026-10-02 08:30",
      duration: "35m 20s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-10-02 09:05"
    }
  ]

};

export const runTaskHistoryData: Record<number, TaskRunHistory[]> = {

  1: [
    {
      id: 101,
      dagId: 1,
      runId: "RUN001",
      status: "Success",
      name: "DAG1",
      class: "Unit A",
      date: "2026-10-01 12:34",
      duration: "45m 12s",
      owner: "TEST",
      startedBy: "Tst1233",
      endTime: "2026-10-01 13:19",
      taskId: "1"
    },
    {
      id: 102,
      dagId: 1,
      runId: "RUN020",
      status: "Failed",
      name: "DAG1",
      class: "Unit A",
      date: "2026-09-30 10:20",
      duration: "25m 10s",
      owner: "TEST",
      startedBy: "Tst1233",
      endTime: "2026-09-30 10:45",
      taskId: "2"
    },
    {
      id: 103,
      dagId: 1,
      runId: "RUN021",
      status: "Success",
      name: "DAG1",
      class: "Unit A",
      date: "2026-09-29 08:30",
      duration: "40m 15s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-09-29 09:10",
      taskId: "3"
    }
  ],

  2: [
    {
      id: 201,
      dagId: 2,
      runId: "RUN002",
      status: "Failed",
      name: "DAG2",
      class: "Unit B",
      date: "2026-10-03 09:45",
      duration: "47m 12s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-10-03 10:32",
      taskId: "5"
    },
    {
      id: 202,
      dagId: 2,
      runId: "RUN022",
      status: "Success",
      name: "DAG2",
      class: "Unit B",
      date: "2026-10-02 08:30",
      duration: "35m 20s",
      owner: "David Lee",
      startedBy: "Tst1233",
      endTime: "2026-10-02 09:05",
      taskId: "6"
    }
  ]

};
// ==========================================
// HISTORICAL RUN TASK DATA
// ==========================================

export const runTaskData: Record<string, RunTask[]> = {

  RUN001: [],
  RUN020: [],
  RUN021: [],
  RUN002: [],
  RUN022: []

};

// Generate sample tasks for each historical run

Object.keys(runTaskData).forEach((runId) => {

  runTaskData[runId] = Array.from(
    { length: 15 },
    (_, index): RunTask => {

      const failed =
        runId === "RUN020" && index === 4;

      return {
        id: index + 1,
        runId,
        name: `${runId}_Task_${index + 1}`,
        hierarchyLevel: "2",
        status: failed ? "Failed" : "Success",
        owner: index % 2 === 0
          ? "Data Team"
          : "ETL Team",
        startTime: `12:${String(index + 1).padStart(2, "0")}`,
        endTime: `17:${String(index + 2).padStart(2, "0")}`,
        duration: `${5 + index}m ${index + 10}s`,
        dagTaskStatus: failed ? "Failed" : "Success"
      };

    }
  );

});


// ==========================================
// TASK DETAILS DUMMY DATA
// ==========================================


export const taskDetailsData: Record<string, TaskDetails> = {

  "DAG_1_Task_1": {
    task_id: "DAG_1_Task_1",
    command: "python /opt/airflow/scripts/customer_etl.py",
    profile: "PROD_CUSTOMER_PROFILE",
    hostname: "airflow-worker-01",
    task_type: "Python Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },

  "DAG_1_Task_2": {
    task_id: "DAG_1_Task_2",
    command: "spark-submit /opt/spark/scripts/sales_etl.py",
    profile: "PROD_SALES_PROFILE",
    hostname: "spark-worker-02",
    task_type: "Spark Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },

  "DAG_1_Task_3": {
    task_id: "DAG_1_Task_3",
    command: "bash /opt/airflow/scripts/inventory.sh",
    profile: "INVENTORY_PROFILE",
    hostname: "airflow-worker-03",
    task_type: "Bash Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },

  "DAG_1_Task_4": {
    task_id: "DAG_1_Task_4",
    command: "python /opt/airflow/scripts/payment_validation.py",
    profile: "PAYMENT_PROFILE",
    hostname: "airflow-worker-04",
    task_type: "Python Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },

  "DAG_1_Task_5": {
    task_id: "DAG_1_Task_5",
    command: "sqlplus / as sysdba @daily_report.sql",
    profile: "ORACLE_PROD_PROFILE",
    hostname: "oracle-server-01",
    task_type: "SQL Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },
  "DAG_5_Task_1": {
    task_id: "DAG_5_Task_1",
    command: "sqlplus / as sysdba @daily_report.sql",
    profile: "ORACLE_PROD_PROFILE",
    hostname: "oracle-server-01",
    task_type: "SQL Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },
  "DAG_6_Task_1": {
    task_id: "DAG_6_Task_1",
    command: "sqlplus / as sysdba @daily_report.sql",
    profile: "ORACLE_PROD_PROFILE",
    hostname: "oracle-server-01",
    task_type: "SQL Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  },
  "DAG_4_Task_1": {
    task_id: "DAG_4_Task_1",
    command: "sqlplus / as sysdba @daily_report.sql",
    profile: "ORACLE_PROD_PROFILE",
    hostname: "oracle-server-01",
    task_type: "SQL Operator",
    owner: "fpprpddu",
    description: "Meaningful description",
    category: "ETL / File Watcher etc..",
    runTime: "200",
    citicalPath: "Y",
    slo: "23:01",
    severity: "4M",
    supportGroup: "ffio_prdsvcs_perform"
  }


};


export const dagDependencyData: Record<string, DagDependencies> = {

  "1": {
    upstream: [
      { source: "AM", dag_id: null, task_ids: ["Task1issprf_pce_rimes_index_stg_ld", "Taskissprf_pce_rimes_index_stg_ld2", "issprf_pce_rimes_index_stg_ldTask3", "Tasissprf_pce_rimes_index_stg_ldk1", "Tasissprf_pce_rimes_index_stg_ldk3", "Tissprf_pce_rimes_index_stg_ldask2", "Tasissprf_pce_rimes_index_stg_ldk1", "issprf_pce_rimes_index_stg_ld", "issprf_pce_rimes_index_stg_ld", "Taissprf_pce_rimes_index_stg_ldsk1", "Taissprf_pce_rimes_index_stg_ldsk3", "Taskissprf_pce_rimes_index_stg_ld2", "Taskissprf_pce_rimes_index_stg_ld1", "Tissprf_pce_rimes_index_stg_ldask3", "Taissprf_pce_rimes_index_stg_ldsk2", "issprf_pce_rimes_index_stg_ldTask1", "Task3issprf_pce_rimes_index_stg_ld", "Taskissprf_pce_rimes_index_stg_ld2", "Tasissprf_pce_rimes_index_stg_ldk1", "Taissprf_pce_rimes_index_stg_ldsk3", "Taissprf_pce_rimes_index_stg_ldsk2"] },
      { source: "ETL", dag_id: "parent_dag_1", task_ids: ["Task5", "Task6"] },
      { source: "AM", dag_id: "parent_dag_1", task_ids: ["Task1", "Task3", "Task2", "Task1", "Task3", "Task2", "Task1", "Task3", "Task2"] }
    ],
    downstream: [
      { source: "AM", dag_id: "child_dag_2", task_ids: ["Task7", "Task8", "Task9"] },
      { source: "ETL", dag_id: "child_dag_3", task_ids: ["Task10", "Task11"] }
    ]
  },

  "2": {
    upstream: [
      { source: "AM", dag_id: "parent_dag_1", task_ids: ["Task1", "Task3", "Task2"] },
      { source: "ETL", dag_id: "parent_dag_2", task_ids: ["Task1", "Task3"] }
    ],
    downstream: [
      { source: "AM", dag_id: "child_dag_4", task_ids: ["Task7", "Task9"] },
      { source: "ETL", dag_id: "child_dag_5", task_ids: ["Task7", "Task8", "Task9"] }
    ]
  },

  "3": {
    upstream: [
      { source: "AM", dag_id: "source_dag_1", task_ids: ["Task3", "Task2"] },
      { source: "DB", dag_id: "source_dag_2", task_ids: ["Task7", "Task8"] }
    ],
    downstream: [
      { source: "AM", dag_id: "child_dag_6", task_ids: ["Task10", "Task7"] },
      { source: "DB", dag_id: "child_dag_7", task_ids: ["Task7", "Task8"] }
    ]
  },

  "4": {
    upstream: [
      { source: "ETL", dag_id: "parent_dag_3", task_ids: ["Task1", "Task3", "Task7"] },
      { source: "AM", dag_id: null, task_ids: ["Task7", "Task6"] }
    ],
    downstream: [
      { source: "ETL", dag_id: "child_dag_8", task_ids: ["Task7", "Task2", "Task9"] },
      { source: "AM", dag_id: "child_dag_9", task_ids: ["Task7"] }
    ]
  },

  "5": {
    upstream: [
      { source: "DB", dag_id: "source_dag_3", task_ids: ["Task7", "Task9"] },
      { source: "AM", dag_id: "source_dag_4", task_ids: ["Task1", "Task7"] }
    ],
    downstream: [
      { source: "DB", dag_id: "child_dag_10", task_ids: ["Task7", "Task1", "Task3"] },
      { source: "AM", dag_id: "child_dag_11", task_ids: ["Task8", "Task9"] }
    ]
  },

  "6": {
    upstream: [
      { source: "AM", dag_id: "parent_dag_4", task_ids: ["Task3", "Task10", "Task2"] },
    ],
    downstream: [
      { source: "AM", dag_id: "child_dag_12", task_ids: ["Task8", "Task11"] },
      { source: "API", dag_id: "api_child_1", task_ids: ["Task7", "Task8"] }
    ]
  }


};
