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

/**
 * Travel event weighting.
 *
 * The no-event chance is down from 55 to 40 because half the categories here
 * are now playable encounters rather than a one-line stub — a quiet flight
 * should be the exception, not the norm.
 */
export const weightsConfig: WeightsConfig = {
  global: {
    noEventChance: 40,
    rareEventThreshold: 92,
    maxEventsPerTrip: 1,
  },
  categories: [
    { id: 'mugging', weight: 24 },
    { id: 'customs', weight: 16 },
    { id: 'grandma', weight: 16 },
    { id: 'yasser-chaos', weight: 14 },
    { id: 'scalper', weight: 12 },
    { id: 'lucky', weight: 12 },
    { id: 'snatch', weight: 16 },
    { id: 'hustle', weight: 14 },
    { id: 'boxman', weight: 14 },
    { id: 'authenticator', weight: 12 },
    { id: 'podcast', weight: 8 },
    { id: 'cart-heist', weight: 13 },
    // ADC turns up constantly. That is the entire point of ADC.
    { id: 'adc', weight: 26 },
  ],
  rare: [
    { id: 'rare-chaos', weight: 55 },
    // You are already on a plane when you travel, so this is the one event
    // that could only ever happen here.
    { id: 'hijack', weight: 45 },
  ],
  bias: {
    byCity: {
      // Where each kind of trouble actually lives.
      'new-york': { snatch: 8, hustle: 6, boxman: 4 },
      'los-angeles': { podcast: 8, authenticator: 4, snatch: 4, adc: 8 },
      'chicago': { hustle: 10, mugging: 4 },
      'tel-aviv': { grandma: 8, boxman: 6 },
      'tokyo': { authenticator: 8, boxman: -4 },
      'paris': { customs: 8, hustle: -8, adc: 6 },
    },
    byTime: {
      night: { mugging: 10, snatch: 8, scalper: -5, authenticator: -6, adc: -10, 'cart-heist': 6 },
      morning: { customs: 5, lucky: 5, hustle: 4 },
      afternoon: { hustle: 6, podcast: 3, adc: 8, 'cart-heist': 5 },
      evening: { boxman: 5, podcast: 4 },
    },
  },
};
