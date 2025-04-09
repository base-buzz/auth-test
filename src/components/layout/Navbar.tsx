"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils"; // Assuming you have a utility for class names

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/profile", label: "Edit Profile" },
    { href: "/settings", label: "Settings" },
    // Add other main navigation links here if needed
  ];

  return (
    <nav className="bg-background border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/logo.svg" // Path relative to public folder
            alt="Logo"
            width={40} // Adjust size as needed
            height={40}
            priority // Load logo quickly
          />
          {/* Optional: Add App Name Text */}
          {/* <span className="font-bold text-lg">App Name</span> */}
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {/* Add User/Auth button here later */}
        </div>
      </div>
    </nav>
  );
}
