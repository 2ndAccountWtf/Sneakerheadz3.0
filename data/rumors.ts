import { RumorTemplate } from '../types/rumors';

export const RUMOR_TEMPLATES: RumorTemplate[] = [
    // --- GENERIC RUMORS (ALL CITIES) ---
    {
        id: 'generic-restock',
        text: "Word on the street is a major shipment of {sneaker_name} just cleared customs. Might see a price drop soon.",
        type: 'Intel Drop',
        cityIds: ['tokyo', 'new-york', 'los-angeles', 'paris', 'chicago', 'tel-aviv'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'collapse', magnitude: 0.85, durationHrs: 24, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
    {
        id: 'generic-podcast-hype',
        text: "Some podcaster was ranting about {sneaker_name} again. Hypebeasts are eating it up.",
        type: 'Gossip',
        cityIds: ['tokyo', 'new-york', 'los-angeles', 'paris', 'chicago', 'tel-aviv'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.20, durationHrs: 12, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
    {
        id: 'generic-fakes',
        text: "Careful out there, a batch of super-convincing fake {sneaker_name} is making the rounds.",
        type: 'News',
        cityIds: ['tokyo', 'new-york', 'los-angeles', 'paris', 'chicago', 'tel-aviv'],
    },

    // --- TOKYO ---
    {
        id: 'tokyo-tech-collab',
        text: "Rumor is that a local tech giant is doing a stealth collab on the {sneaker_name}. Prices are already moving.",
        type: 'Gossip',
        cityIds: ['tokyo'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.30, durationHrs: 48, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
    {
        id: 'tokyo-vending-machine',
        text: "Someone found a secret sneaker vending machine in Akihabara dispensing {sneaker_name} for cheap. Probably a myth.",
        type: 'Gossip',
        cityIds: ['tokyo'],
    },
     {
        id: 'tokyo-harajuku-trend',
        text: "The Harajuku kids have suddenly decided that {sneaker_rarity} sneakers are out. Market might dip.",
        type: 'News',
        cityIds: ['tokyo'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'collapse', magnitude: 0.90, durationHrs: 24, target: { kind: 'rarity', value: 'Uncommon' } }
        }
    },

    // --- NEW YORK ---
    {
        id: 'ny-wall-street-bonus',
        text: "Wall Street bonuses just hit. All the finance bros are panic-buying {sneaker_rarity} kicks to celebrate.",
        type: 'News',
        cityIds: ['new-york'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.25, durationHrs: 24, target: { kind: 'rarity', value: 'Rare' } }
        }
    },
    {
        id: 'ny-subway-performer',
        text: "Saw a subway performer dancing in a pair of mint-condition {sneaker_name}. The crowd was going wild.",
        type: 'Sighting',
        cityIds: ['new-york'],
    },

    // --- LOS ANGELES ---
    {
        id: 'la-celebrity-sighting',
        text: "Paparazzi just snapped a photo of a huge movie star wearing {sneaker_name} while getting coffee. Expect prices to moon.",
        type: 'Sighting',
        cityIds: ['los-angeles'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.50, durationHrs: 12, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
    {
        id: 'la-movie-prop',
        text: "Heard a warehouse that stores movie props got broken into. A bunch of {sneaker_name} used in that new sci-fi flick are supposedly on the black market now.",
        type: 'Intel Drop',
        cityIds: ['los-angeles'],
    },

    // --- TEL AVIV ---
    {
        id: 'tel-aviv-startup-tech',
        text: "A local startup just announced new 'smart lace' tech. They used {sneaker_name} in the demo, and now everyone wants a pair.",
        type: 'News',
        cityIds: ['tel-aviv'],
         potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.15, durationHrs: 72, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
    {
        id: 'tel-aviv-beach-trend',
        text: "The trend on Gordon Beach is shifting. Everyone's ditching their {sneaker_rarity} kicks for something more low-key.",
        type: 'Gossip',
        cityIds: ['tel-aviv'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'collapse', magnitude: 0.80, durationHrs: 48, target: { kind: 'rarity', value: 'Rare' } }
        }
    },

    // --- PARIS ---
    {
        id: 'paris-fashion-week',
        text: "A model was spotted wearing beat-up {sneaker_name} at a Fashion Week afterparty. The irony is driving the price through the roof.",
        type: 'Sighting',
        cityIds: ['paris'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'surge', magnitude: 1.40, durationHrs: 24, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },

    // --- CHICAGO ---
    {
        id: 'chicago-sports-legend',
        text: "A Chicago basketball legend just gave an interview where he trashed the {sneaker_name}, calling them 'overrated'. Local market is taking a hit.",
        type: 'News',
        cityIds: ['chicago'],
        potentialEffect: {
            type: 'marketSignal',
            payload: { effect: 'collapse', magnitude: 0.75, durationHrs: 48, target: { kind: 'model', value: '{sneaker_id}' } }
        }
    },
];
