import type { NutritionShare, ProgressShare, ShareScope, WeightShare } from './sharePayload';

export interface RemoteProfile {
  id: string;
  handle: string;
  display_name: string;
  emoji: string;
  /* --- Die Profilkarte. Nichts davon ist ein Trainingswert. --- */
  bio?: string;
  accent?: string;
  /** IDs angehefteter Erfolge. */
  pins?: string[];
  /** Namen der Lieblingsuebungen - Namen, keine Gewichte. */
  favorites?: string[];
}

export type FriendState = 'accepted' | 'incoming' | 'outgoing';

export interface Friend {
  /** ID der Freundschaftszeile - wird zum Annehmen und Entfernen gebraucht. */
  linkId: string;
  userId: string;
  handle: string;
  displayName: string;
  emoji: string;
  state: FriendState;
  since: string;
  /** Die Profilkarte des Freundes - Text und Farbe, keine Trainingswerte. */
  bio?: string;
  accent?: string;
  pins?: string[];
  favorites?: string[];
}

export interface FriendData {
  progress?: ProgressShare;
  weight?: WeightShare;
  nutrition?: NutritionShare;
  /** Bereiche, die dieser Freund fuer mich freigegeben hat. */
  scopes: ShareScope[];
  updatedAt: string | null;
}

export type SyncStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in';

export interface Group {
  id: string;
  name: string;
  emoji: string;
  joinCode: string;
  ownerId: string;
  memberCount: number;
  members: Array<{ userId: string; handle: string; displayName: string; emoji: string }>;
}

export type ChallengeMetric = 'workouts' | 'sets' | 'volume';

export interface Challenge {
  id: string;
  title: string;
  metric: ChallengeMetric;
  startsOn: string;
  endsOn: string;
  ownerId: string;
  groupId: string | null;
  memberIds: string[];
}

export interface ActivityReaction {
  id: string;
  ownerId: string;
  activityDate: string;
  authorId: string;
  emoji: string;
}

export interface ActivityComment {
  id: string;
  ownerId: string;
  activityDate: string;
  authorId: string;
  body: string;
  createdAt: string;
}
