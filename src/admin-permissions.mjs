import {fail} from './validation.mjs';

export const adminRoles=['Admin','Admin Staff','Dispatch Center Manager','Service Center Manager'];
export const permissionGroups=[
 ['dashboard','Dashboard',['view']],['users','Members',['view','manage','delete','security','balance','rank','network','coordinators','rewards','preview']],
 ['products','Products',['view','manage']],['orders','Orders',['view','manage','dispatch']],['centers','All centers',['view','manage']],['dispatch-centers','Dispatch centers',['view','manage']],['service-centers','Service centers',['view','manage']],['tasks','Service tasks',['view','manage']],
 ['plans','Membership plans',['view','manage']],['affiliates','Affiliate ranks',['view','manage']],['ranks','BV ranks',['view','manage']],
 ['deposits','Deposits',['view','manage']],['withdrawals','Withdrawals',['view','manage']],['pins','PINs',['view','manage']],
 ['leads','CRM leads',['view','manage']],['tickets','Support tickets',['view','manage']],['settings','Brand & CMS',['view','manage']],
 ['benefits','Coupons & rewards',['manage']],['categories','Product categories',['manage']],['media','Upload photos/video',['manage']],
 ['payment-settings','Payment settings',['view','manage']],['reward-settings','Reward settings',['view','manage']],['commission-settings','Commission settings',['view','manage']],['commissions','Dispatch commissions',['view','request','manage']],['inventory','Dispatch stock',['view','transfer','receive','dispatch','adjust']],['reports','Activity reports',['view']],['archive','Source archive',['view']],['import','Import source data',['manage']]
];
export const permissionKeys=permissionGroups.flatMap(([key,,actions])=>actions.map(a=>key+'.'+a));
export const defaultRolePermissions={
 'Admin Staff':['dashboard.view','users.view','users.manage','products.view','products.manage','orders.view','orders.manage','leads.view','leads.manage','tickets.view','tickets.manage','tasks.view','tasks.manage','centers.view','affiliates.view','plans.view','ranks.view','categories.manage','media.manage'],
 'Dispatch Center Manager':['dashboard.view','orders.view','orders.dispatch','products.view','dispatch-centers.view','inventory.view','inventory.receive','inventory.dispatch','commissions.view','commissions.request'],
 'Service Center Manager':['dashboard.view','tasks.view','tasks.manage','service-centers.view']
};
export const isCenterManager=p=>['Dispatch Center Manager','Service Center Manager'].includes(p.role);
export const can=(p,key)=>p.role==='Admin'||p.permissions?.includes(key);
export const requirePermission=(p,...keys)=>{if(!keys.some(k=>can(p,k)))fail('Your role does not have access to this action',403);};
export function validatePermissions(value){if(!Array.isArray(value)||value.length>permissionKeys.length||value.some(k=>!permissionKeys.includes(k)))fail('Choose valid permissions');return [...new Set(value)].sort();}
export function validateOverrides(value={allow:[],deny:[]}){if(!value||typeof value!=='object'||Array.isArray(value))fail('Invalid personal permissions');const allow=validatePermissions(value.allow),deny=validatePermissions(value.deny);if(allow.some(k=>deny.includes(k)))fail('A permission cannot be both allowed and denied');return {allow,deny};}
export async function seedRolePermissions(db){await db.transaction(async c=>{const old=(await c.query("SELECT * FROM admin_role_permissions WHERE role='Dispatch Center Manager' FOR UPDATE")).rows[0],defaults=defaultRolePermissions['Dispatch Center Manager'],prior=defaults.filter(p=>!p.startsWith('commissions.'));if(old&&[1,2].includes(old.version)&&JSON.stringify([...old.permissions].sort())===JSON.stringify([...prior].sort())){await c.query("UPDATE admin_role_permissions SET permissions=$1,version=version+1 WHERE role='Dispatch Center Manager'",[JSON.stringify(defaults)]);await c.query("DELETE FROM sessions WHERE username IN (SELECT username FROM administrators WHERE role='Dispatch Center Manager')");}});for(const [role,permissions] of Object.entries(defaultRolePermissions)){await db.query('INSERT INTO admin_role_permissions(role,permissions) VALUES($1,$2) ON CONFLICT DO NOTHING',[role,JSON.stringify(permissions)]);const additions=permissions.filter(p=>p.startsWith('inventory.')||p.startsWith('commissions.'));if(!additions.length)continue;await db.transaction(async c=>{const old=(await c.query('SELECT * FROM admin_role_permissions WHERE role=$1 FOR UPDATE',[role])).rows[0],legacy=permissions.filter(p=>!p.startsWith('inventory.')&&!p.startsWith('commissions.'));if(old.version===1&&JSON.stringify([...old.permissions].sort())===JSON.stringify([...legacy].sort())){await c.query('UPDATE admin_role_permissions SET permissions=$2,version=version+1 WHERE role=$1',[role,JSON.stringify(permissions)]);await c.query('DELETE FROM sessions WHERE username IN (SELECT username FROM administrators WHERE role=$1)',[role]);await c.query("INSERT INTO audit(action,kind,details) VALUES('Enabled default dispatch stock workflow','administrators',$1)",[{role,permissions:additions}]);}});}}
export async function permissionsFor(db,principal){
 if(principal.role==='Admin')return {...principal,permissions:['*']};if(principal.import_metadata?.accessReview)return {...principal,permissions:[]};
 const role=(await db.query('SELECT permissions FROM admin_role_permissions WHERE role=$1',[principal.role])).rows[0]?.permissions||[];
 const overrides=principal.permission_overrides||{allow:[],deny:[]},set=new Set([...role,...overrides.allow]);for(const k of overrides.deny)set.delete(k);if(overrides.deny.includes('orders.dispatch')&&!overrides.allow.includes('inventory.dispatch'))set.delete('inventory.dispatch');
 return {...principal,permissions:[...set]};
}
export function authorizeAdmin(p,path,method){
 if(p.role==='Admin')return;
 if(['/api/session','/api/logout'].includes(path))return;
 if(path==='/api/dashboard')return requirePermission(p,'dashboard.view');
 if(path.startsWith('/api/admin-users')||path.startsWith('/api/admin-roles'))fail('Only an Admin can manage administrator accounts and roles',403);
 const record=path.match(/^\/api\/records\/([a-z]+)(?:\/(\d+))?$/);
 if(record){const [,kind,id]=record;if(method==='GET')return requirePermission(p,kind+'.view',kind+'.manage',...(kind==='centers'?['dispatch-centers.view','service-centers.view','dispatch-centers.manage','service-centers.manage']:kind==='affiliates'?['users.rank','products.manage','settings.manage']:[]));if(kind==='orders'&&id&&method==='PUT')return requirePermission(p,'orders.manage','orders.dispatch');return requirePermission(p,kind+'.manage');}
 if(path.startsWith('/api/products/'))return requirePermission(p,'products.manage');
 if(path.startsWith('/api/categories'))return requirePermission(p,'categories.manage',...(method==='GET'?['products.view','products.manage']:[]));
 if(path==='/api/users/lookup')return requirePermission(p,'users.view','users.manage','users.network','users.rewards');
 const user=path.match(/^\/api\/users\/\d+(?:\/([a-z]+)(?:\/\d+)?)?$/);
 if(user){const action=user[1];if(!action)return requirePermission(p,...(method==='GET'?['users.view','users.manage']:method==='DELETE'?['users.delete']:['users.manage']));
  if(action==='rewards')return requirePermission(p,'users.rewards');
  if(['password','permissions'].includes(action))return requirePermission(p,'users.security');
  if(action==='balance')return requirePermission(p,'users.balance');
  if(['coordinators','unassign'].includes(action))return requirePermission(p,'users.coordinators');
  if(action==='rank')return requirePermission(p,'users.rank');
  if(['network','tree','teamlist'].includes(action))return requirePermission(p,method==='GET'?'users.view':'users.network');
  if(['shop','order','trackorder','orders','deposits','withdrawals','earnings','ledger','logins','notifications','regions'].includes(action)&&method==='GET')return requirePermission(p,'users.view');
  if(['status','notifications'].includes(action))return requirePermission(p,'users.manage');
  fail('Your role does not have access to this member action',403);
 }
 if(path==='/api/coordinators')return requirePermission(p,'users.coordinators');
 if(path.startsWith('/api/coupons'))return requirePermission(p,'benefits.manage');
 if(path==='/api/settings')return requirePermission(p,...(method==='GET'?['settings.view','settings.manage','products.manage','users.preview','benefits.manage']:['settings.manage','benefits.manage']));
 if(['/api/media','/api/hero-video'].includes(path))return requirePermission(p,'media.manage');
 if(['/api/about-page','/api/blog-posts','/api/email-settings'].some(prefix=>path.startsWith(prefix)))return requirePermission(p,...(method==='GET'?['settings.view','settings.manage']:['settings.manage']));
 if(path==='/api/audit')return requirePermission(p,'reports.view');
 if(path==='/api/archive')return requirePermission(p,'archive.view');
 if(['/api/import','/api/stage'].includes(path))return requirePermission(p,'import.manage');
 fail('Your role does not have access to this endpoint',403);
}
export function centerScope(p){if(!isCenterManager(p))return {};if(!p.centerId)fail('Ask an Admin to assign your center',403);return {centerId:p.centerId};}
