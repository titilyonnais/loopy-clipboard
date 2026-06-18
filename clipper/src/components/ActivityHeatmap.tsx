import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  selectedDate: string | null;
  onPick: (date: string | null) => void;
  refreshKey: number;
}

const WEEKS = 12;
const DAYS = 7;

export function ActivityHeatmap({ selectedDate, onPick, refreshKey }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api.histogram(WEEKS * DAYS).then((rows) => {
      const m: Record<string, number> = {};
      for (const [d, n] of rows) m[d] = n;
      setCounts(m);
    });
  }, [refreshKey]);

  const cells = buildGrid();
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="mt-1" data-testid="activity-heatmap">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}
      >
        {cells.map((week, wi) => (
          <div key={wi} className="grid gap-[3px]" style={{ gridTemplateRows: `repeat(${DAYS}, 1fr)` }}>
            {week.map((d) => {
              const iso = d.toISOString().slice(0, 10);
              const future = d > new Date();
              const n = counts[iso] || 0;
              const intensity = future ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
              const active = selectedDate === iso;
              return (
                <button
                  key={iso}
                  disabled={future}
                  onClick={() => onPick(active ? null : iso)}
                  title={future ? "" : `${formatDate(d)} — ${n} clip${n > 1 ? "s" : ""}`}
                  data-testid={`hm-${iso}`}
                  className={cn(
                    "w-[10px] h-[10px] rounded-[2px] transition-all",
                    intensity === -1 && "bg-transparent",
                    intensity === 0 && "bg-ink-800",
                    intensity === 1 && "bg-lime-500/25",
                    intensity === 2 && "bg-lime-500/50",
                    intensity === 3 && "bg-lime-500/75",
                    intensity === 4 && "bg-lime-500",
                    active && "ring-1 ring-ink-50"
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] font-mono text-ink-500">
        <span>{WEEKS} sem.</span>
        <div className="flex items-center gap-1">
          <span>moins</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "w-2 h-2 rounded-[2px]",
                i === 0 && "bg-ink-800",
                i === 1 && "bg-lime-500/25",
                i === 2 && "bg-lime-500/50",
                i === 3 && "bg-lime-500/75",
                i === 4 && "bg-lime-500"
              )}
            />
          ))}
          <span>plus</span>
        </div>
      </div>
    </div>
  );
}

function buildGrid(): Date[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start from (weeks*days - 1) days ago, aligned to start of week
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * DAYS - 1));
  // Align to Monday-start week:
  const dow = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - dow);
  const weeks: Date[][] = [];
  let cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const col: Date[] = [];
    for (let d = 0; d < DAYS; d++) {
      col.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
  }
  return weeks;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
