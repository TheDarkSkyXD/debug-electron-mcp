# Form input

## User outcome

A user can fill the demo form, submit it, and see the submitted values rendered back in the app.

## Entry points

- Name and email inputs followed by the visible submit control.

## Preconditions

- Window discovery passed.
- Use unique non-sensitive test values for each run.

## MCP path

1. Inspect the form with `get_page_structure` or `find_elements`.
2. Fill the name and email through `fill_input`, preferring their placeholders or stable selectors.
3. Use `verify_form_state` before submission.
4. Submit through the visible form control.
5. Read the rendered result and event log, then capture a screenshot.

Scope every call to project `debug-electron-mcp-demo` and the exact target ID.

## Proof

Require both submitted values in the rendered confirmation and the form-submission event in the log. Validate and inspect the PNG.

## Reset

Clear both fields or restart the demo before another exact-value proof.

## Gotchas

Input mutation alone is insufficient; the feature ends at the rendered submission result.
