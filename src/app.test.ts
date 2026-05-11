import { describe, it, expect } from 'vitest';
import { mountApp } from './app';

describe('mountApp', () => {
  it('throws if root element is null', () => {
    expect(() => mountApp(null)).toThrow(/#app root/);
  });

  it('renders the Headway shell into the root', () => {
    const root = { innerHTML: '' } as HTMLElement;
    mountApp(root);
    expect(root.innerHTML).toContain('Headway');
    expect(root.innerHTML).toContain('Phase A scaffold');
  });
});
