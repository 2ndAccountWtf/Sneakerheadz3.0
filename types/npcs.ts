
// FIX: Import Scenario from a single source of truth (`types/interactions`) to resolve type conflicts.
import type { Scenario } from './interactions';

// Dialogue, events, etc.
export interface DialogueTree {
  // A dictionary where keys are interaction types (e.g., 'greeting')
  // and values are arrays of possible dialogue strings.
  [key: string]: string[];
}
export type CelebrityDialogue = DialogueTree;


export interface StoreEventTrigger {
  id: string;
  eventType: string; // e.g., 'MARKET_SURGE', 'DISTRACTION'
  weight: number; // Probability weight for this event to trigger
  dialogueRef: string; // Key in the DialogueTree to use when this triggers
  payload?: Record<string, any>; // Data for the event, e.g., { multiplier: 1.25 }
}

// NOTE: Scenario-related types (Scenario, ScenarioNode, etc.) are now imported from `types/interactions.ts`
// to ensure type consistency across the application. The local definitions have been removed.

// FIX: Changed from union of arrays to array of unions to allow mixing types
export type CelebrityInteractions = (StoreEventTrigger | Scenario)[];


// The main celebrity profile structure
export interface CelebrityProfile {
  id: string;
  name: string;
  bio: string;
  // FIX: Added 'portraitUrl' to the CelebrityProfile to support NPC portraits.
  portraitUrl: string;
  spawnConditions: {
    minPlayerNetWorth?: number;
    storeBrandKeys?: string[]; // e.g., ['luxury', 'gallery']
    cityIds?: string[]; // e.g., ['new-york', 'los-angeles']
  };
  eventTriggers?: CelebrityInteractions;
  dialogue: CelebrityDialogue;
}
