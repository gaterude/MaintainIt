const ALLOWED_CATEGORIES = ['plumbing','electrical','cleaning','appliance','structural','other'];
const ALLOWED_PRIORITIES = ['low','medium','urgent'];

async function assessWithAi(description) {
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) {
    const error = new Error('Describe the maintenance issue in 10 to 2,000 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('AI assistance is not configured yet. You can still submit a maintenance request normally.');
    error.statusCode = 503;
    throw error;
  }
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a cautious residential maintenance intake assistant. The tenant may write in English or Swahili; always reply in English. Return JSON only with keys category, priority, technician_type, possible_causes (array), suggested_next_steps (array), safety_note. category must be plumbing/electrical/cleaning/appliance/structural/other. priority must be low/medium/urgent. Never claim a definitive diagnosis, never estimate cost, never decide tenant liability, and never dispatch a technician. If there may be immediate danger, advise the user to keep away and contact property management or local emergency services.' },
        { role: 'user', content: description.trim() }
      ]
    }),
    signal: AbortSignal.timeout(20000)
    });
  } catch (networkError) {
    // Logged for the developer only (never sent to the tenant, and never includes the key).
    console.error('AI request failed before a reply:', networkError.name, networkError.cause?.code || networkError.cause?.message || networkError.message);
    throw Object.assign(new Error('The AI assistant is temporarily unavailable. Please submit your request using the normal form.'), { statusCode: 502 });
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch { /* ignore */ }
    console.error('AI request rejected by OpenAI:', response.status, detail);
    const error = new Error('The AI assistant is temporarily unavailable. Please submit your request using the normal form.');
    error.statusCode = 502;
    throw error;
  }
  const payload = await response.json();
  let result;
  try { result = JSON.parse(payload.choices?.[0]?.message?.content || '{}'); }
  catch { throw Object.assign(new Error('AI returned an unreadable assessment. Please use the normal request form.'), { statusCode: 502 }); }
  return {
    category: ALLOWED_CATEGORIES.includes(result.category) ? result.category : 'other',
    priority: ALLOWED_PRIORITIES.includes(result.priority) ? result.priority : 'medium',
    technicianType: String(result.technician_type || 'General maintenance technician').slice(0,120),
    possibleCauses: Array.isArray(result.possible_causes) ? result.possible_causes.slice(0,4).map(x => String(x).slice(0,240)) : [],
    suggestedNextSteps: Array.isArray(result.suggested_next_steps) ? result.suggested_next_steps.slice(0,5).map(x => String(x).slice(0,240)) : [],
    safetyNote: String(result.safety_note || 'This is an initial suggestion, not a professional diagnosis.').slice(0,400),
    disclaimer: 'AI suggestions are advisory only. Confirm the category and priority yourself. MaintainIt does not use this assessment to decide responsibility, charge tenants or assign fundis.'
  };
}


// ---------------------------------------------------------------------------
// Fallback: a simple keyword-based suggestion that works with no AI account.
// It is used when the AI key is missing, out of credit, or unreachable, so the
// "Assess issue" button always gives the tenant something useful.
// ---------------------------------------------------------------------------
const KEYWORDS = {
  plumbing: ['leak', 'drip', 'pipe', 'tap', 'faucet', 'sink', 'toilet', 'drain', 'blocked', 'flood', 'water', 'shower', 'burst', 'bomba', 'maji', 'choo'],
  electrical: ['socket', 'switch', 'wiring', 'wire', 'power', 'electric', 'spark', 'bulb', 'light', 'fuse', 'breaker', 'tripped', 'outlet', 'shock', 'umeme'],
  cleaning: ['dirty', 'mould', 'mold', 'pest', 'cockroach', 'rat', 'rats', 'garbage', 'rubbish', 'smell', 'stink', 'infestation'],
  appliance: ['fridge', 'refrigerator', 'cooker', 'oven', 'heater', 'geyser', 'washing machine', 'microwave', 'fan', 'tv', 'television'],
  structural: ['roof', 'ceiling', 'wall', 'crack', 'door', 'window', 'lock', 'floor', 'gate', 'paa', 'ukuta', 'mlango', 'dirisha']
};

const URGENT_WORDS = ['burst', 'flood', 'spark', 'fire', 'gas', 'shock', 'smoke', 'no water', 'collapse', 'exposed wire', 'short circuit', 'sewage'];
const LOW_WORDS = ['paint', 'squeak', 'scratch', 'cosmetic', 'minor', 'loose handle', 'small mark'];

const TECHNICIANS = {
  plumbing: 'Plumber',
  electrical: 'Electrician',
  cleaning: 'Cleaning or pest-control service',
  appliance: 'Appliance repair technician',
  structural: 'Builder or carpenter',
  other: 'General maintenance technician'
};

const CAUSES = {
  plumbing: ['A worn or loose pipe fitting or washer', 'A blockage in the pipe or drain'],
  electrical: ['A loose connection or faulty switch or socket', 'An overloaded circuit or tripped breaker'],
  cleaning: ['A build-up of moisture or waste', 'Pests entering through gaps or drains'],
  appliance: ['Normal wear on a part of the appliance', 'A power or settings problem'],
  structural: ['Age or movement in the building materials', 'Water getting into the structure'],
  other: ['The cause is not clear from this description']
};

const STEPS = {
  plumbing: ['Close the nearest water valve if water is escaping', 'Place a container under the leak and take a photo'],
  electrical: ['Switch off the affected circuit if it is safe to do so', 'Do not touch exposed wires and take a photo from a distance'],
  cleaning: ['Keep the area ventilated', 'Take photos showing the affected area'],
  appliance: ['Unplug the appliance', 'Note the model and what happens when you use it'],
  structural: ['Keep away from any damaged area', 'Take photos from a few angles'],
  other: ['Add as much detail as you can to your request', 'Attach a photo showing the problem']
};

function keywordAssessment(description) {
  const text = description.toLowerCase();
  const has = (word) => text.includes(word);

  let category = 'other';
  let best = 0;
  for (const [name, words] of Object.entries(KEYWORDS)) {
    const score = words.filter(has).length;
    if (score > best) { best = score; category = name; }
  }

  const urgent = URGENT_WORDS.some(has);
  const priority = urgent ? 'urgent' : LOW_WORDS.some(has) ? 'low' : 'medium';

  const dangerous = urgent || category === 'electrical';

  return {
    category,
    priority,
    technicianType: TECHNICIANS[category],
    possibleCauses: CAUSES[category],
    suggestedNextSteps: STEPS[category],
    safetyNote: dangerous
      ? 'If there is any risk of fire, electric shock, gas or flooding, keep away and contact property management straight away.'
      : 'This is an initial suggestion, not a professional diagnosis.',
    disclaimer: 'Quick suggestion based on keywords in your description (the AI assistant is not connected right now). Please confirm the category and priority yourself.'
  };
}

// Validates the text, tries the AI first, and falls back to the keyword suggestion.
async function assessIssue(description) {
  if (typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 2000) {
    const error = new Error('Describe the maintenance issue in 10 to 2,000 characters.');
    error.statusCode = 400;
    throw error;
  }
  try {
    return await assessWithAi(description);
  } catch (error) {
    console.warn('AI unavailable, using keyword suggestion instead:', error.statusCode || '', error.message);
    return keywordAssessment(description);
  }
}

module.exports = { assessIssue };