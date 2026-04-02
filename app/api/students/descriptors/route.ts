import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/students/descriptors
 *
 * Returns all active students with their face descriptors so the browser
 * can load them into a FaceMatcher for real-time recognition.
 *
 * Response: {
 *   students: [{
 *     id, name, photoUrl,
 *     descriptor: number[] | null,  // 128 float32 values or null if not enrolled
 *     classId, className
 *   }]
 * }
 */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const schoolId = (session.user as any)?.schoolId;

  const students = await prisma.student.findMany({
    where: { schoolId, isActive: true },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      faceVector: true,
      classId: true,
      class: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const result = students.map((s) => {
    let descriptor: number[] | null = null;
    if (s.faceVector && s.faceVector.length === 512) {
      // 128 float32 values × 4 bytes = 512 bytes
      // Must use byteOffset/byteLength because Node.js Buffer shares an ArrayBuffer pool
      const buf = Buffer.from(s.faceVector);
      descriptor = Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
    }
    return {
      id: s.id,
      name: s.name,
      photoUrl: s.photoUrl,
      descriptor,
      classId: s.classId,
      className: s.class?.name ?? null,
    };
  });

  return NextResponse.json({ students: result });
}
