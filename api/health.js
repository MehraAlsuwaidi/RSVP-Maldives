import { ensureSchema, schemaState } from '../lib/db.js';
import { pinConfigured } from '../lib/auth.js';
import { send } from '../lib/http.js';

/** Setup check with no guest data: is the database reachable and the PIN configured? */
export default async function handler(req, res) {
  let database = false;
  try {
    await ensureSchema();
    database = true;
  } catch {
    /* reported below */
  }
  send(res, 200, { ok: database && pinConfigured(), database, pinConfigured: pinConfigured(), phoneUniqueIndex: schemaState.phoneUniqueIndex });
}
