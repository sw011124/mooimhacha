import "@/styles/dashboard.css";
import Card from "@/components/Card";

// 스크린샷/시연용 정적 목업 — 그룹 대시보드 "기여도 현황" 게이지.
// 실제 데이터/시드와 무관한 독립 페이지(/mock/contribution).
// 4명 고른 분포 + 1명(팀원3) 무임승차 문제를 기존 기여도 막대(c-bar)로 보여준다.

interface Member {
  name: string;
  pct: number; // ④ 종합 기여도
  color: string; // 막대 색 (기존 MEMBER_COLORS 토큰)
  taskDone: number;
  taskTotal: number;
  problem?: boolean;
}

const MEMBERS: Member[] = [
  { name: "팀장", pct: 100, color: "var(--green)", taskDone: 3, taskTotal: 3 },
  { name: "팀원1", pct: 99, color: "var(--blue)", taskDone: 3, taskTotal: 3 },
  { name: "팀원2", pct: 82, color: "var(--pink)", taskDone: 2, taskTotal: 3 },
  { name: "팀원3", pct: 16, color: "var(--coral)", taskDone: 0, taskTotal: 2, problem: true },
];

export default function MockContribution() {
  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* 무임승차 경보 배너 */}
        <div className="alert-bar" style={{ marginBottom: 14 }}>
          <i className="ti ti-alert-triangle" />{" "}
          <span>
            <strong>팀원3</strong>님의 누적 기여도가 <strong>16%</strong>로 팀
            평균(74%)을 크게 밑돌아요. 무임승차가 의심돼요.
          </span>
        </div>

        {/* 기여도 현황 게이지 카드 */}
        <Card
          icon="ti ti-chart-bar"
          title="기여도 현황"
          titleSuffix={
            <span className="live-dot" style={{ background: "var(--green)" }} />
          }
          extra={<span className="badge b-green">실시간</span>}
        >
          <div style={{ padding: "2px 18px 14px" }}>
            {MEMBERS.map((m) => (
              <div key={m.name} className="contrib-row">
                <span
                  className="c-name"
                  style={{ width: 78, display: "flex", alignItems: "center" }}
                >
                  {m.name}
                  {m.problem && (
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
                  <i style={{ width: `${m.pct}%`, background: m.color }} />
                </span>
                <span className="c-pct">{m.pct}%</span>
                <span className="c-task" style={{ color: "var(--text-soft)" }}>
                  태스크 {m.taskDone}/{m.taskTotal}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
