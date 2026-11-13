import { describe, expect, it } from "vitest";
import { cityDetail, cityLabel, citySchema } from "./cities";

describe("cities", () => {
  it("labels a city by its region, or its country when there is none", () => {
    expect(cityLabel({ name: "Denver", region: "Colorado", country: "United States" })).toBe("Denver, Colorado");
    expect(cityLabel({ name: "Singapore", region: null, country: "Singapore" })).toBe("Singapore, Singapore");
  });

  it("tells apart cities with the same name", () => {
    expect(cityDetail({ region: "Illinois", country: "United States" })).toBe("Illinois · United States");
    expect(cityDetail({ region: null, country: "Brazil" })).toBe("Brazil");
  });

  it("accepts a row from the database and ignores extra columns", () => {
    expect(citySchema.parse({ id: 5419384, name: "Denver", region: "Colorado", country_code: "US", country: "United States", population: 729019 }).id).toBe(5419384);
  });
});
