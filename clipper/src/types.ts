export type ClipKind = "text" | "image" | "code" | "url" | "file";

export interface ClipItem {
  id: number;
  kind: ClipKind;
  content: string;           // text content; for images, base64 PNG; for files, JSON list
  preview: string;           // truncated preview
  language?: string | null;  // detected code language
  category?: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  source_app?: string | null;
  size_bytes: number;
  hash: string;
  created_at: string;        // ISO
  used_at: string;           // ISO
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

export interface Settings {
  theme: "dark" | "light" | "auto";
  max_items: number;
  shortcut: string;
  launch_at_startup: boolean;
  monitor_paused: boolean;
  ignore_apps: string[];
  ollama_url: string;
  ollama_model: string;
  auto_delete_days: number;     // 0 = never
  keep_favorites: boolean;
  keep_pinned: boolean;
}

export interface AIResponse {
  ok: boolean;
  text: string;
  error?: string;
}

export type TimeRange = "today" | "yesterday" | "week" | "month" | "year" | null;
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
