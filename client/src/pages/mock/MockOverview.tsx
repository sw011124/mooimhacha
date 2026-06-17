import "@/styles/dashboard.css";
import Card from "@/components/Card";

// 스크린샷/시연용 정적 목업 — 그룹 대시보드 메인(OverviewPage).
// 실제 데이터/시드와 무관한 독립 페이지(/mock/overview).
// 기여도 목업과 동일한 가상 팀(팀장·팀원1·2·3, 팀원3 무임승차 문제)으로 일관.

const CONTRIB = [
  { name: "팀장", pct: 100, color: "var(--green)", task: "태스크 3/3" },
  { name: "팀원1", pct: 99, color: "var(--blue)", task: "태스크 3/3" },
  { name: "팀원2", pct: 82, color: "var(--pink)", task: "태스크 2/3" },
  { name: "팀원3", pct: 16, color: "var(--coral)", task: "태스크 0/2", problem: true },
];

interface Stat {
  lbl: string;
  val: string;
  sub: string;
  valStyle?: React.CSSProperties;
}

const STATS: Stat[] = [
  { lbl: "총 회의", val: "5", sub: "이번 프로젝트" },
  { lbl: "총 태스크 진행률", val: "73%", sub: "8 / 11 완료" },
  {
    lbl: "내 다음 마감 태스크",
    val: "—",
    sub: "예정된 마감 없음",
    valStyle: { fontSize: 20, paddingTop: 8 },
  },
  {
    lbl: "기한 초과 태스크",
    val: "2개",
    sub: "즉시 확인 필요",
    valStyle: { color: "var(--coral)" },
  },
];

const OPEN_TASKS = [
  { desc: "API 문서 정리", due: "지남", who: "팀원3", danger: true },
  { desc: "참고문헌 조사", due: "지남", who: "팀원3", danger: true },
  { desc: "데이터 분석", due: "10/20(월) 오후 6:00", who: "팀원2" },
];

const MEETING_MEMBERS = ["팀장", "팀원1", "팀원2", "팀원3"];

export default function MockOverview() {
  return (
    <div
      style={{
        padding: 28,
        minHeight: "100vh",
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        {/* 경보 */}
        <div className="alert-bar">
          <i className="ti ti-alert-triangle" /> 팀원3님의 기여도가 16%로 팀
          평균(74%)을 크게 밑돌고, 기한 초과 태스크가 2개예요. 무임승차가
          의심돼요.
        </div>

        {/* 통계 */}
        <div className="stats-grid">
          {STATS.map((s) => (
            <div key={s.lbl} className="stat-card">
              <div className="stat-lbl">{s.lbl}</div>
              <div className="stat-val" style={s.valStyle}>
                {s.val}
              </div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="dash-grid">
          {/* 기여도 현황 */}
          <Card
            icon="ti ti-chart-bar"
            title="기여도 현황"
            titleSuffix={
              <span
                className="live-dot"
                style={{ background: "var(--green)" }}
              />
            }
            extra={<span className="badge b-green">실시간</span>}
          >
            <div style={{ padding: "2px 18px 14px" }}>
              {CONTRIB.map((c) => (
                <div key={c.name} className="contrib-row">
                  <span
                    className="c-name"
                    style={{ width: 78, display: "flex", alignItems: "center" }}
                  >
                    {c.name}
                    {c.problem && (
                      <span
                        className="nav-alert"
                        title="처리할 일이 있어요"
                        style={{ marginLeft: 5 }}
                      >
                        !
                      </span>
                    )}
                  </span>
                  <span className="c-bar">
                    <i style={{ width: `${c.pct}%`, background: c.color }} />
                  </span>
                  <span className="c-pct">{c.pct}%</span>
                  <span className="c-task" style={{ color: "var(--text-soft)" }}>
                    {c.task}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* 예정된 회의 */}
          <div className="mini-meeting">
            <div className="card-head" style={{ padding: "0 0 10px" }}>
              <span className="card-title">
                <i className="ti ti-clock" /> 예정된 회의
              </span>
              <span className="badge">예정</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
              2차 정기 회의
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-soft)" }}>
              10월 21일 · 30분 · 4명
            </div>
            <div style={{ display: "flex", gap: 7, margin: "14px 0 4px" }}>
              {MEETING_MEMBERS.map((name, i) => (
                <div key={i} className={`av a${(i % 4) + 1} av-sm`}>
                  {name[0]}
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 12 }}
            >
              <i className="ti ti-arrow-right" /> 회의 관리로 이동
            </button>
          </div>
        </div>

        {/* 미완료 태스크 */}
        <Card icon="ti ti-checklist" title="미완료 태스크">
          <div style={{ padding: "2px 16px 14px" }}>
            {OPEN_TASKS.map((t, i) => (
              <div key={i} className="task-mini">
                <div className="chk-mini" />
                <div style={{ flex: 1 }}>{t.desc}</div>
                <span
                  style={{
                    minWidth: 148,
                    textAlign: "right",
                    color: t.danger ? "var(--coral)" : "var(--text-soft)",
                    fontWeight: t.danger ? 700 : undefined,
                  }}
                >
                  {t.due}
                </span>
                <span
                  style={{
                    minWidth: 56,
                    textAlign: "right",
                    color: "var(--text-soft)",
                  }}
                >
                  {t.who}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
