import { io, Socket } from "socket.io-client";
import type { FamilyMember, MarriageNode } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:7781";

let socket: Socket | null = null;

export type FamilySocketEvent =
  | "member:created"
  | "member:updated"
  | "member:deleted"
  | "marriage:created"
  | "marriage:updated"
  | "layout:synced"
  | "avatar:updated";

const listeners = new Set<(event: FamilySocketEvent) => void>();

export function connectFamilySocket(onEvent: (event: FamilySocketEvent) => void): Socket {
  listeners.add(onEvent);
  if (socket) return socket;

  socket = io(WS_URL, {
    transports: ["polling", "websocket"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  const events: FamilySocketEvent[] = [
    "member:created",
    "member:updated",
    "member:deleted",
    "marriage:created",
    "marriage:updated",
    "avatar:updated",
  ];

  for (const ev of events) {
    socket.on(ev, () => {
      listeners.forEach((fn) => {
        try { fn(ev); } catch {}
      });
    });
  }

  return socket;
}

export function disconnectFamilySocket(onEvent?: (event: FamilySocketEvent) => void) {
  if (onEvent) {
    listeners.delete(onEvent);
  }
  if (listeners.size === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Returns member IDs hidden because an ancestor marriage is collapsed */
export function getHiddenByCollapse(
  collapsedMarriages: Set<string>,
  members: FamilyMember[],
  marriageNodes: MarriageNode[],
): Set<string> {
  const hidden = new Set<string>();

  function hideDescendants(marriageId: string) {
    for (const m of members) {
      if (m.parentMarriageNode === marriageId && !hidden.has(m.id)) {
        hidden.add(m.id);
        for (const mn of marriageNodes) {
          if (mn.husband === m.id || mn.wife === m.id) {
            hideDescendants(mn.id);
          }
        }
      }
    }
  }

  for (const marriageId of collapsedMarriages) {
    hideDescendants(marriageId);
  }

  return hidden;
}
