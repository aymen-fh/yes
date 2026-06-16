import { getCustomerDomainModels } from "../../utils/roleModels.js";

const startOfDay = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const AR_DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const toDailyUsageDto = (entry) => ({
  id: entry._id?.toString?.() ?? entry.id,
  date: entry.date,
  dayLabel: AR_DAY_LABELS[new Date(entry.date).getDay()],
  usageGb: entry.usageGb ?? 0,
});

class UsageService {
  static async getLastDaysUsage(subscriptionId, days = 7) {
    const { UsageDaily } = getCustomerDomainModels();
    const end = startOfDay(new Date());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const rows = await UsageDaily.find({
      subscriptionId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    const byDay = new Map(
      rows.map((row) => [startOfDay(row.date).toISOString(), row])
    );

    const result = [];
    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + offset);
      const key = startOfDay(day).toISOString();
      const row = byDay.get(key);

      result.push(
        toDailyUsageDto(
          row || {
            date: day,
            usageGb: 0,
          }
        )
      );
    }

    return result;
  }
}

export default UsageService;
