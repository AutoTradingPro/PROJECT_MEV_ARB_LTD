export default function OwnerSettingsPage() {
  return (
    <div className="theme-panel space-y-2 rounded-2xl p-6">
      <h1 className="text-xl font-black tracking-wide">Pengaturan</h1>
      <p className="text-sm text-slate-400">
        Pengaturan MEV Core Engine ada di aplikasi mandiri{" "}
        <a className="text-cyan-300 underline" href="http://127.0.0.1:4100/">
          http://127.0.0.1:4100/
        </a>
        , bukan di dashboard owner.
      </p>
    </div>
  );
}