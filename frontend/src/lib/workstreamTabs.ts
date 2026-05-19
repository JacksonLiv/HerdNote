import type { WorkstreamKind } from "../api/client";

export type WorkstreamTabKey =
  | "playbook"
  | "hosts"
  | "findings"
  | "access"
  | "notes"
  | "inbox"
  | "library";

const STANDARD: WorkstreamTabKey[] = [
  "playbook",
  "hosts",
  "findings",
  "access",
  "notes",
];

/**
 * Which tabs are visible when a specific workstream is selected.
 * Dashboard is rendered separately and is always global.
 */
export const KIND_TABS: Record<WorkstreamKind, WorkstreamTabKey[]> = {
  active_directory: STANDARD,
  web: STANDARD,
  external: STANDARD,
  internal: STANDARD,
  wireless: STANDARD,
  cloud: STANDARD,
  social: STANDARD,
  physical: STANDARD,
  inject: ["playbook", "inbox", "library", "notes"],
  other: STANDARD,
};

export const TAB_LABEL: Record<WorkstreamTabKey, string> = {
  playbook: "Playbook",
  hosts: "Hosts",
  findings: "Findings",
  access: "Access",
  notes: "Notes",
  inbox: "Inbox",
  library: "Library",
};
