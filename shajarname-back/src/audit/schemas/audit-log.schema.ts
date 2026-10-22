import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export type AuditAction =
  | 'user.role_changed'
  | 'user.password_reset'
  | 'user.login_granted'
  | 'user.login_revoked';

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({
    required: true,
    enum: [
      'user.role_changed',
      'user.password_reset',
      'user.login_granted',
      'user.login_revoked',
    ],
  })
  action: AuditAction;

  /** Admin who performed the action */
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  actorId: Types.ObjectId;

  @Prop()
  actorMobile?: string;

  /** Target account / member */
  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  targetId: Types.ObjectId;

  @Prop()
  targetMobile?: string;

  @Prop()
  targetName?: string;

  /** Safe metadata — never store raw passwords */
  @Prop({ type: Object, default: {} })
  meta: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ targetId: 1, createdAt: -1 });
