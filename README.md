# Test-Rundenkampf – Testumgebung für rundenbasierte Dungeon-Kämpfe

## Wozu dient diese App?

Die App ist eine **mobile Test- und Design-Umgebung** für die rundenbasierten Dungeon-Kämpfe eines PC-Games, das sich in Entwicklung befindet.
Sie ist **nicht** das eigentliche Spiel, sondern ein Werkzeug, um:

- **Spielinhalte schnell zu entwerfen** – Allys, Gegner, Objekte, Geländearten, Fähigkeiten, Effekte, Ressourcen, Level und Dungeons,
- **diese Inhalte direkt im Kampf auszuprobieren** – mit frei wählbarem Team, Startgegenständen und Dungeon/Level,
- **Balancing zu vereinfachen** – Werte anpassen, erneut testen, vergleichen,
- **herauszufinden, welche Strategien und Effekte Spaß machen**, bevor sie ins PC-Game übernommen werden.

Leitgedanke: Alles soll **einfach zu bearbeiten** sein. Neue Ideen sollen in wenigen Minuten angelegt und getestet werden können – ohne Programmierung.

## Grober Aufbau

Beim Öffnen der App erscheint ein **Startbildschirm** mit drei Optionen:

| Option | Zweck |
|---|---|
| **Erstellen** | Erstell-Modus: Anlegen und Bearbeiten aller Spielbausteine (siehe unten). |
| **Neues Spiel** | Auswahl von Dungeon oder einzelnen Leveln, Team und Startgegenständen → Start des Spielmodus. |
| **Spielstand laden** | Gespeicherte Spiele laden und fortsetzen. |

### Erstell-Modus – Bausteine

| Baustein | Kurzbeschreibung |
|---|---|
| Allys | Spielbare Charaktere |
| Gegner | Nicht-spielbare Charaktere (inkl. Verhalten/KI) |
| Objekte | Vor allem sammelbare Gegenstände |
| Geländearten | Untergründe/Felder mit verschiedenen Effekten |
| Fähigkeiten | Aktionen, die Charaktere im Kampf ausführen können |
| Effekte *(evtl.)* | Wiederverwendbare Wirkungen (z. B. Schaden, Heilung, Statuseffekte) |
| Ressourcen | z. B. Lebenspunkte, Mana, Ausdauer, Aktionspunkte, Währung … |
| Level | Maps, die Gelände, Gegner und Objekte enthalten |
| Dungeons | Aneinandergereihte Level |

### Spielmodus

- Greift auf die im Erstell-Modus angelegten Inhalte zurück.
- Der gewählte Dungeon bzw. die gewählten Level werden mit dem gewählten Team und den Startgegenständen gespielt.
- Spielstände können **jederzeit** gespeichert werden.

---

## Arbeitsweise

Wir gehen die Arbeitsabschnitte **Schritt für Schritt** durch. Für jeden Abschnitt gilt:

1. **Beschreibung** – du beschreibst, was du dir vorstellst.
2. **Zusammenfassung & Rückfragen** – Claude fasst den Auftrag in eigenen Worten zusammen und stellt offene Fragen.
3. **Go** – erst nach deiner Freigabe wird umgesetzt.
4. **Umsetzung & Test** – Umsetzung, danach Abnahme durch dich.
5. **Dokumentation** – die getroffenen Entscheidungen werden in diesem Dokument im jeweiligen Abschnitt festgehalten.

Status-Legende: ⬜ offen · 🟨 in Klärung · 🟦 in Umsetzung · ✅ fertig

---

## Arbeitsabschnitte

Die Reihenfolge ist so gewählt, dass zuerst die Grundlagen (Technik, Regeln, Grundbausteine) stehen, auf denen die späteren Editoren und der Spielmodus aufbauen. Sie kann jederzeit angepasst werden.

### Übersicht

| # | Abschnitt | Status |
|---|---|---|
| 0 | Technische Grundlagen | ⬜ |
| 1 | App-Gerüst & Navigation (Startbildschirm) | ⬜ |
| 2 | Kampfregeln – der Kern | ⬜ |
| 3 | Ressourcen & Attribute | ⬜ |
| 4 | Effekte | ⬜ |
| 5 | Fähigkeiten | ⬜ |
| 6 | Allys | ⬜ |
| 7 | Gegner & Gegner-KI | ⬜ |
| 8 | Objekte / Gegenstände | ⬜ |
| 9 | Geländearten | ⬜ |
| 10 | Level-Editor | ⬜ |
| 11 | Dungeon-Editor | ⬜ |
| 12 | Neues Spiel (Setup) | ⬜ |
| 13 | Spielmodus (Kampf-Oberfläche) | ⬜ |
| 14 | Speichern & Laden | ⬜ |
| 15 | Balancing-Werkzeuge | ⬜ |
| 16 | Import / Export & Datenaustausch | ⬜ |

---

### 0 – Technische Grundlagen
**Ziel:** Festlegen, womit und wofür die App gebaut wird.
- Zielplattform(en): Android, iOS oder beides?
- Technologie (z. B. Flutter, React Native, Godot/Unity-Mobile-Export, Web-App/PWA)
- Datenhaltung lokal auf dem Gerät (offline) oder zusätzlich Cloud/Sync?
- Datenformat für alle Inhalte (z. B. JSON), damit Inhalte später ggf. ins PC-Game übernommen werden können
- Sprache der Oberfläche (Deutsch?)

**Offene Punkte / Entscheidungen:** –

### 1 – App-Gerüst & Navigation
**Ziel:** Lauffähige Grundstruktur der App.
- Startbildschirm mit „Erstellen“, „Neues Spiel“, „Spielstand laden“
- Grundnavigation zwischen den Modi
- Einheitliches Grund-Layout für alle Editoren (Liste → Detailansicht → Bearbeiten/Kopieren/Löschen)

**Offene Punkte / Entscheidungen:** –

### 2 – Kampfregeln – der Kern
**Ziel:** Die grundlegenden Spielregeln, auf denen alles andere aufbaut.
- Spielfeld: Raster (Quadrat/Hex)? Bewegung auf dem Feld oder reine Positionsreihen?
- Rundenablauf: Initiative/Zugreihenfolge, Phasen, Aktionen pro Zug
- Bewegung, Reichweite, Sichtlinie
- Trefferberechnung, Schaden, Zufall (Würfel? kritische Treffer?)
- Sieg- und Niederlagebedingungen, Tod/K.O. von Charakteren
- Was passiert zwischen Leveln (Heilung, Belohnungen, Levelaufstieg?)

**Offene Punkte / Entscheidungen:** –

### 3 – Ressourcen & Attribute
**Ziel:** Frei definierbare Werte, mit denen Charaktere und Fähigkeiten arbeiten.
- Ressourcen anlegen (z. B. LP, Mana, Ausdauer, Wut, Gold) mit Min/Max, Startwert, Regeneration
- Attribute/Stats (z. B. Stärke, Verteidigung, Tempo) – fest vorgegeben oder frei definierbar?
- Teamweite vs. charakterbezogene Ressourcen

**Offene Punkte / Entscheidungen:** –

### 4 – Effekte
**Ziel:** Wiederverwendbare Wirkungen als Bausteine für Fähigkeiten, Objekte und Gelände.
- Effekttypen (Schaden, Heilung, Ressource ändern, Attribut ändern, Status wie Gift/Betäubung, Bewegung/Rückstoß, Beschwörung …)
- Dauer, Stapelbarkeit, Auslöser (sofort, pro Runde, beim Betreten, beim Treffer …)
- Bedingungen (z. B. „wenn Ziel vergiftet ist“)

**Offene Punkte / Entscheidungen:** –

### 5 – Fähigkeiten
**Ziel:** Aktionen, die Allys und Gegner im Kampf nutzen.
- Kosten (Ressourcen), Abklingzeit, Reichweite, Zielart (Einzelziel, Fläche, selbst, Verbündete)
- Kombination mehrerer Effekte
- Passive Fähigkeiten?

**Offene Punkte / Entscheidungen:** –

### 6 – Allys
**Ziel:** Spielbare Charaktere anlegen.
- Name, Bild/Symbol, Attribute, Ressourcen, Fähigkeiten
- Ausrüstung/Inventar-Plätze?
- Klassen, Stufen/Levelaufstieg?

**Offene Punkte / Entscheidungen:** –

### 7 – Gegner & Gegner-KI
**Ziel:** Nicht-spielbare Charaktere inkl. Verhalten anlegen.
- Werte und Fähigkeiten (wie Allys)
- Verhalten/KI: einfache Regeln (z. B. „greift schwächstes Ziel an“, „heilt bei < 30 % LP“) – frei konfigurierbar?
- Beute/Belohnungen beim Besiegen

**Offene Punkte / Entscheidungen:** –

### 8 – Objekte / Gegenstände
**Ziel:** Sammelbare und nutzbare Gegenstände.
- Typen: Verbrauchsgegenstände, Ausrüstung, Schlüssel/Quest-Objekte, Fallen, interaktive Map-Objekte (Truhen, Hebel)?
- Wirkung über Effekte
- Stapelbarkeit, Inventar (Team oder pro Charakter)

**Offene Punkte / Entscheidungen:** –

### 9 – Geländearten
**Ziel:** Felder mit Eigenschaften und Effekten.
- Begehbarkeit, Bewegungskosten, Sichtblockade
- Effekte beim Betreten/Stehen/Verlassen (z. B. Lava, Eis, Heilquelle)
- Darstellung (Farbe/Symbol/Bild)

**Offene Punkte / Entscheidungen:** –

### 10 – Level-Editor
**Ziel:** Maps bauen und befüllen.
- Größe und Form der Map
- Gelände „malen“, Gegner und Objekte platzieren, Startpositionen des Teams
- Level-Ziele (alle Gegner besiegen, Ausgang erreichen, X Runden überleben …)
- Bedienbarkeit auf dem Smartphone (Zoom, Scrollen, Touch-Werkzeuge)

**Offene Punkte / Entscheidungen:** –

### 11 – Dungeon-Editor
**Ziel:** Level zu Dungeons aneinanderreihen.
- Reihenfolge (linear oder verzweigt?)
- Übergänge zwischen Leveln (Rast, Belohnungen, Zustand bleibt erhalten?)

**Offene Punkte / Entscheidungen:** –

### 12 – Neues Spiel (Setup)
**Ziel:** Testlauf konfigurieren und starten.
- Auswahl: Dungeon oder einzelne Level
- Team zusammenstellen (Anzahl Allys?)
- Startgegenstände festlegen
- ggf. Test-Optionen (z. B. Gegner-Stärke-Multiplikator, Zufall fixieren)

**Offene Punkte / Entscheidungen:** –

### 13 – Spielmodus (Kampf-Oberfläche)
**Ziel:** Den Kampf spielbar und verständlich darstellen.
- Map-Anzeige, Charakterinfos, Zugreihenfolge
- Auswahl von Bewegung, Fähigkeit, Gegenstand, Ziel
- Kampf-Log (was ist passiert, welche Zahlen wurden berechnet?)
- Gegnerzüge sichtbar/nachvollziehbar

**Offene Punkte / Entscheidungen:** –

### 14 – Speichern & Laden
**Ziel:** Spielstände jederzeit sichern und fortsetzen.
- Mehrere Speicherplätze, Benennung, Datum
- Was passiert, wenn Inhalte im Erstell-Modus nach dem Speichern geändert wurden? (Stand einfrieren oder aktuelle Version verwenden?)

**Offene Punkte / Entscheidungen:** –

### 15 – Balancing-Werkzeuge *(optional)*
**Ziel:** Das Austesten und Auswerten erleichtern.
- Statistiken pro Kampf (Schaden, Heilung, Rundenzahl)
- Werte während des Spiels live anpassen („Cheat-/Debug-Menü“)
- Rückgängig/Zug wiederholen
- ggf. automatische Simulation vieler Kämpfe

**Offene Punkte / Entscheidungen:** –

### 16 – Import / Export & Datenaustausch *(optional)*
**Ziel:** Inhalte sichern, teilen und ins PC-Game übernehmen.
- Export/Import aller Inhalte als Datei
- Format kompatibel zum PC-Game?

**Offene Punkte / Entscheidungen:** –
