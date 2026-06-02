import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "@/lib/api";
import { openCompanion, createCompanionChannel } from "@/lib/companion";
import type { Team, Meeting } from "@/lib/types";
import "@/styles/live.css";

// 메인 탭의 실시간 회의 플로우 진입점.
// 팀 선택/생성/합류 → 회의 생성 → 시작(보조 창 열기) → 종료 후 리포트.
export default function MeetingLauncher() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [invite, setInvite] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState(30);

  const loadTeams = useCallback(async () => {
    try {
      const t = await apiGet<Team[]>("/teams");
      setTeams(t);
      setTeamId((prev) => prev ?? t[0]?.id ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadMeetings = useCallback(async (tid: number) => {
    try {
      setMeetings(await apiGet<Meeting[]>(`/meetings?team_id=${tid}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (teamId) void loadMeetings(teamId);
  }, [teamId, loadMeetings]);

  // 보조 창에서 회의가 종료되면 목록 갱신
  useEffect(() => {
    const ch = createCompanionChannel();
    ch.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string };
      if (msg.type === "meeting:ended" && teamId) void loadMeetings(teamId);
    };
    return () => ch.close();
  }, [teamId, loadMeetings]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    try {
      const team = await apiPost<Team & { id: number }>("/teams", {
        name: teamName.trim(),
      });
      setTeamName("");
      await loadTeams();
      setTeamId(team.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const joinTeam = async () => {
    if (!joinCode.trim()) return;
    try {
      const team = await apiPost<{ id: number }>("/teams/join", {
        invite_code: joinCode.trim().toUpperCase(),
      });
      setJoinCode("");
      await loadTeams();
      setTeamId(team.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const makeInvite = async () => {
    if (!teamId) return;
    try {
      const res = await apiPost<{ invite_code: string }>(
        `/teams/${teamId}/invitations`,
        {},
      );
      setInvite(res.invite_code);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createMeeting = async () => {
    if (!teamId) return;
    try {
      await apiPost<Meeting>("/meetings", {
        team_id: teamId,
        scheduled_at: new Date().toISOString(),
        total_minutes: minutes,
        topic: topic.trim() || undefined,
      });
      setTopic("");
      await loadMeetings(teamId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startMeeting = async (m: Meeting) => {
    if (!teamId) return;
    try {
      if (m.status === "scheduled") {
        await apiPost(`/meetings/${m.id}/start`);
      }
      openCompanion(m.id, teamId);
      await loadMeetings(teamId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="live">
      <h1>실시간 회의</h1>
      <p className="live-sub">
        회의를 시작하면 폭 400px 보조 창이 열립니다. 회의 앱 옆에 띄워 두세요.
      </p>

      {/* 팀 */}
      <div className="live-card">
        <h2>팀</h2>
        {teams.length > 0 ? (
          <div className="live-row">
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(Number(e.target.value))}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="live-btn live-btn--ghost" onClick={makeInvite}>
              초대 코드 발급
            </button>
            {invite && <span className="live-invite">{invite}</span>}
          </div>
        ) : (
          <p className="live-sub">아직 팀이 없습니다. 새로 만들거나 합류하세요.</p>
        )}

        <div className="live-row" style={{ marginTop: 12 }}>
          <input
            placeholder="새 팀 이름"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <button className="live-btn" onClick={createTeam}>
            팀 생성
          </button>
          <input
            placeholder="초대 코드"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="live-btn live-btn--ghost" onClick={joinTeam}>
            합류
          </button>
        </div>
      </div>

      {/* 회의 생성 */}
      {teamId && (
        <div className="live-card">
          <h2>새 회의</h2>
          <div className="live-row">
            <input
              placeholder="주제 (선택)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              style={{ width: 90 }}
            />
            <span className="live-sub" style={{ margin: 0 }}>
              분
            </span>
            <button className="live-btn" onClick={createMeeting}>
              회의 생성
            </button>
          </div>
        </div>
      )}

      {/* 회의 목록 */}
      {teamId && (
        <div className="live-card">
          <h2>회의 목록</h2>
          {meetings.length === 0 && (
            <p className="live-sub">생성된 회의가 없습니다.</p>
          )}
          {meetings.map((m) => (
            <div key={m.id} className="live-meeting">
              <div className="live-meeting__info">
                <strong>{m.topic ?? "제목 없는 회의"}</strong>
                <span>
                  {new Date(m.scheduled_at).toLocaleString("ko-KR")} ·{" "}
                  {m.total_minutes}분
                </span>
              </div>
              <span className={`live-badge live-badge--${m.status}`}>
                {m.status === "active"
                  ? "진행 중"
                  : m.status === "ended"
                    ? "완료"
                    : "예정"}
              </span>
              {m.status === "ended" ? (
                <button
                  className="live-btn live-btn--ghost"
                  onClick={() => navigate(`/meetings/${m.id}/report`)}
                >
                  리포트
                </button>
              ) : (
                <button className="live-btn" onClick={() => startMeeting(m)}>
                  {m.status === "active" ? "보조 창 열기" : "시작"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="live-error">{error}</p>}
    </div>
  );
}
