// components/AuthGuard.tsx
"use client";

import { JSX, ReactNode } from "react";
import { Spinner } from "@/components/LoadingSpinner";
import { useAuthGuard } from "@/hooks/useAuthGuard";

interface AuthGuardProps {
  children: ReactNode;
  redirectPath?: string;
}

export default function AuthGuard({
  children,
  redirectPath = "/login",
}: AuthGuardProps): JSX.Element | null {
  const isAuthenticated = useAuthGuard(redirectPath);

  // Show loading spinner while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen justify-center items-center">
        <Spinner />
      </div>
    );
  }

  // Return null if not authenticated (will redirect via the hook)
  if (!isAuthenticated) {
    return null;
  }

  // Return children if authenticated
  return <>{children}</>;
}
