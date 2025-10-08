import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{type: 'error'|'info'; message: string} | null>(null);
  const router = useRouter();

  function showError(message: string){
    setToast({ type: 'error', message });
    setTimeout(()=>setToast(null), 5000);
  }

  async function doLogin(){
    if (!email || !password) return showError('Please enter email and password');
    setLoading(true);
    try{
      const res = await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
      const j = await res.json();
      if (j.error) return showError(j.error);
      if (!j.token) return showError('No token received');
      // store token & email in sessionStorage and navigate to app
      sessionStorage.setItem('pv_token', j.token);
      sessionStorage.setItem('pv_email', email);
      router.push('/app');
    }catch(err:any){
      showError(err?.message || String(err));
    }finally{ setLoading(false); }
  }

  async function doCreate(){
    if (!email || !password) return showError('Please enter email and password');
    setLoading(true);
    try{
      const res = await fetch('/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,meta:null})});
      const j = await res.json();
      if (j.error) return showError(j.error);
      setToast({ type: 'info', message: 'Account created — please login' });
      setTimeout(()=>setToast(null),4000);
    }catch(err:any){
      showError(err?.message || String(err));
    }finally{ setLoading(false); }
  }

  return (
    <div style={{maxWidth:480,margin:'40px auto'}}>
      <div className="card">
        <h2>PassVault</h2>
        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <div style={{height:8}} />
        <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <div style={{height:8}} />
        <div className="row">
          <button type="button" disabled={loading} className="btn-primary" onClick={doLogin}>{loading ? 'Please wait...' : 'Login'}</button>
          <button type="button" disabled={loading} onClick={doCreate}>Sign up</button>
        </div>
        {toast && (
          <div style={{marginTop:12,padding:8,borderRadius:6,background: toast.type==='error'? '#fee2e2': '#e6f4ff', color: toast.type==='error'? '#9b1c1c': '#084d6e'}}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
