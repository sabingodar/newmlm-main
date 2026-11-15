window.mountManagementAdmin = async ({container, api, esc, toast}) => {
  const roles = [
    ['chairman', 'Chairman Voice'],
    ['managingDirector', 'Managing Director Voice'],
    ['director', 'Director Voice']
  ];
  container.innerHTML = `<div class="section-head"><h2>Management</h2></div>
    <form class="member-form">
      <div data-leadership></div>
      <h3>Team Members</h3>
      <div data-team></div>
      <div class="cms-blog-actions">
        <button type="button" class="button" data-add-member>+ Add Team Member</button>
        <button type="submit" class="primary">Save Management</button>
      </div>
      <p class="form-feedback" role="status">Loading management profiles…</p>
    </form>`;
  const form = container.querySelector('form');
  const team = form.querySelector('[data-team]');
  const feedback = form.querySelector('[role=status]');
  const add = form.querySelector('[data-add-member]');
  const save = form.querySelector('[type=submit]');
  add.disabled = save.disabled = true;

  function appendProfile(parent, key, title, profile = {}) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'cms-blog-editor';
    fieldset.dataset.profile = key;
    const isTeam = key === 'team';
    fieldset.innerHTML = `<legend>${title}</legend>
      <div class="form-grid">
        <label>Name<input name="name" maxlength="120" ${isTeam ? 'required' : ''} value="${esc(profile.name || '')}"></label>
        <label>Post<input name="post" required maxlength="120" value="${esc(profile.post || '')}"></label>
        <label>Email<input name="email" type="email" maxlength="254" value="${esc(profile.email || '')}"></label>
        <label>Phone number<input name="phone" type="tel" maxlength="40" value="${esc(profile.phone || '')}"></label>
        <label class="wide-field">${isTeam ? 'Profile description' : 'Voice message'}<textarea name="message" rows="5" maxlength="6000">${esc(profile.message || '')}</textarea></label>
        <label>Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        <input name="imageUrl" type="hidden" value="${esc(profile.imageUrl || '')}">
      </div>
      <div class="cms-blog-actions">
        <img class="cms-blog-thumb" alt="Profile photo" ${profile.imageUrl ? `src="${esc(profile.imageUrl)}"` : 'hidden'}>
        <button type="button" class="button" data-remove-photo>Remove photo</button>
        ${isTeam ? '<button type="button" class="text-button" data-remove-member>Remove member</button>' : ''}
      </div>`;
    const photo = fieldset.querySelector('[name=photo]');
    const imageUrl = fieldset.querySelector('[name=imageUrl]');
    const preview = fieldset.querySelector('img');
    fieldset.querySelector('[data-remove-photo]').onclick = () => {
      photo.value = '';
      imageUrl.value = '';
      preview.hidden = true;
      preview.removeAttribute('src');
    };
    if (isTeam) fieldset.querySelector('[data-remove-member]').onclick = () => {
      fieldset.remove();
      add.disabled = false;
    };
    parent.append(fieldset);
    return fieldset;
  }

  let management;
  try {
    ({management} = await api('settings'));
    if (!management) throw Error('Management settings are unavailable.');
  } catch (error) {
    feedback.textContent = error.message;
    return;
  }
  const leadership = form.querySelector('[data-leadership]');
  for (const [key, title] of roles) appendProfile(leadership, key, title, management[key]);
  for (const member of management.team) appendProfile(team, 'team', 'Team Member', member);
  add.disabled = team.childElementCount >= 50;
  save.disabled = false;
  feedback.textContent = '';
  add.onclick = () => {
    appendProfile(team, 'team', 'Team Member').querySelector('[name=name]').focus();
    add.disabled = team.childElementCount >= 50;
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const fields = [...form.querySelectorAll('[data-profile]')];
    const controls = [...form.elements].filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    feedback.textContent = 'Saving management profiles…';
    const input = {team: []};
    try {
      for (const field of fields) {
        const profile = Object.fromEntries(['name','post','email','phone','message','imageUrl'].map(name => [name, field.querySelector(`[name=${name}]`).value]));
        const photo = field.querySelector('[name=photo]');
        if (photo.files[0]) {
          profile.imageUrl = await window.uploadStorefrontImage(photo.files[0], api);
          field.querySelector('[name=imageUrl]').value = profile.imageUrl;
          const preview = field.querySelector('img');
          preview.src = profile.imageUrl;
          preview.hidden = false;
          photo.value = '';
        }
        const key = field.dataset.profile;
        if (key === 'team') input.team.push(profile);
        else input[key] = profile;
      }
      await api('settings', 'PUT', {management: input});
      feedback.textContent = 'Management profiles saved.';
      toast('Management profiles saved');
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      controls.forEach(control => { control.disabled = false; });
    }
  };
};
