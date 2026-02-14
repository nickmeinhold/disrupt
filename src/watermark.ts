// Watermarking service - integrates with Firebase backend for DFT-based invisible watermarking
// Uses REST APIs for Deno compatibility (no gRPC issues)

import { encode as base64UrlEncode } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const PROJECT_ID = "watermarking-4a428";
const STORAGE_BUCKET = "watermarking-4a428.firebasestorage.app";

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

let serviceAccount: ServiceAccount | null = null;
let accessToken: string | null = null;
let tokenExpiry = 0;

// Cache for Discord ID -> Firebase UID mapping
const userCache = new Map<string, string>();

export function initializeWatermarking() {
  const serviceAccountPath = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable required");
  }

  serviceAccount = JSON.parse(Deno.readTextFileSync(serviceAccountPath));
  console.log("Watermarking service initialized");
}

// Firebase Auth - get or create user for Discord account
export async function getOrCreateFirebaseUser(
  discordId: string,
  discordUsername: string
): Promise<string> {
  // Check cache first
  const cached = userCache.get(discordId);
  if (cached) return cached;

  const token = await getAccessToken();

  // Try to find existing user by searching in Firestore users collection
  // (Firebase Auth doesn't support querying by custom claims via REST)
  const existingUser = await findUserByDiscordId(discordId);
  if (existingUser) {
    userCache.set(discordId, existingUser);
    return existingUser;
  }

  // Create new Firebase Auth user
  const uid = await createFirebaseUser(discordId, discordUsername);
  userCache.set(discordId, uid);

  // Store mapping in Firestore for future lookups
  await firestoreSetDocument("users", uid, {
    discordId,
    discordUsername,
    createdAt: "SERVER_TIMESTAMP",
    provider: "discord",
  });

  // Also create an index document for Discord ID lookup
  await firestoreSetDocument("discordUsers", discordId, {
    firebaseUid: uid,
    discordUsername,
  });

  console.log(`[auth] Created Firebase user ${uid} for Discord user ${discordUsername} (${discordId})`);
  return uid;
}

// Find Firebase UID by Discord ID using Firestore index
async function findUserByDiscordId(discordId: string): Promise<string | null> {
  const doc = await firestoreGetDocument("discordUsers", discordId);
  return doc?.firebaseUid as string | null;
}

// Create a new Firebase Auth user
async function createFirebaseUser(
  discordId: string,
  discordUsername: string
): Promise<string> {
  const token = await getAccessToken();

  // Generate a unique UID
  const uid = crypto.randomUUID();

  // Create user via Identity Toolkit API
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      localId: uid,
      displayName: discordUsername,
      customAttributes: JSON.stringify({
        discordId,
        provider: "discord",
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Firebase user: ${error}`);
  }

  return uid;
}

// Create a signed JWT for Google OAuth
async function createSignedJwt(): Promise<string> {
  if (!serviceAccount) throw new Error("Service account not initialized");

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write",
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key and sign
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Get OAuth access token (with caching)
async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  const jwt = await createSignedJwt();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return accessToken!;
}

// Firestore REST API helpers
async function firestoreCreateDocument(
  collection: string,
  data: Record<string, unknown>
): Promise<string> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore create failed: ${error}`);
  }

  const doc = await response.json();
  // Extract document ID from name: projects/.../documents/collection/docId
  const docId = doc.name.split("/").pop();
  return docId;
}

async function firestoreSetDocument(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore set failed: ${error}`);
  }
}

async function firestoreGetDocument(
  collection: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore get failed: ${error}`);
  }

  const doc = await response.json();
  return fromFirestoreFields(doc.fields || {});
}

async function firestoreQuery(
  collection: string,
  filters: { field: string; op: string; value: unknown }[],
  orderBy?: { field: string; direction: "ASCENDING" | "DESCENDING" },
  limit?: number
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collection }],
  };

  if (filters.length > 0) {
    structuredQuery.where = {
      compositeFilter: {
        op: "AND",
        filters: filters.map((f) => ({
          fieldFilter: {
            field: { fieldPath: f.field },
            op: f.op,
            value: toFirestoreValue(f.value),
          },
        })),
      },
    };
  }

  if (orderBy) {
    structuredQuery.orderBy = [
      { field: { fieldPath: orderBy.field }, direction: orderBy.direction },
    ];
  }

  if (limit) {
    structuredQuery.limit = limit;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firestore query failed: ${error}`);
  }

  const results = await response.json();
  return results
    .filter((r: { document?: unknown }) => r.document)
    .map((r: { document: { name: string; fields: Record<string, unknown> } }) => ({
      id: r.document.name.split("/").pop(),
      data: fromFirestoreFields(r.document.fields || {}),
    }));
}

// Convert JS values to Firestore format
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === "SERVER_TIMESTAMP") {
    return { timestampValue: new Date().toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

// Convert Firestore format to JS values
function fromFirestoreValue(value: Record<string, unknown>): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return parseInt(value.integerValue as string, 10);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return new Date(value.timestampValue as string);
  if ("arrayValue" in value) {
    const arr = value.arrayValue as { values?: Record<string, unknown>[] };
    return (arr.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    const map = value.mapValue as { fields?: Record<string, Record<string, unknown>> };
    return fromFirestoreFields(map.fields || {});
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    obj[key] = fromFirestoreValue(value);
  }
  return obj;
}

// GCS REST API helpers
async function uploadToGcs(
  path: string,
  data: Uint8Array,
  contentType: string
): Promise<void> {
  const token = await getAccessToken();
  const encodedPath = encodeURIComponent(path);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GCS upload failed: ${error}`);
  }
}

// Public API - matches original interface
export async function uploadImageToStorage(
  userId: string,
  requestId: string,
  fileName: string,
  imageBuffer: Uint8Array
): Promise<{ gcsPath: string; originalImageId: string }> {
  const gcsPath = `original-images/${userId}/${requestId}-${fileName}`;

  await uploadToGcs(gcsPath, imageBuffer, "image/png");

  const originalImageId = await firestoreCreateDocument("originalImages", {
    userId,
    name: fileName,
    path: gcsPath,
    timestamp: "SERVER_TIMESTAMP",
  });

  return { gcsPath, originalImageId };
}

export async function uploadDetectionImages(
  userId: string,
  requestId: string,
  originalBuffer: Uint8Array,
  markedBuffer: Uint8Array
): Promise<{ originalPath: string; markedPath: string }> {
  const originalPath = `detecting-images/${userId}/${requestId}-original.png`;
  const markedPath = `detecting-images/${userId}/${requestId}-marked.png`;

  await Promise.all([
    uploadToGcs(originalPath, originalBuffer, "image/png"),
    uploadToGcs(markedPath, markedBuffer, "image/png"),
  ]);

  return { originalPath, markedPath };
}

interface MarkingTaskParams {
  userId: string;
  originalImageId: string;
  imageName: string;
  imagePath: string;
  message: string;
  strength: number;
}

// Wake up Cloud Run backend (scales from zero)
async function wakeUpBackend(): Promise<void> {
  try {
    await fetch("https://watermarking-backend-78940960204.us-central1.run.app/");
  } catch {
    // Ignore errors - just trying to trigger scale-up
  }
}

interface MarkingTaskResult {
  taskId: string;
  markedImageId: string;
}

export async function createMarkingTask(params: MarkingTaskParams): Promise<MarkingTaskResult> {
  // Wake up backend before creating task
  wakeUpBackend();

  // Create markedImages document first (backend needs this for progress updates)
  const markedImageId = await firestoreCreateDocument("markedImages", {
    originalImageId: params.originalImageId,
    userId: params.userId,
    message: params.message,
    name: params.imageName,
    strength: params.strength,
    progress: "Queued",
    createdAt: "SERVER_TIMESTAMP",
  });

  // Create task with reference to markedImages document
  const taskId = await firestoreCreateDocument("tasks", {
    type: "mark",
    status: "pending",
    userId: params.userId,
    markedImageId: markedImageId,
    originalImageId: params.originalImageId,
    name: params.imageName,
    path: params.imagePath,
    message: params.message,
    strength: params.strength,
    createdAt: "SERVER_TIMESTAMP",
  });

  return { taskId, markedImageId };
}

export async function createDetectionTask(
  userId: string,
  itemId: string,
  originalPath: string,
  markedPath: string
): Promise<void> {
  await firestoreSetDocument("detecting", userId, {
    itemId,
    isDetecting: true,
    progress: "Starting detection...",
    pathOriginal: originalPath,
    pathMarked: markedPath,
  });

  await firestoreCreateDocument("tasks", {
    type: "detect",
    status: "pending",
    userId,
    itemId,
    originalPath,
    markedPath,
    createdAt: "SERVER_TIMESTAMP",
  });
}

interface MarkingResult {
  success: boolean;
  servingUrl?: string;
  error?: string;
}

interface MarkingProgress {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: string;
  percent?: number;
  servingUrl?: string;
  error?: string;
}

// Get current marking progress (non-blocking)
export async function getMarkingProgress(
  taskId: string,
  markedImageId: string
): Promise<MarkingProgress> {
  // Check markedImages document first - backend deletes task after completion
  const markedData = await firestoreGetDocument("markedImages", markedImageId);

  // If servingUrl exists, task is complete (backend sets this on success)
  if (markedData?.servingUrl) {
    return {
      status: "completed",
      servingUrl: markedData.servingUrl as string
    };
  }

  // Check task document for status
  const taskData = await firestoreGetDocument("tasks", taskId);

  if (taskData?.status === "failed") {
    return { status: "failed", error: (taskData.error as string) || "Task failed" };
  }

  // If task is deleted but no servingUrl, it might still be processing the final steps
  // or it failed silently

  // Get progress from markedImages document
  const progress = markedData?.progress as string | undefined;

  // Parse percent from progress string like "Embedding watermark (5/20)"
  let percent: number | undefined;
  if (progress) {
    const match = progress.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      percent = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100);
    }
  }

  return {
    status: (taskData?.status as "pending" | "processing") || "pending",
    progress,
    percent,
  };
}

// Poll for marking result with progress callback
export async function pollForMarkingResultWithProgress(
  taskId: string,
  markedImageId: string,
  onProgress: (progress: MarkingProgress) => void,
  maxAttempts = 1800, // 1 hour at 2s intervals
  intervalMs = 2000
): Promise<MarkingResult> {
  let lastPercent = -1;

  console.log(`[poll] Starting poll for task=${taskId}, markedImage=${markedImageId}`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const progress = await getMarkingProgress(taskId, markedImageId);

    if (attempt % 30 === 0) { // Log every minute
      console.log(`[poll] Attempt ${attempt}: status=${progress.status}, progress=${progress.progress}, percent=${progress.percent}`);
    }

    // Report progress at 10% intervals
    if (progress.percent !== undefined && progress.percent !== lastPercent) {
      const rounded = Math.floor(progress.percent / 10) * 10;
      if (rounded > lastPercent) {
        lastPercent = rounded;
        onProgress(progress);
      }
    }

    if (progress.status === "failed") {
      console.log(`[poll] Task failed: ${progress.error}`);
      return { success: false, error: progress.error };
    }

    if (progress.status === "completed" && progress.servingUrl) {
      console.log(`[poll] Task completed! servingUrl=${progress.servingUrl}`);
      onProgress(progress);
      return { success: true, servingUrl: progress.servingUrl };
    }

    await sleep(intervalMs);
  }

  return { success: false, error: "Timeout waiting for result" };
}

export async function pollForMarkingResult(
  taskId: string,
  userId: string,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<MarkingResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const taskData = await firestoreGetDocument("tasks", taskId);

    if (taskData?.status === "failed") {
      return { success: false, error: (taskData.error as string) || "Task failed" };
    }

    if (taskData?.status === "completed") {
      const results = await firestoreQuery(
        "markedImages",
        [{ field: "userId", op: "EQUAL", value: userId }],
        { field: "createdAt", direction: "DESCENDING" },
        1
      );

      if (results.length > 0 && results[0].data.servingUrl) {
        return { success: true, servingUrl: results[0].data.servingUrl as string };
      }
    }

    await sleep(intervalMs);
  }

  return { success: false, error: "Timeout waiting for result" };
}

interface DetectionResult {
  success: boolean;
  message?: string;
  confidence?: number;
  error?: string;
}

export async function pollForDetectionResult(
  userId: string,
  itemId: string,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<DetectionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = await firestoreGetDocument("detecting", userId);

    if (data?.error) {
      return { success: false, error: data.error as string };
    }

    if (data?.results) {
      const results = data.results as { message?: string; confidence?: number };
      return {
        success: true,
        message: results.message || undefined,
        confidence: results.confidence,
      };
    }

    if (data?.isDetecting === false && data?.itemId === itemId) {
      const items = await firestoreQuery(
        "detectionItems",
        [{ field: "userId", op: "EQUAL", value: userId }],
        { field: "timestamp", direction: "DESCENDING" },
        1
      );

      if (items.length > 0) {
        return {
          success: true,
          message: (items[0].data.result as string) || undefined,
          confidence: items[0].data.confidence as number | undefined,
        };
      }
    }

    await sleep(intervalMs);
  }

  return { success: false, error: "Timeout waiting for detection result" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
