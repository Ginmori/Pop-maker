import bcrypt from "bcryptjs";

const input = process.argv[2];
if (!input) {
  console.log("Usage: node server/scripts/hash-password.js <plain_password>");
  process.exit(1);
}

const SALT_ROUNDS = 10;

const run = async () => {
  const hash = await bcrypt.hash(input, SALT_ROUNDS);
  console.log(hash);
};

run().catch((error) => {
  console.error("Failed to hash password:", error);
  process.exit(1);
});
