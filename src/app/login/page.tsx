import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-[#64748b]">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
