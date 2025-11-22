// app/login/page.tsx
"use client";
import { useState, useEffect, FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { FiMail, FiLock, FiLogIn, FiEye, FiEyeOff, FiHome } from "react-icons/fi";
import { Spinner } from "@/components/LoadingSpinner";
import { useRouter } from "next/navigation";
import { getDoc, doc, DocumentSnapshot } from "firebase/firestore";

interface UserData {
  userData: any;
}

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        router.push("/admin");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc: DocumentSnapshot = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        localStorage.setItem("userData", JSON.stringify({ userData }));
        router.push("/dashboard");
      } else {
        throw new Error("User document not found");
      }
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/invalid-email":
        return "البريد الإلكتروني غير صحيح";
      case "auth/user-disabled":
        return "الحساب معطل";
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
      case "auth/invalid-credential":
        return "بيانات الدخول غير صحيحة";
      default:
        return "فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.";
    }
  };

  const togglePasswordVisibility = (): void => {
    setShowPassword(!showPassword);
  };

  if (!isMounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-24 h-24">
            <div className="w-full h-full bg-linear-to-r from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center">
              <FiHome className="text-white text-2xl" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800 mb-2">اتحاد ملاك برج اليسر</h1>
            <Spinner />
            <p className="text-gray-600 text-sm mt-4">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm relative z-10">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4 bg-linear-to-r from-blue-600 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FiHome className="text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">اتحاد ملاك برج اليسر</h1>
          <p className="text-gray-600 text-sm">منصة إدارة الملاك</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
          {/* Card Header */}
          <div className="p-6 pb-4">
            <h2 className="text-xl font-semibold text-gray-800 text-center">مرحباً بعودتك</h2>
            <p className="text-gray-600 text-center mt-2 text-sm">
              سجل الدخول للوصول إلى لوحة التحكم
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 pt-2 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-center">
                  <div className="shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="mr-3">
                    <p className="text-right">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 text-right">
                البريد الإلكتروني
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <FiMail className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="email"
                  id="email"
                  dir="ltr"
                  className="w-full pr-10 pl-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-all duration-200 group-hover:border-gray-400 text-left"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 text-right"
              >
                كلمة المرور
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  dir="ltr"
                  className="w-full pr-10 pl-12 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 placeholder-gray-400 transition-all duration-200 group-hover:border-gray-400 text-left"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 pl-3 flex items-center hover:text-blue-600 transition-colors cursor-pointer"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <FiEyeOff className="text-gray-400 hover:text-blue-600" />
                  ) : (
                    <FiEye className="text-gray-400 hover:text-blue-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-white transition-all duration-200 shadow-lg ${
                loading ? "opacity-70 cursor-not-allowed" : "hover:shadow-blue-500/25"
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                  جاري تسجيل الدخول...
                </>
              ) : (
                <>
                  <FiLogIn className="ml-2" />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200/50">
            <div className="text-center">
              <p className="text-xs text-gray-500">وصول آمن إلى منصة اتحاد الملاك</p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} اتحاد ملاك برج اليسر. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>

      {/* Mobile Optimized Elements */}
      <div className="absolute bottom-4 left-4 flex items-center space-x-2 text-gray-500 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>اتصال آمن</span>
      </div>
    </div>
  );
}
