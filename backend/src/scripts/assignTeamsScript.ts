import { sequelize } from "@nexus-crm/database";

async function assignTeamsScript() {
  console.log("==================================================");
  console.log("ASSIGNING ALL SALES REPS TO TEAM LEADS IN DATABASE");
  console.log("==================================================");

  try {
    await sequelize.authenticate();

    const users: any[] = await sequelize.models.User.findAll({
      attributes: ["id", "name", "email", "role", "department", "territory", "managerId"]
    });
    console.log(`Loaded ${users.length} total users from database.`);

    const managers = users.filter((u: any) => u.role === "sales_manager" || u.role === "admin");
    const marcus = users.find((u: any) => u.name === "Marcus Vance" || u.email === "marcus@nexus.com") || managers[0];
    const helena = users.find((u: any) => u.name === "Helena Rostova" || u.email === "helena@nexus.com") || managers[1] || marcus;

    console.log(`Team Lead 1: ${marcus?.name} (ID: ${marcus?.id})`);
    console.log(`Team Lead 2: ${helena?.name} (ID: ${helena?.id})`);

    const reps = users.filter((u: any) => u.role === "sales_rep" || (u.role !== "admin" && u.role !== "sales_manager"));
    console.log(`Found ${reps.length} sales representatives to assign.`);

    let marcusCount = 0;
    let helenaCount = 0;

    for (let i = 0; i < reps.length; i++) {
      const r = reps[i];
      const isEmeaApac = (r.territory || r.department || "").toLowerCase().includes("emea") || 
                         (r.territory || r.department || "").toLowerCase().includes("apac");
      
      const assignedLeadId = (isEmeaApac || i % 2 === 1) ? (helena?.id || marcus?.id) : (marcus?.id || helena?.id);

      if (assignedLeadId === marcus?.id) marcusCount++;
      else helenaCount++;

      // 1. Update User.managerId
      await r.update({ managerId: assignedLeadId });

      // 2. Update or Create SalesApprovalProfile
      let prof: any = await sequelize.models.SalesApprovalProfile.findOne({
        where: { salesRepId: r.id }
      });

      if (prof) {
        await prof.update({ teamLeadId: assignedLeadId });
      } else {
        await sequelize.models.SalesApprovalProfile.create({
          id: require("crypto").randomUUID(),
          salesRepId: r.id,
          teamLeadId: assignedLeadId,
          selfApprovalLimit: 1000000,
          discountApprovalLimit: 0.10,
          minimumMargin: 0.20,
          approvalEnabled: true
        });
      }
    }

    console.log("==================================================");
    console.log(`ASSIGNMENT COMPLETE:`);
    console.log(`- Marcus Vance's Team: ${marcusCount} Representatives`);
    console.log(`- Helena Rostova's Team: ${helenaCount} Representatives`);
    console.log("==================================================");
  } catch (err) {
    console.error("Assignment failed:", err);
  }
}

assignTeamsScript();
