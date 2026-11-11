import { describe, expect, it } from "vitest";
import { checkLogin } from "../../web/lib/demoAuth";

const crews = [
  { id: "c1", name: "Crew A" },
  { id: "c2", name: "Crew B" },
];

describe("checkLogin (simulated accounts)", () => {
  it("lets the admin in with admin and admin only", () => {
    expect(checkLogin("admin", " Admin ", "admin")).toEqual({ role: "admin" });
    expect(checkLogin("admin", "admin", "wrong")).toBeNull();
    expect(checkLogin("crew", "admin", "admin", crews)).toBeNull();
  });
  it("a crew signs in with its name as name and password, case ignored", () => {
    expect(checkLogin("crew", "Crew A", "Crew A", crews)).toEqual({ role: "crew", crewId: "c1" });
    expect(checkLogin("crew", "crew b", "CREW B", crews)).toEqual({ role: "crew", crewId: "c2" });
    expect(checkLogin("crew", "Crew A", "Crew B", crews)).toBeNull();
  });
  it("follows renamed and new crews", () => {
    const next = [{ id: "c1", name: "North team" }, ...crews.slice(1), { id: "c9", name: "Maria" }];
    expect(checkLogin("crew", "North team", "north team", next)).toEqual({ role: "crew", crewId: "c1" });
    expect(checkLogin("crew", "Crew A", "Crew A", next)).toBeNull();
    expect(checkLogin("crew", "Maria", "Maria", next)).toEqual({ role: "crew", crewId: "c9" });
  });
  it("a crew password never opens the manager, and an empty name never matches", () => {
    expect(checkLogin("admin", "Crew A", "Crew A", crews)).toBeNull();
    expect(checkLogin("crew", "", "", crews)).toBeNull();
  });
});
