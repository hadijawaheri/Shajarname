"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FamilyTreeApp from "../../components/FamilyTreeApp";
import { isAuthenticated, canEditTree } from "../../lib/auth";

export default function AdminTreePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated() || !canEditTree()) {
      setAuthorized(false);
      window.location.replace("/");
      return;
    }
    setAuthorized(true);
  }, [router]);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neo-bg text-slate-600 text-sm font-display">
        در حال بررسی دسترسی مدیریت...
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <FamilyTreeApp adminMode={true} />;
}
