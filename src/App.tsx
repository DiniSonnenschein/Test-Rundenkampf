import { getDef } from './data/model';
import { useRoute } from './router';
import { CreateScreen } from './screens/CreateScreen';
import { EntryScreen } from './screens/EntryScreen';
import { ListScreen } from './screens/ListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StartScreen } from './screens/StartScreen';
import { DialogProvider } from './ui/Dialog';
import { Leaves } from './ui/Leaves';

function Screen() {
  const [page, key, a, b] = useRoute();
  const def = key ? getDef(key) : undefined;

  if (page === 'einstellungen') return <SettingsScreen />;
  if (page === 'erstellen') return <CreateScreen />;
  if (page === 'liste' && def) return <ListScreen key={`${key}/${b ?? ''}`} def={def} folderId={a === 'ordner' ? b : null} />;
  if (page === 'eintrag' && def && a) return <EntryScreen key={a} def={def} id={a} />;
  return <StartScreen />;
}

export function App() {
  return (
    <DialogProvider>
      <Leaves />
      <Screen />
    </DialogProvider>
  );
}
