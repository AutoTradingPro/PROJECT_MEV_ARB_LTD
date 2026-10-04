export const OPERATOR_CHAINS = ["ethereum", "arbitrum", "polygon", "bsc", "solana"] as const;
export type OperatorChain = (typeof OPERATOR_CHAINS)[number];

export interface ChainPublicStatus {
  id: OperatorChain;
  label: string;
  rpcSet: boolean;
  rpcHost: string;
  keySet: boolean;
}

export interface OperatorPublicSettings {
  minProfitThreshold: string;
  panelPasswordRequired: boolean;
  chains: ChainPublicStatus[];
}
