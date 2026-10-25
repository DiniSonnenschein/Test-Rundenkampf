// Art-spezifische Felder unterhalb von Titel/Notiz. Neue Editoren hier eintragen.
import type { ComponentType } from 'react';
import type { Entry } from '../../data/model';
import { EffectEditor } from './EffectEditor';
import { GameEditor } from './GameEditor';
import { ResourceEditor } from './ResourceEditor';
import { RulesEditor } from './RulesEditor';

export interface EditorProps {
  entry: Entry;
  set: (patch: Partial<Entry>) => void;
}

export const EDITORS: Record<string, ComponentType<EditorProps>> = {
  regelwerke: RulesEditor,
  ressourcen: ResourceEditor,
  effekte: EffectEditor,
  spiele: GameEditor,
};
