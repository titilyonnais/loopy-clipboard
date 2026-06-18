import { invoke } from "@tauri-apps/api/core";
import type {
  ClipItem,
  Stats,
  Settings,
  AIResponse,
  SortMode,
  TimeRange,
  FileInfo,
  AdvancedFilters,
  ImportResult,
} from "@/types";

export const api = {
  list: (params: {
    query?: string;
    kind?: string | null;
    category?: string | null;
    tag?: string | null;
    pinned_only?: boolean;
    favorites_only?: boolean;
    time_range?: TimeRange | string | null;
    sort?: SortMode;
    limit?: number;
    offset?: number;
  } & AdvancedFilters) => invoke<ClipItem[]>("list_clips", { params }),

  get: (id: number) => invoke<ClipItem | null>("get_clip", { id }),
  copyToClipboard: (id: number) => invoke<void>("copy_to_clipboard", { id }),
  copyAs: (id: number, format: "plain" | "lowercase" | "uppercase" | "trim" | "json_escape" | "url_encode" | "base64") =>
    invoke<string>("copy_as", { id, format }),

  togglePin: (id: number) => invoke<ClipItem>("toggle_pin", { id }),
  toggleFavorite: (id: number) => invoke<ClipItem>("toggle_favorite", { id }),
  updateTags: (id: number, tags: string[]) => invoke<ClipItem>("update_tags", { id, tags }),
  updateCategory: (id: number, category: string | null) =>
    invoke<ClipItem>("update_category", { id, category }),

  remove: (id: number) => invoke<void>("delete_clip", { id }),
  clearAll: (keep_pinned: boolean) =>
    invoke<number>("clear_all", { keepPinned: keep_pinned }),
  cleanupNow: () => invoke<number>("cleanup_now"),

  checkPaths: (paths: string[]) => invoke<FileInfo[]>("check_paths", { paths }),
  readImageB64: (path: string) => invoke<string>("read_image_b64", { path }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
  revealInFolder: (path: string) => invoke<void>("reveal_in_folder", { path }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  writeTextFile: (path: string, content: string) =>
    invoke<void>("write_text_file", { path, content }),

  exportClips: () => invoke<string>("export_clips"),
  importClips: (json: string) => invoke<ImportResult>("import_clips", { json }),

  categoryCounts: () => invoke<[string, number][]>("category_counts"),
  tagCounts: () => invoke<[string, number][]>("tag_counts"),
  renameCategory: (oldName: string, newName: string) =>
    invoke<number>("rename_category", { old: oldName, new: newName }),
  deleteCategory: (name: string) => invoke<number>("delete_category", { name }),
  renameTag: (oldName: string, newName: string) =>
    invoke<number>("rename_tag", { old: oldName, new: newName }),
  deleteTag: (name: string) => invoke<number>("delete_tag", { name }),

  histogram: (days: number = 30) =>
    invoke<[string, number][]>("get_histogram", { days }),

  stats: () => invoke<Stats>("get_stats"),
  categories: () => invoke<string[]>("list_categories"),
  tags: () => invoke<string[]>("list_tags"),
  languages: () => invoke<string[]>("list_languages"),

  getSettings: () => invoke<Settings>("get_settings"),
  setSettings: (s: Settings) => invoke<Settings>("set_settings", { settings: s }),

  pauseMonitor: (paused: boolean) => invoke<void>("pause_monitor", { paused }),
  hideWindow: () => invoke<void>("hide_window"),

  aiSummarize: (id: number) => invoke<AIResponse>("ai_summarize", { id }),
  aiExplain: (id: number) => invoke<AIResponse>("ai_explain", { id }),
  aiRephrase: (id: number, style: string) =>
    invoke<AIResponse>("ai_rephrase", { id, style }),
  aiTranslate: (id: number, targetLang: string) =>
    invoke<AIResponse>("ai_translate", { id, targetLang }),
  aiFixGrammar: (id: number) => invoke<AIResponse>("ai_fix_grammar", { id }),
  aiSmartTag: (id: number) => invoke<AIResponse>("ai_smart_tag", { id }),
  aiHealth: () => invoke<AIResponse>("ai_health"),
};
