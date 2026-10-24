// Einfache Dialoge (Bestätigen, Texteingabe, Auswahlmenü) als Bottom-Sheet.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface MenuItem<T> {
  label: string;
  value: T;
  danger?: boolean;
}

type DialogState =
  | { kind: 'confirm'; title: string; message?: ReactNode; confirmLabel: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; initial: string; confirmLabel: string; resolve: (v: string | null) => void }
  | { kind: 'menu'; title?: string; items: MenuItem<unknown>[]; resolve: (v: unknown) => void };

interface DialogApi {
  confirm(opts: { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }): Promise<boolean>;
  prompt(opts: { title: string; initial?: string; confirmLabel?: string }): Promise<string | null>;
  menu<T>(opts: { title?: string; items: MenuItem<T>[] }): Promise<T | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('DialogProvider fehlt');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const api: DialogApi = {
    confirm: (o) =>
      new Promise((resolve) =>
        setState({ kind: 'confirm', confirmLabel: 'OK', ...o, resolve }),
      ),
    prompt: (o) =>
      new Promise((resolve) =>
        setState({ kind: 'prompt', initial: '', confirmLabel: 'OK', ...o, resolve }),
      ),
    menu: <T,>(o: { title?: string; items: MenuItem<T>[] }) =>
      new Promise<T | null>((resolve) =>
        setState({ kind: 'menu', ...o, resolve: resolve as (v: unknown) => void }),
      ),
  };

  function close(value: unknown) {
    if (!state) return;
    (state.resolve as (v: unknown) => void)(value);
    setState(null);
  }

  const cancelValue = state?.kind === 'confirm' ? false : null;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        <div className="sheet-backdrop" onClick={() => close(cancelValue)}>
          <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            {state.kind === 'confirm' && (
              <>
                <h2>{state.title}</h2>
                {state.message && <div className="sheet-message">{state.message}</div>}
                <div className="btn-row">
                  <button className="btn" onClick={() => close(false)}>Abbrechen</button>
                  <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                    {state.confirmLabel}
                  </button>
                </div>
              </>
            )}
            {state.kind === 'prompt' && <PromptBody state={state} close={close} />}
            {state.kind === 'menu' && (
              <>
                {state.title && <h2>{state.title}</h2>}
                <div className="sheet-menu">
                  {state.items.map((item, i) => (
                    <button key={i} className={`menu-item ${item.danger ? 'danger' : ''}`} onClick={() => close(item.value)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <button className="btn" onClick={() => close(null)}>Abbrechen</button>
              </>
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

function PromptBody({ state, close }: { state: Extract<DialogState, { kind: 'prompt' }>; close: (v: unknown) => void }) {
  const [value, setValue] = useState(state.initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) close(value.trim());
      }}
    >
      <h2>{state.title}</h2>
      <input ref={input} className="input" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={() => close(null)}>Abbrechen</button>
        <button type="submit" className="btn btn-primary" disabled={!value.trim()}>{state.confirmLabel}</button>
      </div>
    </form>
  );
}
