/**
 * MS-Stempelhamster - Hauptmodul (App-Initialisierung)
 */
window.SH = window.SH || {};

SH.app = {
    /**
     * App starten
     */
    init: function() {
        // Service Worker registrieren
        SH.app._registerServiceWorker();

        // Prüfen ob Ersteinrichtung nötig
        SH.db.getSetting('setupComplete').then(function(setupDone) {
            if (!setupDone) {
                SH.app._initSetup();
            } else {
                SH.app._initMain();
            }
        }).catch(function(err) {
            console.error('Fehler beim App-Start:', err);
            SH.app._initSetup();
        });
    },

    /**
     * Setup-Wizard initialisieren
     */
    _initSetup: function() {
        SH.navigation.showSetup();

        // Step 1: Weiter
        document.getElementById('setup-next-1').addEventListener('click', function() {
            document.getElementById('setup-step-1').style.display = 'none';
            document.getElementById('setup-step-2').style.display = '';
        });

        // Step 2: Weiter (Sollzeiten speichern)
        document.getElementById('setup-next-2').addEventListener('click', function() {
            SH.settings.saveTargetFromSetup().then(function() {
                document.getElementById('setup-step-2').style.display = 'none';
                document.getElementById('setup-step-3').style.display = '';
            });
        });

        // Step 3: Fertig (Startsaldo speichern)
        document.getElementById('setup-finish').addEventListener('click', function() {
            SH.settings.saveBalanceFromSetup().then(function() {
                return SH.db.setSetting('setupComplete', true);
            }).then(function() {
                SH.navigation.finishSetup();
                SH.app._initMain();
                SH.utils.showToast('Einrichtung abgeschlossen!', 'success');
            });
        });
    },

    /**
     * Hauptapp initialisieren
     */
    _initMain: function() {
        // Navigation
        SH.navigation.init();

        // Heute-Screen aktivieren
        document.getElementById('screen-today').classList.add('active');
        SH.navigation.currentScreen = 'today';

        // Timer initialisieren (prüft offene Einträge)
        SH.timer.init();

        // Heute-Screen laden
        SH.views.refreshToday();

        // Event-Listener
        SH.app._bindEvents();

        // Regelmäßig aktualisieren
        SH.app._startAutoRefresh();
    },

    /**
     * Alle Event-Listener binden
     */
    _bindEvents: function() {
        // === Heute-Screen ===

        // Stempel-Button
        document.getElementById('btn-stamp').addEventListener('click', function() {
            SH.timer.toggle().then(function() {
                SH.views.refreshToday();
            });
        });

        // Pause-Button
        document.getElementById('btn-pause').addEventListener('click', function() {
            SH.timer.togglePause().then(function() {
                SH.views.refreshToday();
            });
        });

        // Standardpause-Button
        document.getElementById('btn-standard-pause').addEventListener('click', function() {
            var dateKey = SH.utils.today();
            SH.db.getPauseEntriesForDate(dateKey).then(function(pauses) {
                if (pauses.length > 0) {
                    SH.utils.showToast('Es sind bereits Pausen eingetragen.', 'warning');
                    return;
                }
                return SH.db.getOrCreateDay(dateKey).then(function(day) {
                    day.standardPauseApplied = true;
                    day.noPauseToday = false;
                    return SH.db.saveDay(day);
                }).then(function() {
                    return SH.calculator.recalculateDay(dateKey);
                }).then(function() {
                    SH.views.refreshToday();
                    SH.utils.showToast('Standardpause gesetzt', 'success');
                });
            });
        });

        // Keine Pause heute Button
        document.getElementById('btn-no-pause').addEventListener('click', function() {
            var dateKey = SH.utils.today();
            SH.db.getOrCreateDay(dateKey).then(function(day) {
                day.noPauseToday = !day.noPauseToday;
                if (day.noPauseToday) {
                    day.standardPauseApplied = false;
                }
                return SH.db.saveDay(day);
            }).then(function() {
                return SH.calculator.recalculateDay(dateKey);
            }).then(function() {
                SH.views.refreshToday();
            });
        });

        // Tagestyp ändern
        document.getElementById('today-daytype').addEventListener('change', function() {
            var dateKey = SH.utils.today();
            var newType = this.value;
            SH.daytype.setDayType(dateKey, newType).then(function() {
                return SH.calculator.recalculateDay(dateKey);
            }).then(function() {
                SH.views.refreshToday();
            });
        });

        // Korrektur-Button auf Heute-Screen
        document.getElementById('btn-correct-today').addEventListener('click', function() {
            SH.navigation.showCorrection(SH.utils.today());
        });

        // === Wochen-Screen ===
        document.getElementById('week-prev').addEventListener('click', function() {
            SH.views.weekPrev();
        });
        document.getElementById('week-next').addEventListener('click', function() {
            SH.views.weekNext();
        });

        // === Monats-Screen ===
        document.getElementById('month-prev').addEventListener('click', function() {
            SH.views.monthPrev();
        });
        document.getElementById('month-next').addEventListener('click', function() {
            SH.views.monthNext();
        });

        // === Export-Screen ===
        document.getElementById('btn-export-csv').addEventListener('click', function() {
            var from = document.getElementById('export-from').value;
            var to = document.getElementById('export-to').value;
            if (!from || !to) {
                SH.utils.showToast('Bitte Zeitraum wählen', 'warning');
                return;
            }
            SH.export.exportCSV(from, to).then(function() {
                SH.utils.showToast('CSV exportiert', 'success');
            });
        });

        document.getElementById('btn-export-pdf').addEventListener('click', function() {
            var from = document.getElementById('export-from').value;
            var to = document.getElementById('export-to').value;
            if (!from || !to) {
                SH.utils.showToast('Bitte Zeitraum wählen', 'warning');
                return;
            }
            SH.export.exportPDF(from, to).then(function() {
                SH.utils.showToast('PDF exportiert', 'success');
            });
        });

        // === Einstellungen ===
        document.getElementById('btn-save-target').addEventListener('click', function() {
            SH.settings.saveTargetSettings();
        });

        document.getElementById('btn-save-balance').addEventListener('click', function() {
            SH.settings.saveBalanceSettings();
        });

        document.getElementById('btn-backup').addEventListener('click', function() {
            SH.settings.createBackup();
        });

        document.getElementById('btn-restore').addEventListener('click', function() {
            document.getElementById('restore-file').click();
        });

        document.getElementById('restore-file').addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                if (confirm('Alle aktuellen Daten werden überschrieben. Fortfahren?')) {
                    SH.settings.restoreBackup(e.target.files[0]).then(function() {
                        SH.views.refreshToday();
                    });
                }
                e.target.value = '';
            }
        });

        document.getElementById('btn-reset').addEventListener('click', function() {
            if (confirm('Wirklich ALLE Daten löschen?\n\nAlle Arbeitszeiten, Pausen und Einstellungen werden unwiderruflich gelöscht. Die App startet danach neu wie beim ersten Mal.\n\nDieser Vorgang kann nicht rückgängig gemacht werden!')) {
                SH.settings.resetAll();
            }
        });

        // === Korrektur-Screen ===
        document.getElementById('btn-add-work').addEventListener('click', function() {
            SH.corrections.addBlock('work');
        });

        document.getElementById('btn-add-pause').addEventListener('click', function() {
            SH.corrections.addBlock('pause');
        });

        document.getElementById('btn-save-correction').addEventListener('click', function() {
            SH.corrections.save().then(function() {
                SH.navigation.goBack();
            });
        });

        // Delete-Buttons in Korrektur (Event Delegation)
        document.getElementById('screen-correction').addEventListener('click', function(e) {
            var deleteBtn = e.target.closest('[data-delete]');
            if (deleteBtn) {
                var id = deleteBtn.dataset.delete;
                if (confirm('Eintrag löschen?')) {
                    SH.corrections.deleteBlock(id);
                }
            }
        });

        // === Modal ===
        document.getElementById('modal-cancel').addEventListener('click', function() {
            SH.app.closeModal();
        });

        document.getElementById('modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) {
                SH.app.closeModal();
            }
        });
    },

    /**
     * Auto-Refresh alle 30 Sekunden (für laufende Timer)
     */
    _startAutoRefresh: function() {
        setInterval(function() {
            if (SH.navigation.currentScreen === 'today' && SH.timer.state !== 'idle') {
                SH.views.refreshToday();
            }
        }, 30000);
    },

    /**
     * Service Worker registrieren
     */
    _registerServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then(function(reg) {
                console.log('Service Worker registriert');
            }).catch(function(err) {
                console.log('Service Worker Fehler:', err);
            });
        }
    },

    /**
     * Modal öffnen
     */
    openModal: function(title, contentHtml, onSave) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = contentHtml;
        document.getElementById('modal-overlay').classList.add('active');

        var saveBtn = document.getElementById('modal-save');
        var newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        newBtn.id = 'modal-save';
        newBtn.addEventListener('click', function() {
            if (onSave) onSave();
            SH.app.closeModal();
        });
    },

    /**
     * Modal schließen
     */
    closeModal: function() {
        document.getElementById('modal-overlay').classList.remove('active');
    }
};

// App starten wenn DOM bereit
document.addEventListener('DOMContentLoaded', function() {
    SH.app.init();
});
