# Per-response-rule host squad visibility

Response rule modifications accept an optional boolean:

```json
{
  "ignoreHostInternalSquadRestrictions": true
}
```

When enabled, the matched rule ignores host-level internal squad visibility
(`internalSquads.mode` and its squad list). It applies to every user matching that
rule, regardless of response format. Enable it only on the intended client rule,
for example **Mihomo Clients**.

This does **not** grant inbound access. A user must still belong to an internal
squad that authorizes the host inbound. Disabled hosts, format exclusions,
response-rule tag exclusions and format-specific protocol support remain in
force. The existing `isHidden` behavior is unchanged.

Omitted or false preserves existing behavior. Other response rules and internal
host queries retain squad visibility filtering. No database migration is needed.

For a restricted squad to receive additional nodes only in Mihomo:

1. Grant the squad the required inbound access.
2. Keep the additional hosts hidden from that squad using host visibility lists.
3. Enable this modification on the Mihomo response rule only.

Xray output keeps its existing squad visibility filtering. This controls
subscription visibility, not the client software a user can run with manually
copied connection credentials.

The API schema includes the new field and its editor description. A separately
built frontend with an embedded older contract may not offer autocomplete for it;
it does not require a new visual control to send the JSON property.

Validate with Node.js 24 (the version used by the backend image):

```sh
npm run test:host-squad-visibility
```

The tests execute the actual repository query against an in-memory SQLite
fixture and exercise schema validation and middleware opt-in isolation. They do
not connect to a production database or change user memberships.
