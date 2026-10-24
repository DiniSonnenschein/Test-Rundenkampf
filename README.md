# Rundenkämpfe – Testumgebung für rundenbasierte Dungeon-Kämpfe

## Wozu dient diese App?

Die App ist eine **mobile Test- und Design-Umgebung** für die rundenbasierten Dungeon-Kämpfe eines PC-Games, das sich in Entwicklung befindet.
Sie ist **nicht** das eigentliche Spiel, sondern ein Werkzeug, um:

- **Spielinhalte schnell zu entwerfen** – Allys, Gegner, Objekte, Geländearten, Fähigkeiten, Effekte, Ressourcen, Level und Dungeons,
- **diese Inhalte direkt im Kampf auszuprobieren** – mit frei wählbarem Team, Startgegenständen und Dungeon/Level,
- **Balancing zu vereinfachen** – Werte anpassen, erneut testen, vergleichen,
- **herauszufinden, welche Strategien und Effekte Spaß machen**, bevor sie ins PC-Game übernommen werden.

Leitgedanke: Alles soll **einfach zu bearbeiten** sein. Neue Ideen sollen in wenigen Minuten angelegt und getestet werden können – ohne Programmierung.

**App öffnen / installieren:** https://dinisonnenschein.github.io/Test-Rundenkampf/
Auf dem Android-Handy in Chrome öffnen → Menü (⋮) → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“. Danach läuft die App auch offline.

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
| Regelwerke | Einstellbare Grundregeln eines Kampfes (Abschnitt 2) |
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

Zu Beginn jedes Abschnitts erklärt Claude im Chat, was genau mit dem Abschnitt gemeint ist und welche Fragen für wichtig gehalten werden.

Status-Legende: ⬜ offen · 🟨 in Klärung · 🟦 in Umsetzung · ✅ fertig

---

## Arbeitsabschnitte

Die Reihenfolge ist so gewählt, dass zuerst die Grundlagen (Technik, Regeln, Grundbausteine) stehen, auf denen die späteren Editoren und der Spielmodus aufbauen. Sie kann jederzeit angepasst werden.

### Übersicht

| # | Abschnitt | Status |
|---|---|---|
| 0 | Technische Grundlagen | ✅ |
| 1 | App-Gerüst & Navigation (Startbildschirm) | ✅ |
| 2 | Kampfregeln – der Kern | ✅ |
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

**Entscheidungen:**
- **Plattform:** Web-App (PWA), die auf dem Smartphone wie eine App installiert werden kann.
- **Datenhaltung:** nur lokal auf dem Gerät. Es geht ums Ausprobieren, nicht um umfangreiche Archivierung; kein Cloud-Sync.
- **Datenformat:** Alle Inhalte werden als JSON gespeichert.
- **Bezug zum PC-Game:** Das PC-Game wird in **GameMaker** entwickelt. Eine spätere Übernahme der JSON-Inhalte ist wünschenswert, aber kein hartes Ziel: Die App darf Inhalte flexibler/abstrakter beschreiben, als es im Spiel später umgesetzt wird. Flexibilität für das Testen hat Vorrang vor direkter Übertragbarkeit.
- **Technik:** TypeScript + React + Vite. Die Kampf- und Spiellogik wird getrennt von der Oberfläche programmiert (automatisch testbar, Vorlage für GameMaker).
- **Anpassbare Regeln:** Grundregeln (z. B. Kampfregeln) werden möglichst als Einstellungen statt fest im Code umgesetzt, damit sie später leicht geändert werden können. Änderungswünsche meldest du, wenn sie aufkommen.
- **Veröffentlichung:** über GitHub Pages. Jeder Push auf den Entwicklungs-Branch testet und veröffentlicht die App automatisch.
- **Backup:** Export/Import aller Inhalte als JSON-Datei (Vorgriff auf Abschnitt 16).
- **Gerät:** ausschließlich Android-Smartphone, nur **Hochformat**.
- **Sprache:** nur Deutsch.
- **Optik:** dunkle Oberfläche mit weißer Schrift, herbstliche Farbtöne im Hintergrund (Kürbis-Orange, Ahorn-Rot, Birken-Gold, Moos-Grün) und ein paar langsam fallende, bunte Blätter als Deko.
- **Spielgrafik:** einfache Vektorformen in unterschiedlichen Farben, keine Bilder.

**Umsetzung:**
- Projektstruktur: `src/data` (Speicherung & Backup), `src/ui` (Oberflächen-Bausteine), `src/styles/theme.css` (alle Farben zentral), später `src/engine` (Spiellogik)
- Speicherung im `localStorage` des Browsers, je Baustein-Sammlung ein JSON-Eintrag
- Installierbar (Manifest, App-Icon mit Ahornblatt) und offline nutzbar (Service Worker)
- Automatische Tests (`npm test`) und Veröffentlichung per GitHub Actions

### 1 – App-Gerüst & Navigation
**Ziel:** Lauffähige Grundstruktur der App.
- Startbildschirm mit „Erstellen“, „Neues Spiel“, „Spielstand laden“
- Grundnavigation zwischen den Modi
- Einheitliches Grund-Layout für alle Editoren (Liste → Detailansicht → Bearbeiten/Kopieren/Löschen)

**Entscheidungen:**
- **App-Name:** „Rundenkämpfe“.
- **Startbildschirm:** drei große Knöpfe „Erstellen“, „Neues Spiel“, „Spielstand laden“; Zahnrad oben rechts öffnet die **Einstellungen** (Backup exportieren/importieren, alle Daten löschen mit doppelter Sicherheitsabfrage).
- **Erstellen:** Kachel-Übersicht aller Bausteine mit Anzahl der Einträge.
- **Einheitliche Liste** für alle Bausteine **und** für „Neues Spiel“ und „Spielstand laden“:
  - Suchfeld (sucht in Titel und Notiz, über alle Ordner hinweg)
  - **Ordner** (beliebig verschachtelt; umbenennen, löschen – beim Löschen wandert der Inhalt eine Ebene nach oben)
  - automatische **alphabetische Sortierung**, Ordner zuerst
  - kleine Anzeige von **Datum/Uhrzeit der letzten Änderung** je Eintrag
  - pro Eintrag: öffnen, duplizieren („… (Kopie)“), in Ordner verschieben, löschen
- **Automatisches Speichern** bei jeder Änderung.
- **Löschen mit Verweisen:** Wird ein Eintrag noch woanders verwendet, erscheint eine Warnung mit allen Fundstellen; beim Löschen werden die Verweise dort entfernt.
- **Gemeinsame Felder** jedes Eintrags (auch Spiele/Spielstände): **Titel**, **Notiz** (+ Ordner).
- **Darstellung** für Allys, Gegner und Objekte (sichtbare Entitäten im Spiel):
  - **Form** – Auswahl aus vorgespeicherten Vektorformen (vorläufig 8 Grundformen: Kreis, Quadrat, Dreieck, Raute, Fünfeck, Sechseck, Stern, Kreuz; die endgültige Formen-Bibliothek wird später ausgearbeitet)
  - **Farbe** – Farbrad mit Helligkeitsregler, Hex-Eingabe und Herbst-Farbvorschlägen
  - **Größe** – Standard 1, in Schritten anpassbar
- **Navigation:** Zurück-Pfeil oben links; die Android-Zurück-Taste funktioniert ebenfalls.
- **Neues Spiel:** Liste von Spiel-Konfigurationen (gleiche Funktionen wie im Editor). So lassen sich Test-Setups speichern, duplizieren und variieren. „Spielstand laden“ listet die beim Spielen gespeicherten Stände (dort kein „+ Neu“).

**Umsetzung:**
- `src/data/model.ts` – Datenmodell und Liste aller Bausteine (hier lassen sich Bausteine ergänzen)
- `src/data/collection.ts`, `src/data/references.ts` – Ordner, Sortierung, Suche, Duplizieren, Verweise (mit Tests)
- `src/screens/` – Startbildschirm, Erstellen, Liste, Eintrag, Einstellungen
- `src/ui/` – Dialoge, Formen, Farbrad, Kopfzeile

### 2 – Kampfregeln – der Kern
**Ziel:** Die grundlegenden Spielregeln, auf denen alles andere aufbaut.

**Grundsatz:** Es gibt bewusst **keine festen Regeln für Lebenspunkte, Schaden oder Verteidigung**. Lebenspunkte sind eine *Ressource* (Abschnitt 3), Angriffe sind *Fähigkeiten* (Abschnitt 5), Schutz/Verteidigung entsteht über *Effekte* (Abschnitt 4). **Kein Zufall:** alles ist berechenbar und planbar (keine Trefferchance, keine kritischen Treffer, keine Schadensschwankung).

**Feste Regeln (nicht einstellbar):**
- **Spielfeld:** quadratisches Raster, diagonale Bewegung möglich.
- **Jedes Level ist ein Kampf.** Alle Handlungen laufen in der Initiative-Reihenfolge ab; alle Gegner handeln darin mit – auch nicht sichtbare.
- **Nebel & Laterne:** Ohne Licht sieht man (fast) kein Feld. Licht bringen Licht-Fähigkeiten; die **Laterne** ist fest verankert: In jedem Team gibt es einen **Laternenträger**, der jedes Level auf einem vorgegebenen Feld beginnt und dort nicht verschoben werden kann. Die Laterne brennt auch, wenn ihr Träger bewusstlos ist.
- **Schatten** werfen nur Objekte/Gelände, die bei ihrer Erstellung als schattenwerfend festgelegt wurden. Wie weit ein Charakter ohne Licht sieht (**Eigensicht**), wird bei der Charaktererstellung festgelegt.
- **Platzierung vor Runde 1:** Alle übrigen Allys werden frei innerhalb des Lichtkegels platziert und können bis zur Bestätigung beliebig verschoben (bzw. getauscht) werden. Im nächsten Level wird die Platzierung relativ zum Laternenträger wiederholt, soweit möglich (sonst nächstes freies Feld im Licht), und kann erneut angepasst werden.
- **Initiative:** wird zu Beginn jedes Levels anhand von Werten festgelegt und gilt für das ganze Level. Unterschiedliche Geschwindigkeiten spielen keine Rolle. Pro Runde hat jeder Charakter regulär einen Zug; zusätzliche Züge (z. B. Reaktionen) sind möglich.
- **Züge bestehen aus Aktionen:** Jede Aktion (auch Bewegung) ist eine Fähigkeit. Jeder Charakter hat **Aktionsplätze**, die jeweils eine Auswahl an Fähigkeiten anbieten (z. B. A: Platz 1 = Bewegung, Platz 2 = Angriff *oder* Zauber; B: Platz 1 = Bewegung *oder* Angriff, Platz 2 = Zauber). Details in Abschnitt 5.
- **Sieg:** sobald **alle** Allys auf je einem **Siegfeld** stehen – auch bewusstlose (keiner wird zurückgelassen; ein bewusstloser Charakter muss z. B. getragen werden). Bis dahin sind Siegfelder gewöhnliche Felder: Sie können wieder verlassen werden, man kann darauf angreifen und angegriffen werden.
- **Niemand stirbt.** „Bewusstlos“ ist ein **fester Effekt** (Abschnitt 4), der z. B. bei 0 LP eintritt. Bewusstlose verpassen ihre Züge.
- **Run verloren** (die Gruppe flieht): nach den Einstellungen im Regelwerk (s. u.) und immer, wenn alle Allys bewusstlos sind. Danach: **Züge rückgängig machen** (beliebig viele), **Level neu starten** oder **zurück zum Menü**.
- Was mit Gegnern passiert (z. B. bei 0 LP), wird **beim jeweiligen Gegner** festgelegt (Abschnitt 7).

**Einstellbar im Baustein „Regelwerk“** (mehrere Regelwerke möglich, Auswahl pro Spiel unter „Neues Spiel“; ohne Auswahl gelten die Standardwerte):
| Einstellung | Standard |
|---|---|
| Diagonale Bewegung | an |
| Ecken schneiden (diagonal an Hindernis-Ecken vorbei) | aus |
| Laternen-Radius (Standard, je Ally später abweichend möglich) | 3 |
| Form des Lichtkegels (Kreis / Quadrat) | Kreis |
| Erkundete Felder bleiben aufgedeckt (Gelände ja, Figuren nein) | an |
| Initiative-Wert = Summe aus (Wert × Faktor), Werte aus den Ressourcen | – |
| Bei Initiative-Gleichstand: Allys zuerst / Gegner zuerst / abwechselnd | Allys zuerst |
| Züge pro Charakter und Runde | 1 |
| Run verloren, wenn ein Ally so viele eigene Züge am Stück bewusstlos ist (gilt auch für den Laternenträger; 0 = aus) | 2 |
| Run verloren, wenn gleichzeitig bewusstlos sind: alle Allys / bestimmte Anzahl | alle |

„Standardwerte“ sind die Voreinstellungen eines neuen Regelwerks (bzw. die Regeln, wenn kein Regelwerk gewählt ist) – keine Charakterwerte. Stats sind Ressourcen und werden beim Charakter individuell hinzugefügt.

Der Regelwerk-Editor enthält eine kleine **Licht-Vorschau**, die Laterne und Schatten mit den aktuellen Einstellungen zeigt.

**Umsetzung:**
- `src/engine/` – Spiellogik ohne Oberfläche (mit Tests): `grid.ts` (Raster, Entfernung, Sichtlinie, erreichbare Felder), `light.ts` (Licht & Nebel), `initiative.ts`, `battle.ts` (Platzierung, Runden/Züge/Aktionsplätze, Bewusstlosigkeit, Sieg/Run verloren), `history.ts` (Züge rückgängig), `rules.ts` (Regelwerk & Standardwerte)
- Der Kampfzustand ist reines JSON und kann direkt als Spielstand gespeichert werden.
- Spielbar wird der Ablauf mit der Kampf-Oberfläche (Abschnitt 13).

**Offene Punkte (für spätere Abschnitte):**
- Belegen Figuren mit Größe > 1 mehrere Felder? (vorerst belegt jede Figur genau ein Feld)
- Dürfen Figuren durch verbündete/feindliche Figuren hindurchziehen? (vorerst nein)

### 3 – Ressourcen & Attribute
**Ziel:** Frei definierbare Werte, mit denen Charaktere und Fähigkeiten arbeiten.
- Ressourcen anlegen (z. B. LP, Mana, Ausdauer, Wut, Gold) mit Min/Max, Startwert, Regeneration
- Lebenspunkte sind eine normale Ressource; wann „Bewusstlos“ eintritt (z. B. LP = 0), legt der feste Effekt fest (Abschnitt 4)
- Ressourcen/Werte liefern die Grundlage für den Initiative-Wert (Abschnitt 2)
- Attribute/Stats (z. B. Stärke, Verteidigung, Tempo) – fest vorgegeben oder frei definierbar?
- Teamweite vs. charakterbezogene Ressourcen

**Offene Punkte / Entscheidungen:** –

### 4 – Effekte
**Ziel:** Wiederverwendbare Wirkungen als Bausteine für Fähigkeiten, Objekte und Gelände.
- **Fester Effekt „Bewusstlos“:** Auslöser (z. B. LP = 0), Charakter verpasst seine Züge, kann getragen/aufgeweckt werden
- Effekttypen (Schaden, Heilung, Ressource ändern, Attribut ändern, Status wie Gift/Betäubung, Bewegung/Rückstoß, Beschwörung …)
- Dauer, Stapelbarkeit, Auslöser (sofort, pro Runde, beim Betreten, beim Treffer …)
- Bedingungen (z. B. „wenn Ziel vergiftet ist“)

**Entscheidungen:**
- Effekte werden als **eigener Baustein** im Erstell-Modus geführt. Fähigkeiten, Objekte und Geländearten setzen sich aus denselben Effekten zusammen.

**Offene Punkte:** –

### 5 – Fähigkeiten
**Ziel:** Aktionen, die Allys und Gegner im Kampf nutzen.
- **Jede Aktion ist eine Fähigkeit** – auch Bewegung, Angriff, Licht („Licht ins Dunkel“)
- **Aktionsplätze** pro Charakter: jeder Platz bietet eine Auswahl an Fähigkeiten (Abschnitt 2)
- Angriffe verändern Ressourcen des Ziels (z. B. LP −3); Schutz davor über Effekte
- Ob eine Fähigkeit durch Hindernisse blockiert wird (Sichtlinie), ist pro Fähigkeit einstellbar
- Kosten (Ressourcen), Abklingzeit, Reichweite, Zielart (Einzelziel, Fläche, selbst, Verbündete)
- Kombination mehrerer Effekte
- Passive Fähigkeiten?

**Offene Punkte / Entscheidungen:** –

### 6 – Allys
**Ziel:** Spielbare Charaktere anlegen.
- ~~Name, Bild/Symbol~~ → bereits vorhanden: Titel, Notiz, Form, Farbe, Größe (Abschnitt 1)
- Attribute, Ressourcen, Fähigkeiten, Aktionsplätze
- Laterne: Kann der Ally Laternenträger sein? Eigener Laternen-Radius?
- **Eigensicht** ohne Licht (Radius, 0 = nur eigenes Feld)
- Zusätzliche Züge pro Runde / Reaktionen
- Ausrüstung/Inventar-Plätze?
- Klassen, Stufen/Levelaufstieg?

**Offene Punkte / Entscheidungen:** –

### 7 – Gegner & Gegner-KI
**Ziel:** Nicht-spielbare Charaktere inkl. Verhalten anlegen.
- Titel, Notiz, Form, Farbe, Größe bereits vorhanden (Abschnitt 1)
- Werte und Fähigkeiten (wie Allys)
- Verhalten/KI: einfache Regeln (z. B. „greift schwächstes Ziel an“, „heilt bei < 30 % LP“) – frei konfigurierbar?
- Was passiert bei 0 LP o. Ä. (bewusstlos, flieht, verschwindet …)
- **Eigensicht** ohne Licht
- Beute/Belohnungen beim Besiegen

**Offene Punkte / Entscheidungen:** –

### 8 – Objekte / Gegenstände
**Ziel:** Sammelbare und nutzbare Gegenstände.
- Titel, Notiz, Form, Farbe, Größe bereits vorhanden (Abschnitt 1)
- Typen: Verbrauchsgegenstände, Ausrüstung, Schlüssel/Quest-Objekte, Fallen, interaktive Map-Objekte (Truhen, Hebel)?
- Wirkung über Effekte
- **Wirft Schatten** (blockiert Licht/Sicht) und blockiert ggf. Fernangriffe – pro Objekt einstellbar
- Stapelbarkeit, Inventar (Team oder pro Charakter)

**Offene Punkte / Entscheidungen:** –

### 9 – Geländearten
**Ziel:** Felder mit Eigenschaften und Effekten.
- Begehbarkeit, Bewegungskosten, Sichtblockade (wirft Schatten, blockiert ggf. Fernangriffe)
- Effekte beim Betreten/Stehen/Verlassen (z. B. Lava, Eis, Heilquelle)
- Darstellung (Farbe/Symbol/Bild)

**Offene Punkte / Entscheidungen:** –

### 10 – Level-Editor
**Ziel:** Maps bauen und befüllen.
- Größe und Form der Map
- Gelände „malen“, Gegner und Objekte platzieren
- **Laternen-Startfeld** festlegen (dort beginnt der Laternenträger)
- **Siegfelder** festlegen (Sieg, wenn alle Allys auf je einem Siegfeld stehen)
- Bedienbarkeit auf dem Smartphone (Zoom, Scrollen, Touch-Werkzeuge)

**Offene Punkte / Entscheidungen:** –

### 11 – Dungeon-Editor
**Ziel:** Level zu Dungeons aneinanderreihen.
- Reihenfolge (linear oder verzweigt?)
- Übergänge zwischen Leveln (Rast, Belohnungen, Zustand bleibt erhalten?)

**Offene Punkte / Entscheidungen:** –

### 12 – Neues Spiel (Setup)
**Ziel:** Testlauf konfigurieren und starten.
- Liste der Spiel-Konfigurationen mit Ordnern/Suche/Duplizieren existiert bereits (Abschnitt 1)
- Auswahl: Dungeon oder einzelne Level
- Regelwerk wählen (bereits vorhanden, Abschnitt 2)
- Team zusammenstellen (Anzahl Allys?), Laternenträger bestimmen
- Startgegenstände festlegen
- ggf. Test-Optionen (z. B. Gegner-Stärke-Multiplikator, Zufall fixieren)

**Offene Punkte / Entscheidungen:** –

### 13 – Spielmodus (Kampf-Oberfläche)
**Ziel:** Den Kampf spielbar und verständlich darstellen.
- Map-Anzeige, Charakterinfos, Zugreihenfolge
- Auswahl von Bewegung, Fähigkeit, Gegenstand, Ziel
- Kampf-Log (was ist passiert, welche Zahlen wurden berechnet?)
- Gegnerzüge sichtbar/nachvollziehbar
- Ende-Bildschirm bei „Run verloren“: beliebig viele Züge rückgängig machen, Level neu starten, zurück zum Menü

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

**Entscheidungen:**
- Format: JSON (siehe Abschnitt 0). Übernahme nach GameMaker ist optional; die Struktur soll aber möglichst gut lesbar und dokumentiert sein, damit sie sich bei Bedarf übertragen lässt.

**Offene Punkte:** –
