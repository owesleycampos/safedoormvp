import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  let settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });

  // Auto-create defaults if not yet configured
  if (!settings) {
    settings = await prisma.schoolSettings.create({
      data: { schoolId },
    });
  }

  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId as string;

  try {
    const body = await req.json();
    const {
      entryStartTime, entryEndTime, exitStartTime, exitEndTime,
      minConfidence, notifyOnEntry, notifyOnExit, timezone,
    } = body;

    const settings = await prisma.schoolSettings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        ...(entryStartTime !== undefined && { entryStartTime }),
        ...(entryEndTime !== undefined && { entryEndTime }),
        ...(exitStartTime !== undefined && { exitStartTime }),
        ...(exitEndTime !== undefined && { exitEndTime }),
        ...(minConfidence !== undefined && { minConfidence }),
        ...(notifyOnEntry !== undefined && { notifyOnEntry }),
        ...(notifyOnExit !== undefined && { notifyOnExit }),
        ...(timezone !== undefined && { timezone }),
      },
      update: {
        ...(entryStartTime !== undefined && { entryStartTime }),
        ...(entryEndTime !== undefined && { entryEndTime }),
        ...(exitStartTime !== undefined && { exitStartTime }),
        ...(exitEndTime !== undefined && { exitEndTime }),
        ...(minConfidence !== undefined && { minConfidence }),
        ...(notifyOnEntry !== undefined && { notifyOnEntry }),
        ...(notifyOnExit !== undefined && { notifyOnExit }),
        ...(timezone !== undefined && { timezone }),
      },
    });

    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
