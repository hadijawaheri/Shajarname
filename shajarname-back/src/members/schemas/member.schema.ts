// Mongoose
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Types
export type MemberDocument = HydratedDocument<Member>;

@Schema({ timestamps: true })
export class Member {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  mobile: string;

  @Prop({ required: true, enum: ['male', 'female'] })
  gender: string;

  @Prop({ required: true })
  birthday: Date;

  @Prop()
  deathday?: Date;

  @Prop()
  biography?: string;

  @Prop({ default: 'fa', enum: ['fa', 'ar'] })
  language: string;

  @Prop({ sparse: true })
  username?: string;

  @Prop()
  passwordHash?: string;

  @Prop({ default: 'member', enum: ['admin', 'editor', 'member'] })
  role: string;

  // Canvas positioning (managed by frontend auto-layout)
  @Prop({ default: 0 })
  positionX: number;

  @Prop({ default: 0 })
  positionY: number;

  @Prop({ default: false })
  isOnCanvas: boolean;

  // Parent marriage reference (for tree reconstruction)
  @Prop({ default: null })
  parentMarriageId?: string;

  @Prop()
  avatar?: string;

  /** When true, female member avatar is blurred for non-mahram viewers */
  @Prop({ default: false })
  privacyProtected: boolean;

  @Prop({ default: false })
  deleted: boolean;

  @Prop({ default: false })
  mustChangePassword: boolean;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({
    type: [{ title: { type: String }, path: { type: String } }],
    default: [],
  })
  audioMemories: { title: string; path: string }[];
}

// Schema Factory
export const MemberSchema = SchemaFactory.createForClass(Member);
