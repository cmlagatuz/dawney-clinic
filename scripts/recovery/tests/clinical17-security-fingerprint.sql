-- PostgreSQL17 logical ACL/RLS/SECURITY DEFINER fingerprint.
-- Print exactly one ordered JSON-per-object record; callers byte-compare
-- source and restored fingerprints. Includes all browsable schema/table/column
-- and routine grant matrices (anon + authenticated), explicit PUBLIC ACEs,
-- effective ACL grantees, ownership, default ACLs, policies and triggers.
-- No synthetic SQL writes. No network or provider connection.
WITH
 namespaces AS (
 SELECT n.oid,n.nspname,pg_get_userbyid(n.nspowner) own,
        n.nspacl
 FROM pg_namespace n
 WHERE n.nspname IN ('public','clinic_private','auth','storage','extensions','clinic_ci')
 ),
 entities AS (
 SELECT 'schema'::text k,n.nspname::text identity,
 jsonb_build_object('owner',n.own,'acl',coalesce((
  SELECT jsonb_agg(jsonb_build_array(
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
  FROM aclexplode(coalesce(n.nspacl,acldefault('n', (SELECT nspowner FROM pg_namespace WHERE oid=n.oid)))) a
 ),'[]'::jsonb),'anonUsage',has_schema_privilege('anon',n.oid,'USAGE'),
 'authUsage',has_schema_privilege('authenticated',n.oid,'USAGE')) payload
 FROM namespaces n
 UNION ALL
 SELECT 'relation',n.nspname||'.'||c.relname,
 jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,
  'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
   FROM aclexplode(coalesce(c.relacl,acldefault(
    (case when c.relkind='S' then 's' else 'r' end)::"char",c.relowner))) a),'[]'::jsonb),
  'roleMatrix',(
    SELECT jsonb_object_agg(role_name,rights ORDER BY role_name)
    FROM (SELECT role_name,jsonb_build_object(
       'SELECT',has_table_privilege(role_name,c.oid,'SELECT'),
       'INSERT',has_table_privilege(role_name,c.oid,'INSERT'),
       'UPDATE',has_table_privilege(role_name,c.oid,'UPDATE'),
       'DELETE',has_table_privilege(role_name,c.oid,'DELETE'),
       'TRUNCATE',has_table_privilege(role_name,c.oid,'TRUNCATE'),
       'REFERENCES',has_table_privilege(role_name,c.oid,'REFERENCES'),
       'TRIGGER',has_table_privilege(role_name,c.oid,'TRIGGER')) rights
     FROM (VALUES ('anon'),('authenticated')) roles(role_name)) q)
 ) FROM pg_class c JOIN namespaces n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f')
 UNION ALL
 SELECT 'sequence',n.nspname||'.'||c.relname,
 jsonb_build_object('owner',pg_get_userbyid(c.relowner),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
   FROM aclexplode(coalesce(c.relacl,acldefault('s',c.relowner))) a),'[]'::jsonb),
  'roleMatrix',(SELECT jsonb_object_agg(role_name,jsonb_build_object(
   'USAGE',has_sequence_privilege(role_name,c.oid,'USAGE'),
   'SELECT',has_sequence_privilege(role_name,c.oid,'SELECT'),
   'UPDATE',has_sequence_privilege(role_name,c.oid,'UPDATE')))
   FROM (VALUES('anon'),('authenticated')) roles(role_name)))
 FROM pg_class c JOIN namespaces n ON n.oid=c.relnamespace
 WHERE c.relkind='S'
 UNION ALL
 SELECT 'column',n.nspname||'.'||c.relname||'.'||a.attname,
 jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),
 'notNull',a.attnotnull,
 'acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
  case when acl.grantee=0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end,
  pg_get_userbyid(acl.grantor),acl.privilege_type,acl.is_grantable)
  ORDER BY acl.grantee,acl.grantor,acl.privilege_type,acl.is_grantable)
  FROM aclexplode(a.attacl) acl),'[]'::jsonb),
 'roleMatrix', (SELECT jsonb_object_agg(rl,jsonb_build_object(
  'SELECT',has_column_privilege(rl,c.oid,a.attnum,'SELECT'),
  'INSERT',has_column_privilege(rl,c.oid,a.attnum,'INSERT'),
  'UPDATE',has_column_privilege(rl,c.oid,a.attnum,'UPDATE'),
  'REFERENCES',has_column_privilege(rl,c.oid,a.attnum,'REFERENCES')))
  FROM (VALUES('anon'),('authenticated')) rr(rl)))
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 JOIN namespaces n ON n.oid=c.relnamespace
 WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p','v','m','f')
 UNION ALL
 SELECT 'routine',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
 jsonb_build_object('owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,
  -- Exact SQL definition includes body, arguments, return type and SET clauses.
  -- SHA256 catches a CREATE OR REPLACE body change with unchanged grants/owner.
  'definitionSha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
  'bodySha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
  'language',l.lanname,'kind',p.prokind,'volatility',p.provolatile,
  'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,
  'securityDefiner',p.prosecdef,'returnsSet',p.proretset,
  'resultType',format_type(p.prorettype,null),
  'cost',p.procost,'rows',p.prorows,
  'config',coalesce(to_jsonb(p.proconfig),'[]'::jsonb),
  'acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
   case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
   ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
   FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb),
  'anonExec',has_function_privilege('anon',p.oid,'EXECUTE'),
  'authExec',has_function_privilege('authenticated',p.oid,'EXECUTE'))
 FROM pg_proc p JOIN namespaces n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang
 WHERE p.prokind IN ('f','p','w')
 UNION ALL
 SELECT 'policy',n.nspname||'.'||c.relname||'.'||p.polname,
 jsonb_build_object('cmd',p.polcmd,'permissive',p.polpermissive,
 'roles',(SELECT coalesce(jsonb_agg(
  case when id=0 then 'PUBLIC' else pg_get_userbyid(id) end ORDER BY id),'[]'::jsonb)
  FROM unnest(p.polroles) id),
 'using',pg_get_expr(p.polqual,p.polrelid),
 'check',pg_get_expr(p.polwithcheck,p.polrelid))
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
 JOIN namespaces n ON n.oid=c.relnamespace
 UNION ALL
 SELECT 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,
 jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN namespaces n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal
 UNION ALL
 SELECT 'default_acl',n.nspname||'.'||pg_get_userbyid(d.defaclrole)||'.'||d.defaclobjtype::text,
 jsonb_build_object('acl',coalesce((SELECT jsonb_agg(jsonb_build_array(
  case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
  pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
  ORDER BY a.grantee,a.grantor,a.privilege_type,a.is_grantable)
 FROM aclexplode(d.defaclacl) a),'[]'::jsonb))
 FROM pg_default_acl d JOIN namespaces n ON n.oid=d.defaclnamespace
)
SELECT k||E'\t'||identity||E'\t'||payload::text
FROM entities ORDER BY k,identity;
