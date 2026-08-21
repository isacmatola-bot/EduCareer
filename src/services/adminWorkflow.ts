import { requireSupabase } from './supabaseClient';

export type ApplicationReviewStatus = 'submitted' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn';
export type PartnerReviewStatus = 'submitted' | 'reviewing' | 'approved' | 'rejected';

export type AdminApplicationReview = {
  id: string;
  opportunityId: string;
  accountId: string;
  status: ApplicationReviewStatus;
  createdAt: string;
  updatedAt: string;
  applicantName: string;
  applicantUsername: string;
  applicantEmail: string;
  opportunityTitle: string;
};

export type AdminPartnerReview = {
  id: string;
  accountId: string | null;
  username: string;
  organizationName: string;
  contactPerson: string;
  email: string;
  phone: string;
  organizationType: string;
  supportNeeded: string;
  status: PartnerReviewStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminWorkflowData = {
  applications: AdminApplicationReview[];
  partners: AdminPartnerReview[];
};

type WorkflowLoadOptions = {
  applications: boolean;
  partners: boolean;
};

type ApplicationRow = {
  id: string;
  opportunity_id: string;
  account_id: string;
  status: ApplicationReviewStatus;
  created_at: string;
  updated_at: string;
  applicant_name: string;
  applicant_username: string;
  applicant_email: string;
  opportunity_title: string;
};

type PartnerRow = {
  id: string;
  account_id: string | null;
  username: string | null;
  organization_name: string;
  contact_person: string;
  email: string;
  phone: string;
  organization_type: string;
  support_needed: string;
  status: PartnerReviewStatus;
  created_at: string;
  updated_at: string;
};

export async function loadAdminWorkflow(options: WorkflowLoadOptions): Promise<AdminWorkflowData> {
  const client = requireSupabase();

  const applicationPromise = options.applications
    ? client.rpc('list_opportunity_applications_for_admin')
    : Promise.resolve({ data: [] as ApplicationRow[], error: null });

  const partnerPromise = options.partners
    ? client
        .from('partner_requests')
        .select('id, account_id, username, organization_name, contact_person, email, phone, organization_type, support_needed, status, created_at, updated_at')
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] as PartnerRow[], error: null });

  const [applicationResult, partnerResult] = await Promise.all([applicationPromise, partnerPromise]);

  if (applicationResult.error) throw new Error(applicationResult.error.message);
  if (partnerResult.error) throw new Error(partnerResult.error.message);

  return {
    applications: ((applicationResult.data ?? []) as ApplicationRow[]).map((row) => ({
      id: row.id,
      opportunityId: row.opportunity_id,
      accountId: row.account_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      applicantName: row.applicant_name,
      applicantUsername: row.applicant_username,
      applicantEmail: row.applicant_email,
      opportunityTitle: row.opportunity_title
    })),
    partners: ((partnerResult.data ?? []) as PartnerRow[]).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      username: row.username ?? '',
      organizationName: row.organization_name,
      contactPerson: row.contact_person,
      email: row.email,
      phone: row.phone,
      organizationType: row.organization_type,
      supportNeeded: row.support_needed,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

export async function reviewOpportunityApplication(
  applicationId: string,
  status: Exclude<ApplicationReviewStatus, 'submitted' | 'withdrawn'>
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('review_opportunity_application', {
    p_application_id: applicationId,
    p_status: status
  });

  if (error) throw new Error(error.message);
}

export async function reviewPartnerRequest(
  requestId: string,
  status: Exclude<PartnerReviewStatus, 'submitted'>
): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('review_partner_request', {
    p_request_id: requestId,
    p_status: status
  });

  if (error) throw new Error(error.message);
}
