import { redirect } from "next/navigation";

import LoginPageClient from "@/components/auth/login-page-client";
import { isSuperAdminDirectAccessEnabled } from "@/lib/super-admin-direct-access";

export default function LoginPage() {
  if (isSuperAdminDirectAccessEnabled()) {
    redirect("/admin");
  }

  return <LoginPageClient />;
}
