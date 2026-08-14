CREATE TABLE department_schedule_requests (
  id text PRIMARY KEY NOT NULL,
  department_id text NOT NULL,
  request_kind text NOT NULL,
  requester_employee_id text NOT NULL,
  requester_name text NOT NULL,
  assignment_id text NOT NULL DEFAULT '',
  target_scope text NOT NULL DEFAULT 'employee',
  target_employee_id text NOT NULL DEFAULT '',
  target_name text NOT NULL DEFAULT '',
  start_date text NOT NULL,
  end_date text NOT NULL,
  hours integer NOT NULL DEFAULT 0,
  leave_type text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL,
  accepted_by text,
  reviewed_by text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_department_schedule_requests_status ON department_schedule_requests (department_id, request_kind, status, created_at);
--> statement-breakpoint
CREATE INDEX idx_department_schedule_requests_target ON department_schedule_requests (department_id, target_employee_id, status);
