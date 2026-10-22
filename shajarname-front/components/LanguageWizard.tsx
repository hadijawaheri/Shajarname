"use client";

import { Button } from "@heroui/react";

interface LanguageWizardProps {
  onSelect: (lang: "fa" | "ar") => void;
}

export default function LanguageWizard({ onSelect }: LanguageWizardProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neo-bg">
      <div className="surface-panel p-10 rounded-3xl max-w-md w-full mx-4 text-center border border-white/50">
        <div className="w-20 h-20 rounded-full surface-inset flex items-center justify-center mx-auto mb-6">
          <i className="fa-solid fa-language text-3xl text-teal-700"></i>
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">خوش آمدید</h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          لطفاً زبان ترجیحی خود را انتخاب کنید
          <br />
          <span dir="rtl">الرجاء اختيار لغتك المفضلة</span>
        </p>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full text-lg font-bold" onPress={() => onSelect("fa")}>
            فارسی
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full text-lg font-bold"
            onPress={() => onSelect("ar")}
          >
            العربية
          </Button>
        </div>
      </div>
    </div>
  );
}
