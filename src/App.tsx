
import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Swords,
  Trophy,
  Users,
  Lock,
  Compass,
  Skull,
  ChevronRight,
  Ship,
  X,
  Sparkles,
} from "lucide-react";

import AuthPanel from "./components/AuthPanel";
import GameProfile from "./components/GameProfile";
import AdminPanel from "./components/AdminPanel";
import Lobby from "./components/Lobby";
import { supabase } from "./lib/supabase";

export default function App() {
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      const user = data.session?.user;
      setIsAuthenticated(!!user);
      setUsername(
        user?.user_metadata?.username ||
        user?.email?.split("@")[0] ||
        ""
      );
      if (user) {
        void supabase.rpc("is_skull_admin").then(({ data }) => {
          if (mounted) setIsAdmin(data === true);
        });
      } else {
        setIsAdmin(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user;
      setIsAuthenticated(!!user);
      setUsername(
        user?.user_metadata?.username ||
        user?.email?.split("@")[0] ||
        ""
      );
      setIsAdmin(false);
      if (user) {
        void supabase.rpc("is_skull_admin").then(({ data }) => {
          if (mounted) setIsAdmin(data === true);
        });
      }

      if (!user) {
        setShowLobby(false);
        setShowAdmin(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthenticated = useCallback(() => {
    setShowProfile(false);
  }, []);

  const enterLobby = () => {
    if (!isAuthenticated) {
      setShowProfile(true);
      return;
    }

    setShowLobby(true);
  };

  if (showLobby) {
    return (
      <Lobby
        onBack={() => setShowLobby(false)}
      />
    );
  }

  return (
    <main className="arena">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Skull size={27} />
          </div>
          <div>
            <span className="brand-name">SKULL ARENA</span>
            <span className="brand-sub">THE PIRATE CHALLENGE</span>
          </div>
        </div>

        {isAdmin && (
          <button className="profile-button" onClick={() => setShowAdmin(true)}>
            <Lock size={17} /> ADMIN
          </button>
        )}
        <button
          className="profile-button"
          onClick={() => setShowProfile(true)}
        >
          <Users size={17} />
          {username || "Mon profil"}
        </button>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="season-tag">
            <Sparkles size={14} />
            SAISON 01 — THE GOLDEN AGE
          </div>

          <h1>
            RULE THE
            <span>SEVEN SEAS</span>
          </h1>

          <p className="hero-description">
            Le destin des pirates se joue ici.
            Annonce tes plis, défie tes adversaires
            et deviens le maître des océans.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={enterLobby}>
              <Swords size={20} />
              ENTRER DANS L'ARÈNE
              <ChevronRight size={19} />
            </button>

            <button
              className="secondary-button"
              onClick={enterLobby}
            >
              <Lock size={17} />
              REJOINDRE UN AMI
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>10</strong>
              <span>MANCHES</span>
            </div>
            <div>
              <strong>2–8</strong>
              <span>JOUEURS</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>TRÉSORS</span>
            </div>
          </div>
        </div>

        <div className="hero-emblem">
          <div className="emblem-ring">
            <div className="emblem-inner">
              <Crown size={34} />
              <Skull size={100} strokeWidth={1.2} />
              <span>SKULL KING</span>
              <small>MASTER OF THE SEAS</small>
            </div>
          </div>
          <div className="emblem-glow" />
        </div>
      </section>

      <section className="game-modes">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CHOOSE YOUR DESTINY</span>
            <h2>Choisis ton aventure</h2>
          </div>
          <Compass size={25} />
        </div>

        <div className="mode-grid">
          <button className="mode-card" onClick={enterLobby}>
            <div className="mode-icon">
              <Users size={28} />
            </div>
            <span className="mode-label">MULTIJOUEUR</span>
            <strong>Arène publique</strong>
            <p>Affronte des pirates du monde entier.</p>
            <span className="mode-link">
              JOUER <ChevronRight size={16} />
            </span>
          </button>

          <button
            className="mode-card featured"
            onClick={enterLobby}
          >
            <div className="mode-icon">
              <Lock size={28} />
            </div>
            <span className="mode-label">ENTRE AMIS</span>
            <strong>Partie privée</strong>
            <p>Crée une salle et invite ton équipage.</p>
            <span className="mode-link">
              REJOINDRE <ChevronRight size={16} />
            </span>
          </button>

          <button className="mode-card" onClick={enterLobby}>
            <div className="mode-icon">
              <Trophy size={28} />
            </div>
            <span className="mode-label">COMPÉTITION</span>
            <strong>Classement</strong>
            <p>Gravis les rangs et gagne des trophées.</p>
            <span className="mode-link">
              DÉCOUVRIR <ChevronRight size={16} />
            </span>
          </button>
        </div>
      </section>

      <section className="bottom-panel">
        <div>
          <Ship size={22} />
          <div>
            <strong>TON ÉQUIPAGE T'ATTEND</strong>
            <span>Prépare-toi à prendre la mer.</span>
          </div>
        </div>
        <div className="online-status">
          <span className="status-dot" />
          {isAuthenticated
            ? "PIRATE CONNECTÉ"
            : "ARÈNE EN PRÉPARATION"}
        </div>
      </section>

      <footer>
        <span>SKULL ARENA © 2026</span>
        <span>BUILT FOR PIRATES</span>
      </footer>

      {showAdmin && isAdmin && (
        <div className="modal-overlay">
          <div className="modal auth-modal">
            <button className="close-button" onClick={() => setShowAdmin(false)} aria-label="Fermer">
              <X />
            </button>
            <AdminPanel />
          </div>
        </div>
      )}

      {showProfile && (
        <div className="modal-overlay">
          <div className="modal auth-modal">
            <button
              className="close-button"
              onClick={() => setShowProfile(false)}
              aria-label="Fermer"
            >
              <X />
            </button>

            {isAuthenticated ? (
              <GameProfile />
            ) : (
              <AuthPanel onAuthenticated={handleAuthenticated} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
