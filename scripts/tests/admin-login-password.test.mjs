import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const sandbox = { exports: {}, TextEncoder, require(name) {
  if (name === "vue") return { reactive: value => value };
  if (name === "@pureadmin/utils") return { isPhone: () => true };
  if (name === "@/plugins/i18n") return { $t: value => value, transformI18n: value => value };
  if (name === "@/store/modules/user") return { useUserStoreHook: () => ({ verifyCode: "1234" }) };
  throw new Error(`Unexpected import: ${name}`);
} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../backend/admin/src/views/login/utils/rule.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const validate = value => { let result; sandbox.exports.loginRules.password[0].validator({}, value, error => { result = error; }); return result; };
test("login accepts existing accounts and long bootstrap passwords, including Unicode", () => {
  for (const password of ["admin123", "a".repeat(12), "a".repeat(72), "密".repeat(24)]) assert.equal(validate(password), undefined);
});
test("login rejects empty and over-72-byte input without submitting", () => {
  for (const password of ["", "a".repeat(73), "密".repeat(25)]) assert.ok(validate(password));
});
