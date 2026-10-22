const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

async function main() {
  const uri = "mongodb://127.0.0.1:27017/khandan_najaf";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const passwordHash = await bcrypt.hash("123456", 10);
  console.log("Generated hash for 123456");

  // Check if hasan exists
  const existingHasan = await db.collection("members").findOne({
    $or: [{ username: "hasan" }, { mobile: "hasan" }]
  });

  if (existingHasan) {
    console.log("Updating existing member for hasan:", existingHasan._id);
    await db.collection("members").updateOne(
      { _id: existingHasan._id },
      {
        $set: {
          name: "حسن",
          lastName: "نجف",
          username: "hasan",
          mobile: "hasan",
          role: "admin",
          passwordHash,
          deleted: false,
          updatedAt: new Date(),
        },
      }
    );
  } else {
    console.log("Inserting new admin member 'hasan'...");
    await db.collection("members").insertOne({
      name: "حسن",
      lastName: "نجف",
      username: "hasan",
      mobile: "hasan",
      gender: "male",
      role: "admin",
      birthday: new Date("1995-01-01"),
      language: "fa",
      passwordHash,
      isOnCanvas: false,
      privacyProtected: false,
      deleted: false,
      photos: [],
      audioMemories: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Verify record
  const hasanRecord = await db.collection("members").findOne({
    $or: [{ username: "hasan" }, { mobile: "hasan" }]
  });
  console.log("Hasan record verified:", {
    id: hasanRecord._id,
    name: hasanRecord.name,
    lastName: hasanRecord.lastName,
    username: hasanRecord.username,
    mobile: hasanRecord.mobile,
    role: hasanRecord.role,
    hasPassword: !!hasanRecord.passwordHash,
  });

  await mongoose.disconnect();
}

main().catch(console.error);
