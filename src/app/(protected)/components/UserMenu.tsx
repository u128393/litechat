"use client";

import Link from "next/link";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { isAdminUser } from "@/lib/auth/roles";
import { supportedAppLocales } from "@/lib/i18n/locales";
import { ChevronDown, Sun, Moon, Globe, Lock, Shield, LogOut } from "lucide-react";
import type { CurrentUser } from "@/server/auth/types";

const languageNames: Record<string, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

type UserMenuProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
};

export function UserMenu({ currentUser }: UserMenuProps) {
  const { locale, messages, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const initials = currentUser.email.slice(0, 2).toUpperCase();

  function handleLogout() {
    // Use a hidden form to POST to the logout endpoint
    // The server returns a 303 redirect to /login
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--lc-bg-tertiary)] outline-none"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--lc-accent)] text-[12px] font-semibold text-white">
          {initials}
        </div>
        <span className="flex-1 truncate text-[13px] text-[var(--lc-text-primary)]">{currentUser.email}</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--lc-text-secondary)]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[220px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg"
      >
        {/* Theme toggle */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-text-primary)]"
          onClick={() => {
            setTheme(theme === "dark" ? "light" : "dark");
          }}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light" : "Dark"}
        </DropdownMenuItem>

        {/* Language */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-text-primary)]"
          onClick={() => {
            const nextLocale = supportedAppLocales.find((l) => l !== locale) ?? locale;
            void setLocale(nextLocale);
          }}
        >
          <Globe className="size-4" />
          {languageNames[locale]}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 h-px bg-[var(--lc-border)]" />

        {/* Change password */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-text-primary)]"
        >
          <Link href="/account/password" className="flex w-full items-center gap-2">
            <Lock className="size-4" />
            {messages.shell.passwordSettings}
          </Link>
        </DropdownMenuItem>

        {/* Admin panel (conditional) */}
        {isAdminUser({ role: currentUser.role }) ? (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-text-primary)]"
          >
            <Link href="/admin" className="flex w-full items-center gap-2">
              <Shield className="size-4" />
              {messages.shell.adminArea}
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator className="my-1 h-px bg-[var(--lc-border)]" />

        {/* Sign out */}
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[13px] text-[var(--lc-danger)]"
          onClick={() => {
            handleLogout();
          }}
        >
          <LogOut className="size-4" />
          {messages.shell.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
