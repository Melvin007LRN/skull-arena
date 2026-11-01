
import { useCallback, useEffect, useState, FormEvent } from "react";
import {
  Trophy,
  Crown,
  Target,
  Swords,
  Award,
  RefreshCw,
  LogOut,
  Shield,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type AuthPanelProps = {
  onAuthenticated?: () => void;
};

type PlayerStatistics = {
  games_played: number;
  games_won: number;
  total_points: number;
  total_tricks_won: number;
  win_rate: number;
};

type Achievement = {
  code: string;
  unlocked_at: string;
};

type ProfileStats = {
  statistics: PlayerStatistics;
  achievements: Achievement[];
};

const defaultStats: PlayerStatistics = {
  games_played: 0,
  games_won: 0,
  total_points: 0,
  total_tricks_won: 0,
  win_rate: 0,
};

const achievementDefinitions: Record<
  string,
  { title: string; description: string; icon: string }
> = {
  first_game: {
    title: "Premier voyage",
    description: "Terminer ta première partie",
    icon: "⚓",
  },
  veteran_10: {
    title: "Vieux loup de mer",
    description: "Jouer 10 parties",
    icon: "🏴‍☠️",
  },
  veteran_50: {
    title: "Légende des océans",
    description: "Jouer 50 parties",
    icon: "🌊",
  },
  first_victory: {
    title: "Première victoire",
    description: "Remporter ta première partie",
    icon: "🏆",
  },
  champion_5: {
    title: "Champion",
    description: "Remporter 5 parties",
    icon: "👑",
  },
  champion_20: {
    title: "Roi des pirates",
    description: "Remporter 20 parties",
    icon: "💀",
  },
  score_1000: {
    title: "Chasseur de trésors",
    description: "Atteindre 1 000 points",
    icon: "💰",
  },
  score_5000: {
    title: "Fortune légendaire",
    description: "Atteindre 5 000 points",
    icon: "💎",
  },
  trick_master_50: {
    title: "Maître des plis",
    description: "Gagner 50 plis",
    icon: "⚔️",
  },
  trick_master_200: {
    title: "Seigneur des mers",
    description: "Gagner 200 plis",
    icon: "🗡️",
  },
};

export default function AuthPanel({
  onAuthenticated,
}: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");

    const { data, error } = await supabase.rpc(
      "get_my_game_profile_stats"
    );

    if (error) {
      console.error("ERREUR STATISTIQUES :", error);
      setStatsError("Impossible de charger tes statistiques.");
      setStatsLoading(false);
      return;
    }

    if (data) {
      setProfileStats(data as ProfileStats);
    }

    setStatsLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      const session = data.session;
      setSessionEmail(session?.user.email ?? null);

      if (session) {
        loadStats();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setSessionEmail(session?.user.email ?? null);

      if (session) {
        window.setTimeout(() => {
          if (mounted) loadStats();
        }, 0);

        onAuthenticated?.();
      } else {
        setProfileStats(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadStats, onAuthenticated]);

  useEffect(() => {
    if (!sessionEmail) return;

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeToProfileUpdates = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!active || error || !data.user) return;

      const playerId = data.user.id;

      channel = supabase
        .channel(`profile-stats-${playerId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_statistics",
            filter: `player_id=eq.${playerId}`,
          },
          () => loadStats()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "player_achievements",
            filter: `player_id=eq.${playerId}`,
          },
          () => loadStats()
        )
        .subscribe();
    };

    void subscribeToProfileUpdates();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [sessionEmail, loadStats]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (mode === "register" && username.trim().length < 3) {
      setMessage("Le pseudonyme doit contenir au moins 3 caractères.");
      return;
    }

    if (password.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Bienvenue dans Skull Arena !");
          onAuthenticated?.();
        } else {
          setMessage(
            "Compte créé ! Vérifie tes e-mails pour confirmer ton inscription."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("Connexion réussie !");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfileStats(null);
    setMessage("Tu es déconnecté.");
  }

  if (sessionEmail) {
    const stats = profileStats?.statistics ?? defaultStats;
    const achievements = profileStats?.achievements ?? [];

    return (
      <section className="auth-panel">
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Crown
            size={42}
            color="#f6c94c"
            style={{ margin: "0 auto 10px" }}
          />
          <h2>PROFIL DU PIRATE</h2>
          <p>Connecté avec : {sessionEmail}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "10px",
            marginBottom: "24px",
          }}
        >
          {[
            {
              label: "PARTIES JOUÉES",
              value: stats.games_played,
              icon: <Swords size={20} />,
            },
            {
              label: "VICTOIRES",
              value: stats.games_won,
              icon: <Trophy size={20} />,
            },
            {
              label: "POINTS TOTAUX",
              value: stats.total_points,
              icon: <Crown size={20} />,
            },
            {
              label: "PLIS GAGNÉS",
              value: stats.total_tricks_won,
              icon: <Target size={20} />,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: "15px 10px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(246,201,76,0.18)",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#f6c94c", marginBottom: "7px" }}>
                {item.icon}
              </div>
              <strong style={{ display: "block", fontSize: "23px" }}>
                {item.value.toLocaleString("fr-FR")}
              </strong>
              <span style={{ fontSize: "10px", opacity: 0.7 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(246,201,76,0.08)",
            border: "1px solid rgba(246,201,76,0.2)",
            marginBottom: "24px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "12px", opacity: 0.75 }}>
            TA RÉUSSITE
          </span>
          <strong
            style={{
              display: "block",
              fontSize: "28px",
              color: "#f6c94c",
              marginTop: "5px",
            }}
          >
            {stats.win_rate} %
          </strong>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
            }}
          >
            <h3 style={{ margin: 0 }}>
              <Award size={19} /> SUCCÈS DÉBLOQUÉS
            </h3>
            <span>{achievements.length}/10</span>
          </div>

          {statsLoading ? (
            <p>Chargement des succès...</p>
          ) : statsError ? (
            <div>
              <p>{statsError}</p>
              <button type="button" onClick={loadStats}>
                <RefreshCw size={16} /> Réessayer
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "9px" }}>
              {Object.entries(achievementDefinitions).map(
                ([code, definition]) => {
                  const unlocked = achievements.some(
                    (achievement) => achievement.code === code
                  );

                  return (
                    <div
                      key={code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "11px",
                        borderRadius: "10px",
                        background: unlocked
                          ? "rgba(246,201,76,0.11)"
                          : "rgba(255,255,255,0.025)",
                        border: unlocked
                          ? "1px solid rgba(246,201,76,0.35)"
                          : "1px solid rgba(255,255,255,0.06)",
                        opacity: unlocked ? 1 : 0.48,
                      }}
                    >
                      <span style={{ fontSize: "25px" }}>
                        {unlocked ? definition.icon : "🔒"}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block" }}>
                          {definition.title}
                        </strong>
                        <span style={{ fontSize: "12px", opacity: 0.7 }}>
                          {definition.description}
                        </span>
                      </div>

                      {unlocked && (
                        <Shield size={17} color="#f6c94c" />
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={loadStats}
          disabled={statsLoading}
          style={{ width: "100%", marginBottom: "10px" }}
        >
          <RefreshCw size={16} />
          {statsLoading ? "ACTUALISATION..." : "ACTUALISER MES STATISTIQUES"}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          style={{ width: "100%" }}
        >
          <LogOut size={17} /> SE DÉCONNECTER
        </button>

        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="auth-panel">
      <h2>
        {mode === "login" ? "Connexion" : "Rejoindre Skull Arena"}
      </h2>

      <p>
        {mode === "login"
          ? "Retrouve ton équipage et reprends la partie."
          : "Crée ton compte et entre dans l'arène."}
      </p>

      <form onSubmit={handleSubmit}>
        {mode === "register" && (
          <input
            type="text"
            placeholder="Ton pseudonyme"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength={3}
            maxLength={20}
            required
          />
        )}

        <input
          type="email"
          placeholder="Adresse e-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe (6 caractères minimum)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "login" ? "current-password" : "new-password"
          }
          minLength={6}
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Chargement..."
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "Pas encore de compte ? S'inscrire"
          : "Déjà un compte ? Se connecter"}
      </button>
    </section>
  );
}
