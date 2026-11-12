export type Locale = 'hu' | 'en' | 'de';
export type Theme = 'light' | 'dark' | 'system';
export type Role = 'owner' | 'admin' | 'member' | 'viewer';
export type PlanKey = 'free' | 'pro' | 'business';

export interface UserSummary {
  id: number;
  name: string;
  email: string;
}

export interface User extends UserSummary {
  locale: Locale;
  theme: Theme;
  timezone: string | null;
  is_super_admin: boolean;
  email_verified_at: string | null;
  pending_email: string | null;
  two_factor_enabled: boolean;
  two_factor_recovery_codes_left: number;
  notify_task_reminders: boolean;
  notify_daily_digest: boolean;
  notify_new_leads: boolean;
  current_workspace_id: number | null;
  created_at: string;
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  locale: Locale;
  owner_id: number;
  role: Role;
  plan: PlanKey;
  effective_plan: PlanKey;
  on_trial: boolean;
  trial_ends_at: string | null;
  subscription_status: string | null;
  billing_interval: BillingInterval | null;
  intended_plan: PlanKey | null;
  created_at: string;
}

export interface UsageItem {
  used: number;
  limit: number | null;
}

export interface Subscription {
  plan: PlanKey;
  effective_plan: PlanKey;
  on_trial: boolean;
  trial_ends_at: string | null;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  billing_interval: BillingInterval | null;
  intended_plan: PlanKey | null;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  usage: Record<string, UsageItem>;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  price: number;
  prices: Record<BillingInterval, number>;
  currency: string;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

export type BillingInterval = 'monthly' | 'yearly';

export interface PlanCatalogue {
  data: PlanDefinition[];
  trial_days: number;
  checkout_enabled: boolean;
  prices_include_vat: boolean;
  vat_key: string;
}

export interface BillingStatus {
  configured: boolean;
  has_subscription: boolean;
  plan: PlanKey;
  interval: BillingInterval | null;
  intended_plan: PlanKey | null;
  stripe_status: string | null;
  on_grace_period: boolean;
  ends_at: string | null;
  subscription_trial_ends_at: string | null;
  past_due: boolean;
  payment_method: { type: string; last_four: string } | null;
  billing_details_complete: boolean;
}

export interface BillingDetails {
  billing_name: string | null;
  billing_email: string | null;
  billing_country: string | null;
  billing_postcode: string | null;
  billing_city: string | null;
  billing_address: string | null;
  billing_tax_number: string | null;
  billing_eu_vat_number: string | null;
}

export interface BillingInvoice {
  id: number;
  number: string | null;
  status: 'pending' | 'issued' | 'failed';
  plan: PlanKey | null;
  interval: BillingInterval | null;
  currency: string;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  has_pdf: boolean;
}

export interface BillingOverview {
  status: BillingStatus;
  details: BillingDetails;
  invoices: BillingInvoice[];
  vat_key: string;
  prices_include_vat: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
}

export interface Client {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  type: 'person' | 'company';
  status: 'active' | 'inactive' | 'prospect';
  category: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  notes: string | null;
  source: string;
  owner: UserSummary | null;
  owner_id: number | null;
  lead_id: number | null;
  open_tasks_count?: number;
  deals_count?: number;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';

export interface FormSubmission {
  id: number;
  form_id: number;
  form?: { id: number; name: string };
  lead_id: number | null;
  data: Record<string, unknown>;
  status: string;
  utm: Utm;
  referrer: string | null;
  marketing_consent: boolean;
  privacy_accepted: boolean;
  privacy_version: string | null;
  created_at: string;
}

export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
}

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  status: LeadStatus;
  tags: string[];
  source: string;
  form: { id: number; name: string } | null;
  form_id: number | null;
  utm: Utm;
  referrer: string | null;
  owner: UserSummary | null;
  owner_id: number | null;
  client_id: number | null;
  converted_at: string | null;
  submissions?: FormSubmission[];
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: number;
  pipeline_id: number;
  name: string;
  type: 'open' | 'won' | 'lost';
  position: number;
  deals_count?: number;
}

export interface Pipeline {
  id: number;
  name: string;
  is_default: boolean;
  position: number;
  stages: Stage[];
  deals_count?: number;
}

export interface Deal {
  id: number;
  title: string;
  pipeline_id: number;
  stage_id: number;
  stage?: Stage;
  client_id: number | null;
  client: { id: number; name: string } | null;
  lead_id: number | null;
  lead: { id: number; name: string } | null;
  value: number;
  currency: string;
  owner_id: number | null;
  owner: UserSummary | null;
  expected_close_date: string | null;
  closed_at: string | null;
  position: number;
  stage_changes?: { from: string | null; to: string; user: string | null; created_at: string }[];
  created_at: string;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  is_overdue: boolean;
  assignee_id: number | null;
  assignee: UserSummary | null;
  client_id: number | null;
  client: { id: number; name: string } | null;
  lead_id: number | null;
  lead: { id: number; name: string } | null;
  deal_id: number | null;
  deal: { id: number; title: string } | null;
  completed_at: string | null;
  created_at: string;
}

export interface Activity {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  subject_type: string;
  subject_id: number;
  subject?: { id: number; name: string } | null;
  user: UserSummary | null;
  occurred_at: string;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date';
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
}

export interface LeadForm {
  id: number;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  locale: Locale;
  title: string | null;
  description: string | null;
  fields: FormField[];
  thank_you_message: string | null;
  privacy_url: string | null;
  privacy_version: string | null;
  ask_marketing_consent: boolean;
  notify_owner: boolean;
  notify_emails: string[];
  show_branding: boolean;
  default_owner_id: number | null;
  submissions_count: number;
  public_url: string;
  embed_code: string;
  created_at: string;
}

export interface PublicForm {
  slug: string;
  locale: Locale;
  title: string;
  description: string | null;
  fields: FormField[];
  privacy_url: string | null;
  ask_marketing_consent: boolean;
  show_branding: boolean;
  workspace_name: string;
}

export interface ImportJob {
  id: number;
  target: 'clients' | 'leads';
  original_name: string;
  status: 'uploaded' | 'queued' | 'processing' | 'completed' | 'failed' | 'expired';
  sheet: string | null;
  sheets: string[];
  headers: string[];
  mapping: Record<string, string | null>;
  duplicate_mode: 'skip' | 'update';
  total_rows: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  error: string | null;
  user?: UserSummary | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface ImportPreviewRow {
  row: number;
  values: Record<string, unknown>;
  errors: string[];
  duplicate: boolean;
}

export interface ImportPayload {
  data: ImportJob;
  fields: string[];
  max_rows: number | null;
  can_update_duplicates: boolean;
  preview: { rows: ImportPreviewRow[]; summary: { valid: number; invalid: number; duplicates: number } } | null;
}

export interface Member extends UserSummary {
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: number;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  invited_by: UserSummary | null;
  created_at: string;
}

export interface AutomationRule {
  id: number;
  name: string;
  trigger: string;
  conditions: Record<string, unknown>;
  action: string;
  action_config: { title?: string; description?: string; due_in_days?: number; priority?: TaskPriority; assignee_id?: number | null; user_ids?: number[] };
  is_active: boolean;
  runs_count: number;
}

export interface CustomField {
  id: number;
  entity: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options: string[];
  position: number;
}

export interface AuditLog {
  id: number;
  action: string;
  workspace_id: number | null;
  workspace?: { id: number; name: string } | null;
  user: UserSummary | null;
  auditable_type: string | null;
  auditable_id: number | null;
  meta: Record<string, unknown> | null;
  ip_address: string | null;
  is_admin_action: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  data: { type: string; lead_id?: number; name?: string; form?: string };
  read_at: string | null;
  created_at: string;
}

export type TicketStatus = 'open' | 'answered' | 'pending' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: number;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  plan: PlanKey | null;
  workspace?: { id: number; name: string } | null;
  user?: UserSummary | null;
  assignee?: UserSummary | null;
  messages?: { id: number; is_staff: boolean; author: string | null; body: string; created_at: string }[];
  messages_count?: number;
  last_customer_reply_at: string | null;
  last_staff_reply_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}
