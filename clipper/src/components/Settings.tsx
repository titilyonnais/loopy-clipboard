import { useEffect, useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { Settings as SettingsT } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (s: SettingsT) => void;
}

export function Settings({ open, onClose, onSaved }: Props) {
  const [s, setS] = useState<SettingsT | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    if (open) {
      api.getSettings().then(setS);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
      data-testid="settings-overlay"
    >
      <div
        className="w-[520px] max-h-[80vh] overflow-auto rounded-2xl glass border border-ink-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 sticky top-0 glass">
          <h2 className="font-display text-[18px] font-medium tracking-tight">Paramètres</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-ink-800 flex items-center justify-center text-ink-300"
            data-testid="settings-close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <Field label="Thème">
            <div className="flex gap-1.5">
              {(["auto", "dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => save({ ...s, theme: t })}
                  data-testid={`theme-${t}`}
                  className={cn(
                    "px-3 h-8 rounded-md text-[12px] font-medium border",
                    s.theme === t
                      ? "bg-lime-400 text-ink-900 border-lime-400"
                      : "bg-ink-800/60 text-ink-200 border-ink-700 hover:bg-ink-700/60"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Limite d'historique"
            hint="0 = illimité. Les éléments épinglés ne sont jamais effacés."
          >
            <input
              type="number"
              min={0}
              value={s.max_items}
              onChange={(e) => setS({ ...s, max_items: parseInt(e.target.value) || 0 })}
              onBlur={() => save(s)}
              data-testid="setting-max-items"
              className="w-32 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring"
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
              className="w-48 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono"
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
            <h3 className="font-display text-[13.5px] font-medium text-ink-50 mb-3">
              IA locale (Ollama)
            </h3>
            <Field label="URL Ollama">
              <input
                value={s.ollama_url}
                onChange={(e) => setS({ ...s, ollama_url: e.target.value })}
                onBlur={() => save(s)}
                data-testid="setting-ollama-url"
                placeholder="http://localhost:11434"
                className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono"
              />
            </Field>
            <Field label="Modèle">
              <input
                value={s.ollama_model}
                onChange={(e) => setS({ ...s, ollama_model: e.target.value })}
                onBlur={() => save(s)}
                placeholder="llama3.2:3b"
                data-testid="setting-ollama-model"
                className="w-full h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[13px] focus-ring font-mono"
              />
            </Field>
            <p className="text-[11.5px] text-ink-400 leading-relaxed mt-2">
              Installez Ollama depuis <span className="font-mono text-lime-400">ollama.com</span> puis lancez <span className="font-mono">ollama pull llama3.2:3b</span> dans un terminal. Tout reste sur votre machine.
            </p>
          </div>

          {savedTick && (
            <div
              className="flex items-center gap-2 text-[12px] text-lime-400 animate-fade-in"
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
    <div>
      <div className="text-[12px] font-medium text-ink-200 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-ink-500 mt-1.5">{hint}</div>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  testid,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  testid?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={cn(
        "relative w-10 h-6 rounded-full transition-colors",
        checked ? "bg-lime-400" : "bg-ink-700"
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
