// JS FILE: front-end logic (talks to /api)
const $ = id => document.getElementById(id);
const room = new URLSearchParams(location.search).get("room");
const api = body => fetch("/api", { method: "POST", body: JSON.stringify(body) })
                      .then(r => r.json());
const say = t => ($("status").textContent = t);

// Remember who I am on this phone (wrapped in try in case storage is blocked)
const getMe = () => { try { return localStorage.getItem("me-" + room); } catch (e) {} };
const setMe = n => { try { localStorage.setItem("me-" + room, n); } catch (e) {} };

if (!room) {
  // ---- Screen 1: create a room ----
  $("setup").hidden = false;
  $("create").onclick = async () => {
    const names = $("names").value.split(",").map(n => n.trim()).filter(Boolean);
    const r = await api({ action: "create", names });
    if (r.id) $("link").textContent = "Share this link: " + location.origin + "/?room=" + r.id;
    else say(r.error);
  };
} else init();

async function init() {
  const info = await api({ action: "info", room });
  if (info.error) return say(info.error);

  const me = getMe();
  if (me && info.joined.includes(me)) return showSend(me, info.presets);

  // ---- Screen 2: join (only names nobody has claimed yet) ----
  $("join").hidden = false;
  info.names.filter(n => !info.joined.includes(n))
    .forEach(n => ($("who").innerHTML += `<option>${n}</option>`));
  $("joinBtn").onclick = async () => {
    const name = $("who").value;
    const r = await api({ action: "join", room, name, email: $("email").value });
    if (r.ok) { setMe(name); $("join").hidden = true; showSend(name, info.presets); }
    else say(r.error);
  };
}

// ---- Screen 3: send a signal ----
function showSend(name, presets) {
  $("send").hidden = false;
  $("meLabel").textContent = "You are " + name;
  presets.forEach((p, i) => ($("preset").innerHTML += `<option value="${i}">${p}</option>`));
  $("sendBtn").onclick = async () => {
    say("Sending...");
    const r = await api({ action: "send", room, name, preset: +$("preset").value });
    say(r.ok ? `Sent ✅ (${r.sent})` : r.error);
  };
}
