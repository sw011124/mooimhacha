import "@/styles/dashboard.css";

// 스크린샷/시연용 정적 목업 — 태스크 보드(TasksPage 보드 뷰).
// 실제 데이터/시드와 무관한 독립 페이지(/mock/tasks).
// 기여도 목업과 동일한 가상 팀(팀장·팀원1·2·3, 팀원3 무임승차 문제).
// 팀원3은 완료 0건 + 기한 초과 2건으로 문제를 드러낸다.

interface Task {
  desc: string;
  who: string;
  av: string; // 아바타 색 클래스 a1~a4
  difficulty: number; // 1~3 (★)
  stripe?: string; // 담당자 색 스트라이프 (정상 카드만)
  dueLabel?: string;
  dueTime?: string;
  dDay?: string;
  danger?: boolean; // 기한 지남 (빨강)
  warn?: boolean; // 임박 (주황)
  done?: boolean; // 완료 카드
}

interface Column {
  title: string;
  color: string;
  badge: string;
  tasks: Task[];
}

const COLUMNS: Column[] = [
  {
    title: "할 일",
    color: "var(--text-soft)",
    badge: "",
    tasks: [
      { desc: "API 문서 정리", who: "팀원3", av: "a4", difficulty: 3, dueLabel: "10/13(월)", dueTime: "오후 6:00", dDay: "D+2", danger: true },
      { desc: "참고문헌 조사", who: "팀원3", av: "a4", difficulty: 2, dueLabel: "10/14(화)", dueTime: "오후 6:00", dDay: "D+1", danger: true },
    ],
  },
  {
    title: "진행 중",
    color: "var(--blue)",
    badge: "b-blue",
    tasks: [
      { desc: "데이터 분석", who: "팀원2", av: "a3", difficulty: 2, stripe: "var(--pink)", dueLabel: "10/20(월)", dueTime: "오후 6:00", dDay: "D-5" },
    ],
  },
  {
    title: "완료",
    color: "var(--green)",
    badge: "b-green",
    tasks: [
      { desc: "발표 자료 작성", who: "팀장", av: "a1", difficulty: 3, done: true, dueLabel: "10/15(수)", dueTime: "오후 6:00" },
      { desc: "회의록 정리", who: "팀장", av: "a1", difficulty: 2, done: true, dueLabel: "10/13(월)", dueTime: "오후 6:00" },
      { desc: "킥오프 준비", who: "팀장", av: "a1", difficulty: 2, done: true, dueLabel: "10/08(수)", dueTime: "오후 6:00" },
      { desc: "프로토타입 구현", who: "팀원1", av: "a2", difficulty: 3, done: true, dueLabel: "10/16(목)", dueTime: "오후 6:00" },
      { desc: "요구사항 정의", who: "팀원1", av: "a2", difficulty: 2, done: true, dueLabel: "10/10(금)", dueTime: "오후 6:00" },
      { desc: "리서치 계획", who: "팀원1", av: "a2", difficulty: 2, done: true, dueLabel: "10/09(목)", dueTime: "오후 6:00" },
      { desc: "와이어프레임", who: "팀원2", av: "a3", difficulty: 3, done: true, dueLabel: "10/14(화)", dueTime: "오후 6:00" },
      { desc: "설문 문항 작성", who: "팀원2", av: "a3", difficulty: 2, done: true, dueLabel: "10/17(금)", dueTime: "오후 6:00" },
    ],
  },
];

const DONE = 8;
const TOTAL = 11;

function TaskCard({ t }: { t: Task }) {
  const stripeStyle =
    !t.danger && !t.warn && !t.done && t.stripe
      ? { borderLeft: `3px solid ${t.stripe}` }
      : undefined;
  return (
    <div
      className={`tcard ${t.danger ? "danger" : ""} ${t.warn ? "warn" : ""} ${
        t.done ? "done-card" : ""
      }`}
      style={stripeStyle}
    >
      <div className="tc-head">
        <div className={`tc-title ${t.done ? "done" : ""}`}>{t.desc}</div>
        <span className="tc-diff">
          {"★".repeat(t.difficulty)}
          <span className="tc-diff-off">{"★".repeat(3 - t.difficulty)}</span>
        </span>
      </div>
      <div className="tc-foot">
        <span className="tc-who">
          <span
            className={`av ${t.av} av-sm`}
            style={{ width: 20, height: 20, fontSize: 9 }}
          >
            {t.who[0]}
          </span>
          {t.who}
        </span>
        {t.dueLabel && (
          <div
            className="tc-due"
            style={{
              color: t.danger
                ? "var(--coral)"
                : t.warn
                  ? "var(--amber)"
                  : "var(--text-soft)",
            }}
          >
            <i className="ti ti-calendar" />
            {t.dueLabel}
            {t.dueTime && (
              <span style={{ fontWeight: 500, marginLeft: 2 }}>
                {t.dueTime}
              </span>
            )}
            {t.dDay && (
              <span style={{ fontWeight: 700, marginLeft: 4 }}>{t.dDay}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MockTasks() {
  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="task-top">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="view-toggle">
              <button className="vt active">
                <i className="ti ti-layout-columns" /> 보드
              </button>
              <button className="vt">
                <i className="ti ti-list" /> 목록
              </button>
            </div>
            <div className="view-toggle">
              <button className="vt active">전체</button>
              <button className="vt">내 태스크</button>
            </div>
          </div>
          <button className="btn btn-primary btn-sm">
            <i className="ti ti-plus" /> 태스크 추가
          </button>
        </div>

        <div className="prog-strip">
          <span className="lbl">전체 진행률</span>
          <div className="prog-bg">
            <div
              className="prog-fill"
              style={{ width: `${Math.round((DONE / TOTAL) * 100)}%` }}
            />
          </div>
          <span className="num">
            {DONE} / {TOTAL} 완료
          </span>
        </div>

        <div className="board">
          {COLUMNS.map((col) => (
            <div key={col.title} className="board-col">
              <div className="col-head">
                <span className="col-dot" style={{ background: col.color }} />
                <span className="col-title">{col.title}</span>
                <span
                  className="col-cnt"
                  style={
                    col.title !== "할 일"
                      ? {
                          background: `var(--${
                            col.title === "진행 중" ? "blue" : "green"
                          }-soft)`,
                          color: col.color,
                        }
                      : undefined
                  }
                >
                  {col.tasks.length}
                </span>
              </div>
              {col.tasks.map((t) => (
                <TaskCard key={t.desc} t={t} />
              ))}
              <button className="add-col">
                <i className="ti ti-plus" /> 추가
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
