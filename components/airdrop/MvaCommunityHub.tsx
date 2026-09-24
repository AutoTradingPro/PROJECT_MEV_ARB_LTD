const CHANNELS = [
  {
    id: "x",
    name: "X (Twitter)",
    handle: "x.com",
    statValue: "230+",
    statLabel: "Twitter Followers",
    badge: "Followers",
    copy: "Daily updates, market intelligence, and community announcements.",
    cta: "Follow on X",
    href: "https://x.com",
    icon: XIcon,
  },
  {
    id: "discord",
    name: "Discord",
    handle: "discord.com",
    statValue: "100+",
    statLabel: "Discord Members",
    badge: "Members",
    copy: "Real-time community discussions, alpha channels, and governance.",
    cta: "Join Discord",
    href: "https://discord.com",
    icon: DiscordGamepadIcon,
  },
  {
    id: "telegram",
    name: "Telegram",
    handle: "t.me",
    statValue: "200+",
    statLabel: "Telegram Members",
    badge: "Members",
    copy: "Instant announcements, treasury updates, and holder community.",
    cta: "Join Telegram",
    href: "https://t.me",
    icon: TelegramIcon,
  },
  {
    id: "youtube",
    name: "YouTube",
    handle: "youtube.com",
    statValue: "LIVE",
    statLabel: "YouTube",
    badge: "Videos",
    copy: "Educational market insights, ecosystem updates, and community videos.",
    cta: "Watch on YouTube",
    href: "https://www.youtube.com",
    icon: YouTubeIcon,
  },
  {
    id: "tiktok",
    name: "TikTok",
    handle: "tiktok.com",
    statValue: "LIVE",
    statLabel: "TikTok",
    badge: "Followers",
    copy: "Short-form content, community highlights, and ecosystem announcements.",
    cta: "Follow on TikTok",
    href: "https://www.tiktok.com",
    icon: TikTokIcon,
  },
  {
    id: "facebook",
    name: "Facebook",
    handle: "facebook.com",
    statValue: "LIVE",
    statLabel: "Facebook",
    badge: "Followers",
    copy: "Community updates, campaign highlights, and holder conversations.",
    cta: "Follow on Facebook",
    href: "https://www.facebook.com",
    icon: FacebookIcon,
  },
] as const;

const linkAttrs = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export default function MvaCommunityHub() {
  return (
    <section
      id="community-hub"
      className="relative mt-14 overflow-hidden rounded-[28px] border border-amber-500/15 bg-black px-4 py-12 sm:px-8 sm:py-16"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at 50% 0%, rgba(245,197,24,0.12), transparent 58%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl">
        <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
          <span className="text-white">COMMUNITY </span>
          <span className="text-[#F5C400]">HUB</span>
        </h2>
        <div className="relative mx-auto mt-4 h-px w-full max-w-xl bg-gradient-to-r from-transparent via-amber-400/70 to-transparent">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400" />
        </div>
        <p className="mx-auto mt-5 max-w-xl text-center font-serif text-[13px] italic leading-relaxed text-zinc-400 sm:text-sm">
          A global community of MVA builders. Disciplined minds. Aligned vision. Built as one.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {CHANNELS.map((channel) => (
            <a
              key={channel.id}
              href={channel.href}
              {...linkAttrs}
              aria-label={`${channel.statLabel} — open ${channel.name}`}
              className="group rounded-2xl border border-amber-500/20 bg-[#080808]/90 px-3 py-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/55 hover:shadow-[0_0_24px_rgba(245,196,0,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <p className="text-lg font-black tracking-tight text-[#F5C400] sm:text-xl">
                {channel.statValue}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 group-hover:text-zinc-300">
                {channel.statLabel}
              </p>
              <span className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                live
              </span>
            </a>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <article
                key={channel.id}
                className="flex h-full flex-col rounded-[22px] border border-amber-500/20 bg-[#080808]/90 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_0_28px_rgba(245,196,0,0.14)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center text-[#F5C400]">
                    <Icon />
                  </span>
                  <span className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      LIVE
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                      {channel.badge}
                    </span>
                  </span>
                </div>

                <h3 className="mt-5 text-[13px] font-black uppercase tracking-[0.12em] text-[#E8B40C]">
                  {channel.name}
                </h3>
                <p className="mt-1 text-[12px] font-medium text-amber-200/70">{channel.handle}</p>
                <p className="mt-3 flex-1 text-[12px] leading-relaxed text-zinc-400">{channel.copy}</p>

                <a
                  href={channel.href}
                  {...linkAttrs}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-amber-500/45 bg-transparent px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200 transition-all duration-200 hover:border-amber-300 hover:bg-amber-500/10 hover:text-amber-100 hover:shadow-[0_0_20px_rgba(245,196,0,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {channel.cta}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
      <path d="M18.9 2.4h3.3l-7.2 8.2L23.4 21.6h-6.6l-5.2-6.8-5.9 6.8H2.4l7.7-8.8L.9 2.4h6.8l4.7 6.2 6.5-6.2Zm-1.2 17.3h1.8L6.5 4.2H4.5l13.2 15.5Z" />
    </svg>
  );
}

function DiscordGamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <path
        d="M8 9.5h.01M16 9.5h.01M7.2 15.2 5.5 17M16.8 15.2 18.5 17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.8 6.5h8.4c2.4 0 4.3 1.9 4.3 4.2v2.6c0 2.3-1.9 4.2-4.3 4.2H7.8c-2.4 0-4.3-1.9-4.3-4.2V10.7c0-2.3 1.9-4.2 4.3-4.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8.2 12.2v-2.4M7 11h2.4M15.2 10.2v.05M17 10.2v.05M16.1 9.2v.05M16.1 11.2v.05"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
      <path d="M21.9 4.4 18.4 20.3c-.3 1.1-1 1.4-2 .9l-5.5-4.1-2.7 2.6c-.3.3-.5.5-1.1.5l.4-5.6L17.7 7c.5-.4-.1-.6-.7-.2L6.4 13.4 1 11.7c-1.2-.4-1.2-1.2.2-1.8L20.4 3.3c1-.4 1.8.2 1.5 1.1Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="4" fill="currentColor" />
      <path d="M10.2 9.2v5.6L15.4 12 10.2 9.2Z" fill="#050505" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
      <path d="M14.2 3h2.1c.3 1.7 1.3 3.2 2.8 4.1 1 .6 2.1.9 3.2.9v2.2c-1.6 0-3.1-.5-4.4-1.3v6.6c0 3.5-2.8 6.4-6.4 6.5-3.5 0-6.4-2.9-6.4-6.5S8 8.9 11.5 8.9c.3 0 .6 0 .9.1v2.3c-.3-.1-.6-.1-.9-.1-2.3 0-4.1 1.9-4.1 4.2s1.8 4.2 4.1 4.2 4.1-1.9 4.1-4.2V3Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
      <path d="M14.3 21.5v-7.4h2.5l.4-3h-2.9V9.2c0-.9.2-1.5 1.5-1.5h1.5V5c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2.2H8.5v3h2.7v7.4h3.1Z" />
    </svg>
  );
}
