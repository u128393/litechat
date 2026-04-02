import { AdminManagementClient } from "@/app/(protected)/admin/AdminManagementClient";
import { listModelConfigs } from "@/server/model-configs";
import { listProviderConfigs } from "@/server/providers";

export default async function AdminPage() {
  const [providerConfigs, modelConfigs] = await Promise.all([listProviderConfigs(), listModelConfigs()]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <AdminManagementClient initialProviderConfigs={providerConfigs} initialModelConfigs={modelConfigs} />
    </main>
  );
}
