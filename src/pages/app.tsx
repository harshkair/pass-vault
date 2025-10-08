import React, { useEffect, useState } from 'react';
import { deriveKey, decryptWithKey, encryptWithKey, b642buf, buf2b64 } from '../lib/cryptoClient';
import { useRouter } from 'next/router';

type VaultItem = { id: string; title: string; username: string; password: string; url?: string; notes?: string };

function uid(prefix = 'id') { return prefix + '_' + Math.random().toString(36).slice(2,9); }

export default function AppPage(){
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [tab, setTab] = useState<'gen'|'vault'>('gen');

  // master password not stored; ask user to enter to unlock vault
  const [masterPw, setMasterPw] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(false);

  // generator state
  const [len, setLen] = useState(16);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [excludeLook, setExcludeLook] = useState(true);
  const [generated, setGenerated] = useState('');

  useEffect(()=>{
    const t = sessionStorage.getItem('pv_token');
    const e = sessionStorage.getItem('pv_email');
    if (!t) { router.push('/login'); return; }
    setToken(t); setEmail(e||'');
  },[]);

  useEffect(()=>{ if (!token) return; fetch('/api/vault',{headers:{authorization:'Bearer '+token}}).then(r=>r.json()).then(j=>{ setMeta(j.meta); }); },[token]);

  async function unlock() {
    if (!meta) {
      // create new empty vault for this master password
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveKey(masterPw, salt);
      const enc = await encryptWithKey(key, JSON.stringify([]));
      const newMeta = { saltB64: buf2b64(salt.buffer), iterations: 200000, ivB64: enc.ivB64, vaultB64: enc.ctB64 };
      // persist
      if (!token) return; await fetch('/api/vault',{method:'POST',headers:{'content-type':'application/json', authorization: 'Bearer '+token},body:JSON.stringify({ meta: newMeta })});
      setMeta(newMeta);
      setItems([]);
      setUnlocked(true);
      return;
    }

    try{
      setLoading(true);
      const salt = new Uint8Array(b642buf(meta.saltB64));
      const key = await deriveKey(masterPw, salt, meta.iterations || 200000);
      // fetch list of encrypted password blobs
      const resp = await fetch('/api/vault',{headers:{authorization:'Bearer '+token}});
      const j = await resp.json();
      console.debug('vault GET response:', j);
      const pwList = j.passwords || [];
      if (!pwList.length) {
        // no blobs stored server-side
        alert('No password blobs stored on server for this account. You can save generated passwords to store them.');
        setItems([]);
        setUnlocked(true);
        return;
      }
      const out: VaultItem[] = [];
      let decryptedCount = 0;
      for (const p of pwList) {
        try{
          const plain = await decryptWithKey(key, p.ivB64, p.blobB64);
          const it = JSON.parse(plain) as VaultItem;
          out.push(it);
          decryptedCount++;
        }catch(e){
          console.warn('failed to decrypt item', p.id, e);
          // skip items that fail to decrypt with this master password
        }
      }
      setItems(out.reverse());
      setUnlocked(true);
      if (decryptedCount === 0) {
        alert('No items could be decrypted with the provided master password. Check that you used the same master password that was used to encrypt these items.');
      } else {
        console.info(`Unlocked ${decryptedCount} items`);
      }
    }catch(err){
      console.error('unlock error', err);
      alert('Unlock failed: wrong password or corrupted vault');
    }finally{ setLoading(false); }
  }

  async function refreshVault() {
    if (!token) return alert('not authenticated');
    if (!meta) return alert('no meta');
    if (!masterPw) return alert('enter master password to decrypt');
    setLoading(true);
    try{
      const salt = new Uint8Array(b642buf(meta.saltB64));
      const key = await deriveKey(masterPw, salt, meta.iterations || 200000);
      const resp = await fetch('/api/vault',{headers:{authorization:'Bearer '+token}});
      const j = await resp.json();
      const pwList = j.passwords || [];
      const out: VaultItem[] = [];
      for (const p of pwList) {
        try{ const plain = await decryptWithKey(key, p.ivB64, p.blobB64); out.push(JSON.parse(plain)); }catch(e){ }
      }
      setItems(out.reverse());
      alert('Refreshed vault');
    }catch(e){ alert('Refresh failed'); }
    finally{ setLoading(false); }
  }

  async function persist(nextItems: VaultItem[]) {
    if (!token) return alert('not authenticated');
    if (!meta) return alert('missing meta');
    // prevent concurrent saves
    if ((persist as any)._saving) return;
    (persist as any)._saving = true;
    try{
      const salt = new Uint8Array(b642buf(meta.saltB64));
      const key = await deriveKey(masterPw, salt, meta.iterations || 200000);
      const enc = await encryptWithKey(key, JSON.stringify(nextItems));
      const newMeta = { ...meta, vaultB64: enc.ctB64, ivB64: enc.ivB64 };
      const res = await fetch('/api/vault',{method:'POST',headers:{'content-type':'application/json', authorization: 'Bearer '+token},body:JSON.stringify({ meta: newMeta })});
      const j = await res.json();
      if (j?.meta) {
        setMeta(j.meta);
        // if server returned vaultB64 canonical, decrypt to show authoritative items
        if (j.meta.vaultB64) {
          const salt2 = new Uint8Array(b642buf(j.meta.saltB64));
          const key2 = await deriveKey(masterPw, salt2, j.meta.iterations || 200000);
          const plain = await decryptWithKey(key2, j.meta.ivB64, j.meta.vaultB64);
          setItems(JSON.parse(plain));
        }
      } else {
        setMeta(newMeta);
      }
    }finally{
      (persist as any)._saving = false;
    }
  }

  function genPassword(){
    const LOOK_ALIKES = 'Il1O0';
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const NUMS = '0123456789';
    const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:',.<>/?`~";
    let pool = '';
    if (lower) pool += LOWER;
    if (upper) pool += UPPER;
    if (numbers) pool += NUMS;
    if (symbols) pool += SYMBOLS;
    if (excludeLook) pool = pool.split('').filter(c=>!LOOK_ALIKES.includes(c)).join('');
    if (!pool) return setGenerated('');
    const rng = crypto.getRandomValues(new Uint32Array(len));
    const out: string[] = [];
    for (let i=0;i<len;i++) out.push(pool[rng[i] % pool.length]);
    setGenerated(out.join(''));
  }

  async function saveGenerated() {
    if (!generated) return alert('No password generated');
    const title = prompt('Title for this password') || 'New item';
    const item: VaultItem = { id: uid('it'), title, username: '', password: generated };
    // encrypt item blob (store JSON encrypted)
    const blobPlain = JSON.stringify(item);
    const salt = new Uint8Array(b642buf(meta.saltB64));
    const key = await deriveKey(masterPw, salt, meta.iterations || 200000);
    const enc = await encryptWithKey(key, blobPlain);
    // send encrypted blob to server for storage under passwords subdocument
    const res = await fetch('/api/vault/item',{method:'POST',headers:{'content-type':'application/json', authorization: 'Bearer '+token},body:JSON.stringify({ id: item.id, blobB64: enc.ctB64, ivB64: enc.ivB64, meta: meta })});
    const j = await res.json();
    if (j?.ok) {
      // update meta if server returned it
  if (j.meta) setMeta((prev: any)=>({ ...prev, ...j.meta }));
      // decrypt returned passwords list to update authoritative items
      if (j.passwords) {
        const salt = new Uint8Array(b642buf((j.meta && j.meta.saltB64) || meta.saltB64));
        const key = await deriveKey(masterPw, salt, (j.meta && j.meta.iterations) || meta.iterations || 200000);
        const out: VaultItem[] = [];
        for (const p of j.passwords) {
          try{ const plain = await decryptWithKey(key, p.ivB64, p.blobB64); out.push(JSON.parse(plain)); }catch(e){ }
        }
        setItems(out.reverse());
      } else {
        setItems(prev=>[item, ...prev]);
      }
      alert('Saved');
    } else {
      alert('Save failed');
    }
  }

  async function deleteItem(id: string){
    if (!confirm('Delete?')) return;
    if (!token) return alert('not authenticated');
    setLoading(true);
    try{
      const res = await fetch('/api/vault/item',{method:'DELETE',headers:{'content-type':'application/json', authorization: 'Bearer '+token},body:JSON.stringify({ id })});
      if (!res.ok) {
        const err = await res.json().catch(()=>({ error: 'delete failed' }));
        return alert('Delete failed: '+(err.error||JSON.stringify(err)));
      }
      const j = await res.json();
      if (j?.meta) setMeta((prev:any)=>({ ...prev, ...j.meta }));
      if (j?.passwords) {
        const salt = new Uint8Array(b642buf((j.meta && j.meta.saltB64) || meta.saltB64));
        const key = await deriveKey(masterPw, salt, (j.meta && j.meta.iterations) || meta.iterations || 200000);
        const out: VaultItem[] = [];
        for (const p of j.passwords) {
          try{ const plain = await decryptWithKey(key, p.ivB64, p.blobB64); out.push(JSON.parse(plain)); }catch(e){ }
        }
        setItems(out.reverse());
      } else {
        // fallback: remove locally
        setItems(prev=>prev.filter(i=>i.id!==id));
      }
    }catch(e){
      console.error('delete error', e);
      alert('Delete failed');
    }finally{ setLoading(false); }
  }

  if (!token) return null;

  return (
    <div className="app">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div><strong>PassVault</strong></div>
        <div>{email}</div>
      </div>
      <div style={{display:'flex',gap:12}}>
        <div style={{width:240}}>
          <div className="card">
            <button onClick={()=>setTab('gen')} className={tab==='gen'? 'btn-primary':''}>Generator</button>
            <div style={{height:8}} />
            <button onClick={()=>setTab('vault')} className={tab==='vault'? 'btn-primary':''}>Vault</button>
          </div>
        </div>
        <div style={{flex:1}}>
          {!unlocked ? (
            <div className="card">
              <h3>Unlock your vault</h3>
              <input placeholder="Master password" type="password" value={masterPw} onChange={e=>setMasterPw(e.target.value)} />
              <div style={{height:8}} />
              <div className="row">
                <button onClick={unlock} className="btn-primary">{loading? 'Unlocking...':'Unlock'}</button>
                <button onClick={()=>{ setMasterPw(''); }}>Clear</button>
              </div>
              <div style={{marginTop:8}} className="muted">Your master password is never sent to the server. It is used to derive a key that encrypts/decrypts your vault locally.</div>
            </div>
          ) : (
            tab === 'gen' ? (
              <div className="card">
                <h3>Password generator</h3>
                <label>Length: {len}</label>
                <input type="range" min={8} max={64} value={len} onChange={(e)=>setLen(Number(e.target.value))} />
                <div style={{height:8}} />
                <div className="row">
                  <label><input type="checkbox" checked={lower} onChange={e=>setLower(e.target.checked)} /> lower</label>
                  <label><input type="checkbox" checked={upper} onChange={e=>setUpper(e.target.checked)} /> upper</label>
                </div>
                <div style={{height:8}} />
                <div className="row">
                  <label><input type="checkbox" checked={numbers} onChange={e=>setNumbers(e.target.checked)} /> numbers</label>
                  <label><input type="checkbox" checked={symbols} onChange={e=>setSymbols(e.target.checked)} /> symbols</label>
                </div>
                <div style={{height:8}}>
                  <label><input type="checkbox" checked={excludeLook} onChange={e=>setExcludeLook(e.target.checked)} /> exclude look-alikes</label>
                </div>
                <div style={{height:8}} />
                <div className="row">
                  <button className="btn-primary" onClick={genPassword}>Generate</button>
                  <button onClick={()=>setGenerated('')}>Clear</button>
                  <div style={{flex:1}} />
                </div>
                <div style={{height:8}} />
                <input value={generated} readOnly />
                <div style={{height:8}} />
                <div className="row">
                  <button onClick={async()=>{ if (!generated) return; await navigator.clipboard.writeText(generated); setTimeout(()=>navigator.clipboard.writeText(''),15000); alert('Copied'); }}>Copy</button>
                  <button className="btn-primary" onClick={saveGenerated}>Save to vault</button>
                </div>
              </div>
            ) : (
              <div className="card">
                <h3>Your vault</h3>
                <div className="vault-list">
                  {items.map(it=> (
                    <div key={it.id} className="vault-item">
                      <div>
                        <div style={{fontWeight:600}}>{it.title}</div>
                        <div className="muted">{it.username} {it.url?`• ${it.url}`:''}</div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <button onClick={async()=>{ await navigator.clipboard.writeText(it.password); setTimeout(()=>navigator.clipboard.writeText(''),15000); alert('copied'); }}>Copy</button>
                        <button onClick={()=>deleteItem(it.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
