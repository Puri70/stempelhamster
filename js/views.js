/**
 * MS-Stempelhamster - View-Rendering
 */
window.SH = window.SH || {};

SH.views = {
    /**
     * Heute-Screen aktualisieren
     */
    refreshToday: function() {
        var dateKey = SH.utils.today();
        var u = SH.utils;

        // Datum anzeigen
        document.getElementById('today-dayname').textContent = u.formatDateLong(dateKey).split(',')[0];
        document.getElementById('today-date').textContent = u.formatDateShort(dateKey);

        return Promise.all([
            SH.db.getOrCreateDay(dateKey),
            SH.db.getEntriesForDate(dateKey),
            SH.calculator.calculateDayTotals(dateKey),
            SH.calculator.calculateTotalBalance()
        ]).then(function(results) {
            var day = results[0];
            var entries = results[1];
            var totals = results[2];
            var totalBalance = results[3];

            // Tagestyp
            document.getElementById('today-daytype').value = day.dayType;

            // "Keine Pause heute" Button-Status
            var noPauseBtn = document.getElementById('btn-no-pause');
            if (day.noPauseToday) {
                noPauseBtn.classList.add('no-pause-active');
                noPauseBtn.textContent = 'Keine Pause heute ✓';
            } else {
                noPauseBtn.classList.remove('no-pause-active');
                noPauseBtn.textContent = 'Keine Pause heute';
            }

            // Tageszusammenfassung
            document.getElementById('today-work').textContent = u.minutesToHHMM(totals.netWorkMinutes);
            document.getElementById('today-pause').textContent = u.minutesToHHMM(totals.pauseMinutes);
            document.getElementById('today-target').textContent = u.minutesToHHMM(totals.targetMinutes);

            var balanceEl = document.getElementById('today-balance');
            balanceEl.textContent = u.minutesToSigned(totals.balanceMinutes);
            balanceEl.className = 'day-summary-value ' + u.balanceClass(totals.balanceMinutes);

            var totalEl = document.getElementById('today-total-balance');
            totalEl.textContent = u.minutesToSigned(totalBalance);
            totalEl.className = 'total-balance-value ' + u.balanceClass(totalBalance);

            // Blöcke rendern
            SH.views._renderTodayBlocks(entries);
        });
    },

    /**
     * Heutige Blöcke rendern
     */
    _renderTodayBlocks: function(entries) {
        var list = document.getElementById('today-blocks');
        var u = SH.utils;

        if (entries.length === 0) {
            list.innerHTML = '<li class="block-item" style="color:var(--color-text-muted); justify-content:center;">Noch keine Einträge</li>';
            return;
        }

        var html = '';
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            var isRunning = e.endTime === null;
            var startStr = u.timeFromDate(e.startTime);
            var endStr = isRunning ? 'läuft...' : u.timeFromDate(e.endTime);
            var duration = isRunning
                ? Math.floor((Date.now() - e.startTime) / 60000)
                : (e.durationMinutes || 0);

            html += '<li class="block-item">' +
                '<div class="block-icon ' + e.type + '">' + (e.type === 'work' ? '&#128188;' : '&#9749;') + '</div>' +
                '<div class="block-info">' +
                    '<div class="block-times' + (isRunning ? ' block-running ' + e.type : '') + '">' +
                        startStr + ' – ' + endStr +
                    '</div>' +
                    '<div class="block-duration">' +
                        (e.type === 'work' ? 'Arbeit' : 'Pause') + ' · ' + u.minutesToHHMM(duration) +
                    '</div>' +
                '</div>' +
                '</li>';
        }

        list.innerHTML = html;
    },

    // === Wochenübersicht ===

    currentWeekMonday: null,

    initWeek: function() {
        SH.views.currentWeekMonday = SH.utils.getMonday(new Date());
        return SH.views.refreshWeek();
    },

    refreshWeek: function() {
        var monday = SH.views.currentWeekMonday;
        var mondayKey = SH.utils.dateToKey(monday);
        var u = SH.utils;

        // Titel: KW X (DD.MM. - DD.MM.)
        var sunday = u.addDays(monday, 6);
        var kw = u.getWeekNumber(monday);
        document.getElementById('week-title').textContent = 'KW ' + kw +
            ' (' + u.formatDateShort(monday).substring(0, 5) + ' – ' + u.formatDateShort(sunday).substring(0, 5) + ')';

        return SH.calculator.calculateWeekSummary(mondayKey).then(function(summary) {
            var body = document.getElementById('week-body');
            var todayKey = u.today();
            var html = '';

            for (var i = 0; i < summary.days.length; i++) {
                var d = summary.days[i];
                var isToday = d.date === todayKey;
                var rowClass = isToday ? ' class="today-row"' : '';

                html += '<tr' + rowClass + ' data-date="' + d.date + '" style="cursor:pointer;">' +
                    '<td>' + u.dayNameShort(d.date) + ' ' + u.formatDateShort(d.date).substring(0, 5) + '</td>' +
                    '<td><span class="daytype-badge daytype-' + d.day.dayType + '">' + u.dayTypeName(d.day.dayType).substring(0, 3) + '</span></td>' +
                    '<td>' + u.minutesToHHMM(d.totals.targetMinutes) + '</td>' +
                    '<td>' + u.minutesToHHMM(d.totals.netWorkMinutes) + '</td>' +
                    '<td>' + u.minutesToHHMM(d.totals.pauseMinutes) + '</td>' +
                    '<td class="' + u.balanceClass(d.totals.balanceMinutes) + '">' + u.minutesToSigned(d.totals.balanceMinutes) + '</td>' +
                    '</tr>';
            }

            // Summenzeile
            html += '<tr class="total-row">' +
                '<td colspan="2">Woche gesamt</td>' +
                '<td>' + u.minutesToHHMM(summary.totalTarget) + '</td>' +
                '<td>' + u.minutesToHHMM(summary.totalWork) + '</td>' +
                '<td>' + u.minutesToHHMM(summary.totalPause) + '</td>' +
                '<td class="' + u.balanceClass(summary.totalBalance) + '">' + u.minutesToSigned(summary.totalBalance) + '</td>' +
                '</tr>';

            body.innerHTML = html;

            // Zeilen klickbar machen für Korrektur
            body.querySelectorAll('tr[data-date]').forEach(function(row) {
                row.addEventListener('click', function() {
                    var date = this.dataset.date;
                    SH.navigation.showCorrection(date);
                });
            });

            // Gesamtsaldo
            return SH.calculator.calculateTotalBalance();
        }).then(function(totalBalance) {
            var el = document.getElementById('week-total-balance');
            el.textContent = SH.utils.minutesToSigned(totalBalance);
            el.className = 'total-balance-value ' + SH.utils.balanceClass(totalBalance);
        });
    },

    weekPrev: function() {
        SH.views.currentWeekMonday = SH.utils.addDays(SH.views.currentWeekMonday, -7);
        return SH.views.refreshWeek();
    },

    weekNext: function() {
        SH.views.currentWeekMonday = SH.utils.addDays(SH.views.currentWeekMonday, 7);
        return SH.views.refreshWeek();
    },

    // === Monatsübersicht ===

    currentMonth: null,
    currentYear: null,

    initMonth: function() {
        var now = new Date();
        SH.views.currentMonth = now.getMonth();
        SH.views.currentYear = now.getFullYear();
        return SH.views.refreshMonth();
    },

    refreshMonth: function() {
        var year = SH.views.currentYear;
        var month = SH.views.currentMonth;
        var u = SH.utils;

        var monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                          'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
        document.getElementById('month-title').textContent = monthNames[month] + ' ' + year;

        return SH.calculator.calculateMonthSummary(year, month).then(function(summary) {
            var body = document.getElementById('month-body');
            var todayKey = u.today();
            var html = '';

            for (var i = 0; i < summary.days.length; i++) {
                var d = summary.days[i];
                var isToday = d.date === todayKey;
                var rowClass = isToday ? ' class="today-row"' : '';

                html += '<tr' + rowClass + ' data-date="' + d.date + '" style="cursor:pointer;">' +
                    '<td>' + u.dayNameShort(d.date) + ' ' + d.date.substring(8) + '.</td>' +
                    '<td><span class="daytype-badge daytype-' + d.day.dayType + '">' + u.dayTypeName(d.day.dayType).substring(0, 3) + '</span></td>' +
                    '<td>' + u.minutesToHHMM(d.totals.targetMinutes) + '</td>' +
                    '<td>' + u.minutesToHHMM(d.totals.netWorkMinutes) + '</td>' +
                    '<td>' + u.minutesToHHMM(d.totals.pauseMinutes) + '</td>' +
                    '<td class="' + u.balanceClass(d.totals.balanceMinutes) + '">' + u.minutesToSigned(d.totals.balanceMinutes) + '</td>' +
                    '</tr>';
            }

            // Summenzeile
            html += '<tr class="total-row">' +
                '<td colspan="2">Monat gesamt</td>' +
                '<td>' + u.minutesToHHMM(summary.totalTarget) + '</td>' +
                '<td>' + u.minutesToHHMM(summary.totalWork) + '</td>' +
                '<td>' + u.minutesToHHMM(summary.totalPause) + '</td>' +
                '<td class="' + u.balanceClass(summary.totalBalance) + '">' + u.minutesToSigned(summary.totalBalance) + '</td>' +
                '</tr>';

            body.innerHTML = html;

            // Zeilen klickbar
            body.querySelectorAll('tr[data-date]').forEach(function(row) {
                row.addEventListener('click', function() {
                    SH.navigation.showCorrection(this.dataset.date);
                });
            });

            // Gesamtsaldo
            return SH.calculator.calculateTotalBalance();
        }).then(function(totalBalance) {
            var el = document.getElementById('month-total-balance');
            el.textContent = SH.utils.minutesToSigned(totalBalance);
            el.className = 'total-balance-value ' + SH.utils.balanceClass(totalBalance);
        });
    },

    monthPrev: function() {
        SH.views.currentMonth--;
        if (SH.views.currentMonth < 0) {
            SH.views.currentMonth = 11;
            SH.views.currentYear--;
        }
        return SH.views.refreshMonth();
    },

    monthNext: function() {
        SH.views.currentMonth++;
        if (SH.views.currentMonth > 11) {
            SH.views.currentMonth = 0;
            SH.views.currentYear++;
        }
        return SH.views.refreshMonth();
    },

    /**
     * Export-Screen initialisieren
     */
    initExport: function() {
        var now = new Date();
        var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        document.getElementById('export-from').value = SH.utils.dateToKey(firstOfMonth);
        document.getElementById('export-to').value = SH.utils.today();
    }
};
