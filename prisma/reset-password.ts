// Resets one user's password (stored hashed). Usage:
//   npx tsx prisma/reset-password.ts <email-or-short-name> <new-password>
// Example: npx tsx prisma/reset-password.ts hrd hrd12345
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const [who, pw] = process.argv.slice(2);
  if (!who || !pw) { console.log('Usage: npx tsx prisma/reset-password.ts <email-or-short-name> <new-password>'); process.exit(1); }
  const email = who.includes('@') ? who.toLowerCase().trim() : `${who.toLowerCase().trim()}@mdc.sch.id`;
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findFirst({ where: { email } });
    if (!u) { console.log(`No user with email ${email}`); process.exit(1); }
    await prisma.user.update({ where: { id: u.id }, data: { password: await bcrypt.hash(pw, 10) } });
    console.log(`Password reset for ${u.name} (${u.role}). Log in with: ${who} / ${pw}`);
  } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exit(1); });
