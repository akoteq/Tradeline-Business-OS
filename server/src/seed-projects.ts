import 'dotenv/config';
import { connectDB } from './lib/db';
import { Project } from './models/Project';
import mongoose from 'mongoose';

const PROJECTS = [
  { name: 'FILMA',                    leader: 'Forster',   status: 'ACTIVE', company: 'SHARED' },
  { name: 'GIZ Baobab Oil Production', leader: 'Sam',       status: 'ACTIVE', company: 'TRADELINE' },
  { name: 'Community Finance (CofI)',  leader: 'Forster',   status: 'ACTIVE', company: 'TRADELINE' },
  { name: 'JoY PS',                   leader: 'Fred/Sam',  status: 'ACTIVE', company: 'SHARED' },
  { name: 'Tradeline AMSIG',          leader: 'Forster',   status: 'ACTIVE', company: 'TRADELINE' },
  { name: 'GIZ SunIce Project',       leader: 'Sam',       status: 'ACTIVE', company: 'TRADELINE' },
  { name: 'GB Foods Projects',        leader: 'Stephen',   status: 'ACTIVE', company: 'SHARED' },
  { name: 'JET Project',              leader: 'Forster',   status: 'ACTIVE', company: 'SHARED' },
];

async function main() {
  await connectDB();
  const existing = await Project.countDocuments();
  if (existing > 0) {
    console.log(`Projects already seeded (${existing} found). Skipping.`);
  } else {
    await Project.insertMany(PROJECTS);
    console.log(`Seeded ${PROJECTS.length} projects.`);
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
