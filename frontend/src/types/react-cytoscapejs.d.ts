declare module "react-cytoscapejs" {
  import type { CSSProperties } from "react";
  import type {
    ElementDefinition,
    LayoutOptions,
    Stylesheet,
    Core,
  } from "cytoscape";

  export interface CytoscapeComponentProps {
    elements: ElementDefinition[];
    style?: CSSProperties;
    layout?: LayoutOptions;
    stylesheet?: Stylesheet[];
    cy?: (cy: Core) => void;
    className?: string;
    zoom?: number;
    pan?: { x: number; y: number };
  }

  const CytoscapeComponent: (props: CytoscapeComponentProps) => JSX.Element;
  export default CytoscapeComponent;
}
