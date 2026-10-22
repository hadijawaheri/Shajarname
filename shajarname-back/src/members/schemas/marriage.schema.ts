// Mongoose
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// Schemas
import { Member } from './member.schema';

// Types
export type MarriageDocument = HydratedDocument<Marriage>;

@Schema({ timestamps: true })
export class Marriage {
  _id: string;

  @Prop({ type: Types.ObjectId, ref: Member.name, required: true })
  spouseA: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Member.name, required: true })
  spouseB: Types.ObjectId;

  @Prop()
  marriageDate?: Date;

  @Prop({ default: true })
  isCurrent: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: Member.name }], default: [] })
  children: Types.ObjectId[];

  @Prop({ default: false })
  deleted: boolean;
}

// Schema Factory
export const MarriageSchema = SchemaFactory.createForClass(Marriage);
