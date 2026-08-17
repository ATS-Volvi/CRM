/**
 * Canonical CRM Contact Types
 * Represents an individual person associated with an Account.
 */

export interface Contact {
  id: string;
  accountId: string;
  account?: {
    id: string;
    name?: string;
    displayName?: string;
  } | null;

  firstName: string;
  lastName?: string;

  jobTitle?: string | null;
  department?: string | null;

  email?: string | null;
  phone?: string | null;
  mobile?: string | null;

  role?: string | null;
  isPrimary?: boolean;

  sourceChannel?: string | null;
  status?: string;

  createdAt: string;
  updatedAt: string;
}
