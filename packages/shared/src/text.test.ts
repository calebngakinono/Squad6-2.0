import { describe, expect, it } from "vitest";
import { joinParts, SEP } from "./text";

describe("SEP", () => {
  it("is the bullet operator, never the zero-width middle dot in Overpass", () => {
    expect(SEP).toBe(" ∙ ");
    expect(SEP).not.toContain("·");
  });
});

describe("joinParts", () => {
  it("joins the parts that exist", () => {
    expect(joinParts("Las Vegas, Nevada", "1 of 6 members")).toBe(`Las Vegas, Nevada${SEP}1 of 6 members`);
    expect(joinParts("Denver", null, "", false, "4 members")).toBe(`Denver${SEP}4 members`);
    expect(joinParts()).toBe("");
  });
});
