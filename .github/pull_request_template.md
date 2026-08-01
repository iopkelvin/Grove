<!--
Keep this short. The point is that a reviewer can tell what changed and how
you know it works, without reading the whole diff first.
-->

## What this changes

<!-- One or two sentences. What is different for a user after this merges? -->

## Why

<!-- The problem, not the solution. Link the issue or the line on the
     development plan if there is one. -->

## How it was tested

<!-- What you actually ran and what you actually clicked. "Tests pass" is
     not an answer on its own — which tests, and what did you verify by
     hand? -->

- [ ] `pytest` passes locally
- [ ] `cd frontend && npm run check` passes locally
- [ ] Tested by hand in the browser

## Checklist

- [ ] New behaviour has a test, and the test fails without the change
- [ ] Loading, empty and error states are handled for anything that fetches
- [ ] No secrets, keys or `.env` files in the diff
- [ ] Model changes come with a migration (`flask --app app db migrate`)
- [ ] Docs updated if setup, endpoints or user-facing behaviour changed

## Screenshots

<!-- For any visible change. Light and dark mode if the change touches CSS. -->
