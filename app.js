/***************
 * DOM & State
 ***************/
const els = {
  type: document.getElementById('type'),
  partyDiv: document.getElementById('partyDiv'),
  stateDiv: document.getElementById('stateDiv'),
  politicianDiv: document.getElementById('politicianDiv'),
  optionsDiv: document.getElementById('optionsDiv'),
  generateBtn: document.getElementById('generateBtn'),
  outputDiv: document.getElementById('outputDiv'),
  output: document.getElementById('output'),
  copyBtn: document.getElementById('copyBtn'),
  mailtoBtn: document.getElementById('mailtoBtn'),
  party: document.getElementById('party'),
  state: document.getElementById('state'),
  politician: document.getElementById('politician'),
  subject: document.getElementById('subject'),
  tone: document.getElementById('tone')
};

let DATA = {
  parties: [],             // [{id,label}]
  politiciansByState: {}   // { state: [{id,name}, ...], ... }
};

// Tom Select instances
let tsParty, tsState, tsPolitician;

/********************
 * Initialization
 ********************/
init();

async function init() {
  await loadData();

  // Initialize Tom Select on selects we want searchable
  tsParty = new TomSelect('#party', {
    persist: false,
    create: false,
    sortField: {field:'text', direction:'asc'},
    searchField: ['text', 'value'],
    placeholder: 'Search or select a party…'
  });

  tsState = new TomSelect('#state', {
    persist: false,
    create: false,
    sortField: {field:'text', direction:'asc'},
    searchField: ['text', 'value'],
    placeholder: 'Search or select a state…'
  });

  tsPolitician = new TomSelect('#politician', {
    persist: false,
    create: false,
    maxOptions: 5000, // allow large lists
    sortField: {field:'text', direction:'asc'},
    searchField: ['text', 'value'],
    placeholder: 'Type to search politician…'
  });

  // Populate party and state dropdowns
  populateParties();
  populateStates();

  // Hook up events
  wireEvents();
}

/********************
 * Data Loading
 ********************/
async function loadData() {
  // Fetch JSON files (served statically by GitHub Pages)
  const [polRes, partyRes] = await Promise.all([
    fetch('data/politicians.json'),
    fetch('data/parties.json').catch(() => null) // optional file
  ]);

  DATA.politiciansByState = await polRes.json();
  if (partyRes && partyRes.ok) {
    DATA.parties = await partyRes.json();
  } else {
    // Fallback if you don’t have parties.json: define inline
    DATA.parties = [
      {id:'partyA', label:'Party A'},
      {id:'partyB', label:'Party B'},
      {id:'partyC', label:'Party C'}
    ];
  }
}

/********************
 * Populate dropdowns
 ********************/
function populateParties() {
  tsParty.clearOptions();
  DATA.parties.forEach(p => tsParty.addOption({value: p.id, text: p.label}));
  tsParty.refreshOptions(false);
}

function populateStates() {
  tsState.clearOptions();
  Object.keys(DATA.politiciansByState)
    .sort()
    .forEach(stateCode => tsState.addOption({value: stateCode, text: readableState(stateCode)}));
  tsState.refreshOptions(false);
}

function populatePoliticians(stateCode) {
  tsPolitician.clear(); // clear selection
  tsPolitician.clearOptions();

  const list = DATA.politiciansByState[stateCode] || [];
  list.forEach(p => tsPolitician.addOption({value: p.name, text: p.name}));
  tsPolitician.refreshOptions(false);
}

/********************
 * Event wiring
 ********************/
function wireEvents() {
  els.type.addEventListener('change', () => {
    const t = els.type.value;
    hide(els.partyDiv, els.stateDiv, els.politicianDiv, els.outputDiv, els.generateBtn);
    els.subject.value = '';
    tsPolitician.clear();
    tsPolitician.clearOptions();

    if (t === 'leader') {
      show(els.partyDiv, els.optionsDiv);
    } else if (t === 'mp') {
      show(els.stateDiv, els.optionsDiv);
    }
  });

  // When a party is selected, enable generate
  els.party.addEventListener('change', () => {
    show(els.generateBtn);
    hide(els.outputDiv);
  });

  // When a state is selected, populate politicians and show dropdown
  els.state.addEventListener('change', () => {
    const stateCode = els.state.value;
    populatePoliticians(stateCode);
    show(els.politicianDiv);
    hide(els.outputDiv);
  });

  // When a politician is selected, enable generate
  els.politician.addEventListener('change', () => {
    show(els.generateBtn);
    hide(els.outputDiv);
  });

  // Generate email
  els.generateBtn.addEventListener('click', () => {
    const type = els.type.value;
    const tone = els.tone.value;
    const subjectOverride = els.subject.value.trim();

    let subject = 'Re:';
    let body = '';

    if (type === 'leader') {
      const party = els.party.value;
      subject = subjectOverride || Templates.leader.subject(party);
      body = Templates.leader.body({ party, tone });
    } else if (type === 'mp') {
      const stateCode = els.state.value;
      const politician = els.politician.value;
      subject = subjectOverride || Templates.mp.subject(stateCode, politician);
      body = Templates.mp.body({ state: stateCode, politician, tone });
    }

    els.output.value = `Subject: ${subject}\n\n${body}`;
    show(els.outputDiv);
  });

  // Copy
  els.copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.output.value);
      alert('Email copied to clipboard!');
    } catch {
      els.output.focus(); els.output.select();
      document.execCommand('copy');
      alert('Copied (fallback).');
    }
  });

  // Mailto
  els.mailtoBtn.addEventListener('click', () => {
    const text = els.output.value || '';
    const m = text.match(/^Subject:\s*(.*)\n\n([\s\S]*)$/);
    const subject = encodeURIComponent(m ? m[1] : 'Re:');
    const body = encodeURIComponent(m ? m[2] : text);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  });
}

/********************
 * Templates & helpers
 ********************/
const Templates = {
  leader: {
    subject: (party) => `Request for meeting with ${readableParty(party)} Party Leader`,
    body: ({ party, tone }) => {
      const greet = `Dear ${readableParty(party)} Party Leader,`;
      const toneLine = chooseToneLine(tone);
      return `${greet}

${toneLine} I’m writing to request a brief meeting to discuss [topic/issue] and its impact on our community.

I’d appreciate the opportunity to share evidence‑based considerations and potential solutions that could inform your party’s policy priorities.

Kind regards,
[Your Name]
[Affiliation, optional]`;
    }
  },
  mp: {
    subject: (stateCode, politician) => `Constituent request from ${readableState(stateCode)} for ${politician}`,
    body: ({ state, politician, tone }) => {
      const greet = `Dear ${politician},`;
      const toneLine = chooseToneLine(tone);
      return `${greet}

${toneLine} As a constituent from ${readableState(state)}, I’m writing regarding [topic/issue]. I’m seeking your support to address the following points:
• Point 1
• Point 2
• Point 3

Thank you for your time and service.

Sincerely,
[Your Name]
[Address / Postcode, optional]`;
    }
  }
};

function chooseToneLine(tone) {
  const lines = {
    formal: "I hope this message finds you well.",
    neutral: "I hope you're well.",
    friendly: "Hope you're doing well!",
    concise: ""
  };
  return lines[tone] || "";
}

function readableParty(code) {
  const map = Object.fromEntries(DATA.parties.map(p => [p.id, p.label]));
  return map[code] || code;
}

function readableState(code) {
  // Replace with your real state label mapping if needed
  const pretty = code.replace(/(^|[-_])(\w)/g, (_, sep, c) => (sep ? ' ' : '') + c.toUpperCase());
  return pretty.trim();
}

function show(...els) { els.forEach(el => el.classList.remove('hidden')); }
function hide(...els) { els.forEach(el => el.classList.add('hidden')); }
