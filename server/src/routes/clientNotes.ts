import { Router, Request, Response } from 'express';
import { ClientNote } from '../models/ClientNote';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const smeId = qs(req, 'smeId');
    const query: Record<string, unknown> = {};
    if (smeId) query.smeId = smeId;
    const notes = await ClientNote.find(query).sort({ date: -1, createdAt: -1 });
    res.json(notes.map((n) => n.toJSON()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const note = await new ClientNote(req.body).save();
    res.status(201).json(note.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to create note', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const note = await ClientNote.findByIdAndUpdate(param(req, 'id'), req.body, { new: true, runValidators: true });
    if (!note) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(note.toJSON());
  } catch (err) {
    res.status(400).json({ error: 'Failed to update note', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await ClientNote.findByIdAndDelete(param(req, 'id'));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete note' });
  }
});

export default router;
