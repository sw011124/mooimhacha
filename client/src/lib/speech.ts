// 브라우저 내장 Web Speech API(SpeechRecognition) 래퍼.
// MVP STT 엔진. isFinal(확정 발화)만 전달하고, ~60초 강제 종료는 onend 자동 재시작으로 방어한다.
// Chrome/Edge(Chromium) 전용. (docs/05·09)

// --- 최소 타입 선언 (TS 표준 lib 에 미포함) ---
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface SpeechCallbacks {
  // 확정 발화 1건
  onFinal: (text: string, confidence: number | null) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  // STT 실패(network/no-speech/aborted 등) — anomaly_events.stt_failure 기록용
  onFailure?: (error: string) => void;
  lang?: string;
}

export interface SpeechController {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
}

export function createSpeechRecognizer(
  cb: SpeechCallbacks,
): SpeechController | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = cb.lang ?? "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = false; // isFinal 만 사용
  recognition.maxAlternatives = 1;

  let running = false;
  let lastErrored = false;

  recognition.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result.isFinal) continue;
      const alt = result[0];
      const text = alt.transcript.trim();
      if (!text) continue;
      // confidence 가 0/미제공이면 null 로 저장 (docs/06·09)
      const confidence =
        typeof alt.confidence === "number" && alt.confidence > 0
          ? alt.confidence
          : null;
      cb.onFinal(text, confidence);
    }
  };

  recognition.onspeechstart = () => cb.onSpeechStart?.();
  recognition.onspeechend = () => cb.onSpeechEnd?.();

  recognition.onerror = (e) => {
    lastErrored = true;
    if (["network", "no-speech", "aborted"].includes(e.error)) {
      cb.onFailure?.(e.error);
    }
  };

  // ~60초 강제 종료/오류 후 자동 재시작 (사용자가 stop 하지 않은 동안)
  recognition.onend = () => {
    if (running) {
      try {
        recognition.start();
      } catch {
        // 재시작 충돌 시 한 박자 쉬고 재시도
        setTimeout(() => {
          if (running) {
            try {
              recognition.start();
            } catch {
              if (lastErrored) cb.onFailure?.("restart_failed");
            }
          }
        }, 300);
      }
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastErrored = false;
      try {
        recognition.start();
      } catch {
        // 이미 시작된 경우 무시
      }
    },
    stop() {
      running = false;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
    get running() {
      return running;
    },
  };
}
