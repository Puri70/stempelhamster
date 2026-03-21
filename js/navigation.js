/**
 * MS-Stempelhamster - Navigation
 */
window.SH = window.SH || {};

SH.navigation = {
    currentScreen: 'today',
    history: [],

    /**
     * Navigation initialisieren
     */
    init: function() {
        // Bottom-Nav Buttons
        document.querySelectorAll('.nav-item').forEach(function(btn) {
            btn.addEventListener('click', function() {
                SH.navigation.goTo(this.dataset.screen);
            });
        });

        // Zurück-Button
        document.getElementById('header-back-btn').addEventListener('click', function() {
            SH.navigation.goBack();
        });

        // Einstellungen-Button
        document.getElementById('header-settings-btn').addEventListener('click', function() {
            SH.navigation.goTo('settings');
        });

        // Browser-Zurück
        window.addEventListener('popstate', function() {
            if (SH.navigation.history.length > 0) {
                var prev = SH.navigation.history.pop();
                SH.navigation._switchScreen(prev, false);
            }
        });
    },

    /**
     * Zu einem Screen wechseln
     */
    goTo: function(screenName) {
        if (screenName === SH.navigation.currentScreen) return;

        SH.navigation.history.push(SH.navigation.currentScreen);
        SH.navigation._switchScreen(screenName, true);

        // Screen-spezifische Initialisierung
        switch (screenName) {
            case 'today':
                SH.views.refreshToday();
                break;
            case 'week':
                SH.views.initWeek();
                break;
            case 'month':
                SH.views.initMonth();
                break;
            case 'export':
                SH.views.initExport();
                break;
            case 'settings':
                SH.settings.loadTargetSettings();
                SH.settings.loadBalanceSettings();
                break;
        }
    },

    /**
     * Korrektur-Screen anzeigen
     */
    showCorrection: function(dateKey) {
        SH.navigation.history.push(SH.navigation.currentScreen);
        SH.navigation._switchScreen('correction', true);
        SH.corrections.loadDay(dateKey);
    },

    /**
     * Zurück navigieren
     */
    goBack: function() {
        if (SH.navigation.history.length > 0) {
            var prev = SH.navigation.history.pop();
            SH.navigation._switchScreen(prev, false);

            // Daten aktualisieren
            if (prev === 'today') SH.views.refreshToday();
            if (prev === 'week') SH.views.refreshWeek();
            if (prev === 'month') SH.views.refreshMonth();
        }
    },

    /**
     * Screen wechseln (intern)
     */
    _switchScreen: function(screenName, pushState) {
        // Alle Screens ausblenden
        document.querySelectorAll('.screen').forEach(function(s) {
            s.classList.remove('active');
        });

        // Neuen Screen einblenden
        var screen = document.getElementById('screen-' + screenName);
        if (screen) {
            screen.classList.add('active');
        }

        SH.navigation.currentScreen = screenName;

        // Nav-Items markieren
        document.querySelectorAll('.nav-item').forEach(function(item) {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });

        // Zurück-Button anzeigen bei Unter-Screens
        var backBtn = document.getElementById('header-back-btn');
        var isSubScreen = screenName === 'settings' || screenName === 'correction';
        backBtn.style.display = isSubScreen ? 'flex' : 'none';

        // Einstellungen-Button verstecken bei Unter-Screens
        var settingsBtn = document.getElementById('header-settings-btn');
        settingsBtn.style.display = isSubScreen ? 'none' : 'flex';

        // Browser-History
        if (pushState) {
            window.history.pushState({ screen: screenName }, '', '');
        }
    },

    /**
     * Setup-Screen anzeigen
     */
    showSetup: function() {
        document.querySelectorAll('.screen').forEach(function(s) {
            s.classList.remove('active');
        });
        document.getElementById('screen-setup').classList.add('active');
        document.querySelector('.bottom-nav').style.display = 'none';
        document.getElementById('header-settings-btn').style.display = 'none';
    },

    /**
     * Setup beenden und Hauptscreen zeigen
     */
    finishSetup: function() {
        document.querySelector('.bottom-nav').style.display = 'flex';
        document.getElementById('header-settings-btn').style.display = 'flex';
        SH.navigation._switchScreen('today', false);
        SH.views.refreshToday();
    }
};
