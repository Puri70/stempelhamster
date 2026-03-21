/**
 * MS-Stempelhamster - Hilfsfunktionen
 */
window.SH = window.SH || {};

SH.utils = {
    /**
     * Minuten in HH:MM Format umwandeln
     * Beispiel: 495 -> "08:15", -135 -> "-02:15"
     */
    minutesToHHMM: function(minutes) {
        var negative = minutes < 0;
        var abs = Math.abs(minutes);
        var h = Math.floor(abs / 60);
        var m = abs % 60;
        var str = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        return negative ? '-' + str : str;
    },

    /**
     * Minuten in HH:MM mit Vorzeichen
     * Beispiel: 495 -> "+08:15", -135 -> "-02:15", 0 -> "00:00"
     */
    minutesToSigned: function(minutes) {
        if (minutes === 0) return '00:00';
        var str = SH.utils.minutesToHHMM(minutes);
        return minutes > 0 ? '+' + str : str;
    },

    /**
     * HH:MM String in Minuten umwandeln
     * Beispiel: "08:15" -> 495, "-02:15" -> -135, "+12:30" -> 750
     */
    hhmmToMinutes: function(str) {
        if (!str || typeof str !== 'string') return 0;
        str = str.trim();
        var negative = str.charAt(0) === '-';
        var clean = str.replace(/^[+-]/, '');
        var parts = clean.split(':');
        if (parts.length !== 2) return 0;
        var h = parseInt(parts[0], 10) || 0;
        var m = parseInt(parts[1], 10) || 0;
        var total = h * 60 + m;
        return negative ? -total : total;
    },

    /**
     * Uhrzeit als HH:MM aus einem Date-Objekt
     */
    timeFromDate: function(date) {
        if (!date) return '--:--';
        var d = new Date(date);
        var h = d.getHours();
        var m = d.getMinutes();
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    },

    /**
     * Datum als YYYY-MM-DD String (für DB-Keys)
     */
    dateToKey: function(date) {
        var d = date instanceof Date ? date : new Date(date);
        var y = d.getFullYear();
        var m = d.getMonth() + 1;
        var day = d.getDate();
        return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    },

    /**
     * Datum formatiert auf Deutsch
     * Beispiel: "Freitag, 21. März 2026"
     */
    formatDateLong: function(date) {
        var d = date instanceof Date ? date : new Date(date + 'T00:00:00');
        var days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        var months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        return days[d.getDay()] + ', ' + d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();
    },

    /**
     * Kurzes Datumsformat
     * Beispiel: "21.03.2026"
     */
    formatDateShort: function(date) {
        var d = date instanceof Date ? date : new Date(date + 'T00:00:00');
        var day = d.getDate();
        var m = d.getMonth() + 1;
        var y = d.getFullYear();
        return (day < 10 ? '0' : '') + day + '.' + (m < 10 ? '0' : '') + m + '.' + y;
    },

    /**
     * Kurzname des Wochentags
     */
    dayNameShort: function(date) {
        var d = date instanceof Date ? date : new Date(date + 'T00:00:00');
        var names = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        return names[d.getDay()];
    },

    /**
     * Wochentag als Zahl (0=So, 1=Mo, ... 6=Sa)
     */
    getDayOfWeek: function(date) {
        var d = date instanceof Date ? date : new Date(date + 'T00:00:00');
        return d.getDay();
    },

    /**
     * Montag der Woche ermitteln, die das gegebene Datum enthält
     */
    getMonday: function(date) {
        var d = date instanceof Date ? new Date(date) : new Date(date + 'T00:00:00');
        var day = d.getDay();
        var diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return d;
    },

    /**
     * Datum um n Tage verschieben
     */
    addDays: function(date, days) {
        var d = date instanceof Date ? new Date(date) : new Date(date + 'T00:00:00');
        d.setDate(d.getDate() + days);
        return d;
    },

    /**
     * Heute als YYYY-MM-DD
     */
    today: function() {
        return SH.utils.dateToKey(new Date());
    },

    /**
     * Prüft ob zwei Datumskeys gleich sind
     */
    isSameDay: function(key1, key2) {
        return key1 === key2;
    },

    /**
     * Prüft ob ein Datum Wochenende ist (Sa oder So)
     */
    isWeekend: function(date) {
        var d = date instanceof Date ? date : new Date(date + 'T00:00:00');
        var day = d.getDay();
        return day === 0 || day === 6;
    },

    /**
     * Kalenderwoche nach ISO 8601
     */
    getWeekNumber: function(date) {
        var d = date instanceof Date ? new Date(date) : new Date(date + 'T00:00:00');
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        var week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    },

    /**
     * Tage in einem Monat
     */
    daysInMonth: function(year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    /**
     * Dauer zwischen zwei Timestamps in Minuten (abgerundet)
     */
    durationMinutes: function(startTime, endTime) {
        if (!startTime || !endTime) return 0;
        return Math.floor((endTime - startTime) / 60000);
    },

    /**
     * Toast-Nachricht anzeigen
     */
    showToast: function(message, type) {
        type = type || 'info';
        var existing = document.querySelector('.toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, 3000);
    },

    /**
     * Tagestyp-Name auf Deutsch
     */
    dayTypeName: function(type) {
        var names = {
            'workday': 'Arbeitstag',
            'vacation': 'Urlaub',
            'sick': 'Krankheit',
            'holiday': 'Feiertag',
            'free': 'Frei / Ausgleich',
            'weekend': 'Wochenende'
        };
        return names[type] || type;
    },

    /**
     * CSS-Klasse für Saldo-Wert (positiv/negativ/neutral)
     */
    balanceClass: function(minutes) {
        if (minutes > 0) return 'value-positive';
        if (minutes < 0) return 'value-negative';
        return 'value-neutral';
    },

    /**
     * Erstellt ein Date-Objekt aus Datumskey und Uhrzeitstring
     * Beispiel: dateFromKeyAndTime("2026-03-21", "08:30") -> Date
     */
    dateFromKeyAndTime: function(dateKey, timeStr) {
        var parts = timeStr.split(':');
        var d = new Date(dateKey + 'T00:00:00');
        d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
        return d;
    }
};
