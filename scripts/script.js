'use strict';
(() => {
  // GitHub Pages has no server-side secrets: this public webhook is used directly.
  const WEBHOOK_URL = 'https://discord.com/api/webhooks/992569996658094250/5-Puy5rOyImETNGV48HLiZ2oLOKrzAarFtMbSlc_s2zLcRclMlq-whqlfX44PqNR5saC';
  const DRAFT_KEY = 'randka.draft.v2';
  const RECEIPT_KEY = 'randka.receipt.v2';
  const page = document.body.dataset.page;
  const byId = id => document.getElementById(id);
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)) || {}; } catch { return {}; } };
  const save = (key, value) => { try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const draft = read(DRAFT_KEY);
  const localDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const validDate = data => /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') && /^\d{2}:\d{2}$/.test(data.time || '') && Number.isFinite(new Date(`${data.date}T${data.time}`).getTime());
  const futureDate = data => validDate(data) && new Date(`${data.date}T${data.time}`).getTime() > Date.now();
  const formatDate = data => validDate(data) ? new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${data.date}T${data.time}`)) : 'Wybierz termin';
  function summary(target, data, full = false) {
    target.replaceChildren();
    const rows = [['Kiedy', `${formatDate(data)}${validDate(data) ? `, ${data.time}${data.flexible ? ' (orientacyjnie)' : ''}` : ''}`], ['Nasz plan', data.activity || 'Wybierz coś dla nas'], ['Coś pysznego', data.food || 'Wybierzmy na miejscu'], ['Spotkanie', data.transport || 'Dogadamy się przed randką']];
    if (full && data.note) rows.push(['Coś od Ciebie', data.note]);
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); target.append(row);
    }
  }
  if (page === 'date') {
    const date = byId('date'); const time = byId('time');
    date.min = localDay(new Date());
    date.value = draft.date || ''; time.value = draft.time || '';
    byId('flexible').checked = !!draft.flexible;

    function update() {
      date.min = localDay(new Date());
      const now = new Date(); now.setMinutes(now.getMinutes() + 1);
      time.min = date.value === localDay(new Date()) ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '';
      const selected = new Date(`${date.value}T12:00`);
      const hasDate = Number.isFinite(selected.getTime());
      byId('preview-day').textContent = hasDate ? selected.getDate() : '♡';
      byId('preview-date').textContent = hasDate ? new Intl.DateTimeFormat('pl-PL', { weekday: 'long', month: 'long', year: 'numeric' }).format(selected) : 'Wybierz datę obok';
      byId('preview-time').textContent = time.value ? `O ${time.value}${byId('flexible').checked ? ', mniej więcej ♡' : ' — czas dla nas ♡'}` : 'Na dobre rzeczy warto czekać.';
      document.querySelectorAll('[data-time]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.time === time.value)));
      byId('date-error').textContent = '';
    }
    document.querySelectorAll('[data-day]').forEach(button => button.addEventListener('click', () => {
      const value = new Date();
      const offset = button.dataset.day === 'saturday' ? (6 - value.getDay() + 7) % 7 || 7 : Number(button.dataset.day);
      value.setDate(value.getDate() + offset); date.value = localDay(value); update();
    }));
    document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => { time.value = button.dataset.time; update(); }));
    byId('date-form').addEventListener('input', update);
    byId('date-form').addEventListener('submit', event => {
      event.preventDefault();
      const next = { ...draft, date: date.value, time: time.value, flexible: byId('flexible').checked, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      if (!futureDate(next)) { byId('date-error').textContent = 'Wybierz datę i godzinę, które jeszcze przed nami.'; return; }
      if (!save(DRAFT_KEY, next)) { byId('date-error').textContent = 'Przeglądarka blokuje zapisywanie wyborów. Zezwól na dane witryny i spróbuj ponownie.'; return; }
      location.href = 'wybor_jedzenia.html';
    });
    update();
  }
  if (page === 'plan') {
    if (!futureDate(draft)) { location.replace('kalendarz.html'); return; }
    const form = byId('plan-form'); const button = byId('send-button'); const status = byId('send-status');
    let sending = false; let sent = false; let retryAfter = 0;
    form.querySelectorAll('[name=activity]').forEach(input => { input.checked = input.value === draft.activity; });
    for (const id of ['food', 'transport', 'note']) if (typeof draft[id] === 'string') byId(id).value = draft[id];
    function current() {
      return { ...draft, activity: form.querySelector('[name=activity]:checked')?.value || '', food: byId('food').value, transport: byId('transport').value, note: byId('note').value.trim() };
    }
    function update() { const data = current(); save(DRAFT_KEY, data); summary(byId('plan-summary'), data); byId('note-count').textContent = byId('note').value.length; }
    form.addEventListener('input', update); form.addEventListener('change', update); update();
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || sent) return;
      if (Date.now() < retryAfter) { status.textContent = `Odczekaj jeszcze ${Math.ceil((retryAfter - Date.now()) / 1000)} s i spróbuj ponownie.`; return; }
      const data = current();
      if (!futureDate(data)) { status.textContent = 'Ten termin już minął. Wróć do wyboru daty i ustaw nowy.'; return; }
      if (!data.activity) { status.textContent = 'Wybierz pomysł na naszą randkę.'; return; }
      const signature = JSON.stringify(data);
      const receipt = read(RECEIPT_KEY);
      if (receipt.signature === signature && receipt.messageId) { location.href = 'koncowka.html'; return; }
      sending = true; button.disabled = true; button.textContent = 'Wysyłam nasz plan…'; status.textContent = '';
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        // wait=true requests a saved Discord message, rather than an unconfirmed 204.
        const response = await fetch(`${WEBHOOK_URL}?wait=true`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({
            content: `Panna zdecydowała:\nData: ${formatDate(data)}, ${data.time}${data.flexible ? ' (orientacyjnie)' : ''}\nStrefa czasowa: ${data.timezone}\nMiejsce spotkania: ${data.activity}\nJedzenie: ${data.food}\nSpotkanie: ${data.transport}${data.note ? `\nWiadomość: ${data.note}` : ''}`,
            allowed_mentions: { parse: [] }
          })
        });
        const result = await response.json().catch(() => null);
        if (response.status === 429) {
          const seconds = Math.max(1, Math.ceil(Number(result?.retry_after) || 30));
          retryAfter = Date.now() + seconds * 1000;
          throw new Error(`Za dużo prób naraz. Odczekaj ${seconds} s, potem ponów wysyłanie.`);
        }
        if ([401, 403, 404].includes(response.status)) throw new Error('Nie mogę dostarczyć planu. Link do odbierania wiadomości jest niedostępny. Daj mi znać, żebym go poprawił.');
        if (!response.ok) throw new Error(`Nie udało się wysłać planu (błąd ${response.status}). Twoje wybory zostały zachowane. Spróbuj ponownie za chwilę.`);
        if (!result?.id) throw new Error('Brakuje potwierdzenia odbioru. Sprawdź ze mną, czy plan dotarł, zanim wyślesz go ponownie.');
        sent = true;
        if (save(RECEIPT_KEY, { ...data, signature, messageId: result.id })) {
          location.href = 'koncowka.html';
        } else {
          status.textContent = 'Plan dotarł! Do zobaczenia, Kochanie ♡'; button.textContent = 'Wysłano ♡';
        }
      } catch (error) {
        status.textContent = error.name === 'AbortError' || error instanceof TypeError
          ? 'Nie udało się odczytać potwierdzenia. Sprawdź połączenie i zapytaj mnie, czy plan dotarł. Jeśli nie, spróbuj ponownie — wybory są zachowane.'
          : error.message;
      } finally {
        clearTimeout(timeout); sending = false;
        if (!sent) { button.disabled = false; button.textContent = 'Spróbuj wysłać ponownie ♡'; }
      }
    });
    window.addEventListener('pageshow', event => { if (event.persisted) { sending = false; sent = false; button.disabled = false; button.textContent = 'Wyślij mój plan ♡'; } });
  }
  if (page === 'success') {
    const receipt = read(RECEIPT_KEY);
    if (receipt.messageId && validDate(receipt)) {
      byId('success-label').textContent = 'Plan wysłany. Uśmiech też!';
      byId('success-title').textContent = 'Oto nasza randka, piękna!';
      byId('success-description').textContent = 'Twój plan już do mnie dotarł. Teraz mogę odliczać do spotkania.';
      summary(byId('success-summary'), receipt, true);
    }
  }
})();

