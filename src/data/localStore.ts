import { Storage } from './storage';

/** Der Speicher der App auf dem Gerät. */
export const storage = new Storage(window.localStorage);
