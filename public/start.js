// import { mysocket, Mysocket, ChangeSocket } from "./public/socket.js"
// import { mysocket } from "./public/socket.js"

// let btnjeSuis = document.querySelector('input.JeSuis');
// let btnjeneSuis = document.querySelector('input.JeNeSuisPas');
// let erreur = document.querySelector("span.error");
// btnjeSuis.addEventListener('click', EnvoisQjSOui);
// btnjeneSuis.addEventListener('click', EnvoisQjSNon);

const socket = io();

const weapons = {
  1: `Avec l'<b>artillerie</b> à tes côtés, tu deviens un véritable maître de la destruction.`,
  2: "Fais pleuvoir les balles ! Tu as une <b>mitrailleuse</b>, après tout.",
  3: "Tu es le roi du ciel avec cet <b>avion</b> ! Personne ne peut te battre !",
};

// DOM Components
const autentification = document.querySelector("#autentification");
const chatbox = document.querySelector("#chatbox").getElementsByTagName("ul")?.[0];
const btn_attack = document.querySelector("button#btn_attack");
const btn_group = document.getElementsByClassName("btn_group");
const btn_login = document.querySelector("input#connexion");
const btn_quit_weapon = document.querySelector("button#btn_quitWeapon");
const btn_send_message = document.querySelector("button#btn_sendMessage");
const carte = document.querySelector("#carte");
const erreur = document.querySelector("span.error");
const ipt_pseudo = document.querySelector("input#pseudo");
const ipt_send_message = document.querySelector("input#ipt_sendMessage");
const liste_user = document.querySelector("div#liste_user").getElementsByTagName("ul")?.[0];
const logged_msg = document.querySelector("#logged_msg");
const map = document.querySelector("#map");
const map_canvas = document.querySelector("#map_canvas");
const wrapper_content = document.querySelector("#wrapper_content");
const weapon_list = document.getElementsByClassName("weapon");
const weapons_position = [
  { type: 3, unit: 0, x: 100, y: 0 }, // Avion
  { type: 2, unit: 0, x: 78.74386920980926, y: 10.56524035921817 }, // Tourelle
  { type: 2, unit: 1, x: 78.74386920980926, y: 26.41310089804543 }, // Tourelle
  { type: 2, unit: 2, x: 78.74386920980926, y: 42.26096143687269 }, // Tourelle
  { type: 1, unit: 0, x: 97.06426871198096, y: 52.82620179609086 }, // Artillerie
  { type: 2, unit: 3, x: 78.74386920980926, y: 58.10882197569995 }, // Tourelle
  { type: 2, unit: 4, x: 78.74386920980926, y: 73.95668251452721 }, // Tourelle
  { type: 2, unit: 5, x: 78.74386920980926, y: 89.80454305335446 }, // Tourelle
  { type: 3, unit: 1, x: 100, y: 100 }, // Avion
];

// Variables
let action_state;
let curr_user;
let curr_weapon;

// Socket comunication response
socket.on("user_logged", ({ user }) => {
  if (user) {
    newLoggedUser(user);
  }
});

socket.on("user_disconnected", ({ userId }) => {
  // Remove user from DOM
  const user = document.querySelector(`li[data-id="${userId}"]`);
  user?.remove();
});

socket.on("weapon_selected", ({ user }) => {
  weapon_selected(user);

  // Current User
  if (socket.id == user.id) {
    curr_user = user;
    btn_attack.disabled = false;
    btn_quit_weapon.disabled = false;
    logged_msg.innerHTML = `Ravis de te compter dans nos rangs, soldat <b>${curr_user?.pseudo}</b>.<br/>${weapons[user.type]} excellent choix d'armement !`;

    btn_attack.addEventListener("click", beginAttack);
  }
});

socket.on("player_position_event", ({ x, y }) => {
  player.style.display = "block";
  const w = player.clientWidth;
  const h = player.clientHeight;
  player.style.left = `calc(${x}% - ${w / 2}px)`;
  player.style.top = `calc(${100 - y}% - ${h / 2}px)`;
});

socket.on("player_death_event", () => {
  player.style.display = "none";
  player.style.top = 0;
  player.style.left = 0;
});

socket.on("weapon_unselected", ({ user, prev_type, prev_unit }) => {
  const { id } = user;
  curr_user = user;

  const weapon_unselected = document.querySelector(`[data-type="${prev_type}"][data-unit="${prev_unit}"]`);
  weapon_unselected.getElementsByClassName("username")[0].textContent = "";
  weapon_unselected.removeAttribute("data-in-use");
  // Current User
  if (socket.id == id) {
    curr_weapon = undefined;
    btn_attack.innerHTML = "Attaquer";
    btn_attack.disabled = true;
    btn_quit_weapon.disabled = true;
    logged_msg.innerHTML = `Ravis de te compter dans nos rangs, soldat <b>${curr_user?.pseudo}</b>.<br/>Parfois, il est bon de battre en retraite comme un lâche !`;
  }
});

socket.on("disable_weapon", ({ type, unit, time }) => {
  const weapon_disabled = document.querySelector(`[data-type="${type}"][data-unit="${unit}"]`);
  let cd = time / 1000;

  if (curr_user?.type == type && curr_user?.unit == unit) {
    btn_previous_html = btn_attack.innerHTML;
    btn_attack.disabled = true;
    btn_attack.innerHTML = `${btn_previous_html} (${time / 1000})`;
    const timer = setInterval(async () => {
      if (curr_user?.type == type && curr_user?.unit == unit) {
        cd--;
        if (cd <= 0) {
          clearInterval(timer);
          btn_attack.disabled = false;
          btn_attack.innerHTML = btn_previous_html;
        } else {
          btn_attack.innerHTML = `${btn_previous_html} (${cd})`;
        }
      }
    }, 1000);

    socket.on("weapon_unselected", () => {
      clearInterval(timer);
      btn_attack.innerHTML = btn_previous_html;
    });
  }

  let opacity = 0;
  const tick = 1 / (time / 100);
  const public_timer = setInterval(() => {
    if (opacity >= 1) {
      weapon_disabled.style.opacity = 1;
      clearInterval(public_timer);
      console.log("ending");
    } else {
      opacity += tick;
      console.log({ opacity });
      weapon_disabled.style.opacity = opacity;
    }
  }, 100);

  weapon_disabled.disabled = true;
});

socket.on("enable_weapon", ({ type, unit }) => {
  if (curr_user?.type == type && curr_user?.unit == unit) {
    btn_attack.disabled = false;
  }
  const weapon_disabled = document.querySelector(`[data-type="${type}"][data-unit="${unit}"]`);
  weapon_disabled.disabled = false;
});

socket.on("message_sent", ({ pseudo, msg }) => {
  const li = document.createElement("li");
  if (pseudo == "process" || pseudo == "Player") li.innerHTML = `<span class="process_msg">${msg}</span>`;
  else li.innerHTML = `<span><b>${pseudo}</b> dit : ${msg}</span>`;
  chatbox.appendChild(li);
});

/**
 * Functions List
 **/

const beginAttack = (e) => {
  e.preventDefault();

  // Update the line position function
  const updateLine = (e) => {
    const mapBoundingRect = map_canvas.getBoundingClientRect();
    const mouseX = e.clientX - mapBoundingRect.left;
    const mouseY = e.clientY - mapBoundingRect.top;

    ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);

    if (action_state) {
      ctx.beginPath();
      ctx.moveTo(pointA.x, pointA.y);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        map_canvas.removeEventListener("mousemove", updateLine);
        btn_attack.textContent = "Attaquer";
        action_state = false;
        btn_quit_weapon.disabled = false;

        ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);
      }
    });
  };

  const ctx = map_canvas.getContext("2d");

  if (action_state) {
    btn_attack.textContent = "Attaquer";
    action_state = false;
    btn_quit_weapon.disabled = false;
    map_canvas.removeEventListener("mousemove", updateLine);
  } else {
    btn_attack.textContent = "Annuler (Echap)";
    action_state = true;
    btn_quit_weapon.disabled = true;
  }

  // Select area to attack
  const weapon_selected_coord = {
    x: curr_weapon.offsetLeft + curr_weapon.clientWidth / 2,
    y: curr_weapon.offsetTop + curr_weapon.clientHeight / 2,
  };

  const pointA = { x: parseFloat(weapon_selected_coord.x), y: parseFloat(weapon_selected_coord.y) };

  map_canvas.addEventListener("mousemove", updateLine);
  map_canvas.addEventListener("click", (e) => {
    if (action_state) {
      socket.emit("new_attack", { user: curr_user, from: pointA, to: getCoordinates(e) });
      btn_attack.textContent = "Attaquer";
      action_state = false;
      btn_quit_weapon.disabled = false;
      ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);
    }
  });
};

const getCoordinates = (e) => {
  e.preventDefault();
  let boundingRect = map.getBoundingClientRect();
  let xRelativeToElement = ((e.clientX - boundingRect.left) / boundingRect.width) * 100;
  let yRelativeToElement = ((e.clientY - boundingRect.top) / boundingRect.height) * 100;
  return { x: parseFloat(xRelativeToElement), y: parseFloat(100 - yRelativeToElement) };
};

const handleConnexion = (e) => {
  e.preventDefault();
  console.log("handleConnexion() >> Start");
  socket.emit("user_connexion", []);

  if (ipt_pseudo.value != "") {
    socket.emit("login", { id: socket.id, pseudo: ipt_pseudo.value, ue: false }, (res) => {
      if (res?.status == 200) {
        curr_user = res.data;

        // Display for authenticate users
        autentification.style.display = "none";
        for (const elem of btn_group) {
          elem.style.display = "flex";
        }

        wrapper_content.style.display = "flex";
        logged_msg.innerHTML = `Ravis de te compter dans nos rangs, soldat <b>${curr_user?.pseudo}</b>.<br/>Rejoins le champ de bataille si le cœur t'en dit !`;

        map_canvas.width = map.clientWidth;
        map_canvas.height = map.clientHeight;

        // Position the weapon and add click listener to it
        for (const weapon of weapon_list) {
          const type = parseInt(weapon.getAttribute("data-type"));
          const unit = parseInt(weapon.getAttribute("data-unit"));
          const { x, y } = weapons_position.find((w) => w.type == type && w.unit == unit);

          const w = weapon.offsetWidth;
          const h = weapon.offsetHeight;

          weapon.style.left = `calc(${x}% - ${w / 2}px)`;
          weapon.style.top = `calc(${100 - y}% - ${h / 2}px)`;

          weapon.addEventListener("click", selectWeapon);
        }

        ipt_send_message.addEventListener("keypress", (e) => {
          if (e.key === "Enter") sendMessage(e);
        });
        btn_send_message.addEventListener("click", sendMessage);
      }

      if (res?.status == 401) {
        erreur.textContent = res?.msg;
      }
    });

    socket.on("disconnect", () => {
      socket.disconnect();
      carte.style.display = "none";
      btn_attack.style.display = "none";
      autentification.style.display = "block";
    });
  } else console.log("il faut qu'un pseudo soit écrit");
};

const newLoggedUser = (user) => {
  if (user.ue) {
    socket.emit("send_message", { user, msg: `Le soldat ennemi vient de rentrer sur le champs de bataille.` });
  } else {
    const li = document.createElement("li");
    li.setAttribute("data-id", user.id);
    li.textContent = user?.pseudo;
    liste_user.appendChild(li);
  }
};

const selectWeapon = (e) => {
  e.preventDefault();

  if (!curr_user?.type || curr_user?.type === undefined) {
    const weapon_selected = e.target;
    const weapon_type = parseInt(weapon_selected.dataset.type);
    const weapon_unit = parseInt(weapon_selected.dataset.unit);
    const weapon_in_use = weapon_selected.dataset.inUse;

    if (!weapon_in_use) {
      btn_quit_weapon.addEventListener("click", unselectWeapon);
      socket.emit("select_weapon", { type: weapon_type, unit: weapon_unit });
    } else {
    }
  }
};

const sendCoordinates = (e) => {
  const { x, y } = getCoordinates(e);
  console.log({ x, y });
};

const sendMessage = (e) => {
  e.preventDefault();
  const msg = ipt_send_message.value;
  ipt_send_message.value = "";
  if (msg) {
    socket.emit("send_message", { user: curr_user, msg });
  }
};

const unselectWeapon = (e) => {
  e.preventDefault();
  socket.emit("unselect_weapon");
};

const weapon_selected = (user) => {
  const { pseudo, type, unit } = user;
  curr_weapon = document.querySelector(`[data-type="${type}"][data-unit="${unit}"]`);
  curr_weapon.getElementsByClassName("username")[0].textContent = pseudo;
  curr_weapon.setAttribute("data-in-use", true);
};

/**
 * IHM
 * Part for interacting with the user interface
 **/

// Get current users
socket.emit("get_users", (res) => {
  for (const p of res) {
    const li = document.createElement("li");
    li.setAttribute("data-id", p.id);
    li.textContent = p?.pseudo;

    if (p.type) {
      weapon_selected(p);
      li.classList.add("hasWeapon");
    }

    liste_user.appendChild(li);
  }
});
socket.emit("get_messages", (res) => {
  for (const m of res) {
    const li = document.createElement("li");
    if (m?.pseudo == "process" || m?.pseudo == "Player") li.innerHTML = `<span class="process_msg">${m?.msg}</span>`;
    else li.innerHTML = `<span><b>${m?.pseudo}</b> dit : ${m?.msg}</span>`;
    chatbox.appendChild(li);
  }
});

btn_login.addEventListener("click", handleConnexion);
