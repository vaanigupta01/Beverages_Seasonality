// Login: any non-empty username and password works. The username becomes the rep's name.

import { session, router } from '../app.js';
import * as data from '../data.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, langSwitch } from '../ui.js';

export function render(root) {
  const view = fresh(root);
  const cfg = data.config();

  const shops = data.route().length;

  mount(view, html`
    <div class="login2">
      <header class="login2-hero">
        <div class="login2-bar">
          <p class="login2-brand"><span class="brand-mark" aria-hidden="true">GT</span><span>GT Field</span></p>
          ${langSwitch()}
        </div>
        <div class="login2-art" aria-hidden="true">
          <span class="bottle b1"></span><span class="bottle b2"></span><span class="bottle b3"></span>
        </div>
        <h1 class="login2-title">${t('f.login.title')}</h1>
        <p class="login2-sub">${icon('map')}<span>${label('region', cfg.region.name)} · ${fmt.date(cfg.demoDate, { weekday: true, year: false })} · ${t('f.login.shops', { n: shops })}</span></p>
      </header>

      <form class="login2-form" novalidate>
        <label class="field">
          <span class="field-label">${t('login.username')}</span>
          <span class="input-wrap">${icon('store')}<input class="input" name="username" placeholder="${t('login.usernamePh')}" autocomplete="username" autocapitalize="words" spellcheck="false" enterkeyhint="next" aria-describedby="err-username"></span>
          <span class="field-error" id="err-username" hidden>${icon('alert')}<span>${t('login.errUser')}</span></span>
        </label>
        <label class="field">
          <span class="field-label">${t('login.password')}</span>
          <span class="input-wrap">${icon('lock')}<input class="input" name="password" type="password" autocomplete="current-password" enterkeyhint="go" aria-describedby="err-password">
            <button type="button" class="pw-toggle" data-pw aria-label="${t('f.login.show')}">${t('f.login.show')}</button></span>
          <span class="field-error" id="err-password" hidden>${icon('alert')}<span>${t('login.errPass')}</span></span>
        </label>
        <button class="btn btn-primary btn-block login2-go" type="submit">${t('login.submit')}${icon('chevron')}</button>
        <p class="login2-note">${t('f.login.demo')}</p>
      </form>
    </div>`);

  view.querySelector('[data-pw]').addEventListener('click', (e) => {
    const pw = view.querySelector('input[name=password]');
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? t('f.login.hide') : t('f.login.show');
  });

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
