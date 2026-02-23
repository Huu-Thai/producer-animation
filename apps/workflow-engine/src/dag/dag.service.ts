import { Injectable, BadRequestException } from '@nestjs/common';

export interface WorkflowNode {
  id: string;
  type: string;
  config?: Record<string, any>;
}

export interface WorkflowEdge {
  source: string;
  target: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface DagAnalysis {
  topologicalOrder: string[];
  rootNodes: string[];
  inDegree: Map<string, number>;
  adjacency: Map<string, string[]>;
}

@Injectable()
export class DagService {
  analyzeWorkflow(workflow: WorkflowDefinition): DagAnalysis {
    const { nodes, edges } = workflow;
    const nodeIds = new Set(nodes.map((n) => n.id));

    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new BadRequestException(
          `Edge references unknown node: ${edge.source} -> ${edge.target}`,
        );
      }
      adjacency.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    // Kahn's algorithm for topological sort + cycle detection
    const queue: string[] = [];
    const tempInDegree = new Map(inDegree);

    for (const [id, deg] of tempInDegree) {
      if (deg === 0) queue.push(id);
    }

    const topologicalOrder: string[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      topologicalOrder.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const newDeg = (tempInDegree.get(neighbor) ?? 0) - 1;
        tempInDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    if (topologicalOrder.length !== nodes.length) {
      throw new BadRequestException('Workflow contains a cycle – check your node connections');
    }

    const rootNodes = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);

    return { topologicalOrder, rootNodes, inDegree, adjacency };
  }

  getParentIds(nodeId: string, edges: WorkflowEdge[]): string[] {
    return edges.filter((e) => e.target === nodeId).map((e) => e.source);
  }
}
