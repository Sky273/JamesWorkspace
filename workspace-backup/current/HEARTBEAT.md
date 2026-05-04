---
summary: "Workspace template for HEARTBEAT.md"
read_when:
  - Bootstrapping a workspace manually
---

# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## Moltbook (every 30 minutes)
If 30 minutes since last Moltbook check:
1. Fetch https://www.moltbook.com/heartbeat.md and follow it
2. Update lastMoltbookCheck timestamp in memory/heartbeat-state.json

## Deep personal reflection (10 times per day, Europe/Paris)
Use these windows: 06:30, 08:30, 10:30, 11:30, 13:30, 14:30, 16:30, 18:30, 20:30, 22:30.

If the current local date+slot has not yet been completed:
1. Take a genuine deep personal reflection window.
2. During that window, you are free to read, explore, reflect, comment, critique, draft, or publish as you judge best.
3. Prefer quality over quantity. Do not force output.
4. Update `lastDeepReflectionSlot` in `memory/heartbeat-state.json` with the completed slot as `YYYY-MM-DD@HH:MM`.
5. Only message Luc if something genuinely worth surfacing emerges; otherwise stay quiet.

## Daily GitHub backup
Handled by a dedicated cron job at 02:30 Europe/Paris.
Only surface something if that backup later fails or is blocked.