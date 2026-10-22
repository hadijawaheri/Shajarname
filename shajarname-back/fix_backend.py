import re

with open('src/members/members.service.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update `create` method
create_old = """    const saved = await newMember.save();
    this.familyGateway.broadcast('member:created', { member: saved });
    return saved;"""

create_new = """    const saved = await newMember.save();
    
    // Sync to marriage.children if provided
    if (saved.parentMarriageId) {
      await this.marriageModel.updateOne(
        { _id: saved.parentMarriageId, deleted: false },
        { $addToSet: { children: saved._id } }
      );
    }
    
    this.familyGateway.broadcast('member:created', { member: saved });
    return saved;"""

text = text.replace(create_old, create_new)

# 2. Update `update` method
update_old = """    const updated = await this.memberModel.findOneAndUpdate(
      { _id: id, deleted: false },
      { $set: updatePayload },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('O1O U^ U.U^OO_ U+O,O UOO U?O U+O'O_');
    }

    this.familyGateway.broadcast('member:updated', { member: updated });
    return updated;"""

update_new = """    // Get the old member to check if parentMarriageId changed
    const oldMember = await this.memberModel.findOne({ _id: id, deleted: false });
    if (!oldMember) throw new NotFoundException('O1O U^ U.U^OO_ U+O,O UOO U?O U+O'O_');
    
    const updated = await this.memberModel.findOneAndUpdate(
      { _id: id, deleted: false },
      { $set: updatePayload },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('O1O U^ U.U^OO_ U+O,O UOO U?O U+O'O_');
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
    return updated;"""

text = text.replace(update_old, update_new)

with open('src/members/members.service.ts', 'w', encoding='utf-8') as f:
    f.write(text)
