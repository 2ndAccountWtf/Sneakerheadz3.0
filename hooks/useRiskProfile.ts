import { ShoeRiskProps } from '../types/shoestore';

export function useRiskProfile(storeId: string, risk: ShoeRiskProps): {
  paymentRisk: (method: "cash"|"card"|"app") => number;
  counterfeitRisk: (skipLegitCheck: boolean) => number;
  auditRisk: () => number;
} {
    const paymentRisk = (method: "cash"|"card"|"app"): number => {
        return risk.paymentFraudOdds[method] || 0;
    };

    const counterfeitRisk = (skipLegitCheck: boolean): number => {
        if (skipLegitCheck) {
            return (risk.counterfeitIntakeOdds || 0) + (risk.counterfeitOnShelfOdds || 0);
        }
        return risk.counterfeitOnShelfOdds || 0;
    };

    const auditRisk = (): number => {
        return risk.auditOdds || 0;
    };

    return { paymentRisk, counterfeitRisk, auditRisk };
};
