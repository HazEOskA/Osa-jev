import {randomBytes} from "node:crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  const nonce=randomBytes(16).toString("base64");
  const html=`<!doctype html><html lang="pl"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
  <title>OSA Jeff — aktywacja</title>
  <style nonce="${nonce}">
    *{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;background:#080a10;color:#eeeef8;font:16px system-ui,-apple-system,Segoe UI,sans-serif}
    main{min-height:100vh;display:flex;justify-content:center;align-items:center;padding:26px}
    article{width:100%;max-width:440px;text-align:center;border:1px solid #292b37;background:#11131b;border-radius:24px;padding:36px 28px;box-shadow:0 18px 60px #0008}
    .mark{font-size:34px;color:#a49aff;margin-bottom:14px}h1{font-size:26px;margin:0 0 12px;font-weight:650;letter-spacing:-.04em}
    p{color:#acb1c5;line-height:1.6;margin:0}.small{margin-top:22px;color:#777d92;font-size:13px}
  </style>
  </head><body><main><article><div class="mark">✧</div><h1>OSA Jeff</h1>
  <p id="status" role="status" aria-live="polite">Aktywuję dostęp do GLM. Chwilę…</p>
  <p class="small">Bez wpisywania tokenu. Historia pozostaje lokalna na tym urządzeniu.</p>
  </article></main>
  <script nonce="${nonce}">
  (() => {
    const hash=window.location.hash;
    // Clear the bearer proof before network requests, rendering analytics or creating links.
    window.history.replaceState(null,"","/activate");
    const status=document.getElementById("status");
    const match=/^#activate=([A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)$/.exec(hash);
    if(!match){status.textContent="Link jest nieprawidłowy. Poproś o nowy link.";return;}
    fetch("/api/jeff-activate",{
      method:"POST",cache:"no-store",credentials:"same-origin",referrerPolicy:"no-referrer",
      headers:{"Content-Type":"application/json"},body:JSON.stringify({proof:match[1]})
    }).then(response=>{
      if(!response.ok){status.textContent=response.status===401?"Link wygasł. Poproś o nowy link.":"Nie udało się aktywować dostępu.";return;}
      window.location.replace("/");
    }).catch(()=>{status.textContent="Błąd połączenia. Spróbuj ponownie później.";});
  })();
  </script></body></html>`;
  return new Response(html,{
    status:200,
    headers:{
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-store",
      "Referrer-Policy":"no-referrer",
      "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":`default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none';object-src 'none';script-src 'nonce-${nonce}';style-src 'nonce-${nonce}';connect-src 'self'`,
    },
  });
}
