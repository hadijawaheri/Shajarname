"use client";

import { CloseButton } from "@heroui/react";
import type { ReactNode } from "react";

/**
 * Header row with an in-flow close button so the X never overlays titles/actions.
 * Prefer this over absolute top/end positioning in RTL/LTR panels.
 */
export default function PanelHeader({
  title,
  onClose,
  closeLabel = "Close",
  trailing,
  className = "",
}: {
  title: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 shrink-0 ${className}`}>
      <div className="flex-1 min-w-0">{title}</div>
      {trailing}
      <CloseButton
        aria-label={closeLabel}
        onPress={onClose}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}
