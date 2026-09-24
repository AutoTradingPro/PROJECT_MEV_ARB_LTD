"use client";

import { useId, type JSX, type ReactNode } from "react";
import type { CryptoAssetId } from "@/lib/pricing/checkout";

function Mark({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5 shrink-0" aria-hidden>
      {children}
    </svg>
  );
}

function UsdtLogo() {
  return (
    <Mark>
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#fff"
        d="M17.4 15.2v-2.1h4.3V9.8H10.3v3.3h4.3v2.1c-3.5.16-6.1.86-6.1 1.7 0 .84 2.6 1.54 6.1 1.7v6.1h2.8v-6.1c3.5-.16 6.1-.86 6.1-1.7 0-.84-2.6-1.54-6.1-1.7Zm0 2.8c-.3.02-.7.03-1.4.03-.7 0-1.1-.01-1.4-.03v-2.3c.28.02.68.03 1.4.03.72 0 1.12-.01 1.4-.03v2.3Z"
      />
    </Mark>
  );
}

function UsdcLogo() {
  return (
    <Mark>
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        fill="#fff"
        d="M16.9 17.7c2.6-.27 3.9-1.2 3.9-2.7 0-1.8-1.6-2.7-4.4-2.9V9.7h-1.8v2.4c-2.6.18-4.3 1.2-4.3 2.9 0 1.7 1.4 2.6 4.3 2.8v3.7c-1.5-.1-2.5-.6-3.2-1.2l-.9 1.5c.9.8 2.3 1.4 4.1 1.5v1.8h1.8v-1.8c2.8-.16 4.6-1.22 4.6-3.1 0-1.8-1.4-2.7-4.1-2.95Zm-2.3-3.6c-1.6-.14-2.4-.55-2.4-1.35s.8-1.2 2.4-1.32v2.67Zm2.3 6.4v-2.7c1.7.14 2.6.58 2.6 1.4 0 .8-.9 1.2-2.6 1.3Z"
      />
    </Mark>
  );
}

function EthLogo() {
  return (
    <Mark>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity=".7" d="M16.1 6.4v7.05l6 2.67-6-9.72Z" />
      <path fill="#fff" d="M16.1 6.4 10.1 16.12l6-2.67V6.4Z" />
      <path fill="#fff" fillOpacity=".7" d="M16.1 21.9v3.68l6.01-8.32-6.01 4.64Z" />
      <path fill="#fff" d="M16.1 25.58V21.9l-6-3.64 6 8.32Z" />
      <path fill="#fff" fillOpacity=".4" d="m16.1 20.57 6-3.64-6-2.67v6.31Z" />
      <path fill="#fff" fillOpacity=".6" d="m10.1 16.93 6 3.64v-6.31l-6 2.67Z" />
    </Mark>
  );
}

function SolLogo() {
  const gradId = useId();
  return (
    <Mark>
      <circle cx="16" cy="16" r="16" fill="#000" />
      <defs>
        <linearGradient id={gradId} x1="7" y1="24" x2="25" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M9.6 20.4c.12-.12.28-.18.45-.18h12.3c.28 0 .42.34.22.54l-2.57 2.57c-.12.12-.28.18-.45.18H7.25c-.28 0-.42-.34-.22-.54l2.57-2.57Zm0-11.44c.12-.12.28-.18.45-.18h12.3c.28 0 .42.34.22.54l-2.57 2.57c-.12.12-.28.18-.45.18H7.25c-.28 0-.42-.34-.22-.54l2.57-2.57Zm12.97 5.54c-.12-.12-.28-.18-.45-.18H9.82c-.28 0-.42.34-.22.54l2.57 2.57c.12.12.28.18.45.18h12.3c.28 0 .42-.34.22-.54l-2.57-2.57Z"
      />
    </Mark>
  );
}

const LOGOS: Record<CryptoAssetId, () => JSX.Element> = {
  usdt: UsdtLogo,
  usdc: UsdcLogo,
  eth: EthLogo,
  sol: SolLogo,
};

export default function CryptoAssetLogo({ id }: { id: CryptoAssetId }) {
  const Logo = LOGOS[id];
  return <Logo />;
}
