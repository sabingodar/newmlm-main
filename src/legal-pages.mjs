import {createHash} from 'node:crypto';
import {fail} from './validation.mjs';
export const legalDefaults=[
 {slug:'terms-and-conditions',title:'Terms and Conditions',summary:'The essentials for shopping, membership and using Dynamic Life Success.',enabled:true,updatedAt:'2026-11-05',body:`## About these terms
These terms apply to the Dynamic Life Success website, shopping services and member workspace. Review them before placing an order or participating in member programmes. Mandatory rights under Nepal law continue to apply; these terms do not remove consumer rights or legal remedies.

## Accounts and accurate information
Provide accurate contact, delivery and registration details. Keep your password private and change a temporary password promptly. You must be an adult legally able to enter the relevant transaction, or use the service with an authorised adult. Tell us if you suspect unauthorised account access. Accounts may be restricted for fraud, misuse or security concerns; contact us if you believe a restriction is incorrect.

## Products, prices and orders
Check the product description, quantity, unit, current sales price, tax information, stock and warranty details before ordering. A crossed-out price is a reference price; the checkout total is the amount submitted for the order. Any applicable delivery or additional charges should be disclosed before payment. Photos are illustrative unless the listing states otherwise. An order receipt records your request; stock, payment and delivery details may still require confirmation. We will contact you about material errors or unavailable goods rather than substitute a different item without agreement.

## Payment and delivery
Only payment methods enabled at checkout are available. Bank transfers require verification. eSewa and Khalti payments are confirmed using the provider's transaction status; a redirect alone is not confirmation. Cash on Delivery is payable on delivery or collection as agreed. Do not pay twice when a payment is unclear; contact us with your order and transaction reference. Online/Home Delivery orders are assigned by administration. For Dispatch Center fulfillment, choose the relevant center and delivery or pickup option. Delivery estimates are estimates, not guaranteed arrival dates. Orders may be dispatched in parts; tracking and order history show available updates.

## Cancellations, returns, refunds and warranties
Contact us promptly with your order reference if an item is wrong, damaged, defective, undelivered or you need to request cancellation or return. Keep relevant packaging and evidence where reasonably possible. We will assess the request under applicable law and the product's disclosed conditions, explain the available remedy and any lawful costs, and arrange the next steps. This policy does not exclude statutory cancellation, return, replacement, refund or warranty rights. A change in the website's payment status does not itself transfer a refund; the actual refund arrangement must be confirmed. Product warranty coverage and duration are those shown for the item, subject to applicable law. Ask us before purchase if terms or handling requirements are unclear.

## Rewards, referrals and commissions
Eligible products may offer Purchase Rewards, Sales Rewards and rank-based direct sales commissions. Amounts and eligibility depend on the product and member settings in force for the order. Direct commissions are fixed amounts per unit according to the recipient's Affiliate Rank; they are not guaranteed earnings. A qualifying shared product link takes precedence for that product; otherwise an eligible registered Sponsor may receive the direct commission. Sharing permission controls sharing access and does not itself disable ordinary Sponsor commission. Self purchases do not generate self sales rewards or self direct commission.
Direct commission is recorded only after verified payment and full dispatch. Purchase and Sales Reward points are recorded after verified payment and delivery. Reward redemption is limited to the Discount Panel under the configured point value, category limits and available balance. Points are not a promise of cash value or unrestricted withdrawal. Refunds, cancellations or abusive activity may lead to reward adjustments and commission review. We will explain material account adjustments. No income, rank, profit or franchise approval is guaranteed by registration, referral or purchase. Do not make misleading earnings or product claims when sharing links.

## Responsible use and third-party services
Do not submit false orders, impersonate someone, attempt unauthorised access or interfere with the service. Use shared links responsibly. Payment providers, embedded videos, maps and social platforms operate under their own terms. A franchise inquiry is an application to discuss an opportunity, not a franchise contract or a payment obligation. Any franchise agreement requires its own confirmed terms.

## Changes, concerns and contact
Updated terms will be published with their revision date. Material changes do not remove rights already attached to an existing purchase. Contact us first about order or account concerns; you may also use the complaint channels and remedies available under Nepal law. Our Privacy Policy explains how we handle personal information.
Dynamic Life Success
Mahankal Boudha, Kathmandu, Nepal
Phone: +977 9855060846
Email: dynamiclife2026@gmail.com`},
 {slug:'privacy-policy',title:'Privacy Policy',summary:'How we use personal information to support your shopping and membership.',enabled:true,updatedAt:'2026-11-05',body:`## Who this policy covers
This policy describes personal information handled through Dynamic Life Success shopping, account, support and member services. It also explains browser storage, shared product links and third-party features. We aim to use information for the purposes described here and respect applicable privacy rights under Nepal law.

## Information you provide
We collect information needed for the services you use: your name, username, email, phone number, delivery address and selected country, province, district and municipality. Registration may include a Sponsor or referral relationship. Your account may contain membership, rank, placement and permissions information. We keep order items, amounts, payment references, delivery/dispatch details, reward points and commission or wallet ledger records. If you request an eligible payout or supply payment proof, the relevant bank or wallet details and uploaded documents may be recorded. Contact and franchise forms contain the information you choose to send.

## Security and activity records
Login and security records may include IP address, browser information, login success and session history. These help protect accounts, investigate misuse and troubleshoot the service. Passwords are stored as salted hashes. Sensitive server credentials are encrypted. Do not send us your bank PIN, card security code, wallet PIN or one-time password; enter payment credentials only on the provider's genuine payment interface.

## How information is used
We use relevant information to create and protect accounts, process and verify orders, coordinate deliveries, answer inquiries, send requested password-reset messages, maintain transaction records and calculate eligible rewards and commissions. Addresses are used to associate relevant service/dispatch centers and regional coordinators with their operational area. Referral and product-share information identifies the eligible sales recipient for an order. We also use necessary records to handle complaints, investigate fraud, reconcile balances and meet applicable legal obligations. We do not use this policy as permission for unrelated publication or unrestricted use of your information.

## Cookies and browser storage
The site uses session cookies for member/admin sign-in and browser storage for your cart, checkout recovery and interface preferences. A valid product-share link can remember product attribution in the same browser for up to 30 days for eligibility checks. Clearing browser storage can remove the cart or attribution and signing out ends the relevant login session. Some essential functionality will not work if the required cookies or storage are blocked.

## Who may receive information
Authorised administrators, assigned dispatch/service staff and relevant regional coordinators can access information needed for their permitted work. Relevant delivery partners receive the contact and address details needed to fulfill an order. Payment gateways process payment information and provide transaction identifiers or status. Hosting, database and email providers support operation of the service. Information may be disclosed when required by law or necessary to address a lawful request, fraud or a dispute. We do not give other members access to your password or grant unrestricted access to your private account. Referral relationships and relevant sales totals may be visible in permitted network/coordinator views.

## Embedded services and external links
YouTube video embeds, Google Maps, payment gateways and social-share links are third-party services. An embed may contact its provider when a page loads, even if you do not interact with it. These providers may process network/device information and use their own cookies under their policies. Choosing to share a product sends the selected text/link to the chosen service or device share target. The availability and location of hosting and provider processing may involve countries outside Nepal; contact us with questions about the current arrangement.

## Retention, account closure and your choices
We retain information as needed for the service, transaction/accounting records, security, legal obligations and resolving disputes. Account closure can end access without immediately erasing historical orders, ledger entries or necessary referral/placement records. You may contact us to request access, correction, an explanation of use, restriction or deletion of information where applicable. We may need to verify your identity and explain any information that must be retained and why. Correct contact details through your account where available. Contact us separately about inquiries or information that cannot be changed through the account screen.

## Safeguards and updates
We use access controls, password hashing and other safeguards appropriate to the service. No online system can promise absolute security. Please use a unique password, protect your device and tell us promptly about suspected misuse. Revised policies will be published with an updated date; contact us if you have questions about a material change or the handling of an earlier transaction.

## Privacy contact
Dynamic Life Success
Mahankal Boudha, Kathmandu, Nepal
Phone: +977 9855060846
Email: dynamiclife2026@gmail.com
For privacy requests, describe your concern and relevant account/order reference. Do not include passwords, PINs or OTPs.`}
];
export const legalVersion=p=>createHash('sha256').update(JSON.stringify([p.slug,p.title,p.summary,p.body,p.enabled,p.updatedAt])).digest('hex');
export function legalPages(settings){return Object.hasOwn(settings,'legalPages')?settings.legalPages:structuredClone(legalDefaults);}
export const publicLegalPages=settings=>legalPages(settings).filter(p=>p.enabled);
export function createLegalPages(db){const read=async(c=db)=>(await c.query('SELECT data FROM settings WHERE id=1')).rows[0].data;return {list:async()=>legalPages(await read()).map(p=>({...p,version:legalVersion(p)})),save:async(slug,input,actor,remove=false)=>db.transaction(async c=>{const row=(await c.query('SELECT data FROM settings WHERE id=1 FOR UPDATE')).rows[0],pages=legalPages(row.data),index=pages.findIndex(p=>p.slug===slug),old=pages[index];if(slug&&(!old||input.version!==legalVersion(old)))fail(old?'This page changed. Refresh before saving.':'Page not found',old?409:404);if(remove)pages.splice(index,1);else{const text=(key,max)=>{if(typeof input[key]!=='string'||input[key].length>max)fail('Invalid page '+key);return input[key].trim();},next={slug:slug||text('slug',80),title:text('title',180),summary:text('summary',600),body:text('body',40000),enabled:input.enabled,updatedAt:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Katmandu'})};if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next.slug)||['admin','api','products','about','cart','contact'].includes(next.slug)||!next.title||!next.body||typeof next.enabled!=='boolean')fail('Enter a valid page URL, title, content and status');if(!slug&&pages.some(p=>p.slug===next.slug))fail('Page URL already exists',409);if(pages.length>=30&&!slug)fail('Use up to 30 information pages');if(old)pages[index]=next;else pages.push(next);}await c.query('UPDATE settings SET data=$1 WHERE id=1',[{...row.data,legalPages:pages}]);await c.query("INSERT INTO audit(action,kind,details) VALUES($1,'legal-pages',$2)",[remove?'Deleted information page':'Saved information page',{slug:slug||input.slug,actor}]);return {ok:true};})};}
