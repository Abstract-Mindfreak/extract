"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { useGraphStore, type GraphNode, type GraphEdge, type Community } from "@/store/graph-store";

interface SimNode extends d3.SimulationNodeDatum, GraphNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  relation: string;
  weight: number;
  description?: string;
  edgeType?: string;
}

function getLinkedNodeId(node: string | number | SimNode) {
  if (typeof node === "object" && node !== null) {
    return node.id;
  }
  return String(node);
}

const COMMUNITY_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#8b5cf6", "#ec4899", "#64748b", "#f43f5e",
];

export default function GraphViewer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const communities = useGraphStore((s) => s.communities);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const highlightedNodeIds = useGraphStore((s) => s.highlightedNodeIds);
  const highlightedEdgeIds = useGraphStore((s) => s.highlightedEdgeIds);
  const setSelectedNode = useGraphStore((s) => s.setSelectedNode);
  const setSelectedEdge = useGraphStore((s) => s.setSelectedEdge);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const renderMode = useGraphStore((s) => s.renderMode);
  const setGraphDimensions = useGraphStore((s) => s.setGraphDimensions);

  const nodeCommunityMap = useMemo(() => {
    const map = new Map<string, string>();
    communities.forEach((c) => c.nodeIds.forEach((nid) => map.set(nid, c.id)));
    return map;
  }, [communities]);

  const getNodeColor = useCallback(
    (node: SimNode): string => {
      const cId = nodeCommunityMap.get(node.id);
      if (cId) {
        const c = communities.find((x) => x.id === cId);
        if (c) return c.color;
      }
      return COMMUNITY_COLORS[node.group % COMMUNITY_COLORS.length];
    },
    [nodeCommunityMap, communities]
  );

  // Initialize graph
  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl || nodes.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    setGraphDimensions(width, height);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#64748b");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => g.attr("transform", event.transform.toString()));
    svg.call(zoom);

    const simLinks: SimLink[] = edges.map((e) => ({
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
      id: e.id, relation: e.relation, weight: e.weight,
      description: e.description, edgeType: e.edgeType,
    }));

    const link = g.append("g").selectAll("line")
      .data(simLinks).join("line")
      .attr("stroke", "#94a3b8").attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.max(1, d.weight * 2))
      .attr("marker-end", "url(#arrowhead)")
      .attr("cursor", "pointer");

    const edgeLabel = g.append("g").selectAll("text")
      .data(simLinks).join("text")
      .text((d) => d.relation)
      .attr("font-size", "9px").attr("fill", "#94a3b8").attr("fill-opacity", 0.5)
      .attr("text-anchor", "middle").attr("dy", -4)
      .style("pointer-events", "none");

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));

    const node = g.append("g").selectAll<SVGCircleElement, SimNode>("circle")
      .data(simNodes).join("circle")
      .attr("r", (d) => {
        const deg = simLinks.filter(
          (l) => (l.source as string) === d.id || (l.target as string) === d.id
        ).length;
        return Math.max(6, Math.min(18, 6 + deg * 1.5));
      })
      .attr("fill", (d) => getNodeColor(d))
      .attr("stroke", (d) => (d.id === selectedNodeId ? "#fff" : "transparent"))
      .attr("stroke-width", 2.5)
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on("start", (event, d) => {
            if (renderMode === 'detailed') {
              if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
              d.fx = d.x; d.fy = d.y;
            }
          })
          .on("drag", (event, d) => {
            if (renderMode === 'detailed') {
              d.fx = event.x; d.fy = event.y;
            }
           })
          .on("end", (event, d) => {
            if (renderMode === 'detailed') {
              if (!event.active) simulationRef.current?.alphaTarget(0);
              d.fx = null; d.fy = null;
            }
          })
      );

    const label = g.append("g").selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes).join("text")
      .text((d) => d.name.length > 20 ? d.name.slice(0, 18) + "..." : d.name)
      .attr("font-size", "10px").attr("fill", "#e2e8f0")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => {
        const deg = simLinks.filter(
          (l) => (l.source as string) === d.id || (l.target as string) === d.id
        ).length;
        return -(Math.max(6, Math.min(18, 6 + deg * 1.5)) + 6);
      })
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)");

    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(80).strength(renderMode === 'detailed' ? 0.4 : 0.1))
      .force("center", d3.forceCenter(width / 2, height / 2));

    if (renderMode === 'detailed') {
      simulation
        .force("charge", d3.forceManyBody().strength(-200))
        .force("collision", d3.forceCollide().radius(25));
    }
    
    simulationRef.current = simulation;

    simulation.on("tick", () => {
      link.attr("x1", (d) => (d.source as SimNode).x!)
          .attr("y1", (d) => (d.source as SimNode).y!)
          .attr("x2", (d) => (d.target as SimNode).x!)
          .attr("y2", (d) => (d.target as SimNode).y!);
      edgeLabel.attr("x", (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
               .attr("y", (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2);
      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    node.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedNode(d.id === selectedNodeId ? null : d.id);
    });
    link.on("click", (event, d) => { event.stopPropagation(); setSelectedEdge(d.id); });

    node.on("mouseenter", (event, d) => {
      const connectedIds = new Set<string>();
      const connectedEdgeIds = new Set<string>();
      simLinks.forEach((l) => {
        const sId = getLinkedNodeId(l.source);
        const tId = getLinkedNodeId(l.target);
        if (sId === d.id || tId === d.id) { connectedIds.add(sId); connectedIds.add(tId); connectedEdgeIds.add(l.id); }
      });
      useGraphStore.getState().setHighlightedNodes(Array.from(connectedIds));
      useGraphStore.getState().setHighlightedEdges(Array.from(connectedEdgeIds));
      node.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.15));
      link.attr("opacity", (l) => (connectedEdgeIds.has(l.id) ? 0.8 : 0.05));
      label.attr("opacity", (n) => (connectedIds.has(n.id) ? 1 : 0.1));
      edgeLabel.attr("opacity", (l) => (connectedEdgeIds.has(l.id) ? 0.8 : 0.05));
    }).on("mouseleave", () => {
      useGraphStore.getState().setHighlightedNodes([]);
      useGraphStore.getState().setHighlightedEdges([]);
      node.attr("opacity", 1);
      link.attr("opacity", 0.4);
      label.attr("opacity", 1);
      edgeLabel.attr("opacity", 0.5);
    });

    svg.on("click", () => clearSelection());
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.85));

    return () => { simulation.stop(); };
  }, [nodes, edges, communities, getNodeColor, selectedNodeId, clearSelection, setGraphDimensions, setSelectedEdge, setSelectedNode, renderMode]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGCircleElement, SimNode>(".nodes circle")
      .attr("stroke", (d) => (d.id === selectedNodeId ? "#fff" : "transparent"));
    svg.selectAll<SVGLineElement, SimLink>(".links line")
      .attr("stroke", (d) => d.id === selectedEdgeId ? "#f97316" : "#94a3b8")
      .attr("stroke-width", (d) => d.id === selectedEdgeId ? Math.max(2, d.weight * 3) : Math.max(1, d.weight * 2));
  }, [selectedNodeId, selectedEdgeId]);

  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950"
      >
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
          <p className="text-sm font-medium text-slate-200">Graph is empty</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            For GraphRAG, ingest a document in the Configuration panel.
            For Graphify, process a folder such as <span className="font-mono text-slate-300">graph-workspace/src</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 max-h-48 overflow-y-auto custom-scrollbar">
        <p className="text-xs font-medium text-slate-400 mb-2">Communities</p>
        <div className="flex flex-col gap-1">
          {communities.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="truncate max-w-[120px]">{c.label}</span>
              <span className="text-slate-500">({c.nodeIds.length})</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg px-3 py-2">
        <p className="text-xs text-slate-400">Scroll to zoom · Drag to pan · Click for details</p>
      </div>
    </div>
  );
}
