const express = require("express");
const bodyParser = require("body-parser");
const { BroadcastChannel } = require("worker_threads");
const app = express(); // ajout de socket.ioconst
server = require("http").Server(app);
const io = require("socket.io")(server);

// import {user} from './public/user.js';

let list_user = [];
let list_message = [];
// let list_weapon = [];
let jeux_ue;
let player_position;

const predefined_attack_msg = [
  { type: 1, msg: "Le soldat {{pseudo}} attaque avec l'artillerie." },
  { type: 2, msg: "Le soldat {{pseudo}} attaque avec une mitrailleuse." },
  { type: 3, msg: "Le soldat {{pseudo}} attaque avec un avion." },
];
const weapon_state = [
  { type: 3, unit: 0, state: 0, time: 10000 }, // Avion
  { type: 2, unit: 0, state: 0, time: 10000 }, // Tourelle
  { type: 2, unit: 1, state: 0, time: 10000 }, // Tourelle
  { type: 2, unit: 2, state: 0, time: 10000 }, // Tourelle
  { type: 1, unit: 0, state: 0, time: 10000 }, // Artillerie
  { type: 2, unit: 3, state: 0, time: 10000 }, // Tourelle
  { type: 2, unit: 4, state: 0, time: 10000 }, // Tourelle
  { type: 2, unit: 5, state: 0, time: 2000 }, // Tourelle
  { type: 3, unit: 1, state: 0, time: 10000 }, // Avion
];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static("public"));

app.get("/", function (req, res) {
  res.sendFile("start.html", { root: __dirname });
});
app.get("/map", function (req, res) {
  res.sendFile("map.html", { root: __dirname });
});

// app.get('/json', function (req, res) {
//     res.status(200).json({"message":"ok"})
// })

// socket.broadcast

io.on("connection", (socket) => {
  socket.on("login", (valeur, callback) => {
    const new_user = addToList(socket, valeur, callback);
    io.emit("user_logged", { user: new_user });
    if (player_position) {
      io.emit("player_position_event", player_position);
    }
    callback({ status: 200, data: new_user });
  });

  socket.on("get_users", (callback) => {
    callback(getUsers());
  });

  socket.on("get_messages", (callback) => {
    callback(getMessages());
  });

  socket.on("disconnect", () => {
    console.log(`user disconnected ${socket.id}`);
    removeToList(socket.id);
    io.emit("user_disconnected", { userId: socket.id });
  });

  socket.on("new_attack", ({ user, from, to }) => {
    const curr_weapon = weapon_state.find((w) => w.type == user.type && w.unit == user.unit);

    if (curr_weapon?.state) {
      socket.emit("message_sent", { pseudo: "process", msg: `Calmez vos ardeurs soldat, votre arme n'est actuellement pas disponible.` });
    } else {
      let msg = predefined_attack_msg.find((m) => m.type == user.type)?.msg;
      msg = msg?.replace("{{pseudo}}", user?.pseudo);
      io.emit("attack", { user, from, to });
      io.emit("message_sent", { pseudo: "process", msg });
      curr_weapon.state = true;

      io.emit("disable_weapon", { type: user.type, unit: user.unit, time: curr_weapon.time });

      setTimeout(() => {
        io.emit("enable_weapon", { type: user.type, unit: user.unit });
        curr_weapon.state = false;
      }, curr_weapon.time);
    }
  });

  socket.on("select_weapon", ({ type, unit }) => {
    const curr_p = list_user.find((p) => {
      return p.id === socket.id;
    });

    if (curr_p) {
      curr_p.type = parseInt(type);
      curr_p.unit = parseInt(unit);
      io.emit("weapon_selected", { user: curr_p.get() });
    }
  });

  socket.on("send_message", ({ user, msg }) => {
    list_message = [...list_message, { pseudo: user?.pseudo, msg }];
    io.emit("message_sent", { pseudo: user?.pseudo, msg });
  });

  socket.on("unselect_weapon", () => {
    const curr_p = list_user.find((p) => {
      return p.id === socket.id;
    });

    if (curr_p) {
      const prev_type = curr_p.type;
      const prev_unit = curr_p.unit;
      curr_p.type = undefined;
      curr_p.unit = undefined;
      io.emit("weapon_unselected", { user: curr_p.get(), prev_type, prev_unit });
    }
  });

  socket.on("player_position", ({ x, y }) => {
    player_position = { x, y };
    io.emit("player_position_event", { x, y });
  });

  socket.on("player_death", () => {
    io.emit("player_death_event", { x, y });
  });
});

server.listen(3042, function () {
  console.log("Votre app est disponible sur localhost:3042 !");
});

function addToList(socket, valeur, callback) {
  list_user.filter((e) => e.id != socket.id);

  for (const p of list_user) {
    if (p?.pseudo == valeur?.pseudo) {
      callback({ status: 401, msg: "User déjà existant" });
      // socket.disconnect();
      return;
    }
  }

  let new_user = new User(socket, valeur?.pseudo, valeur.ue);
  if (new_user.ue) jeux_ue = new_user;
  list_user = [...list_user, new_user];

  return new_user.get();

  //   list_user.forEach((e) => console.log(e.id, " : ", e.pseudo));
  //   if (jeux_ue != null) console.log("jeuxUE = ", jeux_ue.id, jeux_ue.pseudo);
}

function removeToList(id) {
  list_user.map((p) => {
    if (p.id == id && p.ue) {
      jeux_ue = undefined;
      io.emit("message_sent", { pseudo: "process", msg: `Le soldat ennemi vient de sortir du champs de bataille.` });
    }
  });
  list_user = list_user.filter((p) => p.id != id);
}

function getUsers() {
  let retour = [];
  for (const p of list_user) {
    retour = [...retour, p.get()];
  }
  return retour;
}

function getMessages() {
  return list_message;
}

class User {
  constructor(socket, pseudo, ue) {
    this.socket = socket;
    this.id = socket.id;
    this.pseudo = pseudo;
    this.ue = ue;
    this.type; // 0 pour rien,1 pour Artillerie, 2 pour Mittrayeuse, 3 pour Avions, -1 pour le jeuxUE
    this.unit;
  }

  get() {
    return { id: this.id, pseudo: this.pseudo, ue: this.ue, type: this.type, unit: this.unit };
  }
}
