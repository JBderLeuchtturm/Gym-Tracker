import type { NutritionShare, ProgressShare, ShareScope, WeightShare } from './sharePayload';

export interface RemoteProfile {
  id: string;
  handle: string;
  display_name: string;
  emoji: string;
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
