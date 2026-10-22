"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/react";
import type { FamilyMember, MarriageNode } from "../lib/types";
import { avatarUrl } from "../lib/api";
import { formatMemberPrimaryName, formatMemberSubtitle } from "../lib/memberLabel";
import PanelHeader from "./PanelHeader";

interface ProfileSidebarProps {
  member: FamilyMember | null;
  members: FamilyMember[];
  marriages: MarriageNode[];
  lang: "fa" | "ar" | "en";
  isMahram: boolean | null;
  relationshipToViewer: string | null;
  viewerLabel?: string | null;
  isMemberRole?: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  labels: {
    title: string;
    bio: string;
    lifespan: string;
    gender: string;
    mobile: string;
    mahramStatus: string;
    mahramYes: string;
    mahramNo: string;
    relationToYou: string;
    btnEdit: string;
    btnAddChild: string;
    btnDelete?: string;
    alive: string;
    deceased: string;
    male: string;
    female: string;
    gallery: string;
    audioMemories: string;
  };
  side: "left" | "right";
}

export default function ProfileSidebar({
  member,
  members,
  marriages,
  lang,
  isMahram,
  relationshipToViewer,
  viewerLabel,
  isMemberRole,
  onClose,
  onEdit,
  onAddChild,
  onDelete,
  isAdmin = false,
  labels,
  side,
}: ProfileSidebarProps) {
  const [fullImage, setFullImage] = useState<string | null>(null);

  if (!member) return null;

  const isBlurred = member.gender === "f" && isMahram === false && (Boolean(isMemberRole) || member.privacy);
  const displayName = formatMemberPrimaryName(member, lang);
  const subtitle = formatMemberSubtitle(member, lang, { members, marriages });
  const memberAvatar = avatarUrl(member.avatar);
  const deathText =
    member.death === "living"
      ? labels.alive
      : `${labels.deceased} ${member.death}`;

  return (
    <aside
      className={`fixed top-20 md:top-24 bottom-20 md:bottom-24 z-[35] w-[calc(100vw-2rem)] md:w-80 max-w-sm flex flex-col pointer-events-none transition-all duration-500 ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      <div className="pointer-events-auto w-full h-full surface-panel p-5 rounded-3xl flex flex-col border border-white/50">
        <PanelHeader
          className="mb-2"
          onClose={onClose}
          closeLabel={lang === "fa" ? "بستن" : lang === "ar" ? "إغلاق" : "Close"}
          title={
            <p className="text-[10px] font-bold text-slate-400 tracking-wide">
              {labels.title}
            </p>
          }
        />

        <div className="flex flex-col items-center pb-4 border-b border-teal-900/10">
          <div className="w-16 h-16 rounded-full surface-inset flex items-center justify-center text-2xl relative overflow-hidden mb-3">
            {member.gender === "f" ? (
              <>
                <svg className="w-6 h-6 text-teal-800/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="5" />
                  <line x1="12" y1="13" x2="12" y2="21" />
                  <line x1="9" y1="17" x2="15" y2="17" />
                </svg>
                {isBlurred && (
                  <div className="absolute inset-0 privacy-blur flex items-center justify-center">
                    <i className="fa-solid fa-lock text-xs text-teal-800"></i>
                  </div>
                )}
              </>
            ) : (
              <svg className="w-6 h-6 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="14" r="5" />
                <line x1="19" y1="5" x2="13.6" y2="10.4" />
                <polyline points="15 5 19 5 19 9" />
              </svg>
            )}
            {memberAvatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={memberAvatar}
                alt=""
                className={`absolute inset-0 w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity ${isBlurred ? "privacy-blur" : ""}`}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
                onClick={() => {
                  if (!isBlurred) {
                    setFullImage(memberAvatar);
                  }
                }}
              />
            )}
          </div>
          <h2 className="font-display font-bold text-slate-800 text-center text-base leading-snug">{displayName}</h2>
          {subtitle && (
            <p className="text-[11px] text-teal-800/80 font-medium mt-1">{subtitle}</p>
          )}
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            {member.birth} — {deathText}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {member.bio && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 mb-1">{labels.bio}</p>
              <p className="text-xs text-slate-700 leading-relaxed">{member.bio}</p>
            </div>
          )}

          <div className="surface-inset p-3 rounded-xl space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">{labels.gender}</span>
              <span className="font-bold text-slate-700">
                {member.gender === "m" ? labels.male : labels.female}
              </span>
            </div>
            {member.mobile && !member.mobile.startsWith("auto-") && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{labels.mobile}</span>
                <span className="font-mono text-slate-700" dir="ltr">
                  {isMahram === false && member.gender === "f" ? "••••••••" : member.mobile}
                </span>
              </div>
            )}
          </div>

          {member.gender === "f" && isMahram !== null && (
            <div className="surface-inset p-3 rounded-xl">
              <p className="text-[10px] font-bold text-gray-500 mb-1">{labels.mahramStatus}</p>
              <p
                className={`text-xs font-bold ${isMahram ? "text-emerald-700" : "text-rose-600"}`}
              >
                {isMahram ? labels.mahramYes : labels.mahramNo}
              </p>
            </div>
          )}

          {relationshipToViewer && (
            <div className="surface-inset p-3 rounded-xl">
              <p className="text-[10px] font-bold text-gray-500 mb-1">
                {labels.relationToYou}
                {viewerLabel ? (
                  <span className="font-medium text-teal-800/80">
                    {" "}
                    ({lang === "en" ? "from" : lang === "ar" ? "من منظور" : "از دید"} {viewerLabel})
                  </span>
                ) : null}
              </p>
              <p className="text-xs font-bold text-teal-800">{relationshipToViewer}</p>
            </div>
          )}
          {!relationshipToViewer && viewerLabel && (
            <div className="surface-inset p-3 rounded-xl">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {lang === "fa"
                  ? `نسبت از دید «${viewerLabel}» — روی سپر حریم خصوصی و انتخاب فرد در هدر اثر می‌گذارد.`
                  : lang === "ar"
                  ? `النسبة من منظور «${viewerLabel}».`
                  : `Relation from “${viewerLabel}” perspective.`}
              </p>
            </div>
          )}

          {(member.photos?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 mb-2">{labels.gallery}</p>
              <div className="grid grid-cols-2 gap-2">
                {member.photos!.map((p, i) => {
                  const src = avatarUrl(p);
                  if (!src) return null;
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className={`w-full h-20 object-cover rounded-lg neo-debossed cursor-pointer hover:opacity-80 transition-opacity ${isBlurred ? "privacy-blur" : ""}`}
                      onClick={() => {
                        if (!isBlurred) {
                          setFullImage(src);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {(member.audioMemories?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-500 mb-2">{labels.audioMemories}</p>
              <div className="space-y-2">
                {member.audioMemories!.map((a, i) => {
                  const src = avatarUrl(a.path);
                  if (!src) return null;
                  return (
                    <div key={i} className="neo-debossed p-2 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-700 mb-1">{a.title}</p>
                      <audio controls className="w-full h-8" src={src} preload="none" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex gap-2 pt-3 border-t border-teal-900/10">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs font-bold"
              onPress={() => onEdit(member.id)}
            >
              {labels.btnEdit}
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs font-bold"
              onPress={() => onAddChild(member.id)}
            >
              {labels.btnAddChild}
            </Button>
            {onDelete && (
              <Button
                size="sm"
                variant="danger"
                isIconOnly
                className="min-w-10"
                aria-label={labels.btnDelete || "Delete"}
                onPress={() => onDelete(member.id)}
              >
                <i className="fa-solid fa-trash"></i>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Full Screen Image Modal */}
      {fullImage && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md pointer-events-auto cursor-pointer animate-appearance-in"
          onClick={() => setFullImage(null)}
        >
          {/* Full-resolution viewer intentionally bypasses responsive image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullImage}
            alt="Full size"
            className="w-full h-full max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl pointer-events-none"
          />
          <button 
            className="absolute top-6 right-8 text-white/70 hover:text-white text-4xl font-bold"
            onClick={(e) => { e.stopPropagation(); setFullImage(null); }}
          >
            &times;
          </button>
        </div>,
        document.body
      )}
    </aside>
  );
}
