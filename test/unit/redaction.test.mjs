import assert from "node:assert";
import {
  maskEmail,
  redactSecrets,
  redactSensitiveData,
  sanitizePlainText,
} from "../../dist/security/redaction.js";

console.log("Running Redaction and Sanitization Unit Tests...");

// 1. redactSecrets string
const rawString = "Connecting with key ck_abc1234567890 and secret cs_xyz9876543210 over REST";
const redactedString = redactSecrets(rawString);
assert.strictEqual(
  redactedString,
  "Connecting with key ck_[REDACTED] and secret cs_[REDACTED] over REST",
);
assert.strictEqual(redactedString.includes("ck_abc1234567890"), false);
assert.strictEqual(redactedString.includes("cs_xyz9876543210"), false);

// 2. redactSensitiveData object
const rawObj = {
  store: "My Store",
  consumer_key: "ck_secret_key",
  consumer_secret: "cs_secret_val",
  nested: {
    password: "super_secret_pw",
    token: "token_123",
    regularField: "safe value",
  },
  items: [{ key: "ck_another_key", name: "Safe Item" }],
};

const cleaned = redactSensitiveData(rawObj);
assert.strictEqual(cleaned.consumer_key, "[REDACTED]");
assert.strictEqual(cleaned.consumer_secret, "[REDACTED]");
assert.strictEqual(cleaned.nested.password, "[REDACTED]");
assert.strictEqual(cleaned.nested.token, "[REDACTED]");
assert.strictEqual(cleaned.nested.regularField, "safe value");
assert.strictEqual(cleaned.items[0].key, "[REDACTED]");

// 3. maskEmail
assert.strictEqual(maskEmail("john.doe@example.com"), "j*****e@example.com");
assert.strictEqual(maskEmail("al@test.com"), "a*@test.com");
assert.strictEqual(maskEmail("invalid"), "[INVALID_EMAIL]");
assert.strictEqual(maskEmail(null), null);

// 4. sanitizePlainText
const dirtyHtml = "<div><p>Hello <b>World</b></p><script>alert('xss')</script> &amp; Welcome!</div>";
const cleanText = sanitizePlainText(dirtyHtml);
assert.strictEqual(cleanText.includes("<script>"), false);
assert.strictEqual(cleanText.includes("alert"), false);
assert.strictEqual(cleanText, "Hello World & Welcome!");

console.log("PASS: Redaction and sanitization tests passed.");
