// Saudi and Islamic Holidays Data
// Format: { month: 0-11, day: 1-31, name: 'Holiday Name' }
// Note: Islamic dates change every year. These are approximations for 2026.

export const HOLIDAYS = [
    // Saudi Fixed Holidays
    { month: 1, day: 22, name: 'يوم التأسيس 🇸🇦' }, // Feb 22
    { month: 8, day: 23, name: 'اليوم الوطني 🇸🇦' }, // Sep 23

    // Approximate Islamic Holidays for 2026
    { month: 1, day: 18, name: 'بداية رمضان 🌙' }, // ~Feb 18
    { month: 2, day: 20, name: 'عيد الفطر 🌙' },   // ~Mar 20
    { month: 4, day: 27, name: 'عيد الأضحى 🌙' },  // ~May 27
    { month: 5, day: 17, name: 'رأس السنة الهجرية 🌙' }, // ~Jun 17
    { month: 7, day: 26, name: 'المولد النبوي 🌙' }, // ~Aug 26
];

export function getHoliday(year, month, day) {
    // Only check month and day for simple recurring ones
    // For more accuracy, a real API or better logic is needed for Hijri
    return HOLIDAYS.find(h => h.month === month && h.day === day);
}
