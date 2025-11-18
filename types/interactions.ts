
// The state of an active conversation modal
export interface ActiveInteractionState {
    npcId: string;
    scenarioId: string;
    currentNodeId: string;
}

// Data structure for a player's choice in a dialogue
export interface ScenarioChoice {
  playerLine: string;
  next: string; // The key of the next node in the scenario
}

// Data structure for the outcome of a dialogue path
export interface ScenarioOutcome {
  type: 'combat' | 'inventoryChange' | 'notification' | 'streetCred' | 'statusEffect' | 'reputation' | 'priceMarkup' | 'freebie' | 'marketSignal' | 'stat_change';
  description: string;
  [key: string]: any; // Allows for flexible properties like 'change', 'condition', 'message', etc.
}

// A single point (node) in a conversation tree
export interface ScenarioNode {
  npcLine: string;
  choices?: ScenarioChoice[];
  outcomes?: ScenarioOutcome[];
}

// A complete, self-contained interaction scenario
export interface Scenario {
  id: string; // Unique ID for this scenario, e.g., 'clerk-hummus-convo'
  startNode: 'intro'; // All scenarios must begin with an 'intro' node
  nodes: Record<string, ScenarioNode>;
}

// The profile for an ambient (non-celebrity) NPC
export interface AmbientNpcProfile {
    id: string;
    name: string;
    portraitUrl: string; // URL to a placeholder or actual image
    scenarios: Scenario[];
    // Optional dialogue pool for random greetings/rail text, similar to Celebrities
    dialogue?: Record<string, string[]>; 
}
