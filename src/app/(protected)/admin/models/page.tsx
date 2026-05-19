import { AdminManagementClient } from "@/app/(protected)/admin/AdminManagementClient";
import { requireAdminUser } from "@/server/auth/guards";
import { listModelConfigs } from "@/server/model-configs";
import { listProviderConfigs } from "@/server/providers";

export default async function AdminModelsPage() {
  const currentUser = await requireAdminUser();
  const [providerConfigs, modelConfigs] = await Promise.all([listProviderConfigs(), listModelConfigs()]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AdminManagementClient
        activeSection="model-config"
        currentUserId={currentUser.userId}
        initialUsers={[]}
        initialProviderConfigs={providerConfigs}
        initialModelConfigs={modelConfigs}
      />
    </main>
  );
}
