**Findings**
- [P2] Browser-rendered interaction evidence is unavailable.
  Location: Korean notification settings, `HUD 표시 항목`.
  Evidence: the production build served `http://127.0.0.1:3010/ko/settings/notifications` with HTTP 200, but the Codex in-app Browser first attached to the earlier stopped port and then blocked navigation away from its generated error page under Browser Use URL policy. No implementation screenshot or drag interaction capture could be produced.
  Impact: automated visual fidelity and pointer drag verification cannot be signed off even though unit tests, typecheck, and production build pass.
  Fix: repeat the same-page capture and drag-save check in a fresh browser session that can open the running localhost URL.

**Open Questions**
- None about the requested interaction contract. Selected cards are intentionally shown first in saved HUD order; unchecked cards remain available afterward.

**Implementation Checklist**
- Render selected HUD cards first in their persisted order.
- Add a visible drag handle to every selected HUD card.
- Support native pointer drag and arrow-key reordering.
- Preserve the reordered `selectedWidgets` array through the existing local preference save API.
- Re-run browser drag, save, reload, and HUD order verification when browser access is available.

**Follow-up Polish**
- Consider touch-specific pointer reordering if the settings page becomes a mobile-supported surface.

source visual truth path: `C:\Users\chunjae\AppData\Local\Temp\codex-clipboard-1ef2fa03-826e-4725-9103-90a6dc098216.png`
implementation screenshot path: unavailable because Browser Use blocked the localhost navigation after an initial connection failure
viewport: source image `1174x501`; implementation viewport unavailable
source and implementation pixel dimensions: source `1174x501`; implementation unavailable; CSS size and density normalization unavailable
state: Korean notification settings with five selected HUD items; implementation expected to show selected cards first with drag handles
full-view comparison evidence: source image opened at original detail; production route returned HTTP 200, but no browser-rendered implementation capture was available
focused region comparison evidence: source `HUD 표시 항목` grid and live HUD order were inspected; implementation region comparison was blocked
primary interactions tested: reorder helpers and persisted order contract by unit test; browser drag/save/reload interaction blocked
console errors checked: unavailable because the in-app Browser could not attach to the running localhost page
comparison history: no visual iteration was possible; the first implementation capture attempt was blocked before comparison
final result: blocked
