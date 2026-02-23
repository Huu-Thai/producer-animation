import { Test } from '@nestjs/testing';
import { DagService, WorkflowEdge } from './dag.service';
import { BadRequestException } from '@nestjs/common';

describe('DagService', () => {
  let service: DagService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DagService],
    }).compile();
    service = module.get<DagService>(DagService);
  });

  describe('analyzeWorkflow', () => {
    it('should return correct topological order for linear graph', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'scene_parser', data: {} },
          { id: 'b', type: 'image_gen', data: {} },
          { id: 'c', type: 'render', data: {} },
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' },
        ],
      };

      const result = service.analyzeWorkflow(workflow);
      expect(result.topologicalOrder).toEqual(['a', 'b', 'c']);
      expect(result.rootNodes).toEqual(['a']);
    });

    it('should identify multiple root nodes', () => {
      const workflow = {
        nodes: [
          { id: 'img', type: 'image_gen', data: {} },
          { id: 'voice', type: 'voice', data: {} },
          { id: 'render', type: 'render', data: {} },
        ],
        edges: [
          { source: 'img', target: 'render' },
          { source: 'voice', target: 'render' },
        ],
      };

      const result = service.analyzeWorkflow(workflow);
      expect(result.rootNodes).toContain('img');
      expect(result.rootNodes).toContain('voice');
      expect(result.topologicalOrder[result.topologicalOrder.length - 1]).toBe('render');
    });

    it('should detect cycles and throw BadRequestException', () => {
      const workflow = {
        nodes: [
          { id: 'a', type: 'scene_parser', data: {} },
          { id: 'b', type: 'image_gen', data: {} },
        ],
        edges: [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'a' }, // cycle
        ],
      };

      expect(() => service.analyzeWorkflow(workflow)).toThrow(BadRequestException);
    });

    it('should handle single node workflow', () => {
      const workflow = {
        nodes: [{ id: 'only', type: 'render', data: {} }],
        edges: [] as WorkflowEdge[],
      };

      const result = service.analyzeWorkflow(workflow);
      expect(result.topologicalOrder).toEqual(['only']);
      expect(result.rootNodes).toEqual(['only']);
    });

    it('should handle diamond dependency pattern (fan-in)', () => {
      const workflow = {
        nodes: [
          { id: 'parser', type: 'scene_parser', data: {} },
          { id: 'img', type: 'image_gen', data: {} },
          { id: 'motion', type: 'motion', data: {} },
          { id: 'render', type: 'render', data: {} },
        ],
        edges: [
          { source: 'parser', target: 'img' },
          { source: 'parser', target: 'motion' },
          { source: 'img', target: 'render' },
          { source: 'motion', target: 'render' },
        ],
      };

      const result = service.analyzeWorkflow(workflow);
      expect(result.rootNodes).toEqual(['parser']);
      expect(result.topologicalOrder[0]).toBe('parser');
      expect(result.topologicalOrder[result.topologicalOrder.length - 1]).toBe('render');
    });
  });
});
