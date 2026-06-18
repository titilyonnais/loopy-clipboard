import { useEffect, useRef } from "react";
import { Search, Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  count: number;
  className?: string;
}

export function SearchBar({ value, onChange, count, className }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 px-5 h-14 border-b border-ink-700/60",
        className
      )}
      data-testid="searchbar"
    >
      <Search size={17} className="text-ink-400 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher dans l'historique…"
        className="flex-1 bg-transparent text-[15px] font-medium text-ink-50 placeholder:text-ink-400 focus:outline-none"
        data-testid="searchbar-input"
        autoFocus
      />
      <div className="flex items-center gap-2 text-[11px] text-ink-400">
        <span className="font-mono tabular-nums" data-testid="searchbar-count">
          {count.toLocaleString()}
        </span>
        <span className="text-ink-500">·</span>
        <kbd className="hidden sm:inline-flex items-center gap-1">
          <Command size={9} /> F
        </kbd>
      </div>
    </div>
  );
}
