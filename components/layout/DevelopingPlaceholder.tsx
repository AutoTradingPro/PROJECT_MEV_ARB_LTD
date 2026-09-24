interface DevelopingPlaceholderProps {
  menuLabel: string;
  subLabel?: string;
}

export default function DevelopingPlaceholder({
  menuLabel,
  subLabel,
}: DevelopingPlaceholderProps) {
  const headline = subLabel
    ? `Halaman ${menuLabel} · ${subLabel}`
    : `Halaman ${menuLabel}`;

  const message = subLabel
    ? `Modul ${subLabel} untuk ${menuLabel} sedang dalam pengembangan.`
    : `Halaman ${menuLabel} sedang dalam pengembangan.`;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-20">
      <div className="w-full max-w-md space-y-4">
        <div className="h-px w-16 mx-auto bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{headline}</h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">{message}</p>
        <p className="text-[11px] font-mono text-slate-600 pt-2">
          MEV ARB · Institutional Portal
        </p>
      </div>
    </div>
  );
}
