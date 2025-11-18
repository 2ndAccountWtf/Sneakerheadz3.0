// FIX: Removed self-import of 'SoleNetPostType' which caused a declaration conflict.
export type SoleNetPostType = 'chatter' | 'rumor' | 'ad' | 'event' | 'chaos';

export interface SoleNetPost {
  id: string;
  author: SoleNetNpcProfile;
  content: string;
  type: SoleNetPostType;
  likes: number;
  reposts: number;
  timestamp: number;
}

export type DmType = 'flavor' | 'tip' | 'scam' | 'mission';

export interface SoleNetDm {
  id: string;
  sender: SoleNetNpcProfile;
  messages: { text: string; isPlayer: boolean }[];
  type: DmType;
  isRead: boolean;
  timestamp: number;
}

export interface SoleNetNpcProfile {
  id: string;
  handle: string;
  avatarUrl: string;
  type: 'insider' | 'hustler' | 'influencer' | 'chaos-agent' | 'bot';
  accuracy?: number; // for insiders/rumors
  messagePool: {
    chatter: string[];
    rumors: string[];
    dms: string[];
  };
}