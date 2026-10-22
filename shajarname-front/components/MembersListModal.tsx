"use client";

import { Button, Chip, CloseButton, Modal } from "@heroui/react";
import type { FamilyMember, MarriageNode } from "../lib/types";
import { avatarUrl } from "../lib/api";
import { isUnlinkedIsolate } from "../lib/layout";
import { formatMemberLabel } from "../lib/memberLabel";

export type MembersListMode = "pool" | "members";

interface MembersListModalProps {
  mode: MembersListMode;
  members: FamilyMember[];
  marriageNodes: MarriageNode[];
  lang: "fa" | "ar" | "en";
  isAdmin: boolean;
  isSaving?: boolean;
  selectedId?: string | null;
  lifeFilter: "all" | "alive" | "deceased";
  onLifeFilterChange?: (f: "all" | "alive" | "deceased") => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onPlaceOnCanvas?: (id: string) => void;
  onMoveToPool?: (id: string) => void;
  onEdit?: (id: string) => void;
  shouldBlur?: (m: FamilyMember) => boolean;
  labels: {
    poolTitle: string;
    membersTitle: string;
    poolEmpty: string;
    membersEmpty: string;
    poolAddToTree: string;
    poolRemoveFromTree: string;
    lifeFilterAll: string;
    lifeFilterAlive: string;
    lifeFilterDeceased: string;
    close: string;
    edit?: string;
  };
}

export default function MembersListModal({
  mode,
  members,
  marriageNodes,
  lang,
  isAdmin,
  isSaving = false,
  selectedId,
  lifeFilter,
  onLifeFilterChange,
  onClose,
  onSelect,
  onPlaceOnCanvas,
  onMoveToPool,
  onEdit,
  shouldBlur,
  labels,
}: MembersListModalProps) {
  const labelCtx = { members, marriages: marriageNodes };
  const displayName = (m: FamilyMember) => formatMemberLabel(m, lang, labelCtx);

  const list =
    mode === "pool"
      ? members.filter((m) => !m.assigned)
      : members.filter((m) => {
          if (!m.assigned) return false;
          if (lifeFilter === "alive" && m.death !== "living") return false;
          if (lifeFilter === "deceased" && m.death === "living") return false;
          return true;
        });

  const title = mode === "pool" ? labels.poolTitle : labels.membersTitle;
  const empty = mode === "pool" ? labels.poolEmpty : labels.membersEmpty;

  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      variant="blur"
    >
      <Modal.Container placement="center" size="md" scroll="inside">
        <Modal.Dialog
          className="surface-panel border border-white/50 rounded-3xl max-h-[min(85vh,640px)]"
          aria-label={title}
        >
          <Modal.Header className="flex flex-row items-center gap-2">
            <i
              className={`fa-solid ${mode === "pool" ? "fa-inbox" : "fa-users"} text-teal-700 shrink-0`}
            ></i>
            <Modal.Heading className="text-sm font-display font-bold truncate flex-1 min-w-0">
              {title}
            </Modal.Heading>
            <Chip size="sm" variant="soft" className="font-mono font-bold text-teal-800 shrink-0">
              {list.length}
            </Chip>
            <CloseButton
              aria-label={labels.close}
              className="shrink-0"
              onPress={onClose}
            />
          </Modal.Header>

          {mode === "members" && onLifeFilterChange && (
            <div className="px-6 pb-2">
              <div className="flex gap-1 surface-inset p-1 rounded-xl">
                {(["all", "alive", "deceased"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={lifeFilter === f ? "primary" : "tertiary"}
                    className="flex-1 text-[10px] font-bold min-h-8 h-8"
                    onPress={() => onLifeFilterChange(f)}
                  >
                    {f === "all"
                      ? labels.lifeFilterAll
                      : f === "alive"
                        ? labels.lifeFilterAlive
                        : labels.lifeFilterDeceased}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Modal.Body className="space-y-2 pt-0">
            {list.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-10">{empty}</p>
            ) : (
              list.map((member) => {
                const memberAvatar = avatarUrl(member.avatar);
                const isAlive = member.death === "living";
                const canMoveToPool =
                  mode === "members" && isUnlinkedIsolate(member, marriageNodes);
                const blur = shouldBlur?.(member) ?? false;

                return (
                  <div
                    key={member.id}
                    className={`relative z-0 flex items-center gap-2 p-2.5 rounded-2xl ${
                      selectedId === member.id
                        ? "surface-raised text-teal-800 ring-1 ring-teal-700/20"
                        : "bg-white/40 text-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(member.id)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
                    >
                      <div className="w-9 h-9 rounded-full surface-inset flex items-center justify-center overflow-hidden shrink-0">
                        {memberAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={memberAvatar}
                            alt=""
                            className={`w-full h-full object-cover ${blur ? "privacy-blur" : ""}`}
                          />
                        ) : (
                          <i
                            className={`fa-solid ${
                              member.gender === "f" ? "fa-venus text-teal-800/70" : "fa-mars text-teal-700"
                            } text-xs`}
                          ></i>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{displayName(member)}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{member.birth}</p>
                      </div>
                      {mode === "members" && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isAlive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                      )}
                    </button>

                    <div className="relative z-10 flex items-center gap-1 shrink-0">
                      {isAdmin && mode === "pool" && onPlaceOnCanvas && (
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={isSaving}
                          onPress={() => onPlaceOnCanvas(member.id)}
                          aria-label={labels.poolAddToTree}
                          className="min-w-8 w-8 h-8 p-0"
                        >
                          <i className="fa-solid fa-plus text-teal-800"></i>
                        </Button>
                      )}
                      {isAdmin && mode === "members" && canMoveToPool && onMoveToPool && (
                        <Button
                          size="sm"
                          variant="tertiary"
                          isDisabled={isSaving}
                          onPress={() => onMoveToPool(member.id)}
                          aria-label={labels.poolRemoveFromTree}
                          className="min-w-8 w-8 h-8 p-0"
                        >
                          <i className="fa-solid fa-inbox"></i>
                        </Button>
                      )}
                      {isAdmin && onEdit && (
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => onEdit(member.id)}
                          aria-label={labels.edit}
                          className="min-w-8 w-8 h-8 p-0"
                        >
                          <i className="fa-solid fa-pencil"></i>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
