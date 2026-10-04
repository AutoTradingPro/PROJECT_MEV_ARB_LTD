/** Net tampilan: (pinjaman × spread%) − gas − bribe. Spread 0.16 berarti 0.16%. */
export function netProfitUsdFromSpread(input: {
  loanUsd: number;
  spreadPct: number;
  gasUsd?: number;
  bribeUsd?: number;
}): number {
  const loan = Number(input.loanUsd);
  const spread = Number(input.spreadPct);
  const gas = Number(input.gasUsd);
  const bribe = Number(input.bribeUsd);
  const loanUsd = Number.isFinite(loan) ? loan : 0;
  const spreadPct = Number.isFinite(spread) ? spread : 0;
  const gasUsd = Number.isFinite(gas) && gas > 0 ? gas : 0;
  const bribeUsd = Number.isFinite(bribe) && bribe > 0 ? bribe : 0;
  const net = loanUsd * (spreadPct / 100) - gasUsd - bribeUsd;
  return Number.isFinite(net) ? net : 0;
}
