export function StubScreen({
  title,
  phase,
  children,
}: {
  title: string;
  phase: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{phase}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function PlannedList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-muted">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-accent">▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
