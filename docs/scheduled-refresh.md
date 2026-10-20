# v0.11 operational boundary

The approved v0.10 Site was deployed after the historical stabilization notes below. v0.11 remains local and retains the same backend revision 0.10 / API contract 0.8. Current Site metadata shows the original single refresh schedule enabled (00:05/06:05/12:05/18:05 America/Los_Angeles). No new run, successful persistent readback, hosted freshness, scheduler change or v0.11 deployment was verified/performed during this work. An enabled schedule is not evidence of successful execution. No duplicate job was created.

---

# v0.10 local stabilization status

This section supersedes operational claims below for the current local release candidate. The existing automation and its schedule have not been modified. No hosted refresh, cloud cache/history write or deployment was authorized or performed during the resumed v0.10 stabilization pass. Scheduler execution, successful completion, persisted output and fresh provider data were **not reverified**. Earlier v0.9 notes are historical evidence only.

The full local build includes Worker revision 0.10 while retaining API contract version 0.8. `/api/diagnostics` is now a read-only endpoint. The Vite preview uses temporary memory and explicitly reports `persistent:false`; it does not prove hosted R2 persistence. Provider failures/cooldowns and Retry-After are handled by the service, so future scheduled runs must respect the returned retry windows rather than repeatedly invoke refresh. Compact schema-2 history references immutable retrieval snapshots; legacy history remains untouched. Retention still requires review.

The procedure below is for a future authorized hosted verification or existing scheduled run. Do not execute its POST step merely to inspect status, and do not include any token in source or exported files.

---

# Unattended SURF data refresh

Site project `appgprj_6ad2636508948191bfa3a9a7f22663e3`; preserve its owner-private audience. Scheduled work refreshes public ocean data, never rebuilds/deploys source and never reads user profiles/photos.

1. Read this linked Site's current metadata and source revision. Source instructions are `docs/scheduled-refresh.md`; adapter is `services/forecast-service.mjs`. Get the current deployed origin from Site metadata, not the Git remote.
2. Acquire the current Site service-access bearer through `get_site` (`siwc_bypass_bearer_token`) afresh for that Site. Keep it only in process memory; do not log or save it, include it in prompts, put it in a URL, or send it to an upstream provider. This is Sites dispatch authorization, not a signed-in visitor or permission for connected apps.
3. POST `{origin}/api/refresh` using `OAI-Sites-Authorization: Bearer <token>`. No body is required. This fixed-provider writer ingests Open-Meteo Marine/Weather, NOAA NDBC/CO-OPS, NOAA regional fields and CDIP SF023; it writes raw data/cache/status/history in the Site's BUCKET. Allow up to 120 seconds. It rejects GET and cross-origin browser writes. Existing fresh records may be reused per provider TTL.
4. With the same service authorization GET `{origin}/api/health`. Require version `0.8`, `persistent:true`, and `refresh.attemptedAt` equal to the POST report. Check each returned provider status and original retrievedAt. This readback verifies the durable shared status. A successful HTTP status alone does not prove every provider refreshed.
5. On failure preserve previous successful records and timestamps; never replace with demo data, shift forecast times or claim a successful refresh. Report unavailable/stale providers. Honor 429 Retry-After; retry transient errors at most once after the cooldown if practical, otherwise leave them for the next run. Do not repeatedly fetch the whole dataset.

Cadence: every six hours in America/Los_Angeles. On-demand point forecasts have 30-minute service TTL, station observations ten minutes and regional grids/tides six hours. A schedule saved/enabled is distinct from a verified successful run. A platform task executes these instructions; Worker CPU timers are not an unattended scheduler. Forecast history is append-only public provider data and needs a retention policy as usage grows. No claim of calibrated accuracy follows from archival.

Portability: a different host must provision R2 or adapt persistence, service authorization (optionally REFRESH_TOKEN on the server), and a cron HTTP caller. Never transfer Sites credentials to another host.
