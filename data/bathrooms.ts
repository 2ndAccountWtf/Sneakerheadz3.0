/**
 * Bathrooms.
 *
 * Once a bathroom emergency can interrupt the core loop, *where* you can
 * resolve it becomes a real strategic layer — so every city gets a handful of
 * options that differ in cost, reliability and dignity. The cheap ones are the
 * ones most likely to be out of order.
 */
export interface Bathroom {
    id: string;
    cityId: string;
    name: string;
    /** Cost in local currency, charged as in-game cash. */
    price: number;
    /** 0..1 chance it is unusable when you arrive. Cheap means unreliable. */
    unreliability: number;
    /** How long it takes to reach, in seconds off the emergency clock. */
    travelSeconds: number;
    /** Quality of the experience. Decides how the resolution line reads. */
    dignity: 1 | 2 | 3 | 4 | 5;
    blurb: string;
    /** Shown when it turns out to be unavailable. */
    closedLine: string;
}

/** Per-city bathrooms, with a few local specials. */
export const BATHROOMS: Bathroom[] = [
    'tokyo', 'tel-aviv', 'new-york', 'los-angeles', 'paris', 'chicago',
].flatMap(cityId => ([
    {
        id: `${cityId}-ampm`,
        cityId,
        name: 'AM/PM Staff Toilet',
        price: 0,
        unreliability: 0.28,
        travelSeconds: 18,
        dignity: 2 as const,
        blurb: 'Technically staff only. The clerk allows it if you make eye contact and look unwell.',
        closedLine: '"Bro. It is being cleaned. I am so sorry. Truly." He is not sorry.',
    },
    {
        id: `${cityId}-mall`,
        cityId,
        name: 'Shopping Mall, Level 2',
        price: 0,
        unreliability: 0.15,
        travelSeconds: 42,
        dignity: 4 as const,
        blurb: 'Clean, well-lit, and on the far side of an entire food court.',
        closedLine: 'CLOSED FOR CLEANING. A man with a mop makes no attempt to hurry.',
    },
    {
        id: `${cityId}-gas`,
        cityId,
        name: 'Petrol Station',
        price: 2,
        unreliability: 0.22,
        travelSeconds: 25,
        dignity: 1 as const,
        blurb: 'You have to ask for the key. The key is attached to a hubcap.',
        closedLine: 'The key is gone. Nobody knows where the key is. Nobody ever has.',
    },
    {
        id: `${cityId}-restaurant`,
        cityId,
        name: 'Restaurant (Customers Only)',
        price: 14,
        unreliability: 0.05,
        travelSeconds: 30,
        dignity: 5 as const,
        blurb: 'Pristine. You will have to buy something first. You will buy something.',
        closedLine: 'The host asks, with real warmth, whether you have a reservation.',
    },
    {
        id: `${cityId}-public`,
        cityId,
        name: 'Public Convenience',
        price: 0,
        unreliability: 0.45,
        travelSeconds: 12,
        dignity: 1 as const,
        blurb: 'Closest. Free. You have heard things about it.',
        closedLine: 'OUT OF ORDER. The sign is laminated, which suggests permanence.',
    },
    {
        id: `${cityId}-hotel`,
        cityId,
        name: 'Hotel Lobby',
        price: 0,
        unreliability: 0.12,
        travelSeconds: 38,
        dignity: 5 as const,
        blurb: 'Walk in like you are staying there. Do not break stride. Do not look at reception.',
        closedLine: 'A concierge intercepts you with a question you cannot answer convincingly.',
    },
] as Bathroom[]));

/** Local colour — one extra option per city, better or worse than the standards. */
BATHROOMS.push(
    {
        id: 'tel-aviv-beach',
        cityId: 'tel-aviv',
        name: 'Beach Changing Rooms',
        price: 0,
        unreliability: 0.35,
        travelSeconds: 20,
        dignity: 1,
        blurb: 'Sand. Everywhere. In places sand should not reach.',
        closedLine: 'A lifeguard is using it as an office and has spread out.',
    },
    {
        id: 'tokyo-konbini',
        cityId: 'tokyo',
        name: 'Konbini Facilities',
        price: 0,
        unreliability: 0.02,
        travelSeconds: 15,
        dignity: 5,
        blurb: 'Immaculate. Heated. Plays music. Restores your faith in civic life.',
        closedLine: 'Briefly occupied. Briefly. You will be fine. You will not be fine.',
    },
    {
        id: 'paris-cafe',
        cityId: 'paris',
        name: 'Café Toilet (Downstairs)',
        price: 1,
        unreliability: 0.2,
        travelSeconds: 28,
        dignity: 2,
        blurb: 'Down a spiral staircase built for a smaller species.',
        closedLine: 'A waiter explains, at length and without hurrying, that it is for customers.',
    },
    {
        id: 'new-york-subway',
        cityId: 'new-york',
        name: 'Subway Restroom',
        price: 0,
        unreliability: 0.6,
        travelSeconds: 10,
        dignity: 1,
        blurb: 'The nearest option by a wide margin. Every other metric is worse.',
        closedLine: 'It has been closed since before you were born.',
    },
    {
        id: 'chicago-bar',
        cityId: 'chicago',
        name: 'Sports Bar, Back Hallway',
        price: 0,
        unreliability: 0.18,
        travelSeconds: 26,
        dignity: 3,
        blurb: 'Past the dartboard, left at the trophy case.',
        closedLine: 'There is a queue. It is not moving. Somebody is on the phone in there.',
    },
    {
        id: 'los-angeles-gym',
        cityId: 'los-angeles',
        name: 'Gym (Day Pass)',
        price: 25,
        unreliability: 0.03,
        travelSeconds: 34,
        dignity: 5,
        blurb: 'They will make you buy a day pass. It is spotless. It has eucalyptus towels.',
        closedLine: 'A trainer wants to talk to you about your goals before letting you past.',
    },
);

export const bathroomsIn = (cityId: string): Bathroom[] =>
    BATHROOMS.filter(b => b.cityId === cityId);
