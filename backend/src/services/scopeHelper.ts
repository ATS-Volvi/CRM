import { sequelize } from "@nexus-crm/database";
import { Op } from "sequelize";

/**
 * Returns the list of User IDs that the given user has access to based on their role:
 * - sales_rep: self user ID only.
 * - sales_manager / manager: self + direct reports (managerId = self) + team members sharing manager's team.
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

  if (role === "manager" || role === "sales_manager") {
    const managerRecord = await sequelize.models.User.findByPk(userId, { attributes: ["team"] });
    const managerTeam = (managerRecord as any)?.team;

    const orConditions: any[] = [{ managerId: userId }];
    if (managerTeam && managerTeam !== "Unassigned") {
      orConditions.push({ team: managerTeam });
    }

    const teamMembers = await sequelize.models.User.findAll({
      where: { [Op.or]: orConditions },
      attributes: ["id"]
    });
    return Array.from(new Set([userId, ...teamMembers.map((u: any) => u.id)]));
  }

  // sales_rep fallback
  return [userId];
}
