import { useEffect, useRef, useState } from "react";
import type { TeamMember } from "@/lib/types";

// 결정사항·액션 빠른 입력. 단축키 Ctrl/Cmd+D(결정)·Ctrl/Cmd+A(액션).
// 입력된 항목은 현재 진행 중 안건에 서버가 자동 연결.
interface Props {
  members: TeamMember[];
  onDecision: (content: string) => void;
  onAction: (payload: {
    description: string;
    assignee_id?: number;
    due_date?: string;
  }) => void;
}

export default function QuickInput({ members, onDecision, onAction }: Props) {
  const [decision, setDecision] = useState("");
  const [actionDesc, setActionDesc] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [due, setDue] = useState("");

  const decisionRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        decisionRef.current?.focus();
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        actionRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitDecision = () => {
    const c = decision.trim();
    if (!c) return;
    onDecision(c);
    setDecision("");
  };

  const submitAction = () => {
    const d = actionDesc.trim();
    if (!d) return;
    onAction({
      description: d,
      assignee_id: assignee ? Number(assignee) : undefined,
      due_date: due ? new Date(due).toISOString() : undefined,
    });
    setActionDesc("");
    setDue("");
  };

  return (
    <section className="cmp-section cmp-quick">
      <div className="cmp-quick-block">
        <label>
          결정 <kbd>⌘D</kbd>
        </label>
        <input
          ref={decisionRef}
          value={decision}
          placeholder="결정사항 한 줄 + Enter"
          onChange={(e) => setDecision(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitDecision()}
        />
      </div>
      <div className="cmp-quick-block">
        <label>
          액션 <kbd>⌘A</kbd>
        </label>
        <input
          ref={actionRef}
          value={actionDesc}
          placeholder="할 일 내용"
          onChange={(e) => setActionDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAction()}
        />
        <div className="cmp-quick-action-meta">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">담당자</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button onClick={submitAction}>추가</button>
        </div>
      </div>
    </section>
  );
}
