import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type GameStats = {
  games_played: number;
  games_won: number;
  total_points: number;
  total_tricks_won: number;
  win_rate: number;
};

type Achievement = { code: string; unlocked_at: string };

type ProfilePayload = {
  statistics: GameStats;
  achievements: Achievement[];
};

const ACHIEVEMENTS: Record<string, { title: string; description: string; icon: string }> = {
  first_game: { title: "Premier départ", description: "Terminer ta première partie", icon: "⚓" },
  veteran_10: { title: "Vieux loup de mer", description: "Terminer 10 parties", icon: "🏴‍☠️" },
  veteran_50: { title: "Légende des océans", description: "Terminer 50 parties", icon: "🌊" },
  first_victory: { title: "Premier trésor", description: "Remporter ta première partie", icon: "🏆" },
  champion_5: { title: "Capitaine confirmé", description: "Remporter 5 parties", icon: "👑" },
  champion_20: { title: "Roi des pirates", description: "Remporter 20 parties", icon: "💀" },
  score_1000: { title: "Chasseur d'or", description: "Cumuler 1 000 points", icon: "🪙" },
  score_5000: { title: "Fortune légendaire", description: "Cumuler 5 000 points", icon: "💰" },
  trick_master_50: { title: "Maître des plis", description: "Remporter 50 plis", icon: "🃏" },
  trick_master_200: { title: "Seigneur des mers", description: "Remporter 200 plis", icon: "⚔️" },
};

const panelStyle = {
  background: "linear-gradient(145deg, rgba(20,29,38,.98), rgba(8,13,19,.98))",
  border: "1px solid rgba(218,170,91,.28)",
  borderRadius: 18,
  padding: 22,
  color: "#f4ead7",
  width: "min(100%, 560px)",
  maxHeight: "min(82vh, 760px)",
  overflowY: "auto" as const,
  boxShadow: "0 24px 80px rgba(0,0,0,.55)",
};

export default function GameProfile() {
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: requestError } = await supabase.rpc("get_my_game_profile_stats");
    if (requestError) {
      setError(requestError.message);
      setLoading(false);
      return;
    }
    const result = data as ProfilePayload | null;
    setPayload(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const stats = payload?.statistics;
  const unlocked = new Set((payload?.achievements ?? []).map((item) => item.code));

  return (
    <section style={panelStyle} aria-label="Profil de jeu">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ color: "#d9aa5b", fontSize: 11, letterSpacing: 2, fontWeight: 800 }}>DOSSIER DU PIRATE</div>
          <h2 style={{ margin: "5px 0 0", fontSize: 25 }}>Mon profil</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => void loadProfile()} disabled={loading} style={{ border: "1px solid #8d7048", color: "#f4ead7", background: "rgba(218,170,91,.12)", borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
            {loading ? "Chargement…" : "Actualiser"}
          </button>
          <button type="button" onClick={async () => {
            setSigningOut(true);
            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) {
              setError(signOutError.message);
              setSigningOut(false);
            }
          }} disabled={signingOut} style={{ border: "1px solid rgba(255,130,110,.55)", color: "#ffd6cc", background: "rgba(150,45,35,.22)", borderRadius: 10, padding: "9px 12px", cursor: signingOut ? "wait" : "pointer" }}>
            {signingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </header>

      {error && <p role="alert" style={{ color: "#ff9b88" }}>{error}</p>}
      {loading && !payload && <p>Chargement de tes statistiques…</p>}

      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["Parties jouées", stats.games_played],
              ["Victoires", stats.games_won],
              ["Points cumulés", stats.total_points.toLocaleString("fr-FR")],
              ["Plis remportés", stats.total_tricks_won],
              ["Taux de victoire", `${stats.win_rate}%`],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ color: "#b7aa96", fontSize: 12 }}>{label}</div>
                <strong style={{ display: "block", marginTop: 5, fontSize: 23, color: "#e7bd75" }}>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Succès & badges</h3>
              <span style={{ color: "#d9aa5b", fontSize: 12 }}>{unlocked.size}/{Object.keys(ACHIEVEMENTS).length} débloqués</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(205px, 1fr))", gap: 9, marginTop: 12 }}>
              {Object.entries(ACHIEVEMENTS).map(([code, achievement]) => {
                const earned = unlocked.has(code);
                return (
                  <article key={code} style={{ display: "flex", gap: 11, alignItems: "center", padding: 12, borderRadius: 12, background: earned ? "rgba(218,170,91,.13)" : "rgba(255,255,255,.025)", border: `1px solid ${earned ? "rgba(218,170,91,.4)" : "rgba(255,255,255,.07)"}`, opacity: earned ? 1 : .58 }}>
                    <span style={{ fontSize: 25, filter: earned ? "none" : "grayscale(1)" }}>{achievement.icon}</span>
                    <span>
                      <strong style={{ display: "block", fontSize: 13 }}>{achievement.title}</strong>
                      <small style={{ color: "#b7aa96" }}>{achievement.description}</small>
                      <small style={{ display: "block", color: earned ? "#e7bd75" : "#8d8b87", marginTop: 3 }}>{earned ? "DÉBLOQUÉ" : "VERROUILLÉ"}</small>
                    </span>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
