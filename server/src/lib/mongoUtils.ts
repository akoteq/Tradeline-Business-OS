import { BDO } from '../models/BDO';

type WithBdoId = { bdoId?: string | null; toJSON(): Record<string, unknown> };

export async function withBdo<T extends WithBdoId>(docs: T[]) {
  const ids = [...new Set(docs.map((d) => d.bdoId).filter(Boolean))] as string[];
  const bdoMap: Record<string, unknown> = {};
  if (ids.length) {
    const bdos = await BDO.find({ _id: { $in: ids } });
    bdos.forEach((b) => { bdoMap[b.id] = b.toJSON(); });
  }
  return docs.map((d) => {
    const json = d.toJSON();
    json.bdo = json.bdoId ? bdoMap[json.bdoId as string] ?? null : null;
    return json;
  });
}

export async function bdoIdsByName(name: string): Promise<string[]> {
  const bdos = await BDO.find({ name: { $regex: name, $options: 'i' } }, '_id');
  return bdos.map((b) => b.id as string);
}
