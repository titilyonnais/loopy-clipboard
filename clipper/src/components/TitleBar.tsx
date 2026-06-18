import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Sparkles,
  Pause,
  Play,
  Search,
  Settings as SettingsIcon,
  Minus,
  Square,
  X,
  Copy as CopyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  monitorPaused: boolean;
  togglePause: () => void;
  openSettings: () => void;
  focusSearch: () => void;
  count: number;
  aiOnline: boolean;
  aiProviderLabel: string;
}

export function TitleBar({
  monitorPaused,
  togglePause,
  openSettings,
  focusSearch,
  count,
  aiOnline,
  aiProviderLabel,
}: Props) {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    try {
      const w = getCurrentWindow();
      w.isMaximized().then(setIsMax).catch(() => {});
      const un = w.onResized(() => {
        w.isMaximized().then(setIsMax).catch(() => {});
      });
      return () => {
        un.then((f) => f()).catch(() => {});
      };
    } catch {
      // Not running inside Tauri (e.g. browser preview) — silently ignore.
    }
  }, []);

  const safeWin = () => {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  };
  const minimize = () => safeWin()?.minimize().catch(() => {});
  const toggleMax = () => safeWin()?.toggleMaximize().catch(() => {});
  const close = () => safeWin()?.close().catch(() => {});

  return (
    <header
      className="h-9 flex items-center select-none border-b border-ink-700/60 bg-ink-950/80"
      data-tauri-drag-region
      data-testid="titlebar"
    >
      {/* Brand + drag area */}
      <div
        className="flex items-center gap-2 px-3 h-full"
        data-tauri-drag-region
      >
        <div className="w-4 h-4 rounded-md bg-lime-500 flex items-center justify-center shadow-[0_0_10px_-2px_rgba(190,242,100,0.6)]">
          <CopyIcon size={9} className="text-ink-950" strokeWidth={3} />
        </div>
        <span className="font-display font-medium text-[12.5px] text-ink-100 tracking-tight" data-tauri-drag-region>
          Clipper
        </span>
        <span className="text-[10px] text-ink-500 font-mono" data-tauri-drag-region>
          {count.toLocaleString()} clip{count > 1 ? "s" : ""}
        </span>
      </div>

      {/* Drag spacer */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* Quick actions */}
      <div className="flex items-center gap-0.5 px-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10.5px] font-mono mr-1 px-2 py-0.5 rounded",
            aiOnline ? "text-lime-500 bg-lime-500/10" : "text-ink-500 bg-ink-800"
          )}
          title={aiProviderLabel}
        >
          <Sparkles size={9} />
          {aiProviderLabel}
        </span>

        <TBBtn onClick={focusSearch} title="Rechercher (Ctrl+F)" testid="tb-search">
          <Search size={12} />
        </TBBtn>
        <TBBtn
          onClick={togglePause}
          title={monitorPaused ? "Reprendre la capture" : "Mettre en pause"}
          testid="tb-pause"
          active={monitorPaused}
        >
          {monitorPaused ? <Play size={12} /> : <Pause size={12} />}
        </TBBtn>
        <TBBtn onClick={openSettings} title="Paramètres" testid="tb-settings">
          <SettingsIcon size={12} />
        </TBBtn>
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full">
        <WCBtn onClick={minimize} title="Réduire" testid="wc-minimize">
          <Minus size={11} />
        </WCBtn>
        <WCBtn onClick={toggleMax} title={isMax ? "Restaurer" : "Maximiser"} testid="wc-maximize">
          <Square size={9} />
        </WCBtn>
        <WCBtn onClick={close} title="Fermer" testid="wc-close" danger>
          <X size={12} />
        </WCBtn>
      </div>
    </header>
  );
}

function TBBtn({
  children,
  onClick,
  title,
  testid,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  testid?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center text-ink-300 hover:bg-ink-800 hover:text-ink-50",
        active && "text-lime-500 bg-lime-500/10"
      )}
    >
      {children}
    </button>
  );
}

function WCBtn({
  children,
  onClick,
  title,
  testid,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  testid?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={cn(
        "w-12 h-full flex items-center justify-center text-ink-300 hover:bg-ink-800",
        danger && "hover:bg-red-500 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
