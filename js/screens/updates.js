// Updates: every alert for today (new schemes, distributor stock changes), read or not, so the rep
// can look at them again after tapping them away on Landing. Same cards, grouped by kind.

import * as data from '../data.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, fresh, icon, appBar, emptyState } from '../ui.js';
import * as store from '../feature/store.js';
import { allAlerts, alertCard, openAlert } from '../feature/landing.js';

export function render(root) {
  const view = fresh(root);
  const list = allAlerts();
  const groups = [
    { key: 'stock', title: t('f.upd.stock'), items: list.filter((a) => a.kind === 'stock') },
    { key: 'scheme', title: t('f.upd.schemes'), items: list.filter((a) => a.kind === 'scheme') },
  ].filter((g) => g.items.length);
  const unread = list.filter((a) => !store.seen(a.id)).length;

  mount(view, html`
    ${appBar({ title: t('f.upd.title'), sub: fmt.date(data.demoDate()), back: '#/home' })}
    <div class="page page-upd">
      ${list.length ? html`
        <p class="upd-sum">${unread ? t('f.upd.unread', { n: unread }) : t('f.alert.none')}</p>
        ${groups.map((g) => html`<section class="upd-group">
          <h2 class="section-title">${g.title} · ${g.items.length}</h2>
          <div class="alerts upd-list">${g.items.map((a) => html`<div class="upd-item ${store.seen(a.id) ? 'is-read' : ''}">${alertCard(a, list.indexOf(a))}</div>`)}</div>
        </section>`)}`
      : emptyState({ icon: 'bell', title: t('f.alert.none'), body: '' })}
    </div>`);

  view.querySelectorAll('[data-alert]').forEach((btn) => btn.addEventListener('click', async () => {
    await openAlert(list[Number(btn.dataset.alert)]);
    btn.closest('.upd-item')?.classList.add('is-read');
  }));
}
