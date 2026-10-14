import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);
const BACKUPS_DIR = path.join(process.cwd(), 'backups');

export async function POST(req: Request) {
  try {
    const { filename } = await req.json();
    
    if (!filename || !filename.endsWith('.sql')) {
      return NextResponse.json({ error: 'Invalid backup file selected' }, { status: 400 });
    }

    const backupPath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: 'Backup file not found on server' }, { status: 404 });
    }

    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'school_assessment_db';

    // Execute mysql import to overwrite the database
const restoreCommand = `"C:\\xampp\\mysql\\bin\\mysql" -u ${dbUser} ${dbPass ? `-p${dbPass}` : ''} ${dbName} < "${backupPath}"`;    
    await execPromise(restoreCommand);

    return NextResponse.json({ success: true, message: 'System restored successfully' });
  } catch (error) {
    console.error("Critical Error during restoration:", error);
    return NextResponse.json({ error: 'Database restoration failed. Check server logs.' }, { status: 500 });
  }
}