const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

async function main() {
  const uri = "mongodb://127.0.0.1:27017/khandan_najaf";
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const passwordHash = await bcrypt.hash("123456", 10);
  console.log("Generated hash for 123456:", passwordHash);

  // 1. Create or update admin 'hadi'
  const existingHadi = await db.collection("members").findOne({
    $or: [{ username: "hadi" }, { mobile: "hadi" }, { name: "هادی" }]
  });

  if (existingHadi) {
    console.log("Found existing member for hadi:", existingHadi._id);
    await db.collection("members").updateOne(
      { _id: existingHadi._id },
      {
        $set: {
          name: "هادی",
          lastName: "نجف",
          username: "hadi",
          mobile: "hadi",
          role: "admin",
          passwordHash,
          deleted: false,
          updatedAt: new Date(),
        },
      }
    );
  } else {
    console.log("Inserting new admin member 'hadi'...");
    await db.collection("members").insertOne({
      name: "هادی",
      lastName: "نجف",
      username: "hadi",
      mobile: "hadi",
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

  // 2. Also ensure 09120000000 has password 123456 (from the user's screenshot)
  const defaultAdmin = await db.collection("members").findOne({ mobile: "09120000000" });
  if (defaultAdmin) {
    console.log("Updating default admin 09120000000 password to 123456");
    await db.collection("members").updateOne(
      { _id: defaultAdmin._id },
      {
        $set: {
          passwordHash,
          role: "admin",
          deleted: false,
          updatedAt: new Date(),
        }
      }
    );
  }

  // Verify records
  const hadiRecord = await db.collection("members").findOne({
    $or: [{ username: "hadi" }, { mobile: "hadi" }]
  });
  console.log("Hadi record verified:", {
    id: hadiRecord._id,
    name: hadiRecord.name,
    lastName: hadiRecord.lastName,
    username: hadiRecord.username,
    mobile: hadiRecord.mobile,
    role: hadiRecord.role,
    hasPassword: !!hadiRecord.passwordHash,
  });

  const admin0912 = await db.collection("members").findOne({ mobile: "09120000000" });
  console.log("09120000000 record verified:", {
    id: admin0912?._id,
    name: admin0912?.name,
    mobile: admin0912?.mobile,
    role: admin0912?.role,
    hasPassword: !!admin0912?.passwordHash,
  });

  await mongoose.disconnect();
}

main().catch(console.error);
