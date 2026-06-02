import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "@/lib/api";
import type { Meeting, MeetingContribution, TeamContribution } from "@/lib/types";
import "@/styles/live.css";

// 회의 후 기여도 대시보드.
// ① 회의 기여도(저장값) + ②③④ 팀 종합·테스크·종합 기여도(외부 동적 계산).
export default function ContributionDashboard() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [meetingScores, setMeetingScores] = useState<MeetingContribution[]>([]);
  const [teamScores, setTeamScores] = useState<TeamContribution[]>([]);
  const [computed, setComputed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(meetingId);
    if (!id) return;
    void (async () => {
      try {
        const m = await apiGet<Meeting>(`/meetings/${id}`);
        setMeeting(m);
        const mc = await apiGet<{ scores: MeetingContribution[] }>(
          `/meetings/${id}/contributions`,
        );
        setMeetingScores(mc.scores);
        const tc = await apiGet<{
          members: TeamContribution[];
          computed: boolean;
        }>(`/teams/${m.team_id}/contributions`);
        setTeamScores(tc.members);
        setComputed(tc.computed);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [meetingId]);

  const pct = (v: number | null) =>
    v === null ? "—" : `${Math.round(v * 100)}%`;

  return (
    <div className="live">
      <button
        className="live-btn live-btn--ghost"
        onClick={() => navigate("/meetings")}
        style={{ marginBottom: 16 }}
      >
        ← 회의 목록
      </button>
      <h1>기여도 리포트</h1>
      <p className="live-sub">{meeting?.topic ?? "회의"} · 회의 종료 후 집계</p>

      {!computed && (
        <p className="live-note">
          외부 기여도 산정 서버가 연결되지 않아 종합 점수(②③④)는 비어 있습니다.
        </p>
      )}

      {/* ① 회의 기여도 */}
      <div className="live-card">
        <h2>① 이번 회의 기여도</h2>
        {meetingScores.length === 0 ? (
          <p className="live-sub">저장된 회의 점수가 없습니다.</p>
        ) : (
          <table className="live-table">
            <thead>
              <tr>
                <th>멤버</th>
                <th>발언 비중</th>
                <th>참석</th>
                <th>회의 점수</th>
                <th>신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {meetingScores.map((s) => (
                <tr key={s.user_id}>
                  <td>{s.name}</td>
                  <td>{pct(s.speech_ratio)}</td>
                  <td>{pct(s.attendance_ratio)}</td>
                  <td>
                    <strong>{pct(s.meeting_score)}</strong>
                  </td>
                  <td>{s.confidence_level ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ②③④ 팀 종합 */}
      <div className="live-card">
        <h2>팀 누적 기여도</h2>
        <table className="live-table">
          <thead>
            <tr>
              <th>멤버</th>
              <th>② 회의 종합</th>
              <th>③ 테스크</th>
              <th>④ 종합</th>
            </tr>
          </thead>
          <tbody>
            {teamScores.map((s) => (
              <tr key={s.user_id}>
                <td>
                  {s.name}
                  {s.role === "leader" && " 👑"}
                </td>
                <td>{pct(s.meeting_aggregate)}</td>
                <td>{pct(s.task_score)}</td>
                <td>
                  <strong>{pct(s.composite_score)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="live-note">
          ④ 종합 = ③ 테스크 × w + ② 회의 종합 × (1−w) (팀장 배율 적용). 공식 상세는
          docs/06-기여도-산정.md.
        </p>
      </div>

      {error && <p className="live-error">{error}</p>}
    </div>
  );
}
