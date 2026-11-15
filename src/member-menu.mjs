import {fail} from './validation.mjs';

export const memberMenus = {
 dashboard:'Dashboard', products:'Products', discount:'Discount Panel', wholesale:'Wholesale Panel',
 quick:'Quick Order', referrals:'My Referrals', team:'Sales Team', registration:'Registration Center',
 earth:'Earth List', sky:'Sky List', detailed:'Detailed Report', reports:'Reports',
 kyc:'KYC Verification', points:'Point Log', rewards:'Reward Points', earnings:'Ecommerce Earnings',
 security:'2FA & Security', tracking:'Track Order', orders:'My Orders', deposits:'Deposit',
 withdrawals:'Withdraw', ledger:'Transactions', profile:'Profile', notifications:'Notifications',
 regions:'Coordinator Panel', card:'Affiliate Card', password:'Change Password'
};

export function requireMemberMenu(member, key) {
 if (!Object.hasOwn(memberMenus,key)||!member.permissions.includes(key))fail('This menu is not enabled for your account',403);
}

export function requireShopMenu(member, channel) {
 const menus={retail:'products',quick:'quick',discount:'discount',wholesale:'wholesale'};
 if(!Object.hasOwn(menus,channel))fail('Choose a product panel');
 requireMemberMenu(member,menus[channel]);
}

export const profileMenus = ['profile','dashboard','referrals','detailed','reports','kyc','points','rewards','earnings','security','card'];
