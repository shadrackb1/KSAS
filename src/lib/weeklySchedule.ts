/**
 * src/lib/weeklySchedule.ts
 * Utilities for semester-based weekly schedule management.
 */

export interface WeeklyScheduleEntry {
  week: number;
  topic: string;
  title: string;
}

/**
 * Calculate the current week number based on semester start date.
 * Returns 1-based week number, or null if semester hasn't started.
 */
export function getCurrentWeek(semesterStart: string): number | null {
  if (!semesterStart) return null;
  const start = new Date(semesterStart);
  const now = new Date();
  if (isNaN(start.getTime())) return null;
  if (now < start) return null;
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Generate empty weekly schedule template for a given number of weeks.
 */
export function generateEmptySchedule(weeks: number = 16): WeeklyScheduleEntry[] {
  return Array.from({ length: weeks }, (_, i) => ({
    week: i + 1,
    topic: '',
    title: `Week ${i + 1}`,
  }));
}

/**
 * Get the topic for a specific week from a schedule.
 * Returns empty string if not found.
 */
export function getTopicForWeek(
  schedule: WeeklyScheduleEntry[],
  weekNumber: number
): string {
  const entry = schedule.find((s) => s.week === weekNumber);
  return entry?.topic || '';
}

/**
 * Parse a plain-text outline (one topic per line) into WeeklyScheduleEntry[].
 * Handles formats like "Week 1: Topic" or just "Topic".
 */
export function parseOutlineToSchedule(outline: string[]): WeeklyScheduleEntry[] {
  return outline.map((line, idx) => {
    const weekMatch = line.match(/^Week\s+(\d+)\s*[:\-]?\s*(.*)/i);
    if (weekMatch) {
      return {
        week: parseInt(weekMatch[1], 10),
        topic: weekMatch[2].trim(),
        title: `Week ${weekMatch[1]}`,
      };
    }
    return {
      week: idx + 1,
      topic: line.trim(),
      title: `Week ${idx + 1}`,
    };
  });
}
