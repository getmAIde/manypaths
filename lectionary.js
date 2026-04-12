// lectionary.js
// Revised Common Lectionary (RCL) — Gospel readings, Year C (2025-2026) + Year A (Advent 2026)
// Format: ['YYYY-MM-DD', 'Sunday name', 'Gospel reference', 'Compare topic', 'Research verse']

(function () {
  'use strict';

  const RCL = [
    // ─── Lent / Holy Week — Year C ───────────────────────────────────────────
    ['2026-03-29', '5th Sunday of Lent',    'John 12:1–8',        'extravagant devotion',               'John 12:1-8'],
    ['2026-04-05', 'Palm Sunday',            'Luke 19:28–40',      'the king who comes in peace',        'Luke 19:28-40'],
    ['2026-04-12', 'Easter Sunday',          'Luke 24:1–12',       'resurrection',                       'Luke 24:1-12'],
    // ─── Easter Season — Year C ───────────────────────────────────────────────
    ['2026-04-19', '2nd Sunday of Easter',  'John 20:19–31',      'doubt and faith',                    'John 20:19-31'],
    ['2026-04-26', '3rd Sunday of Easter',  'John 21:1–19',       'restoration after failure',          'John 21:1-19'],
    ['2026-05-03', '4th Sunday of Easter',  'John 10:22–30',      'the good shepherd',                  'John 10:22-30'],
    ['2026-05-10', '5th Sunday of Easter',  'John 13:31–35',      'love one another',                   'John 13:31-35'],
    ['2026-05-17', '6th Sunday of Easter',  'John 14:23–29',      'peace that the world cannot give',   'John 14:23-29'],
    ['2026-05-24', '7th Sunday of Easter',  'John 17:20–26',      'unity among believers',              'John 17:20-26'],
    ['2026-05-31', 'Pentecost Sunday',       'John 14:8–17',       'the Holy Spirit',                    'John 14:8-17'],
    // ─── Ordinary Time — Year C ───────────────────────────────────────────────
    ['2026-06-07', 'Trinity Sunday',         'John 16:12–15',      'the Trinity',                        'John 16:12-15'],
    ['2026-06-14', 'Proper 6',               'Luke 7:36–8:3',      'forgiveness and anointing',          'Luke 7:36-50'],
    ['2026-06-21', 'Proper 7',               'Luke 8:26–39',       'healing and restoration',            'Luke 8:26-39'],
    ['2026-06-28', 'Proper 8',               'Luke 9:51–62',       'the cost of following',              'Luke 9:51-62'],
    ['2026-07-05', 'Proper 9',               'Luke 10:1–11',       'sending and mission',                'Luke 10:1-11'],
    ['2026-07-12', 'Proper 10',              'Luke 10:25–37',      'who is my neighbor',                 'Luke 10:25-37'],
    ['2026-07-19', 'Proper 11',              'Luke 10:38–42',      'contemplation and action',           'Luke 10:38-42'],
    ['2026-07-26', 'Proper 12',              'Luke 11:1–13',       'prayer',                             'Luke 11:1-13'],
    ['2026-08-02', 'Proper 13',              'Luke 12:13–21',      'wealth and greed',                   'Luke 12:13-21'],
    ['2026-08-09', 'Proper 14',              'Luke 12:32–40',      'do not be afraid',                   'Luke 12:32-40'],
    ['2026-08-16', 'Proper 15',              'Luke 12:49–56',      'conflict and peace',                 'Luke 12:49-56'],
    ['2026-08-23', 'Proper 16',              'Luke 13:10–17',      'healing on the Sabbath',             'Luke 13:10-17'],
    ['2026-08-30', 'Proper 17',              'Luke 14:1, 7–14',    'humility and honor',                 'Luke 14:1-14'],
    ['2026-09-06', 'Proper 18',              'Luke 14:25–33',      'counting the cost',                  'Luke 14:25-33'],
    ['2026-09-13', 'Proper 19',              'Luke 15:1–10',       'the lost and the found',             'Luke 15:1-10'],
    ['2026-09-20', 'Proper 20',              'Luke 16:1–13',       'faithfulness with small things',     'Luke 16:1-13'],
    ['2026-09-27', 'Proper 21',              'Luke 16:19–31',      'wealth and the afterlife',           'Luke 16:19-31'],
    ['2026-10-04', 'Proper 22',              'Luke 17:5–10',       'faith and duty',                     'Luke 17:5-10'],
    ['2026-10-11', 'Proper 23',              'Luke 17:11–19',      'gratitude and healing',              'Luke 17:11-19'],
    ['2026-10-18', 'Proper 24',              'Luke 18:1–8',        'persistent prayer and justice',      'Luke 18:1-8'],
    ['2026-10-25', 'Proper 25',              'Luke 18:9–14',       'pride and humility',                 'Luke 18:9-14'],
    ['2026-11-01', 'All Saints Sunday',      'Luke 6:20–31',       'the Beatitudes',                     'Luke 6:20-31'],
    ['2026-11-08', 'Proper 27',              'Luke 20:27–38',      'resurrection',                       'Luke 20:27-38'],
    ['2026-11-15', 'Proper 28',              'Luke 21:5–19',       'endurance and hope',                 'Luke 21:5-19'],
    ['2026-11-22', 'Christ the King',        'Luke 23:33–43',      'the thief on the cross',             'Luke 23:33-43'],
    // ─── Advent — Year A ─────────────────────────────────────────────────────
    ['2026-11-29', '1st Sunday of Advent',  'Matthew 24:36–44',   'watchfulness and readiness',         'Matthew 24:36-44'],
    ['2026-12-06', '2nd Sunday of Advent',  'Matthew 3:1–12',     'repentance and preparation',         'Matthew 3:1-12'],
    ['2026-12-13', '3rd Sunday of Advent',  'Matthew 11:2–11',    'are you the one who is to come',     'Matthew 11:2-11'],
    ['2026-12-20', '4th Sunday of Advent',  'Matthew 1:18–25',    'the Incarnation',                    'Matthew 1:18-25'],
    ['2026-12-25', 'Christmas Day',          'Luke 2:1–20',        'the birth of Christ',                'Luke 2:1-20'],
  ];

  function getMostRecentSunday() {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday
    const diff = today.getDate() - day;
    return new Date(today.setDate(diff));
  }

  function toYMD(d) {
    return d.toISOString().slice(0, 10);
  }

  function init() {
    const widget = document.getElementById('lectWidget');
    if (!widget) return;

    const thisSunday = toYMD(getMostRecentSunday());
    const entry = RCL.find(([date]) => date === thisSunday)
      || RCL.find(([date]) => date >= thisSunday); // nearest future if no exact match
    if (!entry) return;

    const [, name, gospel, topic, verseQ] = entry;

    document.getElementById('lectName').textContent = name;
    document.getElementById('lectGospel').textContent = gospel;

    // Compare this theme → pre-fills topic input and scrolls to it
    document.getElementById('lectCompareBtn').addEventListener('click', () => {
      const topicEl = document.getElementById('topic');
      if (topicEl) {
        topicEl.value = topic;
        topicEl.focus();
        topicEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    // Research this passage → opens research page with verse pre-filled
    document.getElementById('lectResearchBtn').addEventListener('click', () => {
      window.location.href = `/research?mode=verse&q=${encodeURIComponent(verseQ)}`;
    });

    widget.classList.remove('hidden');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
