import { useState } from "react";
import type { Agenda } from "@/lib/types";

// 안건 추적 (★) — 상태 3단계(대기/진행 중/완료) + 시간 초과 시각화.
// 100% 색 변경 → 150% 알림 → 200% 강한 신호.
interface Props {
  agendas: Agenda[];
  t0ms: number | null;
  now: number;
  summaries: Record<number, string>;
  onActivate: (id: number) => void;
  onDone: (id: number) => void;
  onAdd: (title: string) => void;
}

function overrunLevel(ratio: number): string {
  if (ratio >= 2) return "over-200";
  if (ratio >= 1.5) return "over-150";
  if (ratio >= 1) return "over-100";
  return "";
}

export default function AgendaTracker({
  agendas,
  t0ms,
  now,
  summaries,
  onActivate,
  onDone,
  onAdd,
}: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [openSummary, setOpenSummary] = useState<number | null>(null);

  const submitNew = () => {
    const t = newTitle.trim();
    if (!t) return;
    onAdd(t);
    setNewTitle("");
  };

  return (
    <section className="cmp-section cmp-agenda">
      <header className="cmp-section__head">
        <h2>안건</h2>
      </header>
      <ul className="cmp-agenda-list">
        {agendas.map((a) => {
          const isActive = a.status === "active";
          let ratio = 0;
          if (
            isActive &&
            t0ms !== null &&
            a.started_at_offset_ms !== null &&
            a.estimated_minutes > 0
          ) {
            const elapsed = now - (t0ms + a.started_at_offset_ms);
            ratio = elapsed / (a.estimated_minutes * 60000);
          }
          const summary = summaries[a.id] ?? a.summary;
          return (
            <li
              key={a.id}
              className={`cmp-agenda-item cmp-agenda-item--${a.status} ${
                isActive ? overrunLevel(ratio) : ""
              }`}
            >
              <div className="cmp-agenda-row">
                <span className={`cmp-dot cmp-dot--${a.status}`} />
                <span className="cmp-agenda-title">{a.title}</span>
                {a.estimated_minutes > 0 && (
                  <span className="cmp-agenda-est">{a.estimated_minutes}분</span>
                )}
                <div className="cmp-agenda-actions">
                  {a.status === "pending" && (
                    <button onClick={() => onActivate(a.id)} title="진행 시작">
                      ▶
                    </button>
                  )}
                  {a.status === "active" && (
                    <button onClick={() => onDone(a.id)} title="완료">
                      ✓
                    </button>
                  )}
                  {a.status === "done" && summary && (
                    <button
                      onClick={() =>
                        setOpenSummary(openSummary === a.id ? null : a.id)
                      }
                      title="요약 보기"
                    >
                      요약
                    </button>
                  )}
                </div>
              </div>
              {isActive && ratio >= 1 && (
                <div className="cmp-agenda-overrun">
                  예상 시간 {Math.round(ratio * 100)}% 경과
                </div>
              )}
              {openSummary === a.id && summary && (
                <div className="cmp-agenda-summary">{summary}</div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="cmp-agenda-add">
        <input
          value={newTitle}
          placeholder="즉석 안건 추가"
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNew()}
        />
        <button onClick={submitNew}>+</button>
      </div>
    </section>
  );
}
