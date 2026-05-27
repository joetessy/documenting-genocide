export interface AboutModalHandle {
  open(): void;
  close(): void;
}

const SOURCES = [
  {
    name: 'Airwars',
    url: 'https://airwars.org',
    description:
      'Independent incident-by-incident documentation of civilian harm from airstrikes and shelling, ' +
      'with multi-paragraph narratives and casualty estimates. Records assessed for credibility (Fair, Weak, Contested).',
    license: 'Used with attribution per Airwars’ published terms for non-commercial research and educational use.',
    contribution: 'Primary incident layer for narrative depth (1,590 plotted records).',
  },
  {
    name: 'Aid Worker Security Database',
    url: 'https://www.aidworkersecurity.org/',
    description:
      "Per-incident records of attacks on aid workers worldwide, maintained by Humanitarian Outcomes. " +
      "Each Gaza record includes date, coordinates, casualty counts (killed/wounded/kidnapped/detained), " +
      "attack means, and a narrative summary.",
    license:
      'Free for non-commercial research with citation: "Humanitarian Outcomes (year), Aid Worker Security Database, aidworkersecurity.org".',
    contribution:
      'Hundreds of Gaza aid-worker incidents, surfacing a category that other sources tend to underreport.',
  },
  {
    name: 'UCDP Georeferenced Event Dataset v25.1',
    url: 'https://ucdp.uu.se/downloads/',
    description:
      'Uppsala Conflict Data Program’s peer-reviewed dataset of organized armed-conflict events, ' +
      'with geographic coordinates, dates, and fatality estimates. Coverage through 2024.',
    license: 'Open for research and educational use with attribution.',
    contribution: 'Adds 3,676 Gaza events to broaden the incident coverage beyond Airwars’ catalogue.',
  },
  {
    name: 'OCHA UNOSAT Comprehensive Damage Assessment (11 October 2025)',
    url: 'https://data.humdata.org/dataset/unosat-gaza-strip-comprehensive-damage-assessment-11-october-2025',
    description:
      'UN Satellite Centre’s building-by-building damage classification across the Gaza Strip, derived from ' +
      'high-resolution satellite imagery across 14 sensor passes. Each building is classified as destroyed, ' +
      'severely damaged, moderately damaged, or possibly damaged.',
    license: 'CC BY-IGO 3.0 — attribution to UNOSAT · OCHA.',
    contribution: '196,141 damage features form the geographic backdrop; click any dot for the per-building assessment history.',
  },
  {
    name: 'Centre for Information Resilience — Israel-Gaza Conflict Map',
    url: 'https://www.info-res.org/israel-gaza-war/maps/israel-gaza-conflict-map/',
    description:
      "CIR's verified-incident database, built through open-source intelligence and rigorous source corroboration. " +
      'Each record includes one or more public source links (often social media posts or news coverage) ' +
      'and a categorization across damage, casualties, and other harm types.',
    license:
      'Used with explicit written permission from CIR (2026). Attribution: "Centre for Information Resilience" on first mention, "CIR" afterwards.',
    contribution:
      "2,255 features verified by CIR's OSINT team add substantial breadth to the incident layer, particularly for events with social-media evidence trails.",
  },
  {
    name: 'Geoconfirmed',
    url: 'https://geoconfirmed.org/',
    description:
      "Volunteer-run OSINT verification platform. Each record represents a single geolocated, time-stamped " +
      "incident from the Israel-Gaza-Lebanon theater, sourced from social-media posts and corroborated by community " +
      "verifiers. Bellingcat sources their Gaza Damage Proxy Map's incident pins from this dataset.",
    license:
      'Free for research, journalism, and analytical use per Geoconfirmed\'s public API terms; attribution requested.',
    contribution:
      "Substantial OSINT-verified incident layer covering events not captured by Airwars or UCDP, particularly " +
      "skirmishes, hostage-related locations, and infrastructure attacks.",
  },
  {
    name: 'Wikidata + Wikipedia',
    url: 'https://www.wikidata.org/wiki/Q122962941',
    description:
      "Structured records of major Gaza-war events from Wikidata (CC0), enriched with lead-paragraph descriptions " +
      "from the corresponding Wikipedia articles. Covers historically significant moments like the Al-Ahli Hospital " +
      "explosion, the Flour Massacre at Nabulsi roundabout, and the World Central Kitchen convoy strike.",
    license:
      'Wikidata content is CC0; Wikipedia text is CC BY-SA 4.0 with attribution to "Wikipedia contributors".',
    contribution:
      "Marquee incidents with Wikipedia-grade narratives — adds depth to the most internationally-reported moments.",
  },
  {
    name: 'HOT/OpenStreetMap (Palestine) — health & education facilities',
    url: 'https://data.humdata.org/dataset/hotosm_pse_health_facilities',
    description:
      'Humanitarian OpenStreetMap Team’s extracted points of interest for Palestine, derived from the global ' +
      'OpenStreetMap database. Includes hospitals, clinics, pharmacies, schools, kindergartens, colleges, and universities.',
    license: 'Open Database License (ODbL) — attribution to OpenStreetMap contributors via the Humanitarian Data Exchange.',
    contribution: '571 health + 215 education facilities in Gaza, surfaced as a toggleable reference overlay.',
  },
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export function mountAboutModal(parent: HTMLElement): AboutModalHandle {
  const backdrop = document.createElement('div');
  backdrop.id = 'about-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const modal = document.createElement('div');
  modal.id = 'about-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'about-title');

  const sourcesHtml = SOURCES.map((s) => `
    <article class="about-source">
      <h3 class="about-source-name">
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}</a>
      </h3>
      <p class="about-source-desc">${escapeHtml(s.description)}</p>
      <p class="about-source-meta"><strong>License:</strong> ${escapeHtml(s.license)}</p>
      <p class="about-source-meta"><strong>In this exhibit:</strong> ${escapeHtml(s.contribution)}</p>
    </article>
  `).join('');

  modal.innerHTML = `
    <button class="about-close" aria-label="Close about panel">✕</button>
    <div class="about-body">
      <h2 id="about-title">About this exhibit</h2>

      <section class="about-section">
        <p>
          This is an interactive geographic record of the war on Gaza since October 7, 2023. Every marker on
          the map is backed by a verifiable source. The exhibit is independent, non-commercial, and educational —
          built by a single developer over the course of the war. No ads, no paywall, no resale of data.
        </p>
        <p>
          Visitors scrub the timeline to watch incidents and structural damage accumulate day by day, or click
          the play button to let the timeline advance automatically. Each marker opens a side panel with date,
          location, casualties, and source citations.
        </p>
      </section>

      <section class="about-section">
        <h2>Data sources</h2>
        <p class="about-section-intro">
          Every record displayed is fetched from one of the following public datasets and integrated at
          build time. Sources are listed in alphabetical order; each carries its own license and attribution.
        </p>
        ${sourcesHtml}
      </section>

      <section class="about-section">
        <h2>Methodology</h2>
        <ul>
          <li><strong>Geographic filter:</strong> only records within the Gaza Strip bounding box (lat 31.20–31.60, lon 34.20–34.60) are plotted.</li>
          <li><strong>Time window:</strong> only records dated October 7, 2023 onwards are included. Pre-war records are filtered out at build time.</li>
          <li><strong>Deduplication:</strong> records from multiple sources are merged when they share a date and location within ≈55 meters (3 decimal places of lat/lon). The longest description is kept; the maximum casualty estimate across sources is used; every source’s URL is preserved.</li>
          <li><strong>Damage assessment:</strong> UNOSAT building records use the first-damage date from their 14-pass progression. Status colors range from deep red (destroyed) through medium grey (possibly damaged).</li>
          <li><strong>Reference layers:</strong> health and education facilities are static — they do not flow with the timeline. They mark what existed in OSM’s most recent monthly snapshot.</li>
        </ul>
      </section>

      <section class="about-section">
        <h2>Limitations</h2>
        <p>
          This exhibit shows what has been documented and geolocated by the sources above. Many incidents
          are not represented, either because no source verified them, no source published coordinates, or
          the source’s licensing prohibits direct map display. The absence of a marker is not evidence
          that nothing happened.
        </p>
      </section>
    </div>
  `;

  parent.appendChild(backdrop);
  parent.appendChild(modal);

  function close(): void {
    backdrop.classList.remove('is-open');
    modal.classList.remove('is-open');
  }

  function open(): void {
    backdrop.classList.add('is-open');
    modal.classList.add('is-open');
  }

  backdrop.addEventListener('click', close);
  modal.querySelector('.about-close')?.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      close();
    }
  });

  return { open, close };
}
