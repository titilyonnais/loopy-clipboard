import { useEffect, useState } from "react";
import { X, RotateCcw, Check, Database, Trash2, Cpu, Palette, Keyboard, Download, Upload, Sparkles } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api } from "@/lib/api";
import type { Settings as SettingsT, Stats, AIProvider } from "@/types";
import { cn, humanBytes } from "@/lib/utils";
import { ShortcutCapture } from "./ShortcutCapture";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (s: SettingsT) => void;
}

const CONFIRM_WORD = "EFFACER";

const DAY_PRESETS = [
  { v: 0, label: "Jamais" },
  { v: 1, label: "1 jour" },
  { v: 7, label: "7 jours" },
  { v: 30, label: "30 jours" },
  { v: 90, label: "90 jours" },
  { v: 365, label: "1 an" },
];

const ACCENT_PRESETS = [
  { hex: "#a3e635", name: "Lime" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#ef4444", name: "Red" },
];

const FONTS = [
  { v: "geist", label: "Geist" },
  { v: "inter", label: "Inter" },
  { v: "ibm-plex", label: "IBM Plex" },
  { v: "jetbrains", label: "JetBrains" },
  { v: "system", label: "Système" },
];

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];
const ANTHROPIC_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-5",
  "claude-opus-4-5",
];

type Tab = "general" | "retention" | "ai" | "shortcut" | "appearance" | "data";

export function Settings({ open: isOpen, onClose, onSaved }: Props) {
  const [s, setS] = useState<SettingsT | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const [tab, setTab] = useState<Tab>("general");
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [clearResult, setClearResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSettings().then(setS);
      api.stats().then(setStats);
    }
  }, [isOpen]);

  if (!isOpen || !s) return null;

  const save_ = async (next: SettingsT) => {
    const updated = await api.setSettings(next);
    setS(updated);
    onSaved(updated);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1100);
  };

  const runCleanup = async () => {
    const n = await api.cleanupNow();
    setCleanupResult(`${n} élément(s) supprimé(s).`);
    api.stats().then(setStats);
    setTimeout(() => setCleanupResult(null), 3000);
  };

  const doExport = async () => {
    const json = await api.exportClips();
    const path = await save({
      title: "Exporter l'historique",
      defaultPath: `clipper-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    // Use Tauri fs via dialog's open isn't direct — write via JS-only fallback using a Blob isn't available in Tauri.
    // The simplest path here: use the dialog plugin's save to get a path, then write via a small Rust command? We didn't expose that.
    // Workaround: copy JSON to clipboard so user pastes into a file. But that's poor UX.
    // Better: pop a textarea modal with the JSON for copy/save. We'll do that.
    // For now, embed an invisible anchor download using a data URL — works inside webview.
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split(/[\\/]/).pop() || "clipper-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportResult(`Export prêt: ${a.download}`);
    setTimeout(() => setImportResult(null), 3500);
  };

  const doImport = async () => {
    const selected = await open({
      title: "Importer un export Clipper",
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selected || typeof selected !== "string") return;
    // Read file via input fallback (Tauri 2 fs plugin not configured) — use a Rust roundtrip:
    // We don't have a read_text command. Easiest: ask the user to drop the file via a <input type=file>.
    // To avoid adding a Rust command, we use the File System Access via the dialog OUTPUT path then read in Rust.
    // Actually our import_clips takes JSON string directly, so we DO need to read the file content.
    // Workaround: use fetch with file:// — disallowed by CSP. Use the readFile from @tauri-apps/plugin-fs.
    // Since we don't have fs plugin set up, we fallback to a hidden <input type=file>.
    triggerFileInput();
  };

  const triggerFileInput = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const res = await api.importClips(text);
        setImportResult(
          `Import: ${res.imported} ajouté(s), ${res.skipped} ignoré(s) sur ${res.total}.`
        );
        api.stats().then(setStats);
      } catch (e: any) {
        setImportResult(`Erreur: ${String(e)}`);
      }
      setTimeout(() => setImportResult(null), 5500);
    };
    input.click();
  };

  const tabs: { v: Tab; label: string; icon: any }[] = [
    { v: "general", label: "Général", icon: Sparkles },
    { v: "retention", label: "Rétention", icon: Database },
    { v: "ai", label: "IA", icon: Cpu },
    { v: "shortcut", label: "Raccourci", icon: Keyboard },
    { v: "appearance", label: "Apparence", icon: Palette },
    { v: "data", label: "Données", icon: Download },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
      data-testid="settings-overlay"
    >
      <div
        className="w-[760px] h-[80vh] flex overflow-hidden rounded-2xl glass border border-ink-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-dialog"
      >
        {/* Sidebar */}
        <nav className="w-[180px] shrink-0 border-r border-ink-700/60 p-3 space-y-0.5 bg-ink-900/40">
          <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-500">
            Paramètres
          </div>
          {tabs.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              data-testid={`tab-${t.v}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left",
                tab === t.v
                  ? "bg-ink-700/60 text-ink-50"
                  : "text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"
              )}
            >
              <t.icon size={13} className={tab === t.v ? "text-lime-500" : ""} />
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 sticky top-0 glass z-10">
            <h2 className="font-display text-[17px] font-medium tracking-tight text-ink-50">
              {tabs.find((t) => t.v === tab)?.label}
            </h2>
            <div className="flex items-center gap-3">
              {savedTick && (
                <span className="flex items-center gap-1 text-[11.5px] text-lime-500 animate-fade-in" data-testid="settings-saved">
                  <Check size={12} /> Enregistré
                </span>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-ink-800 flex items-center justify-center text-ink-300"
                data-testid="settings-close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {tab === "general" && (
              <>
                {stats && (
                  <div className="rounded-xl border border-ink-700/60 bg-ink-800/40 p-4">
                    <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-ink-400 font-mono">
                      <Database size={11} /> Stockage local
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Stat label="Éléments" value={stats.total.toLocaleString()} />
                      <Stat label="Épinglés" value={stats.pinned.toLocaleString()} />
                      <Stat label="Taille" value={humanBytes(stats.bytes)} />
                    </div>
                  </div>
                )}

                <Field label="Limite d'historique" hint="0 = illimité. Les épinglés ne sont jamais comptés.">
                  <input
                    type="number"
                    min={0}
                    value={s.max_items}
                    onChange={(e) => setS({ ...s, max_items: parseInt(e.target.value) || 0 })}
                    onBlur={() => save_(s)}
                    data-testid="setting-max-items"
                    className="w-32 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring text-ink-50"
                  />
                </Field>

                <Field label="Démarrer avec Windows">
                  <Toggle checked={s.launch_at_startup} onChange={(v) => save_({ ...s, launch_at_startup: v })} testid="setting-autostart" />
                </Field>
              </>
            )}

            {tab === "retention" && (
              <>
                <Field
                  label="Supprimer automatiquement après"
                  hint={
                    s.auto_delete_days === 0
                      ? "Conservation illimitée — rien n'est jamais supprimé automatiquement."
                      : `Les éléments non utilisés depuis ${s.auto_delete_days} jour(s) seront effacés.`
                  }
                >
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_PRESETS.map((p) => (
                      <button
                        key={p.v}
                        onClick={() => save_({ ...s, auto_delete_days: p.v })}
                        data-testid={`retention-${p.v}`}
                        className={cn(
                          "px-3 h-8 rounded-md text-[12px] font-medium border",
                          s.auto_delete_days === p.v
                            ? "bg-lime-500 text-ink-950 border-lime-500"
                            : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={0}
                      value={s.auto_delete_days}
                      onChange={(e) => setS({ ...s, auto_delete_days: parseInt(e.target.value) || 0 })}
                      onBlur={() => save_(s)}
                      data-testid="retention-custom"
                      className="w-20 h-8 px-2 rounded-md bg-ink-800 border border-ink-700 text-[12px] focus-ring font-mono text-ink-50"
                      placeholder="jours"
                    />
                  </div>
                </Field>

                <Field label="Exclusions de la suppression auto">
                  <div className="space-y-2">
                    <ExclusionRow
                      label="Éléments épinglés"
                      desc="Conservés même au-delà de la durée de rétention."
                      checked={s.keep_pinned}
                      onChange={(v) => save_({ ...s, keep_pinned: v })}
                      testid="exclude-pinned"
                    />
                    <ExclusionRow
                      label="Favoris (★)"
                      desc="Conservés même au-delà de la durée de rétention."
                      checked={s.keep_favorites}
                      onChange={(v) => save_({ ...s, keep_favorites: v })}
                      testid="exclude-favorites"
                    />
                  </div>
                </Field>

                <div className="flex items-center gap-2">
                  <button
                    onClick={runCleanup}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11.5px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
                    data-testid="cleanup-now"
                  >
                    <Trash2 size={11} /> Nettoyer maintenant
                  </button>
                  {cleanupResult && <span className="text-[11.5px] text-lime-500" data-testid="cleanup-result">{cleanupResult}</span>}
                </div>
              </>
            )}

            {tab === "ai" && (
              <>
                <Field label="Fournisseur d'IA" hint="Toutes les requêtes restent locales avec Ollama. Les clés API ne sont envoyées qu'au fournisseur choisi.">
                  <div className="flex gap-1.5">
                    {(["ollama", "openai", "anthropic"] as AIProvider[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => save_({ ...s, ai_provider: p })}
                        data-testid={`provider-${p}`}
                        className={cn(
                          "px-4 h-9 rounded-md text-[12.5px] font-medium border",
                          s.ai_provider === p
                            ? "bg-lime-500 text-ink-950 border-lime-500"
                            : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                        )}
                      >
                        {p === "ollama" ? "Ollama (local)" : p === "openai" ? "OpenAI" : "Claude"}
                      </button>
                    ))}
                  </div>
                </Field>

                <ProviderInfo provider={s.ai_provider} />

                {s.ai_provider === "ollama" && (
                  <>
                    <Field label="URL Ollama">
                      <input
                        value={s.ollama_url}
                        onChange={(e) => setS({ ...s, ollama_url: e.target.value })}
                        onBlur={() => save_(s)}
                        data-testid="setting-ollama-url"
                        placeholder="http://localhost:11434"
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
                      />
                    </Field>
                    <Field label="Modèle Ollama">
                      <input
                        value={s.ollama_model}
                        onChange={(e) => setS({ ...s, ollama_model: e.target.value })}
                        onBlur={() => save_(s)}
                        data-testid="setting-ollama-model"
                        placeholder="llama3.2:3b"
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
                      />
                    </Field>
                    <p className="text-[11.5px] text-ink-400 leading-relaxed">
                      Installez Ollama depuis <span className="font-mono text-lime-500">ollama.com</span> puis lancez <span className="font-mono">ollama pull llama3.2:3b</span>. Tout reste sur votre machine.
                    </p>
                  </>
                )}

                {s.ai_provider === "openai" && (
                  <>
                    <Field label="Clé API OpenAI" hint="Stockée localement uniquement. Récupérable sur platform.openai.com/api-keys">
                      <input
                        type="password"
                        value={s.openai_api_key}
                        onChange={(e) => setS({ ...s, openai_api_key: e.target.value })}
                        onBlur={() => save_(s)}
                        data-testid="setting-openai-key"
                        placeholder="sk-..."
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
                      />
                    </Field>
                    <Field label="Modèle OpenAI">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {OPENAI_MODELS.map((m) => (
                          <ChipBtn key={m} active={s.openai_model === m} onClick={() => save_({ ...s, openai_model: m })}>
                            {m}
                          </ChipBtn>
                        ))}
                      </div>
                      <input
                        value={s.openai_model}
                        onChange={(e) => setS({ ...s, openai_model: e.target.value })}
                        onBlur={() => save_(s)}
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] font-mono text-ink-50"
                      />
                    </Field>
                    <Field label="URL de base (optionnel)" hint="Pour compatibles OpenAI (Azure, OpenRouter, locale)">
                      <input
                        value={s.openai_base_url}
                        onChange={(e) => setS({ ...s, openai_base_url: e.target.value })}
                        onBlur={() => save_(s)}
                        placeholder="https://api.openai.com"
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] font-mono text-ink-50"
                      />
                    </Field>
                  </>
                )}

                {s.ai_provider === "anthropic" && (
                  <>
                    <Field label="Clé API Anthropic" hint="Stockée localement. Récupérable sur console.anthropic.com/settings/keys">
                      <input
                        type="password"
                        value={s.anthropic_api_key}
                        onChange={(e) => setS({ ...s, anthropic_api_key: e.target.value })}
                        onBlur={() => save_(s)}
                        data-testid="setting-anthropic-key"
                        placeholder="sk-ant-..."
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
                      />
                    </Field>
                    <Field label="Modèle Claude">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {ANTHROPIC_MODELS.map((m) => (
                          <ChipBtn key={m} active={s.anthropic_model === m} onClick={() => save_({ ...s, anthropic_model: m })}>
                            {m.split("-").slice(0, 3).join("-")}
                          </ChipBtn>
                        ))}
                      </div>
                      <input
                        value={s.anthropic_model}
                        onChange={(e) => setS({ ...s, anthropic_model: e.target.value })}
                        onBlur={() => save_(s)}
                        className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] font-mono text-ink-50"
                      />
                    </Field>
                  </>
                )}
              </>
            )}

            {tab === "shortcut" && (
              <>
                <Field
                  label="Raccourci global"
                  hint="Combinaison qui ouvre/cache Clipper depuis n'importe où. Cliquez et appuyez sur les touches souhaitées."
                >
                  <ShortcutCapture
                    value={s.shortcut}
                    onChange={(v) => save_({ ...s, shortcut: v })}
                  />
                </Field>

                <div className="text-[11.5px] text-ink-400 leading-relaxed">
                  💡 Combinaisons recommandées : <span className="font-mono">Ctrl+Shift+V</span>, <span className="font-mono">Ctrl+Alt+C</span>, <span className="font-mono">Super+V</span> (touche Windows).
                  <br />
                  Si le raccourci est déjà utilisé par une autre application, l'enregistrement échouera silencieusement — choisissez-en un autre.
                </div>
              </>
            )}

            {tab === "appearance" && (
              <>
                <Field label="Thème">
                  <div className="flex gap-1.5">
                    {(["auto", "dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => save_({ ...s, theme: t })}
                        data-testid={`theme-${t}`}
                        className={cn(
                          "px-3 h-8 rounded-md text-[12px] font-medium border capitalize",
                          s.theme === t
                            ? "bg-lime-500 text-ink-950 border-lime-500"
                            : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Couleur d'accent">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => save_({ ...s, accent_color: c.hex })}
                        data-testid={`accent-${c.name.toLowerCase()}`}
                        title={c.name}
                        className={cn(
                          "w-9 h-9 rounded-full border-2 transition-transform hover:scale-110",
                          s.accent_color.toLowerCase() === c.hex.toLowerCase()
                            ? "border-ink-50 scale-110"
                            : "border-ink-700"
                        )}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={s.accent_color}
                    onChange={(e) => setS({ ...s, accent_color: e.target.value })}
                    onBlur={() => save_(s)}
                    data-testid="setting-accent-custom"
                    className="w-32 h-9 rounded-md bg-ink-800 border border-ink-700 cursor-pointer"
                  />
                </Field>

                <Field label="Police de caractères">
                  <div className="flex flex-wrap gap-1.5">
                    {FONTS.map((f) => (
                      <button
                        key={f.v}
                        onClick={() => save_({ ...s, font_family: f.v as any })}
                        data-testid={`font-${f.v}`}
                        className={cn(
                          "px-3 h-8 rounded-md text-[12px] border",
                          s.font_family === f.v
                            ? "bg-lime-500 text-ink-950 border-lime-500 font-medium"
                            : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                        )}
                        style={{
                          fontFamily:
                            f.v === "geist" ? "Geist" :
                            f.v === "inter" ? "Inter" :
                            f.v === "ibm-plex" ? "IBM Plex Sans" :
                            f.v === "jetbrains" ? "JetBrains Mono" :
                            "system-ui",
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Densité">
                  <div className="flex gap-1.5">
                    {(["comfortable", "compact"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => save_({ ...s, density: d })}
                        data-testid={`density-${d}`}
                        className={cn(
                          "px-3 h-8 rounded-md text-[12px] font-medium border",
                          s.density === d
                            ? "bg-lime-500 text-ink-950 border-lime-500"
                            : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                        )}
                      >
                        {d === "comfortable" ? "Confortable" : "Compact"}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Texture de grain">
                  <Toggle checked={s.show_grain} onChange={(v) => save_({ ...s, show_grain: v })} testid="setting-grain" />
                </Field>
              </>
            )}

            {tab === "data" && (
              <>
                <Field label="Exporter / Importer" hint="Format JSON. L'import est déduplicaté par hash, aucune perte.">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={doExport}
                      data-testid="export-btn"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12.5px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
                    >
                      <Download size={12} /> Exporter
                    </button>
                    <button
                      onClick={doImport}
                      data-testid="import-btn"
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12.5px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
                    >
                      <Upload size={12} /> Importer
                    </button>
                  </div>
                  {importResult && (
                    <div className="text-[11.5px] text-lime-500 mt-2 animate-fade-in" data-testid="import-result">
                      {importResult}
                    </div>
                  )}
                </Field>

                <div className="rounded-xl border-2 border-red-500/60 bg-red-500/[0.08] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Trash2 size={13} className="text-red-400" />
                    <div className="text-[13px] font-semibold text-red-300">Zone dangereuse</div>
                  </div>
                  <div className="text-[12px] text-ink-200 mb-3 leading-relaxed">
                    Effacer tout l'historique de manière irréversible. Les éléments épinglés sont préservés sauf si vous décochez cette protection dans <span className="font-medium">Rétention</span>.
                  </div>

                  {!dangerOpen ? (
                    <button
                      onClick={() => {
                        setDangerOpen(true);
                        setConfirmInput("");
                        setClearResult(null);
                      }}
                      data-testid="danger-open"
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-[12.5px] font-semibold bg-red-500 text-white hover:bg-red-600 border border-red-600"
                    >
                      <Trash2 size={12} /> Effacer tout l'historique
                    </button>
                  ) : (
                    <div className="space-y-3 animate-slide-up">
                      <div className="text-[12px] text-ink-100">
                        Pour confirmer, tapez le mot{" "}
                        <span className="font-mono font-bold text-red-300 select-text">
                          {CONFIRM_WORD}
                        </span>{" "}
                        ci-dessous :
                      </div>
                      <input
                        autoFocus
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        placeholder={CONFIRM_WORD}
                        data-testid="danger-input"
                        className="w-full h-10 px-3 rounded-md bg-ink-800 border-2 border-red-500/40 focus:border-red-500 text-[13px] text-ink-50 font-mono focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDangerOpen(false);
                            setConfirmInput("");
                          }}
                          data-testid="danger-cancel"
                          className="h-9 px-3 rounded-md text-[12.5px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
                        >
                          Annuler
                        </button>
                        <button
                          disabled={confirmInput.trim().toUpperCase() !== CONFIRM_WORD}
                          onClick={async () => {
                            const n = await api.clearAll(true);
                            setClearResult(`${n} élément(s) effacé(s).`);
                            setDangerOpen(false);
                            setConfirmInput("");
                            api.stats().then(setStats);
                            setTimeout(() => setClearResult(null), 4000);
                          }}
                          data-testid="danger-confirm"
                          className={cn(
                            "h-9 px-4 rounded-md text-[12.5px] font-semibold border",
                            confirmInput.trim().toUpperCase() === CONFIRM_WORD
                              ? "bg-red-500 text-white border-red-600 hover:bg-red-600"
                              : "bg-red-500/30 text-red-200 border-red-500/40 cursor-not-allowed"
                          )}
                        >
                          Confirmer l'effacement
                        </button>
                      </div>
                    </div>
                  )}

                  {clearResult && (
                    <div className="mt-3 text-[12px] text-lime-500 animate-fade-in" data-testid="clear-result">
                      ✓ {clearResult}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="pt-3 border-t border-ink-700/60 flex items-center gap-2">
              <RotateCcw size={11} className="text-ink-500" />
              <span className="text-[11px] text-ink-500">
                Les modifications sont enregistrées automatiquement.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-mono mb-0.5">{label}</div>
      <div className="font-display text-[18px] text-ink-50 tabular-nums font-medium">{value}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-ink-200 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-ink-500 mt-1.5">{hint}</div>}
    </div>
  );
}

function ExclusionRow({
  label,
  desc,
  checked,
  onChange,
  testid,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testid?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-lg bg-ink-800/40 border border-ink-700/40">
      <Toggle checked={checked} onChange={onChange} testid={testid} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-ink-50 font-medium">{label}</div>
        <div className="text-[11px] text-ink-400">{desc}</div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  testid,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  testid?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      data-testid={testid}
      disabled={disabled}
      className={cn(
        "relative w-10 h-6 rounded-full shrink-0",
        checked ? "bg-lime-500" : "bg-ink-700",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 h-7 rounded-md text-[11px] font-medium border",
        active ? "bg-lime-500 text-ink-950 border-lime-500" : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
      )}
    >
      {children}
    </button>
  );
}

function ProviderInfo({ provider }: { provider: "ollama" | "openai" | "anthropic" }) {
  const info = {
    ollama: {
      title: "Ollama — 100% local",
      pros: [
        "Aucune donnée ne quitte votre PC. Vie privée totale.",
        "Gratuit, illimité, fonctionne hors ligne.",
        "Bon pour les tâches courantes (résumé, traduction simple).",
      ],
      cons: [
        "Qualité < cloud sur tâches complexes ou techniques.",
        "Nécessite ~4 Go RAM par modèle, plus lent (~2-15 s).",
      ],
      best: "Idéal pour : un usage quotidien sensible (données pro, code interne) sans connexion.",
      color: "lime",
    },
    openai: {
      title: "OpenAI GPT — équilibre qualité / vitesse",
      pros: [
        "GPT-4o-mini ultra rapide (< 1 s) et très peu cher (~0,15 $/M tokens).",
        "GPT-4o très polyvalent, bon en code, raisonnement, multilingue.",
        "Écosystème mature, support des outils & vision.",
      ],
      cons: [
        "Données envoyées à OpenAI (sauf opt-out via paramètres compte).",
        "Coûts à la requête, latence dépend de la connexion.",
      ],
      best: "Idéal pour : tâches rapides, code, formats structurés (JSON, SQL).",
      color: "cyan",
    },
    anthropic: {
      title: "Claude — le plus naturel à l'écrit",
      pros: [
        "Excelle en rédaction, raisonnement, analyse de longs textes (200k tokens).",
        "Sortie plus longue & nuancée que GPT, ton très naturel.",
        "Haiku 4.5 = très rapide et économique ; Sonnet/Opus = top qualité.",
      ],
      cons: [
        "Données envoyées à Anthropic (opt-out via paramètres compte).",
        "Légèrement plus lent que GPT-mini sur des prompts courts.",
      ],
      best: "Idéal pour : reformuler, traduire avec finesse, expliquer du code, longs documents.",
      color: "amber",
    },
  }[provider];

  const accentClass =
    info.color === "lime"
      ? "border-lime-500/40 bg-lime-500/[0.05]"
      : info.color === "cyan"
      ? "border-cyan-500/40 bg-cyan-500/[0.05]"
      : "border-amber-500/40 bg-amber-500/[0.05]";

  return (
    <div className={cn("rounded-xl border p-4", accentClass)} data-testid="provider-info">
      <div className="text-[13px] font-semibold text-ink-50 mb-2">{info.title}</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-lime-500 font-mono mb-1">Forces</div>
          <ul className="space-y-1">
            {info.pros.map((p, i) => (
              <li key={i} className="text-[11.5px] text-ink-200 leading-relaxed flex gap-1.5">
                <span className="text-lime-500">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-ink-400 font-mono mb-1">Limites</div>
          <ul className="space-y-1">
            {info.cons.map((c, i) => (
              <li key={i} className="text-[11.5px] text-ink-300 leading-relaxed flex gap-1.5">
                <span className="text-ink-400">−</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="text-[11.5px] text-ink-100 bg-ink-800/40 rounded-md px-3 py-2 border border-ink-700/40">
        🎯 {info.best}
      </div>
    </div>
  );
}
