/**
 * Authentication for the Python camera agent's server endpoints.
 *
 * Preferred: per-device API key (`x-device-api-key` header, Device.apiKey).
 * The device row scopes the request to ONE school — a leaked key from one
 * school can never write data into another tenant.
 *
 * Legacy fallback: the global `x-agent-secret` is still accepted, but it
 * must be accompanied by a valid deviceId (in the payload) so the request
 * can be scoped to that device's school. Without a resolvable device, the
 * request is rejected — a global secret alone no longer grants
 * cross-tenant writes.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export interface AgentAuthOk {
  ok: true;
  deviceId: string;
  schoolId: string;
}

export interface AgentAuthFail {
  ok: false;
  status: number;
  message: string;
}

export async function authenticateAgent(
  req: NextRequest,
  payloadDeviceId?: string | null
): Promise<AgentAuthOk | AgentAuthFail> {
  const deviceApiKey = req.headers.get('x-device-api-key');

  if (deviceApiKey) {
    const device = await prisma.device.findUnique({
      where: { apiKey: deviceApiKey },
      select: { id: true, schoolId: true },
    });
    if (!device) return { ok: false, status: 401, message: 'Invalid device API key' };
    await touchDevice(device.id);
    return { ok: true, deviceId: device.id, schoolId: device.schoolId };
  }

  const agentSecret = req.headers.get('x-agent-secret');
  if (agentSecret && process.env.AGENT_API_SECRET && agentSecret === process.env.AGENT_API_SECRET) {
    if (!payloadDeviceId) {
      return { ok: false, status: 401, message: 'deviceId required with legacy agent secret' };
    }
    const device = await prisma.device.findUnique({
      where: { id: payloadDeviceId },
      select: { id: true, schoolId: true },
    });
    if (!device) return { ok: false, status: 401, message: 'Unknown device' };
    await touchDevice(device.id);
    return { ok: true, deviceId: device.id, schoolId: device.schoolId };
  }

  return { ok: false, status: 401, message: 'Unauthorized' };
}

async function touchDevice(deviceId: string) {
  await prisma.device.update({
    where: { id: deviceId },
    data: { lastSeen: new Date(), status: 'ONLINE' },
  }).catch(() => {});
}
