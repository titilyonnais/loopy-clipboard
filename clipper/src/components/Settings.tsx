import { useEffect, useState } from "react";
import { X, RotateCcw, Check, Database, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Settings as SettingsT, Stats } from "@/types";
import { cn, humanBytes } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (s: SettingsT) => void;
}

const DAY_PRESETS = [
  { v: 0, label: "Jamais" },
  { v: 1, label: "1 jour" },
  { v: 7, label: "7 jours" },
  { v: 30, label: "30 jours" },
  { v: 90, label: "90 jours" },
  { v: 365, label: "1 an" },
];

export function Settings({ open, onClose, onSaved }: Props) {
  const [s, setS] = useState<SettingsT | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [savedTick, setSavedTick] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      api.getSettings().then(setS);
      api.stats().then(setStats);
    }
  }, [open]);

  if (!open || !s) return null;

  const save = async (next: SettingsT) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
      data-testid="settings-overlay"
    >
      <div
        className="w-[560px] max-h-[85vh] overflow-auto rounded-2xl glass border border-ink-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 sticky top-0 glass z-10">
          <h2 className="font-display text-[18px] font-medium tracking-tight text-ink-50">
            Paramètres
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-ink-800 flex items-center justify-center text-ink-300"
            data-testid="settings-close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Storage stats */}
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
              <div className="text-[10.5px] text-ink-500 mt-3 leading-relaxed">
                Stockage <span className="text-lime-500 font-medium">100 % local</span> dans <code className="font-mono">%APPDATA%/com.clipper.app/clipper.db</code>. Persiste après redémarrage et même après mise à jour de l'app.
              </div>
            </div>
          )}

          <Field label="Thème">
            <div className="flex gap-1.5">
              {(["auto", "dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => save({ ...s, theme: t })}
                  data-testid={`theme-${t}`}
                  className={cn(
                    "px-3 h-8 rounded-md text-[12px] font-medium border capitalize",
                    s.theme === t
                      ? "bg-lime-500 text-ink-950 border-lime-500"
                      : "bg-ink-800/60 text-ink-200 border-ink-700 hover:bg-ink-700/60"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <div className="border-t border-ink-700/60 pt-5">
            <h3 className="font-display text-[14px] font-medium text-ink-50 mb-3">
              Rétention de l'historique
            </h3>

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
                    onClick={() => save({ ...s, auto_delete_days: p.v })}
                    data-testid={`retention-${p.v}`}
                    className={cn(
                      "px-3 h-8 rounded-md text-[12px] font-medium border",
                      s.auto_delete_days === p.v
                        ? "bg-lime-500 text-ink-950 border-lime-500"
                        : "bg-ink-800/60 text-ink-200 border-ink-700 hover:bg-ink-700/60"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  value={s.auto_delete_days}
                  onChange={(e) =>
                    setS({ ...s, auto_delete_days: parseInt(e.target.value) || 0 })
                  }
                  onBlur={() => save(s)}
                  data-testid="retention-custom"
                  className="w-20 h-8 px-2 rounded-md bg-ink-800 border border-ink-700 text-[12px] focus-ring font-mono"
                  placeholder="jours"
                />
              </div>
            </Field>

            <Field label="Exclusions de la suppression auto">
              <div className="space-y-2">
                <ExclusionRow
                  label="Éléments épinglés"
                  desc="Toujours conservés (non modifiable)."
                  checked={true}
                  locked
                />
                <ExclusionRow
                  label="Favoris (★)"
                  desc="Conservés même au-delà de la durée de rétention."
                  checked={s.keep_favorites}
                  onChange={(v) => save({ ...s, keep_favorites: v })}
                  testid="exclude-favorites"
                />
              </div>
            </Field>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={runCleanup}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11.5px] font-medium border border-ink-700 bg-ink-800/60 text-ink-200 hover:bg-ink-700/60"
                data-testid="cleanup-now"
              >
                <Trash2 size={11} /> Nettoyer maintenant
              </button>
              {cleanupResult && (
                <span className="text-[11.5px] text-lime-500 animate-fade-in" data-testid="cleanup-result">
                  {cleanupResult}
                </span>
              )}
            </div>
          </div>

          <Field
            label="Limite d'historique (en plus de la rétention)"
            hint="0 = illimité. Les épinglés ne sont jamais comptés."
          >
            <input
              type="number"
              min={0}
              value={s.max_items}
              onChange={(e) =>
                setS({ ...s, max_items: parseInt(e.target.value) || 0 })
              }
              onBlur={() => save(s)}
              data-testid="setting-max-items"
              className="w-32 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring text-ink-50"
            />
          </Field>

          <Field
            label="Raccourci global"
            hint="Combinaison qui ouvre/cache Clipper, depuis n'importe où."
          >
            <input
              value={s.shortcut}
              onChange={(e) => setS({ ...s, shortcut: e.target.value })}
              onBlur={() => save(s)}
              placeholder="Ctrl+Shift+V"
              data-testid="setting-shortcut"
              className="w-48 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
            />
          </Field>

          <Field label="Démarrer avec Windows">
            <Toggle
              checked={s.launch_at_startup}
              onChange={(v) => save({ ...s, launch_at_startup: v })}
              testid="setting-autostart"
            />
          </Field>

          <div className="pt-3 border-t border-ink-700/60">
            <h3 className="font-display text-[14px] font-medium text-ink-50 mb-3">
              IA locale (Ollama)
            </h3>
            <Field label="URL Ollama">
              <input
                value={s.ollama_url}
                onChange={(e) => setS({ ...s, ollama_url: e.target.value })}
                onBlur={() => save(s)}
                data-testid="setting-ollama-url"
                placeholder="http://localhost:11434"
                className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
              />
            </Field>
            <Field label="Modèle">
              <input
                value={s.ollama_model}
                onChange={(e) => setS({ ...s, ollama_model: e.target.value })}
                onBlur={() => save(s)}
                placeholder="llama3.2:3b"
                data-testid="setting-ollama-model"
                className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono text-ink-50"
              />
            </Field>
            <p className="text-[11.5px] text-ink-400 leading-relaxed mt-2">
              Installez Ollama depuis <span className="font-mono text-lime-500">ollama.com</span> puis lancez <span className="font-mono">ollama pull llama3.2:3b</span> dans un terminal. Tout reste sur votre machine.
            </p>
          </div>

          {savedTick && (
            <div
              className="flex items-center gap-2 text-[12px] text-lime-500 animate-fade-in"
              data-testid="settings-saved"
            >
              <Check size={13} /> Enregistré
            </div>
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
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-mono mb-0.5">
        {label}
      </div>
      <div className="font-display text-[18px] text-ink-50 tabular-nums font-medium">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
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
  locked,
  testid,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  testid?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-lg bg-ink-800/40 border border-ink-700/40">
      <Toggle
        checked={checked}
        onChange={onChange || (() => {})}
        disabled={locked}
        testid={testid}
      />
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
  disabled,
  testid,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      data-testid={testid}
      disabled={disabled}
      className={cn(
        "relative w-10 h-6 rounded-full transition-colors shrink-0",
        checked ? "bg-lime-500" : "bg-ink-700",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4"
        )}
      />
    </button>
  );
}
