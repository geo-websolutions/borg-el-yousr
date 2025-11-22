// hooks/useAuthGuard.ts
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "@/lib/firebase";

type AuthState = boolean | null;

export function useAuthGuard(redirectPath: string = "/login"): AuthState {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<AuthState>(null);
  const isRedirectingRef = useRef<boolean>(false);

  // Simple rule: anything after /appointments/ is public
  const isPublicPath = pathname?.startsWith("/appointments/");

  useEffect(() => {
    let isMounted = true;

    // If it's a public path, skip authentication
    if (isPublicPath) {
      setIsAuthenticated(true);
      return;
    }

    // For protected paths, check authentication
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(
      auth,
      (user: User | null) => {
        if (!isMounted) return;

        if (user) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          // Prevent multiple redirects using ref
          if (!isRedirectingRef.current) {
            isRedirectingRef.current = true;
            router.push(redirectPath);
          }
        }
      },
      (error: Error) => {
        // Handle auth errors safely
        console.error("Auth state error:", error);
        if (!isMounted) return;
        setIsAuthenticated(false);
        if (!isRedirectingRef.current) {
          isRedirectingRef.current = true;
          router.push(redirectPath);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router, redirectPath, isPublicPath]); // Removed isRedirecting from dependencies

  return isAuthenticated;
}
