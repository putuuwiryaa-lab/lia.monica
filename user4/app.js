let marketData=[],allResults=[];
function setLoading(m,e=false){const x=document.getElementById('loading-markets');if(x){x.textContent=m;x.style.color=e?'#ef4444':'var(--muted)'}}
async function api(p){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(p,{headers:{Accept:'application/json'},cache:'no-store',signal:c.signal});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||`Request gagal (${r.status})`);return b}catch(e){if(e.name==='AbortError')throw new Error('Server tidak merespons.');throw e}finally{clearTimeout(t)}}
async function logout(){const b=document.getElementById('logout-button');if(b){b.disabled=true;b.textContent='LOG OUT...'}try{await fetch('/api/logout',{method:'POST',credentials:'include',cache:'no-store'})}finally{location.replace('/login.html')}}
function updateCount(){document.getElementById('market-count').textContent=`${marketData.filter(m=>m.selected).length} dipilih`}
function renderMarkets(){const l=document.getElementById('market-list'),q=(document.getElementById('market-search').value||'').trim().toUpperCase();l.innerHTML='';marketData.filter(m=>String(m.name||m.id).toUpperCase().includes(q)).forEach(m=>{const z=document.createElement('label');z.className='market-chip';const i=document.createElement('input');i.type='checkbox';i.checked=!!m.selected;i.addEventListener('change',()=>{m.selected=i.checked;z.classList.toggle('active',i.checked);updateCount()});const a=document.createElement('span');a.className='market-name';a.textContent=String(m.name||m.id).toUpperCase();const b=document.createElement('span');b.className='market-last';b.textContent=m.last_result==null?'':String(m.last_result).padStart(4,'0');z.append(i,a,b);if(m.selected)z.classList.add('active');l.append(z)})}
async function loadMarkets(){setLoading('Memuat data pasaran...');try{const d=await api('/api/markets');if(!Array.isArray(d)||!d.length)return setLoading('Data pasaran tidak tersedia.',true);marketData=d.map(m=>({...m,selected:false}));document.getElementById('loading-markets').style.display='none';document.getElementById('market-list').style.display='grid';renderMarkets();updateCount()}catch(e){setLoading(`Gagal memuat pasaran: ${e.message}`,true)}}
// Keep the same newest-first history order used by user3. Do not duplicate last_result.
function history(raw, last) {
  let values = [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) values = parsed.map(item => item?.result ?? item);
  } catch {
    values = String(raw || '').match(/\b\d{4}\b/g) || [];
  }
  const results = values.map(value => String(value).trim())
    .filter(value => /^\d{1,4}$/.test(value))
    .map(value => value.padStart(4, '0'));
  if (!results.length && last != null && /^\d{1,4}$/.test(String(last).trim())) {
    results.push(String(last).trim().padStart(4, '0'));
  }
  return results;
}

const mod10 = value => ((value % 10) + 10) % 10;

// APM-4D: one positional momentum projection from the latest three results.
function runAPM4D(hist) {
  if (hist.length < 3) return null;
  const [current, previous, older] = hist.slice(0, 3).map(result => result.split('').map(Number));
  const projections = current.map((digit, position) => {
    const latestDelta = digit - previous[position];
    const previousDelta = previous[position] - older[position];
    // Equivalent to 0.7 * latestDelta + 0.3 * previousDelta; integer weights
    // avoid floating-point drift at .5. Math.round resolves ties toward +Infinity.
    const momentum = Math.round((7 * latestDelta + 3 * previousDelta) / 10);
    return mod10(digit + momentum);
  });
  const scores = Array(10).fill(0);
  for (const digit of projections) {
    scores[digit] += 3;
    scores[mod10(digit - 1)] += 1;
    scores[mod10(digit + 1)] += 1;
  }
  // Rank all ten digits (including zero scores), with smaller digits winning ties.
  // Display the selected seven in ascending order, matching user3's output.
  const digits = Array.from({ length: 10 }, (_, digit) => digit)
    .sort((a, b) => scores[b] - scores[a] || a - b)
    .slice(0, 7)
    .sort((a, b) => a - b);
  return { digits, projections, scores };
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function copyText(t,m){if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(()=>toast(m)).catch(()=>fallback(t,m));else fallback(t,m)}function fallback(t,m){const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.left='-9999px';document.body.append(a);a.select();try{document.execCommand('copy');toast(m)}finally{a.remove()}}function toast(m){const t=document.getElementById('toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2000)}
async function prosesPasaran(){const boxes=marketData.filter(m=>m.selected),em=document.getElementById('error-msg'),out=document.getElementById('output-container'),btn=document.getElementById('process-button');if(!boxes.length){em.textContent='Silakan pilih minimal satu pasaran.';em.style.display='block';return}em.style.display='none';btn.disabled=true;btn.textContent='MENGHITUNG...';btn.style.opacity='.7';out.innerHTML='<div class="loading" style="padding:30px 10px;text-align:center"><span style="display:inline-block;width:18px;height:18px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span>Menghitung hasil...</div>';requestAnimationFrame(()=>out.scrollIntoView({behavior:'smooth',block:'start'}));try{const data=await Promise.all(boxes.map(m=>api(`/api/markets/${encodeURIComponent(m.id)}`)));allResults=[];const lines=[];for(let i=0;i<boxes.length;i++){const m=data[i],name=String(m.name||boxes[i].name||m.id).toUpperCase(),h=history(m.history_data,m.last_result);if(h.length<3){lines.push(`${esc(name)} ⟢ DATA BELUM CUKUP (MINIMAL 3 RESULT)`);continue}const r=runAPM4D(h),value=r.digits.join('');allResults.push(`${name} ⟢ ${value}`);lines.push(`${esc(name)} <span class="result-sep">⟢</span> <span class="result-digits">${value}</span>`)}const text=allResults.join('\n');out.innerHTML=`<div class="market-result-card compact-result"><pre>${lines.join('\n')}</pre></div><div class="button-group"><button class="btn-copy" id="copy-ai">Salin Hasil BBFS 7 Digit</button></div>`;document.getElementById('copy-ai')?.addEventListener('click',()=>copyText(text,'Hasil BBFS 7 Digit Disalin!'));requestAnimationFrame(()=>out.scrollIntoView({behavior:'smooth',block:'start'}))}catch(e){out.innerHTML=`<div style="text-align:center;color:#f87171;padding:15px;font-size:.78rem">Gagal mengambil data: ${esc(e.message)}</div>`;out.scrollIntoView({behavior:'smooth',block:'start'})}finally{btn.disabled=false;btn.textContent='PROSES HASIL';btn.style.opacity='1'}}
document.getElementById('process-button')?.addEventListener('click',prosesPasaran);document.getElementById('select-all')?.addEventListener('click',()=>{marketData.forEach(m=>m.selected=true);renderMarkets();updateCount()});document.getElementById('clear-all')?.addEventListener('click',()=>{marketData.forEach(m=>m.selected=false);renderMarkets();updateCount()});document.getElementById('market-search')?.addEventListener('input',renderMarkets);document.getElementById('logout-button')?.addEventListener('click',logout);const s=document.createElement('style');s.textContent='.compact-result{padding:12px 13px}.compact-result pre{font-size:.88rem;line-height:1.75;letter-spacing:.3px}.result-sep{color:#64748b;padding:0 3px}.result-digits{color:#4ade80;font-weight:800} @keyframes spin{to{transform:rotate(360deg)}}';document.head.appendChild(s);loadMarkets();