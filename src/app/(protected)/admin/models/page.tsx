import { AdminManagementClient } from "@/app/(protected)/admin/AdminManagementClient";
import { requireAdminUser } from "@/server/auth/guards";
import { getAppSettings } from "@/server/app-settings";
import { listModelConfigs } from "@/server/model-configs";
import { listProviderConfigs } from "@/server/providers";

export default async function AdminModelsPage() {
  const currentUser = await requireAdminUser();
  const [providerConfigs, modelConfigs, appSettings] = await Promise.all([
    listProviderConfigs(),
    listModelConfigs(),
    getAppSettings()
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AdminManagementClient
        activeSection="model-config"
        currentUserId={currentUser.userId}
        initialUsers={[]}
        initialProviderConfigs={providerConfigs}
        initialModelConfigs={modelConfigs}
        initialAppSettings={appSettings}
      />
    </main>
  );
}
