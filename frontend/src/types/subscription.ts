export enum SubscriptionStatus {
  Active = "Active",
  PastDue = "Past Due",
  Canceled = "Canceled",
  Trialing = "Trialing"
}

export enum SubscriptionBillingCycle {
  Monthly = "Monthly",
  Quarterly = "Quarterly",
  Annual = "Annual"
}

export interface Subscription {
  id: string;
  accountId: string;
  planName: string;
  mrr: number;
  billingCycle: SubscriptionBillingCycle;
  startDate: string;
  endDate?: string;
  status: SubscriptionStatus;
  createdAt?: string;
  updatedAt?: string;
}
