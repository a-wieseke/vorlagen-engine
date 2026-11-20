/* Shared accessible dialogs and asynchronous confirmations. Native modal
 * dialogs provide focus containment; we add explicit naming and restoration. */
(() => {
  // Search inputs consume Escape to clear their value in some browsers.
  // A modal consistently closes instead, except the enforced password gate.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);
    if(!dialog)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(dialog.id!=='forcedPasswordDialog')dialog.close('cancel');
  },true);
  const show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function() {
    const heading=this.querySelector('h1,h2,h3');
    if(heading&&!this.hasAttribute('aria-labelledby')) {
      heading.id ||= `${this.id}-heading`;this.setAttribute('aria-labelledby',heading.id);
    }
    this._opener=document.activeElement;
    show.call(this);
    this.addEventListener('close',()=>{
      if(this._opener?.isConnected){this._opener.focus();
        // Picker selections change fields programmatically, not via input.
        if(/Picker/.test(this.id))window.WveDrafts?.capture(this._opener.closest('.tab'));
      }
    },{once:true});
  };
  window.confirmAction=(message,title='Änderungen verwerfen?')=>new Promise(resolve=>{
    const dialog=document.createElement('dialog'),heading=document.createElement('h2'),text=document.createElement('p'),actions=document.createElement('div');
    heading.textContent=title;text.textContent=message;actions.className='actions';
    const cancel=document.createElement('button'),yes=document.createElement('button');
    cancel.textContent='Abbrechen';yes.textContent='Bestätigen';yes.className='primary';
    cancel.onclick=()=>dialog.close('cancel');yes.onclick=()=>dialog.close('yes');
    actions.append(cancel,yes);dialog.append(heading,text,actions);dialog.id='actionConfirmation';document.body.append(dialog);
    dialog.addEventListener('close',()=>{resolve(dialog.returnValue==='yes');dialog.remove()},{once:true});dialog.showModal();cancel.focus();
  });
})();
