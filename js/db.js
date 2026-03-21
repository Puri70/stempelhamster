/**
 * MS-Stempelhamster - Datenbank-Modul (Dexie.js)
 */
window.SH = window.SH || {};

(function() {
    var db = new Dexie('StempelhamsterDB');

    db.version(1).stores({
        entries: '++id, date, [date+type]',
        days: 'date',
        settings: 'key'
    });

    SH.db = {
        _db: db,

        // === Einstellungen ===
        getSetting: function(key) {
            return db.settings.get(key).then(function(row) {
                return row ? row.value : null;
            });
        },

        setSetting: function(key, value) {
            return db.settings.put({ key: key, value: value });
        },

        // === Einträge (Arbeits-/Pausenblöcke) ===
        addEntry: function(entry) {
            return db.entries.add(entry);
        },

        updateEntry: function(id, changes) {
            return db.entries.update(id, changes);
        },

        deleteEntry: function(id) {
            return db.entries.delete(id);
        },

        getEntry: function(id) {
            return db.entries.get(id);
        },

        getEntriesForDate: function(date) {
            return db.entries.where('date').equals(date).sortBy('startTime');
        },

        getWorkEntriesForDate: function(date) {
            return db.entries.where('[date+type]').equals([date, 'work']).sortBy('startTime');
        },

        getPauseEntriesForDate: function(date) {
            return db.entries.where('[date+type]').equals([date, 'pause']).sortBy('startTime');
        },

        /**
         * Findet einen laufenden Eintrag (endTime === null)
         */
        getActiveEntry: function() {
            return db.entries.filter(function(e) {
                return e.endTime === null;
            }).first();
        },

        // === Tage ===
        getDay: function(date) {
            return db.days.get(date);
        },

        saveDay: function(dayData) {
            return db.days.put(dayData);
        },

        getDaysInRange: function(fromDate, toDate) {
            return db.days.where('date').between(fromDate, toDate, true, true).sortBy('date');
        },

        getAllDays: function() {
            return db.days.orderBy('date').toArray();
        },

        /**
         * Holt oder erstellt einen Tagesdatensatz
         */
        getOrCreateDay: function(date) {
            return db.days.get(date).then(function(day) {
                if (day) return day;
                var isWE = SH.utils.isWeekend(date);
                var newDay = {
                    date: date,
                    dayType: isWE ? 'weekend' : 'workday',
                    targetMinutes: 0, // wird von calculator gesetzt
                    actualWorkMinutes: 0,
                    pauseMinutes: 0,
                    standardPauseApplied: false,
                    noPauseToday: false,
                    balanceMinutes: 0,
                    isLocked: false
                };
                return db.days.put(newDay).then(function() {
                    return newDay;
                });
            });
        },

        // === Backup ===
        exportAll: function() {
            return Promise.all([
                db.entries.toArray(),
                db.days.toArray(),
                db.settings.toArray()
            ]).then(function(results) {
                return {
                    version: 1,
                    exportDate: new Date().toISOString(),
                    entries: results[0],
                    days: results[1],
                    settings: results[2]
                };
            });
        },

        importAll: function(data) {
            return db.transaction('rw', db.entries, db.days, db.settings, function() {
                return Promise.all([
                    db.entries.clear(),
                    db.days.clear(),
                    db.settings.clear()
                ]).then(function() {
                    var promises = [];
                    if (data.entries && data.entries.length) {
                        promises.push(db.entries.bulkAdd(data.entries));
                    }
                    if (data.days && data.days.length) {
                        promises.push(db.days.bulkAdd(data.days));
                    }
                    if (data.settings && data.settings.length) {
                        promises.push(db.settings.bulkAdd(data.settings));
                    }
                    return Promise.all(promises);
                });
            });
        }
    };
})();
