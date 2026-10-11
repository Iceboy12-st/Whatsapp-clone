# PLAN

## Schema note (read first)

The brief lists `chats`, `chat_members` and `message_reactions` as existing tables. **This repository's
schema (`supabase/migrations/20261011115037_create_whatsapp_schema.sql`) actually uses `conversations` and
`conversation_participants`**, and has no `message_reactions` table or RPCs. Everything is built against the
schema that is really in the repo. The new migrations:

- create `create_direct_chat(other uuid)` and `create_group_chat(_name text, member_ids uuid[])` with the
  requested signatures (`CREATE OR REPLACE`), on top of `conversations`.
- create `message_reactions` with `CREATE TABLE IF NOT EXISTS` and add the columns the app needs.
- create the `avatars` / `chat-media` buckets with `ON CONFLICT DO NOTHING`.

## What existed

| Area | State before |
| --- | --- |
| Stack | Vite + React 18 + TS + Tailwind 3 + Supabase. No Zustand installed, no router. |
| Auth | Email/password sign-in/up, sign-out, profile load. No Google, no profile setup. |
| Chat list | Built client-side by downloading **every message** of every chat. No pin/mute/archive. |
| RLS | `conversation_participants` SELECT policy queried itself (infinite recursion). Users could insert themselves into any conversation. New-chat flow inserted the other user's membership (blocked by RLS). |
| Messaging | Text only, no pagination, no optimistic UI, delete only. |
| Everything else | Missing: media, voice, reactions, replies, edit, star, forward, groups management, presence, typing, receipts, status, calls, search, contact info, block/report, settings, theme, wallpaper, notifications, shortcuts. |

## What was built

Migrations (run in order, see README):

1. `001_core_schema_fixes.sql` - member settings (role, pin, mute, archive, favourite, clear, hide), profile privacy columns, non-recursive RLS helpers, closed self-join hole, role guard.
2. `002_message_features.sql` - media/reply/forward/edit/delete-for-everyone columns, reactions, delete-for-me, stars, `message_reads`, `blocked_users` (enforced on insert), `reports`.
3. `003_rpcs.sql` - `create_direct_chat`, `create_group_chat`, `add_group_members`, `remove_group_member`, `set_group_admin`, `leave_group`, `get_chat_summaries`, `mark_conversation_read`, `mark_delivered`, group change system messages.
4. `004_statuses.sql` - `statuses`, `status_views`, contacts-only visibility, 24 h expiry.
5. `005_storage.sql` - buckets + storage policies (chat media is private, signed URLs).
6. `006_realtime.sql` - realtime publication + replica identity.

Frontend - see `src/`:

- [x] Exact WhatsApp Web look: icon rail, 30% list panel, doodle wallpaper, light/dark tokens from the brief, bubble tails, ticks, edited label, hover chevrons, filter chips, skeletons, toasts, thin scrollbars, mobile two-screen layout.
- [x] Auth: email/password + Google OAuth, auth gate, profile setup (name, photo, about), logout.
- [x] Chats: summary RPC, unread badge, pin, mute, archive, favourite, mark unread, sorted by latest, user search -> `create_direct_chat`, realtime.
- [x] Messaging: optimistic send + retry, 50-message pages, date separators, links, Enter / Shift+Enter, auto-scroll, scroll-to-bottom button with unread count, read on open.
- [x] Message actions: reply, forward, copy, edit, delete for me / everyone, star + Starred view, reactions, message info, multi-select.
- [x] Media: image / video / document with caption preview, upload progress, lightbox, doc cards, voice notes (timer, cancel, send, waveform, 1x/1.5x/2x), emoji picker.
- [x] Groups: create, info panel, admins, add/remove, make/dismiss admin, leave, edit name/icon/description, coloured sender names.
- [x] Presence (Supabase Presence), last seen, typing (Broadcast), receipts via `message_reads`, privacy toggles.
- [x] Status: text + image, rings, viewer with progress bars, view counts, expiry.
- [x] Calls: voice/video call screen, clearly labelled as a UI simulation.
- [x] Search: chats + messages across chats, in-chat search with highlights and next/previous.
- [x] Contact info: about, media/links/docs tabs, starred, block (enforced), report, clear chat, delete chat.
- [x] Settings: profile, privacy, notifications (Notification API when tab hidden), wallpaper, theme (light/dark/system, persisted), keyboard shortcuts.

## Simplified (working, but not identical to WhatsApp)

- **Communities**: WhatsApp's communities need a separate hierarchy. The Communities tab lists your groups and lets you create a new one.
- **Calls**: UI simulation only (local camera preview for video if allowed). No audio or video is sent.
- **Last seen / online privacy**: enforced by the client (the profile row is readable by signed-in users). A strict server-side version would need a view that hides `last_seen`.
- **Status images** are in `chat-media/status/{user}/` and any signed-in user who knows the random path can read them. Listing statuses is still restricted by RLS to contacts.
- **Search jump**: a message search result opens the chat with in-chat search pre-filled. Older pages are loaded as you step through matches.
- **Expired statuses** are hidden by RLS. They are only deleted if you enable the optional pg_cron job in `004`.
- **Delivered ticks** are recorded when the recipient has the app open (`mark_delivered`). There are no push notifications when the app is closed.
- **Preferences** (theme, wallpaper, notification toggles) are saved in this browser's localStorage. They're UI settings, not chat data.

## Not verified in this environment

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not set in the v0 sandbox and the migrations have not been run,
so the two-account end-to-end test still has to be run against your Supabase project. The production build and type check pass.
