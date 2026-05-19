"use client";

import Link from "next/link";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { isAdminUser } from "@/lib/auth/roles";
import { supportedAppLocales, type AppLocale } from "@/lib/i18n/locales";
import { ChevronDown, Globe, Lock, Monitor, Moon, Shield, Sun, LogOut } from "lucide-react";
import type { CurrentUser } from "@/server/auth/types";
import { cn } from "@/lib/utils";

type ThemePreference = "system" | "light" | "dark";

const languageNames: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

const themePreferences: ThemePreference[] = ["system", "light", "dark"];

const userMenuTriggerClass =
  "flex h-10 w-full items-center justify-start gap-2.5 overflow-hidden rounded-lg px-2 py-1 text-left transition-colors duration-200 ease-out hover:bg-[var(--lc-bg-tertiary)] outline-none";
const userMenuAvatarClass =
  "flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--lc-accent)] text-[10px] font-semibold text-white";
const userMenuTextClass =
  "min-w-0 flex-1 truncate text-[13px] text-[var(--lc-text-primary)] transition-[opacity,width] duration-200 ease-out";
const userMenuChevronClass =
  "size-4 shrink-0 text-[var(--lc-text-secondary)] transition-[opacity,width] duration-200 ease-out";

type UserMenuProps = {
  currentUser: Pick<CurrentUser, "userId" | "email" | "role">;
  collapsed?: boolean;
};

export function UserMenu({ currentUser, collapsed = false }: UserMenuProps) {
  const { locale, messages, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentTheme: ThemePreference = isThemePreference(theme) ? theme : "system";

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
        className={userMenuTriggerClass}
        aria-label={messages.shell.workspaceMenu}
        title={collapsed ? messages.shell.workspaceMenu : undefined}
      >
        <div className={userMenuAvatarClass}>{initials}</div>
        <span
          className={cn(
            userMenuTextClass,
            collapsed && "w-0 flex-none opacity-0"
          )}
        >
          {currentUser.email}
        </span>
        <ChevronDown
          className={cn(
            userMenuChevronClass,
            collapsed && "w-0 opacity-0"
          )}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[220px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg"
      >
        {/* Theme */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]">
            <Monitor className="size-4" />
            {messages.shell.themeLabel}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[160px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg">
            <DropdownMenuRadioGroup
              value={currentTheme}
              onValueChange={(nextTheme) => {
                if (isThemePreference(nextTheme)) {
                  setTheme(nextTheme);
                }
              }}
            >
              {themePreferences.map((themePreference) => (
                <DropdownMenuRadioItem
                  key={themePreference}
                  value={themePreference}
                  className="flex items-center gap-2 rounded-[4px] px-3 py-2 pr-8 text-[14px] text-[var(--lc-text-primary)]"
                >
                  {getThemeIcon(themePreference)}
                  {getThemeLabel(themePreference, messages)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Language */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]">
            <Globe className="size-4" />
            {messages.shell.languageLabel}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[160px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg">
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(nextLocale) => {
                if (isAppLocale(nextLocale)) {
                  void setLocale(nextLocale);
                }
              }}
            >
              {supportedAppLocales.map((supportedLocale) => (
                <DropdownMenuRadioItem
                  key={supportedLocale}
                  value={supportedLocale}
                  className="flex items-center gap-2 rounded-[4px] px-3 py-2 pr-8 text-[14px] text-[var(--lc-text-primary)]"
                >
                  {languageNames[supportedLocale]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="my-1 h-px bg-[var(--lc-border)]" />

        {/* Change password */}
        <DropdownMenuItem
          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
        >
          <Link href="/account/password" className="flex w-full items-center gap-2">
            <Lock className="size-4" />
            {messages.shell.passwordSettings}
          </Link>
        </DropdownMenuItem>

        {/* Admin panel (conditional) */}
        {isAdminUser({ role: currentUser.role }) ? (
          <DropdownMenuItem
            className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
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
          variant="destructive"
          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-danger)] focus:bg-[var(--lc-danger)]/10 focus:text-[var(--lc-danger)]"
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

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "zh-CN";
}

function getThemeIcon(themePreference: ThemePreference) {
  switch (themePreference) {
    case "light":
      return <Sun className="size-4" />;
    case "dark":
      return <Moon className="size-4" />;
    default:
      return <Monitor className="size-4" />;
  }
}

function getThemeLabel(themePreference: ThemePreference, messages: ReturnType<typeof useI18n>["messages"]) {
  switch (themePreference) {
    case "light":
      return messages.shell.themeLight;
    case "dark":
      return messages.shell.themeDark;
    default:
      return messages.shell.themeSystem;
  }
}
