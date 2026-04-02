import { requireAdminUser } from "@/server/auth/guards";

type AdminLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdminUser();

  return children;
}
