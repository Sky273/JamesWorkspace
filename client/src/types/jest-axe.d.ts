declare module 'jest-axe' {
  export interface AxeViolation {
    id: string;
    impact?: string | null;
    description?: string;
    help?: string;
    helpUrl?: string;
    nodes: unknown[];
  }

  export interface AxeResults {
    violations: AxeViolation[];
  }

  export function axe(node: Element | DocumentFragment): Promise<AxeResults>;
}
