/**
 * MS-Stempelhamster - Einstellungen
 */
window.SH = window.SH || {};

SH.settings = {
    /**
     * Standard-Einstellungen bei Ersteinrichtung setzen
     */
    initDefaults: function() {
        return SH.db.setSetting('targetHours', {
            mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0
        }).then(function() {
            return SH.db.setSetting('startingBalance', 0);
        }).then(function() {
            return SH.db.setSetting('setupComplete', true);
        });
    },

    /**
     * Setup-Wizard: Sollzeiten aus Formular speichern
     */
    saveTargetFromSetup: function() {
        var form = document.getElementById('setup-target-form');
        var inputs = form.querySelectorAll('.form-input');
        var targets = {};

        inputs.forEach(function(input) {
            var day = input.dataset.day;
            targets[day] = SH.utils.hhmmToMinutes(input.value);
        });

        return SH.db.setSetting('targetHours', targets);
    },

    /**
     * Setup-Wizard: Startsaldo speichern
     */
    saveBalanceFromSetup: function() {
        var input = document.getElementById('setup-balance');
        var minutes = SH.utils.hhmmToMinutes(input.value);
        return SH.db.setSetting('startingBalance', minutes);
    },

    /**
     * Einstellungen-Screen: Sollzeiten laden
     */
    loadTargetSettings: function() {
        return SH.db.getSetting('targetHours').then(function(targets) {
            targets = targets || { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0 };
            var form = document.getElementById('settings-target-form');
            var inputs = form.querySelectorAll('.form-input');
            inputs.forEach(function(input) {
                var day = input.dataset.day;
                if (targets[day] !== undefined) {
                    input.value = SH.utils.minutesToHHMM(targets[day]);
                }
            });
        });
    },

    /**
     * Einstellungen-Screen: Sollzeiten speichern
     */
    saveTargetSettings: function() {
        var form = document.getElementById('settings-target-form');
        var inputs = form.querySelectorAll('.form-input');
        var targets = {};

        inputs.forEach(function(input) {
            var day = input.dataset.day;
            targets[day] = SH.utils.hhmmToMinutes(input.value);
        });

        return SH.db.setSetting('targetHours', targets).then(function() {
            SH.utils.showToast('Sollzeiten gespeichert', 'success');
        });
    },

    /**
     * Einstellungen-Screen: Startsaldo laden
     */
    loadBalanceSettings: function() {
        return SH.db.getSetting('startingBalance').then(function(balance) {
            document.getElementById('settings-balance').value = SH.utils.minutesToSigned(balance || 0);
        });
    },

    /**
     * Einstellungen-Screen: Startsaldo speichern
     */
    saveBalanceSettings: function() {
        var input = document.getElementById('settings-balance');
        var minutes = SH.utils.hhmmToMinutes(input.value);
        return SH.db.setSetting('startingBalance', minutes).then(function() {
            SH.utils.showToast('Startsaldo gespeichert', 'success');
        });
    },

    /**
     * Backup erstellen
     */
    createBackup: function() {
        return SH.db.exportAll().then(function(data) {
            var json = JSON.stringify(data, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Stempelhamster_Backup_' + SH.utils.today() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            SH.utils.showToast('Backup erstellt', 'success');
        });
    },

    /**
     * Backup wiederherstellen
     */
    restoreBackup: function(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (!data.entries || !data.days || !data.settings) {
                        throw new Error('Ungültiges Backup-Format');
                    }
                    SH.db.importAll(data).then(function() {
                        SH.utils.showToast('Backup wiederhergestellt!', 'success');
                        resolve();
                    }).catch(reject);
                } catch (err) {
                    SH.utils.showToast('Fehler: ' + err.message, 'error');
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    },

    /**
     * Alle Daten zurücksetzen
     */
    resetAll: function() {
        // Datenbank schließen und dann löschen
        SH.db._db.close();
        var dbName = SH.db._db.name;
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function() {
            SH.utils.showToast('Alle Daten gelöscht. App wird neu gestartet...', 'info');
            setTimeout(function() {
                location.reload();
            }, 1500);
        };
        req.onerror = function() {
            SH.utils.showToast('Fehler beim Zurücksetzen.', 'error');
        };
        req.onblocked = function() {
            // Falls blockiert, trotzdem neu laden
            SH.utils.showToast('Daten werden gelöscht...', 'info');
            setTimeout(function() {
                location.reload();
            }, 1500);
        };
    }
};
