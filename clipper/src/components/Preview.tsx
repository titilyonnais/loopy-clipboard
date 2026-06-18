import { useEffect, useMemo, useRef, useState } from "react";
import hljs from "highlight.js";
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
} from "lucide-react";
import { cn, humanBytes, timeAgo } from "@/lib/utils";
import type { ClipItem, AIResponse } from "@/types";
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

  const askAI = async (kind: "summarize" | "explain" | "rephrase") => {
    setAiBusy(true);
    setAiOutput(null);
    try {
      const res =
        kind === "summarize"
          ? await api.aiSummarize(clip.id)
          : kind === "explain"
          ? await api.aiExplain(clip.id)
          : await api.aiRephrase(clip.id, "professionnel et concis");
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
          {clip.kind !== "image" && (
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
              onClick={() => window.open(clip.content, "_blank")}
              testid="btn-open"
            >
              <ExternalLink size={12.5} /> Ouvrir
            </ActionBtn>
          )}
        </div>

        {/* AI actions */}
        {clip.kind !== "image" && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10.5px] uppercase tracking-wider text-ink-500 font-mono mr-1">
              IA locale
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
            {!aiOnline && (
              <span className="text-[10.5px] text-ink-500 italic">
                Ollama indisponible — voir Paramètres
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
