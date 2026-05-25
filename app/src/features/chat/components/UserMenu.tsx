import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/context";
import { isAdminUser } from "@/lib/auth/roles";
import { supportedAppLocales, type AppLocale } from "@/lib/i18n/locales";
import { ChevronDown, Globe, Lock, Monitor, Moon, Shield, SlidersHorizontal, Sun, LogOut } from "lucide-react";
import type { CurrentUser } from "@/shared/types";
import { cn } from "@/lib/utils";
import { apiFetch, readJson } from "@/shared/api-client";
import { useAuth } from "@/shared/auth/auth-context";

type AppearancePreference = "system" | "light" | "dark";

const languageNames: Record<AppLocale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

const appearancePreferences: AppearancePreference[] = ["system", "light", "dark"];

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
  const { setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const currentAppearance: AppearancePreference = isAppearancePreference(theme) ? theme : "system";

  const initials = currentUser.email.slice(0, 2).toUpperCase();

  async function handleLogout() {
    const response = await apiFetch("/api/auth/logout", { method: "POST" });
    const payload = await readJson<{ redirectTo?: string }>(response);
    setCurrentUser(null);
    navigate(payload?.redirectTo ?? "/login", { replace: true });
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
        {/* Appearance */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]">
            <Monitor className="size-4" />
            {messages.shell.appearanceLabel}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[160px] rounded-lg border border-[var(--lc-border)] bg-[var(--lc-bg-primary)] p-1 shadow-lg">
            <DropdownMenuRadioGroup
              value={currentAppearance}
              onValueChange={(nextAppearance) => {
                if (isAppearancePreference(nextAppearance)) {
                  setTheme(nextAppearance);
                }
              }}
            >
              {appearancePreferences.map((appearancePreference) => (
                <DropdownMenuRadioItem
                  key={appearancePreference}
                  value={appearancePreference}
                  className="flex items-center gap-2 rounded-[4px] px-3 py-2 pr-8 text-[14px] text-[var(--lc-text-primary)]"
                >
                  {getAppearanceIcon(appearancePreference)}
                  {getAppearanceLabel(appearancePreference, messages)}
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

        {/* Personalization */}
        <DropdownMenuLinkItem
          render={<Link to="/account/personalization" />}
          closeOnClick
          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
        >
          <SlidersHorizontal className="size-4" />
          {messages.shell.personalizationSettings}
        </DropdownMenuLinkItem>

        {/* Change password */}
        <DropdownMenuLinkItem
          render={<Link to="/account/password" />}
          closeOnClick
          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
        >
          <Lock className="size-4" />
          {messages.shell.passwordSettings}
        </DropdownMenuLinkItem>

        {/* Admin panel (conditional) */}
        {isAdminUser({ role: currentUser.role }) ? (
          <DropdownMenuLinkItem
            render={<Link to="/admin" />}
            closeOnClick
            className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-text-primary)]"
          >
            <Shield className="size-4" />
            {messages.shell.adminArea}
          </DropdownMenuLinkItem>
        ) : null}

        <DropdownMenuSeparator className="my-1 h-px bg-[var(--lc-border)]" />

        {/* Sign out */}
        <DropdownMenuItem
          variant="destructive"
          className="flex items-center gap-2 rounded-[4px] px-3 py-2 text-[14px] text-[var(--lc-danger)] focus:bg-[var(--lc-danger)]/10 focus:text-[var(--lc-danger)]"
          onClick={() => {
            void handleLogout();
          }}
        >
          <LogOut className="size-4" />
          {messages.shell.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "zh-CN";
}

function getAppearanceIcon(appearancePreference: AppearancePreference) {
  switch (appearancePreference) {
    case "light":
      return <Sun className="size-4" />;
    case "dark":
      return <Moon className="size-4" />;
    default:
      return <Monitor className="size-4" />;
  }
}

function getAppearanceLabel(appearancePreference: AppearancePreference, messages: ReturnType<typeof useI18n>["messages"]) {
  switch (appearancePreference) {
    case "light":
      return messages.shell.appearanceLight;
    case "dark":
      return messages.shell.appearanceDark;
    default:
      return messages.shell.appearanceSystem;
  }
}
