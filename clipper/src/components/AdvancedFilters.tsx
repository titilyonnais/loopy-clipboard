import { useEffect, useState } from "react";
import { X, Filter, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import type { AdvancedFilters as Filters, ClipKind } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onChange: (v: Filters) => void;
}

const KIND_OPTIONS: { v: ClipKind; label: string }[] = [
  { v: "text", label: "Texte" },
  { v: "code", label: "Code" },
  { v: "url", label: "Lien" },
  { v: "image", label: "Image" },
  { v: "file", label: "Fichier" },
];

export function AdvancedFilters({ open, onClose, value, onChange }: Props) {
  const [draft, setDraft] = useState<Filters>(value);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allLanguages, setAllLanguages] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setDraft(value);
      api.tags().then(setAllTags);
      api.languages().then(setAllLanguages);
    }
  }, [open]);

  if (!open) return null;

  const apply = () => {
    onChange(draft);
    onClose();
  };
  const reset = () => {
    const empty: Filters = {};
    setDraft(empty);
    onChange(empty);
  };

  const toggleKind = (k: ClipKind) => {
    const cur = draft.kinds || [];
    setDraft({
      ...draft,
      kinds: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
    });
  };

  const toggleTag = (t: string) => {
    const cur = draft.tags || [];
    setDraft({
      ...draft,
      tags: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
      data-testid="adv-filters-overlay"
    >
      <div
        className="w-[600px] max-h-[85vh] overflow-auto rounded-2xl glass border border-ink-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="adv-filters-dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60 sticky top-0 glass z-10">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-lime-500" />
            <h2 className="font-display text-[17px] font-medium tracking-tight text-ink-50">
              Filtres avancés
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-ink-800 flex items-center justify-center text-ink-300"
            data-testid="adv-filters-close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Types */}
          <Field label="Types de contenu">
            <div className="flex flex-wrap gap-1.5">
              {KIND_OPTIONS.map((k) => {
                const active = (draft.kinds || []).includes(k.v);
                return (
                  <button
                    key={k.v}
                    onClick={() => toggleKind(k.v)}
                    data-testid={`adv-kind-${k.v}`}
                    className={cn(
                      "px-3 h-8 rounded-md text-[12px] font-medium border",
                      active
                        ? "bg-lime-500 text-ink-950 border-lime-500"
                        : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                    )}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Language */}
          {allLanguages.length > 0 && (
            <Field label="Langage de programmation">
              <div className="flex flex-wrap gap-1.5">
                <ChipBtn
                  active={!draft.language}
                  onClick={() => setDraft({ ...draft, language: null })}
                >
                  tous
                </ChipBtn>
                {allLanguages.map((l) => (
                  <ChipBtn
                    key={l}
                    active={draft.language === l}
                    onClick={() => setDraft({ ...draft, language: l })}
                  >
                    {l}
                  </ChipBtn>
                ))}
              </div>
            </Field>
          )}

          {/* Date range */}
          <Field label="Plage de dates (date de capture)" hint="Format YYYY-MM-DD">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draft.created_from || ""}
                onChange={(e) =>
                  setDraft({ ...draft, created_from: e.target.value || null })
                }
                data-testid="adv-date-from"
                className="h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[12.5px] text-ink-50 focus-ring"
              />
              <span className="text-ink-400 text-[12px]">→</span>
              <input
                type="date"
                value={draft.created_to || ""}
                onChange={(e) =>
                  setDraft({ ...draft, created_to: e.target.value || null })
                }
                data-testid="adv-date-to"
                className="h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[12.5px] text-ink-50 focus-ring"
              />
            </div>
          </Field>

          {/* Size */}
          <Field label="Taille (Ko)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="min"
                value={draft.size_min != null ? Math.round(draft.size_min / 1024) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    size_min: v === "" ? null : Math.max(0, parseInt(v) * 1024),
                  });
                }}
                data-testid="adv-size-min"
                className="w-28 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[12.5px] text-ink-50 focus-ring"
              />
              <span className="text-ink-400 text-[12px]">→</span>
              <input
                type="number"
                min={0}
                placeholder="max"
                value={draft.size_max != null ? Math.round(draft.size_max / 1024) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({
                    ...draft,
                    size_max: v === "" ? null : Math.max(0, parseInt(v) * 1024),
                  });
                }}
                data-testid="adv-size-max"
                className="w-28 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[12.5px] text-ink-50 focus-ring"
              />
            </div>
          </Field>

          {/* Use count */}
          <Field label="Utilisé au moins N fois">
            <input
              type="number"
              min={0}
              placeholder="ex: 3"
              value={draft.use_count_min ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({
                  ...draft,
                  use_count_min: v === "" ? null : Math.max(0, parseInt(v)),
                });
              }}
              data-testid="adv-use-count"
              className="w-28 h-9 px-3 rounded-md bg-ink-800 border border-ink-700 text-[12.5px] text-ink-50 focus-ring"
            />
          </Field>

          {/* Category presence */}
          <Field label="Catégorie">
            <div className="flex gap-1.5">
              <ChipBtn
                active={draft.has_category == null}
                onClick={() => setDraft({ ...draft, has_category: null })}
              >
                indifférent
              </ChipBtn>
              <ChipBtn
                active={draft.has_category === true}
                onClick={() => setDraft({ ...draft, has_category: true })}
              >
                avec catégorie
              </ChipBtn>
              <ChipBtn
                active={draft.has_category === false}
                onClick={() => setDraft({ ...draft, has_category: false })}
              >
                sans catégorie
              </ChipBtn>
            </div>
          </Field>

          {/* Tags presence + select */}
          <Field label="Tags">
            <div className="flex gap-1.5 mb-2">
              <ChipBtn
                active={draft.has_tags == null}
                onClick={() => setDraft({ ...draft, has_tags: null, tags: [] })}
              >
                indifférent
              </ChipBtn>
              <ChipBtn
                active={draft.has_tags === true}
                onClick={() => setDraft({ ...draft, has_tags: true })}
              >
                avec tags
              </ChipBtn>
              <ChipBtn
                active={draft.has_tags === false}
                onClick={() => setDraft({ ...draft, has_tags: false, tags: [] })}
              >
                sans tag
              </ChipBtn>
            </div>
            {allTags.length > 0 && draft.has_tags !== false && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => {
                  const active = (draft.tags || []).includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      data-testid={`adv-tag-${t}`}
                      className={cn(
                        "px-2 h-7 rounded-md text-[11.5px] font-medium border",
                        active
                          ? "bg-lime-500 text-ink-950 border-lime-500"
                          : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
                      )}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-ink-700/60 flex items-center gap-2 sticky bottom-0 glass">
          <button
            onClick={reset}
            data-testid="adv-filters-reset"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[12.5px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
          >
            <RotateCcw size={12} /> Réinitialiser
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-md text-[12.5px] font-medium text-ink-300 hover:text-ink-50"
          >
            Annuler
          </button>
          <button
            onClick={apply}
            data-testid="adv-filters-apply"
            className="h-9 px-4 rounded-md text-[12.5px] font-semibold bg-lime-500 text-ink-950 hover:bg-lime-300"
          >
            Appliquer
          </button>
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

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 h-7 rounded-md text-[11.5px] font-medium border",
        active
          ? "bg-lime-500 text-ink-950 border-lime-500"
          : "bg-ink-800 text-ink-200 border-ink-700 hover:bg-ink-700"
      )}
    >
      {children}
    </button>
  );
}

/** Count how many advanced filters are active. */
export function countActive(f: Filters): number {
  let n = 0;
  if (f.kinds && f.kinds.length) n++;
  if (f.language) n++;
  if (f.created_from || f.created_to) n++;
  if (f.size_min != null || f.size_max != null) n++;
  if (f.use_count_min != null) n++;
  if (f.has_category != null) n++;
  if (f.has_tags != null) n++;
  if (f.tags && f.tags.length) n++;
  return n;
}
