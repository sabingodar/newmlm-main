window.mountCrmLeads = async ({main, api, esc, toast, statuses, canManage, exportCsv}) => {
  const dates = new Intl.DateTimeFormat('en-GB', {dateStyle:'medium', timeZone:'Asia/Kathmandu'});
  const formatDate = value => value ? dates.format(new Date(value)) : '—';
  const statusClass = status => status.toLowerCase();
  let status = '', page = 1, sequence = 0, searchTimer;

  main.innerHTML = `<div class="page-heading"><div><h1>CRM Leads</h1><p>Manage inquiries and follow up with customers after delivery.</p></div>
    <div class="actions"><button type="button" class="button" data-crm-export>Export CSV</button>${canManage ? '<button type="button" class="primary" data-crm-add>+ Add lead</button>' : ''}</div></div>
    <section class="panel crm-panel">
      <div class="crm-tabs" role="group" aria-label="Lead status">${['', ...statuses].map(value =>
        `<button type="button" data-crm-status="${esc(value)}" aria-pressed="${!value}">${esc(value || 'All leads')} <span>0</span></button>`).join('')}</div>
      <div class="crm-filters"><input type="search" placeholder="Search customer, phone or order…" aria-label="Search CRM leads" maxlength="200">
        <label><input type="checkbox" data-crm-due> Follow-ups due</label></div>
      <p class="crm-feedback" role="status"></p>
      <div data-crm-results></div>
    </section>`;
  const results = main.querySelector('[data-crm-results]');
  const feedback = main.querySelector('.crm-feedback');
  const search = main.querySelector('input[type=search]');
  const due = main.querySelector('[data-crm-due]');
  const tabs = [...main.querySelectorAll('[data-crm-status]')];
  const query = number => new URLSearchParams({status, q:search.value.trim(), page:number, ...(due.checked ? {due:'1'} : {})});

  async function load() {
    const request = ++sequence;
    feedback.textContent = 'Loading leads…';
    try {
      const data = await api('crm-leads?' + query(page));
      if (request !== sequence || !results.isConnected) return;
      const lastPage = Math.max(1, Math.ceil(data.total / data.limit));
      if (page > lastPage) { page = lastPage; return load(); }
      for (const tab of tabs) {
        const key = tab.dataset.crmStatus;
        tab.querySelector('span').textContent = key ? data.counts[key] || 0 : Object.values(data.counts).reduce((sum,n) => sum+n, 0);
        tab.setAttribute('aria-pressed', String(status === key));
      }
      results.innerHTML = data.items.length ? `<div class="table-scroll"><table class="crm-table">
        <thead><tr><th>Customer</th><th>Source</th><th>Status</th><th>Next follow-up</th><th></th></tr></thead>
        <tbody>${data.items.map(lead => `<tr>
          <td><strong>${esc(lead.name || 'Customer')}</strong><small>${esc([lead.email, lead.phone].filter(Boolean).join(' · '))}</small></td>
          <td>${lead.kind === 'orders' ? `Delivered order <small>${esc(lead.order_ref)}</small>` : 'Inquiry or manual lead'}</td>
          <td><span class="crm-status crm-${statusClass(lead.status)}">${esc(lead.status)}</span></td>
          <td>${formatDate(lead.followup_on)}${lead.followup_due ? '<small class="crm-due">Due</small>' : ''}</td>
          <td><button type="button" class="button" data-crm-open="${esc(lead.id)}">${canManage ? 'Update' : 'View'}</button></td>
        </tr>`).join('')}</tbody></table></div>
        <div class="pagination"><span>${data.total} leads · Page ${page} of ${lastPage}</span><div>
          <button type="button" data-crm-page="-1" ${page === 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" data-crm-page="1" ${page === lastPage ? 'disabled' : ''}>Next</button>
        </div></div>` : '<p class="empty">No leads match these filters.</p>';
      feedback.textContent = '';
      results.querySelectorAll('[data-crm-page]').forEach(button => button.onclick = () => { page += Number(button.dataset.crmPage); load(); });
      results.querySelectorAll('[data-crm-open]').forEach(button => button.onclick = () => openLead(button.dataset.crmOpen, button));
    } catch (error) {
      if (request === sequence) {
        results.innerHTML = '';
        feedback.textContent = error.message;
      }
    }
  }

  async function openLead(id, button) {
    button.disabled = true;
    try {
      const lead = id ? await api('crm-leads/' + id) : {kind:'leads', status:'New', history:[]};
      if (!main.contains(button)) return;
      const dialog = document.createElement('dialog');
      dialog.className = 'admin-operation-dialog crm-dialog';
      dialog.addEventListener('close', () => dialog.remove(), {once:true});
      dialog.innerHTML = `<form class="crm-lead-form">
        <div class="section-head"><div><h2>${esc(id ? lead.name || 'Customer' : 'Add lead')}</h2>
          ${lead.order_ref ? `<p>Delivered order ${esc(lead.order_ref)}</p>` : ''}</div>
          <button type="button" class="button" data-close-crm>Close</button></div>
        ${lead.kind === 'orders' || !canManage ? `<p>${esc([lead.email, lead.phone].filter(Boolean).join(' · '))}</p>` : `<div class="form-grid">
          <label>Name<input name="name" value="${esc(lead.name || '')}" required maxlength="200"></label>
          <label>Email<input name="email" type="email" value="${esc(lead.email || '')}" required maxlength="254"></label>
          <label>Phone<input name="phone" type="tel" value="${esc(lead.phone || '')}" maxlength="100"></label>
          <label class="wide-field">Inquiry notes<textarea name="notes" rows="3" maxlength="4000">${esc(lead.notes || '')}</textarea></label>
        </div>`}
        ${!canManage && lead.notes ? `<p class="crm-note">${esc(lead.notes)}</p>` : ''}
        <div class="form-grid">
          <label>Status<select name="status" ${canManage ? '' : 'disabled'}>${statuses.map(value => `<option ${lead.status === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>
          ${id ? `<label>Next follow-up<input type="date" name="followupOn" value="${esc(lead.followup_on || '')}" ${canManage ? '' : 'disabled'}></label>
            <label class="wide-field">Customer review<textarea name="customerReview" rows="4" maxlength="4000" ${canManage ? '' : 'readonly'}>${esc(lead.customer_review || '')}</textarea></label>
            ${canManage ? '<label class="wide-field">New follow-up note<textarea name="followupNote" rows="3" maxlength="2000"></textarea></label>' : ''}` : ''}
        </div>
        ${id ? `<section class="crm-history"><h3>Follow-up history</h3>
          ${lead.history.length ? `<ol>${lead.history.map(item => `<li><small>${esc(item.author)} · ${formatDate(item.created_at)}</small><p class="crm-note">${esc(item.note)}</p></li>`).join('')}</ol>` : '<p>No follow-up notes yet.</p>'}</section>` : ''}
        <p class="form-feedback" role="status"></p>
        ${canManage ? '<button type="submit" class="primary">Save lead</button>' : ''}
      </form>`;
      main.append(dialog);
      const form = dialog.querySelector('form');
      const close = form.querySelector('[data-close-crm]');
      close.onclick = () => dialog.close();
      if (canManage) form.onsubmit = async event => {
        event.preventDefault();
        const save = form.querySelector('[type=submit]');
        const input = Object.fromEntries(new FormData(form));
        save.disabled = close.disabled = true;
        dialog.oncancel = event => event.preventDefault();
        try {
          if (id) await api('crm-leads/' + id, 'PUT', {...input, version:lead.version, recordVersion:lead.record_version});
          else await api('records/leads', 'POST', input);
          dialog.close();
          toast(id ? 'CRM lead updated' : 'CRM lead added');
          await load();
        } catch (error) {
          form.querySelector('.form-feedback').textContent = error.message;
          save.disabled = close.disabled = false;
          dialog.oncancel = null;
        }
      };
      dialog.showModal();
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  }

  tabs.forEach(tab => tab.onclick = () => {
    status = tab.dataset.crmStatus;
    page = 1;
    load();
  });
  search.oninput = () => {
    page = 1;
    sequence++;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 200);
  };
  due.onchange = () => { page = 1; load(); };
  const add = main.querySelector('[data-crm-add]');
  if (add) add.onclick = () => openLead(null, add);
  main.querySelector('[data-crm-export]').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const filters = query(1);
    try {
      const first = await api('crm-leads?' + filters);
      const items = [...first.items];
      for (let number = 2; number <= Math.ceil(first.total / first.limit); number++) {
        filters.set('page', number);
        items.push(...(await api('crm-leads?' + filters)).items);
      }
      exportCsv(items, 'crm-leads');
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
    }
  };
  await load();
};
