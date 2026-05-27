const STORAGE_KEY = 'gaza-exhibit:onboarding-dismissed';

export interface OnboardingHandle {
  // Forced show — useful for a future "Show intro again" button if we add one.
  forceShow(): void;
  close(): void;
}

export function mountOnboarding(parent: HTMLElement): OnboardingHandle {
  // If localStorage already has the dismissal flag, do nothing — return a no-op handle.
  // Otherwise, append the overlay DOM.

  const dismissed = (() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  })();

  const backdrop = document.createElement('div');
  backdrop.id = 'onboarding-backdrop';

  const card = document.createElement('div');
  card.id = 'onboarding-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'onboarding-title');

  card.innerHTML = `
    <h2 id="onboarding-title">A geographic record of the Genocide on Gaza</h2>
    <p class="onboarding-lede">
      You're looking at <strong>8,000+ documented incidents</strong> and <strong>196,000+ damaged buildings</strong>
      across the Gaza Strip since October 7, 2023. Every marker is sourced from open public datasets — Airwars, UCDP,
      OCHA UNOSAT, Centre for Information Resilience, Geoconfirmed, Aid Worker Security Database, and Wikidata.
    </p>
    <ul class="onboarding-tips">
      <li><strong>Press play</strong> to watch the war unfold day by day, or scrub the timeline manually.</li>
      <li><strong>Click any dot</strong> to open the incident detail with verifiable sources.</li>
      <li><strong>Click "Tour"</strong> on the scrubber for a guided walkthrough of major events.</li>
      <li><strong>Hover the red ticks</strong> on the timeline for major-moment context (Al-Ahli, Flour Massacre, etc.).</li>
    </ul>
    <button class="onboarding-dismiss" type="button">Start exploring</button>
  `;

  parent.appendChild(backdrop);
  parent.appendChild(card);

  function close(): void {
    backdrop.classList.remove('is-open');
    card.classList.remove('is-open');
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* no localStorage available, just close */ }
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
