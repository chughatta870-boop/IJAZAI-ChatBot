/* IJAZ AI - script.js
   Chat (world info) + Image generation (min 3 images per request)
   Uses free, no-key Pollinations.ai endpoints - works on static GitHub Pages hosting.
   Author: M Ijaz, GHS 124/NB
*/
(function () {
  'use strict';

  var chatLog = document.getElementById('chatLog');
  var typingRow = document.getElementById('typingRow');
  var promptInput = document.getElementById('promptInput');
  var sendBtn = document.getElementById('sendBtn');
  var newChatBtn = document.getElementById('newChatBtn');
  var installBtn = document.getElementById('installBtn');
  var modeChips = document.querySelectorAll('.mode-chip');
  var chatPanel = document.getElementById('chatPanel');
  var imagePanel = document.getElementById('imagePanel');
  var imageGallery = document.getElementById('imageGallery');
  var imageEmpty = document.getElementById('imageEmpty');
  var micModeBtn = document.getElementById('micModeBtn');
  var modeIcon = document.getElementById('modeIcon');
  var hintMode = document.getElementById('hintMode');
  var toastEl = document.getElementById('toast');
  var suggChips = document.querySelectorAll('.sugg-chip');

  var STORAGE_KEY = 'ijazai_history_v1';
  var currentMode = 'chat'; // 'chat' | 'image'
  var isBusy = false;
  var history = []; // {role:'user'|'assistant', content:string}

  var ICON_CHAT = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 4h16v12H5.17L4 17.17V4m0-2a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4z"/></svg>';
  var ICON_IMAGE = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';

  /* ---------------- Utilities ---------------- */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Lightweight markdown renderer: headings, bold, italics, bullet lists, line breaks.
  // Input is escaped first so no raw HTML can be injected.
  function renderMarkdown(raw) {
    var lines = escapeHtml(raw).split('\n');
    var html = '';
    var inList = false;

    function inline(s) {
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      return s;
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();
      var heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
      var bullet = trimmed.match(/^[-*•]\s+(.*)$/);

      if (heading) {
        if (inList) { html += '</ul>'; inList = false; }
        var level = Math.min(heading[1].length + 3, 6);
        html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
      } else if (bullet) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + inline(bullet[1]) + '</li>';
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<br>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += inline(line) + '<br>';
      }
    });
    if (inList) html += '</ul>';
    return html;
  }

  function showToast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.add('hidden');
    }, ms || 2400);
  }

  function scrollChatToBottom() {
    chatLog.scrollTop = chatLog.scrollHeight + 200;
  }

  function nowTime() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-40)));
    } catch (e) { /* storage full or unavailable - ignore */ }
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        history = JSON.parse(raw) || [];
        history.forEach(function (m) {
          renderMessage(m.role, m.content, false);
        });
        if (history.length) {
          var welcome = document.querySelector('.welcome-card');
          if (welcome) welcome.remove();
        }
      }
    } catch (e) { history = []; }
  }

  /* ---------------- Mode switching ---------------- */
  function setMode(mode) {
    currentMode = mode;
    modeChips.forEach(function (chip) {
      var active = chip.getAttribute('data-mode') === mode;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    chatPanel.classList.toggle('active', mode === 'chat');
    imagePanel.classList.toggle('active', mode === 'image');
    if (mode === 'chat') {
      promptInput.placeholder = 'Kuch bhi puchein... duniya ki koi bhi maloomat';
      hintMode.textContent = 'Chat mode';
      modeIcon.outerHTML = '<svg id="modeIcon" viewBox="0 0 24 24" width="20" height="20">' + ICON_CHAT.match(/<path[^>]*>/)[0] + '</svg>';
    } else {
      promptInput.placeholder = 'Image ka description likhein (e.g. "sunset over mountains")';
      hintMode.textContent = 'Image Studio mode';
      modeIcon.outerHTML = '<svg id="modeIcon" viewBox="0 0 24 24" width="20" height="20">' + ICON_IMAGE.match(/<path[^>]*>/)[0] + '</svg>';
    }
    modeIcon = document.getElementById('modeIcon');
  }

  modeChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      setMode(chip.getAttribute('data-mode'));
    });
  });

  micModeBtn.addEventListener('click', function () {
    setMode(currentMode === 'chat' ? 'image' : 'chat');
  });

  suggChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      promptInput.value = chip.getAttribute('data-q');
      handleSend();
    });
  });

  newChatBtn.addEventListener('click', function () {
    if (isBusy) return;
    history = [];
    saveHistory();
    chatLog.innerHTML =
      '<div class="welcome-card">' +
      '<h1>Naya chat shuru ho gaya 👍</h1>' +
      '<p>Ab kuch bhi puchein — IJAZ AI puri duniya ki maloomat aapko de sakta hai.</p>' +
      '</div>';
    imageGallery.innerHTML = '';
    imageEmpty.classList.remove('hidden');
    showToast('Naya chat shuru ho gaya');
  });

  /* ---------------- Chat rendering ---------------- */
  function renderMessage(role, content, animate) {
    var row = document.createElement('div');
    row.className = 'msg-row ' + (role === 'user' ? 'user' : 'ai');

    var avatar = document.createElement('div');
    avatar.className = role === 'user' ? 'avatar-user' : 'avatar-ai';
    avatar.textContent = role === 'user' ? 'You' : 'AI';

    var wrap = document.createElement('div');
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = role === 'user'
      ? escapeHtml(content).replace(/\n/g, '<br>')
      : renderMarkdown(content);

    var time = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = nowTime();
    time.style.textAlign = role === 'user' ? 'right' : 'left';

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(wrap);
    chatLog.appendChild(row);
    scrollChatToBottom();
    return bubble;
  }

  function renderErrorMessage(content) {
    var bubble = renderMessage('assistant', content, true);
    bubble.classList.add('error');
  }

  /* ---------------- AI Text (world info) ---------------- */
  var SYSTEM_PROMPT = 'You are IJAZ AI, a friendly, knowledgeable assistant used by a school teacher in Pakistan. ' +
    'Answer clearly and accurately about any topic in the world (history, science, geography, current affairs, education, general knowledge). ' +
    'If the user writes in Roman Urdu / Hinglish, reply in the same friendly mixed style. Keep answers well-structured and not overly long.';

  function askTextAI(userText) {
    // Primary: POST to the OpenAI-compatible endpoint (handles long prompts + special
    // characters reliably; the old GET/{prompt} form can 400 on long/encoded text).
    var recentHistory = history.slice(-6).map(function (m) {
      var content = m.content.length > 1200 ? m.content.slice(0, 1200) + '...' : m.content;
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: content };
    });
    var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(recentHistory);

    return fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai', messages: messages, seed: Date.now() % 100000 })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (body) {
            throw new Error('POST ' + res.status + ': ' + body.slice(0, 200));
          });
        }
        return res.json();
      })
      .then(function (data) {
        var text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!text) throw new Error('Empty response from API');
        return text;
      })
      .catch(function (postErr) {
        // Fallback: simple GET endpoint (short prompt only, no history, to stay under URL limits)
        var url = 'https://text.pollinations.ai/' + encodeURIComponent(userText) +
          '?model=openai&seed=' + (Date.now() % 100000);
        return fetch(url, { method: 'GET' }).then(function (res) {
          if (!res.ok) {
            return res.text().then(function (body) {
              throw new Error('GET ' + res.status + ' (after POST: ' + postErr.message + '): ' + body.slice(0, 150));
            });
          }
          return res.text();
        });
      });
  }

  function handleChatSend(text) {
    renderMessage('user', text);
    history.push({ role: 'user', content: text });
    saveHistory();
    promptInput.value = '';
    autoGrow();

    typingRow.classList.remove('hidden');
    scrollChatToBottom();
    isBusy = true;
    sendBtn.disabled = true;

    askTextAI(text)
      .then(function (answer) {
        typingRow.classList.add('hidden');
        var clean = (answer || '').trim() || 'Maazrat, jawab nahi mil saka. Dobara koshish karein.';
        renderMessage('assistant', clean);
        history.push({ role: 'assistant', content: clean });
        saveHistory();
      })
      .catch(function (err) {
        typingRow.classList.add('hidden');
        renderErrorMessage('⚠️ Maazrat! Jawab laane mein masla hua. Internet connection check karein aur dobara koshish karein.\n(' + err.message + ')');
      })
      .finally(function () {
        isBusy = false;
        sendBtn.disabled = false;
      });
  }

  /* ---------------- Image generation ---------------- */
  var IMAGE_COUNT = 3;

  function buildImageUrl(prompt, seed, size) {
    var w = size || 480, h = size || 480;
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
      '?width=' + w + '&height=' + h + '&seed=' + seed + '&model=flux&nologo=true';
  }

  function handleImageSend(promptText) {
    imageEmpty.classList.add('hidden');

    var label = document.createElement('div');
    label.className = 'image-batch-label';
    label.textContent = '"' + promptText + '" — ' + nowTime();
    imageGallery.prepend(label);

    var cards = [];
    for (var i = 0; i < IMAGE_COUNT; i++) {
      var seed = Math.floor(Math.random() * 1000000) + i;
      var card = document.createElement('div');
      card.className = 'image-card';
      card.innerHTML = '<div class="img-skeleton">Bana raha hoon...</div>';
      imageGallery.insertBefore(card, label.nextSibling);
      cards.push({ card: card, seed: seed });
    }

    isBusy = true;
    sendBtn.disabled = true;

    var loaded = 0;
    function markDone() {
      loaded++;
      if (loaded === cards.length) {
        isBusy = false;
        sendBtn.disabled = false;
      }
    }

    function loadOne(item) {
      var img = new Image();
      var settled = false;
      img.alt = promptText;
      img.loading = 'lazy';

      var timeoutId = setTimeout(function () {
        if (settled) return;
        settled = true;
        showRetryCard(item, promptText, 'Zyada waqt lag raha hai ⏱️');
        markDone();
      }, 30000);

      img.onload = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        item.card.innerHTML = '';
        item.card.appendChild(img);

        var actions = document.createElement('div');
        actions.className = 'img-actions';

        var dlBtn = document.createElement('button');
        dlBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>';
        dlBtn.title = 'Download';
        dlBtn.addEventListener('click', function () {
          downloadImage(img.src, 'ijaz-ai-image-' + item.seed + '.jpg');
        });

        var shareBtn = document.createElement('button');
        shareBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L7.04 9.81A3 3 0 1 0 4 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a3 3 0 1 0 3-3z"/></svg>';
        shareBtn.title = 'Share';
        shareBtn.addEventListener('click', function () {
          shareImage(img.src, promptText);
        });

        actions.appendChild(dlBtn);
        actions.appendChild(shareBtn);
        item.card.appendChild(actions);
        markDone();
      };

      img.onerror = function () {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        showRetryCard(item, promptText, '❌ Load nahi hui');
        markDone();
      };

      img.src = buildImageUrl(promptText, item.seed);
    }

    function showRetryCard(item, promptText, msg) {
      item.card.innerHTML = '';
      var box = document.createElement('div');
      box.className = 'img-skeleton';
      box.style.flexDirection = 'column';
      box.style.gap = '8px';
      var text = document.createElement('span');
      text.textContent = msg;
      var retryBtn = document.createElement('button');
      retryBtn.textContent = '🔄 Dobara koshish';
      retryBtn.style.cssText = 'padding:6px 12px;border-radius:8px;border:1px solid #223050;background:#17233b;color:#E7ECF7;font-size:11px;';
      retryBtn.addEventListener('click', function () {
        isBusy = true;
        sendBtn.disabled = true;
        item.card.innerHTML = '<div class="img-skeleton">Bana raha hoon...</div>';
        loaded--; // will be re-incremented by markDone when this retry settles
        loadOne(item);
      });
      box.appendChild(text);
      box.appendChild(retryBtn);
      item.card.appendChild(box);
    }

    // Stagger requests slightly so the free API isn't hit with 3 simultaneous
    // calls at once - this noticeably improves reliability and perceived speed.
    cards.forEach(function (item, idx) {
      setTimeout(function () { loadOne(item); }, idx * 350);
    });
  }

  function downloadImage(url, filename) {
    fetch(url)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 3000);
        showToast('Image download ho gayi ✅');
      })
      .catch(function () {
        showToast('Download mein masla hua, dobara koshish karein');
      });
  }

  function shareImage(url, promptText) {
    if (navigator.share) {
      fetch(url)
        .then(function (res) { return res.blob(); })
        .then(function (blob) {
          var file = new File([blob], 'ijaz-ai-image.jpg', { type: blob.type || 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            return navigator.share({ files: [file], title: 'IJAZ AI Image', text: promptText });
          }
          return navigator.share({ title: 'IJAZ AI Image', text: promptText, url: url });
        })
        .catch(function () { /* user cancelled or unsupported - ignore */ });
    } else {
      showToast('Is device par sharing support nahi hai');
    }
  }

  /* ---------------- Send handling ---------------- */
  function looksLikeImageRequest(text) {
    var t = text.toLowerCase().trim();

    // Direct action verbs commonly used for image generation requests (English + Roman Urdu)
    var actionPhrases = [
      /\bcreate\s+(an?\s+)?image\b/, /\bgenerate\s+(an?\s+)?image\b/, /\bmake\s+(an?\s+)?image\b/,
      /\bdraw\s+(an?|me)\b/, /\bshow\s+me\s+(an?\s+)?(image|picture|photo)\b/,
      /\bimage\s+of\b/, /\bpicture\s+of\b/, /\bphoto\s+of\b/, /\bwallpaper\s+of\b/,
      /\bpainting\s+of\b/, /\billustration\s+of\b/,
      /\bimage\s+banao\b/, /\btasveer\s+banao\b/, /\bpicture\s+banao\b/, /\bphoto\s+banao\b/,
      /\bimage\s+bana(o|iye|ye)?\b/, /\btasveer\s+bana(o|iye|ye)?\b/,
      /\bbanao\s+(an?\s+)?image\b/, /\bek\s+image\b/, /\baik\s+tasveer\b/
    ];
    return actionPhrases.some(function (re) { return re.test(t); });
  }

  function handleSend() {
    var text = promptInput.value.trim();
    if (!text || isBusy) return;

    if (currentMode === 'image') {
      handleImageSend(text);
      promptInput.value = '';
      autoGrow();
    } else if (looksLikeImageRequest(text)) {
      setMode('image');
      handleImageSend(text);
      promptInput.value = '';
      autoGrow();
    } else {
      handleChatSend(text);
    }
  }

  sendBtn.addEventListener('click', handleSend);
  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  function autoGrow() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  }
  promptInput.addEventListener('input', autoGrow);

  /* ---------------- PWA install prompt ---------------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      installBtn.classList.add('hidden');
    });
  });
  window.addEventListener('appinstalled', function () {
    installBtn.classList.add('hidden');
    showToast('IJAZ AI install ho gaya ✅');
  });

  /* ---------------- Service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('SW registration failed:', err);
      });
    });
  }

  /* ---------------- Init ---------------- */
  loadHistory();
  setMode('chat');
})();
