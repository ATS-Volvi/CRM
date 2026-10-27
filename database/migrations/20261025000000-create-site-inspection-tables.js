"use strict";

const { DataTypes } = require("sequelize");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() === "postgres") {
      try {
        await queryInterface.sequelize.query(
          "ALTER TYPE enum_Users_role ADD VALUE IF NOT EXISTS 'sales_manager'"
        );
        await queryInterface.sequelize.query(
          "ALTER TYPE enum_Users_role ADD VALUE IF NOT EXISTS 'site_manager'"
        );
        await queryInterface.sequelize.query(
          "ALTER TYPE enum_Users_role ADD VALUE IF NOT EXISTS 'ops_manager'"
        );
        await queryInterface.sequelize.query(
          "ALTER TYPE \"enum_Activities_type\" ADD VALUE IF NOT EXISTS 'site_inspection'"
        );
      } catch (e) {
        // Ignored if type does not exist or already added
      }
    }

    const tables = await queryInterface.showAllTables();

    // 1. Create SiteBases table
    if (!tables.includes("SiteBases")) {
      await queryInterface.createTable("SiteBases", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        region: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        latitude: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        longitude: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Seed SiteBases: JUBAIL, JAFURAH, YANBU, RIYADH
      const now = new Date();
      await queryInterface.bulkInsert("SiteBases", [
        {
          id: "11111111-1111-4111-a111-111111111111",
          code: "JUBAIL",
          name: "Jubail Operations Base",
          region: "Eastern Province",
          latitude: 27.0,
          longitude: 49.65,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "22222222-2222-4222-a222-222222222222",
          code: "JAFURAH",
          name: "Jafurah Operations Base",
          region: "Eastern Province",
          latitude: 25.55,
          longitude: 49.85,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "33333333-3333-4333-a333-333333333333",
          code: "YANBU",
          name: "Yanbu Operations Base",
          region: "Western Province",
          latitude: 24.09,
          longitude: 38.06,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "44444444-4444-4444-a444-444444444444",
          code: "RIYADH",
          name: "Riyadh Operations Base",
          region: "Central Province",
          latitude: 24.71,
          longitude: 46.68,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    // 2. Create SiteFacilities table
    if (!tables.includes("SiteFacilities")) {
      await queryInterface.createTable("SiteFacilities", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        serviceType: {
          type: DataTypes.STRING, // "SEWAGE" | "GENERAL" | "HAZARDOUS"
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        lat: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        lng: {
          type: DataTypes.FLOAT,
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      // Seed 3 per type
      const now = new Date();
      await queryInterface.bulkInsert("SiteFacilities", [
        // SEWAGE
        {
          id: "f1010000-0000-4000-a000-000000000001",
          serviceType: "SEWAGE",
          name: "Ras Tanura STP",
          lat: 26.65,
          lng: 50.15,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f1020000-0000-4000-a000-000000000002",
          serviceType: "SEWAGE",
          name: "Jubail Industrial Wastewater Treatment Plant",
          lat: 27.02,
          lng: 49.58,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f1030000-0000-4000-a000-000000000003",
          serviceType: "SEWAGE",
          name: "Yanbu Municipal Wastewater Facility",
          lat: 24.05,
          lng: 38.12,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        // GENERAL
        {
          id: "f2010000-0000-4000-a000-000000000001",
          serviceType: "GENERAL",
          name: "Jubail Ind. Waste Landfill #4",
          lat: 27.08,
          lng: 49.52,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f2020000-0000-4000-a000-000000000002",
          serviceType: "GENERAL",
          name: "Dammam Municipal Landfill",
          lat: 26.35,
          lng: 49.98,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f2030000-0000-4000-a000-000000000003",
          serviceType: "GENERAL",
          name: "Yanbu Industrial Sanitary Landfill",
          lat: 23.98,
          lng: 38.22,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        // HAZARDOUS
        {
          id: "f3010000-0000-4000-a000-000000000001",
          serviceType: "HAZARDOUS",
          name: "Bee'ah/EDCO Hazmat Complex Jubail",
          lat: 26.96,
          lng: 49.61,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f3020000-0000-4000-a000-000000000002",
          serviceType: "HAZARDOUS",
          name: "SEPCO Environmental Services Yanbu",
          lat: 24.12,
          lng: 38.02,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "f3030000-0000-4000-a000-000000000003",
          serviceType: "HAZARDOUS",
          name: "National Environmental Preservation Co (BEEA) Jubail",
          lat: 27.04,
          lng: 49.49,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    // 3. Create SiteInspections table
    if (!tables.includes("SiteInspections")) {
      await queryInterface.createTable("SiteInspections", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        inspectionNumber: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        leadId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        dealId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING, // REQUESTED | DRAFT | SUBMITTED | CHANGES_REQUESTED | APPROVED | CANCELLED
          allowNull: false,
          defaultValue: "REQUESTED",
        },
        assignedToId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        requestedById: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        requestNote: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        dueAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        baseId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        baseName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        siteName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        siteAddress: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        latitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        longitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        auditAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        rfqNumber: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        scopeSummary: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        clientOrganization: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        clientRepName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        clientRepPhone: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        mobilizationRoute: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        mobilizationKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        },
        speedLimitKmh: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 80,
        },
        baseToSiteStraightKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        },
        totalCycleKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        },
        estFuelLitres: {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        },
        observations: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        accepted: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        submittedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        reviewedById: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        reviewComment: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        revision: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      await queryInterface.addIndex("SiteInspections", ["leadId"]);
      await queryInterface.addIndex("SiteInspections", ["assignedToId"]);
      await queryInterface.addIndex("SiteInspections", ["status"]);
    }

    // 4. Create SiteInspectionServices table
    if (!tables.includes("SiteInspectionServices")) {
      await queryInterface.createTable("SiteInspectionServices", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        inspectionId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        serviceType: {
          type: DataTypes.STRING, // "SEWAGE" | "GENERAL" | "HAZARDOUS"
          allowNull: false,
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        facilityId: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        facilityName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        distanceKm: {
          type: DataTypes.FLOAT,
          allowNull: true,
          defaultValue: 0,
        },
        roadCondition: {
          type: DataTypes.STRING, // "Good" | "Fair" | "Poor"
          allowNull: true,
        },
        logisticsNote: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        wasteDescription: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        estimatedVolume: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        volumeUnit: {
          type: DataTypes.STRING, // "L" | "m3" | "ton" | "loads"
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      await queryInterface.addIndex("SiteInspectionServices", ["inspectionId"]);
    }

    // 5. Create SiteInspectionAttachments table
    if (!tables.includes("SiteInspectionAttachments")) {
      await queryInterface.createTable("SiteInspectionAttachments", {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        inspectionId: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        fileName: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        mimeType: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        sizeBytes: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
        storagePath: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        caption: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        tag: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        latitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        longitude: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        takenAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        uploadedById: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });

      await queryInterface.addIndex("SiteInspectionAttachments", ["inspectionId"]);
    }

    // 6. Extend Leads table
    if (tables.includes("Leads")) {
      const leadInfo = await queryInterface.describeTable("Leads");

      if (!leadInfo.siteInspectionStatus) {
        await queryInterface.addColumn("Leads", "siteInspectionStatus", {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "NOT_REQUESTED",
        });
      }

      if (!leadInfo.siteInspectionId) {
        await queryInterface.addColumn("Leads", "siteInspectionId", {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    if (tables.includes("Leads")) {
      const leadInfo = await queryInterface.describeTable("Leads");
      if (leadInfo.siteInspectionId) {
        await queryInterface.removeColumn("Leads", "siteInspectionId");
      }
      if (leadInfo.siteInspectionStatus) {
        await queryInterface.removeColumn("Leads", "siteInspectionStatus");
      }
    }

    if (tables.includes("SiteInspectionAttachments")) {
      await queryInterface.dropTable("SiteInspectionAttachments");
    }

    if (tables.includes("SiteInspectionServices")) {
      await queryInterface.dropTable("SiteInspectionServices");
    }

    if (tables.includes("SiteInspections")) {
      await queryInterface.dropTable("SiteInspections");
    }

    if (tables.includes("SiteFacilities")) {
      await queryInterface.dropTable("SiteFacilities");
    }

    if (tables.includes("SiteBases")) {
      await queryInterface.dropTable("SiteBases");
    }
  },
};
