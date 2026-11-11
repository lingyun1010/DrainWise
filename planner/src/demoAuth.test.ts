import { describe, expect, it } from "vitest";
import { checkLogin } from "../../web/lib/demoAuth";

describe("checkLogin (simulated accounts)", () => {
  it("lets the admin in with the admin name and password only", () => {
    expect(checkLogin("admin", " Admin ", "admin")).toEqual({ role: "admin" });
    expect(checkLogin("admin", "admin", "wrong")).toBeNull();
    expect(checkLogin("crew", "admin", "admin")).toBeNull();
  });
  it("gives each crew its own password and its own crew id", () => {
    expect(checkLogin("crew", "Crew A", "ibis")).toEqual({ role: "crew", crewId: "c1" });
    expect(checkLogin("crew", "b", "magpie")).toEqual({ role: "crew", crewId: "c2" });
    expect(checkLogin("crew", "crewc", "lorikeet")).toEqual({ role: "crew", crewId: "c3" });
    expect(checkLogin("crew", "Crew A", "magpie")).toBeNull();
  });
  it("a crew password never opens the manager", () => {
    expect(checkLogin("admin", "crew a", "ibis")).toBeNull();
  });
});
