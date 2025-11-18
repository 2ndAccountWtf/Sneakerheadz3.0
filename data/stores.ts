
interface StoreInfo {
    id: string;
    name: string;
    description: string;
}

export const STORES_BY_CITY: Record<string, StoreInfo[]> = {
    'tokyo': [
        { id: 'outlet-harajuku-overdrive', name: 'Harajuku Overdrive Outlet', description: 'High-tech outlet with last season\'s drops and rare finds.' },
        { id: 'akihabara-arcade-kicks', name: 'Akihabara Arcade Kicks', description: '90s arcade energy. Buy, sell, and play.' },
        { id: 'shinjuku-shadow-runner', name: 'Shinjuku Shadow Runner', description: 'Dark, disciplined, and dangerous. For serious runners only.' },
    ],
    'tel-aviv': [
        { id: 'jaffa-flea-market', name: 'Jaffa Flea Market Finds', description: 'Crate-digging for retro gems. Bargaining is expected.' },
    ],
    'new-york': [
        { id: 'consign-soho-heat-museum', name: 'SoHo Heat Museum', description: 'A consignment shop for true collectors. Prices are steep.' },
        { id: 'fifth-ave-grails', name: 'Fifth Ave Grails', description: 'High-end luxury and champagne vibes. For the elite.' },
        { id: 'ny-canal-street-tunnel', name: 'Canal St. Tunnels', description: 'Dark, damp, and full of "replicas". Cash only. Watch your back.' },
    ],
    'los-angeles': [
        { id: 'plug-bodega-barrio-la', name: 'Barrio Bodega Plug', description: 'Your friendly neighborhood plug. You never know what you\'ll find.' },
        { id: 'venice-beach-beats', name: 'Venice Beach Beats & Sneakers', description: 'Chill beats, cozy vibes, and mellow kicks.' },
        { id: 'la-gutter-trunk', name: 'Gutter Gabe\'s Trunk', description: 'Literally a car trunk in a back alley. High risk, low prices.' },
    ],
    'paris': [
        { id: 'le-marais-archives', name: 'Le Marais Archives', description: 'A curated selection of avant-garde and luxury sneakers.' },
    ],
    'chicago': [
        { id: 'windy-city-soles', name: 'Windy City Soles', description: 'A shrine to basketball history and the latest performance kicks.' },
    ],
};
