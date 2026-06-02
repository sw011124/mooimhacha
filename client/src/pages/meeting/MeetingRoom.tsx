import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  connectMeetingSocket,
  joinMeeting,
  leaveMeeting,
  sendUtterance,
  changeAgendaStatus,
  addDecision,
  addAction,
  speakingStart,
  speakingEnd,
  type ContributionScoreLive,
} from "@/lib/ws";
import { apiGet, apiPost } from "@/lib/api";
import { createSpeechRecognizer, isSpeechSupported } from "@/lib/speech";
import type { SpeechController } from "@/lib/speech";
import { createCompanionChannel } from "@/lib/companion";
import type {
  Agenda,
  Decision,
  ActionItem,
  Meeting,
  TeamMember,
} from "@/lib/types";
import AgendaTracker from "./AgendaTracker";
import ContributionBar from "./ContributionBar";
import QuickInput from "./QuickInput";

interface Props {
  meetingId: number;
  teamId: number;
}

export default function MeetingRoom({ meetingId, teamId }: Props) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [scores, setScores] = useState<ContributionScoreLive[]>([]);
  const [speaking, setSpeaking] = useState<Set<number>>(new Set());
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [summaries, setSummaries] = useState<Record<number, string>>({});
  const [t0ms, setT0ms] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [micOn, setMicOn] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const recognizerRef = useRef<SpeechController | null>(null);
  const t0Ref = useRef<number | null>(null);
  const speechStartRef = useRef<number>(Date.now());

  // 매초 갱신 (시간 초과 시각화용)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 초기 데이터 로드 + 소켓 연결
  useEffect(() => {
    if (!meetingId) {
      setError("회의 정보가 없습니다.");
      return;
    }
    let mounted = true;

    void (async () => {
      try {
        const [m, ag, team, dec, act] = await Promise.all([
          apiGet<Meeting>(`/meetings/${meetingId}`),
          apiGet<Agenda[]>(`/meetings/${meetingId}/agendas`),
          apiGet<{ members: TeamMember[] }>(`/teams/${teamId}`),
          apiGet<Decision[]>(`/decisions?meeting_id=${meetingId}`),
          apiGet<ActionItem[]>(`/action-items?team_id=${teamId}`),
        ]);
        if (!mounted) return;
        setMeeting(m);
        setAgendas(ag);
        setMembers(team.members);
        setDecisions(dec);
        setActions(act);
        if (m.t0_timestamp) {
          const t = new Date(m.t0_timestamp).getTime();
          setT0ms(t);
          t0Ref.current = t;
        }
      } catch (e) {
        if (mounted) setError((e as Error).message);
      }
    })();

    const socket = connectMeetingSocket();
    socketRef.current = socket;

    socket.on("connect", () => joinMeeting(socket, meetingId));
    socket.on(
      "meeting:t0",
      (p: { t0_timestamp: string | null }) => {
        if (p.t0_timestamp) {
          const t = new Date(p.t0_timestamp).getTime();
          setT0ms(t);
          t0Ref.current = t;
        }
      },
    );
    socket.on("contribution:update", (p: { scores: ContributionScoreLive[] }) =>
      setScores(p.scores),
    );
    socket.on("agenda:status-change", (p: { agenda: Agenda }) =>
      setAgendas((prev) =>
        prev.map((a) => (a.id === p.agenda.id ? p.agenda : a)),
      ),
    );
    socket.on("agenda:summary", (p: { agenda_id: number; summary: string }) =>
      setSummaries((prev) => ({ ...prev, [p.agenda_id]: p.summary })),
    );
    socket.on("decision:new", (p: { decision: Decision }) =>
      setDecisions((prev) => [...prev, p.decision]),
    );
    socket.on("action:new", (p: { action: ActionItem }) =>
      setActions((prev) => [...prev, p.action]),
    );
    socket.on("user:speaking-start", (p: { user_id: number }) =>
      setSpeaking((prev) => new Set(prev).add(p.user_id)),
    );
    socket.on("user:speaking-end", (p: { user_id: number }) =>
      setSpeaking((prev) => {
        const next = new Set(prev);
        next.delete(p.user_id);
        return next;
      }),
    );

    return () => {
      mounted = false;
      leaveMeeting(socket, meetingId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meetingId, teamId]);

  // STT (마이크 on/off)
  const toggleMic = useCallback(() => {
    if (micOn) {
      recognizerRef.current?.stop();
      recognizerRef.current = null;
      setMicOn(false);
      return;
    }
    if (!isSpeechSupported()) {
      setError("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge를 사용하세요.");
      return;
    }
    const rec = createSpeechRecognizer({
      lang: "ko-KR",
      onSpeechStart: () => {
        speechStartRef.current = Date.now();
        const s = socketRef.current;
        if (s) speakingStart(s, meetingId);
      },
      onSpeechEnd: () => {
        const s = socketRef.current;
        if (s) speakingEnd(s, meetingId);
      },
      onFinal: (text, confidence) => {
        const s = socketRef.current;
        if (!s) return;
        const base = t0Ref.current ?? Date.now();
        sendUtterance(s, {
          meeting_id: meetingId,
          text,
          char_count: text.length,
          started_at_offset_ms: Math.max(0, speechStartRef.current - base),
          ended_at_offset_ms: Math.max(0, Date.now() - base),
          confidence,
        });
      },
    });
    if (!rec) return;
    recognizerRef.current = rec;
    rec.start();
    setMicOn(true);
  }, [micOn, meetingId]);

  useEffect(() => {
    return () => recognizerRef.current?.stop();
  }, []);

  const handleActivate = (id: number) => {
    const s = socketRef.current;
    if (s) changeAgendaStatus(s, { meeting_id: meetingId, agenda_id: id, activate: true });
  };
  const handleDone = (id: number) => {
    const s = socketRef.current;
    if (s)
      changeAgendaStatus(s, { meeting_id: meetingId, agenda_id: id, status: "done" });
  };
  const handleAddAgenda = async (title: string) => {
    try {
      const created = await apiPost<Agenda>(`/meetings/${meetingId}/agendas`, {
        title,
        source: "ad_hoc",
      });
      setAgendas((prev) => [...prev, created]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDecision = (content: string) => {
    const s = socketRef.current;
    if (s) addDecision(s, { meeting_id: meetingId, content });
  };
  const handleAction = (payload: {
    description: string;
    assignee_id?: number;
    due_date?: string;
  }) => {
    const s = socketRef.current;
    if (s) addAction(s, { meeting_id: meetingId, team_id: teamId, ...payload });
  };

  const handleEnd = async () => {
    if (!confirm("회의를 종료할까요? 기여도가 산정됩니다.")) return;
    try {
      await apiPost(`/meetings/${meetingId}/end`);
      const ch = createCompanionChannel();
      ch.postMessage({ type: "meeting:ended", meeting_id: meetingId });
      ch.close();
      setEnded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error) {
    return <div className="cmp-error">{error}</div>;
  }
  if (ended) {
    return (
      <div className="cmp-ended">
        <p>회의가 종료되었습니다.</p>
        <button onClick={() => window.close()}>창 닫기</button>
      </div>
    );
  }

  const elapsedMin =
    t0ms !== null ? Math.floor((now - t0ms) / 60000) : 0;
  const recentDecisions = decisions.slice(-3).reverse();
  const recentActions = actions.slice(-3).reverse();

  return (
    <div className="companion">
      <header className="cmp-header">
        <div className="cmp-header__title">
          <strong>{meeting?.topic ?? "회의 진행 중"}</strong>
          <span className="cmp-header__time">
            {elapsedMin}분 / {meeting?.total_minutes ?? 0}분
          </span>
        </div>
        <div className="cmp-header__actions">
          <button
            className={`cmp-mic-btn ${micOn ? "on" : ""}`}
            onClick={toggleMic}
            title="마이크"
          >
            {micOn ? "🎤 켜짐" : "🎙 마이크"}
          </button>
          <button className="cmp-end-btn" onClick={handleEnd}>
            종료
          </button>
        </div>
      </header>

      <AgendaTracker
        agendas={agendas}
        t0ms={t0ms}
        now={now}
        summaries={summaries}
        onActivate={handleActivate}
        onDone={handleDone}
        onAdd={handleAddAgenda}
      />

      <ContributionBar scores={scores} members={members} speaking={speaking} />

      <QuickInput
        members={members}
        onDecision={handleDecision}
        onAction={handleAction}
      />

      <section className="cmp-section cmp-recent">
        <header className="cmp-section__head">
          <h2>최근 항목</h2>
        </header>
        <ul className="cmp-recent-list">
          {recentDecisions.map((d) => (
            <li key={`d${d.id}`}>
              <span className="cmp-tag cmp-tag--decision">결정</span>
              {d.content}
            </li>
          ))}
          {recentActions.map((a) => (
            <li key={`a${a.id}`}>
              <span className="cmp-tag cmp-tag--action">액션</span>
              {a.description}
            </li>
          ))}
          {recentDecisions.length === 0 && recentActions.length === 0 && (
            <li className="cmp-empty">기록된 항목이 없습니다.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
