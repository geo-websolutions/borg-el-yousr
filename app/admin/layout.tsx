import AuthGuard from "@/components/AuthGuard";
import { JSX } from "react";

export default function AdminLayout({ children }: { children: JSX.Element }) {
  return <AuthGuard>{children}</AuthGuard>;
}
