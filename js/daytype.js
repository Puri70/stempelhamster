/**
 * MS-Stempelhamster - Tagestyp-Logik
 */
window.SH = window.SH || {};

SH.daytype = {
    /**
     * Standard-Tagestyp basierend auf Wochentag
     */
    getDefaultDayType: function(dateKey) {
        return SH.utils.isWeekend(dateKey) ? 'weekend' : 'workday';
    },

    /**
     * Tagestyp setzen
     */
    setDayType: function(dateKey, type) {
        return SH.db.getOrCreateDay(dateKey).then(function(day) {
            day.dayType = type;
            return SH.db.saveDay(day);
        });
    },

    /**
     * Sollminuten für einen bestimmten Tag ermitteln
     */
    getTargetMinutesForDate: function(dateKey) {
        return Promise.all([
            SH.db.getDay(dateKey),
            SH.db.getSetting('targetHours')
        ]).then(function(results) {
            var day = results[0];
            var targetHours = results[1] || { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0 };
            var dayType = day ? day.dayType : SH.daytype.getDefaultDayType(dateKey);

            // Bei besonderen Tagesarten: Sollzeit 0
            if (dayType === 'vacation' || dayType === 'sick' || dayType === 'holiday' || dayType === 'free') {
                return 0;
            }

            // Wochenende: Standard 0, aber individuelle Sollzeit möglich
            if (dayType === 'weekend') {
                if (day && day.targetMinutes > 0) return day.targetMinutes;
                return 0;
            }

            // Wenn individuell gesetzt, das verwenden
            if (day && day.targetMinutes > 0) {
                return day.targetMinutes;
            }

            // Standard-Sollzeit nach Wochentag
            var d = new Date(dateKey + 'T00:00:00');
            var dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            var key = dayMap[d.getDay()];
            return targetHours[key] || 0;
        });
    },

    /**
     * Prüft ob ein Tagestyp die Tagesdifferenz auf 0 setzt
     */
    isNeutralDayType: function(dayType) {
        return dayType === 'vacation' || dayType === 'sick' || dayType === 'holiday' || dayType === 'free';
    }
};
