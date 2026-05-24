// Curated list of major moments in the war on Gaza since Oct 7, 2023.
// These render as small markers on the scrubber's histogram. Click jumps
// the scrubber to that date. Keep the list short (12-15 events) — too
// many makes the histogram noisy and undermines the "major moments" framing.
//
// Sources for these dates are widely covered by major outlets; we use
// the date the event began (or the date most commonly cited) rather
// than the date it was first reported.

export interface TimelineEvent {
  date: string;       // ISO YYYY-MM-DD
  title: string;      // Short, factual phrasing
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  { date: '2023-10-07', title: 'Hamas-led attack on Israel' },
  { date: '2023-10-17', title: 'Al-Ahli Arab Hospital explosion' },
  { date: '2023-10-27', title: 'Israeli ground invasion begins' },
  { date: '2023-11-15', title: 'Al-Shifa Hospital raid begins' },
  { date: '2023-11-24', title: 'First humanitarian pause begins' },
  { date: '2024-02-29', title: 'Flour Massacre at Nabulsi roundabout' },
  { date: '2024-04-01', title: 'World Central Kitchen convoy strike' },
  { date: '2024-05-06', title: 'Rafah ground offensive begins' },
  { date: '2024-05-26', title: 'Al-Mawasi tent camp strike' },
  { date: '2024-08-10', title: 'Al-Tabaeen school strike' },
  { date: '2024-10-16', title: 'Yahya Sinwar killed' },
  { date: '2025-01-19', title: 'Ceasefire Phase 1 begins' },
  { date: '2025-03-18', title: 'Israel resumes Gaza operations' },
  { date: '2025-05-19', title: "Operation Gideon's Chariots launched" },
];
