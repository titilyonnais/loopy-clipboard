import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "@/lib/api";
import type { ClipItem, Stats, Settings as SettingsT } from "@/types";
import { SearchBar } from "@/components/SearchBar";
import { Sidebar, type FilterKey } from "@/components/Sidebar";
import { ClipListItem } from "@/components/ClipListItem";
import { Preview } from "@/components/Preview";
import { Settings } from "@/components/Settings";

export default function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [monitorPaused, setMonitorPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    });
    api.aiHealth().then((r) => setAiOnline(r.ok));
    requestAnimationFrame(() =>
      document.documentElement.classList.remove("no-transition")
    );
    // AI health refresh every 30s
    const t = setInterval(() => {
      api.aiHealth().then((r) => setAiOnline(r.ok));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // Apply theme on settings change
  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]);

  // Fetch list
  const refresh = useCallback(async () => {
    const list = await api.list({
      query: query.trim() || undefined,
      kind: ["text", "image", "code", "url", "file"].includes(filter)
        ? filter
        : null,
      category: activeCategory || null,
      pinned_only: filter === "pinned",
      favorites_only: filter === "favorites",
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
  }, [query, filter, activeCategory, selectedId]);

  useEffect(() => {
    refresh();
  }, [query, filter, activeCategory]);

  // Listen to clipboard events from Rust side
  useEffect(() => {
    const un = listen<ClipItem>("clip:new", () => refresh());
    const un2 = listen<{ id: number }>("clip:updated", () => refresh());
    const un3 = listen<{}>("window:show", () => {
      // refresh on show
      refresh();
    });
    return () => {
      un.then((f) => f());
      un2.then((f) => f());
      un3.then((f) => f());
    };
  }, [refresh]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          api.hideWindow();
        }
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

  const selected = useMemo(
    () => clips.find((c) => c.id === selectedId) || null,
    [clips, selectedId]
  );

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
    if (!confirm("Effacer tout l'historique (les éléments épinglés sont préservés) ?")) return;
    await api.clearAll(true);
    refresh();
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-ink-950" data-testid="app-root">
      <Sidebar
        filter={filter}
        setFilter={setFilter}
        stats={stats}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        monitorPaused={monitorPaused}
        togglePause={togglePause}
        openSettings={() => setSettingsOpen(true)}
        clearAll={clearAll}
        aiOnline={aiOnline}
      />

      {/* List column */}
      <section className="w-[380px] shrink-0 h-full border-r border-ink-700/60 bg-ink-900/20 flex flex-col">
        <SearchBar value={query} onChange={setQuery} count={clips.length} />
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

      <Preview
        clip={selected}
        onUpdate={updateClipInList}
        onDelete={deleteClip}
        aiOnline={aiOnline}
      />

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setSettings(s)}
      />
    </div>
  );
}

function EmptyList({ query, monitorPaused }: { query: string; monitorPaused: boolean }) {
  return (
    <div className="px-6 py-12 text-center" data-testid="empty-list">
      <div className="text-[13px] text-ink-300 font-medium mb-1">
        {query
          ? "Aucun résultat"
          : monitorPaused
          ? "Capture en pause"
          : "Votre historique est vide"}
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
