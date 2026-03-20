# Profile Routes

## Overview

`/v1/profile` in V1 is derived from `group_members` because there is no dedicated users table yet.

## Endpoints

- `GET /v1/profile`: Builds a profile from the authenticated user phone (`request.user.userId`) and their `group_members` records.
- `PATCH /v1/profile`: Updates `displayName` for all `group_members` records tied to the authenticated user and returns the updated profile.
- `GET /v1/profile/pix-keys`: Returns the authenticated phone as the available PIX key (`{ keys: [phone] }`).

## Field Mapping

- `id`: authenticated phone number
- `phoneNumber`: authenticated phone number
- `displayName`: from an active `group_members` row if available, otherwise the first membership row
- `avatarURL`: `null` in V1
- `reputation`: `0` in V1
- `reliabilityPercent`: `100` in V1
- `observerMode`: `true` when membership is not active owner; otherwise `false`
- `status`: from selected `group_members` row

## No Membership Fallback

If the authenticated phone has no `group_members` records, profile still resolves with defaults to keep response shape stable:

- `displayName`: empty string
- `status`: `invited`
- `observerMode`: `true`
