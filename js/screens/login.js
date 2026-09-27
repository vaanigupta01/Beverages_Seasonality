// Login: any non-empty username and password works. The username becomes the rep's name.

import { session, router } from '../app.js';
import * as data from '../data.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, langSwitch } from '../ui.js';

export function render(root) {
  const view = fresh(root);
  const cfg = data.config();

  mount(view, html`
    <div class="page login">
      ${langSwitch()}
      <div class="login-brand">
        <span class="brand-mark" aria-hidden="true">GT</span>
        <div>
          <p class="eyebrow">${t('login.eyebrow', { region: label('region', cfg.region.name) })}</p>
          <h1 class="display login-title">GT App <span class="proto-tag">${t('login.proto')}</span></h1>
        </div>
      </div>
      <p class="login-lede">${t('login.lede', { distributor: cfg.distributor?.name ?? '' })}</p>

      <form class="card login-form" novalidate>
        <label class="field">
          <span class="field-label">${t('login.username')}</span>
          <input class="input" name="username" placeholder="${t('login.usernamePh')}" autocomplete="username" autocapitalize="words" spellcheck="false" enterkeyhint="next" aria-describedby="err-username">
          <span class="field-error" id="err-username" hidden>${icon('alert')}<span>${t('login.errUser')}</span></span>
        </label>
        <label class="field">
          <span class="field-label">${t('login.password')}</span>
          <input class="input" name="password" type="password" autocomplete="current-password" enterkeyhint="go" aria-describedby="err-password">
          <span class="field-error" id="err-password" hidden>${icon('alert')}<span>${t('login.errPass')}</span></span>
        </label>
        <button class="btn btn-primary btn-block" type="submit">${t('login.submit')}</button>
        <p class="hint">${icon('info')}<span>${t('login.hint')}</span></p>
      </form>

      <p class="login-foot">
        <span>${t('login.demoDate')}</span> <strong>${fmt.date(cfg.demoDate, { long: true })}</strong><br>
        <span>${label('repRole', cfg.rep?.role)} · ${cfg.distributor?.name ?? ''}</span>
      </p>
    </div>`);

  const form = view.querySelector('form');
  const fields = ['username', 'password'].map((name) => ({
    input: form.elements[name],
    error: view.querySelector(`#err-${name}`),
  }));

  const check = ({ input, error }) => {
    const ok = input.value.trim() !== '';
    error.hidden = ok;
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  };

  fields.forEach((f) => f.input.addEventListener('input', () => { if (!f.error.hidden) check(f); }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const results = fields.map(check);
    const firstBad = fields[results.indexOf(false)];
    if (firstBad) return firstBad.input.focus();
    session.signIn(fields[0].input.value.trim());
    router.go('#/home');
  });
}
