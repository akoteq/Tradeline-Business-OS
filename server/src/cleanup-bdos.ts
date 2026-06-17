import 'dotenv/config';
import { prisma } from './lib/prisma';

// Canonical BDOs → all name variations that should merge into them
const CANONICAL: Array<{ name: string; email: string; company: 'BAPX' | 'TRADELINE'; aliases: string[] }> = [
  {
    name: 'Frederick Phillips',
    email: 'frederick.phillips@internal',
    company: 'TRADELINE',
    aliases: ['fred', 'mr fred', 'mr. fred', 'frederick', 'fred phillips', 'mr fred phillips', 'frederick phillips'],
  },
  {
    name: 'Joshua Mensah',
    email: 'joshua.mensah@internal',
    company: 'TRADELINE',
    aliases: ['joshua', 'josh', 'joshua mensah'],
  },
  {
    name: 'Whitney',
    email: 'whitney@internal',
    company: 'TRADELINE',
    aliases: ['whitney'],
  },
  {
    name: 'Silas',
    email: 'silas@internal',
    company: 'BAPX',
    aliases: ['silas'],
  },
  {
    name: 'Christabel Benyo',
    email: 'christabel.benyo@internal',
    company: 'BAPX',
    aliases: ['christabel', 'chris', 'christabel benyo'],
  },
  {
    name: 'Ebo',
    email: 'ebo@internal',
    company: 'TRADELINE',
    aliases: ['ebo'],
  },
  {
    name: 'Prince Antwi',
    email: 'prince.antwi@internal',
    company: 'BAPX',
    aliases: ['prince', 'prince antwi'],
  },
  {
    name: 'Forster',
    email: 'forster@internal',
    company: 'TRADELINE',
    aliases: ['forster', 'foster', 'mr forster', 'mr. forster', 'mr foster', 'mr. foster'],
  },
  {
    name: 'Sam Atiemo',
    email: 'sam.atiemo@internal',
    company: 'TRADELINE',
    aliases: ['sam atiemo', 'mr sam', 'mr. sam', 'sam'],
  },
  {
    name: 'Daniel',
    email: 'daniel@internal',
    company: 'TRADELINE',
    aliases: ['daniel', 'dniel'],
  },
  {
    name: 'Aisha',
    email: 'aisha@internal',
    company: 'TRADELINE',
    aliases: ['aisha'],
  },
  {
    name: 'Wendy',
    email: 'wendy@internal',
    company: 'TRADELINE',
    aliases: ['wendy'],
  },
  {
    name: 'Racheal',
    email: 'racheal@internal',
    company: 'TRADELINE',
    aliases: ['racheal'],
  },
  {
    name: 'Elikim',
    email: 'elikim@internal',
    company: 'TRADELINE',
    aliases: ['elikim'],
  },
  {
    name: 'Mr Eric',
    email: 'mr.eric@internal',
    company: 'TRADELINE',
    aliases: ['mr eric', 'mr. eric', 'eric'],
  },
];

// Junk BDO emails — reassign their records to Ebo then delete
const JUNK_EMAILS = [
  'notes@internal',
  'all.active.applications@internal',
  'ebo./.joyce@internal',
  'ebo./joyce@internal',
  'ebo./.daniel@internal',
  'mdf@internal',
  'alex/ebo@internal',
];

async function reassignAndDelete(dupId: string, keeperId: string | null, label: string) {
  console.log(`   Removing "${label}" (${dupId}) → reassigning to ${keeperId ?? 'null'}`);
  await prisma.bapxDeal.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.tradelineDeal.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.lead.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.grantLoanTracker.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.task.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.activityLog.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.monthlyKpi.updateMany({ where: { bdoId: dupId }, data: { bdoId: keeperId } });
  await prisma.bDO.delete({ where: { id: dupId } });
  console.log(`   ✓ Done`);
}

async function main() {
  let allBdos = await prisma.bDO.findMany();
  console.log(`\nFound ${allBdos.length} BDO records in DB\n`);

  // Step 1 — merge canonical aliases
  for (const canonical of CANONICAL) {
    const keeper = await prisma.bDO.upsert({
      where: { email: canonical.email },
      update: { name: canonical.name },
      create: { name: canonical.name, email: canonical.email, company: canonical.company, isActive: true },
    });

    const duplicates = allBdos.filter(b => {
      if (b.id === keeper.id) return false;
      const norm = b.name.toLowerCase().replace(/\s+/g, ' ').trim();
      return canonical.aliases.includes(norm);
    });

    if (duplicates.length === 0) {
      console.log(`✓ ${canonical.name} — no duplicates`);
      continue;
    }

    console.log(`\n→ Merging into "${canonical.name}":`);
    for (const dup of duplicates) {
      await reassignAndDelete(dup.id, keeper.id, dup.name);
    }
  }

  // Step 2 — delete junk, reassigning their records to Ebo
  allBdos = await prisma.bDO.findMany();
  const ebo = allBdos.find(b => b.email === 'ebo@internal');

  console.log('\n→ Removing junk BDOs:');
  for (const junkEmail of JUNK_EMAILS) {
    const junk = allBdos.find(b => b.email === junkEmail);
    if (!junk) { console.log(`   (already gone) ${junkEmail}`); continue; }
    await reassignAndDelete(junk.id, ebo?.id ?? null, junk.name);
  }

  // Final report
  const remaining = await prisma.bDO.findMany();
  console.log(`\n✅ Cleanup complete. ${remaining.length} BDOs remaining:\n`);
  remaining.forEach(b => console.log(`  "${b.name}" (${b.company})`));
}

main()
  .catch(e => { console.error('Cleanup failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
