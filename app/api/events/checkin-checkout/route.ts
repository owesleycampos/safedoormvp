/**
 * Webhook endpoint called by the Python AI agent on the tablet
 * when a face is recognized with sufficient confidence.
 * Protected by AGENT_API_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { notifyParentsOfStudent, formatAttendanceNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  // Validate agent API secret
  const apiSecret = req.headers.get('x-agent-secret');
  if (apiSecret !== process.env.AGENT_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      studentId,
      deviceId,
      eventType,
      confidence,
      photoUrl,
      timestamp: rawTimestamp,
    } = await req.json();

    if (!studentId || !eventType || !['ENTRY', 'EXIT'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (confidence !== undefined && confidence < 0.9) {
      return NextResponse.json({ error: 'Confidence below threshold' }, { status: 422 });
    }

    const timestamp = rawTimestamp ? new Date(rawTimestamp) : new Date();
    const dayStart = new Date(timestamp);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Check student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { school: { select: { name: true } } },
    });
    if (!student || !student.isActive) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Enforce 1 ENTRY + 1 EXIT per day rule
    const existingEvent = await prisma.attendanceEvent.findFirst({
      where: {
        studentId,
        eventType,
        timestamp: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (existingEvent && eventType === 'ENTRY') {
      // Already has entry for today — skip
      return NextResponse.json({
        skipped: true,
        reason: 'Entry already registered for today',
        existingEventId: existingEvent.id,
      });
    }

    // For EXIT: update the last exit time (or create)
    let event;
    if (eventType === 'EXIT' && existingEvent) {
      event = await prisma.attendanceEvent.update({
        where: { id: existingEvent.id },
        data: { timestamp, photoUrl, confidence, notified: false },
      });
    } else {
      event = await prisma.attendanceEvent.create({
        data: {
          studentId,
          deviceId: deviceId || null,
          eventType,
          timestamp,
          photoUrl,
          confidence,
          isManual: false,
        },
      });
    }

    // Update device lastSeen
    if (deviceId) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { lastSeen: new Date(), status: 'ONLINE' },
      }).catch(() => {});
    }

    // Send push notifications to parents (fire-and-forget)
    const notification = formatAttendanceNotification(
      student.name,
      eventType,
      timestamp,
      student.school.name
    );
    notifyParentsOfStudent(studentId, notification).catch(console.error);

    // Mark as notified
    await prisma.attendanceEvent.update({
      where: { id: event.id },
      data: { notified: true },
    }).catch(() => {});

    return NextResponse.json({ success: true, eventId: event.id }, { status: 201 });
  } catch (error) {
    console.error('Checkin-checkout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
