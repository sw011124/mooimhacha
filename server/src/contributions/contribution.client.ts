import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MeetingScoreRequest,
  MeetingScoreResponse,
  TeamContributionRequest,
  TeamContributionResponse,
} from './contribution.types';

// 외부 기여도 산정 서버 HTTP 클라이언트.
// CONTRIBUTION_SERVICE_URL 미설정 시 호출을 건너뛰고 null 을 반환해
// (개발/데모 환경에서) 회의 종료·조회 흐름이 끊기지 않도록 한다.
@Injectable()
export class ContributionClient {
  private readonly logger = new Logger(ContributionClient.name);

  constructor(private config: ConfigService) {}

  private get baseUrl(): string | undefined {
    return this.config.get<string>('CONTRIBUTION_SERVICE_URL');
  }

  get configured(): boolean {
    return !!this.baseUrl;
  }

  async computeMeetingScores(
    payload: MeetingScoreRequest,
  ): Promise<MeetingScoreResponse | null> {
    return this.post<MeetingScoreResponse>('/contributions/meeting', payload);
  }

  async computeTeamContributions(
    payload: TeamContributionRequest,
  ): Promise<TeamContributionResponse | null> {
    return this.post<TeamContributionResponse>('/contributions/team', payload);
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    if (!this.baseUrl) {
      this.logger.warn(
        `CONTRIBUTION_SERVICE_URL 미설정 — 기여도 산정(${path})을 건너뜁니다.`,
      );
      return null;
    }
    const apiKey = this.config.get<string>('CONTRIBUTION_SERVICE_API_KEY');
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.error(`기여도 서버 응답 오류(${path}): ${res.status}`);
        throw new ServiceUnavailableException('기여도 산정 서버 오류');
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      this.logger.error(`기여도 서버 호출 실패(${path})`, e as Error);
      throw new ServiceUnavailableException(
        '기여도 산정 서버에 연결할 수 없습니다.',
      );
    }
  }
}
