import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  selectedDate: string | null;
  onPick: (date: string | null) => void;
  refreshKey: number;
}

const WEEKS = 8;
const DAYS = 7;
const MONTHS = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

export function ActivityHeatmap({ selectedDate, onPick, refreshKey }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api.histogram(WEEKS * DAYS).then((rows) => {
      const m: Record<string, number> = {};
      for (const [d, n] of rows) m[d] = n;
      setCounts(m);
    });
  }, [refreshKey]);

  const grid = useMemo(() => buildGrid(), []);
  const max = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const daysActive = Object.values(counts).filter((n) => n > 0).length;

  // When there's no activity at all, show a friendlier hint instead of a wall of gray squares.
  if (total === 0) {
    return (
      <div className="mt-1 px-2 py-3 rounded-lg bg-ink-800/30 border border-ink-700/40 text-center">
        <div className="text-[11px] text-ink-300 font-medium">Pas encore d'activité</div>
        <div className="text-[10.5px] text-ink-500 mt-0.5 leading-relaxed">
          Copiez quelque chose — votre rythme s'affichera ici.
        </div>
      </div>
    );
  }

  // Month labels for the columns where a new month starts
  const monthLabels = grid.map((week, wi) => {
    const firstDay = week[0];
    if (wi === 0) return MONTHS[firstDay.getMonth()];
    const prevFirst = grid[wi - 1][0];
    if (firstDay.getMonth() !== prevFirst.getMonth()) return MONTHS[firstDay.getMonth()];
    return "";
  });

  return (
    <div className="mt-1" data-testid="activity-heatmap">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[10.5px] text-ink-400 font-mono">
          {total} clip{total > 1 ? "s" : ""} · {daysActive} jour{daysActive > 1 ? "s" : ""} actif{daysActive > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex gap-[3px] items-start">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[3px] mr-1 mt-[14px]">
          {["L", "", "M", "", "V", "", "D"].map((d, i) => (
            <div key={i} className="h-[12px] text-[8.5px] text-ink-500 font-mono leading-[12px]">
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1">
          {/* Month labels row */}
          <div className="flex gap-[3px] mb-1 h-[10px]">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-[12px] text-[8.5px] text-ink-500 font-mono leading-none">
                {m}
              </div>
            ))}
          </div>
          {/* Heatmap */}
          <div className="flex gap-[3px]">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d) => {
                  const iso = d.toISOString().slice(0, 10);
                  const future = d > new Date();
                  const n = counts[iso] || 0;
                  const intensity = future ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
                  const active = selectedDate === iso;
                  return (
                    <button
                      key={iso}
                      disabled={future || n === 0}
                      onClick={() => onPick(active ? null : iso)}
                      title={future ? "" : `${formatDate(d)} — ${n} clip${n > 1 ? "s" : ""}`}
                      data-testid={`hm-${iso}`}
                      className={cn(
                        "w-[12px] h-[12px] rounded-[3px] transition-all",
                        intensity === -1 && "bg-transparent",
                        intensity === 0 && "bg-ink-800",
                        intensity === 1 && "bg-lime-500/30",
                        intensity === 2 && "bg-lime-500/55",
                        intensity === 3 && "bg-lime-500/80",
                        intensity === 4 && "bg-lime-500",
                        active && "ring-1 ring-ink-50",
                        n > 0 && "hover:scale-125 cursor-pointer"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedDate && (
        <button
          onClick={() => onPick(null)}
          className="mt-2 ml-1 text-[10.5px] text-lime-500 hover:underline font-mono"
          data-testid="hm-clear"
        >
          ✕ effacer la date
        </button>
      )}
    </div>
  );
}

function buildGrid(): Date[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (WEEKS * DAYS - 1));
  const dow = (start.getDay() + 6) % 7;
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
