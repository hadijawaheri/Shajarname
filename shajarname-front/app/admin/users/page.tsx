"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import {
  fetchAuditLogs,
  fetchLoginAccounts,
  fetchMembers,
  grantUserLogin,
  resetUserPassword,
  revokeUserLogin,
  setUserRole,
  type AuditLogEntry,
  type LoginAccount,
} from "../../../lib/api";
import {
  canManageUsers,
  clearAuth,
  getAuthUser,
  isAuthenticated,
  type AppRole,
} from "../../../lib/auth";
import type { ApiMember } from "../../../lib/types";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "ادمین",
  editor: "ویرایشگر",
  member: "عضو",
};

const ACTION_LABELS: Record<AuditLogEntry["action"], string> = {
  "user.role_changed": "تغییر نقش",
  "user.password_reset": "تغییر رمز",
  "user.login_granted": "اعطای ورود",
  "user.login_revoked": "قطع ورود",
};

function formatAuditMeta(log: AuditLogEntry): string {
  const m = log.meta || {};
  if (log.action === "user.role_changed") {
    return `${ROLE_LABELS[(m.from as AppRole) || "member"] || m.from} → ${ROLE_LABELS[(m.to as AppRole) || "member"] || m.to}`;
  }
  if (log.action === "user.login_granted" && m.role) {
    return `نقش: ${ROLE_LABELS[m.role as AppRole] || String(m.role)}`;
  }
  if (log.action === "user.login_revoked" && m.previousRole) {
    return `نقش قبلی: ${ROLE_LABELS[m.previousRole as AppRole] || String(m.previousRole)}`;
  }
  return "";
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fa-IR");
  } catch {
    return iso;
  }
}

export default function AdminUsersPage() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [users, setUsers] = useState<LoginAccount[]>([]);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pwDraft, setPwDraft] = useState<Record<string, string>>({});
  const [grantMemberId, setGrantMemberId] = useState("");
  const [grantMobile, setGrantMobile] = useState("");
  const [grantPassword, setGrantPassword] = useState("");
  const [grantRole, setGrantRole] = useState<AppRole>("editor");

  const load = useCallback(async () => {
    setError("");
    try {
      const [accounts, allMembers, audit] = await Promise.all([
        fetchLoginAccounts(),
        fetchMembers(),
        fetchAuditLogs(40),
      ]);
      setUsers(accounts);
      setMembers(allMembers);
      setLogs(audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری");
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || !canManageUsers()) {
      setAllowed(false);
      setReady(true);
      return;
    }
    setAllowed(true);
    setReady(true);
    void load();
  }, [load]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-bg text-slate-600 text-sm">
        ...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neo-bg p-6">
        <p className="text-sm text-slate-700">فقط ادمین به این صفحه دسترسی دارد.</p>
        <a href="/" className="text-teal-800 font-bold text-sm underline">
          بازگشت به شجره‌نامه
        </a>
      </div>
    );
  }

  const me = getAuthUser();
  const accountIds = new Set(users.map((u) => u.id));
  const candidates = members.filter((m) => !accountIds.has(m._id));

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neo-bg text-[var(--heritage-ink)] p-4 md:p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="surface-panel rounded-3xl p-5 border border-white/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-800">مدیریت کاربران</h1>
            <p className="text-xs text-slate-500 mt-1">
              نقش‌ها: ادمین (همه چیز) · ویرایشگر (ویرایش شجره) · عضو (فقط مشاهده)
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => { window.location.href = "/admin"; }}>
              پنل مدیریت شجره‌نامه
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => { window.location.href = "/"; }}>
              نمای عمومی
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                clearAuth();
                window.location.href = "/";
              }}
            >
              خروج ({me?.name})
            </Button>
          </div>
        </header>

        {error && (
          <div className="surface-panel rounded-2xl px-4 py-3 text-xs text-rose-700 border border-rose-200/50 whitespace-pre-wrap">
            {error}
          </div>
        )}

        <section className="surface-panel rounded-3xl border border-white/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-900/10">
            <h2 className="font-display font-bold text-lg">حساب‌های ورود</h2>
          </div>
          <ul className="divide-y divide-teal-900/8">
            {users.map((u) => (
              <li key={u.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {u.name} {u.lastName}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500" dir="ltr">
                      {u.mobile}
                    </p>
                  </div>
                  <Select
                    className="w-36"
                    aria-label="نقش"
                    value={u.role}
                    isDisabled={busyId === u.id}
                    onChange={(v) => {
                      if (!v) return;
                      void run(u.id, () => setUserRole(u.id, String(v) as AppRole));
                    }}
                  >
                    <Select.Trigger className="h-9 rounded-xl text-xs font-bold">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                          <ListBox.Item key={r} id={r} textValue={ROLE_LABELS[r]}>
                            {ROLE_LABELS[r]}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <TextField
                    className="flex-1 min-w-[10rem]"
                    type="password"
                    value={pwDraft[u.id] || ""}
                    onChange={(v) => setPwDraft((prev) => ({ ...prev, [u.id]: v }))}
                  >
                    <Label>رمز جدید</Label>
                    <Input className="rounded-xl text-xs" />
                  </TextField>
                  <Button
                    size="sm"
                    isDisabled={busyId === u.id || !(pwDraft[u.id] || "").trim()}
                    onPress={() =>
                      void run(u.id, async () => {
                        await resetUserPassword(u.id, pwDraft[u.id]);
                        setPwDraft((prev) => ({ ...prev, [u.id]: "" }));
                      })
                    }
                  >
                    تغییر رمز
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    isDisabled={busyId === u.id}
                    onPress={() => {
                      if (confirm(`غیرفعال کردن ورود «${u.name}»؟`)) {
                        void run(u.id, () => revokeUserLogin(u.id));
                      }
                    }}
                  >
                    قطع ورود
                  </Button>
                </div>
              </li>
            ))}
            {users.length === 0 && (
              <li className="p-6 text-center text-xs text-slate-400">هیچ حساب ورودی نیست.</li>
            )}
          </ul>
        </section>

        <section className="surface-panel rounded-3xl p-5 border border-white/50 space-y-4">
          <h2 className="font-display font-bold text-lg">اعطای ورود به عضو درخت</h2>
          <p className="text-xs text-slate-500">
            عضو بدون حساب را انتخاب کنید، موبایل و رمز بگذارید.
          </p>
          <Select
            className="w-full"
            aria-label="انتخاب عضو"
            value={grantMemberId || null}
            onChange={(v) => {
              const id = v ? String(v) : "";
              setGrantMemberId(id);
              const m = members.find((x) => x._id === id);
              if (m?.mobile && !m.mobile.startsWith("auto-")) {
                setGrantMobile(m.mobile);
              } else {
                setGrantMobile("");
              }
            }}
            placeholder="انتخاب عضو…"
          >
            <Label>عضو</Label>
            <Select.Trigger className="rounded-xl h-11 text-xs">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="max-h-64 overflow-y-auto">
              <ListBox>
                {candidates.map((m) => (
                  <ListBox.Item
                    key={m._id}
                    id={m._id}
                    textValue={`${m.name} ${m.lastName}`}
                  >
                    {m.name} {m.lastName} ({m.mobile?.startsWith("auto-") ? "بدون موبایل" : m.mobile})
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <div className="grid sm:grid-cols-3 gap-3">
            <TextField className="w-full" value={grantMobile} onChange={setGrantMobile}>
              <Label>موبایل</Label>
              <Input className="rounded-xl font-mono text-xs" dir="ltr" />
            </TextField>
            <TextField
              className="w-full"
              type="password"
              value={grantPassword}
              onChange={setGrantPassword}
            >
              <Label>رمز</Label>
              <Input className="rounded-xl text-xs" />
            </TextField>
            <Select
              className="w-full"
              aria-label="نقش"
              value={grantRole}
              onChange={(v) => {
                if (v) setGrantRole(String(v) as AppRole);
              }}
            >
              <Label>نقش</Label>
              <Select.Trigger className="rounded-xl h-11 text-xs font-bold">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <ListBox.Item key={r} id={r} textValue={ROLE_LABELS[r]}>
                      {ROLE_LABELS[r]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <Button
            className="w-full"
            isDisabled={!grantMemberId || !grantPassword || busyId === "grant"}
            onPress={() =>
              void run("grant", async () => {
                await grantUserLogin(grantMemberId, {
                  mobile: grantMobile || undefined,
                  password: grantPassword,
                  role: grantRole,
                });
                setGrantMemberId("");
                setGrantMobile("");
                setGrantPassword("");
                setGrantRole("editor");
              })
            }
          >
            ایجاد حساب ورود
          </Button>
        </section>

        <section className="surface-panel rounded-3xl border border-white/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-900/10">
            <h2 className="font-display font-bold text-lg">گزارش تغییرات (Audit)</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              تغییر نقش و رمز — بدون ذخیرهٔ خود رمز
            </p>
          </div>
          <ul className="divide-y divide-teal-900/8 max-h-[28rem] overflow-y-auto">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-teal-900">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  <span className="font-mono text-slate-400" dir="ltr">
                    {formatWhen(log.createdAt)}
                  </span>
                </div>
                <p className="text-slate-700">
                  هدف: <span className="font-bold">{log.targetName || "—"}</span>
                  {log.targetMobile ? (
                    <span className="font-mono text-slate-500 ms-2" dir="ltr">
                      {log.targetMobile}
                    </span>
                  ) : null}
                </p>
                <p className="text-slate-500">
                  توسط:{" "}
                  <span className="font-mono" dir="ltr">
                    {log.actorMobile || log.actorId}
                  </span>
                  {formatAuditMeta(log) ? (
                    <span className="ms-2 text-slate-700">· {formatAuditMeta(log)}</span>
                  ) : null}
                </p>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="p-6 text-center text-xs text-slate-400">هنوز رویدادی ثبت نشده.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
