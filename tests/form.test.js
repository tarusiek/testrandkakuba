(async () => {
  const [planHtml, dateHtml, successHtml, productionCode] = await Promise.all(['../sites/wybor_jedzenia.html', '../sites/kalendarz.html', '../sites/koncowka.html', '../scripts/script.js'].map(url => fetch(url).then(r => r.text())));
  const draft = {date:'2099-10-08',time:'19:00',timezone:'Europe/Warsaw',activity:'Spacerek',food:'Sushi',transport:'Spotkajmy się na miejscu',note:'Test: ąęść ♡',flexible:true};
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const assert = (condition, text) => { if (!condition) throw new Error(text); };
  let passes = 0; let failures = 0;
  async function fixture({html = planHtml, data = draft, receipt, response = {status:200, body:{id:'test-message'}}, reject, pending = false, storageBlocked = false} = {}) {
    const frame = document.createElement('iframe');
    frame.srcdoc = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'').replace(/<img\b[^>]*>/gi,'');
    await new Promise(resolve => { frame.onload = resolve; document.body.append(frame); });
    const win = frame.contentWindow; const doc = win.document;
    const store = new Map(); if (data) store.set('randka.draft.v2', JSON.stringify(data)); if (receipt) store.set('randka.receipt.v2', JSON.stringify(receipt));
    Object.defineProperty(win, 'sessionStorage', {value: {getItem:key => store.get(key) || null, setItem:(key,value) => {if(storageBlocked) throw new Error('blocked'); store.set(key,value);}}});
    win.testLocation = {href:'',replace(url){this.href=url;}};
    const calls = []; let resolvePending;
    win.fetch = async (url, options) => {
      calls.push({url,options});
      if (pending) await new Promise(resolve => {resolvePending=resolve;});
      if (reject) throw reject === 'network' ? new win.TypeError('Network failure') : new win.DOMException('Timeout','AbortError');
      return {status:response.status,ok:response.status>=200&&response.status<300,json:async()=>response.body};
    };
    const script = doc.createElement('script');
    script.textContent = productionCode.replace(/\blocation\b/g,'testLocation').replace(/const WEBHOOK_URL = '[^']+';/, "const WEBHOOK_URL = 'https://example.invalid/webhook';");
    doc.body.append(script);
    return {win,doc,store,calls,close:()=>frame.remove(),release:()=>resolvePending?.(),submit:async()=>{doc.getElementById('plan-form').requestSubmit();await tick();await tick();}};
  }
  async function test(name, run) { const li = document.createElement('li'); document.getElementById('results').append(li); try {await run();passes++;li.className='pass';li.textContent=`OK — ${name}`;} catch(error){failures++;li.className='fail';li.textContent=`BŁĄD — ${name}: ${error.message}`;} }
  await test('Potwierdzona wysyłka, wszystkie pola i blokada wzmianek',async()=>{const f=await fixture();try{await f.submit();assert(f.calls.length===1,'liczba żądań');const payload=JSON.parse(f.calls[0].options.body);assert(f.calls[0].url.endsWith('?wait=true'),'potwierdzenie');for(const value of ['19:00','Spacerek','Sushi',draft.note,'Europe/Warsaw','orientacyjnie'])assert(payload.content.includes(value),`brak ${value}`);assert(payload.allowed_mentions.parse.length===0,'wzmianki');assert(f.win.testLocation.href==='koncowka.html','przejście');assert(JSON.parse(f.store.get('randka.receipt.v2')).messageId==='test-message','zapis potwierdzenia');}finally{f.close();}});
  for (const [name, options, expected] of [
    ['Błąd sieci',{reject:'network'},'Sprawdź połączenie'],
    ['Przekroczenie czasu',{reject:'timeout'},'Sprawdź połączenie'],
    ['Usunięty webhook',{response:{status:404,body:{}}},'niedostępny'],
    ['Błąd serwera',{response:{status:500,body:{}}},'500'],
    ['Odpowiedź bez potwierdzenia',{response:{status:200,body:{}}},'Brakuje potwierdzenia']
  ]) await test(`${name}: wybory zachowane i ponowna próba dostępna`,async()=>{const f=await fixture(options);try{await f.submit();assert(!f.doc.getElementById('send-button').disabled,'przycisk zablokowany');assert(f.doc.getElementById('send-status').textContent.includes(expected),'komunikat');assert(!f.win.testLocation.href,'fałszywy sukces');assert(JSON.parse(f.store.get('randka.draft.v2')).note===draft.note,'utracony szkic');}finally{f.close();}});
  await test('Limit Discorda wstrzymuje kolejną próbę',async()=>{const f=await fixture({response:{status:429,body:{retry_after:20}}});try{await f.submit();await f.submit();assert(f.calls.length===1,'powtórne żądanie przed czasem');assert(f.doc.getElementById('send-status').textContent.includes('Odczekaj'),'brak czasu');}finally{f.close();}});
  await test('Podwójne kliknięcie wysyła tylko jedno żądanie',async()=>{const f=await fixture({pending:true});try{await f.submit();await f.submit();assert(f.calls.length===1,'duplikat');f.release();await tick();await tick();}finally{f.close();}});
  await test('Potwierdzony wcześniej plan nie wysyła się ponownie',async()=>{const f=await fixture({receipt:{...draft,messageId:'already-sent',signature:JSON.stringify(draft)}});try{await f.submit();assert(f.calls.length===0,'duplikat wiadomości');assert(f.win.testLocation.href==='koncowka.html','brak potwierdzenia');}finally{f.close();}});
  await test('Brak terminu przenosi do kalendarza',async()=>{const f=await fixture({data:null});try{assert(f.win.testLocation.href==='kalendarz.html','brak przekierowania');assert(f.calls.length===0,'niepotrzebna wysyłka');}finally{f.close();}});
  await test('Data w przeszłości nie pozwala przejść dalej',async()=>{const f=await fixture({html:dateHtml,data:{...draft,date:'2000-01-01'}});try{f.doc.getElementById('date-form').dispatchEvent(new f.win.Event('submit',{cancelable:true}));assert(!f.win.testLocation.href,'zaakceptowano przeszłość');assert(f.doc.getElementById('date-error').textContent.length>0,'brak komunikatu');}finally{f.close();}});
  await test('Blokada pamięci przeglądarki ma czytelny komunikat',async()=>{const f=await fixture({html:dateHtml,storageBlocked:true});try{f.doc.getElementById('date-form').requestSubmit();assert(!f.win.testLocation.href,'utracono wybory');assert(f.doc.getElementById('date-error').textContent.includes('blokuje'),'brak komunikatu');}finally{f.close();}});
  await test('Wejście bezpośrednio na koniec nie udaje wysyłki',async()=>{const f=await fixture({html:successHtml});try{assert(!f.doc.getElementById('success-label').textContent.includes('wysłany'),'fałszywy sukces');}finally{f.close();}});
  document.getElementById('result').textContent=`Wynik: ${passes} OK, ${failures} błędów.`;
})().catch(error => {document.getElementById('result').textContent = `Błąd testów: ${error.message}`;});
