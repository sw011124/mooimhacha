// 회의 중 보조 창(별도 브라우저 창, 폭 400px) 제어 + 메인 탭과의 상태 공유.
// always-on-top 은 V2(데스크탑). MVP 는 window.open. (docs/01·02·11)

const COMPANION_WIDTH = 400;
const COMPANION_HEIGHT = 820;
const POSITION_KEY = "companion_window_position";

interface CompanionPosition {
  left: number;
  top: number;
}

function loadPosition(): CompanionPosition | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    return raw ? (JSON.parse(raw) as CompanionPosition) : null;
  } catch {
    return null;
  }
}

export function saveCompanionPosition(pos: CompanionPosition) {
  localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
}

// 보조 창 열기 — 회의 ID 를 쿼리로 넘긴다.
export function openCompanion(meetingId: number, teamId: number): Window | null {
  const pos = loadPosition();
  const features = [
    `width=${COMPANION_WIDTH}`,
    `height=${COMPANION_HEIGHT}`,
    pos ? `left=${pos.left}` : "",
    pos ? `top=${pos.top}` : "",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
  ]
    .filter(Boolean)
    .join(",");

  return window.open(
    `/companion.html?meeting=${meetingId}&team=${teamId}`,
    `mooimhacha_companion_${meetingId}`,
    features,
  );
}

// 메인 탭 ↔ 보조 창 상태 공유 (회의 종료 신호 등)
const CHANNEL_NAME = "mooimhacha-meeting";

export type CompanionMessage =
  | { type: "meeting:ended"; meeting_id: number }
  | { type: "companion:closed"; meeting_id: number };

export function createCompanionChannel(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL_NAME);
}
