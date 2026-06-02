// 프론트엔드 공용 도메인 타입 (서버 엔티티와 대응)

export type AgendaStatus = "pending" | "active" | "done";
export type MeetingStatus = "scheduled" | "active" | "ended";

export interface Team {
  id: number;
  name: string;
  course_name: string | null;
  role?: "leader" | "member";
}

export interface TeamMember {
  user_id: number;
  name: string;
  profile_image_url: string | null;
  role: "leader" | "member";
}

export interface Meeting {
  id: number;
  team_id: number;
  scheduled_at: string;
  total_minutes: number;
  topic: string | null;
  status: MeetingStatus;
  t0_timestamp: string | null;
  ended_at: string | null;
  meeting_type: string;
}

export interface Agenda {
  id: number;
  meeting_id: number;
  title: string;
  estimated_minutes: number;
  order_index: number;
  status: AgendaStatus;
  started_at_offset_ms: number | null;
  ended_at_offset_ms: number | null;
  actual_minutes: number | null;
  source: string;
  summary: string | null;
}

export interface Decision {
  id: number;
  meeting_id: number;
  content: string;
  agenda_id: number | null;
  created_by: number;
}

export interface ActionItem {
  id: number;
  team_id: number;
  assignee_id: number | null;
  description: string;
  due_date: string | null;
  difficulty: number;
  status: string;
}

export interface MeetingContribution {
  user_id: number;
  name: string;
  speech_ratio: number | null;
  attendance_ratio: number | null;
  meeting_score: number | null;
  confidence_level: string | null;
}

export interface TeamContribution {
  user_id: number;
  name: string;
  role?: "leader" | "member";
  meeting_aggregate: number | null;
  task_score: number | null;
  composite_score: number | null;
}
