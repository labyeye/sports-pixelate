export type UserRole =
  | 'super_admin'
  | 'hr_manager'
  | 'hr_executive'
  | 'department_head'
  | 'employee'
  | 'parent';

export interface Subscription {
  status: 'active' | 'inactive' | 'pending_renewal' | 'trial';
  plan?: string;
  paymentStatus?: 'completed' | 'pending' | 'failed';
  isTrial?: boolean;
  renewalDate?: string;
  trialEndDate?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'trial';
  subscription?: Subscription;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  status?: string;
  department?: string;
  company?: Company;
  subscription?: Subscription;
  children?: string[]; // Student IDs — only set when role === "parent"
}
