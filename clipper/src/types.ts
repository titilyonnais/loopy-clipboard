export type ClipKind = "text" | "image" | "code" | "url" | "file";

export interface ClipItem {
  id: number;
  kind: ClipKind;
  content: string;
  preview: string;
  language?: string | null;
  category?: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  source_app?: string | null;
  size_bytes: number;
  hash: string;
  created_at: string;
  used_at: string;
  use_count: number;
}

export interface Stats {
  total: number;
  text: number;
  image: number;
  code: number;
  url: number;
  file: number;
  pinned: number;
  favorites: number;
  bytes: number;
}

export type AIProvider = "ollama" | "openai" | "anthropic";

export interface Settings {
  theme: "dark" | "light" | "auto";
  max_items: number;
  shortcut: string;
  launch_at_startup: boolean;
  monitor_paused: boolean;
  ignore_apps: string[];

  // Retention
  auto_delete_days: number;
  keep_favorites: boolean;
  keep_pinned: boolean;

  // AI
  ai_provider: AIProvider;
  ollama_url: string;
  ollama_model: string;
  openai_api_key: string;
  openai_base_url: string;
  openai_model: string;
  anthropic_api_key: string;
  anthropic_model: string;

  // Customization
  accent_color: string;
  font_family: "geist" | "inter" | "jetbrains" | "ibm-plex" | "system";
  density: "comfortable" | "compact";
  show_grain: boolean;
}

export interface AIResponse {
  ok: boolean;
  text: string;
  error?: string;
}

export type TimeRange = "today" | "yesterday" | "week" | "month" | "year" | string | null;
export type SortMode = "recent" | "popular" | "oldest";

export interface FileInfo {
  path: string;
  exists: boolean;
  is_dir: boolean;
  size: number;
  modified: string | null;
  is_image: boolean;
  is_text: boolean;
}

export interface AdvancedFilters {
  kinds?: ClipKind[];
  language?: string | null;
  size_min?: number | null;
  size_max?: number | null;
  use_count_min?: number | null;
  created_from?: string | null;
  created_to?: string | null;
  has_category?: boolean | null;
  has_tags?: boolean | null;
  tags?: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}
