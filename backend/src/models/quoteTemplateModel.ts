import { DataTypes, Model } from "sequelize";
import { sequelize } from "@nexus-crm/database";

export class QuoteTemplate extends Model {
  public id!: string;
  public name!: string;
  public isDefault!: boolean;
  public companyName!: string;
  public companyAddress!: string;
  public companyLogoUrl?: string;
  public primaryColor!: string;
  public headerBgColor!: string;
  public headerLayout!: string;
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
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Faisal Fahad Hussain Al Kari Transportation Co."
    },
    companyAddress: {
      type: DataTypes.STRING,
      defaultValue: "Prince Fahad St, Al Khobar, Kingdom of Saudi Arabia"
    },
    companyLogoUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    primaryColor: {
      type: DataTypes.STRING,
      defaultValue: "#6b21a8"
    },
    headerBgColor: {
      type: DataTypes.STRING,
      defaultValue: "#fbf5ff"
    },
    headerLayout: {
      type: DataTypes.STRING,
      defaultValue: "top-bar-split-box"
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
