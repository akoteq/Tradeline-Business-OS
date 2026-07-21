import { SME } from '../models/SME';

// Backfills a client's (SME) region from a deal when the client has none yet — so a region
// entered while adding a deal fills in the Client Overview record. Only fills the gap;
// never overwrites an existing region. Best-effort — callers ignore failures.
export async function backfillSmeRegion(smeId?: string | null, region?: string | null): Promise<void> {
  if (!smeId || !region) return;
  await SME.updateOne(
    { _id: smeId, $or: [{ region: null }, { region: '' }, { region: { $exists: false } }] },
    { $set: { region } },
  );
}
