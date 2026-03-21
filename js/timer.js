/**
 * MS-Stempelhamster - Timer / Stoppuhr
 * Zustandsmaschine: IDLE -> WORKING -> PAUSED -> WORKING -> ... -> IDLE
 */
window.SH = window.SH || {};

SH.timer = {
    // Aktueller Status: 'idle', 'working', 'paused'
    state: 'idle',
    // ID des aktuell laufenden Eintrags
    activeEntryId: null,
    // Interval für Display-Update
    _interval: null,

    /**
     * Timer initialisieren - prüft ob ein Eintrag offen ist
     */
    init: function() {
        return SH.db.getActiveEntry().then(function(entry) {
            if (entry) {
                SH.timer.activeEntryId = entry.id;
                SH.timer.state = entry.type === 'work' ? 'working' : 'paused';
                SH.timer._startDisplayUpdate();
            } else {
                SH.timer.state = 'idle';
                SH.timer.activeEntryId = null;
            }
            SH.timer.updateUI();
            return SH.timer.state;
        });
    },

    /**
     * Arbeit starten
     */
    startWork: function() {
        var now = Date.now();
        var dateKey = SH.utils.today();

        // Falls gerade Pause läuft, diese zuerst stoppen
        var promise = SH.timer.state === 'paused'
            ? SH.timer._stopCurrentEntry()
            : Promise.resolve();

        return promise.then(function() {
            var entry = {
                date: dateKey,
                type: 'work',
                startTime: now,
                endTime: null,
                durationMinutes: null,
                isManual: false
            };
            return SH.db.addEntry(entry).then(function(id) {
                SH.timer.activeEntryId = id;
                SH.timer.state = 'working';
                SH.timer._startDisplayUpdate();
                SH.timer.updateUI();
                return id;
            });
        });
    },

    /**
     * Arbeit stoppen
     */
    stopWork: function() {
        return SH.timer._stopCurrentEntry().then(function() {
            SH.timer.state = 'idle';
            SH.timer.activeEntryId = null;
            SH.timer._stopDisplayUpdate();
            SH.timer.updateUI();

            // Tag neu berechnen
            var dateKey = SH.utils.today();
            return SH.calculator.recalculateDay(dateKey);
        });
    },

    /**
     * Pause starten
     */
    startPause: function() {
        if (SH.timer.state !== 'working') return Promise.resolve();

        var now = Date.now();
        var dateKey = SH.utils.today();

        // Aktuellen Arbeitsblock stoppen
        return SH.timer._stopCurrentEntry().then(function() {
            // Pausenblock starten
            var entry = {
                date: dateKey,
                type: 'pause',
                startTime: now,
                endTime: null,
                durationMinutes: null,
                isManual: false
            };
            return SH.db.addEntry(entry).then(function(id) {
                SH.timer.activeEntryId = id;
                SH.timer.state = 'paused';
                SH.timer.updateUI();
                return id;
            });
        });
    },

    /**
     * Pause beenden und Arbeit fortsetzen
     */
    stopPause: function() {
        if (SH.timer.state !== 'paused') return Promise.resolve();

        var now = Date.now();
        var dateKey = SH.utils.today();

        return SH.timer._stopCurrentEntry().then(function() {
            // Neuen Arbeitsblock starten
            var entry = {
                date: dateKey,
                type: 'work',
                startTime: now,
                endTime: null,
                durationMinutes: null,
                isManual: false
            };
            return SH.db.addEntry(entry).then(function(id) {
                SH.timer.activeEntryId = id;
                SH.timer.state = 'working';
                SH.timer.updateUI();
                return id;
            });
        });
    },

    /**
     * Stempel-Button: je nach Status starten oder stoppen
     */
    toggle: function() {
        switch (SH.timer.state) {
            case 'idle':
                return SH.timer.startWork();
            case 'working':
                return SH.timer.stopWork();
            case 'paused':
                // Bei Pause: Pause beenden und komplett stoppen
                return SH.timer._stopCurrentEntry().then(function() {
                    SH.timer.state = 'idle';
                    SH.timer.activeEntryId = null;
                    SH.timer._stopDisplayUpdate();
                    SH.timer.updateUI();
                    return SH.calculator.recalculateDay(SH.utils.today());
                });
            default:
                return Promise.resolve();
        }
    },

    /**
     * Pause-Button: je nach Status Pause starten oder beenden
     */
    togglePause: function() {
        switch (SH.timer.state) {
            case 'working':
                return SH.timer.startPause();
            case 'paused':
                return SH.timer.stopPause();
            default:
                return Promise.resolve();
        }
    },

    /**
     * Aktuellen Eintrag beenden (intern)
     */
    _stopCurrentEntry: function() {
        if (!SH.timer.activeEntryId) return Promise.resolve();

        var now = Date.now();
        var id = SH.timer.activeEntryId;

        return SH.db.getEntry(id).then(function(entry) {
            if (!entry) return;
            var duration = Math.floor((now - entry.startTime) / 60000);
            return SH.db.updateEntry(id, {
                endTime: now,
                durationMinutes: duration
            });
        });
    },

    /**
     * Display jede Sekunde aktualisieren
     */
    _startDisplayUpdate: function() {
        SH.timer._stopDisplayUpdate();
        SH.timer._interval = setInterval(function() {
            SH.timer._updateTimerDisplay();
        }, 1000);
    },

    _stopDisplayUpdate: function() {
        if (SH.timer._interval) {
            clearInterval(SH.timer._interval);
            SH.timer._interval = null;
        }
    },

    /**
     * Timer-Anzeige aktualisieren
     */
    _updateTimerDisplay: function() {
        var timerTime = document.getElementById('timer-time');
        if (!timerTime) return;

        if (!SH.timer.activeEntryId) {
            // Zeige die heutige Gesamtarbeitszeit
            SH.calculator.calculateDayTotals(SH.utils.today()).then(function(totals) {
                var mins = totals.netWorkMinutes;
                var h = Math.floor(mins / 60);
                var m = mins % 60;
                timerTime.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':00';
            });
            return;
        }

        SH.db.getEntry(SH.timer.activeEntryId).then(function(entry) {
            if (!entry) return;
            var elapsed = Math.floor((Date.now() - entry.startTime) / 1000);
            var h = Math.floor(elapsed / 3600);
            var m = Math.floor((elapsed % 3600) / 60);
            var s = elapsed % 60;

            if (SH.timer.state === 'working') {
                // Bei Arbeit: zeige heutige Gesamtarbeitszeit + laufender Block
                SH.calculator.calculateDayTotals(SH.utils.today()).then(function(totals) {
                    var totalSec = totals.netWorkMinutes * 60;
                    var th = Math.floor(totalSec / 3600);
                    var tm = Math.floor((totalSec % 3600) / 60);
                    var ts = Math.floor(Date.now() / 1000) % 60;
                    timerTime.textContent = (th < 10 ? '0' : '') + th + ':' + (tm < 10 ? '0' : '') + tm + ':' + (ts < 10 ? '0' : '') + ts;
                });
            } else {
                // Bei Pause: zeige Pausendauer
                timerTime.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            }
        });
    },

    /**
     * UI-Elemente basierend auf Status aktualisieren
     */
    updateUI: function() {
        var btnStamp = document.getElementById('btn-stamp');
        var btnPause = document.getElementById('btn-pause');
        var timerDisplay = document.getElementById('timer-display');
        var timerLabel = document.getElementById('timer-label');
        var statusBadge = document.getElementById('today-status');

        if (!btnStamp) return; // Screen nicht sichtbar

        switch (SH.timer.state) {
            case 'idle':
                btnStamp.className = 'btn btn-start';
                btnStamp.innerHTML = '&#9654; Stempeln';
                btnPause.disabled = true;
                btnPause.className = 'btn btn-pause';
                timerDisplay.className = 'timer-display idle';
                timerLabel.textContent = 'Bereit';
                statusBadge.className = 'status-badge status-idle';
                statusBadge.textContent = 'Gestoppt';
                break;

            case 'working':
                btnStamp.className = 'btn btn-stop';
                btnStamp.innerHTML = '&#9632; Stop';
                btnPause.disabled = false;
                btnPause.className = 'btn btn-pause';
                timerDisplay.className = 'timer-display working';
                timerLabel.textContent = 'Arbeitszeit läuft';
                statusBadge.className = 'status-badge status-working';
                statusBadge.textContent = 'Arbeit läuft';
                break;

            case 'paused':
                btnStamp.className = 'btn btn-stop';
                btnStamp.innerHTML = '&#9632; Stop';
                btnPause.disabled = false;
                btnPause.className = 'btn btn-pause-active';
                btnPause.innerHTML = '&#9654; Weiter';
                timerDisplay.className = 'timer-display paused';
                timerLabel.textContent = 'Pause läuft';
                statusBadge.className = 'status-badge status-paused';
                statusBadge.textContent = 'Pause';
                break;
        }

        // Pause-Button Text zurücksetzen wenn nicht in Pause
        if (SH.timer.state !== 'paused') {
            btnPause.innerHTML = '&#9208; Pause';
        }
    }
};
