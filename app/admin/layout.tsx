import AuthGuard from "@/components/AuthGuard";
import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AuthGuard>{children}</AuthGuard>;
}
