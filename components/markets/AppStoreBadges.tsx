import type { ReactNode } from "react";

const BADGES = [
  { id: "google-play", label: "Get it on Google Play", Icon: GooglePlayBadge },
  { id: "app-store", label: "Download on the App Store", Icon: AppStoreBadge },
  { id: "galaxy-store", label: "Available on Galaxy Store", Icon: GalaxyStoreBadge },
  { id: "app-gallery", label: "Explore it on AppGallery", Icon: AppGalleryBadge },
  { id: "android", label: "Download for Android", Icon: AndroidBadge },
] as const;

export default function AppStoreBadges() {
  return (
    <nav
      aria-label="Unduh aplikasi"
      className="flex flex-wrap items-center justify-start gap-2.5"
    >
      {BADGES.map(({ id, label, Icon }) => (
        <a
          key={id}
          href="#"
          aria-label={label}
          className="group relative inline-flex shrink-0 rounded-[11px] outline-none transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-amber-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:translate-y-0"
        >
          <span
            className="pointer-events-none absolute -inset-px rounded-[11px] transition-shadow duration-300"
            style={{
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.28) inset, 0 -7px 12px rgba(0,0,0,0.72) inset, 0 6px 0 #050505, 0 14px 10px rgba(0,0,0,0.55), 0 22px 32px rgba(0,0,0,0.45)",
            }}
            aria-hidden
          />
          <span className="relative block overflow-hidden rounded-[11px] border border-white/15 bg-black ring-1 ring-black/70 transition-[box-shadow,filter] duration-300 group-hover:border-white/25 group-hover:shadow-[0_8px_0_#050505,0_28px_40px_rgba(0,0,0,0.7)]">
            <Icon />
          </span>
        </a>
      ))}
    </nav>
  );
}

function BadgeShell({
  children,
  width,
}: {
  children: ReactNode;
  width: number;
}) {
  return (
    <svg
      width={width}
      height={40}
      viewBox={`0 0 ${width} 40`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect width={width} height={40} rx={10} fill="#000" />
      {children}
    </svg>
  );
}

function GooglePlayBadge() {
  return (
    <BadgeShell width={135}>
      <g transform="translate(10 8.2)">
        <path d="M1.05.55 13.4 12.05 1.05 23.5Z" fill="#4285F4" />
        <path d="M13.4 12.05 17.55 9.65 1.05.55Z" fill="#EA4335" />
        <path d="M13.4 12.05 1.05 23.5 17.55 14.45Z" fill="#34A853" />
        <path d="M17.55 9.65 13.4 12.05 17.55 14.45 21.15 12.05Z" fill="#FBBC04" />
      </g>
      <text x="36" y="15.2" fill="#fff" fontSize="6.2" fontFamily="Arial, Helvetica, sans-serif" letterSpacing="0.9">
        GET IT ON
      </text>
      <text x="36" y="29.5" fill="#fff" fontSize="13.4" fontFamily="Arial, Helvetica, sans-serif" fontWeight="600">
        Google Play
      </text>
    </BadgeShell>
  );
}

function AppStoreBadge() {
  return (
    <BadgeShell width={128}>
      <path
        transform="translate(10.2 7.4) scale(0.86)"
        fill="#fff"
        d="M18.07 16.26c-.03-.07-1.76-6.05 3.73-8.99-1.84-2.62-4.66-2.99-5.66-3.03-2.41-.24-4.7 1.42-5.92 1.42-1.24 0-3.16-1.39-5.19-1.35-2.67.04-5.13 1.55-6.5 3.94-2.77 4.81-.71 11.93 1.99 15.83 1.32 1.91 2.89 4.04 4.95 3.96 1.99-.08 2.74-1.28 5.14-1.28 2.38 0 3.07 1.28 5.17 1.24 2.14-.04 3.5-1.94 4.81-3.86 1.52-2.21 2.14-4.35 2.17-4.46-.05-.02-4.17-1.6-4.21-6.42zM15.6 4.41c1.1-1.33 1.84-3.18 1.64-5.03-1.58.06-3.5 1.05-4.63 2.38-.99 1.17-1.86 3.05-1.63 4.85 1.73.13 3.5-.8 4.62-2.2z"
      />
      <text x="34" y="15.2" fill="#fff" fontSize="6.1" fontFamily="Arial, Helvetica, sans-serif">
        Download on the
      </text>
      <text x="34" y="29.2" fill="#fff" fontSize="13.2" fontFamily="Arial, Helvetica, sans-serif" fontWeight="600">
        App Store
      </text>
    </BadgeShell>
  );
}

function GalaxyStoreBadge() {
  return (
    <BadgeShell width={142}>
      <g transform="translate(9.5 8)" fill="none">
        <path
          d="M6.4 4.4h9.7c1.2 0 2.2.9 2.3 2.1l.7 9.2c.1 1.4-1 2.6-2.4 2.6H5.8c-1.4 0-2.5-1.2-2.4-2.6l.7-9.2c.1-1.2 1.1-2.1 2.3-2.1z"
          stroke="#fff"
          strokeWidth="1.55"
        />
        <path d="M8.2 4.2c0-2 1.6-3.6 3.6-3.6s3.6 1.6 3.6 3.6" stroke="#fff" strokeWidth="1.55" />
        <path d="M1.8 10.2h18.9" stroke="#fff" strokeWidth="1.4" />
      </g>
      <text x="36" y="15.2" fill="#fff" fontSize="6.1" fontFamily="Arial, Helvetica, sans-serif">
        Available on
      </text>
      <text x="36" y="29.2" fill="#fff" fontSize="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="600">
        Galaxy Store
      </text>
    </BadgeShell>
  );
}

function AppGalleryBadge() {
  return (
    <BadgeShell width={138}>
      <g transform="translate(19.5 20)">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse
            key={i}
            cx="0"
            cy="-7.1"
            rx="2.15"
            ry="5.15"
            fill="#CF0A2C"
            transform={`rotate(${i * 45})`}
          />
        ))}
        <circle r="2.05" fill="#CF0A2C" />
      </g>
      <text x="36" y="15.2" fill="#fff" fontSize="6.1" fontFamily="Arial, Helvetica, sans-serif">
        Explore it on
      </text>
      <text x="36" y="29.2" fill="#fff" fontSize="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="600">
        AppGallery
      </text>
    </BadgeShell>
  );
}

function AndroidBadge() {
  return (
    <BadgeShell width={148}>
      <g transform="translate(10 7.4)" fill="#3DDC84">
        <path d="M4.2 2.35 3.15.2a.35.35 0 0 1 .62-.32L4.9 2.2a6.3 6.3 0 0 1 6.2 0l1.13-2.32a.35.35 0 0 1 .62.32L11.8 2.35A6.55 6.55 0 0 1 15.3 8.1H.7A6.55 6.55 0 0 1 4.2 2.35z" />
        <circle cx="5.15" cy="5.35" r=".7" fill="#000" />
        <circle cx="10.85" cy="5.35" r=".7" fill="#000" />
        <rect x="0.35" y="9.15" width="15.3" height="10.4" rx="2.1" />
        <rect x="-2.15" y="9.4" width="2.15" height="7.4" rx="1.05" />
        <rect x="16" y="9.4" width="2.15" height="7.4" rx="1.05" />
        <rect x="3.35" y="19.2" width="2.35" height="4.2" rx="1.1" />
        <rect x="10.3" y="19.2" width="2.35" height="4.2" rx="1.1" />
      </g>
      <text x="36" y="15.2" fill="#fff" fontSize="6.1" fontFamily="Arial, Helvetica, sans-serif">
        Download for
      </text>
      <text x="36" y="29.4" fill="#fff" fontSize="14" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" letterSpacing="0.4">
        ANDROID
      </text>
    </BadgeShell>
  );
}
