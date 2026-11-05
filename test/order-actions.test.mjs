import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('order actions open escaped courier details and allow only HTTPS tracking links',async()=>{
 const buttons={'[data-order-flow]':[],'[data-courier-details]':[{}]};let dialog;
 const document={body:{append(d){dialog=d;}},createElement(){return {querySelector(){return {};},addEventListener(){},showModal(){this.open=true;}};}};
 const window={};vm.runInNewContext(await readFile(new URL('../public/order-flow.js',import.meta.url),'utf8'),{window,document});
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const order={id:7,customer:'Member',courier:'<script>alert(1)</script>',trackingNumber:'TRK-7',trackingUrl:'https://courier.example/track/7',estimatedDelivery:'2026-11-08',amount:50,status:'Confirmed'};
 const markup=window.ordersListMarkup([order],{esc,money:String,page:1,total:1});assert.match(markup,/data-courier-details="7"/);assert.doesNotMatch(markup,/<th>Courier/);
 buttons['[data-courier-details]'][0].dataset={courierDetails:'7'};window.bindOrderActions({target:{querySelectorAll:s=>buttons[s]},records:[order],esc});buttons['[data-courier-details]'][0].onclick();assert.equal(dialog.open,true);assert.match(dialog.innerHTML,/TRK-7/);assert.match(dialog.innerHTML,/2026-11-08/);assert.match(dialog.innerHTML,/href="https:\/\/courier.example/);assert.doesNotMatch(dialog.innerHTML,/<script>/);
 window.openCourierDetails({...order,trackingUrl:'javascript:alert(1)'},esc);assert.doesNotMatch(dialog.innerHTML,/href="javascript:/);
});
