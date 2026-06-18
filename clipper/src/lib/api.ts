import { invoke } from "@tauri-apps/api/core";
import type { ClipItem, Stats, Settings, AIResponse } from "@/types";

export const api = {
  list: (params: {
    query?: string;
    kind?: string | null;
    category?: string | null;
    tag?: string | null;
    pinned_only?: boolean;
    favorites_only?: boolean;
    limit?: number;
    offset?: number;
  }) => invoke<ClipItem[]>("list_clips", { params }),

  get: (id: number) => invoke<ClipItem | null>("get_clip", { id }),

  copyToClipboard: (id: number) => invoke<void>("copy_to_clipboard", { id }),

  copyAs: (id: number, format: "plain" | "lowercase" | "uppercase" | "trim" | "json_escape" | "url_encode" | "base64") =>
    invoke<string>("copy_as", { id, format }),

  togglePin: (id: number) => invoke<ClipItem>("toggle_pin", { id }),
  toggleFavorite: (id: number) => invoke<ClipItem>("toggle_favorite", { id }),

  updateTags: (id: number, tags: string[]) =>
    invoke<ClipItem>("update_tags", { id, tags }),

  updateCategory: (id: number, category: string | null) =>
    invoke<ClipItem>("update_category", { id, category }),

  remove: (id: number) => invoke<void>("delete_clip", { id }),

  clearAll: (keep_pinned: boolean) =>
    invoke<number>("clear_all", { keepPinned: keep_pinned }),

  stats: () => invoke<Stats>("get_stats"),

  categories: () => invoke<string[]>("list_categories"),
  tags: () => invoke<string[]>("list_tags"),

  getSettings: () => invoke<Settings>("get_settings"),
  setSettings: (s: Settings) => invoke<Settings>("set_settings", { settings: s }),

  pauseMonitor: (paused: boolean) =>
    invoke<void>("pause_monitor", { paused }),

  hideWindow: () => invoke<void>("hide_window"),

  // AI (local via Ollama)
  aiSummarize: (id: number) => invoke<AIResponse>("ai_summarize", { id }),
  aiExplain: (id: number) => invoke<AIResponse>("ai_explain", { id }),
  aiRephrase: (id: number, style: string) =>
    invoke<AIResponse>("ai_rephrase", { id, style }),
  aiHealth: () => invoke<AIResponse>("ai_health"),
};
