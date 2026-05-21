import axios from "axios";

/**
 * Single axios instance. Same-origin in prod (nginx proxies /api); Vite dev
 * server proxies /api too. withCredentials so the session cookie is sent.
 */
export const api = axios.create({ baseURL: "/api", withCredentials: true });

// CSRF token (from /auth/login or /auth/me) attached to unsafe requests.
let csrfToken: string | null = null;
export const setCsrf = (t: string | null) => {
  csrfToken = t;
};

api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (csrfToken && method !== "get" && method !== "head") {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

// ---- types ----
export interface Health {
  status: string;
  db: string;
}
export interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  discord_webhook_url: string | null;
}
export interface Me extends User {
  csrf_token: string;
}
export type WorkstreamKind =
  | "active_directory"
  | "web"
  | "external"
  | "internal"
  | "wireless"
  | "cloud"
  | "social"
  | "physical"
  | "inject"
  | "other";
export interface WorkstreamInput {
  name: string;
  kind: WorkstreamKind;
  description_md?: string | null;
  assignee_ids: string[];
}
export interface EngagementInput {
  name: string;
  client?: string | null;
  type: string;
  status: string;
  scope_md?: string | null;
  roe_md?: string | null;
  workstreams: WorkstreamInput[];
  member_ids: string[];
}
export interface Workstream {
  id: string;
  name: string;
  kind: WorkstreamKind;
  description_md: string | null;
  meta: Record<string, unknown>;
  assignees: User[];
}
export interface Member {
  user: User;
  role: string;
}
export interface Engagement {
  id: string;
  name: string;
  client: string | null;
  type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  scope_md: string | null;
  roe_md: string | null;
  workstreams: Workstream[];
  members: Member[];
}
export interface EngagementListItem {
  id: string;
  name: string;
  client: string | null;
  type: string;
  status: string;
  workstream_count: number;
  member_count: number;
}

// ---- calls ----
export const fetchHealth = async (): Promise<Health> =>
  (await api.get<Health>("/health")).data;

export const bootstrapStatus = async (): Promise<{ needs_setup: boolean }> =>
  (await api.get("/auth/bootstrap-status")).data;

export const registerFirstAdmin = async (body: {
  username: string;
  password: string;
  display_name: string;
}): Promise<User> => (await api.post<User>("/auth/register", body)).data;

export const login = async (body: {
  username: string;
  password: string;
}): Promise<Me> => {
  const me = (await api.post<Me>("/auth/login", body)).data;
  setCsrf(me.csrf_token);
  return me;
};

export const fetchMe = async (): Promise<Me> => {
  const me = (await api.get<Me>("/auth/me")).data;
  setCsrf(me.csrf_token);
  return me;
};

export const logout = async (): Promise<void> => {
  await api.post("/auth/logout");
  setCsrf(null);
};

export const updateProfile = async (body: {
  display_name?: string;
  discord_webhook_url?: string | null;
}): Promise<Me> => {
  const me = (await api.patch<Me>("/auth/me", body)).data;
  setCsrf(me.csrf_token);
  return me;
};

export const testDiscordWebhook = async (): Promise<void> => {
  await api.post("/auth/me/test-discord");
};

export const listUsers = async (): Promise<User[]> =>
  (await api.get<User[]>("/auth/users")).data;

export const createUser = async (body: {
  username: string;
  password: string;
  display_name: string;
  role: "admin" | "operator";
}): Promise<User> => (await api.post<User>("/auth/users", body)).data;

export const createEngagement = async (
  body: EngagementInput,
): Promise<Engagement> =>
  (await api.post<Engagement>("/engagements", body)).data;

export const listEngagements = async (): Promise<EngagementListItem[]> =>
  (await api.get<EngagementListItem[]>("/engagements")).data;

export const getEngagement = async (id: string): Promise<Engagement> =>
  (await api.get<Engagement>(`/engagements/${id}`)).data;

export const addWorkstream = async (
  eid: string,
  body: { name: string; kind: string },
): Promise<Engagement> =>
  (await api.post<Engagement>(`/engagements/${eid}/workstreams`, body)).data;

export const patchWorkstream = async (
  eid: string,
  wsId: string,
  body: { name?: string; description_md?: string | null; meta?: Record<string, unknown> },
): Promise<Engagement> =>
  (await api.patch<Engagement>(`/engagements/${eid}/workstreams/${wsId}`, body)).data;

export const removeWorkstream = async (
  eid: string,
  wsId: string,
): Promise<Engagement> =>
  (await api.delete<Engagement>(`/engagements/${eid}/workstreams/${wsId}`)).data;

// ---- assets ----
export type AssetState =
  | "untouched"
  | "enumerated"
  | "exploited"
  | "compromised"
  | "cleaned";
export interface WorkstreamRef {
  id: string;
  name: string;
  kind: string;
}
export interface Asset {
  id: string;
  engagement_id: string;
  workstreams: WorkstreamRef[];
  workstream_ids: string[];
  type: string;
  identifier: string;
  os: string | null;
  services: NmapService[];
  in_scope: boolean;
  state: AssetState;
  tags: string[];
  notes_md: string | null;
  meta: Record<string, unknown>;
  owner_op: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface NmapService {
  port: number;
  protocol: string;
  state: string;
  name: string | null;
  product: string | null;
  version: string | null;
}

export const listAssets = async (
  eid: string,
  workstreamId?: string,
): Promise<Asset[]> =>
  (
    await api.get<Asset[]>(`/engagements/${eid}/assets`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const bulkAddAssets = async (
  eid: string,
  text: string,
  workstreamIds: string[] = [],
): Promise<Asset[]> =>
  (
    await api.post<Asset[]>(`/engagements/${eid}/assets/bulk`, {
      text,
      workstream_ids: workstreamIds,
    })
  ).data;

export const createAsset = async (
  eid: string,
  body: {
    identifier: string;
    type?: string;
    os?: string | null;
    in_scope?: boolean;
    workstream_ids?: string[];
    meta?: Record<string, unknown>;
    notes_md?: string | null;
    parent_id?: string | null;
  },
): Promise<Asset> =>
  (await api.post<Asset>(`/engagements/${eid}/assets`, body)).data;

export const updateAsset = async (
  eid: string,
  assetId: string,
  patch: Partial<
    Pick<
      Asset,
      "identifier" | "state" | "in_scope" | "tags" | "os" | "notes_md" | "type" | "meta" | "parent_id"
    >
  > & { workstream_ids?: string[] },
): Promise<Asset> =>
  (await api.patch<Asset>(`/engagements/${eid}/assets/${assetId}`, patch)).data;

export const deleteAsset = async (eid: string, assetId: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/assets/${assetId}`);
};

export interface NmapImportResult {
  created: number;
  updated: number;
  assigned_ad: number;
  assigned_web: number;
  hosts: {
    identifier: string;
    ports: number;
    os: string | null;
    ad: boolean;
    web: boolean;
  }[];
}

export const importNmap = async (
  eid: string,
  opts: { file?: File; xmlText?: string; autoSplit?: boolean },
): Promise<NmapImportResult> => {
  const fd = new FormData();
  if (opts.file) fd.append("file", opts.file);
  if (opts.xmlText) fd.append("xml_text", opts.xmlText);
  fd.append("auto_split", String(opts.autoSplit ?? true));
  return (
    await api.post<NmapImportResult>(
      `/engagements/${eid}/assets/import-nmap`,
      fd,
    )
  ).data;
};

export interface NetworkElements {
  elements: {
    group: "nodes" | "edges";
    data: Record<string, unknown>;
  }[];
}
export const getNetwork = async (
  eid: string,
  workstreamId?: string,
): Promise<NetworkElements> =>
  (
    await api.get<NetworkElements>(`/engagements/${eid}/dashboard/network`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

// ---- activity ----
export interface Activity {
  id: string;
  engagement_id: string;
  operator_id: string;
  operator_name: string;
  ts: string;
  action_type: string;
  target_asset_id: string | null;
  workstream_id: string | null;
  command: string | null;
  source_ip: string | null;
  mitre_technique: string | null;
  description: string;
}

export const listActivity = async (
  eid: string,
  targetAssetId?: string,
): Promise<Activity[]> =>
  (
    await api.get<Activity[]>(`/engagements/${eid}/activity`, {
      params: targetAssetId ? { target_asset_id: targetAssetId } : {},
    })
  ).data;

export const createActivity = async (
  eid: string,
  body: {
    description: string;
    action_type?: string;
    target_asset_id?: string | null;
    command?: string | null;
  },
): Promise<Activity> =>
  (await api.post<Activity>(`/engagements/${eid}/activity`, body)).data;

// ---- compromised users ----
export type Privilege =
  | "user"
  | "local_admin"
  | "domain_admin"
  | "root"
  | "service"
  | "other";
export type CredSource =
  | "kerberoast" | "asrep" | "spray" | "llmnr" | "secretsdump"
  | "dcsync" | "manual" | "mitm" | "bruteforce" | "phishing" | "other";
export type HashType =
  | "ntlm" | "aes128" | "aes256" | "rc4" | "plaintext"
  | "netntlmv2" | "kerb5tgs" | "kerb5asrep" | "other";
export interface CompromisedUser {
  id: string;
  engagement_id: string;
  asset_id: string | null;
  workstream_id: string | null;
  username: string;
  domain: string | null;
  privilege: Privilege;
  method_md: string | null;
  has_secret: boolean;
  validated: boolean;
  notes_md: string | null;
  source: CredSource | null;
  hash_type: HashType | null;
  cracked: boolean;
  spn: string | null;
  created_at: string;
}
export interface CompromisedUserInput {
  username: string;
  domain?: string | null;
  privilege: Privilege;
  method_md?: string | null;
  secret?: string | null;
  validated?: boolean;
  workstream_id?: string | null;
  source?: CredSource | null;
  hash_type?: HashType | null;
  cracked?: boolean;
  spn?: string | null;
}

export const listCompromisedUsers = async (
  eid: string,
  workstreamId?: string,
): Promise<CompromisedUser[]> =>
  (
    await api.get<CompromisedUser[]>(`/engagements/${eid}/compromised-users`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createCompromisedUser = async (
  eid: string,
  body: CompromisedUserInput,
): Promise<CompromisedUser> =>
  (await api.post<CompromisedUser>(`/engagements/${eid}/compromised-users`, body))
    .data;

export const updateCompromisedUser = async (
  eid: string,
  id: string,
  patch: Partial<CompromisedUserInput>,
): Promise<CompromisedUser> =>
  (
    await api.patch<CompromisedUser>(
      `/engagements/${eid}/compromised-users/${id}`,
      patch,
    )
  ).data;

export const revealSecret = async (
  eid: string,
  id: string,
): Promise<string> =>
  (
    await api.post<{ secret: string }>(
      `/engagements/${eid}/compromised-users/${id}/reveal`,
    )
  ).data.secret;

export const deleteCompromisedUser = async (
  eid: string,
  id: string,
): Promise<void> => {
  await api.delete(`/engagements/${eid}/compromised-users/${id}`);
};

// ---- artifacts ----
export type ArtifactType =
  | "account"
  | "webshell"
  | "persistence"
  | "tool"
  | "file"
  | "config"
  | "other";
export interface Artifact {
  id: string;
  engagement_id: string;
  asset_id: string | null;
  workstream_id: string | null;
  type: ArtifactType;
  description: string;
  introduced_at: string;
  removed: boolean;
  removed_at: string | null;
  notes: string | null;
}

export const listArtifacts = async (
  eid: string,
  workstreamId?: string,
): Promise<Artifact[]> =>
  (
    await api.get<Artifact[]>(`/engagements/${eid}/artifacts`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createArtifact = async (
  eid: string,
  body: {
    type: ArtifactType;
    description: string;
    notes?: string | null;
    workstream_id?: string | null;
  },
): Promise<Artifact> =>
  (await api.post<Artifact>(`/engagements/${eid}/artifacts`, body)).data;

export const updateArtifact = async (
  eid: string,
  id: string,
  patch: Partial<Pick<Artifact, "removed" | "description" | "type" | "notes">>,
): Promise<Artifact> =>
  (await api.patch<Artifact>(`/engagements/${eid}/artifacts/${id}`, patch)).data;

export const deleteArtifact = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/artifacts/${id}`);
};

// ---- evidence ----
export type EvidenceParent =
  | "asset"
  | "credential"
  | "compromised_user"
  | "finding"
  | "step"
  | "activity"
  | "artifact";
export interface Evidence {
  id: string;
  engagement_id: string;
  parent_type: EvidenceParent;
  parent_id: string;
  filename: string;
  content_type: string;
  sha256: string;
  caption: string | null;
  uploaded_by: string;
  uploaded_at: string;
  url: string;
}

export const listEvidence = async (
  eid: string,
  parentType: EvidenceParent,
  parentId: string,
): Promise<Evidence[]> =>
  (
    await api.get<Evidence[]>(`/engagements/${eid}/evidence`, {
      params: { parent_type: parentType, parent_id: parentId },
    })
  ).data;

export const uploadEvidence = async (
  eid: string,
  parentType: EvidenceParent,
  parentId: string,
  file: File,
  caption?: string,
): Promise<Evidence> => {
  const fd = new FormData();
  fd.append("parent_type", parentType);
  fd.append("parent_id", parentId);
  if (caption) fd.append("caption", caption);
  fd.append("file", file);
  return (await api.post<Evidence>(`/engagements/${eid}/evidence`, fd)).data;
};

export const deleteEvidence = async (
  eid: string,
  id: string,
): Promise<void> => {
  await api.delete(`/engagements/${eid}/evidence/${id}`);
};

// ---- access paths ----
export type PathStatus = "planning" | "working" | "achieved" | "lost";
export interface AccessStep {
  id: string;
  path_id: string;
  order_index: number;
  title: string;
  command_or_action: string | null;
  expected_result: string | null;
  from_asset_id: string | null;
  to_asset_id: string | null;
  compromised_user_id: string | null;
  mitre_technique: string | null;
  notes_md: string | null;
}
export interface AccessPath {
  id: string;
  engagement_id: string;
  name: string;
  workstream_id: string | null;
  target_asset_id: string | null;
  description_md: string | null;
  status: PathStatus;
  steps: AccessStep[];
}
export interface GraphElement {
  group: "nodes" | "edges";
  data: Record<string, unknown>;
}

export const listPaths = async (
  eid: string,
  workstreamId?: string,
): Promise<AccessPath[]> =>
  (
    await api.get<AccessPath[]>(`/engagements/${eid}/paths`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createPath = async (
  eid: string,
  body: {
    name: string;
    workstream_id?: string | null;
    target_asset_id?: string | null;
    status?: PathStatus;
  },
): Promise<AccessPath> =>
  (await api.post<AccessPath>(`/engagements/${eid}/paths`, body)).data;

export const updatePath = async (
  eid: string,
  pid: string,
  patch: Partial<Pick<AccessPath, "name" | "status" | "description_md" | "target_asset_id">>,
): Promise<AccessPath> =>
  (await api.patch<AccessPath>(`/engagements/${eid}/paths/${pid}`, patch)).data;

export const deletePath = async (eid: string, pid: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/paths/${pid}`);
};

export interface StepInput {
  title: string;
  command_or_action?: string | null;
  expected_result?: string | null;
  from_asset_id?: string | null;
  to_asset_id?: string | null;
  compromised_user_id?: string | null;
  mitre_technique?: string | null;
  notes_md?: string | null;
}

export const addStep = async (
  eid: string,
  pid: string,
  body: StepInput,
): Promise<AccessStep> =>
  (await api.post<AccessStep>(`/engagements/${eid}/paths/${pid}/steps`, body)).data;

export const updateStep = async (
  eid: string,
  pid: string,
  sid: string,
  patch: Partial<StepInput>,
): Promise<AccessStep> =>
  (
    await api.patch<AccessStep>(
      `/engagements/${eid}/paths/${pid}/steps/${sid}`,
      patch,
    )
  ).data;

export const deleteStep = async (
  eid: string,
  pid: string,
  sid: string,
): Promise<void> => {
  await api.delete(`/engagements/${eid}/paths/${pid}/steps/${sid}`);
};

export const reorderSteps = async (
  eid: string,
  pid: string,
  stepIds: string[],
): Promise<AccessPath> =>
  (
    await api.post<AccessPath>(
      `/engagements/${eid}/paths/${pid}/steps/reorder`,
      { step_ids: stepIds },
    )
  ).data;

export const getPathGraph = async (
  eid: string,
  pid: string,
): Promise<{ elements: GraphElement[] }> =>
  (await api.get(`/engagements/${eid}/paths/${pid}/graph`)).data;

// ---- findings & templates ----
export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";
export type FindingStatus =
  | "draft"
  | "open"
  | "remediated"
  | "accepted"
  | "false_positive";
export interface FindingTemplate {
  id: string;
  name: string;
  category: string | null;
  finding_type: string | null;
  severity_default: Severity;
  cwe: string | null;
  description_md: string | null;
  impact_md: string | null;
  remediation_md: string | null;
  host_detection_md: string | null;
  network_detection_md: string | null;
  references_md: string | null;
  finding_guidance_md: string | null;
  tags: string[];
}
export type TemplateInput = Omit<FindingTemplate, "id">;

export interface Finding {
  id: string;
  engagement_id: string;
  workstream_id: string | null;
  title: string;
  severity: Severity;
  status: FindingStatus;
  finding_type: string | null;
  cvss_vector: string | null;
  cvss_score: number | null;
  cwe: string | null;
  cve: string | null;
  description_md: string | null;
  impact_md: string | null;
  reproduction_md: string | null;
  remediation_md: string | null;
  host_detection_md: string | null;
  network_detection_md: string | null;
  references_md: string | null;
  tags: string[];
  template_id: string | null;
  asset_ids: string[];
}
export type FindingInput = Partial<
  Omit<Finding, "id" | "engagement_id" | "asset_ids">
> & { title: string; asset_ids?: string[]; template_id?: string | null };

export const listTemplates = async (workstreamKind?: string): Promise<FindingTemplate[]> =>
  (await api.get<FindingTemplate[]>("/finding-templates", {
    params: workstreamKind ? { workstream_kind: workstreamKind } : undefined,
  })).data;

export const createTemplate = async (
  body: Partial<TemplateInput> & { name: string },
): Promise<FindingTemplate> =>
  (await api.post<FindingTemplate>("/finding-templates", body)).data;

export const updateTemplate = async (
  id: string,
  body: Partial<TemplateInput>,
): Promise<FindingTemplate> =>
  (await api.patch<FindingTemplate>(`/finding-templates/${id}`, body)).data;

export const deleteTemplate = async (id: string): Promise<void> => {
  await api.delete(`/finding-templates/${id}`);
};

export const listFindings = async (
  eid: string,
  workstreamId?: string,
): Promise<Finding[]> =>
  (
    await api.get<Finding[]>(`/engagements/${eid}/findings`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createFinding = async (
  eid: string,
  body: FindingInput,
): Promise<Finding> =>
  (await api.post<Finding>(`/engagements/${eid}/findings`, body)).data;

export const updateFinding = async (
  eid: string,
  fid: string,
  patch: Partial<FindingInput>,
): Promise<Finding> =>
  (await api.patch<Finding>(`/engagements/${eid}/findings/${fid}`, patch)).data;

export const deleteFinding = async (
  eid: string,
  fid: string,
): Promise<void> => {
  await api.delete(`/engagements/${eid}/findings/${fid}`);
};

// ---- dashboard ----
export interface DashboardData {
  asset_total: number;
  asset_states: Record<string, number>;
  hosts: {
    id: string;
    identifier: string;
    type: string;
    state: string;
    in_scope: boolean;
    os: string | null;
    workstream_ids: string[];
  }[];
  compromised_hosts: {
    id: string;
    identifier: string;
    state: string;
    type: string;
    workstream_ids: string[];
  }[];
  compromised_users: {
    id: string;
    username: string;
    domain: string | null;
    privilege: string;
    has_secret: boolean;
    validated: boolean;
    workstream_id: string | null;
  }[];
  artifacts_open: { id: string; type: string; description: string }[];
  artifacts_total: number;
  findings_total: number;
  findings_by_severity: Record<string, number>;
  findings_open: number;
  workstreams: {
    id: string;
    name: string;
    kind: string;
    asset_count: number;
    compromised_count: number;
    finding_count: number;
  }[];
  open_injects: number;
  overdue_injects: number;
  first_inject_workstream_id: string | null;
}

export const getDashboard = async (
  eid: string,
  workstreamId?: string,
): Promise<DashboardData> =>
  (
    await api.get<DashboardData>(`/engagements/${eid}/dashboard`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

// ---- export (phase-2 report contract) ----
export const exportEngagement = async (
  eid: string,
  includeSecrets = false,
): Promise<unknown> =>
  (
    await api.get(`/engagements/${eid}/export`, {
      params: includeSecrets ? { include_secrets: "true" } : {},
    })
  ).data;

// ---- workstream-tailored: domains & webapps ----
export interface Domain {
  id: string;
  engagement_id: string;
  workstream_id: string | null;
  name: string;
  is_subdomain: boolean;
  in_scope: boolean;
  notes_md: string | null;
}
export interface WebApp {
  id: string;
  engagement_id: string;
  workstream_id: string | null;
  url: string;
  name: string | null;
  host_asset_id: string | null;
  domain_id: string | null;
  tech_md: string | null;
  notes_md: string | null;
}

export const listDomains = async (
  eid: string,
  workstreamId?: string,
): Promise<Domain[]> =>
  (
    await api.get<Domain[]>(`/engagements/${eid}/domains`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createDomain = async (
  eid: string,
  body: {
    name: string;
    is_subdomain?: boolean;
    in_scope?: boolean;
    workstream_id?: string | null;
    notes_md?: string | null;
  },
): Promise<Domain> =>
  (await api.post<Domain>(`/engagements/${eid}/domains`, body)).data;

export const deleteDomain = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/domains/${id}`);
};

export const listWebApps = async (
  eid: string,
  workstreamId?: string,
): Promise<WebApp[]> =>
  (
    await api.get<WebApp[]>(`/engagements/${eid}/webapps`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;

export const createWebApp = async (
  eid: string,
  body: {
    url: string;
    name?: string | null;
    host_asset_id?: string | null;
    domain_id?: string | null;
    workstream_id?: string | null;
    tech_md?: string | null;
    notes_md?: string | null;
  },
): Promise<WebApp> =>
  (await api.post<WebApp>(`/engagements/${eid}/webapps`, body)).data;

export const deleteWebApp = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/webapps/${id}`);
};

// ---- web hosts & subdomains ----
export interface WebHost {
  id: string;
  engagement_id: string;
  workstream_id: string | null;
  fqdn: string;
  ip: string | null;
  in_scope: boolean;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export type SubdomainState = "untouched" | "enumerated" | "exploited" | "compromised" | "cleaned";
export type SubdomainAuth = "unknown" | "none" | "basic" | "form" | "sso" | "mfa" | "cert" | "api_key";

export interface WebSubdomain {
  id: string;
  host_id: string;
  engagement_id: string;
  workstream_id: string | null;
  fqdn: string;
  ip: string | null;
  status_code: number | null;
  title: string | null;
  tech: string | null;
  auth: SubdomainAuth;
  in_scope: boolean;
  state: SubdomainState;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

export const listWebHosts = async (eid: string, wsId?: string): Promise<WebHost[]> =>
  (await api.get<WebHost[]>(`/engagements/${eid}/web-hosts`, { params: wsId ? { workstream_id: wsId } : {} })).data;

export const createWebHost = async (eid: string, body: {
  fqdn: string; ip?: string | null; in_scope?: boolean; notes_md?: string | null; workstream_id?: string | null;
}): Promise<WebHost> =>
  (await api.post<WebHost>(`/engagements/${eid}/web-hosts`, body)).data;

export const updateWebHost = async (eid: string, id: string, patch: Partial<{
  fqdn: string; ip: string | null; in_scope: boolean; notes_md: string | null; workstream_id: string | null;
}>): Promise<WebHost> =>
  (await api.patch<WebHost>(`/engagements/${eid}/web-hosts/${id}`, patch)).data;

export const deleteWebHost = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/web-hosts/${id}`);
};

export const listWebSubdomains = async (eid: string, opts: { hostId?: string; wsId?: string } = {}): Promise<WebSubdomain[]> =>
  (await api.get<WebSubdomain[]>(`/engagements/${eid}/web-subdomains`, {
    params: { ...(opts.hostId ? { host_id: opts.hostId } : {}), ...(opts.wsId ? { workstream_id: opts.wsId } : {}) },
  })).data;

export const createWebSubdomain = async (eid: string, body: {
  host_id: string; fqdn: string; ip?: string | null; status_code?: number | null;
  title?: string | null; tech?: string | null; auth?: SubdomainAuth;
  in_scope?: boolean; state?: SubdomainState; notes_md?: string | null; workstream_id?: string | null;
}): Promise<WebSubdomain> =>
  (await api.post<WebSubdomain>(`/engagements/${eid}/web-subdomains`, body)).data;

export const bulkCreateWebSubdomains = async (eid: string, body: {
  host_id: string; text: string; workstream_id?: string | null;
}): Promise<WebSubdomain[]> =>
  (await api.post<WebSubdomain[]>(`/engagements/${eid}/web-subdomains/bulk`, body)).data;

export const updateWebSubdomain = async (eid: string, id: string, patch: Partial<{
  fqdn: string; ip: string | null; status_code: number | null; title: string | null;
  tech: string | null; auth: SubdomainAuth; in_scope: boolean; state: SubdomainState; notes_md: string | null;
}>): Promise<WebSubdomain> =>
  (await api.patch<WebSubdomain>(`/engagements/${eid}/web-subdomains/${id}`, patch)).data;

export const deleteWebSubdomain = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/web-subdomains/${id}`);
};

// ---- clients ----
export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes_md: string | null;
}
export interface Client {
  id: string;
  name: string;
  short_name: string | null;
  notes_md: string | null;
  contacts: ClientContact[];
}

export const listClients = async (): Promise<Client[]> =>
  (await api.get<Client[]>("/clients")).data;

export const createClient = async (body: {
  name: string;
  short_name?: string | null;
  notes_md?: string | null;
}): Promise<Client> => (await api.post<Client>("/clients", body)).data;

export const deleteClient = async (id: string): Promise<void> => {
  await api.delete(`/clients/${id}`);
};

// ---- scratch notes ----
export interface ScratchNote {
  id: string;
  engagement_id: string;
  workstream_id: string;
  title: string;
  body: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const listScratchNotes = async (eid: string, wsId: string): Promise<ScratchNote[]> =>
  (await api.get<ScratchNote[]>(`/engagements/${eid}/workstreams/${wsId}/scratch-notes`)).data;

export const createScratchNote = async (eid: string, wsId: string, body: { title?: string; body?: string | null }): Promise<ScratchNote> =>
  (await api.post<ScratchNote>(`/engagements/${eid}/workstreams/${wsId}/scratch-notes`, body)).data;

export const updateScratchNote = async (eid: string, wsId: string, id: string, patch: { title?: string; body?: string | null }): Promise<ScratchNote> =>
  (await api.patch<ScratchNote>(`/engagements/${eid}/workstreams/${wsId}/scratch-notes/${id}`, patch)).data;

export const deleteScratchNote = async (eid: string, wsId: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/workstreams/${wsId}/scratch-notes/${id}`);
};

// ---- social campaigns ----
export type CampaignType = "email" | "vishing" | "smishing" | "usb_drop" | "other";
export type CampaignStatus = "planned" | "active" | "complete";
export interface SocialCampaign {
  id: string;
  engagement_id: string;
  workstream_id: string;
  name: string;
  campaign_type: CampaignType;
  campaign_status: CampaignStatus;
  sent: number | null;
  clicked: number | null;
  submitted: number | null;
  mfa_bypassed: number | null;
  reported: number | null;
  pretext_md: string | null;
  from_address: string | null;
  landing_url: string | null;
  tool_ref: string | null;
  started_at: string | null;
  ended_at: string | null;
  notes_md: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface SocialCampaignInput {
  name: string;
  campaign_type?: CampaignType;
  campaign_status?: CampaignStatus;
  sent?: number | null;
  clicked?: number | null;
  submitted?: number | null;
  mfa_bypassed?: number | null;
  reported?: number | null;
  pretext_md?: string | null;
  from_address?: string | null;
  landing_url?: string | null;
  tool_ref?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  notes_md?: string | null;
}

export const listCampaigns = async (eid: string, wsId: string): Promise<SocialCampaign[]> =>
  (await api.get<SocialCampaign[]>(`/engagements/${eid}/workstreams/${wsId}/campaigns`)).data;

export const createCampaign = async (eid: string, wsId: string, body: SocialCampaignInput): Promise<SocialCampaign> =>
  (await api.post<SocialCampaign>(`/engagements/${eid}/workstreams/${wsId}/campaigns`, body)).data;

export const updateCampaign = async (eid: string, wsId: string, id: string, patch: Partial<SocialCampaignInput>): Promise<SocialCampaign> =>
  (await api.patch<SocialCampaign>(`/engagements/${eid}/workstreams/${wsId}/campaigns/${id}`, patch)).data;

export const deleteCampaign = async (eid: string, wsId: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/workstreams/${wsId}/campaigns/${id}`);
};

export const addClientContact = async (
  clientId: string,
  body: { name: string; role?: string | null; email?: string | null; phone?: string | null },
): Promise<ClientContact> =>
  (await api.post<ClientContact>(`/clients/${clientId}/contacts`, body)).data;

export const deleteClientContact = async (
  clientId: string,
  contactId: string,
): Promise<void> => {
  await api.delete(`/clients/${clientId}/contacts/${contactId}`);
};

// ---- infrastructure & oplog ----
export type InfraKind =
  | "domain" | "c2_server" | "redirector" | "vps" | "phishing" | "other";
export type InfraStatus = "planned" | "active" | "burned" | "retired";
export interface Infra {
  id: string;
  engagement_id: string;
  name: string;
  kind: InfraKind;
  provider: string | null;
  status: InfraStatus;
  role: string | null;
  notes_md: string | null;
}
export const listInfra = async (eid: string): Promise<Infra[]> =>
  (await api.get<Infra[]>(`/engagements/${eid}/infrastructure`)).data;
export const createInfra = async (
  eid: string,
  body: { name: string; kind: InfraKind; provider?: string | null; status?: InfraStatus; role?: string | null },
): Promise<Infra> =>
  (await api.post<Infra>(`/engagements/${eid}/infrastructure`, body)).data;
export const updateInfra = async (
  eid: string,
  id: string,
  patch: Partial<Pick<Infra, "name" | "kind" | "provider" | "status" | "role" | "notes_md">>,
): Promise<Infra> =>
  (await api.patch<Infra>(`/engagements/${eid}/infrastructure/${id}`, patch)).data;
export const deleteInfra = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/infrastructure/${id}`);
};

export interface OplogEntry {
  id: string;
  engagement_id: string;
  operator_id: string;
  operator_name: string;
  ts: string;
  source_host: string | null;
  dest_host: string | null;
  tool: string | null;
  command: string | null;
  output: string | null;
  mitre_technique: string | null;
  workstream_id: string | null;
  description: string;
}
export const listOplog = async (
  eid: string,
  workstreamId?: string,
): Promise<OplogEntry[]> =>
  (
    await api.get<OplogEntry[]>(`/engagements/${eid}/oplog`, {
      params: workstreamId ? { workstream_id: workstreamId } : {},
    })
  ).data;
export const createOplog = async (
  eid: string,
  body: {
    description: string;
    workstream_id?: string | null;
    source_host?: string | null;
    dest_host?: string | null;
    tool?: string | null;
    command?: string | null;
    output?: string | null;
    mitre_technique?: string | null;
  },
): Promise<OplogEntry> =>
  (await api.post<OplogEntry>(`/engagements/${eid}/oplog`, body)).data;
export const deleteOplog = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/oplog/${id}`);
};

// ---- playbook ----
export type PlaybookStatus = "todo" | "in_progress" | "done" | "na";
export interface PlaybookStateEntry {
  id: string;
  workstream_id: string;
  task_key: string;
  status: PlaybookStatus;
  notes_md: string | null;
  updated_at: string;
  updated_by: string | null;
}
export interface WorkstreamNote {
  id: string;
  workstream_id: string;
  category: string;
  task_key: string | null;
  title: string;
  body_md: string | null;
  data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}
export interface PlaybookEnvelope {
  state: PlaybookStateEntry[];
  notes: WorkstreamNote[];
}

export const getPlaybook = async (
  eid: string,
  wsId: string,
): Promise<PlaybookEnvelope> =>
  (
    await api.get<PlaybookEnvelope>(
      `/engagements/${eid}/workstreams/${wsId}/playbook`,
    )
  ).data;

export const setPlaybookState = async (
  eid: string,
  wsId: string,
  taskKey: string,
  body: { status?: PlaybookStatus; notes_md?: string | null },
): Promise<PlaybookStateEntry> =>
  (
    await api.patch<PlaybookStateEntry>(
      `/engagements/${eid}/workstreams/${wsId}/playbook/state/${encodeURIComponent(taskKey)}`,
      body,
    )
  ).data;

export const createPlaybookNote = async (
  eid: string,
  wsId: string,
  body: {
    category: string;
    task_key?: string | null;
    title: string;
    body_md?: string | null;
    data?: Record<string, unknown>;
  },
): Promise<WorkstreamNote> =>
  (
    await api.post<WorkstreamNote>(
      `/engagements/${eid}/workstreams/${wsId}/playbook/notes`,
      body,
    )
  ).data;

export const updatePlaybookNote = async (
  eid: string,
  wsId: string,
  noteId: string,
  body: Partial<{
    category: string;
    task_key: string | null;
    title: string;
    body_md: string | null;
    data: Record<string, unknown>;
  }>,
): Promise<WorkstreamNote> =>
  (
    await api.patch<WorkstreamNote>(
      `/engagements/${eid}/workstreams/${wsId}/playbook/notes/${noteId}`,
      body,
    )
  ).data;

export const deletePlaybookNote = async (
  eid: string,
  wsId: string,
  noteId: string,
): Promise<void> => {
  await api.delete(
    `/engagements/${eid}/workstreams/${wsId}/playbook/notes/${noteId}`,
  );
};

// ---- inject ----
export type InjectSource = "remote_email" | "in_person" | "other";
export type InjectCategory =
  | "phishing_create"
  | "phishing_classify"
  | "network_question"
  | "general_question"
  | "other";
export type InjectStatus =
  | "open"
  | "in_progress"
  | "responded"
  | "closed"
  | "deferred";
export type InjectPriority = "low" | "normal" | "high";
export type InjectVerdict = "phishing" | "legit" | "suspicious" | "inconclusive";
export type InjectTemplateCategory = InjectCategory | "pretext";

export interface Inject {
  id: string;
  engagement_id: string;
  workstream_id: string;
  source: InjectSource;
  arrived_at: string;
  received_by: string | null;
  requester: string | null;
  category: InjectCategory;
  subject: string;
  body_md: string | null;
  deadline: string | null;
  status: InjectStatus;
  priority: InjectPriority;
  assigned_to: string | null;
  response_md: string | null;
  responded_at: string | null;
  responded_by: string | null;
  attachments: Array<Record<string, unknown>>;
  verdict: InjectVerdict | null;
  inject_number: number | null;
  point_value: number | null;
  score_awarded: number | null;
  score_completeness: string | null;
  expected_response_md: string | null;
  gap_analysis_md: string | null;
}

export interface InjectInput {
  workstream_id: string;
  source?: InjectSource;
  requester?: string | null;
  category?: InjectCategory;
  subject: string;
  body_md?: string | null;
  deadline?: string | null;
  priority?: InjectPriority;
  assigned_to?: string | null;
}

export interface InjectPatch {
  workstream_id?: string;
  source?: InjectSource;
  requester?: string | null;
  category?: InjectCategory;
  subject?: string;
  body_md?: string | null;
  deadline?: string | null;
  status?: InjectStatus;
  priority?: InjectPriority;
  assigned_to?: string | null;
  response_md?: string | null;
  verdict?: InjectVerdict | null;
  inject_number?: number | null;
  point_value?: number | null;
  score_awarded?: number | null;
  score_completeness?: string | null;
  expected_response_md?: string | null;
  gap_analysis_md?: string | null;
}

export interface InjectTemplate {
  id: string;
  engagement_id: string | null;
  category: InjectTemplateCategory;
  title: string;
  body_md: string;
  tags: string[];
  created_at: string;
  created_by: string | null;
}

export interface InjectTemplateInput {
  category: InjectTemplateCategory;
  title: string;
  body_md: string;
  tags?: string[];
  is_global?: boolean;
}

export const listInjects = async (
  eid: string,
  opts: {
    workstreamId?: string;
    statusFilter?: InjectStatus;
    category?: InjectCategory;
    q?: string;
  } = {},
): Promise<Inject[]> =>
  (
    await api.get<Inject[]>(`/engagements/${eid}/injects`, {
      params: {
        ...(opts.workstreamId ? { workstream_id: opts.workstreamId } : {}),
        ...(opts.statusFilter ? { status_filter: opts.statusFilter } : {}),
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.q ? { q: opts.q } : {}),
      },
    })
  ).data;

export const createInject = async (
  eid: string,
  body: InjectInput,
): Promise<Inject> =>
  (await api.post<Inject>(`/engagements/${eid}/injects`, body)).data;

export const getInject = async (eid: string, id: string): Promise<Inject> =>
  (await api.get<Inject>(`/engagements/${eid}/injects/${id}`)).data;

export const updateInject = async (
  eid: string,
  id: string,
  body: InjectPatch,
): Promise<Inject> =>
  (await api.patch<Inject>(`/engagements/${eid}/injects/${id}`, body)).data;

export const deleteInject = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/injects/${id}`);
};

export const listInjectTemplates = async (
  eid: string,
  opts: { category?: InjectTemplateCategory; q?: string; include_global?: boolean } = {},
): Promise<InjectTemplate[]> =>
  (
    await api.get<InjectTemplate[]>(`/engagements/${eid}/inject-templates`, {
      params: {
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.q ? { q: opts.q } : {}),
        include_global: opts.include_global ?? true,
      },
    })
  ).data;

export const createInjectTemplate = async (
  eid: string,
  body: InjectTemplateInput,
): Promise<InjectTemplate> =>
  (
    await api.post<InjectTemplate>(`/engagements/${eid}/inject-templates`, body)
  ).data;

export const updateInjectTemplate = async (
  eid: string,
  id: string,
  body: Partial<InjectTemplateInput>,
): Promise<InjectTemplate> =>
  (
    await api.patch<InjectTemplate>(
      `/engagements/${eid}/inject-templates/${id}`,
      body,
    )
  ).data;

export const deleteInjectTemplate = async (
  eid: string,
  id: string,
): Promise<void> => {
  await api.delete(`/engagements/${eid}/inject-templates/${id}`);
};

// ---- MSEL ----
export interface MSELEntry {
  id: string;
  engagement_id: string;
  workstream_id: string;
  inject_number: number;
  title: string;
  scheduled_at: string | null;
  scenario_md: string | null;
  point_value: number;
  expected_response_md: string | null;
  inject_id: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export const listMSEL = async (eid: string, wsId?: string): Promise<MSELEntry[]> =>
  (await api.get<MSELEntry[]>(`/engagements/${eid}/msel`, { params: wsId ? { workstream_id: wsId } : {} })).data;

export const createMSELEntry = async (eid: string, body: {
  workstream_id: string;
  inject_number: number;
  title: string;
  scheduled_at?: string | null;
  scenario_md?: string | null;
  point_value?: number;
  expected_response_md?: string | null;
}): Promise<MSELEntry> =>
  (await api.post<MSELEntry>(`/engagements/${eid}/msel`, body)).data;

export const updateMSELEntry = async (eid: string, id: string, patch: Partial<{
  inject_number: number;
  title: string;
  scheduled_at: string | null;
  scenario_md: string | null;
  point_value: number;
  expected_response_md: string | null;
  inject_id: string | null;
  delivered_at: string | null;
}>): Promise<MSELEntry> =>
  (await api.patch<MSELEntry>(`/engagements/${eid}/msel/${id}`, patch)).data;

export const deleteMSELEntry = async (eid: string, id: string): Promise<void> => {
  await api.delete(`/engagements/${eid}/msel/${id}`);
};

// ---- Ghostwriter integration ----
export interface GhostwriterConfig {
  url: string | null;
  enabled: boolean;
  token_set: boolean;
}

export interface GhostwriterExportResult {
  pushed: number;
  updated: number;
  errors: string[];
}

export const getGhostwriterConfig = async (): Promise<GhostwriterConfig> =>
  (await api.get<GhostwriterConfig>("/admin/ghostwriter")).data;

export const updateGhostwriterConfig = async (data: {
  url: string;
  api_token: string;
  enabled: boolean;
}): Promise<GhostwriterConfig> =>
  (await api.put<GhostwriterConfig>("/admin/ghostwriter", data)).data;

export const testGhostwriterConnection = async (): Promise<{
  ok: boolean;
  message: string;
}> => (await api.post("/admin/ghostwriter/test")).data;

export const exportToGhostwriter = async (
  eid: string,
  statuses: string[],
): Promise<GhostwriterExportResult> =>
  (
    await api.post<GhostwriterExportResult>(
      `/engagements/${eid}/export/ghostwriter`,
      { statuses },
    )
  ).data;
