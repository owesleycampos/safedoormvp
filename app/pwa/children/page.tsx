import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ChildrenClient } from '@/components/pwa/children-client';

export const metadata = { title: 'Meus Filhos' };

async function getChildren(userId: string) {
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            include: {
              class: { select: { name: true } },
              school: { select: { name: true } },
              attendance: {
                where: {
                  timestamp: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  },
                },
                orderBy: { timestamp: 'desc' },
                take: 2,
              },
            },
          },
        },
      },
    },
  });

  return parent?.students.map((sp) => ({
    ...sp.student,
    relationship: sp.relationship,
    lastEvent: sp.student.attendance[0] || null,
  })) || [];
}

export default async function ChildrenPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  const children = await getChildren(userId);

  return <ChildrenClient children={children} />;
}
