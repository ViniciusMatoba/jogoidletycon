import { db, doc, getDoc, setDoc } from './auth.js';

const SAVE_KEY    = 'idle_hunter_tycoon_save';
const COLLECTION  = 'saves';

// ─── Salvar na Nuvem ─────────────────────────────────────────────────────────

export async function saveToCloud(uid, data) {
  try {
    await setDoc(doc(db, COLLECTION, uid), { save: JSON.stringify(data), updatedAt: Date.now() });
  } catch (e) {
    console.warn('[CloudSave] Falha ao salvar na nuvem:', e.message);
  }
}

// ─── Carregar da Nuvem ────────────────────────────────────────────────────────

export async function loadFromCloud(uid) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().save);
  } catch (e) {
    console.warn('[CloudSave] Falha ao carregar da nuvem:', e.message);
    return null;
  }
}

// ─── Migração: localStorage → Nuvem ──────────────────────────────────────────
// Se o jogador tem um save local mas ainda não salvou na nuvem, migra automaticamente.

export async function migrateLocalToCloud(uid) {
  const local = localStorage.getItem(SAVE_KEY);
  if (!local) return false;

  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (snap.exists()) return false; // nuvem já tem dados — não sobrescreve

  await saveToCloud(uid, JSON.parse(local));
  console.info('[CloudSave] Save local migrado para a nuvem.');
  return true;
}
