import { User } from './user.entity';
import { Team } from './team.entity';
import { TeamMembership } from './team-membership.entity';
import { TeamSettings } from './team-settings.entity';
import { Project } from './project.entity';
import { Milestone } from './milestone.entity';
import { Meeting } from './meeting.entity';
import { Agenda } from './agenda.entity';
import { Utterance } from './utterance.entity';
import { Decision } from './decision.entity';
import { ActionItem } from './action-item.entity';
import { PresenceEvent } from './presence-event.entity';
import { AnomalyEvent } from './anomaly-event.entity';
import { ContributionScore } from './contribution-score.entity';

// TypeOrmModule.forRoot 의 entities 등록용 단일 출처
export const ALL_ENTITIES = [
  User,
  Team,
  TeamMembership,
  TeamSettings,
  Project,
  Milestone,
  Meeting,
  Agenda,
  Utterance,
  Decision,
  ActionItem,
  PresenceEvent,
  AnomalyEvent,
  ContributionScore,
];

export {
  User,
  Team,
  TeamMembership,
  TeamSettings,
  Project,
  Milestone,
  Meeting,
  Agenda,
  Utterance,
  Decision,
  ActionItem,
  PresenceEvent,
  AnomalyEvent,
  ContributionScore,
};
