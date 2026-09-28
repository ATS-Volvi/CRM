/**
 * Timeseries Aggregation & Gap-Filling Helper
 * Organizes events into day or week buckets with zero-filling to prevent gaps.
 */

export interface TimeseriesEvent {
  date: Date | string;
  type: "lead" | "opportunity" | "wonOrder";
}

export interface TimeseriesBucket {
  period: string; // ISO date string (YYYY-MM-DD)
  label: string;  // Formatted display label (e.g. "Sep 28" or "Sep 22 - Sep 28")
  leads: number;
  opportunities: number;
  wonOrders: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toIsoDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUtcDate(d: Date | string): Date {
  const raw = typeof d === "string" ? new Date(d) : d;
  if (isNaN(raw.getTime())) {
    return new Date(Date.UTC(1970, 0, 1));
  }
  return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
}

export function getStartOfWeekUtc(d: Date): Date {
  const dt = new Date(d.getTime());
  const day = dt.getUTCDay(); // 0 = Sunday, 1 = Monday
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}

function formatBucketLabel(d: Date, granularity: "day" | "week"): string {
  const monthStr = MONTH_NAMES[d.getUTCMonth()];
  const dayNum = d.getUTCDate();

  if (granularity === "day") {
    return `${monthStr} ${dayNum}`;
  } else {
    const endOfWeek = new Date(d.getTime());
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    const endMonthStr = MONTH_NAMES[endOfWeek.getUTCMonth()];
    const endDayNum = endOfWeek.getUTCDate();
    if (monthStr === endMonthStr) {
      return `${monthStr} ${dayNum} - ${endDayNum}`;
    }
    return `${monthStr} ${dayNum} - ${endMonthStr} ${endDayNum}`;
  }
}

/**
 * Groups events into continuous chronological buckets (day or week) without gaps.
 */
export function fillTimeseriesGaps(
  events: TimeseriesEvent[],
  granularity: "day" | "week" = "day",
  startDateRange?: Date | string | null,
  endDateRange?: Date | string | null
): TimeseriesBucket[] {
  const validEvents = (events || []).filter(
    (e) => e && e.date && !isNaN(new Date(e.date).getTime())
  );

  const eventDates = validEvents.map((e) => parseUtcDate(e.date));

  // Determine bounds
  let minDate: Date;
  let maxDate: Date;

  const nowUtc = parseUtcDate(new Date());

  if (startDateRange && !isNaN(new Date(startDateRange).getTime())) {
    minDate = parseUtcDate(startDateRange);
  } else if (eventDates.length > 0) {
    minDate = new Date(Math.min(...eventDates.map((d) => d.getTime())));
  } else {
    // Default to last 14 days
    minDate = new Date(nowUtc.getTime() - 13 * 24 * 60 * 60 * 1000);
  }

  if (endDateRange && !isNaN(new Date(endDateRange).getTime())) {
    maxDate = parseUtcDate(endDateRange);
  } else if (eventDates.length > 0) {
    const maxEventDate = new Date(Math.max(...eventDates.map((d) => d.getTime())));
    maxDate = maxEventDate.getTime() > nowUtc.getTime() ? maxEventDate : nowUtc;
  } else {
    maxDate = nowUtc;
  }

  // Include all event dates within range
  if (eventDates.length > 0) {
    const earliestEvent = new Date(Math.min(...eventDates.map((d) => d.getTime())));
    const latestEvent = new Date(Math.max(...eventDates.map((d) => d.getTime())));
    if (earliestEvent.getTime() < minDate.getTime()) minDate = earliestEvent;
    if (latestEvent.getTime() > maxDate.getTime()) maxDate = latestEvent;
  }

  if (minDate.getTime() > maxDate.getTime()) {
    minDate = new Date(maxDate.getTime());
  }

  if (granularity === "week") {
    minDate = getStartOfWeekUtc(minDate);
    maxDate = getStartOfWeekUtc(maxDate);
  }

  // Generate zero-filled buckets
  const bucketMap = new Map<string, TimeseriesBucket>();
  const current = new Date(minDate.getTime());

  // Cap safety at 1000 buckets to prevent infinite loops on corrupted dates
  let safetyLimit = 0;
  while (current.getTime() <= maxDate.getTime() && safetyLimit < 1000) {
    safetyLimit++;
    const periodKey = toIsoDate(current);
    bucketMap.set(periodKey, {
      period: periodKey,
      label: formatBucketLabel(current, granularity),
      leads: 0,
      opportunities: 0,
      wonOrders: 0
    });

    if (granularity === "day") {
      current.setUTCDate(current.getUTCDate() + 1);
    } else {
      current.setUTCDate(current.getUTCDate() + 7);
    }
  }

  // Aggregate events into buckets
  for (const event of validEvents) {
    const eventDate = parseUtcDate(event.date);
    const bucketDate = granularity === "day" ? eventDate : getStartOfWeekUtc(eventDate);
    const bucketKey = toIsoDate(bucketDate);

    let bucket = bucketMap.get(bucketKey);
    if (!bucket) {
      // If outside initially constructed map (e.g. boundary rounding), add it
      bucket = {
        period: bucketKey,
        label: formatBucketLabel(bucketDate, granularity),
        leads: 0,
        opportunities: 0,
        wonOrders: 0
      };
      bucketMap.set(bucketKey, bucket);
    }

    if (event.type === "lead") {
      bucket.leads += 1;
    } else if (event.type === "opportunity") {
      bucket.opportunities += 1;
    } else if (event.type === "wonOrder") {
      bucket.wonOrders += 1;
    }
  }

  // Return sorted array of buckets
  return Array.from(bucketMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}
