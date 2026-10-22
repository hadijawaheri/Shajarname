import { roleSatisfies, canMutateTree, canManageUsers } from './roles';

describe('roleSatisfies', () => {
  it('matches exact role', () => {
    expect(roleSatisfies('editor', ['admin', 'editor'])).toBe(true);
    expect(roleSatisfies('member', ['admin', 'editor'])).toBe(false);
  });

  it('lets admin satisfy editor requirements', () => {
    expect(roleSatisfies('admin', ['editor'])).toBe(true);
    expect(roleSatisfies('admin', ['admin'])).toBe(true);
  });

  it('rejects missing role', () => {
    expect(roleSatisfies(undefined, ['admin'])).toBe(false);
    expect(roleSatisfies('member', [])).toBe(false);
  });
});

describe('capability helpers', () => {
  it('canMutateTree', () => {
    expect(canMutateTree('admin')).toBe(true);
    expect(canMutateTree('editor')).toBe(true);
    expect(canMutateTree('member')).toBe(false);
  });

  it('canManageUsers', () => {
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('editor')).toBe(false);
  });
});
