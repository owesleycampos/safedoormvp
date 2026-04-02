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
 */
export async function deleteFacesForStudent(
  collectionId: string,
  studentId: string
): Promise<number> {
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
  imageBuffer: Buffer
): Promise<FaceSearchResult> {
  try {
    const res = await getClient().send(
      new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBuffer },
        MaxFaces: 5,
        FaceMatchThreshold: 70,
      })
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
