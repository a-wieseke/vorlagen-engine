/* In-memory drafts only. No localStorage/sessionStorage/server persistence.
 * Capturing on input (rather than on navigation) avoids marking loaded records
 * dirty. Each editor is keyed by its immutable record ID. */
(() => {
  const drafts = new Map();
  const baselines = new Map();
  const editable = new Set(['tab-generator','tab-template-edit','tab-project-create','tab-project-edit','tab-excel-import','tab-document-create','tab-document-template-edit','tab-document-block-edit','tab-variable-edit','tab-role-edit','tab-bid-question-create','tab-bid-answer-create','tab-bid-question-batch','tab-bid-question-import','tab-bidder-create','tab-settings','tab-user-create','contactDialog']);
  const adapters=new Map();
  const versions=new Map(), views=new WeakMap();
  let sequence=0;
  let restoring = false;
  function root(node) { return node?.closest?.('.tab,dialog'); }
  function key(section) {
    const identities = {'tab-template-edit':'tplId', 'tab-project-edit':'projectEditId',
      'tab-document-template-edit':'documentTemplateId','tab-document-block-edit':'documentBlockId','tab-variable-edit':'varId','tab-role-edit':'roleId', 'tab-bid-answer-create':'bidAnswerId'};
    if(section.id==='tab-bid-question-create')return section.id+':'+(window.editingBidQuestionId||'new');
    if(section.id==='tab-bidder-create')return section.id+':'+(window.editingBidderId||'new');
    if(section.id==='contactDialog')return section.id+':'+(window.editingContactProject?.id||'new')+':'+window.editingContactIndex;
    const identity = identities[section.id];
    return section.id + ':' + (identity ? document.getElementById(identity)?.value || 'new' : 'current');
  }
  function fields(section) {
    return [...section.querySelectorAll('input,textarea,select,[contenteditable="true"]')]
      .filter(el => el.type !== 'password' && el.type !== 'file' && !el.readOnly && !/secret|password|recovery|token/i.test(el.id));
  }
  function snapshot(section) {
    const entries=fields(section).map((el,index) => ({id:el.id, index,
      fieldKey:el.dataset.key, value:el.value, checked:el.checked,
      html:el.isContentEditable ? el.innerHTML : undefined}));
    return {entries,context:adapters.get(section.id)?.get()};
  }
  function capture(section) {
    if (!section || restoring || !editable.has(section.id)) return;
    const id=key(section);
    drafts.set(id,snapshot(section));
    versions.set(id,++sequence);
    window.updateDraftIndicator?.();
  }
  function restore(section) {
    if (!section || !editable.has(section.id)) return;
    views.set(section,++sequence);
    const draft = drafts.get(key(section));
    if (!draft) {baselines.set(key(section),snapshot(section));return;}
    restoring = true;
    if(draft.context)adapters.get(section.id)?.set(draft.context);
    const elements = fields(section);
    for (const item of draft.entries) {
      const el = item.id ? section.querySelector(`[id="${CSS.escape(item.id)}"]`) : item.fieldKey ? elements.find(e => e.dataset.key === item.fieldKey) : elements[item.index];
      if (!el) continue;
      if (item.html !== undefined) el.innerHTML = item.html;
      else if (item.value !== undefined) el.value = item.value;
      if (typeof item.checked === 'boolean') el.checked = item.checked;
    }
    restoring = false;
    document.dispatchEvent(new CustomEvent('wve:draft-restored',{detail:section.id}));
  }
  document.addEventListener('input', event => capture(root(event.target)));
  document.addEventListener('change', event => capture(root(event.target)));
  window.addEventListener('beforeunload', event => {
    if (!drafts.size) return;
    event.preventDefault(); event.returnValue = '';
  });
  window.WveDrafts = {capture, restore,
    register(id,adapter){adapters.set(id,adapter)},
    // A save owns the submitted record and revision, not whichever record the
    // shared form happens to display once the request returns.
    beginSave(section) {
      const id=key(section);
      const version=++sequence;
      versions.set(id,version);
      return {section,id,version,view:views.get(section)};
    },
    isCurrentSave(ticket) {
      const {section,id,version,view}=ticket;
      return versions.get(id)===version&&key(section)===id&&views.get(section)===view&&
        (section.matches('dialog')?section.open:section.classList.contains('active'));
    },
    finishSave(ticket) {
      const current=this.isCurrentSave(ticket);
      if(versions.get(ticket.id)===ticket.version)drafts.delete(ticket.id);
      window.updateDraftIndicator?.();
      return current;
    },
    clean(section) {
      if(section){const id=key(section);drafts.delete(id);versions.delete(id);}
      window.updateDraftIndicator?.();
    },
    discard(section) {
      const id=key(section),baseline=baselines.get(id);
      if(baseline){drafts.set(id,baseline);restore(section);}
      drafts.delete(id);versions.delete(id);window.updateDraftIndicator?.();
    },
    dirty(section) { return !!section && drafts.has(key(section)); },
    clear() { drafts.clear();baselines.clear();versions.clear();window.updateDraftIndicator?.(); }};
})();
