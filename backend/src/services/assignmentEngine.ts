import { sequelize } from "@nexus-crm/database";

interface AssignmentContext {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  industry?: string;
  [key: string]: any;
}

// Memory cache to keep track of round-robin indexes per rule
const roundRobinCursors: Record<string, number> = {};

export async function assignLead(leadContext: AssignmentContext): Promise<string | null> {
  try {
    const rules = await sequelize.models.AssignmentRule.findAll({
      where: { isActive: true },
      order: [["priority", "ASC"]], // Lower priority number is evaluated first
      include: [{ model: sequelize.models.User, as: "assignTo" }]
    });

    for (const rule of rules) {
      let isMatch = false;
      const ruleData = rule.toJSON();

      try {
        const criteria = JSON.parse(ruleData.criteria);
        // Standard structural match: verify that every key in criteria matches context values
        isMatch = Object.keys(criteria).every(key => {
          const val = criteria[key];
          const contextVal = leadContext[key];
          if (typeof val === "string" && typeof contextVal === "string") {
            return contextVal.toLowerCase() === val.toLowerCase();
          }
          return contextVal === val;
        });
      } catch (err) {
        console.error(`Invalid JSON in assignment rule criteria ${ruleData.id}:`, err);
        continue;
      }

      if (isMatch) {
        const ruleType = ruleData.ruleType || "Direct";

        if (ruleType === "Round-robin") {
          // Find all available salespeople in the same role or matching team group
          const targetUser = await sequelize.models.User.findByPk(ruleData.assignToId);
          if (!targetUser) continue;

          // Find all active team members with the same role
          const team = await sequelize.models.User.findAll({
            where: { role: (targetUser as any).role, isAvailable: true }
          });

          if (team.length === 0) continue;

          // Round-robin selection
          const cursorKey = `${ruleData.id}_${(targetUser as any).role}`;
          let cursor = roundRobinCursors[cursorKey] || 0;
          if (cursor >= team.length) {
            cursor = 0;
          }
          const assignedUser = team[cursor];
          roundRobinCursors[cursorKey] = cursor + 1;

          return (assignedUser as any).id;
        }

        if (ruleType === "Capacity-based") {
          // Find all active salespeople in the same role
          const targetUser = await sequelize.models.User.findByPk(ruleData.assignToId);
          if (!targetUser) continue;

          const team = await sequelize.models.User.findAll({
            where: { role: (targetUser as any).role, isAvailable: true }
          });

          if (team.length === 0) continue;

          // Get active lead counts for each member
          const candidates = await Promise.all(
            team.map(async (user: any) => {
              const openLeadsCount = await sequelize.models.Lead.count({
                where: {
                  assignedToId: user.id,
                  status: ["New", "Contacted", "Qualified"] // Active stages
                }
              });
              return { user, openLeadsCount };
            })
          );

          // Filter out users who have reached capacity cap
          const underCapacity = candidates.filter(
            c => c.openLeadsCount < (c.user.maxOpenLeads || 20)
          );

          if (underCapacity.length === 0) continue;

          // Assign to the person with the lowest count
          underCapacity.sort((a, b) => a.openLeadsCount - b.openLeadsCount);
          return underCapacity[0].user.id;
        }

        // Default Direct assignment to the rule's assignToId
        const user = await sequelize.models.User.findByPk(ruleData.assignToId);
        if (user && (user as any).isAvailable) {
          // Check capacity limit if it's direct capacity
          const openLeadsCount = await sequelize.models.Lead.count({
            where: {
              assignedToId: (user as any).id,
              status: ["New", "Contacted", "Qualified"]
            }
          });
          if (openLeadsCount < ((user as any).maxOpenLeads || 20)) {
            return (user as any).id;
          }
        }
      }
    }

    // Default Fallback: Assign to first available admin
    const defaultAdmin = await sequelize.models.User.findOne({
      where: { role: "admin", isAvailable: true }
    });
    return defaultAdmin ? (defaultAdmin as any).id : null;
  } catch (error) {
    console.error("Assignment Engine error:", error);
    return null;
  }
}
