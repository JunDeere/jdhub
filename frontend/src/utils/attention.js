import { formatLocalDate, formatLocalDateTime, isPastLocal, isTodayLocal } from './dateTime.js';

export function buildAttentionItems(dashboard) {
  if (!dashboard) return [];

  const items = [];

  dashboard.dueTasks?.forEach((task) => {
    if (!task.due_date) return;
    const overdue = isPastLocal(task.due_date) && !isTodayLocal(task.due_date);
    const today = isTodayLocal(task.due_date);

    if (!overdue && !today) return;

    items.push({
      id: `task-due-${task._id}`,
      type: overdue ? 'overdue-task' : 'task-due-today',
      title: task.title,
      detail: overdue
        ? `Task overdue since ${formatLocalDate(task.due_date)}.`
        : `Task due today, ${formatLocalDate(task.due_date)}.`,
      action: 'Open Tasks',
      page: 'tasks',
    });
  });

  dashboard.upcomingSchedule?.forEach((item) => {
    if (!isTodayLocal(item.start_at)) return;

    items.push({
      id: `schedule-today-${item._id}`,
      type: 'schedule-today',
      title: item.title,
      detail: `Scheduled today at ${formatLocalDateTime(item.start_at)}.`,
      action: 'Open Scheduling',
      page: 'scheduling',
    });
  });

  dashboard.upcomingReminders?.forEach((reminder) => {
    const dueNow = isPastLocal(reminder.remind_at) || isTodayLocal(reminder.remind_at);

    if (!dueNow) return;

    items.push({
      id: `reminder-${reminder._id}`,
      type: 'explicit-reminder',
      title: reminder.title,
      detail: `Reminder due ${formatLocalDateTime(reminder.remind_at)}.`,
      action: 'Review Reminder',
      page: 'dashboard',
    });
  });

  return items;
}
