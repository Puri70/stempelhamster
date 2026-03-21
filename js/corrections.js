/**
 * MS-Stempelhamster - Manuelle Korrekturen
 */
window.SH = window.SH || {};

SH.corrections = {
    currentDate: null,

    /**
     * Korrektur-Screen für einen Tag laden
     */
    loadDay: function(dateKey) {
        SH.corrections.currentDate = dateKey;

        document.getElementById('correction-dayname').textContent = SH.utils.formatDateLong(dateKey);
        document.getElementById('correction-date').textContent = '';

        return Promise.all([
            SH.db.getOrCreateDay(dateKey),
            SH.db.getWorkEntriesForDate(dateKey),
            SH.db.getPauseEntriesForDate(dateKey),
            SH.daytype.getTargetMinutesForDate(dateKey)
        ]).then(function(results) {
            var day = results[0];
            var workEntries = results[1];
            var pauseEntries = results[2];
            var targetMinutes = results[3];

            // Tagestyp
            document.getElementById('correction-daytype').value = day.dayType;

            // Sollzeit
            document.getElementById('correction-target').value = SH.utils.minutesToHHMM(targetMinutes);

            // Keine Pause heute
            document.getElementById('correction-no-pause').checked = day.noPauseToday;

            // Arbeitsblöcke rendern
            SH.corrections._renderBlocks('correction-work-blocks', workEntries, 'work');

            // Pausenblöcke rendern
            SH.corrections._renderBlocks('correction-pause-blocks', pauseEntries, 'pause');
        });
    },

    /**
     * Blöcke als editierbare Felder rendern
     */
    _renderBlocks: function(containerId, entries, type) {
        var container = document.getElementById(containerId);
        container.innerHTML = '';

        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var div = document.createElement('div');
            div.className = 'form-row';
            div.dataset.entryId = entry.id;

            var startVal = entry.startTime ? SH.utils.timeFromDate(entry.startTime) : '';
            var endVal = entry.endTime ? SH.utils.timeFromDate(entry.endTime) : 'läuft...';

            div.innerHTML =
                '<input class="form-input" type="time" value="' + startVal + '" data-field="start" style="width:100px;">' +
                ' <span style="color:var(--color-text-light);">bis</span> ' +
                '<input class="form-input" type="time" value="' + (entry.endTime ? endVal : '') + '" data-field="end" style="width:100px;"' +
                    (entry.endTime ? '' : ' placeholder="läuft"') + '>' +
                ' <button class="block-edit-btn" data-delete="' + entry.id + '" title="Löschen">&#128465;</button>';

            container.appendChild(div);
        }
    },

    /**
     * Neuen Block hinzufügen
     */
    addBlock: function(type) {
        var containerId = type === 'work' ? 'correction-work-blocks' : 'correction-pause-blocks';
        var container = document.getElementById(containerId);

        var div = document.createElement('div');
        div.className = 'form-row';
        div.dataset.entryId = 'new';
        div.dataset.type = type;

        div.innerHTML =
            '<input class="form-input" type="time" data-field="start" style="width:100px;">' +
            ' <span style="color:var(--color-text-light);">bis</span> ' +
            '<input class="form-input" type="time" data-field="end" style="width:100px;">' +
            ' <button class="block-edit-btn" data-remove title="Entfernen">&#128465;</button>';

        container.appendChild(div);

        // Entfernen-Button
        div.querySelector('[data-remove]').addEventListener('click', function() {
            div.remove();
        });
    },

    /**
     * Alle Änderungen speichern
     */
    save: function() {
        var dateKey = SH.corrections.currentDate;
        if (!dateKey) return Promise.resolve();

        // 1. Tagestyp speichern
        var dayType = document.getElementById('correction-daytype').value;
        var targetStr = document.getElementById('correction-target').value;
        var targetMinutes = SH.utils.hhmmToMinutes(targetStr);
        var noPause = document.getElementById('correction-no-pause').checked;

        return SH.db.getOrCreateDay(dateKey).then(function(day) {
            day.dayType = dayType;
            day.targetMinutes = targetMinutes;
            day.noPauseToday = noPause;
            return SH.db.saveDay(day);
        }).then(function() {
            // 2. Bestehende Einträge löschen und neue anlegen
            return SH.db.getEntriesForDate(dateKey);
        }).then(function(existingEntries) {
            // Alle bestehenden löschen
            var deletePromises = existingEntries.map(function(e) {
                return SH.db.deleteEntry(e.id);
            });
            return Promise.all(deletePromises);
        }).then(function() {
            // 3. Neue Einträge aus dem Formular erstellen
            var workBlocks = SH.corrections._readBlocks('correction-work-blocks', 'work', dateKey);
            var pauseBlocks = SH.corrections._readBlocks('correction-pause-blocks', 'pause', dateKey);
            var allBlocks = workBlocks.concat(pauseBlocks);

            var addPromises = allBlocks.map(function(block) {
                return SH.db.addEntry(block);
            });
            return Promise.all(addPromises);
        }).then(function() {
            // 4. Tag neu berechnen
            return SH.calculator.recalculateDay(dateKey);
        }).then(function() {
            SH.utils.showToast('Änderungen gespeichert', 'success');
        });
    },

    /**
     * Blöcke aus dem Formular auslesen
     */
    _readBlocks: function(containerId, type, dateKey) {
        var container = document.getElementById(containerId);
        var rows = container.querySelectorAll('.form-row');
        var blocks = [];

        for (var i = 0; i < rows.length; i++) {
            var startInput = rows[i].querySelector('[data-field="start"]');
            var endInput = rows[i].querySelector('[data-field="end"]');

            if (!startInput.value) continue;

            var startTime = SH.utils.dateFromKeyAndTime(dateKey, startInput.value).getTime();
            var endTime = endInput.value ? SH.utils.dateFromKeyAndTime(dateKey, endInput.value).getTime() : null;

            var duration = endTime ? Math.floor((endTime - startTime) / 60000) : null;

            blocks.push({
                date: dateKey,
                type: type,
                startTime: startTime,
                endTime: endTime,
                durationMinutes: duration,
                isManual: true
            });
        }

        return blocks;
    },

    /**
     * Einzelnen Eintrag löschen
     */
    deleteBlock: function(entryId) {
        return SH.db.deleteEntry(parseInt(entryId)).then(function() {
            return SH.corrections.loadDay(SH.corrections.currentDate);
        });
    }
};
