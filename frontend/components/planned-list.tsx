import { cn } from "@/lib/utils";

export function PlannedList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-3 text-sm text-muted", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-relaxed">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent shadow-glow" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
