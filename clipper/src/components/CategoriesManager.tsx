import { useEffect, useState } from "react";
import { X, Folder, Tag, Pencil, Trash2, Check, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type Tab = "categories" | "tags";

export function CategoriesManager({ open, onClose, onChanged }: Props) {
  const [tab, setTab] = useState<Tab>("categories");
  const [cats, setCats] = useState<[string, number][]>([]);
  const [tags, setTags] = useState<[string, number][]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const reload = async () => {
    if (tab === "categories") {
      setCats(await api.categoryCounts());
    } else {
      setTags(await api.tagCounts());
    }
  };

  useEffect(() => {
    if (open) reload();
  }, [open, tab]);

  if (!open) return null;

  const items = tab === "categories" ? cats : tags;
  const empty = tab === "categories" ? "Aucune catégorie pour le moment." : "Aucun tag pour le moment.";

  const saveRename = async (oldName: string) => {
    const newName = draft.trim();
    if (!newName || newName === oldName) {
      setEditing(null);
      return;
    }
    if (tab === "categories") await api.renameCategory(oldName, newName);
    else await api.renameTag(oldName, newName);
    setEditing(null);
    setDraft("");
    await reload();
    onChanged();
  };

  const doDelete = async (name: string) => {
    if (tab === "categories") await api.deleteCategory(name);
    else await api.deleteTag(name);
    setDeleteConfirm(null);
    await reload();
    onChanged();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
      onClick={onClose}
      data-testid="catman-overlay"
    >
      <div
        className="w-[600px] max-h-[80vh] flex flex-col overflow-hidden rounded-2xl glass border border-ink-700 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        data-testid="catman-dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-700/60">
          <h2 className="font-display text-[17px] font-medium tracking-tight text-ink-50">
            Catégories &amp; Tags
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-ink-800 flex items-center justify-center text-ink-300"
            data-testid="catman-close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-ink-700/60 flex gap-1">
          <TabBtn active={tab === "categories"} onClick={() => setTab("categories")} testid="catman-tab-categories">
            <Folder size={13} /> Catégories ({cats.length})
          </TabBtn>
          <TabBtn active={tab === "tags"} onClick={() => setTab("tags")} testid="catman-tab-tags">
            <Tag size={13} /> Tags ({tags.length})
          </TabBtn>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="mb-4 text-[11.5px] text-ink-400 leading-relaxed bg-ink-800/40 border border-ink-700/40 rounded-lg p-3">
            <strong className="text-ink-200">💡 Astuce :</strong> pour ajouter une nouvelle{" "}
            {tab === "categories" ? "catégorie" : "étiquette"}, sélectionnez un clip et cliquez sur «{" "}
            {tab === "categories" ? "Catégorie" : "Tags"} » dans le pied de l'aperçu, puis tapez le nom souhaité.
            <br />
            Vous pouvez aussi laisser l'IA suggérer automatiquement via le bouton{" "}
            <span className="text-lime-500 font-medium">✨ Étiqueter</span> du panneau d'aperçu.
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 text-[13px] text-ink-400">{empty}</div>
          ) : (
            <div className="space-y-1.5" data-testid={`catman-list-${tab}`}>
              {items.map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-800/40 border border-ink-700/40"
                  data-testid={`catman-row-${name}`}
                >
                  {tab === "categories" ? (
                    <Folder size={13} className="text-lime-500 shrink-0" />
                  ) : (
                    <Tag size={13} className="text-lime-500 shrink-0" />
                  )}

                  {editing === name ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(name);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="flex-1 h-7 px-2 rounded bg-ink-800 border border-ink-700 text-[13px] text-ink-50 focus-ring"
                    />
                  ) : (
                    <span className="flex-1 text-[13px] text-ink-50 truncate">
                      {tab === "tags" ? `#${name}` : name}
                    </span>
                  )}

                  <span className="text-[10.5px] font-mono text-ink-500 tabular-nums">
                    {count} clip{count > 1 ? "s" : ""}
                  </span>

                  {editing === name ? (
                    <IconBtn onClick={() => saveRename(name)} title="Enregistrer">
                      <Check size={12} className="text-lime-500" />
                    </IconBtn>
                  ) : (
                    <>
                      <IconBtn
                        onClick={() => {
                          setEditing(name);
                          setDraft(name);
                        }}
                        title="Renommer"
                        testid={`catman-rename-${name}`}
                      >
                        <Pencil size={11} />
                      </IconBtn>
                      <IconBtn
                        onClick={() => setDeleteConfirm(name)}
                        title="Supprimer"
                        testid={`catman-delete-${name}`}
                        danger
                      >
                        <Trash2 size={11} />
                      </IconBtn>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {deleteConfirm && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/[0.08] p-4 animate-slide-up">
              <div className="text-[13px] text-ink-50 font-medium mb-1">
                Supprimer {tab === "categories" ? "la catégorie" : "le tag"}{" "}
                <span className="font-mono text-red-300">
                  {tab === "tags" ? "#" : ""}
                  {deleteConfirm}
                </span> ?
              </div>
              <div className="text-[11.5px] text-ink-400 mb-3">
                {tab === "categories"
                  ? "Les clips ne seront pas supprimés, leur catégorie sera simplement retirée."
                  : "Le tag sera retiré de tous les clips concernés. Les clips eux-mêmes sont préservés."}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="h-8 px-3 rounded-md text-[12px] font-medium border border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700"
                  data-testid="catman-confirm-cancel"
                >
                  Annuler
                </button>
                <button
                  onClick={() => doDelete(deleteConfirm)}
                  className="h-8 px-3 rounded-md text-[12px] font-semibold bg-red-500 text-white hover:bg-red-600"
                  data-testid="catman-confirm-delete"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children, testid }: any) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-t-md text-[12px] font-medium border-b-2 -mb-px",
        active
          ? "border-lime-500 text-ink-50"
          : "border-transparent text-ink-400 hover:text-ink-100"
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
  testid?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      data-testid={testid}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-50 hover:bg-ink-700",
        danger && "hover:bg-red-500/20 hover:text-red-300"
      )}
    >
      {children}
    </button>
  );
}
