// BACKEND: stores rooms and sends the emails. Users never see this code.
import { getStore } from "@netlify/blobs";

// ---- CUSTOM MESSAGES (edit freely) ----
// label = secret meaning shown in the dropdown, subject/text = the email
const PRESETS = [
  { label: "I'm online", subject: "Your daily streak is waiting 🔥",
    text: "Don't lose your streak! Complete a quick lesson today." },
  { label: "Call me", subject: "New lesson available",
    text: "A new lesson on Python Basics is ready for you." },
  { label: "Miss you", subject: "You earned a new badge! 🏅",
    text: "Congrats! Keep learning to unlock more badges." },
  { label: "Busy, talk later", subject: "Reminder: continue your course",
    text: "You're 60% through your course. Pick up where you left off." }
];
const COOLDOWN_MS = 20000; // minimum gap between sends per person (anti-spam)

export default async (req) => {
  const store = getStore("rooms");
  const body = await req.json().catch(() => ({}));
  const json = (o, s = 200) => new Response(JSON.stringify(o),
    { status: s, headers: { "content-type": "application/json" } });

  // CREATE a room from a list of names
  if (body.action === "create") {
    const names = (body.names || []).map(n => String(n).trim().slice(0, 20))
                    .filter(Boolean).slice(0, 10);
    if (names.length < 2) return json({ error: "Add at least 2 names" }, 400);
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const members = {};
    names.forEach(n => (members[n] = ""));
    await store.setJSON(id, { members, last: {} });
    return json({ id });
  }

  const room = await store.get(String(body.room || ""), { type: "json" });
  if (!room) return json({ error: "Room not found" }, 404);
  const save = () => store.setJSON(body.room, room);

  // INFO: names, who already joined, preset labels (no emails!)
  if (body.action === "info")
    return json({
      names: Object.keys(room.members),
      joined: Object.keys(room.members).filter(n => room.members[n]),
      presets: PRESETS.map(p => p.label)
    });

  // JOIN: save someone's email (each name can be claimed once)
  if (body.action === "join") {
    const email = String(body.email || "").trim();
    if (!(body.name in room.members)) return json({ error: "Unknown name" }, 400);
    if (room.members[body.name]) return json({ error: "Name already taken" }, 409);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Bad email" }, 400);
    room.members[body.name] = email;
    await save();
    return json({ ok: true });
  }

  // SEND: email everyone else in the room
  if (body.action === "send") {
    const me = body.name, p = PRESETS[body.preset];
    if (!room.members[me] || !p) return json({ error: "Not allowed" }, 400);
    if (Date.now() - (room.last[me] || 0) < COOLDOWN_MS)
      return json({ error: "Wait a few seconds" }, 429);
    room.last[me] = Date.now();
    await save();

    const to = Object.entries(room.members)
      .filter(([n, e]) => n !== me && e).map(([, e]) => ({ email: e }));
    await Promise.all(to.map(t =>
      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          sender: { name: process.env.SENDER_NAME, email: process.env.SENDER_EMAIL },
          to: [t], subject: p.subject, textContent: p.text
        })
      })
    ));
    return json({ ok: true, sent: to.length });
  }
  return json({ error: "Bad request" }, 400);
};

export const config = { path: "/api" };
