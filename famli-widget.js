/* MD FAMLI chat widget — embeddable, dependency-free.
 * Brand-matched to cwchr.com: gold #FFD214 + navy #112337, Montserrat ("mont"),
 * real CWC logo, and the site's wave motif.
 *
 * Usage (e.g. in a WordPress Custom HTML block):
 *   <script src="https://YOUR-CDN/famli-widget.js"
 *           data-endpoint="https://YOUR-PROJECT.functions.supabase.co/ask"></script>
 *
 * Optional attributes:
 *   data-logo="...png"   override the avatar logo (defaults to CWC favicon)
 *   data-waves="...svg"  override the header wave graphic
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute("data-endpoint")) || "/ask";
  var LOGO = (script && script.getAttribute("data-logo")) ||
    "https://cwchr.com/wp-content/uploads/2023/11/cropped-favicon-180x180.png";
  var WAVES = (script && script.getAttribute("data-waves")) ||
    "https://cwchr.com/wp-content/uploads/2023/12/waves-home.svg";
  // mode: "inline" mounts a fixed panel into a page container (the Resources page);
  //       "float" (default) shows a bottom-right launcher bubble.
  var MODE = (script && script.getAttribute("data-mode")) || "float";
  var TARGET_SEL = (script && script.getAttribute("data-target")) || "#famli-chat";
  var INLINE_HEIGHT = (script && script.getAttribute("data-height")) || "620";
  var session = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var demographics = null;
  var contact = null; // optional, consent-framed lead capture (email/position/company)
  var intakeDone = false;
  var history = []; // prior conversation turns, for multi-turn follow-ups

  var DISCLAIMER = "General informational guidance only — not legal, tax, or compliance " +
    "advice. Maryland FAMLI rules and dates can change; confirm with the official program " +
    "and your plan administrator before acting.";

  var STARTERS = [
    "When do FAMLI contributions start?",
    "What's the contribution rate and split?",
    "Who is eligible for FAMLI leave?",
    "Can I use a private plan instead?",
  ];

  // Greeting / small-talk: answered locally with a warm intro instead of hitting
  // the backend (a bare "hello" matches no FAMLI source → would otherwise refuse).
  var GREETING_REPLY = "Hey HR bestie! 👋 I'm your Maryland FAMLI assistant. " +
    "Ask me anything about how Paid Family & Medical Leave works for employers — " +
    "contributions, eligibility, deadlines, private plans, you name it. " +
    "What can I help you figure out?";
  function isGreeting(q) {
    q = (q || "").trim();
    if (/^(?:👋|🙋|🙌|✋|🤙)+$/u.test(q)) return true; // a bare wave emoji
    // core greeting token, optional friendly address (there/bestie/everyone/y'all/…),
    // only greeting-ish trailing words allowed — any real words (a question) break the match.
    return /^[\s.,!?'-]*(hi+|hey+|heya|hiya|hello+|hullo|yo+|sup|wass?up|what'?s?\s*up|howdy|greetings|hola|henlo|heyo|ello|g'?day|gm|good\s+(morning|afternoon|evening|day)|mornin'?|morning|afternoon|evening)(\s+(there|bestie|hr\s*bestie|everyone|every\s*one|all|y'?all|folks|team|friend|friends|guys|peeps|to\s+you))?[\s.,!?'-]*$/i.test(q);
  }

  var ICON_CHAT = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#112337" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.6 9.6 0 0 1-4-1L3 20l1.5-5.5a8.38 8.38 0 0 1-1-4A8.5 8.5 0 0 1 12 2a8.38 8.38 0 0 1 9 8.5z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#13131A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  // ── styles ──
  var css = `
  .famli{--navy:#112337;--navy2:#1b3a63;--ink:#13131A;--gold:#FFD214;--gold2:#e6bd00;
    --bg:#f5f6f8;--line:#e7eaef;--muted:#6b7280;
    --font:"mont","Montserrat",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  .famli *,.famli *::before,.famli *::after{box-sizing:border-box}

  .famli-launch{position:fixed;bottom:24px;right:24px;z-index:99998;display:flex;align-items:center;gap:10px}
  .famli-label{background:#fff;color:var(--navy);font-family:var(--font);font-weight:600;font-size:13px;
    padding:9px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(17,35,55,.16);white-space:nowrap;
    cursor:pointer;border:1px solid var(--line)}
  .famli-bubble{width:62px;height:62px;border-radius:50%;background:var(--gold);border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(255,210,20,.45);
    position:relative;transition:transform .15s ease,box-shadow .15s ease;flex:0 0 auto}
  .famli-bubble:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 30px rgba(255,210,20,.6)}
  .famli-bubble::after{content:"";position:absolute;top:9px;right:9px;width:11px;height:11px;border-radius:50%;
    background:var(--navy);border:2px solid var(--gold)}

  .famli-panel{position:fixed;bottom:100px;right:24px;width:392px;max-width:calc(100vw - 32px);
    height:608px;max-height:calc(100vh - 130px);background:#fff;border-radius:18px;
    box-shadow:0 18px 60px rgba(17,35,55,.32);display:none;flex-direction:column;overflow:hidden;
    z-index:99999;font-family:var(--font);opacity:0;transform:translateY(14px);transition:opacity .2s,transform .2s}
  .famli-panel.open{display:flex;opacity:1;transform:translateY(0)}

  .famli-head{position:relative;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;
    padding:18px 16px;display:flex;align-items:center;gap:13px;overflow:hidden}
  .famli-head::after{content:"";position:absolute;inset:0;background-image:url('${WAVES}');
    background-repeat:no-repeat;background-position:right -40px top -120px;background-size:420px;
    opacity:.14;pointer-events:none}
  .famli-avatar{position:relative;width:44px;height:44px;border-radius:50%;background:var(--navy);
    border:1.5px solid rgba(255,210,20,.5);display:flex;align-items:center;justify-content:center;flex:0 0 auto;
    overflow:hidden;z-index:1}
  .famli-avatar img{width:34px;height:34px;object-fit:contain}
  .famli-avatar .fallback{color:var(--gold);font-weight:800;font-size:13px;letter-spacing:.5px}
  .famli-htxt{position:relative;z-index:1}
  .famli-htxt .t{font-weight:700;font-size:15.5px;line-height:1.1;letter-spacing:.2px}
  .famli-htxt .s{font-weight:400;font-size:11px;opacity:.82;margin-top:4px;display:flex;align-items:center;gap:6px}
  .famli-htxt .dot{width:7px;height:7px;border-radius:50%;background:#3ddc97;display:inline-block;flex:0 0 auto}
  .famli-x{position:relative;z-index:1;margin-left:auto;background:transparent;border:none;cursor:pointer;
    padding:6px;border-radius:8px;opacity:.85;display:flex}
  .famli-x:hover{opacity:1;background:rgba(255,255,255,.12)}

  .famli-msgs{flex:1;overflow-y:auto;padding:16px;background:var(--bg)}
  .famli-msg{margin:10px 0;padding:12px 15px;border-radius:14px;font-size:14px;line-height:1.55;
    white-space:pre-wrap;max-width:88%;animation:famli-in .2s ease}
  @keyframes famli-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .famli-user{background:var(--navy);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
  .famli-bot{background:#fff;color:var(--ink);border:1px solid var(--line);border-bottom-left-radius:4px;
    box-shadow:0 1px 2px rgba(17,35,55,.05)}
  .famli-bot p{margin:0 0 8px}
  .famli-bot p:last-child{margin-bottom:0}
  .famli-bot .famli-h{font-weight:700;margin:10px 0 4px;font-size:13.5px;color:var(--navy)}
  .famli-bot ul,.famli-bot ol{margin:4px 0 8px;padding-left:20px}
  .famli-bot li{margin:3px 0}
  .famli-bot strong{font-weight:700}
  .famli-bot em{font-style:italic}
  .famli-bot code{background:#eef1f5;padding:1px 5px;border-radius:4px;font-size:12.5px;font-family:ui-monospace,Menlo,monospace}
  .famli-bot hr{border:none;border-top:1px solid var(--line);margin:9px 0}
  .famli-bot a{color:var(--navy);font-weight:600;text-decoration:none}
  .famli-bot a:hover{text-decoration:underline}
  .famli-bot table.famli-tbl{border-collapse:collapse;width:100%;margin:8px 0 10px;font-size:13px}
  .famli-bot .famli-tbl th,.famli-bot .famli-tbl td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}
  .famli-bot .famli-tbl th{background:#f1f4f8;font-weight:700;color:var(--navy)}
  .famli-bot .famli-tbl tr:nth-child(even) td{background:#fafbfc}
  .famli-cite{font-size:.82em;vertical-align:super;font-weight:600;line-height:0}
  a.famli-cite{color:var(--navy);text-decoration:none}
  a.famli-cite:hover{text-decoration:underline}
  sup.famli-cite{color:var(--muted)}
  .famli-sources{font-size:12px;margin-top:9px;padding-top:9px;border-top:1px solid var(--line);color:var(--muted)}
  .famli-sources a{color:var(--navy);font-weight:600;text-decoration:none}
  .famli-sources a:hover{text-decoration:underline}

  .famli-chips{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 2px}
  .famli-chip{font-family:var(--font);font-size:12.5px;color:var(--navy);background:#fff;
    border:1px solid #c9d4e2;border-radius:999px;padding:8px 13px;cursor:pointer;transition:all .12s;font-weight:500}
  .famli-chip:hover{background:var(--gold);border-color:var(--gold);color:var(--ink)}

  .famli-typing{display:inline-flex;gap:4px;padding:4px 2px}
  .famli-typing span{width:7px;height:7px;border-radius:50%;background:#9aa6b6;animation:famli-bounce 1.2s infinite}
  .famli-typing span:nth-child(2){animation-delay:.2s}.famli-typing span:nth-child(3){animation-delay:.4s}
  @keyframes famli-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}

  .famli-form{display:flex;align-items:center;gap:9px;padding:13px;border-top:1px solid var(--line);background:#fff}
  .famli-form input{flex:1;border:1px solid var(--line);border-radius:999px;padding:12px 16px;font-size:14px;
    font-family:var(--font);outline:none;background:var(--bg);color:var(--ink)}
  .famli-form input:focus{border-color:var(--navy);background:#fff}
  .famli-form button{border:none;background:var(--gold);width:44px;height:44px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;transition:background .12s}
  .famli-form button:hover{background:var(--gold2)}

  .famli-intake{padding:20px 18px;font-size:13.5px;color:var(--ink)}
  .famli-intake .lead{font-weight:700;font-size:15px;margin-bottom:5px}
  .famli-intake .sub{color:var(--muted);font-size:12.5px;line-height:1.5;margin-bottom:14px}
  .famli-intake label{display:block;font-weight:600;font-size:12.5px;margin:14px 0 6px}
  .famli-intake select{width:100%;padding:11px;border:1px solid var(--line);border-radius:10px;
    font-family:var(--font);font-size:13.5px;background:#fff;color:var(--ink)}
  .famli-intake input{width:100%;padding:11px;border:1px solid var(--line);border-radius:10px;
    font-family:var(--font);font-size:13.5px;background:#fff;color:var(--ink);outline:none}
  .famli-intake input:focus{border-color:var(--navy)}
  .famli-intake .opt{font-weight:400;color:var(--muted)}
  .famli-intake .consent{color:var(--muted);font-size:11px;line-height:1.5;margin-top:12px}
  .famli-intake .row{display:flex;gap:10px;margin-top:14px}
  .famli-intake button{flex:1;padding:12px;border-radius:10px;cursor:pointer;font-family:var(--font);
    font-weight:700;font-size:13.5px;transition:all .12s}
  .famli-intake .primary{background:var(--gold);color:var(--ink);border:1px solid var(--gold)}
  .famli-intake .primary:hover{background:var(--gold2);border-color:var(--gold2)}
  .famli-intake .skip{background:#fff;color:var(--navy);border:1px solid #c9d4e2}
  .famli-intake .skip:hover{background:var(--bg)}

  .famli-foot{font-size:10px;color:var(--muted);padding:10px 14px;border-top:1px solid var(--line);
    background:#fafbfc;line-height:1.5}

  /* inline mode: panel sits inside a page container instead of floating */
  .famli-panel.famli-inline{position:static;bottom:auto;right:auto;width:100%;max-width:100%;
    max-height:82vh;opacity:1;transform:none;display:flex;
    box-shadow:0 6px 26px rgba(17,35,55,.12);border:1px solid var(--line)}

  @media (max-width:480px){
    .famli-panel:not(.famli-inline){bottom:0;right:0;width:100vw;height:100vh;max-height:100vh;border-radius:0}
    .famli-launch{bottom:18px;right:18px}
    .famli-label{display:none}
  }`;
  var style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  // ── DOM ──
  var root = el("div", "famli");
  var launch = el("div", "famli-launch");
  var label = el("button", "famli-label", { "aria-label": "Open FAMLI assistant" }); label.textContent = "Ask about FAMLI";
  var bubble = el("button", "famli-bubble", { "aria-label": "Open FAMLI assistant" }); bubble.innerHTML = ICON_CHAT;
  launch.appendChild(label); launch.appendChild(bubble);

  var panel = el("div", "famli-panel", { role: "dialog", "aria-label": "Maryland FAMLI assistant" });
  panel.innerHTML =
    '<div class="famli-head">' +
      '<div class="famli-avatar"><img src="' + LOGO + '" alt="CWC Human Resources" ' +
        'onerror="this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<span class=&quot;fallback&quot;>CWC</span>\')"></div>' +
      '<div class="famli-htxt"><div class="t">FAMLI Assistant</div>' +
      '<div class="s"><span class="dot"></span>by CWC Human Resources · Maryland Paid Leave</div></div>' +
      '<button class="famli-x" aria-label="Close">' + ICON_CLOSE + "</button>" +
    "</div>" +
    '<div class="famli-msgs" role="log" aria-live="polite"></div>' +
    '<div class="famli-foot">' + DISCLAIMER + "</div>";
  var msgs = panel.querySelector(".famli-msgs");

  var inlineTarget = MODE === "inline" ? document.querySelector(TARGET_SEL) : null;
  if (MODE === "inline" && !inlineTarget) {
    console.warn('[famli] inline mode: no element matches "' + TARGET_SEL + '" — falling back to floating bubble.');
    MODE = "float";
  }

  if (MODE === "inline") {
    // Mount the panel directly into the page container; no launcher, no close button.
    panel.classList.add("famli-inline", "open");
    panel.style.height = INLINE_HEIGHT + "px";
    var xBtn = panel.querySelector(".famli-x"); if (xBtn) xBtn.remove();
    root.appendChild(panel);
    inlineTarget.appendChild(root);
    renderIntake();
  } else {
    root.appendChild(launch); root.appendChild(panel); document.body.appendChild(root);
    bubble.addEventListener("click", toggle);
    label.addEventListener("click", toggle);
    panel.querySelector(".famli-x").addEventListener("click", toggle);
  }

  function toggle() {
    panel.classList.toggle("open");
    launch.style.display = panel.classList.contains("open") ? "none" : "flex";
    if (panel.classList.contains("open") && !intakeDone) renderIntake();
  }

  function renderIntake() {
    var box = el("div", "famli-intake");
    box.innerHTML =
      '<div class="lead">Hi — I\'m the Maryland FAMLI Assistant. 👋</div>' +
      '<div class="sub">A couple optional questions help me tailor answers to your organization.</div>' +
      '<label>How many employees does your organization have?<select id="famli-size">' +
      '<option value="">Prefer not to say</option>' +
      '<option value="<=14">14 or fewer</option>' +
      '<option value="15-49">15–49</option>' +
      '<option value="50+">50 or more</option></select></label>' +
      '<label>Interested in a private/self-funded plan?<select id="famli-plan">' +
      '<option value="">Not sure yet</option><option value="state">State plan</option>' +
      '<option value="private">Private / self-funded</option></select></label>' +
      '<label>Company name <span class="opt">(optional)</span>' +
      '<input type="text" id="famli-company" autocomplete="organization" maxlength="160" placeholder="Your organization"></label>' +
      '<label>Industry <span class="opt">(optional)</span>' +
      '<input type="text" id="famli-industry" maxlength="80" placeholder="e.g. Healthcare, Construction, Nonprofit"></label>' +
      '<label>Your role <span class="opt">(optional)</span>' +
      '<input type="text" id="famli-position" autocomplete="organization-title" maxlength="120" placeholder="e.g. HR Director"></label>' +
      '<label>Work email <span class="opt">(optional)</span>' +
      '<input type="email" id="famli-email" autocomplete="email" maxlength="254" placeholder="you@company.com"></label>' +
      '<div class="consent">If you share contact details, CWC Human Resources may follow up about your FAMLI questions. Leave blank to stay anonymous.</div>' +
      '<div class="row"><button class="primary" id="famli-go">Get started</button>' +
      '<button class="skip" id="famli-skip">Skip</button></div>';
    msgs.appendChild(box);
    box.querySelector("#famli-go").onclick = function () {
      var size = box.querySelector("#famli-size").value;
      var plan = box.querySelector("#famli-plan").value;
      var company = box.querySelector("#famli-company").value.trim();
      var industry = box.querySelector("#famli-industry").value.trim();
      var position = box.querySelector("#famli-position").value.trim();
      var email = box.querySelector("#famli-email").value.trim();
      demographics = (size || plan) ? { sizeBand: size || null, planInterest: plan || null } : null;
      contact = (email || position || company || industry)
        ? { email: email || null, position: position || null, company: company || null, industry: industry || null }
        : null;
      finishIntake(box);
    };
    box.querySelector("#famli-skip").onclick = function () { demographics = null; contact = null; finishIntake(box); };
  }

  function finishIntake(box) {
    intakeDone = true;
    box.remove();
    addBot("Ask me anything about how Maryland's Paid Family & Medical Leave (FAMLI) program works for employers. Here are a few to start:");
    renderChips();
    renderForm();
  }

  function renderChips() {
    var wrap = el("div", "famli-msg famli-bot");
    var chips = el("div", "famli-chips");
    STARTERS.forEach(function (q) {
      var c = el("button", "famli-chip"); c.type = "button"; c.textContent = q;
      c.onclick = function () { wrap.remove(); ask(q); };
      chips.appendChild(c);
    });
    wrap.appendChild(chips); msgs.appendChild(wrap); msgs.scrollTop = msgs.scrollHeight;
  }

  function renderForm() {
    var form = el("form", "famli-form");
    form.innerHTML = '<input type="text" placeholder="Ask a FAMLI question…" aria-label="Your question" required>' +
      '<button type="submit" aria-label="Send">' + ICON_SEND + "</button>";
    panel.insertBefore(form, panel.querySelector(".famli-foot"));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input");
      var q = input.value.trim(); if (!q) return;
      input.value = ""; ask(q);
    });
  }

  function ask(question) {
    addUser(question);
    if (isGreeting(question)) { addBot(GREETING_REPLY); return; }
    var thinking = el("div", "famli-msg famli-bot");
    thinking.innerHTML = '<div class="famli-typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(thinking); msgs.scrollTop = msgs.scrollHeight;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, demographics: demographics, contact: contact, session: session, history: history.slice(-6) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        thinking.remove();
        var answer = data.answer || "Sorry, something went wrong.";
        var citeMap = {};
        (data.citations || []).forEach(function (c) { citeMap[c.n] = c; });
        var b = addBot(answer, citeMap);
        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: answer });
        // one consolidated source list — only the sources actually cited in the answer
        if (data.citations && data.citations.length) {
          var used = {}, re = /\[(\d+)\]/g, mm;
          while ((mm = re.exec(answer))) used[mm[1]] = true;
          var list = data.citations.filter(function (c) { return used[c.n]; });
          if (list.length) {
            var s = el("div", "famli-sources");
            s.innerHTML = "Sources:<br>" + list.map(function (c) {
              var lbl = "[" + c.n + "] " + escapeHtml(c.label);
              return c.url ? '<a href="' + c.url + '" target="_blank" rel="noopener">' + lbl + "</a>" : lbl;
            }).join("<br>");
            b.appendChild(s);
          }
        }
      })
      .catch(function () { thinking.remove(); addBot("Sorry — I couldn't reach the assistant. Please try again."); });
  }

  // ── helpers ──
  function addUser(t) { return addMsg(t, "famli-user", false); }
  function addBot(t, citeMap) { return addMsg(t, "famli-bot", true, citeMap); }
  function addMsg(text, cls, asHtml, citeMap) {
    var d = el("div", "famli-msg " + cls);
    if (asHtml) d.innerHTML = mdToHtml(text, citeMap); else d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }

  // Minimal, XSS-safe Markdown → HTML (escape first, then format). Supports
  // headings, bold/italic, lists, links, code, hr, tables, and [n] citations.
  function mdToHtml(md, citeMap) {
    var inline = function (s) {
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
      s = s.replace(/\[(\d+)\]/g, function (_m, n) {
        var c = citeMap && citeMap[n];
        if (c && c.url) return '<a class="famli-cite" href="' + c.url + '" target="_blank" rel="noopener" title="' + escapeHtml(c.label || "") + '">[' + n + "]</a>";
        return '<sup class="famli-cite"' + (c ? ' title="' + escapeHtml(c.label || "") + '"' : "") + ">[" + n + "]</sup>";
      });
      return s;
    };
    var splitRow = function (s) { return s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (x) { return x.trim(); }); };
    var cell = function (tag, c) { return "<" + tag + ">" + inline(escapeHtml(c)) + "</" + tag + ">"; };
    var lines = String(md).split("\n");
    var html = "", listType = null;
    var closeList = function () { if (listType) { html += "</" + listType + ">"; listType = null; } };
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+$/, "");
      if (!line.trim()) { closeList(); continue; }
      // table: a "| … |" header row followed by a "|---|---|" separator row
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /-/.test(lines[i + 1]) && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        closeList();
        var head = splitRow(line), rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        i--;
        html += '<table class="famli-tbl"><thead><tr>' + head.map(function (c) { return cell("th", c); }).join("") +
          "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return cell("td", c); }).join("") + "</tr>"; }).join("") + "</tbody></table>";
        continue;
      }
      var e = escapeHtml(line);
      var h = e.match(/^(#{1,6})\s+(.*)$/);
      var bullet = e.match(/^[-*]\s+(.*)$/);
      var numbered = e.match(/^\d+\.\s+(.*)$/);
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { closeList(); html += "<hr>"; continue; }
      if (h) { closeList(); html += '<div class="famli-h">' + inline(h[2]) + "</div>"; continue; }
      if (bullet) { if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; } html += "<li>" + inline(bullet[1]) + "</li>"; continue; }
      if (numbered) { if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; } html += "<li>" + inline(numbered[1]) + "</li>"; continue; }
      closeList();
      html += "<p>" + inline(e) + "</p>";
    }
    closeList();
    return html;
  }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag); if (cls) n.className = cls;
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
})();
