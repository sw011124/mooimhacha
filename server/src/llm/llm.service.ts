import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// GPT-4o-mini 호출 래퍼. 회의 중 안건 요약(안건당 1회) + 회의 후 종합 정리·다음 회의 안건 생성.
// OPENAI_API_KEY 미설정 시 호출을 건너뛰고 null 을 반환해 흐름이 끊기지 않게 한다.
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model = 'gpt-4o-mini';

  constructor(private config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('OPENAI_API_KEY');
  }

  // 완료된 안건의 발화들을 한국어로 3~5문장 요약
  async summarizeAgenda(
    title: string,
    utterances: string[],
  ): Promise<string | null> {
    if (utterances.length === 0) return null;
    const prompt =
      `다음은 "${title}" 안건에서 오간 발언이다. 핵심 논의와 결론을 한국어로 3~5문장으로 요약해라.\n\n` +
      utterances.map((u, i) => `${i + 1}. ${u}`).join('\n');
    return this.chat(
      '너는 회의 안건 요약을 돕는 비서다. 군더더기 없이 핵심만 요약한다.',
      prompt,
    );
  }

  // 다음 회의 안건 목록 생성 (출력: JSON 문자열)
  async generateAgendas(context: string): Promise<string | null> {
    const prompt =
      '아래 이번 회의 결과를 바탕으로 다음 회의 안건을 제안해라. ' +
      '반드시 JSON 배열만 출력하고 각 항목은 {"title": string, "estimated_minutes": number, "source_label": string} 형식이다.\n\n' +
      context;
    return this.chat(
      '너는 팀플 회의 안건을 설계하는 비서다. JSON 외 텍스트는 출력하지 않는다.',
      prompt,
    );
  }

  private async chat(system: string, user: string): Promise<string | null> {
    if (!this.enabled) {
      this.logger.warn('OPENAI_API_KEY 미설정 — LLM 호출을 건너뜁니다.');
      return null;
    }
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.get<string>('OPENAI_API_KEY')}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI 응답 오류: ${res.status}`);
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content ?? null;
    } catch (e) {
      this.logger.error('OpenAI 호출 실패', e as Error);
      return null;
    }
  }
}
