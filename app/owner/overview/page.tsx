import OwnerNodeFeedControl from "@/components/owner/system/OwnerNodeFeedControl";
import OwnerKillSwitch from "@/components/owner/system/OwnerKillSwitch";
import OwnerServerTerminal from "@/components/owner/system/OwnerServerTerminal";
import OwnerNodeEndpointManager from "@/components/owner/system/OwnerNodeEndpointManager";

export default function OwnerOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black tracking-wide text-slate-100">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Command Center owner — kill switch, Mode Publik/Hemat WSS·RPC, dan FlashLoan & RPC Provider
          per jaringan (Ethereum, Polygon, Arbitrum, Optimism, Avalanche, Solana, Base, BNB
          Chain, Fantom, Linea).
        </p>
      </div>
      <OwnerKillSwitch />
      <OwnerNodeFeedControl />
      <OwnerNodeEndpointManager />
      <OwnerServerTerminal />
    </div>
  );
}
