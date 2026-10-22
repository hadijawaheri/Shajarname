import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AuditAction,
  AuditLog,
  AuditLogDocument,
} from './schemas/audit-log.schema';

export interface RecordAuditInput {
  action: AuditAction;
  actorId: string;
  actorMobile?: string;
  targetId: string;
  targetMobile?: string;
  targetName?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    await this.auditModel.create({
      action: input.action,
      actorId: new Types.ObjectId(input.actorId),
      actorMobile: input.actorMobile,
      targetId: new Types.ObjectId(input.targetId),
      targetMobile: input.targetMobile,
      targetName: input.targetName,
      meta: input.meta || {},
    });
  }

  async listRecent(limit = 50): Promise<
    {
      id: string;
      action: AuditAction;
      actorId: string;
      actorMobile?: string;
      targetId: string;
      targetMobile?: string;
      targetName?: string;
      meta: Record<string, unknown>;
      createdAt: Date;
    }[]
  > {
    const rows = await this.auditModel
      .find()
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .lean();

    return rows.map((r) => ({
      id: String(r._id),
      action: r.action,
      actorId: String(r.actorId),
      actorMobile: r.actorMobile,
      targetId: String(r.targetId),
      targetMobile: r.targetMobile,
      targetName: r.targetName,
      meta: r.meta || {},
      createdAt: (r as { createdAt?: Date }).createdAt || new Date(0),
    }));
  }
}
