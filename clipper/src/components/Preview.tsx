import { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Copy,
  Pin,
  Star,
  Trash2,
  Sparkles,
  Tag as TagIcon,
  Folder,
  Wand2,
  ExternalLink,
  Type as TypeIcon,
  Check,
  AlertCircle,
  File as FileIcon,
  FolderOpen,
  Image as ImageIcon,
  Eye,
  Languages,
  ChevronDown,
} from "lucide-react";
import { cn, humanBytes, timeAgo } from "@/lib/utils";
import type { ClipItem, AIResponse, FileInfo } from "@/types";
import { api } from "@/lib/api";

interface Props {
  clip: ClipItem | null;
  onUpdate: (c: ClipItem) => void;
  onDelete: (id: number) => void;
  aiOnline: boolean;
}

export function Preview({ clip, onUpdate, onDelete, aiOnline }: Props) {
  const [copyState, setCopyState] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState<AIResponse | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [editingCat, setEditingCat] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [catInput, setCatInput] = useState("");
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setAiOutput(null);
    setCopyState(null);
    setEditingTags(false);
    setEditingCat(false);
    if (clip) {
      setTagsInput(clip.tags.join(", "));
      setCatInput(clip.category || "");
    }
  }, [clip?.id]);

  useEffect(() => {
    if (clip && (clip.kind === "code" || clip.language) && codeRef.current) {
      try {
        codeRef.current.removeAttribute("data-highlighted");
        hljs.highlightElement(codeRef.current);
      } catch {}
    }
  }, [clip?.id, clip?.content, clip?.language]);

  if (!clip) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-10">
        <div className="max-w-sm animate-fade-in">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-ink-800 flex items-center justify-center mb-5">
            <Sparkles size={22} className="text-lime-400" />
          </div>
          <h2 className="font-display text-[22px] font-medium tracking-tight text-ink-50 mb-2">
            Aucune sélection
          </h2>
          <p className="text-[13px] text-ink-400 leading-relaxed">
            Copiez quelque chose, ou choisissez un élément à gauche pour le prévisualiser, le formater ou l'analyser avec l'IA locale.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-500">
            <kbd>Ctrl</kbd>
            <kbd>Shift</kbd>
            <kbd>V</kbd>
            <span className="ml-1">pour basculer la fenêtre</span>
          </div>
        </div>
      </div>
    );
  }

  const doCopy = async () => {
    await api.copyToClipboard(clip.id);
    flashCopy("Copié");
  };
  const flashCopy = (msg: string) => {
    setCopyState(msg);
    setTimeout(() => setCopyState(null), 1200);
  };

  const togglePin = async () => onUpdate(await api.togglePin(clip.id));
  const toggleFav = async () => onUpdate(await api.toggleFavorite(clip.id));

  const copyAs = async (
    fmt: "lowercase" | "uppercase" | "trim" | "json_escape" | "url_encode" | "base64"
  ) => {
    await api.copyAs(clip.id, fmt);
    flashCopy(`Copié (${fmt})`);
  };

  const askAI = async (kind: "summarize" | "explain" | "rephrase" | "fix" | "smart_tag") => {
    setAiBusy(true);
    setAiOutput(null);
    try {
      const res =
        kind === "summarize"
          ? await api.aiSummarize(clip.id)
          : kind === "explain"
          ? await api.aiExplain(clip.id)
          : kind === "rephrase"
          ? await api.aiRephrase(clip.id, "professionnel et concis")
          : kind === "fix"
          ? await api.aiFixGrammar(clip.id)
          : await api.aiSmartTag(clip.id);
      setAiOutput(res);
    } catch (e: any) {
      setAiOutput({ ok: false, text: "", error: String(e) });
    } finally {
      setAiBusy(false);
    }
  };

  const askTranslate = async (lang: string) => {
    setAiBusy(true);
    setAiOutput(null);
    try {
      const res = await api.aiTranslate(clip.id, lang);
      setAiOutput(res);
    } catch (e: any) {
      setAiOutput({ ok: false, text: "", error: String(e) });
    } finally {
      setAiBusy(false);
    }
  };

  const saveTags = async () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);
    onUpdate(await api.updateTags(clip.id, tags));
    setEditingTags(false);
  };

  const saveCat = async () => {
    const c = catInput.trim();
    onUpdate(await api.updateCategory(clip.id, c || null));
    setEditingCat(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-ink-900/30 animate-fade-in" data-testid="preview-pane">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-ink-700/60">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 text-[10.5px] font-mono uppercase tracking-wider text-ink-400">
              <span className="text-lime-400">{clip.kind}</span>
              {clip.language && (
                <>
                  <span>·</span>
                  <span>{clip.language}</span>
                </>
              )}
              <span>·</span>
              <span>{humanBytes(clip.size_bytes)}</span>
              <span>·</span>
              <span>il y a {timeAgo(clip.used_at)}</span>
              {clip.use_count > 1 && (
                <>
                  <span>·</span>
                  <span>utilisé {clip.use_count}×</span>
                </>
              )}
            </div>
            <h2 className="font-display text-[17px] font-medium text-ink-50 truncate leading-snug">
              {clip.kind === "image"
                ? `Image (${clip.preview})`
                : clip.preview.slice(0, 96)}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn onClick={togglePin} active={clip.pinned} testid="btn-pin" title="Épingler">
              <Pin size={14} className={clip.pinned ? "fill-lime-400" : ""} />
            </IconBtn>
            <IconBtn onClick={toggleFav} active={clip.favorite} testid="btn-favorite" title="Favori">
              <Star size={14} className={clip.favorite ? "fill-amber-400 text-amber-400" : ""} />
            </IconBtn>
            <IconBtn
              onClick={() => {
                if (confirm("Supprimer cet élément ?")) onDelete(clip.id);
              }}
              danger
              testid="btn-delete"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </IconBtn>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4">
          <ActionBtn onClick={doCopy} primary testid="btn-copy">
            <Copy size={12.5} /> Copier
            {copyState && <Check size={12} className="text-lime-400 ml-1" />}
          </ActionBtn>
          {clip.kind !== "image" && clip.kind !== "file" && (
            <>
              <ActionBtn onClick={() => copyAs("trim")} testid="btn-copy-trim">
                <TypeIcon size={12.5} /> Trim
              </ActionBtn>
              <ActionBtn onClick={() => copyAs("lowercase")} testid="btn-copy-lower">
                aa
              </ActionBtn>
              <ActionBtn onClick={() => copyAs("uppercase")} testid="btn-copy-upper">
                AA
              </ActionBtn>
              <ActionBtn onClick={() => copyAs("json_escape")} testid="btn-copy-json">
                {`{}`} JSON
              </ActionBtn>
              <ActionBtn onClick={() => copyAs("url_encode")} testid="btn-copy-url">
                URL
              </ActionBtn>
              <ActionBtn onClick={() => copyAs("base64")} testid="btn-copy-b64">
                Base64
              </ActionBtn>
            </>
          )}
          {clip.kind === "url" && (
            <ActionBtn
              onClick={async () => {
                try {
                  await openUrl(clip.content);
                } catch (e) {
                  console.error("openUrl failed", e);
                }
              }}
              testid="btn-open"
            >
              <ExternalLink size={12.5} /> Ouvrir
            </ActionBtn>
          )}
        </div>

        {/* AI actions */}
        {clip.kind !== "image" && clip.kind !== "file" && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10.5px] uppercase tracking-wider text-ink-500 font-mono mr-1">
              IA
            </span>
            <ActionBtn
              onClick={() => askAI("summarize")}
              disabled={aiBusy || !aiOnline}
              testid="btn-ai-summarize"
            >
              <Sparkles size={12} /> Résumer
            </ActionBtn>
            <ActionBtn
              onClick={() => askAI("explain")}
              disabled={aiBusy || !aiOnline}
              testid="btn-ai-explain"
            >
              <Wand2 size={12} /> Expliquer
            </ActionBtn>
            <ActionBtn
              onClick={() => askAI("rephrase")}
              disabled={aiBusy || !aiOnline}
              testid="btn-ai-rephrase"
            >
              Reformuler
            </ActionBtn>
            <ActionBtn
              onClick={() => askAI("fix")}
              disabled={aiBusy || !aiOnline}
              testid="btn-ai-fix"
            >
              ✓ Corriger
            </ActionBtn>
            <TranslateMenu disabled={aiBusy || !aiOnline} onPick={askTranslate} />
            <ActionBtn
              onClick={() => askAI("smart_tag")}
              disabled={aiBusy || !aiOnline}
              testid="btn-ai-smart-tag"
            >
              <Sparkles size={12} /> Étiqueter
            </ActionBtn>
            {!aiOnline && (
              <span className="text-[10.5px] text-ink-500 italic">
                Configurer dans Paramètres → IA
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {clip.kind === "image" ? (
          <div className="flex items-center justify-center h-full">
            <img
              src={`data:image/png;base64,${clip.content}`}
              alt="clip"
              className="max-w-full max-h-full rounded-lg border border-ink-700/60 shadow-2xl"
            />
          </div>
        ) : clip.kind === "file" ? (
          <FileList content={clip.content} />
        ) : (
          <pre className="selectable text-ink-100 leading-relaxed whitespace-pre-wrap break-words rounded-xl bg-ink-900/60 border border-ink-700/60 p-5">
            <code
              ref={codeRef}
              className={clip.language ? `language-${clip.language}` : "language-plaintext"}
              data-testid="preview-content"
            >
              {clip.content}
            </code>
          </pre>
        )}

        {aiOutput && (
          <div className="mt-5 rounded-xl border border-lime-400/30 bg-lime-400/[0.04] p-4 animate-slide-up" data-testid="ai-output">
            <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-lime-400 font-mono">
              <Sparkles size={11} /> Réponse IA
            </div>
            {aiOutput.ok ? (
              <p className="selectable text-[13.5px] text-ink-100 leading-relaxed whitespace-pre-wrap">
                {aiOutput.text}
              </p>
            ) : (
              <p className="text-[13px] text-red-300/90">
                {aiOutput.error || "Erreur inconnue. Ollama est-il lancé ?"}
              </p>
            )}
          </div>
        )}

        {aiBusy && (
          <div className="mt-5 text-[12px] text-ink-400 font-mono animate-pulse">
            ⌁ génération en cours…
          </div>
        )}
      </div>

      {/* Meta footer */}
      <div className="px-6 py-3 border-t border-ink-700/60 flex flex-wrap items-center gap-3 text-[12px]">
        <MetaBlock
          icon={<Folder size={11} />}
          label="Catégorie"
          editing={editingCat}
          value={clip.category}
          input={catInput}
          setInput={setCatInput}
          onSave={saveCat}
          onEdit={() => setEditingCat(true)}
          onCancel={() => setEditingCat(false)}
          placeholder="ex: Travail"
          testid="meta-category"
        />
        <MetaBlock
          icon={<TagIcon size={11} />}
          label="Tags"
          editing={editingTags}
          value={clip.tags.length ? clip.tags.map((t) => `#${t}`).join(" ") : null}
          input={tagsInput}
          setInput={setTagsInput}
          onSave={saveTags}
          onEdit={() => setEditingTags(true)}
          onCancel={() => setEditingTags(false)}
          placeholder="ex: api, doc, urgent"
          testid="meta-tags"
        />
        {clip.source_app && (
          <span className="text-ink-500 font-mono text-[10.5px]">
            via {clip.source_app}
          </span>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  active,
  danger,
  testid,
  title,
}: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-ink-50",
        active ? "bg-lime-400/15 text-lime-400 hover:text-lime-400" : "hover:bg-ink-800",
        danger && "hover:bg-red-500/15 hover:text-red-300"
      )}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  primary,
  disabled,
  testid,
}: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        primary
          ? "bg-lime-400 text-ink-900 border-lime-400 hover:bg-lime-300"
          : "bg-ink-800/70 text-ink-200 border-ink-700 hover:bg-ink-700/70 hover:text-ink-50"
      )}
    >
      {children}
    </button>
  );
}

function MetaBlock({
  icon,
  label,
  editing,
  value,
  input,
  setInput,
  onSave,
  onEdit,
  onCancel,
  placeholder,
  testid,
}: any) {
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      <span className="text-ink-500 inline-flex items-center gap-1 text-[11px]">
        {icon} {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            className="h-6 px-2 rounded bg-ink-800 border border-ink-700 text-[12px] text-ink-50 focus-ring w-44"
            data-testid={`${testid}-input`}
          />
          <button
            onClick={onSave}
            className="text-[11px] text-lime-400 hover:underline"
            data-testid={`${testid}-save`}
          >
            ok
          </button>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="text-ink-100 text-[12px] hover:text-lime-400"
          data-testid={`${testid}-edit`}
        >
          {value || <span className="italic text-ink-500">aucun</span>}
        </button>
      )}
    </div>
  );
}


function FileList({ content }: { content: string }) {
  const paths = useMemo<string[]>(() => {
    try {
      const v = JSON.parse(content);
      return Array.isArray(v) ? v : [];
    } catch {
      return content.split("\n").filter(Boolean);
    }
  }, [content]);

  const [infos, setInfos] = useState<FileInfo[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setInfos(null);
    setPreviews({});
    setPreviewError({});
    if (!paths.length) return;
    api.checkPaths(paths).then((res) => {
      setInfos(res);
      res
        .filter((i) => i.exists && i.is_image && !i.is_dir)
        .slice(0, 8)
        .forEach((i) => loadPreview(i.path));
    });
  }, [paths.join("\n")]);

  const loadPreview = async (path: string) => {
    try {
      const data = await api.readImageB64(path);
      setPreviews((prev) => ({ ...prev, [path]: data }));
    } catch (e: any) {
      setPreviewError((prev) => ({ ...prev, [path]: String(e) }));
    }
  };

  const doOpen = async (path: string) => {
    setActionError(null);
    try {
      await api.openPath(path);
    } catch (e: any) {
      setActionError(String(e));
    }
  };
  const doReveal = async (path: string) => {
    setActionError(null);
    try {
      await api.revealInFolder(path);
    } catch (e: any) {
      setActionError(String(e));
    }
  };

  if (!paths.length) {
    return <div className="text-ink-400 text-[13px]">(aucun fichier)</div>;
  }

  return (
    <div className="space-y-2" data-testid="file-list">
      {actionError && (
        <div className="rounded-md border border-red-500/40 bg-red-500/[0.06] text-red-300 text-[12px] px-3 py-2">
          ⚠ {actionError}
        </div>
      )}
      {paths.map((p, i) => {
        const name = p.split(/[\\/]/).filter(Boolean).pop() || p;
        const dir = p.slice(0, p.length - name.length);
        const info = infos?.[i];
        const preview = previews[p];
        const err = previewError[p];
        const missing = info ? !info.exists : false;

        return (
          <div
            key={`${p}-${i}`}
            className={cn(
              "rounded-xl border bg-ink-900/60 overflow-hidden selectable",
              missing ? "border-red-500/40 bg-red-500/[0.04]" : "border-ink-700/60"
            )}
            data-testid={`file-row-${i}`}
          >
            <div className="px-4 py-3 flex items-start gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                  missing
                    ? "bg-red-500/15 text-red-400"
                    : info?.is_dir
                    ? "bg-amber-400/15 text-amber-400"
                    : info?.is_image
                    ? "bg-lime-500/15 text-lime-500"
                    : "bg-ink-800 text-ink-300"
                )}
              >
                {missing ? (
                  <AlertCircle size={15} />
                ) : info?.is_dir ? (
                  <FolderOpen size={15} />
                ) : info?.is_image ? (
                  <ImageIcon size={15} />
                ) : (
                  <FileIcon size={15} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={cn("text-[13px] font-medium truncate", missing ? "text-red-300" : "text-ink-50")}>
                    {name}
                  </div>
                  {info && (
                    <Badge tone={missing ? "danger" : "neutral"}>
                      {missing ? "introuvable" : info.is_dir ? "dossier" : humanBytes(info.size)}
                    </Badge>
                  )}
                  {info && !missing && info.modified && (
                    <span className="text-[10.5px] text-ink-500 font-mono">
                      modifié il y a {timeAgo(info.modified)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-400 font-mono truncate mt-0.5">
                  {dir || p}
                </div>

                {/* Quick file actions */}
                {!missing && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <FileActionBtn
                      onClick={() => doOpen(p)}
                      testid={`file-open-${i}`}
                      icon={<ExternalLink size={11} />}
                    >
                      Ouvrir
                    </FileActionBtn>
                    <FileActionBtn
                      onClick={() => doReveal(p)}
                      testid={`file-reveal-${i}`}
                      icon={<FolderOpen size={11} />}
                    >
                      Localiser
                    </FileActionBtn>
                  </div>
                )}

                {/* Image preview */}
                {info?.is_image && !missing && (
                  <div className="mt-3">
                    {preview ? (
                      <img
                        src={preview}
                        alt={name}
                        data-testid={`file-preview-${i}`}
                        className="max-h-64 max-w-full rounded-lg border border-ink-700/60"
                      />
                    ) : err ? (
                      <div className="text-[11.5px] text-red-300">⚠ {err}</div>
                    ) : (
                      <button
                        onClick={() => loadPreview(p)}
                        className="inline-flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-lime-500"
                        data-testid={`file-load-preview-${i}`}
                      >
                        <Eye size={11} /> Aperçu
                      </button>
                    )}
                  </div>
                )}

                {missing && (
                  <div className="text-[11.5px] text-red-300/90 mt-1.5">
                    Ce fichier n'existe plus à cet emplacement.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FileActionBtn({
  onClick,
  testid,
  icon,
  children,
}: {
  onClick: () => void;
  testid: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-ink-50"
    >
      {icon}
      {children}
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "danger";
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded",
        tone === "danger"
          ? "bg-red-500/15 text-red-300"
          : "bg-ink-800 text-ink-300"
      )}
    >
      {children}
    </span>
  );
}


const LANGUAGES = [
  { v: "français", label: "Français" },
  { v: "anglais", label: "English" },
  { v: "espagnol", label: "Español" },
  { v: "allemand", label: "Deutsch" },
  { v: "italien", label: "Italiano" },
  { v: "portugais", label: "Português" },
  { v: "japonais", label: "日本語" },
  { v: "chinois", label: "中文" },
];

function TranslateMenu({ disabled, onPick }: { disabled: boolean; onPick: (lang: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-translate-menu]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" data-translate-menu>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        data-testid="btn-ai-translate"
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
          "bg-ink-800/70 text-ink-200 border-ink-700 hover:bg-ink-700/70 hover:text-ink-50"
        )}
      >
        <Languages size={12} /> Traduire <ChevronDown size={10} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 rounded-md border border-ink-700 bg-ink-900 shadow-2xl py-1 min-w-[160px] animate-fade-in" data-testid="translate-menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.v}
              onClick={() => {
                setOpen(false);
                onPick(l.v);
              }}
              data-testid={`translate-${l.v}`}
              className="w-full text-left px-3 py-1.5 text-[12px] text-ink-200 hover:bg-ink-800 hover:text-ink-50"
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
