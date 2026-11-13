export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
        <p className="text-lg font-medium">Coming soon</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
