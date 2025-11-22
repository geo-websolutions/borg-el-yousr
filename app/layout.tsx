import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "برج اليسر",
  description: "صفحة ادارة برج اتحاد ملاك برج اليسر",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`antialiased`}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
