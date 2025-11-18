import { PricingProps } from '../types/shoestore';

export function usePricing(pricing: PricingProps): {
  priceWithTax: (base: number) => number;
  applyRounding: (value: number) => number;
} {
    const priceWithTax = (base: number): number => {
        return base * (1 + (pricing.taxPct / 100));
    };

    const applyRounding = (value: number): number => {
        switch (pricing.roundingMode) {
            case 'floor': return Math.floor(value);
            case 'ceil': return Math.ceil(value);
            case 'round':
            default: return Math.round(value);
        }
    };
    
    return { priceWithTax, applyRounding };
};
