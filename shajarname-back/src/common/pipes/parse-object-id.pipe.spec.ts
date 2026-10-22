import { BadRequestException } from '@nestjs/common';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('ParseObjectIdPipe', () => {
  const pipe = new ParseObjectIdPipe();

  it('accepts a MongoDB ObjectId string', () => {
    expect(pipe.transform('507f1f77bcf86cd799439011')).toBe(
      '507f1f77bcf86cd799439011',
    );
  });

  it('rejects malformed ids as a client error', () => {
    expect(() => pipe.transform('not-an-id')).toThrow(BadRequestException);
  });
});
