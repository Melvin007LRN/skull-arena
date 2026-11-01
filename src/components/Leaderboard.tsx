import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Crown, RefreshCw, Trophy, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";

type Leader = {
  rank_position: number;
  player_id: string;
  username: string;
  games_played: number;
  games_won: number;
  total_points: number;
  total_tricks_won: number;
  win_rate: number;
  achievements: string[];
};

type PublicProfile = Omit<Leader, "rank_position">;

const panel: React.CSSProperties = {
  width: "min(100%, 680px)",
  maxHeight: "min(82vh, 820px)",
  overflowY: "auto",
  padding: 22,
  color: "#f4ead7",
  background: "linear-gradient(145deg, rgba(20,29,38,.99), rgba(8,13,19,.99))",
  border: "1px solid rgba(218,170,91,.3)",
  borderRadius: 18,
};

const statCard: React.CSSProperties = {
  padding: 13,
  borderRadius: 12,
  background: "rgba(255,255,255,.045)",
  border: "1px solid rgba(255,255,255,.08)",
};

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: requestError } = await supabase.rpc("get_public_leaderboard", { p_limit: 100 });
    if (requestError) {
      setError(requestError.message);
      setLoading(false);
      return;
    }
    setLeaders(Array.isArray(data) ? data as Leader[] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const openProfile = async (playerId: string) => {
    setError("");
    const { data, error: requestError } = await supabase.rpc("get_public_player_profile", { p_player_id: playerId });
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setSelected(data as PublicProfile);
  };

  return (
    <section style={panel} aria-label="Classement général">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ color: "#d9aa5b", fontSize: 11, letterSpacing: 2, fontWeight: 800 }}>LES LÉGENDES DES SEPT MERS</div>
          <h2 style={{ margin: "5px 0 0", fontSize: 25 }}>Classement général</h2>
        </div>
        <button type="button" onClick={() => void loadLeaderboard()} disabled={loading} aria-label="Actualiser le classement" style={{ border: "1px solid #8d7048", color: "#f4ead7", background: "rgba(218,170,91,.12)", borderRadius: 10, padding: 10 }}>
          <RefreshCw size={17} />
        </button>
      </header>

      {selected ? (
        <div>
          <button type="button" onClick={() => setSelected(null)} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: 0, background: "transparent", color: "#e7bd75", padding: "5px 0 16px", cursor: "pointer" }}>
            <ArrowLeft size={16} /> Retour au classement
          </button>
          <div style={{ textAlign: "center", padding: "14px 0 20px" }}>
            <UserRound size={42} color="#d9aa5b" />
            <h2 style={{ margin: "8px 0 0", fontSize: 26 }}>{selected.username}</h2>
            <span style={{ color: "#b7aa96", fontSize: 12 }}>PROFIL PUBLIC DU PIRATE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
            {[
              ["Parties jouées", selected.games_played],
              ["Victoires", selected.games_won],
              ["Points cumulés", selected.total_points.toLocaleString("fr-FR")],
              ["Plis remportés", selected.total_tricks_won],
              ["Taux de victoire", selected.win_rate + "%"],
            ].map(([label, value]) => <div key={label} style={statCard}><div style={{ color: "#b7aa96", fontSize: 12 }}>{label}</div><strong style={{ display: "block", color: "#e7bd75", fontSize: 23, marginTop: 5 }}>{value}</strong></div>)}
          </div>
          <h3 style={{ margin: "24px 0 12px" }}>Succès débloqués</h3>
          {selected.achievements.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selected.achievements.map(code => <span key={code} style={{ border: "1px solid rgba(218,170,91,.35)", background: "rgba(218,170,91,.1)", borderRadius: 20, padding: "7px 11px", color: "#e7bd75", fontSize: 12 }}>{code.replaceAll("_", " ")}</span>)}
            </div>
          ) : <p style={{ color: "#b7aa96" }}>Aucun succès débloqué pour le moment.</p>}
        </div>
      ) : (
        <>
          {error && <p role="alert" style={{ color: "#ff9b88" }}>{error}</p>}
          {loading ? <p>Chargement des pirates…</p> : leaders.length === 0 ? (
            <div style={{ textAlign: "center", padding: 28, color: "#b7aa96" }}>
              <Trophy size={36} color="#d9aa5b" />
              <p>Aucune partie terminée pour le moment. Le classement se remplira après les premières victoires.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {leaders.map(player => (
                <button key={player.player_id} type="button" onClick={() => void openProfile(player.player_id)} style={{ display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", alignItems: "center", gap: 10, textAlign: "left", padding: 13, borderRadius: 12, color: "#f4ead7", background: player.rank_position === 1 ? "rgba(218,170,91,.15)" : "rgba(255,255,255,.035)", border: "1px solid rgba(218,170,91,.2)", cursor: "pointer" }}>
                  <strong style={{ color: "#e7bd75", fontSize: 17 }}>{player.rank_position === 1 ? <Crown size={21} /> : "#" + player.rank_position}</strong>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block" }}>{player.username}</strong>
                    <small style={{ color: "#b7aa96" }}>{player.games_won} victoire(s) · {player.games_played} partie(s) · {player.win_rate}%</small>
                  </span>
                  <strong style={{ color: "#e7bd75", whiteSpace: "nowrap" }}>{player.total_points.toLocaleString("fr-FR")} pts</strong>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
