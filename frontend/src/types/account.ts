/**
 * Canonical CRM Account Types
 * Represents an organization, business, or company entity.
 */

import { Contact } from "./contact";
import { Opportunity } from "./opportunity";
import { Quote } from "./quote";
import { Order } from "./order";
import { Activity } from "./activity";

export interface Account {
  id: string;
  accountNumber?: string;

  legalName: string;
  displayName: string;
  name?: string; // compatibility alias

  industry?: string | null;
  territory?: string | null;

  country?: string | null;
  city?: string | null;
  address?: string | null;

  website?: string | null;
  taxNumber?: string | null;

  customerType?: string | null;

  ownerId?: string | null;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;

  status?: string;

  // Account 360 Aggregation Relations
  contacts?: Contact[];
  opportunities?: Opportunity[];
  deals?: Opportunity[]; // backend compatibility alias
  quotes?: Quote[];
  orders?: Order[];
  purchaseOrders?: Order[]; // backend compatibility alias
  activities?: Activity[];

  createdAt: string;
  updatedAt: string;
}
