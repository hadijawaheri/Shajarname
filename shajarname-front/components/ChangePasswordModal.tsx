"use client";
import React, { useState } from "react";
import { changeOwnPassword } from "../lib/api";
import { updateAuthUser } from "../lib/auth";

interface Props {
  lang: "fa" | "ar" | "en";
  onClose: () => void;
  mandatory?: boolean; // if true, user cannot dismiss without changing
}

const labels = {
  fa: {
    title: "تغییر رمز عبور",
    subtitle: "لطفاً رمز عبور پیش‌فرض خود را تغییر دهید",
    current: "رمز عبور فعلی",
    newPass: "رمز عبور جدید",
    confirm: "تکرار رمز جدید",
    save: "ذخیره",
    skip: "بعداً",
    mismatch: "رمزهای جدید یکسان نیستند",
    tooShort: "رمز جدید باید حداقل ۴ کاراکتر باشد",
    success: "رمز عبور با موفقیت تغییر کرد",
    error: "خطا در تغییر رمز عبور",
  },
  ar: {
    title: "تغيير كلمة المرور",
    subtitle: "يرجى تغيير كلمة المرور الافتراضية",
    current: "كلمة المرور الحالية",
    newPass: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة",
    save: "حفظ",
    skip: "لاحقاً",
    mismatch: "كلمتا المرور الجديدتان غير متطابقتين",
    tooShort: "يجب أن تكون كلمة المرور الجديدة ٤ أحرف على الأقل",
    success: "تم تغيير كلمة المرور بنجاح",
    error: "خطأ في تغيير كلمة المرور",
  },
  en: {
    title: "Change Password",
    subtitle: "Please change your default password",
    current: "Current Password",
    newPass: "New Password",
    confirm: "Confirm New Password",
    save: "Save",
    skip: "Later",
    mismatch: "New passwords do not match",
    tooShort: "New password must be at least 4 characters",
    success: "Password changed successfully",
    error: "Error changing password",
  },
};

export default function ChangePasswordModal({ lang, onClose, mandatory = false }: Props) {
  const t = labels[lang] ?? labels.fa;
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPass.length < 4) { setError(t.tooShort); return; }
    if (newPass !== confirm) { setError(t.mismatch); return; }
    setLoading(true);
    try {
      await changeOwnPassword(current, newPass);
      updateAuthUser({ mustChangePassword: false });
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(t.error + ": " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
        dir={lang === "en" ? "ltr" : "rtl"}
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-teal-50 flex items-center justify-center">
            <i className="fa-solid fa-lock text-teal-600 text-xl" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">{t.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{t.subtitle}</p>
        </div>

        {success ? (
          <div className="text-center py-4">
            <i className="fa-solid fa-circle-check text-emerald-500 text-3xl mb-2" />
            <p className="text-sm font-medium text-emerald-700">{t.success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t.current}</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t.newPass}</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t.confirm}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              {!mandatory && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
                >
                  {t.skip}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition disabled:opacity-60"
              >
                {loading ? "..." : t.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
