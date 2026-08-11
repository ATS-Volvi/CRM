import { DataTypes, Model } from "sequelize";
import { sequelize } from "@nexus-crm/database";

export class QuoteTemplate extends Model {
  public id!: string;
  public name!: string;
  public version!: string;
  public accuracyScore!: number;
  public isDefault!: boolean;
  public companyName!: string;
  public companyTagline?: string;
  public companyAddress!: string;
  public companyLogoUrl?: string;
  public logoAssetId?: string;
  public crNumber?: string;
  public vatNumber?: string;
  public phone?: string;
  public email?: string;
  public website?: string;
  public extractedItems?: any;
  public layoutElements?: any;
  public primaryColor!: string;
  public secondaryColor!: string;
  public headerBgColor!: string;
  public headerLayout!: string;
  public pageConfig!: any;
  public typography!: any;
  public introLetterEnabled!: boolean;
  public introLetterText!: string;
  public tableColumns!: any;
  public currency!: string;
  public taxRate!: number;
  public footerNotes?: string;
  public signatureLines!: any;
}

QuoteTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: "1.0"
    },
    accuracyScore: {
      type: DataTypes.FLOAT,
      defaultValue: 95.0
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    companyAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    companyLogoUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    logoAssetId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    crNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vatNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true
    },
    layoutElements: {
      type: DataTypes.JSON,
      defaultValue: [
        { id: "header", type: "header", x: 0, y: 0, width: "100%", height: 60 },
        { id: "divider", type: "divider", x: 0, y: 65, width: "100%", height: 2 },
        { id: "metaGrid", type: "grid", x: 0, y: 75, width: "100%", height: 70 },
        { id: "proposal", type: "text", x: 0, y: 155, width: "100%", height: 60 },
        { id: "lineItems", type: "table", x: 0, y: 225, width: "100%", height: "auto" },
        { id: "totals", type: "totals", x: 540, y: 350, width: 260, height: 100 },
        { id: "terms", type: "terms", x: 0, y: 460, width: "100%", height: 80 },
        { id: "signatures", type: "footer", x: 0, y: 550, width: "100%", height: 60 }
      ]
    },
    primaryColor: {
      type: DataTypes.STRING,
      defaultValue: "#6b21a8"
    },
    secondaryColor: {
      type: DataTypes.STRING,
      defaultValue: "#4c1d95"
    },
    headerBgColor: {
      type: DataTypes.STRING,
      defaultValue: "#fbf5ff"
    },
    headerLayout: {
      type: DataTypes.STRING,
      defaultValue: "top-bar-split-box"
    },
    pageConfig: {
      type: DataTypes.JSON,
      defaultValue: {
        size: "A4",
        orientation: "portrait",
        marginTop: 20,
        marginRight: 20,
        marginBottom: 20,
        marginLeft: 20
      }
    },
    typography: {
      type: DataTypes.JSON,
      defaultValue: {
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.5,
        fontDetectionConfidence: 0.95
      }
    },
    introLetterEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    introLetterText: {
      type: DataTypes.TEXT,
      defaultValue: "Thank you for showing your interest in us & inviting us to Quote. Faisal Fahad Hussain Al Kari Transportation Co. has remained one of the Big Players in Industrial Services in the market over the past two decades and we continue to strive every day to make every client experience the most unique & pleasing one."
    },
    tableColumns: {
      type: DataTypes.JSON,
      defaultValue: [
        { key: "slNo", label: "Sl No.", width: "10%", align: "center" },
        { key: "description", label: "Item Description", width: "50%", align: "left" },
        { key: "uom", label: "UOM", width: "12%", align: "center" },
        { key: "qty", label: "Qty", width: "10%", align: "center" },
        { key: "price", label: "Price (SAR)", width: "18%", align: "right" }
      ]
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "SAR"
    },
    taxRate: {
      type: DataTypes.FLOAT,
      defaultValue: 0.15
    },
    footerNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    signatureLines: {
      type: DataTypes.JSON,
      defaultValue: ["Authorized Signature", "Client Acceptance"]
    }
  },
  {
    sequelize,
    tableName: "quote_templates",
    timestamps: true
  }
);

export default QuoteTemplate;
