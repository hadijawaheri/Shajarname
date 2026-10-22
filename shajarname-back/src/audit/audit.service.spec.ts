import { AuditService } from './audit.service';

describe('AuditService mapping', () => {
  it('exposes record and listRecent', () => {
    expect(typeof AuditService.prototype.record).toBe('function');
    expect(typeof AuditService.prototype.listRecent).toBe('function');
  });
});
