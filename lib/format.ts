export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatRelativeDue(value: string | null | undefined, now = new Date()): string {
  if (!value) {
    return 'Not scheduled';
  }

  const due = new Date(value).getTime();
  const diff = due - now.getTime();
  const absMinutes = Math.round(Math.abs(diff) / 60000);

  if (absMinutes < 1) {
    return 'Due now';
  }

  if (absMinutes < 60) {
    return diff <= 0 ? `${absMinutes}m overdue` : `Due in ${absMinutes}m`;
  }

  const absHours = Math.round(absMinutes / 60);

  if (absHours < 48) {
    return diff <= 0 ? `${absHours}h overdue` : `Due in ${absHours}h`;
  }

  const absDays = Math.round(absHours / 24);
  return diff <= 0 ? `${absDays}d overdue` : `Due in ${absDays}d`;
}
