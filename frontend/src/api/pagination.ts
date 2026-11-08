/**
 * Strictly-typed list unwrapping helper for Django REST Framework APIs.
 * Transparently unwraps both plain arrays T[] and standard paginated envelopes { count, results: T[] }.
 * Zero usage of `any` types.
 */

export interface PaginatedEnvelope<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export type ListResponse<T> = T[] | PaginatedEnvelope<T> | null | undefined;

export function unwrapList<T>(response: ListResponse<T>): T[] {
  if (!response) {
    return [];
  }
  if (Array.isArray(response)) {
    return response;
  }
  if (typeof response === "object" && Array.isArray(response.results)) {
    return response.results;
  }
  return [];
}
