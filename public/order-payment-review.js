window.mountOrderPaymentReview = async ({main, wallet, walletActions, api, esc, money, toast}) => {
  const dates = new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Kathmandu'});
  const when = value => value ? dates.format(new Date(value)) : '—';
  const statusText = value => value === 'Failed' ? 'Rejected / Failed' : value;
  const badge = value => `<span class="badge ${value==='Paid'?'good':value==='Failed'?'bad':'pending'}">${esc(statusText(value))}</span>`;
  const ref = payment => payment.reference || '#'+payment.id;
  let page = 1, request = 0, timer;
  const section = document.createElement('section');
  section.className = 'panel order-payment-review';
  section.innerHTML = `<div class="section-head"><h2>Order payments</h2></div>
    <div class="crm-filters"><input type="search" aria-label="Search order payments" placeholder="Search order, customer or reference…" maxlength="200">
      <label>Status <select aria-label="Payment status"><option value="">All statuses</option>${['Pending','Paid','Failed','Refunded'].map(s=>`<option value="${s}">${statusText(s)}</option>`).join('')}</select></label>
    </div><p class="form-feedback" role="status"></p><div data-payment-results></div>`;
  const search = section.querySelector('input');
  const filter = section.querySelector('select');
  const feedback = section.querySelector('[role=status]');
  const results = section.querySelector('[data-payment-results]');

  if (wallet) {
    const tabs = document.createElement('div');
    tabs.className = 'cms-tabs';
    tabs.setAttribute('role','group');
    tabs.setAttribute('aria-label','Deposits sections');
    tabs.innerHTML = '<button type="button" aria-pressed="true">Order payments</button><button type="button" aria-pressed="false">Wallet deposits</button>';
    wallet.before(tabs, section);
    function selectPayments(show) {
      tabs.children[0].setAttribute('aria-pressed', String(show));
      tabs.children[1].setAttribute('aria-pressed', String(!show));
      section.hidden = !show;
      wallet.hidden = walletActions.hidden = show;
    }
    tabs.children[0].onclick = () => { selectPayments(true); load(); };
    tabs.children[1].onclick = () => selectPayments(false);
    selectPayments(true);
  } else {
    main.append(section);
  }

  async function load() {
    const current = ++request;
    feedback.textContent = 'Loading payments…';
    try {
      const data = await api('order-payments?' + new URLSearchParams({q:search.value.trim(),status:filter.value,page}));
      if (request !== current || !section.isConnected) return;
      const last = Math.max(1,Math.ceil(data.total/data.limit));
      if (page > last) { page = last; return load(); }
      results.innerHTML = data.items.length ? `<div class="table-scroll"><table class="crm-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Method / Reference</th><th>Amount</th><th>Payment status</th><th></th></tr></thead>
        <tbody>${data.items.map(payment => `<tr>
          <td><strong>${esc(ref(payment))}</strong><small>${esc(when(payment.created_at))}</small></td>
          <td>${esc(payment.customer || payment.recipient || '—')}</td>
          <td>${esc(payment.method || '—')}<small>${esc(payment.paymentReference || '')}</small></td>
          <td>${money(payment.amount)}</td><td>${badge(payment.status)}${payment.hasPaymentSlip?`<small><a href="/api/order-payments/${esc(payment.id)}/slip" target="_blank" rel="noopener">View slip ↗</a></small>`:''}</td>
          <td><button type="button" class="button" data-payment-open="${esc(payment.id)}">Details</button></td>
        </tr>`).join('')}</tbody></table></div>
        <div class="pagination"><span>${data.total} payments · Page ${page} of ${last}</span><div>
        <button type="button" data-payment-page="-1" ${page===1?'disabled':''}>Previous</button>
        <button type="button" data-payment-page="1" ${page===last?'disabled':''}>Next</button></div></div>`
        : '<p class="empty">No order payments match these filters.</p>';
      feedback.textContent = '';
      results.querySelectorAll('[data-payment-open]').forEach(button => button.onclick = () => window.openOrderPaymentDetails({id:button.dataset.paymentOpen,button,container:section,api,esc,money,toast,onSaved:load}));
      results.querySelectorAll('[data-payment-page]').forEach(button => button.onclick = () => { page+=Number(button.dataset.paymentPage); load(); });
    } catch (error) {
      if (request===current) {
        results.innerHTML='';
        feedback.textContent=error.message;
      }
    }
  }

  search.oninput=()=>{page=1;request++;clearTimeout(timer);timer=setTimeout(load,200);};
  filter.onchange=()=>{page=1;load();};
  await load();
};

window.openOrderPaymentDetails = async ({id,button,container,api,esc,money,toast,onSaved,mode}) => {
    button.disabled=true;
    const path='order-payments/'+id;
    const canManage=window.adminCan('orders.manage');
    const dates=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kathmandu'});
    const when=value=>value?dates.format(new Date(value)):'—';
    const ref=payment=>payment.reference||'#'+payment.id;
    const badge=value=>`<span class="badge ${value==='Paid'?'good':value==='Failed'?'bad':'pending'}">${esc(value==='Failed'?'Rejected / Failed':value)}</span>`;
    try {
      const payment=await api(path);
      if(!container.contains(button))return;
      const gateway=['esewa','khalti'].includes(payment.paymentType)||!!payment.gatewayVerifiedAt;
      const editable=canManage&&!payment.historical;
      const referenceEditable=editable&&!gateway&&payment.status!=='Refunded';
      const approvable=editable&&!gateway&&!['Cancelled','Refunded','Unknown'].includes(payment.orderStatus)
        &&(payment.status==='Pending'||(payment.status==='Failed'&&payment.rejection));
      const dialog=document.createElement('dialog');
      dialog.className='admin-operation-dialog crm-dialog';
      dialog.innerHTML=`<form class="crm-lead-form">
        <div class="section-head"><h2>Order payment ${esc(ref(payment))}</h2><button type="button" class="button" data-close-payment>Close</button></div>
        <dl class="order-courier-details">
          <div><dt>Customer</dt><dd>${esc(payment.customer || payment.recipient || '—')}</dd></div>
          <div><dt>Phone</dt><dd>${esc(payment.phone || '—')}</dd></div>
          <div><dt>Order status</dt><dd>${esc(payment.orderStatus)}</dd></div>
          <div><dt>Amount</dt><dd>${money(payment.amount)}</dd></div>
          <div><dt>Payment method</dt><dd>${esc(payment.method || '—')}</dd></div>
          <div><dt>Payment status</dt><dd>${badge(payment.status)}</dd></div>
          ${payment.approval?`<div><dt>Last approved</dt><dd>${esc(payment.approval.by)} · ${esc(when(payment.approval.at))}</dd></div>`:''}
          ${payment.rejection?`<div><dt>Last rejection</dt><dd>${esc(payment.rejection.by)} · ${esc(when(payment.rejection.at))}<p class="crm-note">${esc(payment.rejection.reason)}</p></dd></div>`:''}
        </dl>
        ${payment.hasPaymentSlip?`<p><a class="button" href="/api/order-payments/${esc(id)}/slip" target="_blank" rel="noopener">View payment slip ↗</a></p>`:'<p>No payment slip attached.</p>'}
        <div class="form-grid">
          <label>Payment reference<input name="paymentReference" maxlength="200" value="${esc(payment.paymentReference || '')}" ${referenceEditable?'':'readonly'}></label>
          <label class="wide-field">Internal payment note<textarea name="note" maxlength="2000" rows="3" ${editable?'':'readonly'}>${esc(payment.note || '')}</textarea></label>
        </div>
        ${editable&&payment.canReject?`<details ${mode==='reject'?'open':''}><summary>Reject payment</summary><label>Reason<textarea name="reason" rows="3" maxlength="2000"></textarea></label>
          <p>Changes the payment to Failed. The order and any funds are unaffected.</p><button type="button" class="button" data-reject-payment>Reject payment</button></details>`:''}
        <p class="form-feedback" role="status"></p>
        <div class="actions">${editable?'<button type="submit" class="button">Save payment details</button>':''}
          ${approvable?'<button type="button" class="primary" data-approve-payment>Approve payment</button>':''}</div>
      </form>`;
      document.body.append(dialog);
      dialog.addEventListener('close',()=>dialog.remove(),{once:true});
      const form=dialog.querySelector('form'), message=form.querySelector('[role=status]');
      form.querySelector('[data-close-payment]').onclick=()=>dialog.close();
      async function submit(url,method,input,success) {
        const controls=[...form.querySelectorAll('button')];
        controls.forEach(control=>control.disabled=true);
        dialog.oncancel=event=>event.preventDefault();
        try {
          await api(url,method,{...input,version:payment.version});
          dialog.close();
          toast(success);
          await onSaved();
        } catch(error) {
          message.textContent=error.message;
          controls.forEach(control=>control.disabled=false);
          dialog.oncancel=null;
        }
      }
      form.onsubmit=event=>{
        event.preventDefault();
        if(editable)submit(path,'PUT',{note:form.elements.note.value,paymentReference:form.elements.paymentReference.value},'Payment details saved');
      };
      const reject=form.querySelector('[data-reject-payment]');
      if(reject)reject.onclick=()=>{
        const reason=form.elements.reason.value.trim();
        if(!reason){message.textContent='Enter a rejection reason.';form.elements.reason.focus();return;}
        submit(path+'/reject','POST',{reason},'Payment rejected');
      };
      const approve=form.querySelector('[data-approve-payment]');
      if(approve)approve.onclick=()=>{
        if(confirm('Confirm you received '+money(payment.amount)+' for '+ref(payment)+'?')){
          submit('orders/'+payment.id+'/approve-payment','POST',{},'Payment approved');
        }
      };
      dialog.showModal();
      if(mode==='reject')form.elements.reason?.focus();
      if(mode==='edit')form.elements.paymentReference.focus();
    } catch(error) {
      toast(error.message);
    } finally {
      button.disabled=false;
    }
  };
