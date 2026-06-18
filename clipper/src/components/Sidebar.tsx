import {
  Inbox,
  Pin,
  Star,
  Type,
  Image as ImageIcon,
  Code2,
  Link2,
  File,
  Settings as SettingsIcon,
  Pause,
  Play,
  Sparkles,
  Calendar,
  Flame,
  Sun,
  History,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityHeatmap } from "./ActivityHeatmap";
import type { Stats, TimeRange, SortMode, AIProvider } from "@/types";

export type FilterKey =
  | "all"
  | "pinned"
  | "favorites"
  | "text"
  | "image"
  | "code"
  | "url"
  | "file";

interface SidebarProps {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  sort: SortMode;
  setSort: (s: SortMode) => void;
  stats: Stats | null;
  categories: string[];
  activeCategory: string | null;
  setActiveCategory: (c: string | null) => void;
  monitorPaused: boolean;
  togglePause: () => void;
  openSettings: () => void;
  openCategories: () => void;
  aiOnline: boolean;
  aiProvider: AIProvider;
}

const itemBase =
  "group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium w-full text-left transition-colors";

export function Sidebar({
  filter,
  setFilter,
  timeRange,
  setTimeRange,
  sort,
  setSort,
  stats,
  categories,
  activeCategory,
  setActiveCategory,
  monitorPaused,
  togglePause,
  openSettings,
  openCategories,
  aiOnline,
  aiProvider,
}: SidebarProps) {
  const items: { key: FilterKey; label: string; icon: any; count?: number }[] = [
    { key: "all", label: "Tout", icon: Inbox, count: stats?.total },
    { key: "pinned", label: "Épinglés", icon: Pin, count: stats?.pinned },
    { key: "favorites", label: "Favoris", icon: Star, count: stats?.favorites },
  ];

  const kinds: { key: FilterKey; label: string; icon: any; count?: number }[] = [
    { key: "text", label: "Texte", icon: Type, count: stats?.text },
    { key: "code", label: "Code", icon: Code2, count: stats?.code },
    { key: "url", label: "Liens", icon: Link2, count: stats?.url },
    { key: "image", label: "Images", icon: ImageIcon, count: stats?.image },
    { key: "file", label: "Fichiers", icon: File, count: stats?.file },
  ];

  const timeRanges: { key: NonNullable<TimeRange>; label: string; icon: any }[] = [
    { key: "today", label: "Aujourd'hui", icon: Sun },
    { key: "yesterday", label: "Hier", icon: History },
    { key: "week", label: "Cette semaine", icon: Calendar },
    { key: "month", label: "Ce mois", icon: CalendarDays },
    { key: "year", label: "Cette année", icon: CalendarDays },
  ];

  return (
    <aside
      className="w-[232px] shrink-0 h-full border-r border-ink-700/60 bg-ink-900/40 flex flex-col"
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="relative">
          <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(190,242,100,0.6)]">
            <Sparkles size={15} className="text-ink-950" strokeWidth={2.5} />
          </div>
        </div>
        <div className="leading-tight">
          <div className="font-display font-medium text-[15px] text-ink-50 tracking-tight">
            Clipper
          </div>
          <div className="text-[10px] text-ink-400 font-mono">v1.5.0</div>
        </div>
      </div>

      {/* Lists */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        <div>
          <SectionTitle>Bibliothèque</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {items.map((it) => (
              <NavBtn
                key={it.key}
                onClick={() => {
                  setFilter(it.key);
                  setActiveCategory(null);
                }}
                active={filter === it.key && !activeCategory}
                icon={it.icon}
                label={it.label}
                count={it.count}
                testid={`nav-${it.key}`}
              />
            ))}
            <NavBtn
              onClick={() => setSort(sort === "popular" ? "recent" : "popular")}
              active={sort === "popular"}
              icon={Flame}
              label="Populaires"
              testid="nav-popular"
            />
          </div>
        </div>

        <div>
          <SectionTitle>Activité</SectionTitle>
          <div className="mt-1 px-2">
            <ActivityHeatmap
              selectedDate={isExplicitDate(timeRange) ? timeRange : null}
              onPick={(d) => setTimeRange(d)}
              refreshKey={stats?.total ?? 0}
            />
          </div>
          <div className="space-y-0.5 mt-2">
            {timeRanges.map((tr) => (
              <NavBtn
                key={tr.key}
                onClick={() => setTimeRange(timeRange === tr.key ? null : tr.key)}
                active={timeRange === tr.key}
                icon={tr.icon}
                label={tr.label}
                testid={`time-${tr.key}`}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Types</SectionTitle>
          <div className="space-y-0.5 mt-1">
            {kinds.map((it) => (
              <NavBtn
                key={it.key}
                onClick={() => {
                  setFilter(it.key);
                  setActiveCategory(null);
                }}
                active={filter === it.key && !activeCategory}
                icon={it.icon}
                label={it.label}
                count={it.count}
                testid={`nav-${it.key}`}
              />
            ))}
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2">
              <SectionTitle>Catégories</SectionTitle>
              <button
                onClick={openCategories}
                data-testid="open-categories-manager"
                title="Gérer catégories & tags"
                className="text-ink-400 hover:text-lime-500 text-[14px] leading-none"
              >
                ⋯
              </button>
            </div>
            <div className="space-y-0.5 mt-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setFilter("all");
                  }}
                  data-testid={`category-${cat}`}
                  className={cn(
                    itemBase,
                    activeCategory === cat
                      ? "bg-ink-700/60 text-ink-50"
                      : "text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-500" />
                  <span className="truncate">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {categories.length === 0 && (
          <div>
            <SectionTitle>Catégories</SectionTitle>
            <button
              onClick={openCategories}
              data-testid="open-categories-manager-empty"
              className={cn(itemBase, "text-ink-400 hover:text-lime-500 italic mt-1")}
            >
              <span className="text-[14px] leading-none">+</span>
              <span>Créer une catégorie</span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer — AI status only (Pause & Settings live in TitleBar to avoid duplication) */}
      <div className="px-3 py-3 border-t border-ink-700/60">
        <div className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              aiOnline ? "bg-lime-500 animate-pulse-slow" : "bg-ink-500"
            )}
          />
          <span className="text-ink-400">
            {aiStatusLabel(aiProvider, aiOnline)}
          </span>
          {monitorPaused && (
            <span className="ml-auto text-[10px] text-amber-400 font-mono uppercase tracking-wider">
              en pause
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}

function isExplicitDate(t: TimeRange): t is string {
  return typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t);
}

function aiStatusLabel(provider: AIProvider, online: boolean): string {
  if (!online) {
    switch (provider) {
      case "openai":
        return "OpenAI — clé manquante";
      case "anthropic":
        return "Claude — clé manquante";
      default:
        return "Ollama hors-ligne";
    }
  }
  switch (provider) {
    case "openai":
      return "OpenAI · prêt";
    case "anthropic":
      return "Claude · prêt";
    default:
      return "Ollama local · prêt";
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-500">
      {children}
    </div>
  );
}

function NavBtn({
  onClick,
  active,
  icon: Icon,
  label,
  count,
  testid,
}: {
  onClick: () => void;
  active: boolean;
  icon: any;
  label: string;
  count?: number;
  testid: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={cn(
        itemBase,
        active
          ? "bg-ink-700/60 text-ink-50"
          : "text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"
      )}
    >
      <Icon size={14} className={active ? "text-lime-500" : ""} />
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="text-[10.5px] font-mono text-ink-500 tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
