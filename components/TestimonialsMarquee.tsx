"use client";

import { useState } from "react";

type Testimonial = {
  name: string;
  handle: string;
  country: string;
  flag: string;
  quote: string;
  photo: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Andi Pratama",
    handle: "@andiprx",
    country: "Indonesia",
    flag: "🇮🇩",
    quote:
      "Spread antar DEX kebaca real-time. Eksekusi flashloan terasa rapi, bukan spekulasi buta.",
    photo: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Camille Laurent",
    handle: "@claurent",
    country: "Prancis",
    flag: "🇫🇷",
    quote:
      "La protection atomique (revert) m’a convaincu. Si ce n’est pas profitable, rien n’est perdu.",
    photo: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Haruto Sato",
    handle: "@haruto_s",
    country: "Jepang",
    flag: "🇯🇵",
    quote: "ガス戦略が透明で、操作ログも追いやすい。機関向けのUIなのに迷わない。",
    photo: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    name: "Aisha Rahman",
    handle: "@aisharhmn",
    country: "Malaysia",
    flag: "🇲🇾",
    quote:
      "Vault plus kill switch make ops feel professional. I stay in control of every send.",
    photo: "https://randomuser.me/api/portraits/women/68.jpg",
  },
  {
    name: "Diego Herrera",
    handle: "@diegohx",
    country: "Spanyol",
    flag: "🇪🇸",
    quote:
      "La interfaz es clara y el flujo flashloan fácil de seguir. Menos ruido, más disciplina.",
    photo: "https://randomuser.me/api/portraits/men/22.jpg",
  },
  {
    name: "Siobhan Kelly",
    handle: "@skelly",
    country: "Irlandia",
    flag: "🇮🇪",
    quote:
      "Finally a desk that doesn’t hide the gas and profit math. Feels built for operators.",
    photo: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  {
    name: "Minh Trần",
    handle: "@minhtr",
    country: "Vietnam",
    flag: "🇻🇳",
    quote:
      "Bot scan nhanh, log dễ đọc. Đúng thứ trader cần khi cơ hội chỉ kéo dài vài khối.",
    photo: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    name: "Omar Al Farsi",
    handle: "@omaralf",
    country: "UEA",
    flag: "🇦🇪",
    quote:
      "Institutional look, execution still under my control. Rescue funds is a serious safety net.",
    photo: "https://randomuser.me/api/portraits/men/51.jpg",
  },
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Avatar({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/80 to-sky-500/80 text-[11px] font-bold text-slate-950"
        aria-hidden
      >
        {initials(name)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-700/80"
      onError={() => setFailed(true)}
    />
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="theme-panel w-[300px] shrink-0 rounded-2xl border border-slate-800/80 p-4 shadow-[0_0_32px_rgba(15,23,42,0.45)]">
      <header className="flex items-center gap-3">
        <Avatar src={item.photo} name={item.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--app-fg)]">{item.name}</p>
          <p className="truncate text-[11px] text-slate-500">{item.handle}</p>
        </div>
      </header>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
        <span aria-hidden className="text-base leading-none">
          {item.flag}
        </span>
        {item.country}
      </p>
      <p className="mt-3 text-[13px] leading-6 text-slate-300">“{item.quote}”</p>
    </article>
  );
}

function Track({ labelled }: { labelled: boolean }) {
  return (
    <div className="flex gap-4 pr-4" aria-hidden={!labelled}>
      {TESTIMONIALS.map((item) => (
        <TestimonialCard key={`${labelled ? "a" : "b"}-${item.handle}`} item={item} />
      ))}
    </div>
  );
}

export default function TestimonialsMarquee() {
  return (
    <section className="relative w-full pb-12 pt-2" aria-label="Testimoni pengguna global">
      <div className="mx-auto mb-5 w-full max-w-6xl px-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/90">
          Global operators
        </p>
        <h2 className="mt-2 text-lg font-black tracking-tight text-amber-300 sm:text-xl">
          Testimoni User Mev Arb
        </h2>
      </div>

        <div className="group relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--app-bg)] to-transparent sm:w-24"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--app-bg)] to-transparent sm:w-24"
          aria-hidden
        />
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          <Track labelled />
          <Track labelled={false} />
        </div>
      </div>
    </section>
  );
}
