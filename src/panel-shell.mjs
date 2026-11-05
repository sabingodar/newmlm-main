const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Render the right workspace before session requests and deferred scripts finish.
// This shell contains no account data or permission-dependent navigation.
export function panelShell(markup,path,member=false){
 const slug=path.split('/')[2]||'dashboard',title=member?'Member workspace':({'dashboard':'Overview','users':'Members','settings':'Brand & CMS','manage-admins':'Manage Admins','reward-points':'Reward Settings'}[slug]||slug.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '));
 const shell=`<div class="panel-start"><aside class="panel-start-sidebar"><a href="/" aria-label="Dynamic Life Success home"><img src="/brand/logo.jpg" width="190" alt="Dynamic Life Success"></a><p>${member?'MEMBER WORKSPACE':'BUSINESS ADMINISTRATION'}</p><div class="panel-start-nav" aria-hidden="true"><span></span><span></span><span></span><span></span></div></aside><div class="panel-start-main"><header>${member?'Member':'Admin'} workspace</header><main><h1>${escape(title)}</h1><div class="panel-start-content" aria-hidden="true"></div><noscript>Enable JavaScript to open your workspace.</noscript></main></div></div>`;
 return markup.replace(/<div class="instant-page">[\s\S]*?<\/main><\/div>/,()=>shell);
}
