export type EventCategory =
  | "mugging"
  | "scalper"
  | "grandma"
  | "customs"
  | "lucky"
  | "rare-chaos"
  | "yasser-chaos"
  // --- Added by the overhaul: the side content that hands off to mini-games ---
  | "snatch"        // sneaker chase
  | "hustle"        // street basketball wager
  | "boxman"        // back-alley mystery box
  | "authenticator" // legit-check booth
  | "podcast";      // Bro Jogan drags you onto the show

export interface TravelEventStub {
    id: string;
    category: EventCategory;
    rarity: "standard" | "rare";
}
