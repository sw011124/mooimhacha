import { io, Socket } from "socket.io-client";
import { API_BASE, getAccessToken } from "./api";

// 회의 룸 WebSocket(socket.io) 래퍼. 서버 RealtimeGateway 와 짝.
// 이벤트 명세: docs/04-API-명세.md §WebSocket 이벤트

export interface ContributionScoreLive {
  user_id: number;
  char_count: number;
  ratio: number;
}

export function connectMeetingSocket(): Socket {
  const socket = io(API_BASE, {
    transports: ["websocket"],
    auth: { token: getAccessToken() ?? "" },
    autoConnect: true,
  });
  return socket;
}

// 회의 룸 입장 — 서버가 meeting:t0 로 응답
export function joinMeeting(socket: Socket, meetingId: number) {
  socket.emit("meeting:join", { meeting_id: meetingId });
}

export function leaveMeeting(socket: Socket, meetingId: number) {
  socket.emit("meeting:leave", { meeting_id: meetingId });
}

// 확정 발화 전송 (텍스트만)
export function sendUtterance(
  socket: Socket,
  payload: {
    meeting_id: number;
    text: string;
    char_count: number;
    started_at_offset_ms: number;
    ended_at_offset_ms: number;
    confidence?: number | null;
  },
) {
  socket.emit("utterance:new", payload);
}

export function changeAgendaStatus(
  socket: Socket,
  payload: {
    meeting_id: number;
    agenda_id: number;
    status?: "pending" | "active" | "done";
    activate?: boolean;
  },
) {
  socket.emit("agenda:status-change", payload);
}

export function addDecision(
  socket: Socket,
  payload: { meeting_id: number; content: string; agenda_id?: number },
) {
  socket.emit("decision:new", payload);
}

export function addAction(
  socket: Socket,
  payload: {
    meeting_id: number;
    team_id: number;
    description: string;
    assignee_id?: number;
    due_date?: string;
    difficulty?: number;
    agenda_id?: number;
  },
) {
  socket.emit("action:new", payload);
}

export function speakingStart(socket: Socket, meetingId: number) {
  socket.emit("user:speaking-start", { meeting_id: meetingId });
}
export function speakingEnd(socket: Socket, meetingId: number) {
  socket.emit("user:speaking-end", { meeting_id: meetingId });
}
