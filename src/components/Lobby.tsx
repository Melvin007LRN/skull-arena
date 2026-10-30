
import { useCallback, useEffect, useState } from "react";
import {
  Anchor,
  Users,
  Lock,
  Globe,
  Plus,
  RefreshCw,
  Play,
  LogOut,
  Copy,
  Skull,
  Crown,
  ArrowLeft,
  Puzzle,
  Check,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type Extensions = {
  loot: boolean;
  kraken: boolean;
  white_whale: boolean;
  mary_thorne: boolean;
  extra_number_cards: boolean;
  joker_15: boolean;
  last_volley: boolean;
  first_mate_con: boolean;
  spotted_stingray: boolean;
  davys_locker: boolean;
  walk_the_plank: boolean;
};

const DEFAULT_EXTENSIONS: Extensions = {
  loot: true,
  kraken: true,
  white_whale: true,
  mary_thorne: true,
  extra_number_cards: true,
  joker_15: true,
  last_volley: true,
  first_mate_con: true,
  spotted_stingray: true,
  davys_locker: true,
  walk_the_plank: true,
};

const EXTENSION_OPTIONS: {
  key: keyof Extensions;
  name: string;
  description: string;
}[] = [
  {
    key: "loot",
    name: "Butin",
    description: "Ajoute les cartes et règles liées au butin.",
  },
  {
    key: "kraken",
    name: "Kraken",
    description: "Active l'extension du Kraken.",
  },
  {
    key: "white_whale",
    name: "Baleine blanche",
    description: "Active l'extension de la Baleine blanche.",
  },
  {
    key: "mary_thorne",
    name: "Mary Thorne",
    description: "Active les éléments associés à Mary Thorne.",
  },
  {
    key: "extra_number_cards",
    name: "Cartes numérotées supplémentaires",
    description: "Ajoute les cartes numérotées supplémentaires.",
  },
  {
    key: "joker_15",
    name: "Joker 15",
    description: "Active la carte spéciale Joker 15.",
  },
  {
    key: "last_volley",
    name: "Dernière salve",
    description: "Active la règle de dernière salve.",
  },
  {
    key: "first_mate_con",
    name: "Premier lieutenant",
    description: "Active la règle du premier lieutenant.",
  },
  {
    key: "spotted_stingray",
    name: "Raie tachetée",
    description: "Active la carte spéciale Raie tachetée.",
  },
  {
    key: "davys_locker",
    name: "Le coffre de Davy Jones",
    description: "Active les éléments associés au coffre de Davy Jones.",
  },
  {
    key: "walk_the_plank",
    name: "Marche sur la planche",
    description: "Active la règle Marche sur la planche.",
  },
];

type Room = {
  id: string;
  code: string;
  room_name: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
  is_private: boolean;
  max_players: number;
  created_at: string;
  extensions?: Extensions;
};

type RoomPlayer = {
  id: string;
  room_id: string;
  player_id: string;
  username: string;
};

type LobbyProps = {
  onBack: () => void;
};

export default function Lobby({ onBack }: LobbyProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [userId, setUserId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [extensions, setExtensions] =
    useState<Extensions>(DEFAULT_EXTENSIONS);

  const enabledExtensionCount = Object.values(extensions).filter(Boolean).length;

  const loadRooms = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setMessage("Tu dois être connecté.");
      return;
    }

    setUserId(userData.user.id);

    const { data, error } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("status", "waiting")
      .eq("is_private", false)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setRooms((data || []) as Room[]);

    const roomIds = (data || []).map((room) => room.id);

    if (roomIds.length === 0) {
      setPlayers([]);
      return;
    }

    const { data: playerData, error: playerError } = await supabase
      .from("room_players")
      .select("*")
      .in("room_id", roomIds);

    if (playerError) {
      setMessage(playerError.message);
      return;
    }

    setPlayers((playerData || []) as RoomPlayer[]);
  }, []);

  const loadSelectedRoom = useCallback(async (roomId: string) => {
    const { data: room, error } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedRoom(room as Room);

    const { data: playerData, error: playerError } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (playerError) {
      setMessage(playerError.message);
      return;
    }

    setSelectedPlayers((playerData || []) as RoomPlayer[]);
  }, []);

  useEffect(() => {
    loadRooms();

    const channel = supabase
      .channel("skull-arena-lobby")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_rooms" },
        () => {
          loadRooms();
          if (selectedRoom) loadSelectedRoom(selectedRoom.id);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players" },
        () => {
          loadRooms();
          if (selectedRoom) loadSelectedRoom(selectedRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRooms, loadSelectedRoom, selectedRoom]);

  function toggleExtension(key: keyof Extensions) {
    setExtensions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function activateAllExtensions() {
    setExtensions(
      Object.fromEntries(
        Object.keys(DEFAULT_EXTENSIONS).map((key) => [key, true])
      ) as Extensions
    );
  }

  function deactivateAllExtensions() {
    setExtensions(
      Object.fromEntries(
        Object.keys(DEFAULT_EXTENSIONS).map((key) => [key, false])
      ) as Extensions
    );
  }

  async function createRoom(isPrivate: boolean) {
    const cleanName = roomName.trim();

    if (cleanName.length < 3 || cleanName.length > 30) {
      setMessage("Le nom doit contenir entre 3 et 30 caractères.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("create_room", {
      p_room_name: cleanName,
      p_is_private: isPrivate,
      p_max_players: maxPlayers,
      p_extensions: extensions,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data?.[0];

    if (!result?.room_id) {
      setMessage("Impossible de créer le salon.");
      return;
    }

    setRoomName("");
    await loadSelectedRoom(result.room_id);
    setMessage("Ton salon a été créé !");
  }

  async function joinRoom(code: string) {
    if (code.trim().length < 4) {
      setMessage("Entre un code valide.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("join_room", {
      p_code: code.trim().toUpperCase(),
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data) {
      setMessage("Impossible de rejoindre ce salon.");
      return;
    }

    setRoomCode("");
    await loadSelectedRoom(data);
    setMessage("Tu as rejoint l'équipage !");
  }

  async function startRoom() {
    if (!selectedRoom) return;

    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("start_room", {
      p_room_id: selectedRoom.id,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("La partie est lancée !");
    await loadSelectedRoom(selectedRoom.id);
  }

  async function leaveRoom() {
    if (!selectedRoom) return;

    const { error } = await supabase
      .from("room_players")
      .delete()
      .eq("room_id", selectedRoom.id)
      .eq("player_id", userId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedRoom(null);
    setSelectedPlayers([]);
    setMessage("Tu as quitté le salon.");
    await loadRooms();
  }

  async function copyCode() {
    if (!selectedRoom) return;

    try {
      await navigator.clipboard.writeText(selectedRoom.code);
      setMessage("Code copié !");
    } catch {
      setMessage("Copie impossible sur cet appareil.");
    }
  }

  const isHost = selectedRoom?.host_id === userId;
  const playerCount = selectedPlayers.length;
  const selectedExtensions = selectedRoom?.extensions || DEFAULT_EXTENSIONS;

  return (
    <main className="lobby-page">
      <header className="lobby-header">
        <button className="lobby-back" onClick={onBack}>
          <ArrowLeft size={18} />
          RETOUR
        </button>

        <div className="lobby-brand">
          <Skull size={27} />
          <div>
            <strong>SKULL ARENA</strong>
            <span>MULTIPLAYER LOBBY</span>
          </div>
        </div>

        <button
          className="lobby-refresh"
          onClick={loadRooms}
          disabled={loading}
          aria-label="Actualiser"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="lobby-content">
        {selectedRoom ? (
          <div className="room-panel">
            <div className="lobby-eyebrow">
              <Anchor size={16} />
              TON ÉQUIPAGE
            </div>

            <h1>{selectedRoom.room_name}</h1>

            <p className="lobby-description">
              Prépare ton équipage avant le départ.
            </p>

            <div className="room-code-box">
              <div>
                <span>CODE D'INVITATION</span>
                <strong>{selectedRoom.code}</strong>
              </div>
              <button onClick={copyCode}>
                <Copy size={18} />
                COPIER
              </button>
            </div>

            <div className="room-information">
              <span>
                <Users size={17} />
                {playerCount}/{selectedRoom.max_players} pirates
              </span>
              <span>
                {selectedRoom.is_private ? (
                  <Lock size={17} />
                ) : (
                  <Globe size={17} />
                )}
                {selectedRoom.is_private ? "Privé" : "Public"}
              </span>
            </div>

            <div className="players-panel">
              <h2>ÉQUIPAGE</h2>

              {selectedPlayers.map((player) => (
                <div className="player-row" key={player.id}>
                  <div className="player-avatar">
                    {player.player_id === selectedRoom.host_id ? (
                      <Crown size={19} />
                    ) : (
                      <Skull size={19} />
                    )}
                  </div>

                  <strong>{player.username}</strong>

                  {player.player_id === selectedRoom.host_id && (
                    <span className="host-label">CAPITAINE</span>
                  )}

                  {player.player_id === userId && (
                    <span className="you-label">TOI</span>
                  )}
                </div>
              ))}

              {Array.from({
                length: Math.max(
                  0,
                  selectedRoom.max_players - playerCount
                ),
              }).map((_, index) => (
                <div className="player-row player-empty" key={index}>
                  <div className="player-avatar">
                    <Users size={17} />
                  </div>
                  <span>En attente d'un pirate...</span>
                </div>
              ))}
            </div>

            <div className="room-extensions-panel">
              <h2>
                <Puzzle size={18} />
                EXTENSIONS DU SALON
              </h2>
              <p>
                {Object.values(selectedExtensions).filter(Boolean).length} sur{" "}
                {EXTENSION_OPTIONS.length} activées
              </p>

              <div className="room-extension-list">
                {EXTENSION_OPTIONS.map((extension) => (
                  <span
                    className={
                      selectedExtensions[extension.key]
                        ? "room-extension active"
                        : "room-extension inactive"
                    }
                    key={extension.key}
                  >
                    {selectedExtensions[extension.key] && <Check size={13} />}
                    {extension.name}
                  </span>
                ))}
              </div>
            </div>

            {selectedRoom.status === "waiting" && isHost && (
              <button
                className="lobby-primary"
                onClick={startRoom}
                disabled={loading || playerCount < 2}
              >
                <Play size={19} />
                {loading
                  ? "CHARGEMENT..."
                  : playerCount < 2
                    ? "EN ATTENTE D'UN JOUEUR"
                    : "LANCER LA PARTIE"}
              </button>
            )}

            {selectedRoom.status === "playing" && (
              <div className="lobby-notice">
                LA PARTIE EST LANCÉE
              </div>
            )}

            <button className="lobby-leave" onClick={leaveRoom}>
              <LogOut size={17} />
              QUITTER LE SALON
            </button>
          </div>
        ) : (
          <>
            <div className="lobby-eyebrow">
              <Anchor size={16} />
              CHOISIS TON DESTIN
            </div>

            <h1>Rejoins l'arène</h1>

            <p className="lobby-description">
              Trouve ton équipage ou crée ton propre salon.
            </p>

            <div className="lobby-create-panel">
              <h2>CRÉER UN SALON</h2>

              <label htmlFor="room-name">
                Nom de ton salon
              </label>

              <input
                id="room-name"
                type="text"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Ex : La taverne des pirates"
                minLength={3}
                maxLength={30}
              />

              <span className="room-name-counter">
                {roomName.length}/30 caractères
              </span>

              <label htmlFor="max-players">
                Nombre maximum de joueurs
              </label>

              <select
                id="max-players"
                value={maxPlayers}
                onChange={(event) =>
                  setMaxPlayers(Number(event.target.value))
                }
              >
                {[2, 3, 4, 5, 6, 7, 8].map((number) => (
                  <option key={number} value={number}>
                    {number} joueurs
                  </option>
                ))}
              </select>

              <div className="extensions-config">
                <div className="extensions-heading">
                  <div>
                    <h2>
                      <Puzzle size={18} />
                      EXTENSIONS
                    </h2>
                    <span>
                      {enabledExtensionCount}/{EXTENSION_OPTIONS.length} activées
                    </span>
                  </div>
                </div>

                <div className="extension-toggle-actions">
                  <button type="button" onClick={activateAllExtensions}>
                    Tout activer
                  </button>
                  <button type="button" onClick={deactivateAllExtensions}>
                    Tout désactiver
                  </button>
                </div>

                <div className="extension-options">
                  {EXTENSION_OPTIONS.map((extension) => (
                    <label
                      className="extension-option"
                      key={extension.key}
                    >
                      <input
                        type="checkbox"
                        checked={extensions[extension.key]}
                        onChange={() => toggleExtension(extension.key)}
                      />

                      <span className="extension-option-info">
                        <strong>{extension.name}</strong>
                        <small>{extension.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="create-buttons">
                <button
                  className="lobby-primary"
                  onClick={() => createRoom(false)}
                  disabled={loading || roomName.trim().length < 3}
                >
                  <Globe size={19} />
                  PARTIE PUBLIQUE
                </button>

                <button
                  className="lobby-secondary"
                  onClick={() => createRoom(true)}
                  disabled={loading || roomName.trim().length < 3}
                >
                  <Lock size={19} />
                  PARTIE PRIVÉE
                </button>
              </div>
            </div>

            <div className="lobby-join-panel">
              <h2>REJOINDRE AVEC UN CODE</h2>

              <div className="join-code-row">
                <input
                  value={roomCode}
                  onChange={(event) =>
                    setRoomCode(event.target.value.toUpperCase())
                  }
                  placeholder="CODE DU SALON"
                  maxLength={8}
                />

                <button
                  onClick={() => joinRoom(roomCode)}
                  disabled={loading || roomCode.trim().length < 4}
                >
                  REJOINDRE
                </button>
              </div>
            </div>

            <div className="public-rooms">
              <div className="public-rooms-heading">
                <h2>PARTIES PUBLIQUES</h2>
                <span>{rooms.length} salon(s)</span>
              </div>

              {rooms.length === 0 ? (
                <div className="empty-rooms">
                  <Skull size={32} />
                  <strong>Aucun équipage disponible</strong>
                  <span>Crée une partie et attends tes adversaires.</span>
                </div>
              ) : (
                rooms.map((room) => {
                  const count = players.filter(
                    (player) => player.room_id === room.id
                  ).length;

                  return (
                    <div className="public-room-row" key={room.id}>
                      <div>
                        <strong>{room.room_name}</strong>
                        <span>
                          Code : {room.code} · {count}/{room.max_players} pirates
                        </span>
                      </div>

                      <button
                        onClick={() => joinRoom(room.code)}
                        disabled={loading || count >= room.max_players}
                      >
                        <Plus size={16} />
                        REJOINDRE
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {message && (
          <p className="lobby-message" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
