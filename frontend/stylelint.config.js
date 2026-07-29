// patterns for raw values we want to block
const hexColorPattern = /^#/;
const rgbColorPattern = /^rgb/;

// patterns for required token usage
const colorTokenPattern = /^var\(--color-/;
const fontTokenPattern = /^var\(--font-family/;

module.exports = {
  rules: {
    // block raw hex/rgb — use tokens.css instead
    "declaration-property-value-disallowed-list": {
      color: [hexColorPattern, rgbColorPattern],
      "background-color": [hexColorPattern, rgbColorPattern],
      "border-color": [hexColorPattern, rgbColorPattern],
      border: [hexColorPattern, rgbColorPattern],
    },

    // require actual shared tokens, not local workarounds
    "declaration-property-value-allowed-list": {
      color: [colorTokenPattern, "inherit", "currentColor", "transparent"],
      "background-color": [colorTokenPattern, "inherit", "transparent"],
      "border-color": [colorTokenPattern, "inherit", "transparent"],
      "font-family": [fontTokenPattern],
    },

    // new custom properties must follow naming convention
    "custom-property-pattern": "^color-|^font-",
  },
};