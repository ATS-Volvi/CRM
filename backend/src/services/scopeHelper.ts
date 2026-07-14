import { sequelize } from "@nexus-crm/database";

/**
 * Returns the list of User IDs that the given user has access to based on their role:
 * - sales_rep: self user ID only.
 * - sales_manager: self + all users where managerId = self.
 * - director / admin: all users in the system.
 */
export async function getScopedUserIds(user: { id: string; role: string }): Promise<string[]> {
  const userId = user?.id;
  const role = user?.role || "sales_rep";

  if (!userId) return [];

  if (role === "admin" || role === "director") {
    const allUsers = await sequelize.models.User.findAll({ attributes: ["id"] });
    return allUsers.map((u: any) => u.id);
  }

  if (role === "sales_manager") {
    const teamMembers = await sequelize.models.User.findAll({
      where: { managerId: userId },
      attributes: ["id"]
    });
    return [userId, ...teamMembers.map((u: any) => u.id)];
  }

  // sales_rep fallback
  return [userId];
}
