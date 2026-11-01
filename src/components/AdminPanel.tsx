import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Phrase = { id: string; phrase: string; sort_order: number; is_active: boolean };

export default function AdminPanel() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [phrase, setPhrase] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: requestError } = await supabase.rpc("get_quick_chat_phrases");
    if (requestError) setError(requestError.message);
    else setPhrases((Array.isArray(data) ? data : []) as Phrase[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reset = () => {
    setPhrase("");
    setEditingId(null);
    setSortOrder("0");
    setIsActive(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phrase.trim() || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const { error: saveError } = await supabase.rpc("save_quick_chat_phrase", {
      p_id: editingId,
      p_phrase: phrase.trim(),
      p_sort_order: Number(sortOrder) || 0,
      p_is_active: isActive,
    });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setNotice(editingId ? "Phrase modifiée." : "Phrase ajoutée.");
    reset();
    await load();
  };

  const edit = (item: Phrase) => {
    setEditingId(item.id);
    setPhrase(item.phrase);
    setSortOrder(String(item.sort_order));
    setIsActive(item.is_active);
    setNotice("");
  };

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette phrase ?")) return;
    const { error: deleteError } = await supabase.rpc("delete_quick_chat_phrase", { p_id: id });
    if (deleteError) setError(deleteError.message);
    else { setNotice("Phrase supprimée."); await load(); }
  };

  return (
    <section style={{ width: "min(100%, 650px)", maxHeight: "82vh", overflowY: "auto", padding: 22, borderRadius: 18, color: "#f4ead7", background: "linear-gradient(145deg,#17232d,#090e14)", border: "1px solid rgba(218,170,91,.35)" }}>
      <div style={{ color: "#d9aa5b", fontSize: 11, letterSpacing: 2, fontWeight: 800 }}>SKULL ARENA • CONTRÔLE</div>
      <h2 style={{ margin: "6px 0 18px" }}>Administration — Quick Chat</h2>
      <form onSubmit={save} style={{ display: "grid", gap: 10, padding: 14, borderRadius: 12, background: "rgba(255,255,255,.04)" }}>
        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>
          Phrase (90 caractères maximum)
          <input value={phrase} maxLength={90} onChange={(e) => setPhrase(e.target.value)} placeholder="Ex. Bien joué, capitaine !" required style={{ padding: 11, borderRadius: 8, color: "#fff", background: "#0b1219", border: "1px solid #52606b" }} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Ordre
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ width: 90, padding: 8, borderRadius: 8 }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 18, fontSize: 13 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" disabled={saving || !phrase.trim()} style={{ padding: "10px 15px", border: 0, borderRadius: 8, background: "#d9aa5b", color: "#17120a", fontWeight: 800 }}>{saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter la phrase"}</button>
          {editingId && <button type="button" onClick={reset} style={{ padding: "10px 15px", borderRadius: 8 }}>Annuler</button>}
        </div>
      </form>
      {error && <p role="alert" style={{ color: "#ff9b88" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#9fe0ac" }}>{notice}</p>}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Bibliothèque de phrases</h3>
          <button type="button" onClick={() => void load()} disabled={loading}>Actualiser</button>
        </div>
        {loading ? <p>Chargement…</p> : phrases.length === 0 ? <p>Aucune phrase enregistrée.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {phrases.map((item) => (
              <article key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 11, borderRadius: 10, background: "rgba(255,255,255,.045)", opacity: item.is_active ? 1 : .55 }}>
                <div><strong>{item.phrase}</strong><small style={{ display: "block", color: "#b7aa96" }}>Ordre {item.sort_order} • {item.is_active ? "Active" : "Désactivée"}</small></div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => edit(item)}>Modifier</button>
                  <button type="button" onClick={() => void remove(item.id)}>Supprimer</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
