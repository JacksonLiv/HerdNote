import { Loader, Paper, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ElementDefinition } from "cytoscape";
import CytoscapeComponent from "react-cytoscapejs";

import { getNetwork } from "../api/client";

const STATE_COLOR: Record<string, string> = {
  untouched: "#7E96A0",
  enumerated: "#29AFCE",
  exploited: "#F08C00",
  compromised: "#E03131",
  cleaned: "#006747",
};

/**
 * Hosts clustered into /24 subnet boxes (Cytoscape compound nodes).
 * Global on the Dashboard, workstream-scoped on the Hosts tab.
 */
export function NetworkDiagram({
  eid,
  workstreamId,
  height = 380,
}: {
  eid: string;
  workstreamId?: string;
  height?: number;
}) {
  const q = useQuery({
    queryKey: ["network", eid, workstreamId ?? "all"],
    queryFn: () => getNetwork(eid, workstreamId),
  });

  if (q.isLoading) return <Loader />;
  const elements = q.data?.elements ?? [];
  const hostCount = elements.filter((e) => !e.data.subnet).length;
  if (hostCount === 0)
    return (
      <Text c="dimmed" size="sm" ta="center" py="lg">
        No hosts to map yet — add hosts or import an nmap scan.
      </Text>
    );

  return (
    <Paper withBorder radius="md" h={height}>
      <CytoscapeComponent
        elements={elements as unknown as ElementDefinition[]}
        style={{ width: "100%", height: "100%" }}
        layout={{ name: "cose", padding: 20, nodeRepulsion: 8000 }}
        stylesheet={[
          {
            selector: "node[subnet]",
            style: {
              label: "data(label)",
              "background-color": "#1a1f1d",
              "background-opacity": 0.5,
              "border-color": "#466069",
              "border-width": 1,
              shape: "round-rectangle",
              "text-valign": "top",
              "font-size": 11,
              color: "#CFC493",
              padding: 14,
            },
          },
          {
            selector: "node[!subnet]",
            style: {
              label: "data(label)",
              "background-color": (ele: { data: (k: string) => string }) =>
                STATE_COLOR[ele.data("state")] ?? "#7E96A0",
              color: "#EDEBD1",
              "font-size": 9,
              "text-valign": "bottom",
              "text-margin-y": 4,
              width: 22,
              height: 22,
            },
          },
        ]}
      />
    </Paper>
  );
}
