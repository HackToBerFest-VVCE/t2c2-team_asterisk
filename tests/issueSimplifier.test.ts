import { describe, expect, it } from "vitest";
import { extractAcceptanceCriteria } from "../supabase/functions/_shared/issueSimplifier";

describe("issue acceptance-criteria extraction", () => {
  it("extracts only bullet items from an explicitly labeled section", () => {
    const body = [
      "## Description",
      "- This unrelated requirement is not acceptance criteria.",
      "",
      "### Acceptance Criteria",
      "- Focus moves with the arrow keys.",
      "2. The active item is announced to screen readers.",
      "",
      "## Notes",
      "- Do not include this note.",
    ].join("\n");

    expect(extractAcceptanceCriteria(body)).toEqual([
      "Focus moves with the arrow keys.",
      "The active item is announced to screen readers.",
    ]);
  });

  it("does not invent criteria when the issue has no labeled section", () => {
    expect(extractAcceptanceCriteria("Please improve the menu keyboard support.\n- Keep it accessible.")).toEqual([]);
    expect(extractAcceptanceCriteria(null)).toEqual([]);
  });
});
