import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type {
  ClipItem,
  Stats,
  Settings as SettingsT,
  TimeRange,
  SortMode,
  AdvancedFilters as AFType,
} from "@/types";
import { SearchBar } from "@/components/SearchBar";
import { Sidebar, type FilterKey } from "@/components/Sidebar";
import { ClipListItem } from "@/components/ClipListItem";
import { Preview } from "@/components/Preview";
import { Settings } from "@/components/Settings";
import { AdvancedFilters, countActive } from "@/components/AdvancedFilters";
import { CategoriesManager } from "@/components/CategoriesManager";
import { cn } from "@/lib/utils";

export default function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>(null);
  const [sort, setSort] = useState<SortMode>("recent");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [advFilters, setAdvFilters] = useState<AFType>({});
  const [advOpen, setAdvOpen] = useState(false);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [monitorPaused, setMonitorPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [aiOnline, setAiOnline] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Initial load + theme
  useEffect(() => {
    document.documentElement.classList.add("no-transition");
    api.getSettings().then((s) => {
      setSettings(s);
      setMonitorPaused(s.monitor_paused);
      applyTheme(s.theme);
      applyCustomization(s);
    });
    api.aiHealth().then((r) => setAiOnline(r.ok));
    requestAnimationFrame(() => document.documentElement.classList.remove("no-transition"));
    const t = setInterval(() => api.aiHealth().then((r) => setAiOnline(r.ok)), 30000);
    return () => clearInterval(t);
  }, []);

  // Reactively apply theme + customization on settings change
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    applyCustomization(settings);
    if (settings.theme === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const handler = () => applyTheme("auto");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [
    settings?.theme,
    settings?.accent_color,
    settings?.font_family,
    settings?.density,
    settings?.show_grain,
  ]);

  const refresh = useCallback(async () => {
    const list = await api.list({
      query: query.trim() || undefined,
      kind: ["text", "image", "code", "url", "file"].includes(filter) ? filter : null,
      category: activeCategory || null,
      pinned_only: filter === "pinned",
      favorites_only: filter === "favorites",
      time_range: timeRange,
      sort,
      ...advFilters,
      limit: 500,
      offset: 0,
    });
    setClips(list);
    if (list.length && (selectedId === null || !list.find((c) => c.id === selectedId))) {
      setSelectedId(list[0].id);
    }
    if (!list.length) setSelectedId(null);
    api.stats().then(setStats);
    api.categories().then(setCategories);
  }, [query, filter, activeCategory, timeRange, sort, advFilters, selectedId]);

  useEffect(() => {
    refresh();
  }, [query, filter, activeCategory, timeRange, sort, advFilters]);

  useEffect(() => {
    const un = listen<ClipItem>("clip:new", () => refresh());
    const un2 = listen<{ id: number }>("clip:updated", () => refresh());
    const un3 = listen<{}>("window:show", () => refresh());
    const un4 = listen<number>("clip:cleared", () => refresh());
    return () => {
      un.then((f) => f());
      un2.then((f) => f());
      un3.then((f) => f());
      un4.then((f) => f());
    };
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (advOpen) setAdvOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else api.hideWindow();
        return;
      }
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea";
      if (e.key === "ArrowDown" && !inField) {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "ArrowUp" && !inField) {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === "Enter") {
        if (selectedId != null) {
          api.copyToClipboard(selectedId);
          api.hideWindow();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const moveSelection = (dir: number) => {
    if (!clips.length) return;
    const idx = clips.findIndex((c) => c.id === selectedId);
    const next = clips[Math.max(0, Math.min(clips.length - 1, idx + dir))];
    if (next) {
      setSelectedId(next.id);
      const el = document.querySelector(`[data-testid="clip-item-${next.id}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  };

  const selected = useMemo(() => clips.find((c) => c.id === selectedId) || null, [clips, selectedId]);
  const advCount = countActive(advFilters);

  const updateClipInList = (c: ClipItem) => {
    setClips((prev) => prev.map((x) => (x.id === c.id ? c : x)));
    api.stats().then(setStats);
    api.categories().then(setCategories);
  };
  const deleteClip = async (id: number) => {
    await api.remove(id);
    setClips((prev) => prev.filter((x) => x.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
    api.stats().then(setStats);
  };
  const togglePause = async () => {
    const next = !monitorPaused;
    setMonitorPaused(next);
    await api.pauseMonitor(next);
    if (settings) setSettings({ ...settings, monitor_paused: next });
  };
  const clearAll = async () => {
    if (!confirm("Effacer tout l'historique (les épinglés sont préservés) ?")) return;
    await api.clearAll(true);
    refresh();
  };

  const activeFilterLabel = useMemo(() => {
    if (timeRange) {
      const labels: Record<NonNullable<TimeRange>, string> = {
        today: "Aujourd'hui",
        yesterday: "Hier",
        week: "Cette semaine",
        month: "Ce mois",
        year: "Cette année",
      };
      return labels[timeRange];
    }
    if (sort === "popular") return "Populaires";
    return null;
  }, [timeRange, sort]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-ink-950" data-testid="app-root">
      <Sidebar
        filter={filter}
        setFilter={setFilter}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        sort={sort}
        setSort={setSort}
        stats={stats}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        monitorPaused={monitorPaused}
        togglePause={togglePause}
        openSettings={() => setSettingsOpen(true)}
        openCategories={() => setCatManagerOpen(true)}
        clearAll={clearAll}
        aiOnline={aiOnline}
        aiProvider={settings?.ai_provider || "ollama"}
      />

      {/* List column */}
      <section className="w-[380px] shrink-0 h-full border-r border-ink-700/60 bg-ink-900/20 flex flex-col">
        <SearchBar value={query} onChange={setQuery} count={clips.length} />

        {/* Advanced filter trigger */}
        <div className="px-5 py-2 border-b border-ink-700/40 bg-ink-900/30 flex items-center gap-2">
          <button
            onClick={() => setAdvOpen(true)}
            data-testid="open-adv-filters"
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium border",
              advCount > 0
                ? "bg-lime-500/15 border-lime-500 text-lime-500"
                : "bg-ink-800 border-ink-700 text-ink-300 hover:text-ink-50"
            )}
          >
            <SlidersHorizontal size={11} />
            Filtres
            {advCount > 0 && (
              <span className="px-1.5 py-0 rounded bg-lime-500 text-ink-950 text-[10px] font-bold">{advCount}</span>
            )}
          </button>
          {(activeFilterLabel || advCount > 0) && (
            <button
              onClick={() => {
                setTimeRange(null);
                setSort("recent");
                setAdvFilters({});
              }}
              data-testid="clear-filter"
              className="ml-auto text-[11px] text-ink-400 hover:text-lime-500"
            >
              tout effacer
            </button>
          )}
        </div>

        {activeFilterLabel && (
          <div className="px-5 py-1.5 border-b border-ink-700/40 bg-ink-800/30 flex items-center gap-2" data-testid="active-filter-bar">
            <span className="text-[10.5px] uppercase tracking-wider text-ink-400 font-mono">Filtre</span>
            <span className="text-[12px] text-ink-50 font-medium">{activeFilterLabel}</span>
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto" data-testid="clip-list">
          {clips.length === 0 ? (
            <EmptyList query={query} monitorPaused={monitorPaused} />
          ) : (
            clips.map((c) => (
              <ClipListItem
                key={c.id}
                clip={c}
                active={c.id === selectedId}
                onSelect={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>
      </section>

      <Preview clip={selected} onUpdate={updateClipInList} onDelete={deleteClip} aiOnline={aiOnline} />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => {
          setSettings(s);
          applyTheme(s.theme);
          applyCustomization(s);
        }}
      />

      <AdvancedFilters
        open={advOpen}
        onClose={() => setAdvOpen(false)}
        value={advFilters}
        onChange={setAdvFilters}
      />

      <CategoriesManager
        open={catManagerOpen}
        onClose={() => setCatManagerOpen(false)}
        onChanged={refresh}
      />
    </div>
  );
}

function EmptyList({ query, monitorPaused }: { query: string; monitorPaused: boolean }) {
  return (
    <div className="px-6 py-12 text-center" data-testid="empty-list">
      <div className="text-[13px] text-ink-300 font-medium mb-1">
        {query ? "Aucun résultat" : monitorPaused ? "Capture en pause" : "Votre historique est vide"}
      </div>
      <div className="text-[12px] text-ink-500 leading-relaxed">
        {query
          ? `Aucun élément ne correspond à "${query}".`
          : "Copiez quelque chose et il apparaîtra ici. Tout est stocké localement."}
      </div>
    </div>
  );
}

function applyTheme(theme: "auto" | "dark" | "light") {
  const root = document.documentElement;
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const isLight = theme === "light" || (theme === "auto" && mq.matches);
  root.classList.toggle("light", isLight);
  root.classList.toggle("dark", !isLight);
}

function applyCustomization(s: { accent_color: string; font_family: string; density: string; show_grain: boolean }) {
  const root = document.documentElement;
  const [r, g, b] = hexToRgb(s.accent_color) || [163, 230, 53];
  root.style.setProperty("--accent-rgb", `${r} ${g} ${b}`);
  // Body classes
  const body = document.body;
  body.classList.remove("font-geist", "font-inter", "font-jetbrains", "font-ibm-plex", "font-system");
  body.classList.add(`font-${s.font_family}`);
  body.classList.remove("density-comfortable", "density-compact");
  body.classList.add(`density-${s.density}`);
  body.classList.toggle("no-grain", !s.show_grain);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
