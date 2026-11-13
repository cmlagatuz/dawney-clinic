import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewStaffIntent} from '../src/intent.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const account=(userId,extra={})=>({userId,emailConfirmed:true,anonymous:false,
 deleted:false,banned:false,active:true,role:'administrator',aal:'aal2',...extra});
const input=(operation='grant',role='staff')=>({operation,role,reasonCode:'onboarding',ticketId:'STAFF-2026-001'});
const context=()=>({trustedServerContext:true,actor:account(A),
 target:account(B,{role:'staff'}),reviewer:account(C),activeAdminCount:2,
 currentTargetRole:'staff',currentTargetActive:false});
test('grant non-admin through verified MFA admin with auditable intent',()=>{
 const out=reviewStaffIntent(input(),context());
 assert.equal(out.subjectUserId,B);
 assert.equal(out.actorUserId,A);
 assert.equal(out.reviewerUserId,null);
 assert.equal(out.requiresTrustedTransaction,true);
});
test('privileged admin grant requires independent verified MFA reviewer',()=>{
 const c=context();
 const out=reviewStaffIntent(input('grant','administrator'),c);
 assert.equal(out.reviewerUserId,C);
 c.reviewer=account(A);
 assert.throws(()=>reviewStaffIntent(input('grant','administrator'),c),/separate reviewer/);
 c.reviewer=account(C,{aal:'aal1'});
 assert.throws(()=>reviewStaffIntent(input('grant','administrator'),c),/MFA/);
});
test('deny browser-supplied context, self-service and unverified users',()=>{
 const c=context();c.trustedServerContext=false;
 assert.throws(()=>reviewStaffIntent(input(),c),/trusted server/);
 c.trustedServerContext=true;c.target=account(A);
 assert.throws(()=>reviewStaffIntent(input(),c),/own membership/);
 c.target=account(B,{emailConfirmed:false});
 assert.throws(()=>reviewStaffIntent(input(),c),/Unverified/);
});
test('revoke or demote last administrator blocked even with reviewer',()=>{
 const c=context();c.currentTargetRole='administrator';c.currentTargetActive=true;c.activeAdminCount=1;
 assert.throws(()=>reviewStaffIntent(input('revoke'),c),/last active administrator/);
 const demote=input('role_change','staff');demote.reasonCode='role-change';
 assert.throws(()=>reviewStaffIntent(demote,c),/last active administrator/);
});
test('reject missing audit reason, role spoofing and inactive actor',()=>{
 const c=context();const bad=input();bad.ticketId='x';
 assert.throws(()=>reviewStaffIntent(bad,c),/audit ticket/);
 assert.throws(()=>reviewStaffIntent(input('grant','root'),c),/Unknown staff role/);
 c.actor=account(A,{active:false});
 assert.throws(()=>reviewStaffIntent(input(),c),/active admin/);
});
