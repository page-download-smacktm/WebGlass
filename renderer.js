// Renderer-side UI glue
(async () => {
  const addressInput = document.getElementById('addressInput');
  const tabbar = document.getElementById('tabbar');
  const goBtn = document.getElementById('goBtn');
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const devtoolsBtn = document.getElementById('devtoolsBtn');
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  const status = document.getElementById('status');
  const consolePanel = document.getElementById('consolePanel');
  const consoleOutput = document.getElementById('consoleOutput');
  const sourceModal = document.getElementById('sourceModal');
  const sourceContent = document.getElementById('sourceContent');
  const closeSource = document.getElementById('closeSource');

  function setStatus(text){ status.textContent = text; }

  let appState = await window.api.getState().catch(()=>({}));
  if(appState && appState.state && appState.state.lastURL) addressInput.value = appState.state.lastURL;

  function renderTabs(tabs, activeId){
    if(!tabbar) return;
    tabbar.innerHTML = '';
    const newBtn = document.createElement('button');
    newBtn.textContent = '+'; newBtn.className='tab';
    newBtn.onclick = async () => { const t = await window.api.newTab('https://www.google.com/'); renderTabs(await fetchTabs(), t.id); };
    tabbar.appendChild(newBtn);
    for(const t of tabs){
      const b = document.createElement('button'); b.className='tab'+(t.id===activeId?' active':''); b.textContent = t.title || t.url || 'Nova aba';
      b.onclick = async () => { await window.api.switchTab(t.id); renderTabs(await fetchTabs(), t.id); };
      tabbar.appendChild(b);
    }
  }

  async function fetchTabs(){ const s = await window.api.getState(); return s.tabs || []; }
  const initialTabs = appState.tabs || (appState.state && appState.state.tabs) || [];
  renderTabs(initialTabs, initialTabs.length?initialTabs[0].id:null);

  goBtn.onclick = async () => {
    const input = addressInput.value.trim();
    setStatus('Navegando...');
    const res = await window.api.navigate(input);
    setStatus(res && res.url ? res.url : 'Pronto');
    renderTabs(await fetchTabs(), (await window.api.getState()).state && (await window.api.getState()).state.tabs && (await window.api.getState()).state.tabs[0] && (await window.api.getState()).state.tabs[0].id);
  };

  addressInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') goBtn.click();
  });

  backBtn.onclick = () => window.api.goBack();
  forwardBtn.onclick = () => window.api.goForward();
  reloadBtn.onclick = () => window.api.reload();
  devtoolsBtn.onclick = () => window.api.openDevtools();

  bookmarkBtn.onclick = async () => {
    const url = addressInput.value || (state && state.lastURL) || '';
    const title = url;
    const bookmarks = await window.api.toggleBookmark(url, title);
    setStatus(`Bookmarks: ${bookmarks.length}`);
  };

  // IPC events from main
  window.api.on('navigated', (url) => {
    if (url && typeof url === 'object' && url.url) addressInput.value = url.url;
    else if (typeof url === 'string') addressInput.value = url;
    setStatus((url && url.url) || url);
  });
  window.api.on('title-updated', (title) => {
    document.title = `WebGlass — ${title}`;
  });

  window.api.on('console-message', (msg) => {
    consolePanel.classList.remove('hidden');
    const line = `[${new Date().toLocaleTimeString()}] ${msg.msg}`;
    consoleOutput.textContent = line + '\n' + consoleOutput.textContent;
  });

  window.api.on('focus-address', () => { addressInput.focus(); addressInput.select(); });
  window.api.on('shortcut-view-source', async () => {
    const html = await window.api.viewSource();
    sourceContent.textContent = html;
    sourceModal.classList.remove('hidden');
  });

  if(closeSource) closeSource.onclick = () => sourceModal.classList.add('hidden');

  // Keyboard shortcuts in renderer (in case globalShortcut didn't catch)
  window.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); addressInput.focus(); addressInput.select(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); const html = await window.api.viewSource(); sourceContent.textContent = html; sourceModal.classList.remove('hidden'); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') { e.preventDefault(); window.api.openDevtools(); }
  });

  setStatus('Pronto');
})();
