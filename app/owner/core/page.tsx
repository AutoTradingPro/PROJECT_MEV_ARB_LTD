export default function OwnerCoreRetiredPage() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-300">
      <h1 className="text-xl font-black text-slate-100">MEV Core Engine dipindah</h1>
      <p className="mt-2 text-sm">
        Engine tidak lagi bagian dari dashboard owner. Buka aplikasi mandiri di{" "}
        <a className="text-cyan-300 underline" href="http://127.0.0.1:4100/">
          http://127.0.0.1:4100/
        </a>
        . Login dan register tetap memakai akun webapp utama.
      </p>
    </section>
  );
}
