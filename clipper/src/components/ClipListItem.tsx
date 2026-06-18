import { memo } from "react";
import {
  Pin,
  Star,
  Image as ImageIcon,
  Code2,
  Link2,
  Type,
  File as FileIcon,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { ClipItem } from "@/types";

interface Props {
  clip: ClipItem;
  active: boolean;
  onSelect: () => void;
}

const kindIcon = {
  text: Type,
  image: ImageIcon,
  code: Code2,
  url: Link2,
  file: FileIcon,
};

export const ClipListItem = memo(function ClipListItem({
  clip,
  active,
  onSelect,
}: Props) {
  const Icon = kindIcon[clip.kind];

  return (
    <button
      onClick={onSelect}
      data-testid={`clip-item-${clip.id}`}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-ink-700/40 group relative transition-colors",
        active
          ? "bg-ink-700/40"
          : "hover:bg-ink-800/50"
      )}
    >
      {/* Active indicator */}
      {active && (
        <div className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-lime-400 rounded-r" />
      )}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 mt-0.5 w-7 h-7 rounded-md flex items-center justify-center",
            active ? "bg-lime-400/15 text-lime-400" : "bg-ink-800 text-ink-400"
          )}
        >
          <Icon size={13} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {clip.pinned && <Pin size={10} className="text-lime-400 fill-lime-400" />}
            {clip.favorite && <Star size={10} className="text-amber-400 fill-amber-400" />}
            {clip.language && (
              <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-300 uppercase">
                {clip.language}
              </span>
            )}
            {clip.category && (
              <span className="text-[10px] text-lime-400/90 font-medium truncate">
                {clip.category}
              </span>
            )}
          </div>

          {clip.kind === "image" ? (
            <div className="text-[12.5px] text-ink-300 font-mono">
              📷 Image · {clip.preview}
            </div>
          ) : (
            <div className="text-[13px] text-ink-100 line-clamp-2 leading-snug break-words">
              {clip.preview}
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-ink-500 font-mono">
            <span>{timeAgo(clip.used_at)}</span>
            {clip.use_count > 1 && (
              <>
                <span>·</span>
                <span>{clip.use_count}×</span>
              </>
            )}
            {clip.tags.length > 0 && (
              <>
                <span>·</span>
                <span className="truncate">
                  {clip.tags.map((t) => `#${t}`).join(" ")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});
