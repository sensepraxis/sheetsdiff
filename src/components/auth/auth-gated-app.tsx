"use client";

import { AppWorkspace } from "@/components/app/app-workspace";
import { AuthGate } from "@/components/auth/auth-gate";

export function AuthGatedApp() {
  return (
    <AuthGate>{(user) => <AppWorkspace userId={user.id} />}</AuthGate>
  );
}
