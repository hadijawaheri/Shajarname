/**
 * @file members.service.ts
 * @description Core business logic service for the Khandan Najaf genealogy platform.
 *
 * This service handles:
 *  - Member CRUD operations with strict soft-delete enforcement (`deleted: false`).
 *  - Marriage node management (creation, child registration).
 *  - Islamic family-law mahram detection (`checkIsMahram`).
 *  - Bi-directional relationship path-finding (`findRelationship`) with
 *    Persian (fa) and Arabic (ar) term output.
 *
 * @module MembersService
 * @see {@link https://en.wikipedia.org/wiki/Mahram} for mahram definition
 */

// NestJS
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

// Schemas
import { Member, MemberDocument, Marriage, MarriageDocument } from './schemas';

// DTOs
import { CreateMemberDto, EditMemberDto } from './dtos';

// Helpers
import { convertAPToEnglish } from 'src/helpers/convert-ap-to-english';
import { FamilyGateway } from 'src/family/family.gateway';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Represents a single hop in a BFS relationship path.
 * Used internally by `findRelationship` to trace the shortest path
 * between two members through the family graph.
 */
interface Neighbor {
  /** MongoDB string ID of the related member */
  id: string;
  /** The kinship role this neighbor plays relative to the current node */
  relation: 'father' | 'mother' | 'son' | 'daughter' | 'brother' | 'sister' | 'husband' | 'wife';
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<MemberDocument>,
    @InjectModel(Marriage.name) private readonly marriageModel: Model<MarriageDocument>,
    private readonly familyGateway: FamilyGateway,
  ) {}

  private cachedGraph: {
    memberMap: Map<string, Member>;
    genderMap: Map<string, string>;
    parentMap: Map<string, string[]>;
    childrenMap: Map<string, Set<string>>;
    spouseMap: Map<string, Set<string>>;
  } | null = null;
  private cachedGraphTimestamp = 0;

  invalidateGraphCache(): void {
    this.cachedGraph = null;
    this.cachedGraphTimestamp = 0;
  }

  // ── Member CRUD ─────────────────────────────────────────────────────────────

  /**
   * Creates a new family member document in MongoDB.
   *
   * Pre-conditions:
   *  - `mobile` must already be normalized by the DTO `@Transform` decorator.
   *  - No existing active member may share the same mobile number.
   *  - If a `password` is provided, it is hashed with bcrypt (10 rounds) and
   *    stored as `passwordHash`. The raw password is never persisted.
   *
   * @param createMemberDto - Validated and normalized DTO from the request body
   * @returns The newly created Member document
   * @throws {BadRequestException} If the mobile number is already registered
   */
  async create(createMemberDto: CreateMemberDto): Promise<Member> {
    // mobile is pre-normalized via @Transform in CreateMemberDto
    const normalizedMobile = createMemberDto.mobile
      ? convertAPToEnglish(createMemberDto.mobile)
      : `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Check uniqueness (soft-delete aware)
    const existing = await this.memberModel.findOne({ mobile: normalizedMobile, deleted: false });
    if (existing) {
      throw new BadRequestException('عضوی با این شماره همراه قبلاً ثبت شده است');
    }

    // Hash password if provided explicitly
    let passwordHash: string | undefined;
    if (createMemberDto.password) {
      passwordHash = await bcrypt.hash(createMemberDto.password, 10);
    }

    // Auto-create login credentials if English name (nameEn) is provided
    let autoUsername: string | undefined;
    let mustChangePassword = false;
    if (createMemberDto.nameEn && !passwordHash) {
      // Derive username from English name: lowercase, trim, spaces → dots
      const base = createMemberDto.nameEn
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9.]/g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '');

      // Ensure uniqueness: try base, then base2, base3 ...
      let candidate = base;
      let suffix = 1;
      while (await this.memberModel.findOne({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`;
      }
      autoUsername = candidate;
      passwordHash = await bcrypt.hash('110', 10);
      mustChangePassword = true;
    }

    const newMember = new this.memberModel({
      ...createMemberDto,
      mobile: normalizedMobile,
      ...(autoUsername && { username: autoUsername }),
      passwordHash,
      mustChangePassword,
      deleted: false,
    });

    const saved = await newMember.save();
    
    // Sync to marriage.children if provided
    if (saved.parentMarriageId) {
      await this.marriageModel.updateOne(
        { _id: saved.parentMarriageId, deleted: false },
        { $addToSet: { children: saved._id } }
      );
    }
    
    this.familyGateway.broadcast('member:created', { member: saved });
    return saved;
  }

  /**
   * Retrieves all active marriage documents.
   */
  async findAllMarriages(): Promise<Marriage[]> {
    return this.marriageModel.find({ deleted: false });
  }

  /**
   * Finds an existing marriage between two spouses (order-independent).
   */
  async findMarriageBetween(spouseA: string, spouseB: string): Promise<Marriage | null> {
    const a = new Types.ObjectId(spouseA);
    const b = new Types.ObjectId(spouseB);
    return this.marriageModel.findOne({
      deleted: false,
      $or: [
        { spouseA: a, spouseB: b },
        { spouseA: b, spouseB: a },
      ],
    });
  }

  /**
   * Returns live family statistics for the dashboard.
   */
  async getStats(): Promise<{
    total: number;
    deceased: number;
    males: number;
    females: number;
    onCanvas: number;
  }> {
    const members = await this.memberModel.find({ deleted: false });
    const now = new Date();
    return {
      total: members.length,
      deceased: members.filter((m) => m.deathday && new Date(m.deathday) < now).length,
      males: members.filter((m) => m.gender === 'male').length,
      females: members.filter((m) => m.gender === 'female').length,
      onCanvas: members.filter((m) => m.isOnCanvas).length,
    };
  }

  /**
   * Batch-updates canvas positions after auto-layout runs on the frontend.
   */
  async syncLayout(
    positions: { id: string; positionX: number; positionY: number }[],
  ): Promise<{ updated: number }> {
    let updated = 0;
    for (const pos of positions) {
      if (
        !Number.isFinite(pos.positionX) ||
        !Number.isFinite(pos.positionY) ||
        pos.positionX < 0 ||
        pos.positionY < 0 ||
        pos.positionX > 4500 ||
        pos.positionY > 4500
      ) {
        continue;
      }
      const result = await this.memberModel.findOneAndUpdate(
        { _id: pos.id, deleted: false },
        { $set: { positionX: pos.positionX, positionY: pos.positionY, isOnCanvas: true } },
      );
      if (result) updated++;
    }
    this.familyGateway.broadcast('layout:synced', { updated });
    return { updated };
  }

  /**
   * Seeds the demo Najaf family tree for first-time installations.
   */
  async seedDemoFamily(): Promise<void> {
    const alwan = await this.create({
      name: 'السيّد علوان النجفي',
      lastName: 'Sayyid Alwan Al-Najafi',
      gender: 'male',
      birthday: '1912-01-01',
      deathday: '1994-01-01',
      biography: 'مؤسس عائلة النجفي في كربلاء',
      isOnCanvas: true,
    });

    const fatima = await this.create({
      name: 'فاطمة الهاشمي',
      lastName: 'Fatima Al-Hashemi',
      gender: 'female',
      birthday: '1920-01-01',
      deathday: '2008-01-01',
      biography: 'الزوجة الأولى والعمود الفقري للأسرة',
      privacyProtected: true,
      isOnCanvas: true,
    });

    const rootMarriage = await this.createMarriage(alwan._id.toString(), fatima._id.toString());

    const jaafar = await this.create({
      name: 'السيّد جعفر علوان النجفي',
      lastName: 'Sayyid Jaafar Al-Najafi',
      gender: 'male',
      birthday: '1944-01-01',
      deathday: '2021-01-01',
      biography: 'كبير عائلة النجف',
      parentMarriageId: rootMarriage._id.toString(),
      isOnCanvas: true,
    });
    await this.addChildToMarriage(rootMarriage._id.toString(), jaafar._id.toString());

    const zahra = await this.create({
      name: 'زهراء الموسوي',
      lastName: 'Zahra Al-Mousawi',
      gender: 'female',
      birthday: '1950-01-01',
      biography: 'مربية الفاضلة للجيل الثاني',
      privacyProtected: true,
      isOnCanvas: true,
      mobile: '09121111111',
      password: 'member123',
      role: 'member',
    });

    const jMarriage = await this.createMarriage(jaafar._id.toString(), zahra._id.toString());

    const hussein = await this.create({
      name: 'المهندس حسين جعفر النجفي',
      lastName: 'Eng. Hussein Al-Najafi',
      gender: 'male',
      birthday: '1978-01-01',
      biography: 'مدير مشاريع البنية التحتية',
      parentMarriageId: jMarriage._id.toString(),
      isOnCanvas: true,
      mobile: '09120000000',
      password: 'najaf123',
      role: 'admin',
    });
    await this.addChildToMarriage(jMarriage._id.toString(), hussein._id.toString());
  }

  /** Ensures demo login credentials exist for existing databases */
  async ensureDemoLogin(): Promise<void> {
    // Restore soft-deleted admin if present, otherwise promote/create credentials
    let demo = await this.memberModel.findOne({ mobile: '09120000000' });
    if (demo?.deleted) {
      demo.deleted = false;
      demo.role = 'admin';
      if (!demo.passwordHash) {
        demo.passwordHash = await bcrypt.hash('najaf123', 10);
      }
      await demo.save();
    } else if (demo && !demo.passwordHash) {
      demo.passwordHash = await bcrypt.hash('najaf123', 10);
      demo.role = 'admin';
      await demo.save();
    } else if (!demo) {
      const anyAdmin = await this.memberModel.findOne({ role: 'admin', deleted: false });
      if (!anyAdmin) {
        const hussein = await this.memberModel.findOne({
          name: /حسين|حسین|Hussein/i,
          deleted: false,
        });
        if (hussein) {
          hussein.mobile = '09120000000';
          hussein.passwordHash = await bcrypt.hash('najaf123', 10);
          hussein.role = 'admin';
          await hussein.save();
        }
      }
    }

    let memberDemo = await this.memberModel.findOne({ mobile: '09121111111' });
    if (memberDemo?.deleted) {
      memberDemo.deleted = false;
      memberDemo.role = 'member';
      memberDemo.passwordHash = await bcrypt.hash('member123', 10);
      await memberDemo.save();
    } else if (!memberDemo) {
      const zahra = await this.memberModel.findOne({ name: /زهراء/, deleted: false });
      if (zahra) {
        zahra.mobile = '09121111111';
        zahra.passwordHash = await bcrypt.hash('member123', 10);
        zahra.role = 'member';
        await zahra.save();
      }
    } else if (!memberDemo.passwordHash || memberDemo.role !== 'member') {
      memberDemo.passwordHash = await bcrypt.hash('member123', 10);
      memberDemo.role = 'member';
      await memberDemo.save();
    }

    // Demo editor account
    let editorDemo = await this.memberModel.findOne({ mobile: '09122222222' });
    if (editorDemo?.deleted) {
      editorDemo.deleted = false;
      editorDemo.role = 'editor';
      editorDemo.passwordHash = await bcrypt.hash('editor123', 10);
      await editorDemo.save();
    } else if (!editorDemo) {
      const candidate = await this.memberModel.findOne({
        deleted: false,
        role: { $nin: ['admin'] },
        mobile: { $regex: /^auto-/ },
      });
      if (candidate) {
        candidate.mobile = '09122222222';
        candidate.passwordHash = await bcrypt.hash('editor123', 10);
        candidate.role = 'editor';
        await candidate.save();
      }
    } else if (!editorDemo.passwordHash || editorDemo.role !== 'editor') {
      editorDemo.role = 'editor';
      editorDemo.passwordHash = await bcrypt.hash('editor123', 10);
      await editorDemo.save();
    }
  }

  /**
   * Retrieves all active (non-deleted) family members.
   *
   * @returns Array of Member documents with `deleted: false`
   */
  async findAll(): Promise<Member[]> {
    return this.memberModel.find({ deleted: false });
  }

  /**
   * Retrieves a single active member by their MongoDB ObjectId string.
   *
   * @param id - MongoDB ObjectId string
   * @returns The matched Member document
   * @throws {NotFoundException} If no active member is found for the given ID
   */
  async findOne(id: string): Promise<Member> {
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) {
      throw new NotFoundException('عضو مورد نظر یافت نشد');
    }
    return member;
  }

  /**
   * Updates an existing member's fields using a MongoDB `$set` operation.
   *
   * Notes:
   *  - `mobile` arrives pre-normalized from the DTO `@Transform` decorator.
   *  - A duplicate-mobile check is performed against other active members.
   *  - If `password` is provided, it is hashed and stored as `passwordHash`.
   *    The raw `password` field is never stored in the update payload.
   *
   * @param id - MongoDB ObjectId string of the member to update
   * @param editMemberDto - Validated partial update payload
   * @returns The updated Member document
   * @throws {BadRequestException} If the new mobile number conflicts with another member
   * @throws {NotFoundException} If the member does not exist or has been soft-deleted
   */
  async update(id: string, editMemberDto: EditMemberDto): Promise<Member> {
    // mobile is already normalized by @Transform in EditMemberDto; check for duplicate
    if (editMemberDto.mobile) {
      const existing = await this.memberModel.findOne({
        mobile: editMemberDto.mobile,
        _id: { $ne: id },
        deleted: false,
      });
      if (existing) {
        throw new BadRequestException('عضوی با این شماره همراه قبلاً ثبت شده است');
      }
    }

    // Extract and hash password separately; build a typed update payload
    const { password, ...rest } = editMemberDto;
    const updatePayload: Partial<Record<string, unknown>> = { ...rest };

    if (password) {
      updatePayload.passwordHash = await bcrypt.hash(password, 10);
    }

    // Get the old member to check if parentMarriageId changed
    const oldMember = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!oldMember) throw new NotFoundException('Member not found');
    
    const updated = await this.memberModel.findOneAndUpdate(
      { _id: id, deleted: false },
      { $set: updatePayload },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('Member not found');
    }

    // Sync to marriage.children if parentMarriageId changed
    if ('parentMarriageId' in editMemberDto) {
      const oldMId = oldMember.parentMarriageId;
      const newMId = updated.parentMarriageId;
      
      if (oldMId !== newMId) {
        // Remove from old marriage
        if (oldMId) {
          await this.marriageModel.updateOne(
            { _id: oldMId },
            { $pull: { children: new Types.ObjectId(id) } }
          );
        }
        // Add to new marriage
        if (newMId) {
          await this.marriageModel.updateOne(
            { _id: newMId },
            { $addToSet: { children: new Types.ObjectId(id) } }
          );
        }
      }
    }

    this.familyGateway.broadcast('member:updated', { member: updated });
    return updated;
  }

  /**
   * Soft-deletes a member by setting `deleted: true` on their document.
   * Also soft-deletes marriages where they are a spouse and clears parent links
   * for their children. Protects the last remaining admin account.
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) {
      throw new NotFoundException('عضو مورد نظر یافت نشد');
    }

    if (member.role === 'admin') {
      const adminCount = await this.memberModel.countDocuments({
        role: 'admin',
        deleted: false,
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'نمی‌توان آخرین مدیر سیستم را حذف کرد. ابتدا مدیر دیگری تعیین کنید.',
        );
      }
    }

    const memberOid = new Types.ObjectId(id);

    // Soft-delete marriages involving this member
    await this.marriageModel.updateMany(
      {
        deleted: false,
        $or: [{ spouseA: memberOid }, { spouseB: memberOid }],
      },
      { $set: { deleted: true } },
    );

    // Detach this person as a child from other marriages
    await this.marriageModel.updateMany(
      { deleted: false, children: memberOid },
      { $pull: { children: memberOid } },
    );

    // Clear parentMarriageId for this member's former children pointing at deleted marriages
    const deletedMarriageIds = await this.marriageModel
      .find({
        deleted: true,
        $or: [{ spouseA: memberOid }, { spouseB: memberOid }],
      })
      .distinct('_id');
    if (deletedMarriageIds.length > 0) {
      await this.memberModel.updateMany(
        { deleted: false, parentMarriageId: { $in: deletedMarriageIds } },
        { $unset: { parentMarriageId: 1 }, $set: { isOnCanvas: false } },
      );
    }

    const updated = await this.memberModel.findOneAndUpdate(
      { _id: id, deleted: false },
      { $set: { deleted: true, isOnCanvas: false } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('عضو مورد نظر یافت نشد');
    }
    this.familyGateway.broadcast('member:deleted', { memberId: id });
    return { success: true };
  }

  /**
   * Soft-deletes a marriage (unlinks spouses). Children keep their records but
   * lose the parent marriage link and move off-canvas to the side pool.
   */
  async removeMarriage(marriageId: string): Promise<{ success: boolean }> {
    const marriage = await this.marriageModel.findOneAndUpdate(
      { _id: marriageId, deleted: false },
      { $set: { deleted: true } },
      { new: true },
    );
    if (!marriage) {
      throw new NotFoundException('ازدواج مورد نظر یافت نشد');
    }

    await this.memberModel.updateMany(
      { deleted: false, parentMarriageId: marriage._id },
      { $unset: { parentMarriageId: 1 }, $set: { isOnCanvas: false } },
    );

    this.familyGateway.broadcast('marriage:deleted', { marriageId });
    return { success: true };
  }

  /**
   * Creates a Marriage node linking two spouses.
   * A Marriage document serves as the join point from which child members descend.
   * The frontend renders a circular hub node centered between the two spouse cards.
   *
   * @param spouseA - MongoDB ObjectId string of the first spouse
   * @param spouseB - MongoDB ObjectId string of the second spouse
   * @param children - Optional array of child member IDs to pre-register
   * @param marriageDate - Optional historical marriage date for the timeline
   * @returns The newly created Marriage document
   * @throws {BadRequestException} If either spouse is not found in the active member set
   */
  async createMarriage(
    spouseA: string,
    spouseB: string,
    children: string[] = [],
    marriageDate?: Date,
  ): Promise<Marriage> {
    // Verify both spouses exist and are not deleted
    const memberA = await this.memberModel.findOne({ _id: spouseA, deleted: false });
    const memberB = await this.memberModel.findOne({ _id: spouseB, deleted: false });
    if (!memberA || !memberB) {
      throw new BadRequestException('طرفین ازدواج باید در سیستم ثبت شده باشند');
    }

    // Women may have only one husband
    for (const person of [memberA, memberB]) {
      if (person.gender !== 'female') continue;
      const womanId = person._id;
      const alreadyMarried = await this.marriageModel.findOne({
        deleted: false,
        $or: [{ spouseA: womanId }, { spouseB: womanId }],
      });
      if (alreadyMarried) {
        const other =
          alreadyMarried.spouseA.toString() === womanId.toString()
            ? alreadyMarried.spouseB.toString()
            : alreadyMarried.spouseA.toString();
        const newOther = person._id.toString() === spouseA ? spouseB : spouseA;
        if (other !== newOther) {
          throw new BadRequestException(
            'خانم‌ها فقط می‌توانند یک همسر داشته باشند',
          );
        }
      }
    }

    // Avoid duplicate marriage
    const duplicate = await this.findMarriageBetween(spouseA, spouseB);
    if (duplicate) {
      return duplicate;
    }

    const newMarriage = new this.marriageModel({
      spouseA: new Types.ObjectId(spouseA),
      spouseB: new Types.ObjectId(spouseB),
      children: children.map((c) => new Types.ObjectId(c)),
      marriageDate,
      deleted: false,
    });

    const saved = await newMarriage.save();
    this.familyGateway.broadcast('marriage:created', { marriage: saved });
    return saved;
  }

  /**
   * Adds a child to an existing Marriage document using MongoDB `$addToSet`
   * to prevent duplicate child references.
   *
   * @param marriageId - MongoDB ObjectId string of the Marriage document
   * @param childId - MongoDB ObjectId string of the child member
   * @returns The updated Marriage document
   * @throws {NotFoundException} If the marriage or child is not found
   */
  async addChildToMarriage(marriageId: string, childId: string): Promise<Marriage> {
    const marriage = await this.marriageModel.findOne({ _id: marriageId, deleted: false });
    if (!marriage) {
      throw new NotFoundException('ازدواج مورد نظر یافت نشد');
    }

    const child = await this.memberModel.findOne({ _id: childId, deleted: false });
    if (!child) {
      throw new NotFoundException('فرزند مورد نظر یافت نشد');
    }

    const updated = await this.marriageModel.findByIdAndUpdate(
      marriageId,
      { $addToSet: { children: new Types.ObjectId(childId) } },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('ازدواج مورد نظر یافت نشد');
    }
    this.familyGateway.broadcast('marriage:updated', { marriage: updated });
    return updated;
  }

  /**
   * Builds four in-memory adjacency maps from all active members and marriages.
   * These maps are reused by both `checkIsMahram` and `findRelationship` to avoid
   * redundant database queries.
   *
   * Time complexity: O(M + R) where M = members count, R = marriage records count.
   *
   * @returns An object containing:
   *  - `memberMap`  — id → Member
   *  - `genderMap`  — id → 'male' | 'female'
   *  - `parentMap`  — childId → [fatherId, motherId]
   *  - `childrenMap` — parentId → Set of child IDs
   *  - `spouseMap`  — memberId → Set of spouse IDs
   */
  private async buildFamilyGraph(): Promise<{
    memberMap: Map<string, Member>;
    genderMap: Map<string, string>;
    parentMap: Map<string, string[]>;
    childrenMap: Map<string, Set<string>>;
    spouseMap: Map<string, Set<string>>;
  }> {
    const now = Date.now();
    if (this.cachedGraph && now - this.cachedGraphTimestamp < 15000) {
      return this.cachedGraph;
    }

    const members = await this.memberModel.find({ deleted: false });
    const marriages = await this.marriageModel.find({ deleted: false });

    const memberMap = new Map<string, Member>();
    const genderMap = new Map<string, string>();
    const parentMap = new Map<string, string[]>();
    const childrenMap = new Map<string, Set<string>>();
    const spouseMap = new Map<string, Set<string>>();

    // Initialize maps for all active members
    for (const m of members) {
      const id = m._id.toString();
      memberMap.set(id, m);
      genderMap.set(id, m.gender);
      childrenMap.set(id, new Set<string>());
      spouseMap.set(id, new Set<string>());
      parentMap.set(id, []);
    }

    // Populate relationship maps from marriage records
    for (const mrg of marriages) {
      const aId = mrg.spouseA.toString();
      const bId = mrg.spouseB.toString();

      // Register mutual spouse links
      if (memberMap.has(aId) && memberMap.has(bId)) {
        spouseMap.get(aId)!.add(bId);
        spouseMap.get(bId)!.add(aId);
      }

      // Register parent→child and child→parent links
      for (const childObjId of mrg.children) {
        const cId = childObjId.toString();
        if (!memberMap.has(cId)) continue;

        if (memberMap.has(aId)) {
          parentMap.get(cId)!.push(aId);
          childrenMap.get(aId)!.add(cId);
        }
        if (memberMap.has(bId)) {
          parentMap.get(cId)!.push(bId);
          childrenMap.get(bId)!.add(cId);
        }
      }
    }

    this.cachedGraph = { memberMap, genderMap, parentMap, childrenMap, spouseMap };
    this.cachedGraphTimestamp = now;
    return this.cachedGraph;
  }

  // ── Islamic Mahram Engine ───────────────────────────────────────────────────

  /**
   * Determines whether `targetMemberId` is a mahram (محرم) to `activeUserId`
   * according to classical Islamic jurisprudence (fiqh).
   *
   * A mahram is a person with whom marriage is permanently forbidden due to
   * close blood ties (nasab/نسب) or certain marital bonds (sabab/سبب).
   * This controls the privacy-shield feature: female members' avatars are only
   * un-blurred for users who are their mahrams.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * Nasabi (biological) mahrams of person X:
   *  1. All ancestors (parents, grandparents, …)
   *  2. All descendants (children, grandchildren, …)
   *  3. All siblings and their descendants (nephews/nieces, …)
   *  4. Aunts/uncles: siblings of all ancestors
   *
   * Sababi (marital) mahrams of person X:
   *  1. All current/past spouses
   *  2. Spouses of all ancestors (step-parents and their ancestors)
   *  3. Spouses of all descendants (children-in-law)
   *  4. Ancestors of all spouses (parents/grandparents-in-law)
   *  5. Descendants of all spouses from other marriages (step-children)
   * ──────────────────────────────────────────────────────────────────────────
   *
   * Algorithm: BFS traversal through `buildFamilyGraph` adjacency maps.
   * Time complexity: O(N) where N = number of active family members.
   *
   * @param activeUserId - The ID of the currently logged-in (viewing) user
   * @param targetMemberId - The ID of the member whose privacy status is checked
   * @returns `true` if the target is a mahram; `false` otherwise
   */
  async checkIsMahram(activeUserId: string, targetMemberId: string): Promise<boolean> {
    // A person is always their own mahram
    if (activeUserId === targetMemberId) return true;

    const { memberMap, parentMap, childrenMap, spouseMap } = await this.buildFamilyGraph();

    // ── BFS traversal helpers ────────────────────────────────────────────────

    /**
     * Returns all ancestors of a given member (breadth-first, upward traversal).
     * @param startId - Member ID to start traversal from
     */
    const getAncestors = (startId: string): Set<string> => {
      const visited = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const p of parentMap.get(cur) || []) {
          if (!visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
      return visited;
    };

    /**
     * Returns all descendants of a given member (breadth-first, downward traversal).
     * @param startId - Member ID to start traversal from
     */
    const getDescendants = (startId: string): Set<string> => {
      const visited = new Set<string>();
      const queue = [startId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const c of childrenMap.get(cur) || []) {
          if (!visited.has(c)) {
            visited.add(c);
            queue.push(c);
          }
        }
      }
      return visited;
    };

    /**
     * Returns all siblings of a member (children of the same parents, excluding self).
     */
    const getSiblings = (id: string): Set<string> => {
      const result = new Set<string>();
      for (const p of parentMap.get(id) || []) {
        for (const sib of childrenMap.get(p) || []) {
          if (sib !== id) result.add(sib);
        }
      }
      return result;
    };

    // ── Build nasabi (biological) mahram set ─────────────────────────────────
    const bioMahrams = new Set<string>();
    const ancestors = getAncestors(activeUserId);
    const descendants = getDescendants(activeUserId);

    // Ancestors and their descendants cover: parents, siblings, nieces/nephews
    for (const a of ancestors) bioMahrams.add(a);
    for (const d of descendants) bioMahrams.add(d);

    // Siblings of self (from shared parents)
    for (const sib of getSiblings(activeUserId)) bioMahrams.add(sib);

    // Nephews/nieces and their descendants (children of siblings, etc.)
    for (const sib of getSiblings(activeUserId)) {
      for (const d of getDescendants(sib)) bioMahrams.add(d);
    }

    // Aunts/uncles: siblings of all ancestors
    for (const anc of ancestors) {
      for (const sibOfAnc of getSiblings(anc)) bioMahrams.add(sibOfAnc);
    }

    if (bioMahrams.has(targetMemberId)) return true;

    // ── Build sababi (marital) mahram set ────────────────────────────────────
    const maritalMahrams = new Set<string>();
    const mySpouses = spouseMap.get(activeUserId) || new Set<string>();

    // Direct spouses
    for (const s of mySpouses) maritalMahrams.add(s);

    // Spouses of ancestors (step-parents and their ancestors)
    for (const a of ancestors) {
      for (const sp of spouseMap.get(a) || []) maritalMahrams.add(sp);
    }

    // Spouses of descendants (children-in-law, grandchildren-in-law, …)
    for (const d of descendants) {
      for (const sp of spouseMap.get(d) || []) maritalMahrams.add(sp);
    }

    // Ancestors of spouses (parents/grandparents-in-law)
    for (const s of mySpouses) {
      for (const spa of getAncestors(s)) maritalMahrams.add(spa);
    }

    // Descendants of spouses from previous/other marriages (step-children)
    for (const s of mySpouses) {
      for (const spd of getDescendants(s)) maritalMahrams.add(spd);
    }

    return maritalMahrams.has(targetMemberId);
  }

  // ── Relationship Path-Finder ────────────────────────────────────────────────

  /**
   * Finds and returns the shortest kinship path between two family members
   * expressed as a human-readable label in Persian (fa) or Arabic (ar).
   *
   * ──────────────────────────────────────────────────────────────────────────
   * Algorithm: Breadth-First Search (BFS) on the undirected family graph.
   *
   * The graph edges are:
   *  - Parent ↔ Child   (directional: up = parent, down = child)
   *  - Spouse ↔ Spouse  (bidirectional)
   *  - Sibling ↔ Sibling (bidirectional, derived from shared parents)
   *
   * BFS guarantees the shortest path (fewest hops). The resulting path array
   * of `Neighbor` objects is then translated into a natural-language kinship
   * term using lookup tables (`faMap` / `arMap`) and a dynamic fallback builder.
   * ──────────────────────────────────────────────────────────────────────────
   *
   * @param userAId - Starting member ID ("from" perspective)
   * @param userBId - Target member ID ("to" perspective)
   * @param lang - Output language: `'fa'` for Persian, `'ar'` for Arabic
   * @returns A localized kinship label string, e.g. "پدربزرگ پدری" or "جد لأب"
   */
  async findRelationship(userAId: string, userBId: string, lang: 'fa' | 'ar'): Promise<string> {
    if (userAId === userBId) {
      return lang === 'fa' ? 'خود شخص' : 'نفس الشخص';
    }

    const { memberMap, genderMap, parentMap, childrenMap, spouseMap } =
      await this.buildFamilyGraph();

    // Sibling helper (derived from shared parent nodes)
    const getSiblings = (id: string): Set<string> => {
      const result = new Set<string>();
      for (const p of parentMap.get(id) || []) {
        for (const sib of childrenMap.get(p) || []) {
          if (sib !== id) result.add(sib);
        }
      }
      return result;
    };

    // ── BFS: find shortest path from userA to userB ──────────────────────────
    const queue: { id: string; path: Neighbor[] }[] = [{ id: userAId, path: [] }];
    const visited = new Set<string>([userAId]);
    let foundPath: Neighbor[] | null = null;

    bfs: while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === userBId) {
        foundPath = path;
        break bfs;
      }

      const neighbors: Neighbor[] = [];

      // Lateral edges: spouses
      for (const s of spouseMap.get(id) || []) {
        const gender = genderMap.get(s);
        neighbors.push({ id: s, relation: gender === 'male' ? 'husband' : 'wife' });
      }

        // Upward edges: parents
      for (const p of parentMap.get(id) || []) {
        const gender = genderMap.get(p);
        neighbors.push({ id: p, relation: gender === 'male' ? 'father' : 'mother' });
      }

      // Downward edges: children
      for (const c of childrenMap.get(id) || []) {
        const gender = genderMap.get(c);
        neighbors.push({ id: c, relation: gender === 'male' ? 'son' : 'daughter' });
      }

      

      // Lateral edges: siblings (same-generation shortcuts)
      for (const sib of getSiblings(id)) {
        const gender = genderMap.get(sib);
        neighbors.push({ id: sib, relation: gender === 'male' ? 'brother' : 'sister' });
      }

      for (const n of neighbors) {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          queue.push({ id: n.id, path: [...path, n] });
        }
      }
    }

    if (!foundPath) {
      return lang === 'fa' ? 'بدون رابطه نسبی شناخته شده' : 'لا توجد علاقة معروفة';
    }

    return this.translatePath(foundPath, lang);
  }

  // ── Path Translation ────────────────────────────────────────────────────────

  /**
   * Converts an array of `Neighbor` hops into a natural-language kinship label.
   *
   * Strategy:
   *  1. Build a lookup key from the path (e.g. "father->brother->son").
   *  2. Check the exhaustive `faMap` / `arMap` lookup tables for an exact match.
   *  3. If no exact match found, compose a dynamic genitive chain:
   *     - Persian: reverse the path and join terms with ezafe (اضافه) connectors.
   *     - Arabic: reverse the path and join with definite/indefinite article forms.
   *
   * @param path - Ordered array of relationship hops from userA toward userB
   * @param lang - Output language: `'fa'` (Persian) or `'ar'` (Arabic)
   * @returns A localized relationship string
   */
  private translatePath(path: Neighbor[], lang: 'fa' | 'ar'): string {
    const key = path.map((p) => p.relation).join('->');

    // ── Persian exact-match lookup ────────────────────────────────────────────
    const faMap: Record<string, string> = {
      'father': 'پدر',
      'mother': 'مادر',
      'son': 'پسر',
      'daughter': 'دختر',
      'brother': 'برادر',
      'sister': 'خواهر',
      'husband': 'همسر (شوهر)',
      'wife': 'همسر (زن)',

      'father->father': 'پدربزرگ پدری',
      'father->mother': 'مادربزرگ پدری',
      'mother->father': 'پدربزرگ مادری',
      'mother->mother': 'مادربزرگ مادری',
      'father->brother': 'عمو',
      'father->sister': 'عمه',
      'mother->brother': 'دایی',
      'mother->sister': 'خاله',
      'brother->son': 'پسر برادر',
      'brother->daughter': 'دختر برادر',
      'sister->son': 'پسر خواهر',
      'sister->daughter': 'دختر خواهر',
      'son->son': 'نوه (پسر)',
      'son->daughter': 'نوه (دختر)',
      'daughter->son': 'نوه (پسر)',
      'daughter->daughter': 'نوه (دختر)',
      'husband->father': 'پدر شوهر',
      'wife->father': 'پدر زن',
      'husband->mother': 'مادر شوهر',
      'wife->mother': 'مادر زن',
      'daughter->husband': 'داماد',
      'son->wife': 'عروس',

      'father->brother->son': 'پسرعمو',
      'father->brother->daughter': 'دخترعمو',
      'father->sister->son': 'پسرعمه',
      'father->sister->daughter': 'دخترعمه',
      'mother->brother->son': 'پسردایی',
      'mother->brother->daughter': 'دختردایی',
      'mother->sister->son': 'پسرخاله',
      'mother->sister->daughter': 'دخترخاله',
      'father->father->father': 'جد بزرگ پدری',
      'father->father->brother': 'عموی پدر',
      'father->father->sister': 'عمه‌ی پدر',
      'father->mother->brother': 'داییِ پدر',
      'father->mother->sister': 'خاله‌ی پدر',
      'mother->father->brother': 'عموی مادر',
      'mother->father->sister': 'عمه‌ی مادر',
      'mother->mother->brother': 'داییِ مادر',
      'mother->mother->sister': 'خاله‌ی مادر',
    };

    // ── Arabic exact-match lookup ─────────────────────────────────────────────
    const arMap: Record<string, string> = {
      'father': 'أب',
      'mother': 'أم',
      'son': 'ابن',
      'daughter': 'بنت',
      'brother': 'أخ',
      'sister': 'أخت',
      'husband': 'زوج',
      'wife': 'زوجة',

      'father->father': 'جد لأب',
      'father->mother': 'جدة لأب',
      'mother->father': 'جد لأم',
      'mother->mother': 'جدة لأم',
      'father->brother': 'عم',
      'father->sister': 'عمة',
      'mother->brother': 'خال',
      'mother->sister': 'خالة',
      'brother->son': 'ابن الأخ',
      'brother->daughter': 'بنت الأخ',
      'sister->son': 'ابن الأخت',
      'sister->daughter': 'بنت الأخت',
      'son->son': 'حفيد',
      'son->daughter': 'حفيدة',
      'daughter->son': 'حفيد',
      'daughter->daughter': 'حفيدة',
      'husband->father': 'حمو',
      'wife->father': 'حمو',
      'husband->mother': 'حماة',
      'wife->mother': 'حماة',
      'daughter->husband': 'صهر (زوج الابنة)',
      'son->wife': 'كنة (زوجة الابن)',

      'father->brother->son': 'ابن عم',
      'father->brother->daughter': 'بنت عم',
      'father->sister->son': 'ابن عمة',
      'father->sister->daughter': 'بنت عمة',
      'mother->brother->son': 'ابن خال',
      'mother->brother->daughter': 'بنت خال',
      'mother->sister->son': 'ابن خالة',
      'mother->sister->daughter': 'بنت خالة',
      'father->father->father': 'أب الجد',
      'father->father->brother': 'عم الوالد',
      'father->father->sister': 'عمة الوالد',
      'father->mother->brother': 'خال الوالد',
      'father->mother->sister': 'خالة الوالد',
      'mother->father->brother': 'عم الوالدة',
      'mother->father->sister': 'عمة الوالدة',
      'mother->mother->brother': 'خال الوالدة',
      'mother->mother->sister': 'خالة الوالدة',
    };

    // Exact match
    if (lang === 'fa' && faMap[key]) return faMap[key];
    if (lang === 'ar' && arMap[key]) return arMap[key];

    // ── Dynamic fallback: compose genitive chain ──────────────────────────────

    const faTerms: Record<string, string> = {
      father: 'پدر', mother: 'مادر', son: 'پسر', daughter: 'دختر',
      brother: 'برادر', sister: 'خواهر', husband: 'همسر', wife: 'همسر',
    };

    const arIndefinite: Record<string, string> = {
      father: 'أب', mother: 'أم', son: 'ابن', daughter: 'بنت',
      brother: 'أخ', sister: 'أخت', husband: 'زوج', wife: 'زوجة',
    };

    const arDefinite: Record<string, string> = {
      father: 'الأب', mother: 'الأم', son: 'الابن', daughter: 'الابنة',
      brother: 'الأخ', sister: 'الأخت', husband: 'الزوج', wife: 'الزوجة',
    };

    if (lang === 'fa') {
      // Persian genitive: reverse path, join with ezafe connectors
      const rev = [...path].reverse();
      return rev
        .map((hop, i) => {
          const term = faTerms[hop.relation] || hop.relation;
          if (i < rev.length - 1) {
            // Ezafe vowel rules: words ending in ه/ا/و/ی take ‌ی, others take ِ
            const vowelEnd = /[هاوی]$/.test(term);
            return term + (vowelEnd ? '\u200c\u06cc' : '\u0650');
          }
          return term;
        })
        .join(' ');
    } else {
      // Arabic genitive: first term indefinite, middle/last definite
      const rev = [...path].reverse();
      return rev
        .map((hop, i) => {
          const rel = hop.relation;
          return i === 0 ? arIndefinite[rel] || rel : arDefinite[rel] || rel;
        })
        .join(' ');
    }
  }

  // ── Admin: login accounts ─────────────────────────────────────────────────

  /** Members that can sign in (have a real mobile + password hash). */
  async listLoginAccounts(): Promise<
    {
      id: string;
      name: string;
      lastName: string;
      mobile: string;
      role: string;
      hasPassword: boolean;
      language: string;
    }[]
  > {
    const rows = await this.memberModel
      .find({
        deleted: false,
        passwordHash: { $exists: true, $ne: null },
        mobile: { $not: /^auto-/ },
      })
      .select('name lastName mobile role language passwordHash')
      .lean();

    return rows.map((m) => ({
      id: String(m._id),
      name: m.name,
      lastName: m.lastName,
      mobile: m.mobile,
      role: m.role || 'member',
      hasPassword: Boolean(m.passwordHash),
      language: m.language || 'fa',
    }));
  }

  async setMemberRole(
    id: string,
    role: 'admin' | 'editor' | 'member',
  ): Promise<{ member: Member; previousRole: string }> {
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) throw new NotFoundException('عضو مورد نظر یافت نشد');

    const previousRole = member.role || 'member';

    if (member.role === 'admin' && role !== 'admin') {
      const adminCount = await this.memberModel.countDocuments({
        role: 'admin',
        deleted: false,
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'نمی‌توان نقش آخرین مدیر را تغییر داد. ابتدا مدیر دیگری تعیین کنید.',
        );
      }
    }

    member.role = role;
    await member.save();
    this.familyGateway.broadcast('member:updated', { member });
    return { member, previousRole };
  }

  async resetMemberPassword(
    id: string,
    password: string,
  ): Promise<{ success: boolean; member: Member }> {
    if (!password || password.length < 6) {
      throw new BadRequestException('رمز عبور باید حداقل ۶ کاراکتر باشد');
    }
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) throw new NotFoundException('عضو مورد نظر یافت نشد');
    if (!member.mobile || String(member.mobile).startsWith('auto-')) {
      throw new BadRequestException('برای ورود باید شماره موبایل واقعی تنظیم شود');
    }
    member.passwordHash = await bcrypt.hash(password, 10);
    await member.save();
    return { success: true, member };
  }

  async grantLoginAccess(
    id: string,
    opts: { mobile?: string; password: string; role?: 'admin' | 'editor' | 'member' },
  ): Promise<{ member: Member; previousRole: string; previousMobile: string }> {
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) throw new NotFoundException('عضو مورد نظر یافت نشد');

    const previousRole = member.role || 'member';
    const previousMobile = member.mobile;

    if (opts.mobile) {
      const mobile = convertAPToEnglish(opts.mobile);
      const clash = await this.memberModel.findOne({
        mobile,
        deleted: false,
        _id: { $ne: member._id },
      });
      if (clash) throw new BadRequestException('این شماره موبایل قبلاً استفاده شده است');
      member.mobile = mobile;
    } else if (!member.mobile || String(member.mobile).startsWith('auto-')) {
      throw new BadRequestException('شماره موبایل الزامی است');
    }

    if (!opts.password || opts.password.length < 6) {
      throw new BadRequestException('رمز عبور باید حداقل ۶ کاراکتر باشد');
    }
    member.passwordHash = await bcrypt.hash(opts.password, 10);
    if (opts.role) member.role = opts.role;
    await member.save();
    this.familyGateway.broadcast('member:updated', { member });
    return { member, previousRole, previousMobile };
  }

  async revokeLoginAccess(
    id: string,
  ): Promise<{ success: boolean; member: Member; previousRole: string }> {
    const member = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!member) throw new NotFoundException('عضو مورد نظر یافت نشد');

    if (member.role === 'admin') {
      const adminCount = await this.memberModel.countDocuments({
        role: 'admin',
        deleted: false,
        passwordHash: { $exists: true, $ne: null },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('نمی‌توان ورود آخرین مدیر را غیرفعال کرد');
      }
    }

    const previousRole = member.role || 'member';
    member.passwordHash = undefined;
    member.role = 'member';
    await member.save();
    this.familyGateway.broadcast('member:updated', { member });
    return { success: true, member, previousRole };
  }
}
