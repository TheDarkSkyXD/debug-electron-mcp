# Form input and submission

Form input and submission let an MCP user fill labeled demo fields, submit the form through its unique selector, and read the values rendered back by the app.

## Sub-features

- `form-placeholder-fill` fills name and email by placeholder.
- `form-selector-fill` fills number and textarea controls by selector.
- `form-submit` clicks the actual form submit control despite duplicate visible text.
- `form-result` renders the submitted values and records an event-log entry.

## How to get to it (user POV)

- Use `fill_input` with the visible placeholders in the Form Inputs section.
- Choose the form's `Submit Form` button.
- Read the success box under the form.

## Driving it with verify-debug-electron-mcp

Preconditions:

- Doctor is healthy for `$verifyRunId`.
- No earlier recipe has replaced the form fields with conflicting values.

- **Fill name.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"fill_input","args":{"placeholder":"Enter your name","value":"Verification User"}}' --evidence form-name.json`.
- **Fill email.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"fill_input","args":{"placeholder":"Enter your email","value":"verify@example.com"}}' --evidence form-email.json`.
- **Fill age.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"fill_input","args":{"selector":"[data-testid=\"age-input\"]","value":"42"}}' --evidence form-age.json`.
- **Submit the real form.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"click_by_selector","args":{"selector":"[data-testid=\"form-submit\"]"}}' --evidence form-submit.json`.
- **Read submitted values.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs call --run-id $verifyRunId --tool send_command_to_electron --arguments '{"command":"eval","args":{"code":"document.getElementById(\"form-result\")?.textContent"}}' --evidence form-result.json`. The text contains `Form Submitted Successfully`, `Verification User`, `verify@example.com`, and `42`.
- **Capture proof.** Run `node .agents/skills/verify-debug-electron-mcp/scripts/verify.mjs screenshot --run-id $verifyRunId --name form-submitted.png`.

## Gotchas

- Visible text `Submit Form` is duplicated. `click_by_text` can hit the Basic Actions button.
- The email input uses browser validation. Use a syntactically valid email when proving submission.
- Filled values alone do not prove submit handling. Read `#form-result` after the click.
- Form state persists only for the current Electron instance and disappears during cleanup.
