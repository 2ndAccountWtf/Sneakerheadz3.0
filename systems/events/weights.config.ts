interface WeightsConfig {
  global: {
    noEventChance: number;
    rareEventThreshold: number;
    maxEventsPerTrip: number;
  };
  categories: { id: string; weight: number }[];
  rare: { id: string; weight: number }[];
  bias: {
    byCity: Record<string, Record<string, number>>;
    byTime: Record<string, Record<string, number>>;
  };
}

export const weightsConfig: WeightsConfig = {
  "global": {
    "noEventChance": 55,
    "rareEventThreshold": 90,
    "maxEventsPerTrip": 1
  },
  "categories": [
    { "id": "mugging", "weight": 30 },
    { "id": "customs", "weight": 20 },
    { "id": "grandma", "weight": 20 },
    { "id": "yasser-chaos", "weight": 20 },
    { "id": "scalper", "weight": 15 },
    { "id": "lucky", "weight": 15 }
  ],
  "rare": [
    { "id": "rare-chaos", "weight": 100 }
  ],
  "bias": {
    "byCity": {},
    "byTime": {
      "night": { "mugging": 10, "scalper": -5 },
      "morning": { "customs": 5, "lucky": 5 }
    }
  }
};