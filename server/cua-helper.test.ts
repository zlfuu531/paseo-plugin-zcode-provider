import { expect, it } from "vitest";
import { cuaHelperEnabled } from "./cua-helper.js";

it("enables CUA helper auto-start by default and honors the opt-out", () => {
  expect(cuaHelperEnabled({})).toBe(true);
  expect(cuaHelperEnabled({ PASEO_ZCODE_CUA_HELPER: "0" })).toBe(false);
  expect(cuaHelperEnabled({ PASEO_ZCODE_CUA_HELPER: "1" })).toBe(true);
});
