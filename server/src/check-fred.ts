import 'dotenv/config';
import { prisma } from './lib/prisma';

async function main() {
  const fred = await prisma.bDO.findFirst({ where: { email: 'frederick.phillips@internal' } });
  if (!fred) { console.log('Fred not found in DB'); return; }
  console.log(`Fred: "${fred.name}" | id: ${fred.id}\n`);

  const bapxCount = await prisma.bapxDeal.count({ where: { bdoId: fred.id } });
  const tradelineCount = await prisma.tradelineDeal.count({ where: { bdoId: fred.id } });
  const leadsCount = await prisma.lead.count({ where: { bdoId: fred.id } });

  console.log(`BAPX deals:      ${bapxCount}`);
  console.log(`Tradeline deals: ${tradelineCount}`);
  console.log(`Leads:           ${leadsCount}`);

  if (bapxCount > 0) {
    const deals = await prisma.bapxDeal.findMany({
      where: { bdoId: fred.id },
      select: { businessName: true, dealStage: true, dealHealth: true },
    });
    console.log('\nBAPX deals:');
    deals.forEach(d => console.log(`  - ${d.businessName} | ${d.dealStage} | ${d.dealHealth}`));
  }

  if (tradelineCount > 0) {
    const deals = await prisma.tradelineDeal.findMany({
      where: { bdoId: fred.id },
      select: { businessName: true, dealStage: true, dealHealth: true },
    });
    console.log('\nTradeline deals:');
    deals.forEach(d => console.log(`  - ${d.businessName} | ${d.dealStage} | ${d.dealHealth}`));
  }

  // Also check if any deals have null bdoId (unassigned)
  const nullBapx = await prisma.bapxDeal.count({ where: { bdoId: null } });
  const nullTradeline = await prisma.tradelineDeal.count({ where: { bdoId: null } });
  console.log(`\nUnassigned (bdoId=null): ${nullBapx} BAPX, ${nullTradeline} Tradeline`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
