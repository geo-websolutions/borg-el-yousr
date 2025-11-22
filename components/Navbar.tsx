// components/Navbar.tsx
"use client";

import { JSX, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdCalendarMonth } from "react-icons/md";
import { PiMoney } from "react-icons/pi";
import { IoIosLogIn } from "react-icons/io";

interface NavItem {
  id: number;
  label: string;
  href: string;
  icon?: JSX.Element | string;
}

interface NavbarProps {
  navItems?: NavItem[];
}

export default function Navbar({ navItems = defaultNavItems }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Navbar - takes space in layout */}
      <nav className="bg-white shadow-sm border-b border-gray-200 h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            {/* Logo */}
            <div className="shrink-0 flex items-center">
              <div className="text-xl font-bold text-gray-900">اتحاد ملاك برج اليسر</div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center ${
                        isActive
                          ? "text-gray-900 bg-gray-100"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Mobile menu button - inside the navbar */}
            <div className="md:hidden">
              <button
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 transition-colors duration-200"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {/* Hamburger icon */}
                <div className="w-6 h-6 flex flex-col justify-center items-center">
                  <span
                    className={`block h-0.5 w-6 bg-current transform transition duration-300 ease-in-out ${
                      isMobileMenuOpen ? "rotate-45 translate-y-0.5" : "-translate-y-1"
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transition duration-300 ease-in-out ${
                      isMobileMenuOpen ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <span
                    className={`block h-0.5 w-6 bg-current transform transition duration-300 ease-in-out ${
                      isMobileMenuOpen ? "-rotate-45 -translate-y-0.5" : "translate-y-1"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu - Fixed overlay that hovers on top of content */}
        <div
          className={`md:hidden fixed inset-x-0 top-16 bg-white border-b border-gray-200 shadow-lg transition-all duration-300 ease-in-out transform z-50 ${
            isMobileMenuOpen
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0 pointer-events-none"
          }`}
        >
          <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-gray-900 bg-gray-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Backdrop for mobile menu - hovers over content */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}

// Default navigation items - you can edit this array to add/remove tabs
export const defaultNavItems: NavItem[] = [
  {
    id: 1,
    label: "الشهرية",
    href: "/",
    icon: <MdCalendarMonth className="ml-2" size={18} />,
  },
  {
    id: 2,
    label: "الصيانة و المصروفات",
    href: "/events",
    icon: <PiMoney className="ml-2" size={18} />,
  },
  {
    id: 4,
    label: "تسجيل الدخول",
    href: "/login",
    icon: <IoIosLogIn className="ml-2" size={18} />,
  },
];
