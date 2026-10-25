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
| 3 | Ressourcen & Attribute | ✅ |
| 4 | Effekte | ✅ |
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
- **Blickrichtung:** 4 Richtungen. Ein Charakter blickt automatisch in die Richtung seiner letzten Bewegung (diagonal: die passende bisherige Richtung bleibt, sonst die senkrechte) und kann sie in seinem Zug beliebig oft ändern. Gegner wenden sich am Ende ihres Zuges ihrem Ziel zu (vorherrschende Achse; steht es genau diagonal, ändert sich nichts). Allys können ihre Blickrichtung auch während der Platzierung einstellen (Start: oben).
- **Bereichs-Auswahl:** 9×9-Raster mit dem Charakter in der Mitte (Blick nach oben); gewählte Felder drehen sich mit der Blickrichtung. Wird für Sicht, Reichweiten, Auslösebereiche usw. verwendet.
- **Jedes Level ist ein Kampf.** Alle Handlungen laufen in der Initiative-Reihenfolge ab; alle Gegner handeln darin mit – auch nicht sichtbare.
- **Nebel & Laterne:** Ohne Licht sieht man (fast) kein Feld. Licht bringen Licht-Fähigkeiten; die **Laterne** ist fest verankert: In jedem Team gibt es einen **Laternenträger**, der jedes Level auf einem vorgegebenen Feld beginnt und dort nicht verschoben werden kann. Die Laterne brennt auch, wenn ihr Träger bewusstlos ist.
- **Schatten** werfen nur Objekte/Gelände, die bei ihrer Erstellung als schattenwerfend festgelegt wurden. Was ein Charakter im Nebel sieht (**Sicht**), wird bei der Charaktererstellung als Bereich festgelegt (Effekte können ihn ersetzen). Sicht wird durch Schatten blockiert.
- **Geteilte Sicht:** Jeder Ally sieht alle beleuchteten/aufgedeckten Felder und alles, was andere Allys sehen.
- **Platzierung vor Runde 1:** Alle übrigen Allys werden frei innerhalb des Lichtkegels platziert und können bis zur Bestätigung beliebig verschoben (bzw. getauscht) werden. Im nächsten Level wird die Platzierung relativ zum Laternenträger wiederholt, soweit möglich (sonst nächstes freies Feld im Licht), und kann erneut angepasst werden.
- **Initiative:** wird zu Beginn jedes Levels anhand der festen Ressource „Initiative“ festgelegt (höchster Wert zuerst) und gilt für das ganze Level. Unterschiedliche Geschwindigkeiten spielen keine Rolle. Pro Runde hat jeder Charakter regulär einen Zug; zusätzliche Züge (z. B. Reaktionen) sind möglich.
- **Züge bestehen aus Aktionen:** Jede Aktion (auch Bewegung) ist eine Fähigkeit. Jeder Charakter hat **Aktionsplätze**, die jeweils eine Auswahl an Fähigkeiten anbieten (z. B. A: Platz 1 = Bewegung, Platz 2 = Angriff *oder* Zauber; B: Platz 1 = Bewegung *oder* Angriff, Platz 2 = Zauber). Details in Abschnitt 5.
- **Sieg:** sobald **alle** Allys auf je einem **Siegfeld** stehen – auch bewusstlose (keiner wird zurückgelassen; ein bewusstloser Charakter muss z. B. getragen werden). Bis dahin sind Siegfelder gewöhnliche Felder: Sie können wieder verlassen werden, man kann darauf angreifen und angegriffen werden.
- **Niemand stirbt.** „Bewusstlos“ ist ein **fester Effekt** (Abschnitt 4), der z. B. bei 0 LP eintritt. Ob Bewusstlose ihre Züge aussetzen, wird im Effekt festgelegt; für „Run verloren“ zählen die eigenen Züge, in denen ein Charakter den Effekt hat.
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
| Außerhalb des eigenen Zuges zur Quelle drehen, wenn Ziel von: nie / gegnerischen / allen / bestimmten Typen von Fähigkeiten/Effekten | nie |
| Bei Initiative-Gleichstand: Allys zuerst / Gegner zuerst / abwechselnd | Allys zuerst |
| Züge pro Charakter und Runde | 1 |
| Run verloren, wenn ein Ally so viele eigene Züge am Stück bewusstlos ist (gilt auch für den Laternenträger; 0 = aus) | 2 |
| Run verloren, wenn gleichzeitig bewusstlos sind: alle Allys / bestimmte Anzahl | alle |

„Standardwerte“ sind die Voreinstellungen eines neuen Regelwerks (bzw. die Regeln, wenn kein Regelwerk gewählt ist) – keine Charakterwerte. Stats sind Ressourcen und werden beim Charakter individuell hinzugefügt.

Der Regelwerk-Editor enthält eine kleine **Licht-Vorschau**, die Laterne und Schatten mit den aktuellen Einstellungen zeigt.

**Umsetzung:**
- `src/engine/` – Spiellogik ohne Oberfläche (mit Tests): `grid.ts` (Raster, Entfernung, Sichtlinie, erreichbare Felder), `light.ts` (Licht & Nebel), `initiative.ts`, `battle.ts` (Platzierung, Runden/Züge/Aktionsplätze, Blickrichtung, Bewusstlosigkeit, Sieg/Run verloren), `facing.ts` (Blickrichtung & Bereiche), `history.ts` (Züge rückgängig), `rules.ts` (Regelwerk & Standardwerte)
- Der Kampfzustand ist reines JSON und kann direkt als Spielstand gespeichert werden.
- Spielbar wird der Ablauf mit der Kampf-Oberfläche (Abschnitt 13).

**Offene Punkte (für spätere Abschnitte):**
- Belegen Figuren mit Größe > 1 mehrere Felder? (vorerst belegt jede Figur genau ein Feld)
- Dürfen Figuren durch verbündete/feindliche Figuren hindurchziehen? (vorerst nein)

### 3 – Ressourcen & Attribute
**Ziel:** Frei definierbare Werte, mit denen Charaktere und Fähigkeiten arbeiten.

**Grundregeln:**
- **Alle Stats sind Ressourcen** (z. B. LP, Mana, Stärke). Allys und Gegner nutzen dieselben Ressourcen.
- Nur **ganze Zahlen**. **Minimum immer 0.** Ein Minus vor einer Zahl bedeutet „verringern“ (±-Knopf am Zahlenfeld).
- Ressourcen verändern sich immer nur um **± einen Betrag**; zwischen Leveln wird nichts automatisch zurückgesetzt – Werte laufen über den ganzen Run weiter.
- Ob eine **Fähigkeit** das Maximum überschreiten darf, legt die Fähigkeit fest. **Automatische Veränderungen** überschreiten das Maximum nie.
- Sonstige Veränderungen (z. B. durch Fähigkeiten) werden dort festgelegt. Weiterer Schutz läuft über Effekte und Gegenstände.

**Feste Ressource „Initiative“:** existiert immer, ist bearbeitbar, aber **nicht löschbar**. Der Wert jedes Charakters bestimmt seine Position in der Initiative-Reihe (höchster zuerst; Gleichstand regelt das Regelwerk). Ändert sich der Wert während eines Levels, bleibt die Reihenfolge; der neue Wert gilt **ab dem nächsten Level**.

**Beim Anlegen einer Ressource – zuerst die Art:**

*Globale Ressource* (Pool, auf den alle Allys Zugriff haben):
| Einstellung | Inhalt |
|---|---|
| Maximum | ja/nein, ggf. Höhe |
| Startwert | Menge zu Beginn des Spiels |
| Automatische Veränderungen | beliebig viele (+): pro **Runde** oder **Level**, **zu Beginn** oder **am Ende**, ±Wert |
| Anpassung durch Fähigkeiten | beliebig viele (+): Fähigkeit (bzw. Kategorie) → ±Wert |
| Events | beliebig viele (+), s. u. Folgen: Run gewonnen · Run verloren · Effekt auf alle Allys · Effekt auf alle Gegner · andere globale Ressource ±Wert |

*Individuelle Ressource* (an einen Charakter gebunden):
| Einstellung | Inhalt |
|---|---|
| Anzeige | ein/aus: beim **Antippen der Figur** als Balken mit Zahl (z. B. 4/10) |
| Farbe | über das Farbrad |
| Events | beliebig viele (+), s. u. Folgen: Run gewonnen · Run verloren · Charakter erhält Effekt (für X Runden / unendlich / bis zur Auflösung) · andere Ressource desselben Charakters ±Wert |

**Pro Charakter** (Abschnitte 6/7) werden für individuelle Ressourcen festgelegt: Maximum, Startwert, automatische Veränderungen (pro **Zug**, Runde oder Level; zu Beginn/am Ende; ±Wert; mehrfach) und Anpassungen durch Fähigkeiten.

**Anpassung durch Fähigkeiten:** verändert den **Betrag** der Wirkung, z. B. Angriff −8 LP mit Anpassung −5 → −3 LP (wirkt wie 5 Verteidigung); Heilung +6 mit −2 → +4. Die Wirkung kippt nie um (endet bei 0). Gilt für eine Fähigkeit oder eine **Fähigkeiten-Kategorie** (Kategorien folgen in Abschnitt 5).

**Events:** Grenzwert + Richtung („fällt auf/unter“ bzw. „steigt auf/über“). Ein Event löst **jedes Mal** aus, wenn die Grenze (erneut) erreicht bzw. überschritten wird. Beliebig viele Events pro Ressource.

**Anzeige im Kampf:** Antippen einer Figur zeigt ihre Ressourcen-Balken; globale Ressourcen stehen dauerhaft in einer Leiste am oberen Bildschirmrand.

**Umsetzung:**
- `src/engine/resources.ts` – Typen und Rechenregeln (Veränderung mit Min/Max, Anpassung, Event-Auslösung) mit Tests
- `src/screens/editors/ResourceEditor.tsx` – Editor; die Bausteine „Automatische Veränderung“ und „Anpassung durch Fähigkeiten“ werden in der Charaktererstellung wiederverwendet
- Regelwerk: Initiative kommt jetzt direkt aus der Ressource „Initiative“; dort bleibt nur die Gleichstand-Regel

### 4 – Effekte
**Ziel:** Dauerhafte Zustände auf Allys und Gegnern.

**Grundprinzip:**
- Effekte sind dauerhaft (im Gegensatz zu Fähigkeiten). **Alle Charaktere** können grundsätzlich von allen Effekten betroffen sein; Ausnahmen werden bei der Charaktererstellung hinterlegt.
- Ein Effekt ist aktiv, bis ein Endzeitpunkt erreicht ist oder er aufgehoben wird. Gibt die Quelle eine Dauer vor (X Runden / unendlich / bis zur Auflösung) und hat der Effekt eigene Beendigungen, gilt **was zuerst eintritt**.
- Danach wird **alles Dauerhafte zurückgesetzt** (z. B. Stärke −6). Wiederkehrende Veränderungen (z. B. Gift −1 LP pro Zug) bleiben.
- Wird ein Effekt durch eine Fähigkeit oder einen anderen Effekt ausgelöst bzw. beendet, wird das **dort** festgelegt.

**Grundeinstellungen:**
- **Darstellung:** an/aus – farbiger Kreis um den Charakter (Farbe über das Farbrad).
- **Typen:** beliebig viele (z. B. „positiv“, „Gift“). Ohne eigene Wirkung; gruppieren Effekte und Fähigkeiten, damit andere gezielt darauf zugreifen können.
- **Stapelbar:** ja/nein, ggf. wie oft (jeder Stapel hat seine eigene Dauer). Nicht stapelbar: ein erneuter Erhalt erneuert den Effekt; ist das Maximum erreicht, ersetzt der neue Stapel den ältesten.
- **Unverträglichkeit:** wird im **dominanteren** Effekt festgelegt – er beendet die genannten Effekte und verhindert ihr Hinzukommen, solange er aktiv ist.

**Bausteine** (beliebig viele, mit „+“):
| Baustein | Inhalt |
|---|---|
| Ressource verändern | **dauerhaft** (solange aktiv) oder **wiederkehrend** pro Zug/Runde/Level, zu Beginn/am Ende; ±Wert; darf Maximum überschreiten ja/nein |
| Weiteren Effekt hinzufügen | pro Runde/Level (zu Beginn/am Ende) oder einmalig nach X Runden; mit Dauer |
| Fähigkeiten ersetzen | eine oder mehrere Fähigkeiten → eine oder mehrere andere |
| Fähigkeiten hinzufügen | eine oder mehrere |
| Reaktion hinzufügen | wie im Charakter-Editor (Abschnitt 6) |
| Möglichkeit verlieren | einen Zug zu tätigen (setzt aus) / eine Reaktion / grundsätzlich Fähigkeiten / Fähigkeiten bestimmter Typen |
| Sicht im Nebel ersetzen | per Bereichs-Auswahl; Schatten verdecken weiterhin |
| Verhalten ändern | Gegner: neues Hauptziel; Allys: unkontrollierbar mit Hauptziel (Details Abschnitt 7) |
| Gelände-Effekte ignorieren | durch Betreten/Verlassen aller oder bestimmter Geländearten |
| Hindernisse ignorieren | Objekte / Allys / Gegner / Gelände – alle oder bestimmte (Einträge und/oder Typen) |
| Ressource unveränderlich | eine globale oder eigene Ressource kann nicht verändert werden durch: alle / gegnerische / Ally- / eigene Fähigkeiten & Effekte / bestimmte Typen |
| Nicht wahrnehmbar | für alle oder bestimmte Charaktere: nicht anvisierbar (AOE trifft trotzdem), Gegner behandeln ihn als nicht existent; Darstellung: Gegner unsichtbar, Allys transparent |

**Auslöser** (wann ein Charakter den Effekt erhält; beliebig viele):
- startet damit ins Spiel
- Level enthält ein bestimmtes Objekt / einen Gegner / Ally (geprüft zu Beginn jedes Levels)
- ein Gegner / Ally / Objekt (beliebig, bestimmte Einträge oder Typen) **erscheint in** bzw. **verlässt** einen Bereich (Bereichs-Auswahl)
- wird Ziel einer Fähigkeit/eines Effekts: von beliebiger Quelle / von Allys / von Gegnern / bestimmter Typen
- eine Ressource verändert sich: generell / positiv / negativ / um einen Mindestwert
- eine Ressource fällt auf/unter bzw. steigt auf/über einen Wert
- sammelt / verwendet / platziert einen bestimmten Gegenstand

**Beendigung:** nach X eigenen Zügen / Runden / Leveln (gezählt zu Beginn oder am Ende) sowie dieselben Möglichkeiten wie bei den Auslösern.

**Fester Effekt „Bewusstlos“:** wird wie andere Effekte behandelt, kann aber nicht gelöscht werden. Anfangs leer (nur der Name); die „Run verloren“-Bedingungen stehen im Regelwerk. Ob Bewusstlose Züge aussetzen, wird über den Baustein „Möglichkeit verlieren: Zug“ festgelegt.

**Typen-Listen** (Einstellungen → Typen; dort hinzufügen, umbenennen, löschen – oder direkt beim Zuweisen anlegen):
- **Typen für Fähigkeiten & Effekte** (gemeinsame Liste)
- **Typen für Allys & Gegner**

**Umsetzung:**
- `src/engine/effects.ts` – Datenmodell und Laufzeit-Regeln (Stapeln, Unverträglichkeit, Dauer/Beendigung, dauerhafte Veränderungen) mit Tests
- `src/engine/facing.ts` – Blickrichtung und Bereichs-Auswahl (Drehung)
- `src/ui/AreaPicker.tsx` – Bereichs-Auswahl (wird in den Editoren für Charaktere, Objekte und Fähigkeiten wiederverwendet)
- `src/ui/pickers.tsx` – Mehrfach-Auswahl von Einträgen und Typen
- `src/screens/editors/EffectEditor.tsx`, `src/screens/TypeManager.tsx`
- Die Bausteine wirken im Kampf, sobald die Kampf-Oberfläche (Abschnitt 13) sie verbindet.

### 5 – Fähigkeiten
**Ziel:** Aktionen, die Allys und Gegner im Kampf nutzen.
- **Jede Aktion ist eine Fähigkeit** – auch Bewegung, Angriff, Licht („Licht ins Dunkel“). Bewegung ist keine feste Fähigkeit; sie wird z. B. über einen Typ „Bewegung“ und eine Ressource „Schritte“ abgebildet.
- **Typen** aus der gemeinsamen Liste „Fähigkeiten & Effekte“
- Ob eine Fähigkeit Effekte auslöst oder beendet (inkl. Dauer), wird in der Fähigkeit festgelegt
- Reichweite / Wirkungsbereich über die **Bereichs-Auswahl**
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
- Ressourcen je Charakter: Maximum, Startwert, automatische Veränderungen (pro Zug/Runde/Level), Anpassungen durch Fähigkeiten; Initiative-Wert
- Fähigkeiten, Aktionsplätze
- Laterne: Kann der Ally Laternenträger sein? Eigener Laternen-Radius?
- **Sicht im Nebel** per Bereichs-Auswahl
- **Typen** aus der Liste „Allys & Gegner“
- **Reaktionen** (kleine Zwischen-Züge, die nicht als Züge gelten und durch ein Ereignis einmalig ausgelöst werden)
- Ausnahmen: Effekte, von denen der Charakter nicht betroffen sein kann
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
- **Sicht im Nebel** per Bereichs-Auswahl, **Typen**, Reaktionen, Effekt-Ausnahmen (wie Allys)
- **Hauptziel**: Wie wählt ein Gegner (bzw. ein unkontrollierbarer Ally) sein Hauptziel?
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
- Startpositionen und **Blickrichtung** der Gegner
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
