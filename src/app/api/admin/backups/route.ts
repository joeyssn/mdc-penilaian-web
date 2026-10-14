import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = util.promisify(exec);
const BACKUPS_DIR = path.join(process.cwd(), 'backups');

export async function GET() {
  try {
    // Ensure the backups folder exists
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);

    const files = fs.readdirSync(BACKUPS_DIR).filter(file => file.endsWith('.sql'));
    
    const backups = files.map((filename, index) => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, filename));
      return {
        id: index.toString(),
        filename,
        createdAt: stats.birthtime.toISOString(),
        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        type: filename.includes('manual') ? 'MANUAL' : 'AUTO',
        status: 'READY'
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(backups);
  } catch (error) {
    console.error("Failed to fetch backups:", error);
    return NextResponse.json({ error: 'Failed to read backups directory' }, { status: 500 });
  }
}

export async function POST() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `manual_backup_${timestamp}.sql`;
    const backupPath = path.join(BACKUPS_DIR, filename);

    // Pull credentials from your environment variables
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'school_assessment_db';

    // Execute mysqldump to generate the SQL file
    // Note: mysqldump must be installed and in your system PATH
const dumpCommand = `"C:\\xampp\\mysql\\bin\\mysqldump" -u ${dbUser} ${dbPass ? `-p${dbPass}` : ''} ${dbName} > "${backupPath}"`;    
    await execPromise(dumpCommand);

    // Optional: If you have uploaded files (like assessment Excel imports), 
    // you would also zip the /public/uploads directory here alongside the .sql file.

    return NextResponse.json({ success: true, message: 'Backup created', filename });
  } catch (error) {
    console.error("Backup generation failed:", error);
    return NextResponse.json({ error: 'Failed to generate backup dump' }, { status: 500 });
  }
}