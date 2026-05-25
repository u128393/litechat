import { Navigate, Route, Routes } from "react-router-dom";

import { AdminManagementClient } from "@/features/admin/AdminManagementClient";
import PasswordSettingsPage from "@/features/account/PasswordSettingsPage";
import PersonalizationSettingsPage from "@/features/account/PersonalizationSettingsPage";
import { ChatWorkspaceProvider } from "@/features/chat/ChatWorkspaceProvider";
import { ChatPage } from "@/features/chat/components/ChatPage";
import { ProtectedShell } from "@/layouts/ProtectedShell";
import { RequireAdmin, RequireAuth } from "@/shared/auth/AuthGuard";
import { useAuth } from "@/shared/auth/auth-context";
import { useEffect, useState } from "react";
import { apiFetch, readJson } from "@/shared/api-client";
import type { AppSettings, ManagedUser, ModelConfig, ProviderConfig } from "@/shared/types";
import { LoginPage } from "@/router/LoginPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <Navigate to="/admin/users" replace />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAdmin>
            <ProtectedRouteShell>
              <AdminUsersRoute />
            </ProtectedRouteShell>
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/models"
        element={
          <RequireAdmin>
            <ProtectedRouteShell>
              <AdminModelsRoute />
            </ProtectedRouteShell>
          </RequireAdmin>
        }
      />
      <Route
        path="/account/personalization"
        element={
          <RequireAuth>
            <ProtectedRouteShell>
              <PersonalizationSettingsPage />
            </ProtectedRouteShell>
          </RequireAuth>
        }
      />
      <Route
        path="/account/password"
        element={
          <RequireAuth>
            <ProtectedRouteShell>
              <PasswordSettingsPage />
            </ProtectedRouteShell>
          </RequireAuth>
        }
      />
      <Route
        path="/c/:conversationId"
        element={
          <RequireAuth>
            <ProtectedRouteShell>
              <ChatPage />
            </ProtectedRouteShell>
          </RequireAuth>
        }
      />
      <Route
        path="/branch/:conversationId/:messageId"
        element={
          <RequireAuth>
            <ProtectedRouteShell>
              <ChatPage />
            </ProtectedRouteShell>
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ProtectedRouteShell>
              <ChatPage />
            </ProtectedRouteShell>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedRouteShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return null;
  }

  return (
    <ChatWorkspaceProvider userId={currentUser.userId}>
      <ProtectedShell currentUser={currentUser} initialSidebarCollapsed={readInitialSidebarCollapsed()}>
        {children}
      </ProtectedShell>
    </ChatWorkspaceProvider>
  );
}

function AdminUsersRoute() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[] | null>(null);

  useEffect(() => {
    let active = true;

    void apiFetch("/api/admin/users")
      .then((response) => readJson<{ users?: ManagedUser[] }>(response))
      .then((payload) => {
        if (active) {
          setUsers(payload?.users ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setUsers([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!currentUser || users === null) {
    return <main className="flex min-h-0 flex-1 flex-col" />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AdminManagementClient
        activeSection="users"
        currentUserId={currentUser.userId}
        initialUsers={users}
        initialProviderConfigs={[]}
        initialModelConfigs={[]}
        initialAppSettings={{ titleGenerationModelConfigId: null }}
      />
    </main>
  );
}

function AdminModelsRoute() {
  const { currentUser } = useAuth();
  const [payload, setPayload] = useState<{
    providerConfigs: ProviderConfig[];
    modelConfigs: ModelConfig[];
    appSettings: AppSettings;
  } | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      apiFetch("/api/admin/provider-configs").then((response) => readJson<{ providerConfigs?: ProviderConfig[] }>(response)),
      apiFetch("/api/admin/model-configs").then((response) => readJson<{ modelConfigs?: ModelConfig[] }>(response)),
      apiFetch("/api/admin/settings").then((response) => readJson<{ settings?: AppSettings }>(response))
    ])
      .then(([providers, models, settings]) => {
        if (active) {
          setPayload({
            providerConfigs: providers?.providerConfigs ?? [],
            modelConfigs: models?.modelConfigs ?? [],
            appSettings: settings?.settings ?? { titleGenerationModelConfigId: null }
          });
        }
      })
      .catch(() => {
        if (active) {
          setPayload({
            providerConfigs: [],
            modelConfigs: [],
            appSettings: { titleGenerationModelConfigId: null }
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!currentUser || payload === null) {
    return <main className="flex min-h-0 flex-1 flex-col" />;
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AdminManagementClient
        activeSection="model-config"
        currentUserId={currentUser.userId}
        initialUsers={[]}
        initialProviderConfigs={payload.providerConfigs}
        initialModelConfigs={payload.modelConfigs}
        initialAppSettings={payload.appSettings}
      />
    </main>
  );
}

function readInitialSidebarCollapsed() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem("litechat.sidebarCollapsed") === "true";
}
