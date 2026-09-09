/**
 * AWS Rekognition utility — server-side only.
 * One Collection per school (collectionId = schoolId).
 * ExternalImageId = studentId, so SearchFacesByImage returns the studentId directly.
 */

import {
  RekognitionClient,
  CreateCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  ListFacesCommand,
} from '@aws-sdk/client-rekognition';

let _client: RekognitionClient | null = null;

// Sob carga (muitas escolas reconhecendo ao mesmo tempo) a AWS pode limitar a
// taxa (ThrottlingException / ProvisionedThroughputExceededException). Em vez
// de falhar o frame na hora, tenta de novo com backoff exponencial + jitter —
// a maioria dos throttles é transitória. Esgotadas as tentativas, propaga o
// erro (a rota devolve o slot de cota e cai no registro manual).
const THROTTLE_ERRORS = new Set(['ThrottlingException', 'ProvisionedThroughputExceededException']);
const MAX_RETRIES = 3;

async function sendWithRetry<T>(send: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await send();
    } catch (err: any) {
      if (THROTTLE_ERRORS.has(err?.name) && attempt < MAX_RETRIES) {
        const backoff = 80 * 2 ** attempt + Math.floor(Math.random() * 60);
        await new Promise((r) => setTimeout(r, backoff));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

export function isConfigured() {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

/** Create the collection if it doesn't exist yet. */
export async function ensureCollection(collectionId: string): Promise<void> {
  try {
    await getClient().send(new CreateCollectionCommand({ CollectionId: collectionId }));
  } catch (err: any) {
    if (err.name !== 'ResourceAlreadyExistsException') throw err;
  }
}

/**
 * Delete all indexed faces for a student (identified by ExternalImageId = studentId).
 * Used before re-enrolling so stale faces don't accumulate.
 *
 * Fast path: when the caller has the student's stored FaceIds
 * (Student.rekognitionFaceIds), delete them directly — one API call.
 * Fallback: paginate the whole collection filtering by ExternalImageId
 * (needed for students enrolled before FaceIds were stored).
 */
export async function deleteFacesForStudent(
  collectionId: string,
  studentId: string,
  knownFaceIds?: string[]
): Promise<number> {
  if (knownFaceIds && knownFaceIds.length > 0) {
    try {
      await getClient().send(
        new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: knownFaceIds })
      );
      return knownFaceIds.length;
    } catch {
      // Stale ids (collection recreated etc.) — fall through to the full scan
    }
  }

  const faceIds: string[] = [];
  let nextToken: string | undefined;

  do {
    const res = await getClient().send(
      new ListFacesCommand({ CollectionId: collectionId, NextToken: nextToken })
    );
    for (const face of res.Faces ?? []) {
      if (face.ExternalImageId === studentId && face.FaceId) {
        faceIds.push(face.FaceId);
      }
    }
    nextToken = res.NextToken;
  } while (nextToken);

  if (faceIds.length > 0) {
    await getClient().send(
      new DeleteFacesCommand({ CollectionId: collectionId, FaceIds: faceIds })
    );
  }

  return faceIds.length;
}

/**
 * Index a single face image for a student.
 * Returns the FaceId(s) created (usually 1 per image if only one face is present).
 */
export async function indexFace(
  collectionId: string,
  imageBuffer: Buffer,
  studentId: string
): Promise<string[]> {
  const res = await getClient().send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: imageBuffer },
      ExternalImageId: studentId,
      DetectionAttributes: [],
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    })
  );

  return (res.FaceRecords ?? [])
    .map((r) => r.Face?.FaceId)
    .filter((id): id is string => !!id);
}

export interface BoundingBox {
  top: number;    // fraction 0–1
  left: number;
  width: number;
  height: number;
}

export interface FaceSearchMatch {
  studentId: string;
  similarity: number; // 0–100
  faceId: string;
}

export interface FaceSearchResult {
  matches: FaceSearchMatch[];
  /** Bounding box of the detected face (fractions 0–1), or null if no face found */
  box: BoundingBox | null;
}

/**
 * Detect a face in the image and find the closest match in the collection.
 * Returns matches sorted by similarity descending, plus the detected face's bounding box.
 */
export async function searchFacesByImage(
  collectionId: string,
  imageBuffer: Buffer,
  faceMatchThreshold: number = 70
): Promise<FaceSearchResult> {
  try {
    const res = await sendWithRetry(() =>
      getClient().send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: imageBuffer },
          MaxFaces: 5,
          FaceMatchThreshold: faceMatchThreshold,
        })
      )
    );

    const box: BoundingBox | null = res.SearchedFaceBoundingBox
      ? {
          top: res.SearchedFaceBoundingBox.Top ?? 0,
          left: res.SearchedFaceBoundingBox.Left ?? 0,
          width: res.SearchedFaceBoundingBox.Width ?? 0,
          height: res.SearchedFaceBoundingBox.Height ?? 0,
        }
      : null;

    const matches = (res.FaceMatches ?? [])
      .map((m) => ({
        studentId: m.Face?.ExternalImageId ?? '',
        similarity: m.Similarity ?? 0,
        faceId: m.Face?.FaceId ?? '',
      }))
      .filter((m) => m.studentId)
      .sort((a, b) => b.similarity - a.similarity);

    return { matches, box };
  } catch (err: any) {
    // No face detected in image, or collection is empty
    if (
      err.name === 'InvalidParameterException' ||
      err.name === 'ResourceNotFoundException'
    ) {
      return { matches: [], box: null };
    }
    throw err;
  }
}
