export default function AdsManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Ads Manager</h1>
      </div>
      {children}
    </div>
  );
}
