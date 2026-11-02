# Meta App Review runbook

Everything Meta asks for, mapped to what this codebase actually sends. The scopes
and webhook fields below are asserted by `packages/meta/src/review.test.ts`, so a
change in code that is not reflected here fails the suite.

## 1. Create the app

1. <https://developers.facebook.com/apps> → **Create app** → type **Business**.
2. Add the products **Facebook Login for Business** and **Webhooks**.
3. Add your own Page under **App roles → Roles**, as an admin, so it can be used in
   development.

## 2. Server environment

| Variable             | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| `META_APP_ID`        | App ID from App settings → Basic                       |
| `META_APP_SECRET`    | App secret from App settings → Basic                   |
| `META_VERIFY_TOKEN`  | Any long random string; must match the Webhooks config |
| `META_GRAPH_VERSION` | `v23.0`                                                |
| `WEB_ORIGIN`         | The public https origin of the web app                 |
| `TOKEN_ENC_KEY`      | 32 bytes, hex or base64 (`openssl rand -hex 32`)       |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32`                                 |

## 3. Login settings

- **Valid OAuth Redirect URIs**: `<WEB_ORIGIN>/pages`
- **App domains**: the web host
- The web app loads the JS SDK with the app id it reads from
  `GET /api/pages/login-config`, and requests exactly the scopes in the table below.

## 4. Webhooks

- **Callback URL**: `https://<api-host>/webhooks/meta`
- **Verify token**: the same `META_VERIFY_TOKEN`
- `GET` answers the challenge, `POST` verifies `X-Hub-Signature-256` against the raw
  body before anything is stored.
- **Subscribe to Page fields** (sent to `POST /{page-id}/subscribed_apps` when a Page
  is connected):

| Field                 | Why it is needed                                          |
| --------------------- | --------------------------------------------------------- |
| `messages`            | Inbound Messenger messages                                |
| `messaging_postbacks` | Button taps that start a conversation                     |
| `message_echoes`      | A message the seller sent by hand, so the bot stands down |
| `feed`                | New post comments                                         |

## 5. Permissions to submit

| Scope                     | What it is used for                                          | What to show in the screencast                        |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| `pages_show_list`         | Listing the Pages the seller administers in the connect step | Connect a Page and show the picker                    |
| `pages_messaging`         | Sending the bot reply and the private comment reply          | Message the Page, get an automatic answer             |
| `pages_read_engagement`   | Reading the Page profile and its posts for ingestion         | Press Sync now and show products extracted            |
| `pages_manage_metadata`   | Subscribing the app to the Page's webhooks                   | Show the chat still answering after a reload          |
| `pages_read_user_content` | Reading comments on the Page's posts                         | Comment on a post and show it in Comments             |
| `pages_manage_engagement` | Posting the optional public comment reply                    | Show a comment answered publicly as well as privately |

## 6. Screencast script

Record the seller's view, in one continuous take:

1. Sign up, then Pages → Connect a Page → approve the permission screen showing every
   scope in the table.
2. Pick the Page. The app fetches the profile and the last six months of posts.
3. Open Products, approve a draft extracted from a post.
4. Open Playground, ask a price question in Banglish, show the answer and the sources.
5. From a second account, message the Page. The bot answers within a few seconds and
   shows the typing indicator.
6. Message something not in the catalogue. The Inbox shows a draft, the conversation
   is marked human, and answering by hand flips `is_echo` so the bot stays quiet.
7. Comment on a post. A private reply arrives and a public line appears on the comment.
8. Open Comments and show the complaint that was flagged instead of answered.

## 7. Required URLs

| Meta field                     | Value                              |
| ------------------------------ | ---------------------------------- |
| Privacy policy URL             | `<WEB_ORIGIN>/privacy`             |
| Data deletion instructions URL | `<WEB_ORIGIN>/data-deletion`       |
| Data deletion callback URL     | `https://<api-host>/data-deletion` |

`POST /data-deletion` verifies the `signed_request` HMAC, then returns
`{ url, confirmation_code }`. Because the seller's Facebook id is never stored, the
callback cannot delete on its own: the returned page asks the seller to sign in and
use **Billing → Delete my account**, which removes the account and everything that
cascades from it.

## 8. Test credentials

Create a seller account in the app and put its email and password in the **App
Review → Test users** notes, together with the URL of the deployed app. The reviewer
must be able to sign in, see a connected Page, and message it. Add the reviewer's Page
role as a tester while the app is in development mode.

## 9. Development-mode limits

Until review passes, only accounts with a role on the app can connect a Page. Every
other seller who tries gets `That Page is not available to the account you signed in
with`, which is the `404` raised by `connectPage` in `apps/api/src/services/pages.ts`.

## 10. Verification checklist

- [ ] `GET /webhooks/meta` returns the challenge with the right token and `403` with a wrong one
- [ ] `POST /webhooks/meta` rejects a bad signature with `401`
- [ ] `POST /data-deletion` with a valid signed request returns a URL and a code
- [ ] `<WEB_ORIGIN>/privacy` and `<WEB_ORIGIN>/data-deletion` load while signed out
- [ ] A Page connects, subscribes, and receives a real message
- [ ] The bot answers, and hands off when it does not know
- [ ] A comment gets a private reply and, in `private_public` mode, a public one
- [ ] `bun run eval` reports a pass rate for the golden set
