// Colour and token discipline for the CSS.
//
// The original rules blocked raw hex/rgb values and required var(--color-*).
// Both are good and both are kept. Three changes:
//
//   1. custom-property-pattern only allowed ^color- or ^font-, so a spacing
//      or radius token failed lint. The design system now also has
//      --space-*, --radius-* and --shadow-*, and the pattern says so.
//   2. hsl() joins hex and rgb on the blocklist; it was the one raw colour
//      syntax that slipped through.
//   3. styles/theme.css is where raw values are *supposed* to live — it is
//      the file that defines the tokens everything else consumes. Requiring
//      it to use tokens is circular, so it is exempt from the value rules
//      (and only those two).

const rawColourPatterns = [/^#/, /^rgb/, /^hsl/];

const colorTokenPattern = /^var\(--color-/;
const fontTokenPattern = /^var\(--font-family/;

module.exports = {
  rules: {
    // Block raw colour values — use the tokens in src/styles/theme.css.
    "declaration-property-value-disallowed-list": {
      color: rawColourPatterns,
      "background-color": rawColourPatterns,
      "border-color": rawColourPatterns,
      border: rawColourPatterns,
    },

    // Require the shared tokens, not local workarounds.
    "declaration-property-value-allowed-list": {
      color: [colorTokenPattern, "inherit", "currentColor", "transparent"],
      "background-color": [colorTokenPattern, "inherit", "transparent", "none"],
      "border-color": [colorTokenPattern, "inherit", "transparent"],
      "font-family": [fontTokenPattern],
    },

    // New custom properties follow the naming convention.
    "custom-property-pattern": "^(color|font|space|radius|shadow)-",
  },

  overrides: [
    {
      files: ["src/styles/theme.css"],
      rules: {
        "declaration-property-value-disallowed-list": null,
        "declaration-property-value-allowed-list": null,
      },
    },
  ],
};
