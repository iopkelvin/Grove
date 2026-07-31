// ESLint flat config.
//
// The project had a CSS linter (stylelint, for design-token discipline) but
// nothing at all checking the JavaScript, so genuinely broken code — unused
// imports, missing hook dependencies, components referencing undefined
// variables — could merge without a single complaint. This closes that gap.

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Prop types are not used anywhere in this codebase; the rule would
      // fire on every component without adding any real safety.
      "react/prop-types": "off",

      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  {
    files: ["**/*.test.{js,jsx}", "src/test/**/*.{js,jsx}", "vitest.setup.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    files: ["vite.config.js", "eslint.config.js", "stylelint.config.cjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
