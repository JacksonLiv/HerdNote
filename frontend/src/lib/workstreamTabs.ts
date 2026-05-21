import type { WorkstreamKind } from "../api/client";

export type WorkstreamTabKey =
  | "overview"
  | "playbook"
  | "creds"
  | "hosts"
  | "findings"
  | "access"
  | "notes"
  | "aps"
  | "sites"
  | "targets"
  | "campaigns"
  | "inbox"
  | "library"
  | "domain"
  | "clients"
  | "recon"
  | "endpoints"
  | "iam"
  | "evidence"
  | "segments"
  | "loot"
  | "infra"
  | "oplog"
  | "web_hosts"
  | "buildings"
  | "msel";

export const KIND_TABS: Record<WorkstreamKind, WorkstreamTabKey[]> = {
  active_directory: ["overview", "domain", "playbook", "hosts", "creds", "findings", "access", "oplog", "notes"],
  web:              ["overview", "playbook", "web_hosts", "endpoints", "creds", "findings", "oplog", "notes"],
  external:         ["overview", "playbook", "hosts", "recon", "infra", "creds", "findings", "oplog", "notes"],
  internal:         ["overview", "playbook", "hosts", "segments", "loot", "creds", "findings", "access", "oplog", "notes"],
  wireless:         ["overview", "playbook", "aps", "clients", "creds", "findings", "oplog", "notes"],
  cloud:            ["overview", "playbook", "hosts", "iam", "creds", "findings", "access", "oplog", "notes"],
  social:           ["overview", "playbook", "targets", "campaigns", "creds", "findings", "oplog", "notes"],
  physical:         ["overview", "playbook", "sites", "buildings", "evidence", "findings", "notes"],
  inject:           ["overview", "playbook", "msel", "inbox", "library", "notes"],
  other:            ["overview", "playbook", "creds", "hosts", "findings", "oplog", "notes"],
};

export const TAB_LABEL: Record<WorkstreamTabKey, string> = {
  overview:   "Overview",
  playbook:   "Playbook",
  creds:      "Credentials",
  hosts:      "Hosts",
  findings:   "Findings",
  access:     "Access",
  notes:      "Notes",
  aps:        "Access Points",
  sites:      "Sites",
  targets:    "Targets",
  campaigns:  "Campaigns",
  inbox:      "Inbox",
  library:    "Library",
  domain:     "Domain",
  clients:    "Clients",
  recon:      "Recon",
  endpoints:  "Endpoints",
  iam:        "IAM",
  evidence:   "Evidence",
  segments:   "Segments",
  loot:       "Loot",
  infra:      "Infrastructure",
  oplog:      "Op Log",
  web_hosts:  "Web Hosts",
  buildings:  "Buildings",
  msel:       "MSEL",
};

/** Label overrides per workstream kind. */
export const KIND_TAB_LABEL: Partial<Record<WorkstreamKind, Partial<Record<WorkstreamTabKey, string>>>> = {
  web:      { hosts: "Applications" },
  external: { hosts: "Assets" },
  cloud:    { hosts: "Resources" },
};

export function tabLabel(kind: WorkstreamKind, key: WorkstreamTabKey): string {
  return KIND_TAB_LABEL[kind]?.[key] ?? TAB_LABEL[key];
}
