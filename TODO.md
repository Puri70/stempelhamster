# MS-Stempelhamster - Entwicklung & Deployment

## Was ist MS-Stempelhamster?
Eine offline-fähige Zeiterfassungs-App für Android-Handys.
Gebaut als Progressive Web App (PWA) mit reinem HTML/CSS/JavaScript.
Gehostet auf GitHub Pages: https://puri70.github.io/stempelhamster/

---

## Schritt-für-Schritt: So wurde die App erstellt

### 1. Projektstruktur anlegen
```
Stempelhamster/
├── index.html          ← Haupt-HTML (Single Page App)
├── manifest.json       ← PWA-Konfiguration (App-Name, Icons, Farben)
├── sw.js               ← Service Worker (macht die App offline-fähig)
├── css/
│   ├── variables.css   ← Farben, Abstände, Schriftgrößen
│   └── style.css       ← Komplettes Styling (Mobile-First)
├── js/
│   ├── utils.js        ← Hilfsfunktionen (Zeitumrechnung, Datumsformate)
│   ├── db.js           ← Datenbank (IndexedDB via Dexie.js)
│   ├── daytype.js      ← Tagesarten-Logik (Arbeitstag, Urlaub, etc.)
│   ├── calculator.js   ← Zeitberechnung (Brutto, Netto, Saldo)
│   ├── timer.js        ← Stoppuhr (Start/Stop/Pause-Zustandsmaschine)
│   ├── corrections.js  ← Manuelle Korrekturen
│   ├── export.js       ← CSV- und PDF-Export
│   ├── settings.js     ← Einstellungen, Backup, Reset
│   ├── views.js        ← Bildschirm-Rendering (Heute, Woche, Monat)
│   ├── navigation.js   ← Navigation zwischen Screens
│   └── app.js          ← App-Start und Event-Listener
├── lib/
│   ├── dexie.min.js          ← IndexedDB-Bibliothek (v4.0.11)
│   ├── jspdf.umd.min.js     ← PDF-Erzeugung (v2.5.1)
│   └── jspdf.plugin.autotable.min.js  ← PDF-Tabellen (v3.8.2)
└── icons/
    ├── icon.svg        ← App-Icon als SVG
    ├── icon-192.png    ← App-Icon 192x192
    └── icon-512.png    ← App-Icon 512x512
```

### 2. Bibliotheken herunterladen (für Offline-Betrieb)
Die JavaScript-Bibliotheken liegen im `lib/`-Ordner, damit sie offline verfügbar sind:
- **Dexie.js** - Einfache Schnittstelle zur IndexedDB-Datenbank
- **jsPDF** - PDF-Dateien im Browser erzeugen
- **jsPDF-AutoTable** - Tabellen in PDFs

### 3. Service Worker einrichten (sw.js)
Der Service Worker cached alle Dateien beim ersten Laden.
Danach funktioniert die App komplett offline.

**Wichtig:** Bei jeder Code-Änderung die Cache-Version hochzählen!
```javascript
var CACHE_NAME = 'stempelhamster-v5';  // ← Nummer erhöhen bei Änderungen!
```

### 4. PWA-Manifest erstellen (manifest.json)
Damit die App auf dem Handy installiert werden kann:
- App-Name und Kurzname
- Icons in verschiedenen Größen
- Display-Modus: "standalone" (sieht aus wie native App)
- Startfarbe und Hintergrundfarbe

### 5. Git-Repository und GitHub Pages einrichten

#### Einmalig: Repository erstellen
1. GitHub-Account erstellen auf github.com
2. Neues Repository "stempelhamster" erstellen (Public)
3. Lokal:
```bash
git init
git branch -m main
git remote add origin https://github.com/DEIN-USERNAME/stempelhamster.git
git add .
git commit -m "Erster Commit"
git push -u origin main
```

#### Einmalig: GitHub Pages aktivieren
Im Repository unter Settings → Pages:
- Source: "Deploy from a branch"
- Branch: "main", Ordner: "/ (root)"
- Save

Oder per GitHub CLI:
```bash
gh api repos/DEIN-USERNAME/stempelhamster/pages -X POST -f build_type=legacy -f source='{"branch":"main","path":"/"}'
```

Die App ist dann erreichbar unter: `https://DEIN-USERNAME.github.io/stempelhamster/`

### 6. App auf dem Android-Handy installieren
1. Chrome auf dem Handy öffnen
2. URL eingeben: `https://DEIN-USERNAME.github.io/stempelhamster/`
3. Drei-Punkte-Menü (⋮) → "App installieren" oder "Zum Startbildschirm hinzufügen"
4. Bestätigen
5. Die App funktioniert ab jetzt auch ohne WLAN!

---

## Bei Code-Änderungen: So wird aktualisiert

1. Code ändern
2. In `sw.js` die Cache-Version hochzählen (z.B. `v5` → `v6`)
3. Committen und pushen:
```bash
git add .
git commit -m "Beschreibung der Änderung"
git push origin main
```
4. 1-2 Minuten warten (GitHub Pages baut automatisch neu)
5. Auf dem Handy: App schließen und neu öffnen

---

## Erledigte Features

- [x] Timer: Start/Stop mit Zustandsmaschine (IDLE → WORKING → PAUSED → WORKING → IDLE)
- [x] Pause-Button mit "Weiter"-Funktion
- [x] Standardpause (automatisch 30min bei >6h, 45min bei >9h)
- [x] "Keine Pause heute"-Option
- [x] Tagesarten (Arbeitstag, Urlaub, Krankheit, Feiertag, Frei, Wochenende)
- [x] Flexible Sollzeit pro Wochentag (konfigurierbar)
- [x] Startsaldo für vorhandene Plus-/Minusstunden
- [x] Tageszusammenfassung: Anwesenheit – Pause = Arbeitszeit (sichtbarer Abzug)
- [x] Saldo-Berechnung (Ist minus Soll)
- [x] Gesamtsaldo über alle Tage
- [x] Wochenübersicht (Tabelle mit Soll/Ist/Pause/Saldo pro Tag)
- [x] Monatsübersicht (Tabelle mit Navigation)
- [x] Manuelle Korrektur (Start-/Endzeiten bearbeiten, Blöcke hinzufügen/löschen)
- [x] "Korrigieren"-Button direkt auf der Heute-Seite
- [x] CSV-Export (Semikolon-getrennt, mit BOM für Excel)
- [x] PDF-Export (Querformat A4, blaue Kopfzeile, Seitenzahlen)
- [x] Backup/Restore als JSON
- [x] Komplett-Reset (alle Daten löschen, App startet neu)
- [x] Service Worker für Offline-Fähigkeit
- [x] PWA installierbar auf Android
- [x] GitHub Pages Deployment
- [x] Setup-Wizard bei erstem Start

## Offene Punkte / Ideen für später

- [ ] Bessere App-Icons (aktuell einfache blaue Quadrate mit "MS"-Text)
- [ ] Benachrichtigung wenn Arbeitszeit eine bestimmte Grenze überschreitet
- [ ] Automatische Erkennung von Feiertagen (z.B. per Bundesland)
- [ ] Dunkelmodus (Dark Theme)
- [ ] Wochenstunden-Anzeige (z.B. "32 von 40 Stunden diese Woche")
- [ ] Mehrere Profile/Arbeitgeber
