import { AdminManagementClient } from "@/app/(protected)/admin/AdminManagementClient";
import { requireAdminUser } from "@/server/auth/guards";
import { listManagedUsers } from "@/server/users";

export default async function AdminUsersPage() {
  const currentUser = await requireAdminUser();
  const users = await listManagedUsers();

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
