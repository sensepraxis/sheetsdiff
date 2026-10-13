"use client";

import { AccountClient } from "@/components/account/account-client";
import { AuthGate } from "@/components/auth/auth-gate";

export function AuthGatedAccount() {
  return <AuthGate>{(user) => <AccountClient user={user} />}</AuthGate>;
}
