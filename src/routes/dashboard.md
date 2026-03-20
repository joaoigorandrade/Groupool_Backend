# Dashboard Route

## Endpoint
- `GET /v1/dashboard`
- Authentication required via bearer token middleware
- Optional query param: `groupId` (UUID)

## Response Contract
Returns a single payload for Home dashboard hydration:
- `groups`: all groups where the authenticated user is an active member, including each group's members
- `balance`: `null` by default; when `groupId` is provided and the user is an active member of that group, returns a V1 stub with zeroed cents and status `ok`
- `profile`: derived from `buildProfileForUser` helper to keep profile composition consistent with `/v1/profile`
- `challenges`: empty array in V1

## Notes
- Group membership scope for `groups` and `balance` only includes records with `group_members.status = active`
- Unknown or unauthorized `groupId` values do not fail the request; they return `balance: null`
