
// FIX: Export theme-related types so they can be imported from this module.
import type { StoreTheme, TabStyles } from './theme';
import type { Sneaker } from '../types';

// This file references StoreTheme, but the core props remain the same.
// The main change is that `theme` is now a much more detailed object.

export type SceneProps = {
  backgroundRef: string;
  camera: "front" | "isometric" | "counter" | "floor-wall";
  lighting: "bright-white" | "warm" | "neon" | "moody" | "gallery";
  crowdDensity?: number;
  motionParallax?: boolean;
  vfx?: { parallaxDepth?: number; grain?: number; bloom?: number };
};

export type LayoutProps = {
  headerVariant: "bar" | "overhang" | "stacked";
  tabsVariant: "pills" | "underline" | "cards";
  gridColumns: 2|3|4;
  density?: "compact" | "cozy" | "spacious";
  showStaffDock?: boolean;
  showNpcRail?: boolean;
  showPolicies?: boolean;
};

// Data tabs connect to inventory groups
export type ShoeTabProps = {
  id: "new"|"consignment"|"used"|"grails"|"raffle"|"trade"|"backroom"|"fakes";
  label: string;
  inventoryGroupRef: string;
  features?: {
    enableSizeMatrix?: boolean;
    enableLegitCheck?: boolean;
    enableHaggle?: boolean;
    enableTradeIn?: boolean;
  };
  pricingModifier?: { multiplier?: number; feePct?: number };
};

export type PricingProps = {
  taxPct: number;
  consignmentFeePct?: number;
  buybackDiscountPct?: number;
  roundingMode: "floor"|"round"|"ceil";
  dynamicSignals?: ("surge"|"shortage"|"event-bonus"|"market-crash")[];
};

export type PolicyProps = {
  returns?: "none"|"7d-store-credit"|"14d-exchange";
  legitCheck?: { enabled: boolean; fee?: number; accuracyBoost?: number };
  holds?: { allow: boolean; maxHours?: number; depositPct?: number };
  appointments?: { enableTryOn?: boolean; slotMinutes?: number };
};

export type BehaviorProps = {
  queueLength: [number, number];
  interactionOdds?: { preBrowse?: number; preCheckout?: number; postCheckout?: number };
  securityLevel: 0|1|2;
  cleanliness?: "gallery"|"standard"|"grimy";
  toutStyle?: "quiet"|"suggestive"|"pushy";
  queueStyle?: "invisible"|"ghost"|"avatars";
};

export type ShoeStoreNpcProps = {
  staff?: { managerRef?: string; clerkRefs?: string[]; legitCheckerRef?: string };
  ambient?: { min?: number; max?: number; spawnProfiles?: { profileRef: string; weight: number }[] };
  interactionWeights?: {
    haggleInvite?: number; tradePitch?: number; backroomWhisper?: number; celebrityCameo?: number;
  };
};

export type ShoeRiskProps = {
  paymentFraudOdds: { cash: number; card: number; app: number };
  counterfeitIntakeOdds?: number;
  counterfeitOnShelfOdds?: number;
  backdoorOdds?: number;
  auditOdds?: number;
  securityInterventionOdds?: number;
};

export type DropSystemProps = {
  upcoming?: { id: string; modelId: string; startAt: string; stock: number; type: "FCFS"|"Queue"|"Raffle"; sizeBreakdown?: Record<string, number> }[];
  live?: { queueSize: number; antiBotLevel: 0|1|2; perCustomerLimit: number };
  raffle?: { open: boolean; ticketPrice?: number; entryLimit: number; eligibility?: ("localOnly"|"cred>=2"|"inviteOnly")[]; drawAt: string; winOddsModifier?: number };
  appointment?: { enabled: boolean; slotMinutes: number; dailySlots?: number };
};

export type TradeSystemProps = {
  buybackEnabled: boolean;
  appraisalRulesRef?: string;
  baseOfferPctOfMarket: number;
  haggle?: { enable: boolean; sweetSpotRange: [number, number]; triggerPct: number; staffAggressionProfileRef?: string };
  legitCheckOnTrade?: boolean;
  fastCashBonusPct?: number;
};


export type ShoeStoreProps = {
  id: string;
  name: string;
  brandKey: "consignment"|"boutique"|"outlet"|"plug"|"raffle" | "gallery" | "neon" | "arcade" | "cyberpunk" | "luxury" | "lofi" | "retro" | "shady";
  theme: StoreTheme; // Using the detailed theme type
  scene: SceneProps;
  layout: LayoutProps;
  tabs: ShoeTabProps[];
  pricing: PricingProps;
  policies: PolicyProps;
  behavior: BehaviorProps;
  npcs: ShoeStoreNpcProps;
  risk: ShoeRiskProps;
  drops?: DropSystemProps;
  trade?: TradeSystemProps;
  analytics?: { storeKey: string };
  copy?: { tips?: string[]; locale?: string };
  accessibility?: { highContrast?: boolean; largeType?: boolean; motionReduce?: boolean; iconLabels?: boolean };
};

// Hook-specific types
export type UseInventoryOpts = { groupRef: string; page?: number; pageSize?: number; filters?: any; sort?: any };
export type NPCRef = any; // Placeholder for NPC type
export type StoreEvent = any; // Placeholder for StoreEvent type
export type HaggleState = any; // Placeholder for HaggleState type
export type SneakerItem = Sneaker & { price: number; quantity: number };
export type { StoreTheme, TabStyles };
