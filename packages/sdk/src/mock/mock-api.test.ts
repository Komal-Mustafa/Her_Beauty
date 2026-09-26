import { describe, expect, it } from 'vitest';
import { mockApi } from './mock-api';

describe('mockApi.getProducts', () => {
  it('filters by category slug', async () => {
    const { items } = await mockApi.getProducts({ category: 'lips' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.categoryId === 'cat-lips')).toBe(true);
  });

  it('paginates with a cursor', async () => {
    const first = await mockApi.getProducts({ limit: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).toBe('5');
    const second = await mockApi.getProducts({ limit: 5, cursor: first.nextCursor ?? undefined });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
  });

  it('marks sponsored products', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items.find((p) => p.slug === 'rose-dusk-palette')?.sponsored).toBe(true);
  });

  it('keeps prices as integer paisa', async () => {
    const { items } = await mockApi.getProducts({ limit: 100 });
    expect(items.every((p) => Number.isInteger(p.price))).toBe(true);
  });
});
