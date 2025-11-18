export type EventCategory =
  | "mugging" | "scalper" | "grandma" | "customs" | "lucky" | "rare-chaos" | "yasser-chaos";

// FIX: Define and export the missing TravelEventStub interface.
export interface TravelEventStub {
    id: string;
    category: EventCategory;
    rarity: "standard" | "rare";
}
