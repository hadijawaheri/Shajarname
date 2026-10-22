"use client";

import { useState } from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { login as apiLogin } from "../lib/api";
import { setAuth, type AuthUser } from "../lib/auth";

interface LoginModalProps {
  lang: "fa" | "ar" | "en";
  onSuccess: (user?: AuthUser) => void;
}

export default function LoginModal({ lang, onSuccess }: LoginModalProps) {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const labels = {
    fa: {
      title: "ورود به شجره‌نامه",
      mobile: "نام کاربری یا شماره موبایل",
      password: "رمز عبور",
      submit: "ورود",
      error: "ورود ناموفق بود",
    },
    ar: {
      title: "تسجيل الدخول",
      mobile: "اسم المستخدم أو رقم الجوال",
      password: "كلمة المرور",
      submit: "دخول",
      error: "فشل تسجيل الدخول",
    },
    en: {
      title: "Login",
      mobile: "Username or Mobile",
      password: "Password",
      submit: "Sign In",
      error: "Login failed",
    },
  }[lang === "en" ? "en" : lang === "ar" ? "ar" : "fa"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiLogin(mobile, password);
      setAuth(result.accessToken, result.refreshToken, result.member);
      onSuccess(result.member);
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal.Backdrop isOpen isDismissable={false} variant="blur">
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className="surface-panel border border-white/50 rounded-3xl">
          <Modal.Header>
            <Modal.Heading className="font-display text-center w-full">
              {labels.title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                name="mobile"
                isRequired
                className="w-full"
                value={mobile}
                onChange={setMobile}
              >
                <Label>{labels.mobile}</Label>
                <Input
                  className="rounded-xl font-mono"
                  dir="ltr"
                  inputMode="text"
                  autoComplete="username"
                />
              </TextField>
              <TextField
                name="password"
                isRequired
                className="w-full"
                type="password"
                value={password}
                onChange={setPassword}
              >
                <Label>{labels.password}</Label>
                <Input className="rounded-xl" dir="ltr" autoComplete="current-password" />
              </TextField>
              {error && <p className="text-xs text-rose-600 text-center">{error}</p>}
              <Button type="submit" className="w-full" isDisabled={loading}>
                {loading ? "..." : labels.submit}
              </Button>
            </form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
