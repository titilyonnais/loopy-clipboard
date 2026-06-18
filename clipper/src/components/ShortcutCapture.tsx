import { useEffect, useRef, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  testid?: string;
}

const MOD_KEYS = ["Control", "Shift", "Alt", "Meta"];

export function ShortcutCapture({ value, onChange, testid }: Props) {
  const [recording, setRecording] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      if (MOD_KEYS.includes(e.key)) return;
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Super");
      const k = e.key;
      const formatted =
        k.length === 1
          ? k.toUpperCase()
          : k === " "
          ? "Space"
          : k;
      parts.push(formatted);
      onChange(parts.join("+"));
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  const disabled = !value || !value.trim();

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={boxRef}>
      <button
        onClick={() => setRecording(true)}
        data-testid={testid || "shortcut-capture"}
        className={cn(
          "h-9 min-w-[180px] px-3 rounded-md text-[13px] font-mono border flex items-center gap-2",
          recording
            ? "bg-lime-500/15 border-lime-500 text-lime-500 animate-pulse"
            : disabled
            ? "bg-ink-800 border-ink-700 text-ink-400 italic"
            : "bg-ink-800 border-ink-700 text-ink-50"
        )}
      >
        <Keyboard size={13} />
        {recording
          ? "Appuyez sur la combinaison…"
          : disabled
          ? "Désactivé"
          : value}
      </button>
      {!disabled && !recording && (
        <button
          onClick={() => onChange("")}
          data-testid="shortcut-disable"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11.5px] border border-ink-700 bg-ink-800 text-ink-200 hover:text-red-400"
        >
          <X size={11} /> Désactiver
        </button>
      )}
      {recording && (
        <span className="text-[11px] text-ink-400">
          Échap pour annuler
        </span>
      )}
    </div>
  );
}
