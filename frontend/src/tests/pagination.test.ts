import { describe, it, expect } from "vitest";
import { unwrapList, PaginatedEnvelope } from "../api/pagination";

describe("unwrapList pagination helper", () => {
  interface SampleItem {
    id: string;
    name: string;
  }

  const sampleItems: SampleItem[] = [
    { id: "1", name: "Masala Dosa" },
    { id: "2", name: "Filter Coffee" },
  ];

  it("unwraps a standard plain array", () => {
    const result = unwrapList(sampleItems);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Masala Dosa");
  });

  it("unwraps a DRF paginated envelope with results array", () => {
    const envelope: PaginatedEnvelope<SampleItem> = {
      count: 2,
      next: null,
      previous: null,
      results: sampleItems,
    };
    const result = unwrapList(envelope);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Filter Coffee");
  });

  it("safely handles null and undefined by returning empty array", () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList(undefined)).toEqual([]);
  });

  it("safely handles empty paginated envelope", () => {
    const emptyEnvelope: PaginatedEnvelope<SampleItem> = {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
    expect(unwrapList(emptyEnvelope)).toEqual([]);
  });

  it("safely handles invalid object shapes without throwing", () => {
    expect(unwrapList({} as any)).toEqual([]);
  });
});
