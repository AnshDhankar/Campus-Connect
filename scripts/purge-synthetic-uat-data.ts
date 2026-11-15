/**
 * CampusConnect — Targeted Purge of Synthetic UAT Records
 * 
 * STRICT INVARIANT:
 * Preserves ONLY genuine user-formed data for "HINDU UNIVERSITY" (inst-1792319961187).
 * Purges strictly identified AI-formed synthetic records created during automated test runs on 2026-11-09.
 */

import fs from 'fs';
import mongoose from 'mongoose';

const GENUINE_INST_ID = 'inst-1792319961187';
const GENUINE_STUDENT_ID = 'student-1792320685750';
const GENUINE_STAFF_ID = 'staff-1792319961372';

async function main() {
  console.log('\n================================================================');
  console.log('  CAMPUSCONNECT — TARGETED SYNTHETIC DATA PURGE');
  console.log('================================================================\n');

  // Locate runtime MONGODB_URI
  const pids = fs.readdirSync('/proc').filter(p => /^\d+$/.test(p));
  let mongoUri = '';
  for (const pid of pids) {
    try {
      const env = fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
      const m = env.find(x => x.startsWith('MONGODB_URI='));
      if (m) {
        mongoUri = m.slice('MONGODB_URI='.length);
        break;
      }
    } catch {}
  }

  if (!mongoUri && process.env.MONGODB_URI) {
    mongoUri = process.env.MONGODB_URI;
  }

  if (!mongoUri) {
    console.error('❌ Could not locate MONGODB_URI.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db!;

  console.log(`Connected to database: ${mongoose.connection.name}`);

  // Safety Assertion 1: Verify Genuine Institution exists
  const genuineInst = await db.collection('institutions').findOne({ id: GENUINE_INST_ID });
  if (!genuineInst || genuineInst.name !== 'HINDU UNIVERSITY') {
    console.error('❌ [SAFETY ABORT] Could not verify HINDU UNIVERSITY in database. Aborting purge.');
    process.exit(1);
  }
  console.log(`✅ [SAFETY CHECK] Verified genuine institution: "${genuineInst.name}" (ID: ${genuineInst.id})`);

  // Safety Assertion 2: Verify Genuine Student exists
  const genuineStudent = await db.collection('students').findOne({ id: GENUINE_STUDENT_ID });
  if (!genuineStudent || genuineStudent.institutionId !== GENUINE_INST_ID) {
    console.error('❌ [SAFETY ABORT] Could not verify genuine student record. Aborting purge.');
    process.exit(1);
  }
  console.log(`✅ [SAFETY CHECK] Verified genuine student: "${genuineStudent.name}" (${genuineStudent.email})`);

  // Safety Assertion 3: Verify Genuine Staff exists
  const genuineStaff = await db.collection('staffs').findOne({ id: GENUINE_STAFF_ID });
  if (!genuineStaff || genuineStaff.institutionId !== GENUINE_INST_ID) {
    console.error('❌ [SAFETY ABORT] Could not verify genuine staff record. Aborting purge.');
    process.exit(1);
  }
  console.log(`✅ [SAFETY CHECK] Verified genuine staff: "${genuineStaff.name}" (${genuineStaff.email})`);

  console.log('\n--- Executing Targeted Cleanup of Synthetic Records ---');

  // 1. Purge Synthetic Institutions (where id !== GENUINE_INST_ID)
  const instResult = await db.collection('institutions').deleteMany({ id: { $ne: GENUINE_INST_ID } });
  console.log(`- Institutions purged: ${instResult.deletedCount} (Remaining: 1 genuine)`);

  // 2. Purge Synthetic Students
  const stuResult = await db.collection('students').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Students purged: ${stuResult.deletedCount} (Remaining: 1 genuine)`);

  // 3. Purge Synthetic Staff
  const staffResult = await db.collection('staffs').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Staff accounts purged: ${staffResult.deletedCount} (Remaining: 1 genuine)`);

  // 4. Purge Synthetic Departments
  const deptResult = await db.collection('departments').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Departments purged: ${deptResult.deletedCount} (Remaining: 9 genuine)`);

  // 5. Purge Synthetic Requests (Complaints / Help)
  const reqResult = await db.collection('requests').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Requests purged: ${reqResult.deletedCount} (Remaining: 1 genuine)`);

  // 6. Purge Synthetic Announcements
  const annResult = await db.collection('announcements').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Announcements purged: ${annResult.deletedCount} (Remaining: 0)`);

  // 7. Purge Synthetic Audit Logs
  const auditResult = await db.collection('auditlogs').deleteMany({ institutionId: { $ne: GENUINE_INST_ID } });
  console.log(`- Audit logs purged: ${auditResult.deletedCount} (Remaining: 0)`);

  // 8. Purge Synthetic Notifications
  const notifResult = await db.collection('notifications').deleteMany({
    $and: [
      { recipientId: { $ne: GENUINE_STUDENT_ID } },
      { recipientId: { $ne: GENUINE_STAFF_ID } },
      { institutionId: { $ne: GENUINE_INST_ID } }
    ]
  });
  console.log(`- Notifications purged: ${notifResult.deletedCount}`);

  console.log('\n--- Final Verification of Remaining Records ---');
  const remainingInsts = await db.collection('institutions').find({}).toArray();
  const remainingStudents = await db.collection('students').find({}).toArray();
  const remainingStaff = await db.collection('staffs').find({}).toArray();
  const remainingDepts = await db.collection('departments').find({}).toArray();
  const remainingReqs = await db.collection('requests').find({}).toArray();
  const remainingSubs = await db.collection('subdepartments').find({}).toArray();
  const remainingNotifs = await db.collection('notifications').find({}).toArray();

  console.log(`- Institutions remaining: ${remainingInsts.length} (${remainingInsts.map(i => i.name).join(', ')})`);
  console.log(`- Students remaining: ${remainingStudents.length} (${remainingStudents.map(s => s.name).join(', ')})`);
  console.log(`- Staff remaining: ${remainingStaff.length} (${remainingStaff.map(s => s.name).join(', ')})`);
  console.log(`- Departments remaining: ${remainingDepts.length} (All Hindu University)`);
  console.log(`- Subdepartments remaining: ${remainingSubs.length} (${remainingSubs.map(s => s.name).join(', ')})`);
  console.log(`- Requests remaining: ${remainingReqs.length}`);
  console.log(`- Notifications remaining: ${remainingNotifs.length}`);

  await mongoose.disconnect();
  console.log('\n================================================================');
  console.log('✅ CLEANUP COMPLETE: ONLY HINDU UNIVERSITY DATA REMAINS');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Purge error:', err);
  process.exit(1);
});
