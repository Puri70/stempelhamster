/**
 * MS-Stempelhamster - Export (CSV + PDF)
 */
window.SH = window.SH || {};

SH.export = {
    /**
     * Daten für Export sammeln
     */
    _gatherData: function(fromDate, toDate) {
        return SH.db.getDaysInRange(fromDate, toDate).then(function(days) {
            // Auch Tage ohne Einträge im Bereich ergänzen
            var allDates = [];
            var current = new Date(fromDate + 'T00:00:00');
            var end = new Date(toDate + 'T00:00:00');

            while (current <= end) {
                allDates.push(SH.utils.dateToKey(current));
                current.setDate(current.getDate() + 1);
            }

            var dayMap = {};
            for (var i = 0; i < days.length; i++) {
                dayMap[days[i].date] = days[i];
            }

            var promises = allDates.map(function(dateKey) {
                return SH.calculator.calculateDayTotals(dateKey).then(function(totals) {
                    var day = dayMap[dateKey];
                    return {
                        date: dateKey,
                        dayType: day ? day.dayType : (SH.utils.isWeekend(dateKey) ? 'weekend' : 'workday'),
                        targetMinutes: totals.targetMinutes,
                        workMinutes: totals.workMinutes,
                        pauseMinutes: totals.pauseMinutes,
                        netWorkMinutes: totals.netWorkMinutes,
                        balanceMinutes: totals.balanceMinutes
                    };
                });
            });

            return Promise.all(promises);
        }).then(function(rows) {
            // Gesamtsaldo hinzurechnen
            return SH.db.getSetting('startingBalance').then(function(startBal) {
                var running = startBal || 0;
                for (var i = 0; i < rows.length; i++) {
                    running += rows[i].balanceMinutes;
                    rows[i].runningBalance = running;
                }
                return rows;
            });
        });
    },

    /**
     * CSV-Export
     */
    exportCSV: function(fromDate, toDate) {
        return SH.export._gatherData(fromDate, toDate).then(function(rows) {
            var u = SH.utils;
            var lines = [];

            // Header
            lines.push('Datum;Wochentag;Tagesart;Soll;Arbeitszeit brutto;Pause;Arbeitszeit netto;Tagesdifferenz;Gesamtsaldo');

            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                lines.push([
                    u.formatDateShort(r.date),
                    u.dayNameShort(r.date),
                    u.dayTypeName(r.dayType),
                    u.minutesToHHMM(r.targetMinutes),
                    u.minutesToHHMM(r.workMinutes),
                    u.minutesToHHMM(r.pauseMinutes),
                    u.minutesToHHMM(r.netWorkMinutes),
                    u.minutesToSigned(r.balanceMinutes),
                    u.minutesToSigned(r.runningBalance)
                ].join(';'));
            }

            var csv = '\ufeff' + lines.join('\r\n'); // BOM für Excel
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            SH.export._download(blob, 'Stempelhamster_' + fromDate + '_bis_' + toDate + '.csv');
        });
    },

    /**
     * PDF-Export
     */
    exportPDF: function(fromDate, toDate) {
        return SH.export._gatherData(fromDate, toDate).then(function(rows) {
            var u = SH.utils;
            var doc = new jspdf.jsPDF('landscape', 'mm', 'a4');

            // Titel
            doc.setFontSize(16);
            doc.text('MS-Stempelhamster - Zeitübersicht', 14, 15);
            doc.setFontSize(10);
            doc.text('Zeitraum: ' + u.formatDateShort(fromDate) + ' bis ' + u.formatDateShort(toDate), 14, 22);

            // Tabelle
            var tableRows = rows.map(function(r) {
                return [
                    u.formatDateShort(r.date),
                    u.dayNameShort(r.date),
                    u.dayTypeName(r.dayType),
                    u.minutesToHHMM(r.targetMinutes),
                    u.minutesToHHMM(r.workMinutes),
                    u.minutesToHHMM(r.pauseMinutes),
                    u.minutesToHHMM(r.netWorkMinutes),
                    u.minutesToSigned(r.balanceMinutes),
                    u.minutesToSigned(r.runningBalance)
                ];
            });

            // Summenzeile
            var totalTarget = 0, totalWork = 0, totalPause = 0, totalNet = 0, totalBal = 0;
            for (var i = 0; i < rows.length; i++) {
                totalTarget += rows[i].targetMinutes;
                totalWork += rows[i].workMinutes;
                totalPause += rows[i].pauseMinutes;
                totalNet += rows[i].netWorkMinutes;
                totalBal += rows[i].balanceMinutes;
            }

            tableRows.push([
                'SUMME', '', '',
                u.minutesToHHMM(totalTarget),
                u.minutesToHHMM(totalWork),
                u.minutesToHHMM(totalPause),
                u.minutesToHHMM(totalNet),
                u.minutesToSigned(totalBal),
                rows.length > 0 ? u.minutesToSigned(rows[rows.length - 1].runningBalance) : '00:00'
            ]);

            doc.autoTable({
                startY: 28,
                head: [['Datum', 'Tag', 'Typ', 'Soll', 'Brutto', 'Pause', 'Netto', '+/-', 'Saldo']],
                body: tableRows,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [37, 99, 235] },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                didParseCell: function(data) {
                    // Letzte Zeile (Summe) fett
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [219, 234, 254];
                    }
                }
            });

            // Footer
            var pageCount = doc.internal.getNumberOfPages();
            for (var p = 1; p <= pageCount; p++) {
                doc.setPage(p);
                doc.setFontSize(8);
                doc.text('MS-Stempelhamster - Erstellt am ' + u.formatDateShort(new Date()),
                    14, doc.internal.pageSize.height - 10);
                doc.text('Seite ' + p + ' von ' + pageCount,
                    doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
            }

            doc.save('Stempelhamster_' + fromDate + '_bis_' + toDate + '.pdf');
        });
    },

    /**
     * Datei-Download auslösen
     */
    _download: function(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
