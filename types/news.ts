export type NewsAction = "openFeed" | "openStore" | "trackModel" | "dismiss";

export interface NewsItem {
  id: string;
  kind: "market-surge" | "production-surge" | "odd-news" | "celebrity-gossip" | "donald-drip" | "bro-jogan" | "tweet";
  severity?: "low" | "med" | "high" | "wtf";
  title: string;
  body: string;
  icon?: string;
  imageRef?: string;
  tags?: string[];
  cta?: { label: string; action: NewsAction; payload?: any };
  marketSignalId?: string; 
  expiresAt?: number;
  sourceMeta?: { source: "random-engine" | "npc" | "system" | "scripted"; npcId?: string; tweetId?: string };
}

export interface MarketSignal {
    id: string;
    effect: "surge" | "collapse";
    magnitude: number; // surge: 1.2 = +20%, collapse: 0.8 = -20%
    /**
     * Game day the signal stops applying. Signals used to expire on a
     * wall-clock timestamp, which meant a "6 hour" surge outlived every
     * session; expiry is now measured in the same days the player spends.
     */
    expiresOnDay: number;
    targets: { kind: 'model' | 'tag' | 'rarity' | 'global'; value: string }[];
    sourceNewsId: string;
    /** Short human label for the market ticker. */
    label?: string;
}
