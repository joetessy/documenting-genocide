const STORAGE_KEY = 'gaza-exhibit:onboarding-dismissed';

export interface OnboardingHandle {
  // Forced show — useful for a future "Show intro again" button if we add one.
  forceShow(): void;
  close(): void;
}

export function mountOnboarding(parent: HTMLElement): OnboardingHandle {
  // Show once per session: the dismissal flag lives in sessionStorage, so a
  // fresh visit (new tab / new session) sees the intro again, but refreshes
  // and in-session navigation don't re-nag. (A prior version used localStorage,
  // which suppressed it forever; clear that stale key so returning visitors
  // get the once-per-session behavior.)
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }

  const dismissed = (() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  })();

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';

  const card = document.createElement('div');
  card.id = 'onboarding-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'onboarding-title');

  card.innerHTML = `
    <h2 id="onboarding-title">A geographic record documenting the Genocide on Gaza</h2>
    <p class="onboarding-lede">
      You're looking at <strong>8,000+ documented incidents</strong> and <strong>196,000+ damaged buildings</strong>
      across the Gaza Strip since October 7, 2023. Every marker is sourced from open public datasets — Airwars, UCDP,
      OCHA UNOSAT, Centre for Information Resilience, Geoconfirmed, Aid Worker Security Database, and Wikidata.
    </p>
    <div class="onboarding-howto">Ways to explore</div>
    <ul class="onboarding-tips">
      <li><strong>Take the guided path</strong> — click <em>Guided path</em> (bottom-left) for a narrated fly-through of the major events.</li>
      <li><strong>Watch it day by day</strong> — press <em>play</em> on the timeline to let the genocide unfold chronologically.</li>
      <li><strong>Scrub manually</strong> — drag the timeline to jump to any date yourself.</li>
      <li><strong>Zoom &amp; pan</strong> — scroll to zoom, drag to move, Ctrl-drag to tilt; explore any neighborhood up close.</li>
      <li><strong>Click any marker</strong> — open a detail panel with sourced figures (hover the red timeline ticks for major-moment context).</li>
    </ul>
    <button class="onboarding-dismiss" type="button">Start exploring</button>
  `;

  parent.appendChild(backdrop);
  parent.appendChild(card);

  function close(): void {
    backdrop.classList.remove('is-open');
    card.classList.remove('is-open');
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* no sessionStorage available, just close */ }
  }

  function open(): void {
    backdrop.classList.add('is-open');
    card.classList.add('is-open');
  }

  backdrop.addEventListener('click', close);
  card.querySelector('.onboarding-dismiss')?.addEventListener('click', close);
  // ESC also closes
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && card.classList.contains('is-open')) close();
  });

  if (!dismissed) {
    // Brief delay so the overlay doesn't pop the very instant the page paints — feels more natural after the map appears
    setTimeout(open, 600);
  }

  return {
    forceShow: open,
    close,
  };
}
