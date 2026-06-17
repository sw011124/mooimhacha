import { useEffect } from "react";
import "@/styles/dashboard.css";
import Card from "@/components/Card";

// 스크린샷/시연용 정적 목업 — 기여도 리포트(ReportPage), "PDF 저장(제출용)" 화면.
// 실제 데이터/시드와 무관한 독립 페이지(/mock/report).
// 가상 팀(팀장·팀원1·2·3, 팀원3 무임승차 문제)으로 다른 목업과 일관.

const AV_CLS = ["a1", "a2", "a3", "a4"];

// 종합 기여 가중치 (목업 표시용). 종합 = 발언×0.3 + 출석×0.2 + 태스크×0.5.
// 참고: 실제 엔진 기본값은 회의 내 발언0.75·출석0.25 → 종합 0.375/0.125/0.5.
const W_SPEECH = 0.3;
const W_ATTEND = 0.2;
const W_TASK = 0.5;
const SEG_COLOR = {
  speech: "var(--blue)",
  attend: "var(--amber)",
  task: "var(--green)",
};

interface Chip {
  stars: number; // 1=하 / 2=중 / 3=상
  done: number; // 완료 개수
  total: number; // 전체 개수
}
interface Member {
  name: string;
  role: "leader" | "member";
  chars: number; // 발언 글자수
  attend: number; // 출석 %
  chips: Chip[];
  problem?: boolean;
}

const MEMBERS: Member[] = [
  { name: "팀장", role: "leader", chars: 380, attend: 100, chips: [{ stars: 3, done: 1, total: 1 }, { stars: 2, done: 2, total: 2 }] },
  { name: "팀원1", role: "member", chars: 330, attend: 95, chips: [{ stars: 3, done: 1, total: 1 }, { stars: 2, done: 2, total: 2 }] },
  { name: "팀원2", role: "member", chars: 240, attend: 90, chips: [{ stars: 3, done: 1, total: 1 }, { stars: 2, done: 1, total: 2 }] },
  { name: "팀원3", role: "member", chars: 70, attend: 40, chips: [{ stars: 3, done: 0, total: 1 }, { stars: 2, done: 0, total: 1 }], problem: true },
];

// 발언 점수 = min(100, 본인 글자수 ÷ 1인 평균(전체÷인원) × 100). 엔진 calc_speech_score 와 동일.
const TOTAL_CHARS = MEMBERS.reduce((s, m) => s + m.chars, 0);
const BASELINE = Math.round(TOTAL_CHARS / MEMBERS.length); // 1인 평균 글자수(기준)
const speechScore = (chars: number) =>
  Math.min(100, Math.round((chars / BASELINE) * 100));

// 태스크 점수 = Σ(완료 난이도) / Σ(전체 난이도) × 100 (난이도 가중)
const taskPctOf = (chips: Chip[]) => {
  const totalW = chips.reduce((s, c) => s + c.stars * c.total, 0);
  const doneW = chips.reduce((s, c) => s + c.stars * c.done, 0);
  return totalW ? Math.round((doneW / totalW) * 100) : 0;
};

const scoreOf = (m: Member) =>
  Math.round(
    speechScore(m.chars) * W_SPEECH +
      m.attend * W_ATTEND +
      taskPctOf(m.chips) * W_TASK,
  );

const OVERALL = Math.round(
  MEMBERS.reduce((s, m) => s + scoreOf(m), 0) / MEMBERS.length,
);

const SESSIONS = [
  { topic: "1차 정기 회의", date: "10/13", mins: 60, summary: "발표 주제와 역할 분담을 확정했습니다.", regular: true },
  { topic: "중간 점검 회의", date: "10/18", mins: 45, summary: "각자 진행 상황을 공유하고 다음 마일스톤을 정했습니다.", regular: true },
];

// 레이더 (팀장 vs 팀 평균) — [출석, 참여도(발언 점수), 태스크]
const RADAR_ME = [
  MEMBERS[0].attend,
  speechScore(MEMBERS[0].chars),
  taskPctOf(MEMBERS[0].chips),
];
const RADAR_AVG = [
  Math.round(MEMBERS.reduce((s, m) => s + m.attend, 0) / MEMBERS.length),
  Math.round(
    MEMBERS.reduce((s, m) => s + speechScore(m.chars), 0) / MEMBERS.length,
  ),
  Math.round(
    MEMBERS.reduce((s, m) => s + taskPctOf(m.chips), 0) / MEMBERS.length,
  ),
];

// ReportPage의 drawRadar를 그대로 사용 (정적 데이터용). CSS 변수로 색 반영.
function drawRadar(svgEl: SVGSVGElement, me: number[], avg: number[]) {
  const cx = 120,
    cy = 120,
    R = 88,
    axes = 3;
  const labels = ["출석", "참여도", "태스크"];
  const css = getComputedStyle(document.documentElement);
  const ang = (i: number) => (Math.PI * 2 * i) / axes - Math.PI / 2;
  const pt = (i: number, v: number): [number, number] => [
    cx + (Math.cos(ang(i)) * R * v) / 100,
    cy + (Math.sin(ang(i)) * R * v) / 100,
  ];
  let h = "";
  [25, 50, 75, 100].forEach((v) => {
    let p = "";
    for (let i = 0; i < axes; i++) {
      const [x, y] = pt(i, v);
      p += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    h += `<path d="${p}Z" fill="none" stroke="${css.getPropertyValue("--border")}" stroke-width="1"/>`;
  });
  for (let i = 0; i < axes; i++) {
    const [x, y] = pt(i, 100);
    h += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${css.getPropertyValue("--border")}" stroke-width="1"/>`;
    const [lx, ly] = pt(i, 128);
    h += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${css.getPropertyValue("--text-mut")}">${labels[i]}</text>`;
  }
  const poly = (data: number[], stroke: string, fill: string) => {
    let p = "";
    for (let i = 0; i < axes; i++) {
      const [x, y] = pt(i, data[i] ?? 0);
      p += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return `<path d="${p}Z" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>`;
  };
  h += poly(avg, css.getPropertyValue("--text-soft"), "rgba(150,160,150,.16)");
  h += poly(me, css.getPropertyValue("--green"), "rgba(29,158,117,.2)");
  for (let i = 0; i < axes; i++) {
    const [x, y] = pt(i, me[i] ?? 0);
    h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${css.getPropertyValue("--green")}"/>`;
  }
  svgEl.innerHTML = h;
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: 3,
        background: color,
        marginRight: 4,
        verticalAlign: "middle",
      }}
    />
  );
}

// 난이도별 칩 — 완료/전체. 완료(초록)·부분(주황)·미완(빨강) 구분.
function DiffChip({ c }: { c: Chip }) {
  const full = c.done === c.total;
  const none = c.done === 0;
  const color = none ? "var(--coral)" : full ? "var(--green)" : "var(--amber)";
  const bg = none
    ? "rgba(220,38,38,.10)"
    : full
      ? "rgba(29,158,117,.12)"
      : "rgba(230,160,30,.16)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background: bg,
        color,
      }}
    >
      {"★".repeat(c.stars)} {c.done}/{c.total}
    </span>
  );
}

export default function MockReport() {
  useEffect(() => {
    const el = document.getElementById("radar") as SVGSVGElement | null;
    if (el) drawRadar(el, RADAR_ME, RADAR_AVG);
  }, []);

  return (
    <div style={{ padding: 28, minHeight: "100vh", background: "var(--bg)" }}>
      <div className="report-wrap" style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* PDF 저장 버튼 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 12,
          }}
        >
          <button
            className="btn btn-primary btn-sm"
            title="이 리포트 화면을 인쇄하거나 PDF로 저장해요"
          >
            <i className="ti ti-file-export" /> PDF 저장 (제출용)
          </button>
        </div>

        {/* 배너 */}
        <div className="report-banner">
          <div>
            <div className="rb-title">팀플 기여도 최종 리포트</div>
            <div className="rb-sub">
              [테스트] 팀플 협업 · 소프트웨어공학 · 2026년 6월
            </div>
            <div className="rb-meta">총 회의 2회 · 태스크 11개 · 10/13 ~ 10/18</div>
          </div>
          <div>
            <div className="rb-score-lbl">종합 달성률</div>
            <div className="rb-score">{OVERALL}%</div>
          </div>
        </div>

        {/* 팀원별 기여도 + 레이더 (가로 2열) */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "stretch",
            marginBottom: 14,
          }}
        >
          {/* 팀원별 기여도 */}
          <Card
            icon="ti ti-chart-bar"
            title="팀원별 기여도"
            style={{ flex: 1, marginBottom: 0 }}
          >
            {/* 게이지 범례 */}
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
                padding: "0 18px 4px",
                fontSize: 11.5,
                color: "var(--text-soft)",
              }}
            >
              <span>
                <Swatch color={SEG_COLOR.speech} />발언 (×0.3)
              </span>
              <span>
                <Swatch color={SEG_COLOR.attend} />출석 (×0.2)
              </span>
              <span>
                <Swatch color={SEG_COLOR.task} />태스크 (×0.5)
              </span>
              <span style={{ marginLeft: "auto" }}>막대 = 종합 기여 합산</span>
            </div>
            {/* 발언 점수 기준 안내 */}
            <div
              style={{
                padding: "0 18px 8px",
                fontSize: 11,
                color: "var(--text-soft)",
              }}
            >
              발언 점수 = 본인 글자수 ÷ 1인 평균({BASELINE}자) × 100 (100점 상한),
              태스크 = 난이도(★) 가중 완료율
            </div>

            <div style={{ padding: "0 18px 14px" }}>
              {MEMBERS.map((m, i) => {
                const sScore = speechScore(m.chars);
                const tPct = taskPctOf(m.chips);
                const segS = sScore * W_SPEECH;
                const segA = m.attend * W_ATTEND;
                const segT = tPct * W_TASK;
                const score = Math.round(segS + segA + segT);
                const scoreCls =
                  score >= 50 ? "hi" : score >= 25 ? "md" : "lo";
                return (
                  <div key={m.name} className="mrc">
                    {/* 헤더: 아바타 · 이름 · 세그먼트 게이지 · 점수 */}
                    <div
                      className="mrc-head"
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div className={`av ${AV_CLS[i]} av-lg`}>{m.name[0]}</div>
                      <div style={{ width: 64, flex: "0 0 auto" }}>
                        <div
                          className="mrc-name"
                          style={{ display: "flex", alignItems: "center" }}
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
                        </div>
                        <div className="mrc-role">
                          {m.role === "leader" ? "팀장" : "팀원"}
                        </div>
                      </div>
                      {/* 세그먼트 게이지 (이름과 점수 사이) */}
                      <div
                        style={{
                          flex: 1,
                          height: 11,
                          borderRadius: 6,
                          background: "var(--track)",
                          overflow: "hidden",
                          display: "flex",
                        }}
                        title={`발언 ${segS.toFixed(1)} + 출석 ${segA.toFixed(1)} + 태스크 ${segT.toFixed(1)}`}
                      >
                        <span style={{ width: `${segS}%`, background: SEG_COLOR.speech }} />
                        <span style={{ width: `${segA}%`, background: SEG_COLOR.attend }} />
                        <span style={{ width: `${segT}%`, background: SEG_COLOR.task }} />
                      </div>
                      <div
                        className={`mrc-score ${scoreCls}`}
                        style={{ flex: "0 0 auto" }}
                      >
                        {score}점
                      </div>
                    </div>

                    {/* 세부: 발언(점수·글자수) · 출석 · 태스크(난이도 칩) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 9,
                        fontSize: 12,
                        color: "var(--text-soft)",
                      }}
                    >
                      <span>
                        발언{" "}
                        <b
                          style={{
                            color:
                              sScore < 50
                                ? "var(--coral)"
                                : "var(--text-main)",
                          }}
                        >
                          {sScore}점
                        </b>{" "}
                        <span style={{ fontSize: 11 }}>({m.chars}자)</span>
                      </span>
                      <span>
                        출석 <b style={{ color: "var(--text-main)" }}>{m.attend}%</b>
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        태스크
                        {m.chips.map((c, ci) => (
                          <DiffChip key={ci} c={c} />
                        ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 기여도 레이더 (1:1 정사각형) */}
          <Card
            icon="ti ti-chart-dots"
            title="기여도 레이더"
            extra={
              <span className="card-link" style={{ cursor: "default" }}>
                팀장 vs 팀 평균
              </span>
            }
            style={{
              width: 360,
              flex: "0 0 auto",
              marginBottom: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <svg id="radar" width={280} height={280} viewBox="0 0 240 240" />
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  fontSize: 11,
                  color: "var(--text-soft)",
                }}
              >
                <span>
                  <Swatch color="var(--green)" />팀장
                </span>
                <span>
                  <Swatch color="var(--text-soft)" />팀 평균
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* 회의별 요약 */}
        <Card icon="ti ti-calendar" title="회의별 요약">
          <div style={{ padding: "0 18px 14px" }}>
            {SESSIONS.map((m, i) => (
              <div key={i} className="ms-row">
                <div className="ms-num">{i + 1}</div>
                <div>
                  <div className="ms-title">
                    {m.topic} <span>{m.date} · {m.mins}분</span>
                  </div>
                  <div className="ms-body">{m.summary}</div>
                  <div className="ms-meta">
                    {m.regular ? "정규 회의 · 기여도 반영" : "기여도 누적 미반영"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
