import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Priority, TaskStatus, Company } from '@prisma/client';
import { qs, param } from '../lib/query';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const bdo = qs(req, 'bdo'), priority = qs(req, 'priority'), status = qs(req, 'status'), company = qs(req, 'company'), year = qs(req, 'year');
    const tasks = await prisma.task.findMany({
      where: {
        ...(bdo ? { bdo: { name: { contains: bdo, mode: 'insensitive' } } } : {}),
        ...(priority ? { priority: priority as Priority } : {}),
        ...(status ? { status: status as TaskStatus } : {}),
        ...(company ? { company: company as Company } : {}),
        ...(year ? { year: parseInt(year) } : {}),
      },
      include: { bdo: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.create({ data: req.body });
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create task', detail: String(err) });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.update({ where: { id: param(req, 'id') }, data: req.body });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update task', detail: String(err) });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: param(req, 'id') } });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete task' });
  }
});

export default router;
