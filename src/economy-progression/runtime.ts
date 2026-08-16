import { createEconomyProgressionService, DEFAULT_PURCHASE_CATALOG, type EconomyProgressionService, type PurchaseCatalogItem } from "../../economy-progression/index.ts";

let activeService: EconomyProgressionService | null = null;

export interface CurriculumBalancePort {
  readonly openingCredits: number;
  readonly settlement: Readonly<Record<string, number>>;
  readonly purchaseCosts: Readonly<Record<string, number>>;
  readonly incidentCosts: Readonly<Record<0 | 1 | 2 | 3 | 4, number>>;
  readonly recovery: Readonly<{ readonly floor: number; readonly assistanceAmount: number }>;
}

function curriculumPurchases(balance: CurriculumBalancePort): readonly PurchaseCatalogItem[] {
  const costs: Readonly<Record<string, number | undefined>> = {
    "worker.robot": balance.purchaseCosts.worker2,
    "context.capacity.1": balance.purchaseCosts.contextCapacity1,
    "context.capacity.2": balance.purchaseCosts.contextCapacity2,
    "manager.agent": balance.purchaseCosts.manager,
  };
  return DEFAULT_PURCHASE_CATALOG.map((item) => ({ ...item, cost: costs[item.id] ?? item.cost }));
}

export function createEconomyProgressionProvider(balance?: CurriculumBalancePort): EconomyProgressionService {
  const service = createEconomyProgressionService(balance ? {
    openingBalance: balance.openingCredits,
    settlementConfig: { ...balance.settlement, severityCosts: balance.incidentCosts, recoveryFloor: balance.recovery.floor },
    purchaseCatalog: curriculumPurchases(balance),
    recoveryPolicy: { floor: balance.recovery.floor, assistanceAmount: balance.recovery.assistanceAmount, enabled: true },
  } : {});
  activeService = service;
  return service;
}

export function getActiveEconomyProgressionService(): EconomyProgressionService | null {
  return activeService;
}

export function setActiveEconomyProgressionService(service: EconomyProgressionService | null): void {
  activeService = service;
}
