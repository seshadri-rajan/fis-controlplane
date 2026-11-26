
export type DagStatus =
  | "Success"
  | "Failed"
  | "In Progress"
  | "Paused"
  | "Inactive";

export interface Dag {
  id: number;
  status: DagStatus;
  name: string;
  dagTaskName:string;
  dagTaskStatus:string;
  businessUnit: string;
  date: string;
  duration: string;
  owner: string;
  startedBy: string;
  runId: string;
  applicationId:string;
  endTime: string;
  criticality: string;
}

export interface Task {
  id: number;
  name: string;
  hierarchyLevel:String
  status: string;
  owner: string;
  startTime: string;
  endTime: string;
  duration: string;
  dagTaskStatus: string;
}

// Historical execution of a DAG
export interface DagRun {
  id: number;
  dagId: number;
  runId: string;
  status: DagStatus;
  name: string;
  class: string;
  date: string;
  duration: string;
  owner: string;
  startedBy: string;
  endTime: string;
}

// Historical execution of a DAG
export interface TaskRunHistory {
  id: number;
  dagId: number;
  runId: string;
  status: DagStatus;
  name: string;
  class: string;
  date: string;
  duration: string;
  owner: string;
  startedBy: string;
  endTime: string;
  taskId:string;
}

export interface TaskDetails {
  task_id: string;
  command: string;
  profile: string;
  hostname: string;
  task_type: string;
  owner:string;
  description:string;
  category:string;
  runTime:string;
  citicalPath:string;
  slo:string;
  severity:string;
  supportGroup:string;
}

// Tasks belonging to an individual DAG run
export interface RunTask extends Task {
  runId: string;
}

export interface SearchFilters {
  dagName: string;
  unitName: string;
  taskName: string;
  applicationId:string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface DagDependency {
    source: string;
    dag_id: string | null;
    task_ids: string[];
}

export interface DagDependencies {
    upstream: DagDependency[];
    downstream: DagDependency[];
}

export interface Dag1 {
  source: string;
  dag_id: string;
  business_unit: string;
  task_id: string;
  task_status: string;
  metadata: {
    slo: string;
    category: string;
    severity: string;
    critical_path: string;
    support_group: string;
    application_id: string;
    bundel_name: string;
  };

  latest_run: {
    run_id: string;
    state: string;
    logical_date: string;
    start_date: string;
    end_date: string;
    elapsed_time: string;
    business_date: string;
    next_run: string;
  };
}

export interface MetadataResponse {
  items: Dag[];
  total_count: {
    total_records: number;
    failed: number;
    in_progress: number;
    paused: number;
    inactive: number;
  };
}


