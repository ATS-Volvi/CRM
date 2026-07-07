import { Database, sequelize } from "@nexus-crm/database";
import { mockLeads, mockPipeline, mockQuotes, mockPurchaseOrders, mockPriceBook, mockApprovals, mockAssignmentRules } from "./index";
import bcrypt from "bcrypt";
import crypto from "crypto";

async function seedDatabase() {
  try {
    await Database.createConnection();
    console.log("Syncing database...");
    await sequelize.sync({ force: true });
    
    const models = sequelize.models;
    
    let mockUser: any;
    if (models.User) {
      console.log("Creating Mock User...");
      const hashedPassword = await bcrypt.hash("password123", 10);
      const adminUser = await models.User.create({
        id: crypto.randomUUID(),
        name: "Admin User",
        email: "admin@nexus.com",
        password: hashedPassword,
        role: "admin"
      });
      mockUser = adminUser;
    }

    if (models.Lead) {
      console.log("Seeding Leads...");
      await models.Lead.bulkCreate(mockLeads.map(l => {
        const parts = l.contactName.split(' ');
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ') || 'Unknown';
        
        return {
          id: crypto.randomUUID(),
          firstName,
          lastName,
          company: l.name,
          email: l.email,
          status: l.status,
          source: l.source,
          leadScore: l.score || 50,
          assignedToId: mockUser ? (mockUser as any).id : null,
        }
      }));
    }

    // Create a Pipeline Stage and Deal for the quotes
    let mockDeal: any;
    if (models.PipelineStage && models.Deal) {
      console.log("Seeding Pipeline Stages...");
      const stages = ["New", "Contacted", "Qualified", "Meeting/Demo", "Proposal", "Negotiation", "Won", "Lost", "On Hold"];
      const stageRecords = [];
      for (let i = 0; i < stages.length; i++) {
        stageRecords.push(await models.PipelineStage.create({
          id: crypto.randomUUID(),
          name: stages[i],
          order: i + 1
        }));
      }

      mockDeal = await models.Deal.create({
        id: crypto.randomUUID(),
        name: "Mock Deal",
        amount: 10000,
        stageId: (stageRecords[0] as any).id,
        ownerId: mockUser ? (mockUser as any).id : null,
      });
    }

    if (models.Quote && mockDeal) {
      console.log("Seeding Quotes...");
      await models.Quote.bulkCreate(mockQuotes.map((q: any) => ({
        id: crypto.randomUUID(),
        dealId: mockDeal.id,
        status: q.status,
        totalAmount: q.items ? q.items.reduce((acc: number, item: any) => acc + item.total, 0) : 0,
      })));
    }

    if (models.PriceBookEntry) {
      console.log("Seeding PriceBook...");
      await models.PriceBookEntry.bulkCreate(mockPriceBook.map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        sku: p.sku,
        category: p.category,
        unitPrice: p.msrp,
      })));
    }
    
    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  }
}

seedDatabase();
