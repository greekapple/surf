# Work block while the user is in class (2026-11-04, about 80 min)
Status: **APPROVED** (user: "make a spec to finish any other work we need to, or continue to fix the wave where you see fit"). The lead runs it autonomously. Report when the user is back.

## Standing rules
- Every merge goes through the gate: tsc, tests, build, journeys, the relevant toolkit checks, the lead's own look. Then port to swello-v0.17 and push.
- Production deploys are approved (`npm run deploy`, private site). Deploy only after a merge passes the gate.
- **Restore point:** tag `3d-before-skeleton`. Any 3D round that isn't visibly better than R11 stays on its branch.
- **Data honesty:** no number or label changes without the data-honesty review.
- **Third-party footage and frames** stay in the scratchpad. The vault gets skeleton-only images, links and numbers.
- **Beginner clips** are reserved for small waves and beginner tuning (user), not for the main progression.

## 1. The wave and the surfer (top priority)
- **Fable R12, running:**
  - clipping (head in the thrown lip, hands and knees in the face), with the bodyclip gate at 0 in 18 cells;
  - the crest's "weird little curvature" (required);
  - smoother backside arms and movement;
  - the barrel.
  - When it hands off: cross-check the strips against the real sequences and the default view. Merge and deploy if better, otherwise keep R11.
- **Skeleton library (lead):**
  - finish the rescan of the 10 intermediate-to-pro clips;
  - pick each clip's surfing sections and capture them densely at 8–10 fps;
  - trace them with RTMPose;
  - make stick-figure GIFs, contact sheets and joint-angle tables per move.
- **Vault:** a skeleton reference note in `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/References/`, with stick figures and angle tables only, plus the source links.
- **Fable R13 spec,** written from the skeletons: per move, the target joint-angle ranges and timing curves (frontside and backside trim, bottom turn, top turn and snap, cutback, barrel, pop-up). Fable matches its keys and blends to them, with the fluidity metrics the user asked for. R13 starts after R12 is merged.

## 2. Small open items (engineering and product, in parallel)
- **T-132 (product):** on phones, the spot hero's long photo credit overlaps the subtitle.
- **T-133 (engineering):** find and fix the intermittent t043-map failure.
- **T-131 (engineering drafts, lead approves):** for the 14 spots where v1 and MOP differ by more than 1 ft, draft a sourced profile review (facing, window, shelter from public guides, with citations). No number changes until the lead and the data-honesty review approve.

## 3. Report when the user is back
- What merged and deployed, with before/after images.
- The skeleton note's link and the R13 spec.
- What's still running, and anything that needs the user.
