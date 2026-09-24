import Image from "next/image";
import Link from "next/link";

const SOCIAL = [
  { name: "X / Twitter", href: "https://x.com", icon: XIcon },
  { name: "LinkedIn", href: "https://www.linkedin.com", icon: LinkedInIcon },
  { name: "YouTube", href: "https://www.youtube.com", icon: YouTubeIcon },
  { name: "Discord", href: "https://discord.com", icon: DiscordIcon },
  { name: "Telegram", href: "https://t.me", icon: TelegramIcon },
];

const COLUMNS = [
  {
    title: "Course",
    accent: true,
    links: [
      { label: "Auditing Course", href: "/markets" },
      { label: "Best Auditing Courses", href: "/markets" },
      { label: "SCH Lite", href: "/markets" },
      { label: "Cairo Course", href: "/markets" },
      { label: "Free Trial", href: "/markets" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "Competitions & Bounties", href: "/markets" },
      { label: "CTF Library", href: "/markets" },
      { label: "Audit Cost Estimator", href: "/markets" },
      { label: "Audit Checklist", href: "/markets" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "All Articles", href: "/incidents/flash-loans-attacks" },
      { label: "Security Guides", href: "/incidents/flash-loans-attacks" },
      { label: "Auditor FAQ", href: "/markets" },
      { label: "Cairo Security Guide", href: "/markets" },
      { label: "Career Guide", href: "/markets" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Resource Hub", href: "/incidents/flash-loans-attacks" },
      { label: "Attacks Library", href: "/incidents/flash-loans-attacks" },
      { label: "Security Glossary", href: "/markets" },
      { label: "OWASP Top 10 (2026)", href: "/markets" },
      { label: "Quarterly Exploit", href: "/incidents/flash-loans-attacks" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Me / Platform", href: "/markets" },
      { label: "Contact", href: "/markets" },
      { label: "Verify Contacts", href: "/markets" },
      { label: "Terms of Service", href: "/markets" },
      { label: "Privacy Policy", href: "/markets" },
    ],
  },
];

const FOOTER_NAV_LINK_CLASS =
  "inline-block text-[13px] text-white no-underline decoration-cyan-400/70 underline-offset-4 transition-colors duration-200 hover:text-cyan-400 hover:underline focus-visible:text-cyan-400 focus-visible:underline active:text-cyan-400 active:underline";

export default function Footer() {
  return (
    <footer className="relative mt-4 w-full bg-[#05080f] text-slate-300">
      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
        aria-hidden
      />
      <div className="mx-auto grid w-full max-w-6xl gap-10 overflow-visible px-4 pb-16 pt-12 lg:grid-cols-12 lg:gap-8">
        <div className="overflow-visible lg:col-span-3">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-cyan-400 via-sky-400 to-violet-500 p-[2px] shadow-[0_0_28px_rgba(34,211,238,0.45)]">
              <div className="overflow-hidden rounded-full bg-[#05080f]">
                <Image
                  src="/images/my-profile.jpg"
                  alt="Foto profil MEV ARB"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover"
                />
              </div>
            </div>
            <p className="text-base font-bold tracking-tight text-white">MEV ARB</p>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-6 text-slate-400">
            Elite training to break and secure smart contracts. Join 2,000+ auditors mastering
            blockchain security.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {SOCIAL.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.name}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-700/80 bg-slate-900/80 text-white transition-colors duration-200 hover:border-cyan-400/50 hover:text-cyan-400 focus-visible:text-cyan-400 active:text-cyan-300"
              >
                <item.icon />
              </a>
            ))}
          </div>
          <p className="mt-5 text-sm font-semibold text-gray-400">Disclaimer</p>
          <p className="mt-1.5 text-left leading-5 text-gray-400">
            <span className="block text-[11px] tracking-tight max-md:whitespace-normal md:whitespace-nowrap xl:text-xs">
              Perdagangan bitcoin dan aset kripto memiliki peluang dan resiko yang tinggi. Pastikan
              Anda menggunakan pertimbangan yang matang dalam membuat keputusan jual dan beli aset
              Anda.
            </span>
            <span className="block text-[11px] tracking-tight max-md:whitespace-normal md:whitespace-nowrap xl:text-xs">
              MevArb tidak memaksakan pengguna untuk melakukan transaksi jual beli dan semua
              keputusan jual beli aset uang digital Anda adalah keputusan Anda sendiri dan tidak
              dipengaruhi oleh pihak manapun.
            </span>
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-9 lg:grid-cols-5" aria-label="Footer">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                {column.title}
              </p>
              <div
                className={`mt-2 h-px w-8 ${
                  column.accent
                    ? "bg-gradient-to-r from-cyan-400 to-violet-500"
                    : "bg-violet-500/40"
                }`}
              />
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className={FOOTER_NAV_LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M18.9 2.4h3.3l-7.2 8.2L23.4 21.6h-6.6l-5.2-6.8-5.9 6.8H2.4l7.7-8.8L.9 2.4h6.8l4.7 6.2 6.5-6.2Zm-1.2 17.3h1.8L6.5 4.2H4.5l13.2 15.5Z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M4.98 3.5A2.48 2.48 0 1 1 2.5 6a2.48 2.48 0 0 1 2.48-2.5ZM3.1 8.6h3.76V21H3.1V8.6Zm6.1 0h3.6v1.7h.05c.5-.95 1.73-1.95 3.56-1.95 3.8 0 4.5 2.5 4.5 5.75V21h-3.76v-6.4c0-1.53-.03-3.5-2.13-3.5-2.13 0-2.46 1.66-2.46 3.38V21H9.2V8.6Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M23.5 7.2a3.4 3.4 0 0 0-2.4-2.4C19.2 4.4 12 4.4 12 4.4s-7.2 0-9.1.4A3.4 3.4 0 0 0 .5 7.2 35.6 35.6 0 0 0 0 12a35.6 35.6 0 0 0 .5 4.8 3.4 3.4 0 0 0 2.4 2.4c1.9.4 9.1.4 9.1.4s7.2 0 9.1-.4a3.4 3.4 0 0 0 2.4-2.4A35.6 35.6 0 0 0 24 12a35.6 35.6 0 0 0-.5-4.8ZM9.6 15.5V8.5L16 12l-6.4 3.5Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M19.3 5.1A17.4 17.4 0 0 0 15 3.7l-.4.8a16 16 0 0 1 3 .9 12.5 12.5 0 0 0-9.2 0 16 16 0 0 1 3-.9l-.4-.8A17.4 17.4 0 0 0 4.7 5.1C2.4 8.5 1.8 11.8 2 15.1A17.6 17.6 0 0 0 7.4 17l.7-1.1a11.4 11.4 0 0 1-1.8-.9l.4-.3c3.5 1.6 7.3 1.6 10.7 0l.4.3c-.6.4-1.2.7-1.8.9l.7 1.1a17.6 17.6 0 0 0 5.4-1.9c.3-3.3-.3-6.6-2.6-10Zm-10.6 7.3c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.6 1.6-1.5 1.6Zm6.6 0c-.8 0-1.5-.7-1.5-1.6s.7-1.6 1.5-1.6 1.5.7 1.5 1.6-.7 1.6-1.5 1.6Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
      <path d="M21.9 4.4 18.4 20.3c-.3 1.1-1 1.4-2 .9l-5.5-4.1-2.7 2.6c-.3.3-.5.5-1.1.5l.4-5.6L17.7 7c.5-.4-.1-.6-.7-.2L6.4 13.4 1 11.7c-1.2-.4-1.2-1.2.2-1.8L20.4 3.3c1-.4 1.8.2 1.5 1.1Z" />
    </svg>
  );
}
