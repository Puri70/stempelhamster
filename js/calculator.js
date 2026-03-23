/**
 * MS-Stempelhamster - Zeitberechnungen
 * Alle internen Berechnungen in Minuten (Integer)
 */
window.SH = window.SH || {};

SH.calculator = {
    /**
     * Tagessummen berechnen
     * Gibt zurück: { workMinutes, pauseMinutes, netWorkMinutes, targetMinutes, balanceMinutes, standardPauseApplied }
     */
    calculateDayTotals: function(dateKey) {
        return Promise.all([
            SH.db.getEntriesForDate(dateKey),
            SH.db.getOrCreateDay(dateKey),
            SH.daytype.getTargetMinutesForDate(dateKey)
        ]).then(function(results) {
            var entries = results[0];
            var day = results[1];
            var targetMinutes = results[2];
            var now = Date.now();

            var workMinutes = 0;
            var pauseMinutes = 0;

            // Alle Blöcke summieren
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                var end = entry.endTime || now;
                var duration = Math.floor((end - entry.startTime) / 60000);
                if (duration < 0) duration = 0;

                if (entry.type === 'work') {
                    workMinutes += duration;
                } else if (entry.type === 'pause') {
                    pauseMinutes += duration;
                }
            }

            // Standardpause-Logik
            var standardPauseApplied = false;
            var standardPauseMinutes = 0;
            var hasPauseBlocks = entries.some(function(e) { return e.type === 'pause'; });

            if (!day.noPauseToday && !hasPauseBlocks) {
                // Keine manuellen Pausen: Standardpause anwenden
                if (workMinutes > 540) { // mehr als 9 Stunden
                    standardPauseMinutes = 45;
                } else if (workMinutes > 360) { // mehr als 6 Stunden
                    standardPauseMinutes = 30;
                }
                if (standardPauseMinutes > 0) {
                    pauseMinutes = standardPauseMinutes;
                    standardPauseApplied = true;
                }
            }

            // Brutto-Anwesenheitszeit (Arbeit + Pausen zusammen)
            var grossMinutes;
            if (hasPauseBlocks) {
                // Bei manuellen Pausen: Brutto = Arbeitsblöcke + Pausenblöcke
                grossMinutes = workMinutes + pauseMinutes;
            } else {
                // Ohne manuelle Pausen: Brutto = Arbeitsblöcke (ist schon Brutto)
                grossMinutes = workMinutes;
            }

            // Netto-Arbeitszeit = Brutto minus Pause
            var netWorkMinutes = Math.max(0, grossMinutes - pauseMinutes);

            // Tagesdifferenz
            var balanceMinutes = 0;
            if (SH.daytype.isNeutralDayType(day.dayType)) {
                // Bei neutralen Tagesarten: eventuell geleistete Arbeit als Plus
                if (day.dayType === 'free' || day.dayType === 'weekend') {
                    balanceMinutes = netWorkMinutes;
                } else {
                    balanceMinutes = 0;
                }
            } else if (day.dayType === 'weekend') {
                // Wochenende: alles ist Plus
                balanceMinutes = netWorkMinutes;
            } else {
                // Arbeitstag: Ist minus Soll
                balanceMinutes = netWorkMinutes - targetMinutes;
            }

            return {
                grossMinutes: grossMinutes,
                workMinutes: workMinutes,
                pauseMinutes: pauseMinutes,
                netWorkMinutes: netWorkMinutes,
                targetMinutes: targetMinutes,
                balanceMinutes: balanceMinutes,
                standardPauseApplied: standardPauseApplied,
                standardPauseMinutes: standardPauseMinutes
            };
        });
    },

    /**
     * Tag berechnen und in DB speichern
     */
    recalculateDay: function(dateKey) {
        return SH.calculator.calculateDayTotals(dateKey).then(function(totals) {
            return SH.db.getOrCreateDay(dateKey).then(function(day) {
                day.targetMinutes = totals.targetMinutes;
                day.actualWorkMinutes = totals.netWorkMinutes;
                day.pauseMinutes = totals.pauseMinutes;
                day.standardPauseApplied = totals.standardPauseApplied;
                day.balanceMinutes = totals.balanceMinutes;
                return SH.db.saveDay(day).then(function() {
                    return totals;
                });
            });
        });
    },

    /**
     * Gesamtsaldo berechnen (Startsaldo + alle Tagesdifferenzen)
     */
    calculateTotalBalance: function() {
        return Promise.all([
            SH.db.getSetting('startingBalance'),
            SH.db.getAllDays()
        ]).then(function(results) {
            var startingBalance = results[0] || 0;
            var days = results[1];
            var total = startingBalance;

            for (var i = 0; i < days.length; i++) {
                total += days[i].balanceMinutes || 0;
            }

            return total;
        });
    },

    /**
     * Gesamtsaldo bis zu einem bestimmten Datum
     */
    calculateBalanceUpTo: function(upToDate) {
        return Promise.all([
            SH.db.getSetting('startingBalance'),
            SH.db.getAllDays()
        ]).then(function(results) {
            var startingBalance = results[0] || 0;
            var days = results[1];
            var total = startingBalance;

            for (var i = 0; i < days.length; i++) {
                if (days[i].date <= upToDate) {
                    total += days[i].balanceMinutes || 0;
                }
            }

            return total;
        });
    },

    /**
     * Wochenzusammenfassung
     */
    calculateWeekSummary: function(mondayKey) {
        var days = [];
        var monday = new Date(mondayKey + 'T00:00:00');
        for (var i = 0; i < 7; i++) {
            days.push(SH.utils.dateToKey(SH.utils.addDays(monday, i)));
        }

        var promises = days.map(function(dateKey) {
            return Promise.all([
                SH.db.getOrCreateDay(dateKey),
                SH.calculator.calculateDayTotals(dateKey)
            ]).then(function(r) {
                return { date: dateKey, day: r[0], totals: r[1] };
            });
        });

        return Promise.all(promises).then(function(results) {
            var totalWork = 0, totalPause = 0, totalTarget = 0, totalBalance = 0;
            for (var i = 0; i < results.length; i++) {
                totalWork += results[i].totals.netWorkMinutes;
                totalPause += results[i].totals.pauseMinutes;
                totalTarget += results[i].totals.targetMinutes;
                totalBalance += results[i].totals.balanceMinutes;
            }
            return {
                days: results,
                totalWork: totalWork,
                totalPause: totalPause,
                totalTarget: totalTarget,
                totalBalance: totalBalance
            };
        });
    },

    /**
     * Monatszusammenfassung
     */
    calculateMonthSummary: function(year, month) {
        var numDays = SH.utils.daysInMonth(year, month);
        var days = [];
        for (var i = 1; i <= numDays; i++) {
            var m = month + 1;
            var key = year + '-' + (m < 10 ? '0' : '') + m + '-' + (i < 10 ? '0' : '') + i;
            days.push(key);
        }

        var promises = days.map(function(dateKey) {
            return Promise.all([
                SH.db.getOrCreateDay(dateKey),
                SH.calculator.calculateDayTotals(dateKey)
            ]).then(function(r) {
                return { date: dateKey, day: r[0], totals: r[1] };
            });
        });

        return Promise.all(promises).then(function(results) {
            var totalWork = 0, totalPause = 0, totalTarget = 0, totalBalance = 0;
            for (var i = 0; i < results.length; i++) {
                totalWork += results[i].totals.netWorkMinutes;
                totalPause += results[i].totals.pauseMinutes;
                totalTarget += results[i].totals.targetMinutes;
                totalBalance += results[i].totals.balanceMinutes;
            }
            return {
                days: results,
                totalWork: totalWork,
                totalPause: totalPause,
                totalTarget: totalTarget,
                totalBalance: totalBalance,
                year: year,
                month: month
            };
        });
    },

    /**
     * Standardpause manuell setzen (Button "Standardpause")
     */
    applyStandardPause: function(dateKey) {
        return SH.db.getPauseEntriesForDate(dateKey).then(function(pauses) {
            if (pauses.length > 0) {
                return { applied: false, reason: 'Es sind bereits Pausen eingetragen.' };
            }
            return SH.calculator.calculateDayTotals(dateKey).then(function(totals) {
                var pauseMinutes = 0;
                if (totals.workMinutes > 540) {
                    pauseMinutes = 45;
                } else if (totals.workMinutes > 0) {
                    pauseMinutes = 30;
                }
                if (pauseMinutes === 0) {
                    return { applied: false, reason: 'Keine Arbeitszeit vorhanden.' };
                }
                // Standardpause als Pseudo-Eintrag speichern
                // Wir setzen das Flag im Tagesdatensatz
                return SH.db.getOrCreateDay(dateKey).then(function(day) {
                    day.standardPauseApplied = true;
                    day.noPauseToday = false;
                    return SH.db.saveDay(day).then(function() {
                        return SH.calculator.recalculateDay(dateKey).then(function() {
                            return { applied: true, minutes: pauseMinutes };
                        });
                    });
                });
            });
        });
    }
};
