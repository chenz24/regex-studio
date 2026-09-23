/** Topic relationships shared by reading pages and their sitemap revisions. */
export const challengeLessons: Record<string, readonly string[]> = {
  'email-find': ['practical-email', 'basics-classes', 'basics-quantifiers'],
  'https-url': ['practical-url', 'basics-anchors', 'groups-named-and-noncapturing'],
  ipv4: ['quantifiers-counted', 'basics-dot-and-escapes'],
  'hex-color': ['groups-alternation', 'quantifiers-counted', 'basics-classes'],
  'iso-date': ['groups-named-and-noncapturing', 'quantifiers-counted', 'practical-log'],
  'strong-password': ['lookaround-lookahead', 'lookaround-negative-lookahead'],
  'phone-na': ['groups-alternation', 'groups-named-and-noncapturing', 'basics-literals'],
  'slug-url': ['basics-anchors', 'basics-quantifiers', 'quantifiers-backtracking'],
  'extract-md-link': [
    'practical-markdown-link',
    'quantifiers-lazy',
    'groups-capturing',
    'quantifiers-greedy',
  ],
  'css-class': ['basics-classes', 'basics-literals'],
  'uuid-v4': ['quantifiers-counted', 'basics-anchors'],
};

export function relatedChallengeIds(lessonId: string): string[] {
  return Object.entries(challengeLessons)
    .filter(([, lessons]) => lessons.includes(lessonId))
    .map(([id]) => id);
}

export function similarChallengeIds(challengeId: string): string[] {
  const lessons = challengeLessons[challengeId] ?? [];
  return Object.entries(challengeLessons)
    .filter(([id, topics]) => id !== challengeId && topics.some((topic) => lessons.includes(topic)))
    .map(([id]) => id);
}
