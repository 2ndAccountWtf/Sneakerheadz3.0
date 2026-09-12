
import { StorageItem } from '../types';

export const storageMock: StorageItem[] = [
  {
    id: "itm-frisbee",
    name: "Beach Frisbee",
    type: "weapons",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/frisbee/400/300",
    stats: { power: 20, energy: 0, freshness: 70, risk: 5, wackiness: 70 },
    tags: ["thrown","venice","returns"],
    flavor: "Cuts through a whole row of people and comes home. Physics-adjacent.",
    addedAgo: "5h",
    stackable: true,
  },
  {
    id: "itm-dog-launcher",
    name: "Chicago Dog Launcher",
    type: "weapons",
    rarity: "rare",
    qty: 1,
    img: "https://picsum.photos/seed/doglauncher/400/300",
    stats: { power: 55, energy: 0, freshness: 30, risk: 45, wackiness: 95 },
    tags: ["ranged","chicago","restocked"],
    flavor: "Back in stock. The scooter gang has not recovered.",
    addedAgo: "1d",
  },
  {
    id: "itm-slushie",
    name: "Blue Slushie (Weaponised)",
    type: "weapons",
    rarity: "uncommon",
    qty: 2,
    img: "https://picsum.photos/seed/slushie/400/300",
    stats: { power: 12, energy: 8, freshness: 95, risk: 25, wackiness: 80 },
    tags: ["thrown","slows","the-machine-knows"],
    flavor: "The machine whispers. This is what it wants.",
    addedAgo: "20m",
    stackable: true,
    effects: [
      { type: 'stat_change', payload: { stat: 'energy', value: 8 }, chance: 1.0 },
      { type: 'notification', payload: { message: "Brain freeze. Worth it. Probably." }, chance: 0.6 },
      { type: 'status_effect', payload: { statusId: 'gassy', durationHrs: 1, description: "Too much syrup, too fast." }, chance: 0.15 },
    ],
  },
  {
    id: "itm-longboard",
    name: "Venice Longboard",
    type: "tools",
    rarity: "rare",
    qty: 1,
    img: "https://picsum.photos/seed/longboard/400/300",
    stats: { power: 10, energy: 0, freshness: 60, risk: 30, wackiness: 45 },
    tags: ["vehicle","venice","downhill"],
    flavor: "The difference between chasing a shopping cart and catching one.",
    addedAgo: "3d",
  },
  {
    id: "itm-chocmilk-bag",
    name: "Chocolate Milk (Bag)",
    type: "drinks",
    rarity: "uncommon",
    qty: 3,
    img: "https://picsum.photos/seed/chocmilk/400/300",
    stats: { energy: 12, freshness: 80, risk: 20, power: 0, wackiness: 30 },
    tags: ["ampm","israel","bag-life"],
    flavor: "Classic. Cold. Slightly dangerous.",
    addedAgo: "2h",
    stackable: true,
    effects: [
      {
        type: 'stat_change',
        payload: { stat: 'energy', value: 12 },
        chance: 1.0,
      },
      {
        type: 'status_effect',
        payload: { statusId: 'diarrhea', durationHrs: 2, description: "You have explosive diarrhea. Travel is... risky." },
        chance: 0.2,
      },
      {
        type: 'notification',
        payload: { message: "You sip from the plastic bag. You feel 12 years old again." },
        chance: 1.0
      }
    ],
  },
  {
    id: "itm-baguette",
    name: "Paris Baguette (Melee)",
    type: "weapons",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/baguette/400/300",
    stats: { power: 18, energy: 0, freshness: 40, risk: 5, wackiness: 60 },
    tags: ["melee","crumbs"],
    flavor: "Crust does crit damage at close range.",
    addedAgo: "1d"
  },
  {
    id: "itm-chanclas",
    name: "Chanclas (Homing)",
    type: "weapons",
    rarity: "rare",
    qty: 2,
    img: "https://picsum.photos/seed/chanclas/400/300",
    stats: { power: 40, energy: 0, freshness: 100, risk: 10, wackiness: 85 },
    tags: ["homing","mom-tech"],
    flavor: "Ancient guidance system, zero latency.",
    addedAgo: "3h",
    stackable: true,
  },
  {
    id: "itm-hummus",
    name: "Hummus (Family Size)",
    type: "food",
    rarity: "uncommon",
    qty: 1,
    img: "https://picsum.photos/seed/hummus/400/300",
    stats: { energy: 16, freshness: 90, risk: 8, power: 0, wackiness: 25 },
    tags: ["ampm","spread"],
    flavor: "Smooth, rich, ideologically neutral (for now).",
    addedAgo: "5h",
    effects: [
      {
        type: 'stat_change',
        payload: { stat: 'energy', value: 16 },
        chance: 1.0,
      },
      {
        type: 'notification',
        payload: { message: "You feel gassy. A foul wind blows." },
        chance: 0.3,
      },
      {
        type: 'notification',
        payload: { message: "You wipe the plate clean with your finger. Dignity -5." },
        chance: 1.0
      }
    ]
  },
  {
    id: "itm-haunted-lighter",
    name: "Haunted Gold Lighter",
    type: "tools",
    rarity: "legendary",
    qty: 1,
    img: "https://picsum.photos/seed/lighter/400/300",
    stats: { power: 5, energy: 0, freshness: 0, risk: 40, wackiness: 95 },
    tags: ["bling","curse?"],
    flavor: "Ignites flex, maybe the store.",
    addedAgo: "10m"
  },
  {
    id: "itm-kombucha",
    name: "Artisanal Kombucha",
    type: "drinks",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/kombucha/400/300",
    stats: { energy: 8, freshness: 95, risk: 50, power: 0, wackiness: 70 },
    tags: ["organic","probiotic","explodes?"],
    flavor: "Tastes like wellness and regret.",
    addedAgo: "4h",
    effects: [
      {
        type: 'stat_change',
        payload: { stat: 'energy', value: 8 },
        chance: 1.0,
      },
      {
        type: 'notification',
        payload: { message: "Your gut biome is now a battlefield. Morale improved?" },
        chance: 1.0
      }
    ]
  },
  {
    id: "itm-cursed-totem",
    name: "Cursed Street Totem",
    type: "oddities",
    rarity: "rare",
    qty: 1,
    img: "https://picsum.photos/seed/totem/400/300",
    stats: { power: 0, energy: 0, freshness: 0, risk: 90, wackiness: 100 },
    tags: ["voodoo","bad-vibes"],
    flavor: "Definitely whispers when you're not looking.",
    addedAgo: "1w",
    effects: [
      {
        type: 'notification',
        payload: { message: "The totem hums with a strange energy, but nothing happens." },
        chance: 1.0,
      }
    ]
  },
  // --- NEWLY ADDED ITEMS FROM AMPM ---
  {
    id: "itm-energy-drink",
    name: "Energy Drink",
    type: "drinks",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/energydrink/400/300",
    stats: { energy: 20, freshness: 100, risk: 5, power: 0, wackiness: 10 },
    tags: ["caffeine", "jitters"],
    flavor: "Tastes like battery acid and victory.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'energy', value: 20 }, chance: 1.0 },
        { type: 'notification', payload: { message: "Heart rate is now techno BPM. Vision is vibrating." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-ramen-cup",
    name: "Instant Ramen",
    type: "food",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/ramen/400/300",
    stats: { energy: 10, freshness: 100, risk: 2, power: 0, wackiness: 5 },
    tags: ["cheap", "sodium"],
    flavor: "The official taste of being broke.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'health', value: 10 }, chance: 1.0 },
        { type: 'notification', payload: { message: "You consume the sodium brick. You are now 40% salt." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-burner-phone",
    name: "Burner Phone",
    type: "tools",
    rarity: "uncommon",
    qty: 1,
    img: "https://picsum.photos/seed/burnerphone/400/300",
    stats: { power: 0, energy: 0, freshness: 0, risk: 30, wackiness: 50 },
    tags: ["privacy", "shady"],
    flavor: "For calls you don't want your mom to hear about.",
    addedAgo: "N/A",
  },
   {
    id: "itm-burekas",
    name: "Burekas",
    type: "food",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/burekas/400/300",
    stats: { energy: 15, freshness: 70, risk: 10, power: 0, wackiness: 15 },
    tags: ["pastry", "mystery-filling"],
    flavor: "Flaky, greasy, and deeply satisfying.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'health', value: 15 }, chance: 1.0 },
        { type: 'notification', payload: { message: "Grease coats your soul. You feel comforted and heavy." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-crowbar",
    name: "Ironic Crowbar",
    type: "weapons",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/crowbar/400/300",
    stats: { power: 22, energy: 0, freshness: 0, risk: 15, wackiness: 40 },
    tags: ["melee", "tool"],
    flavor: "For 'leveraging' opportunities.",
    addedAgo: "N/A"
  },
  {
    id: "itm-onigiri",
    name: "Convenience Store Onigiri",
    type: "food",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/onigiri/400/300",
    stats: { energy: 10, freshness: 85, risk: 5, power: 0, wackiness: 10 },
    tags: ["rice", "tokyo"],
    flavor: "A perfect triangle of handheld happiness.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'health', value: 10 }, chance: 1.0 },
        { type: 'notification', payload: { message: "Efficient sustenance consumed. You feel slightly more anime." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-pita-zaatar",
    name: "Pita with Za'atar",
    type: "food",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/zaatar/400/300",
    stats: { energy: 12, freshness: 90, risk: 5, power: 0, wackiness: 20 },
    tags: ["mediterranean", "snack"],
    flavor: "The comforting taste of the Levant.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'health', value: 12 }, chance: 1.0 },
        { type: 'notification', payload: { message: "Crumbs everywhere. Worth it." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-kale-smoothie",
    name: "Kale Smoothie",
    type: "drinks",
    rarity: "common",
    qty: 1,
    img: "https://picsum.photos/seed/kalesmoothie/400/300",
    stats: { energy: 15, freshness: 98, risk: 2, power: 0, wackiness: 65 },
    tags: ["healthy", "painful"],
    flavor: "Tastes like lawn clippings and self-improvement.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'energy', value: 15 }, chance: 1.0 },
        { type: 'notification', payload: { message: "It tastes like punishment. Health +1, Joy -5." }, chance: 1.0 }
    ]
  },
  {
    id: "itm-deep-dish-slice",
    name: "Single Deep-Dish Slice",
    type: "food",
    rarity: "uncommon",
    qty: 1,
    img: "https://picsum.photos/seed/deepdish/400/300",
    stats: { energy: 30, freshness: 80, risk: 15, power: 0, wackiness: 35 },
    tags: ["chicago", "heavy"],
    flavor: "A delicious brick of cheese and bread.",
    addedAgo: "N/A",
    stackable: true,
    effects: [
        { type: 'stat_change', payload: { stat: 'health', value: 30 }, chance: 1.0 },
        { type: 'notification', payload: { message: "You ate a brick of cheese. Movement speed decreased." }, chance: 1.0 }
    ]
  }
];
