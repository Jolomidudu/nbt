import type { BusinessType } from "@/game/types";

export interface BusinessDefinition {
  id: BusinessType;
  name: string;
  shortName: string;
  cost: number;
  color: number;
  icon: string;
  description: string;
}

export const BUSINESS_TYPES: Record<BusinessType, BusinessDefinition> = {
  pos: {
    id: "pos",
    name: "POS Kiosk",
    shortName: "POS",
    cost: 20_000,
    color: 0xe6a844,
    icon: "₦",
    description: "A neighborhood cash point, ready for business.",
  },
  provisions: {
    id: "provisions",
    name: "Provision Shop",
    shortName: "MART",
    cost: 35_000,
    color: 0x3fa875,
    icon: "P",
    description: "Everyday essentials for the whole street.",
  },
  food: {
    id: "food",
    name: "Food Stand",
    shortName: "CHOP",
    cost: 45_000,
    color: 0xe56f42,
    icon: "F",
    description: "Hot local favorites, made right on the block.",
  },
};

export const INITIAL_WALLET = 50_000;

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}