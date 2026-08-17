import {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";

export function serializeFirestoreValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = serializeFirestoreValue(nestedValue);
    }

    return result;
  }

  return value;
}

export function firestoreDocumentToJson(
  snapshot:
    | DocumentSnapshot<DocumentData>
    | QueryDocumentSnapshot<DocumentData>,
) {
  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(serializeFirestoreValue(data) as Record<string, unknown>),
  };
}
